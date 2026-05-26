const state = {
  busy: false,
  readings: [],
  lastReadingId: null,
};

const els = {
  connection: document.querySelector("#connection"),
  connectionText: document.querySelector("#connectionText"),
  freshness: document.querySelector("#freshness"),
  freshnessText: document.querySelector("#freshnessText"),
  heroStatus: document.querySelector("#heroStatus"),
  heroTitle: document.querySelector("#heroTitle"),
  heroSubtitle: document.querySelector("#heroSubtitle"),
  heroPwm: document.querySelector("#heroPwm"),
  pwmPercent: document.querySelector("#pwmPercent"),
  pwmBar: document.querySelector("#pwmBar"),
  distanceInline: document.querySelector("#distanceInline"),
  distanceBar: document.querySelector("#distanceBar"),
  lampStatus: document.querySelector("#lampStatus"),
  lampName: document.querySelector("#lampName"),
  mode: document.querySelector("#mode"),
  remoteMode: document.querySelector("#remoteMode"),
  distance: document.querySelector("#distance"),
  presence: document.querySelector("#presence"),
  pwm: document.querySelector("#pwm"),
  current: document.querySelector("#current"),
  power: document.querySelector("#power"),
  consumption: document.querySelector("#consumption"),
  updatedAt: document.querySelector("#updatedAt"),
  sampleCount: document.querySelector("#sampleCount"),
  totalConsumption: document.querySelector("#totalConsumption"),
  averagePower: document.querySelector("#averagePower"),
  peakPower: document.querySelector("#peakPower"),
  estimatedSavings: document.querySelector("#estimatedSavings"),
  energyWindow: document.querySelector("#energyWindow"),
  energyEmptyState: document.querySelector("#energyEmptyState"),
  timeline: document.querySelector("#timeline"),
  chart: document.querySelector("#historyChart"),
  energyChart: document.querySelector("#energyChart"),
  // ── toggle controls ──
  lampToggle: document.querySelector("#lampToggle"),
  autoToggle: document.querySelector("#autoToggle"),
  lampToggleStatus: document.querySelector("#lampToggleStatus"),
  autoToggleStatus: document.querySelector("#autoToggleStatus"),
  manualToggleCard: document.querySelector("#manualToggleCard"),
  // ── new dashboard bindings ──
  tempoLigada: document.querySelector("#tempoLigada"),
  eficienciaPercent: document.querySelector("#eficienciaPercent"),
  ringFill: document.querySelector("#ringFill"),
  presenceFill: document.querySelector("#presenceFill"),
  presencaComLabel: document.querySelector("#presencaComLabel"),
  presencaSemLabel: document.querySelector("#presencaSemLabel"),
  pwmMedio: document.querySelector("#pwmMedio"),
  economiaPercent: document.querySelector("#economiaPercent"),
  consumoReal: document.querySelector("#consumoReal"),
  consumoRef: document.querySelector("#consumoRef"),
  economiaKwh: document.querySelector("#economiaKwh"),
  compFillRef: document.querySelector("#compFillRef"),
  compFillReal: document.querySelector("#compFillReal"),
  // buttons includes toggles so sendCommand auto-disables them
  buttons: [
    document.querySelector("#turnOn"),
    document.querySelector("#turnOff"),
    document.querySelector("#lampToggle"),
    document.querySelector("#autoToggle"),
  ],
};

// ── Formatters (unchanged) ──

function fmt(value, fallback = "--") {
  return value === null || value === undefined || value === "" ? fallback : value;
}

function fmtNumber(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "--";
  }
  return Number(value).toFixed(digits);
}

function fmtEnergy(kwh) {
  if (kwh === null || kwh === undefined || Number.isNaN(Number(kwh))) {
    return "--";
  }
  const value = Number(kwh);
  if (value >= 0.01) return `${value.toFixed(4)} kWh`;
  const wh = value * 1000;
  if (wh >= 0.01) return `${wh.toFixed(3)} Wh`;
  return `${(wh * 1000).toFixed(2)} mWh`;
}

function fmtDate(value) {
  if (!value) return "--";
  const normalized = typeof value === "string" && !value.includes("Z") ? value : value;
  return new Date(normalized).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function parseReadingDate(value) {
  if (!value) return null;
  return new Date(value);
}

function secondsSince(value) {
  const date = parseReadingDate(value);
  if (!date || Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
}

// ── Connection / freshness (unchanged) ──

function setConnection(online, text) {
  els.connection.classList.toggle("online", online);
  els.connection.classList.toggle("offline", !online);
  els.connectionText.textContent = text;
  els.connection.title = text;
}

function setFreshness(latest) {
  const age = secondsSince(latest?.criada_em);
  if (age === null) {
    els.freshness.classList.remove("online");
    els.freshness.classList.add("offline");
    els.freshnessText.textContent = "Sem leitura";
    els.freshness.title = "Sem leitura";
    return;
  }
  const fresh = age <= 12;
  const text = fresh ? `Leitura há ${age}s` : `Desatualizado há ${age}s`;
  els.freshness.classList.toggle("online", fresh);
  els.freshness.classList.toggle("offline", !fresh);
  els.freshnessText.textContent = text;
  els.freshness.title = text;
}

// ── API / command (unchanged) ──

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { Accept: "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `HTTP ${response.status}`);
  }
  return response.json();
}

async function sendCommand(path) {
  if (state.busy) return;
  state.busy = true;
  els.buttons.forEach((b) => { b.disabled = true; });
  try {
    await api(path, { method: "POST" });
    await refresh();
  } catch (error) {
    setConnection(false, "Erro no comando");
    console.error(error);
  } finally {
    state.busy = false;
    els.buttons.forEach((b) => { b.disabled = false; });
  }
}

// ── Chart renderers (unchanged logic, updated colors) ──

function drawChart(readings) {
  const canvas = els.chart;
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  const pad = 36;
  const data = readings.slice().reverse();

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "rgba(0,0,0,0.015)";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(0,0,0,0.06)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i += 1) {
    const y = pad + ((height - pad * 2) / 4) * i;
    ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(width - pad, y); ctx.stroke();
  }

  if (data.length < 2) {
    ctx.fillStyle = "#8E8E93";
    ctx.font = "600 16px -apple-system, system-ui";
    ctx.fillText("Aguardando leituras", pad, height / 2);
    return;
  }

  const xPos = (i) => pad + ((width - pad * 2) / (data.length - 1)) * i;
  const yPos = (v, max) => height - pad - (Math.max(0, Math.min(Number(v || 0), max)) / max) * (height - pad * 2);

  const line = (vals, color, max) => {
    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.beginPath();
    vals.forEach((v, i) => { i === 0 ? ctx.moveTo(xPos(i), yPos(v, max)) : ctx.lineTo(xPos(i), yPos(v, max)); });
    ctx.stroke();
  };

  line(data.map((r) => r.intensidade_pwm), "#30D158", 255);
  line(data.map((r) => r.distancia_cm), "#007AFF", 80);

  ctx.fillStyle = "#30D158"; ctx.font = "600 12px -apple-system, system-ui";
  ctx.fillText("PWM", pad, 22);
  ctx.fillStyle = "#007AFF";
  ctx.fillText("Distância", pad + 50, 22);
}

function drawEnergyChart(readings) {
  const canvas = els.energyChart;
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  const pad = 34;
  const data = readings.slice().reverse();

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "rgba(0,0,0,0.015)";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(0,0,0,0.06)"; ctx.lineWidth = 1;
  for (let i = 0; i < 4; i += 1) {
    const y = pad + ((height - pad * 2) / 3) * i;
    ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(width - pad, y); ctx.stroke();
  }

  if (data.length < 2) return;

  const maxPower = Math.max(10.2, ...data.map((r) => Number(r.potencia || 0)));
  const maxConsumption = Math.max(0.00002, ...data.map((r) => Number(r.consumo_estimado || 0)));
  const bw = Math.max(6, (width - pad * 2) / data.length - 5);

  data.forEach((r, i) => {
    const v = Number(r.consumo_estimado || 0);
    const bx = pad + ((width - pad * 2) / data.length) * i + 2;
    const bh = (v / maxConsumption) * (height - pad * 2);
    ctx.fillStyle = "rgba(0,122,255,0.18)";
    ctx.fillRect(bx, height - pad - bh, bw, bh);
  });

  ctx.strokeStyle = "#FF9F0A"; ctx.lineWidth = 3; ctx.lineJoin = "round"; ctx.lineCap = "round";
  ctx.beginPath();
  data.forEach((r, i) => {
    const px = pad + ((width - pad * 2) / (data.length - 1)) * i;
    const py = height - pad - (Number(r.potencia || 0) / maxPower) * (height - pad * 2);
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  });
  ctx.stroke();

  ctx.fillStyle = "#FF9F0A"; ctx.font = "600 12px -apple-system, system-ui";
  ctx.fillText("Potência (W)", pad, 22);
  ctx.fillStyle = "rgba(0,122,255,0.8)";
  ctx.fillText("Energia/amostra", pad + 130, 22);
}

// ── Timeline renderer (unchanged) ──

function renderTimeline(readings) {
  if (!readings.length) {
    els.timeline.innerHTML = '<div class="reading"><strong>Sem leituras ainda</strong></div>';
    return;
  }
  els.timeline.innerHTML = readings.slice(0, 8).map((item) => `
    <article class="reading">
      <strong>${fmt(item.modo, item.status_lampada)}</strong>
      <dl>
        <dt>Horário</dt><dd>${fmtDate(item.criada_em)}</dd>
        <dt>Distância</dt><dd>${fmtNumber(item.distancia_cm)} cm</dd>
        <dt>PWM</dt><dd>${fmt(item.intensidade_pwm)}</dd>
        <dt>Corrente</dt><dd>${fmtNumber(item.corrente, 3)} A</dd>
        <dt>Presença</dt><dd>${item.presenca_detectada ? "sim" : "não"}</dd>
      </dl>
    </article>
  `).join("");
}

// ── Main render (existing logic preserved + new dashboards) ──

function render(lamp, readings) {
  const latest = readings[0] || {};
  const previousReadingId = state.lastReadingId;
  state.lastReadingId = latest.id ?? null;
  const pwm = Number(latest.intensidade_pwm || 0);
  const pwmPercent = Math.round((pwm / 255) * 100);
  const distance = Number(latest.distancia_cm);
  const distancePercent = Number.isFinite(distance) ? Math.max(0, Math.min(100, (distance / 80) * 100)) : 0;

  els.lampStatus.textContent = fmt(lamp.status);
  els.lampName.textContent = fmt(lamp.nome, "Lampada 1");
  els.mode.textContent = fmt(latest.modo, latest.status_lampada || "--");
  els.remoteMode.textContent = latest.modo_remoto ? "Controle remoto" : "Sensor automático";
  els.distance.textContent = fmtNumber(latest.distancia_cm);
  els.presence.textContent = latest.presenca_detectada ? "Presença detectada" : "Sem presença";
  els.pwm.textContent = fmt(latest.intensidade_pwm);
  els.current.textContent = fmtNumber(latest.corrente, 3);
  els.power.textContent = fmtNumber(latest.potencia, 2);
  els.consumption.textContent = `${fmtNumber(latest.consumo_estimado, 8)} kWh`;
  els.updatedAt.textContent = fmtDate(latest.criada_em);
  els.sampleCount.textContent = `Últimas ${readings.length} amostras`;
  els.heroTitle.textContent = fmt(latest.modo, latest.status_lampada || "Aguardando dados");
  els.heroSubtitle.textContent = latest.presenca_detectada
    ? `Presença detectada a ${fmtNumber(latest.distancia_cm)} cm.`
    : `Sem presença detectada. Última leitura às ${fmtDate(latest.criada_em)}.`;
  els.heroPwm.textContent = fmt(latest.intensidade_pwm);
  els.pwmPercent.textContent = Number.isFinite(pwmPercent) ? pwmPercent : "--";
  els.pwmBar.style.width = `${Math.max(0, Math.min(100, pwmPercent || 0))}%`;
  els.distanceInline.textContent = fmtNumber(latest.distancia_cm);
  els.distanceBar.style.width = `${distancePercent}%`;
  els.heroStatus.dataset.mode = latest.modo_remoto ? "remote"
    : latest.presenca_detectada ? "presence" : "night";
  if (latest.id && previousReadingId && latest.id !== previousReadingId) {
    els.heroStatus.classList.remove("pulse");
    void els.heroStatus.offsetWidth;
    els.heroStatus.classList.add("pulse");
  }
  setFreshness(latest);

  const energyReadings = readings.filter((r) => r.potencia !== null || r.consumo_estimado !== null);
  const totalConsumption = energyReadings.reduce((s, r) => s + Number(r.consumo_estimado || 0), 0);
  const totalPower = energyReadings.reduce((s, r) => s + Number(r.potencia || 0), 0);
  const averagePower = energyReadings.length ? totalPower / energyReadings.length : null;
  const peakPower = energyReadings.length
    ? Math.max(...energyReadings.map((r) => Number(r.potencia || 0))) : null;
  const maxReferencePower = 10.2;
  const estimatedSavings = averagePower === null ? null
    : Math.max(0, Math.min(100, ((maxReferencePower - averagePower) / maxReferencePower) * 100));

  els.totalConsumption.textContent = fmtEnergy(totalConsumption);
  els.averagePower.textContent = fmtNumber(averagePower, 2);
  els.peakPower.textContent = fmtNumber(peakPower, 2);
  els.estimatedSavings.textContent = fmtNumber(estimatedSavings, 0);
  els.energyWindow.textContent = `${energyReadings.length} amostras recentes`;

  const hasEnergyData = energyReadings.length >= 2;
  els.energyEmptyState.classList.toggle("hidden", hasEnergyData);
  els.energyChart.classList.toggle("hidden", !hasEnergyData);

  renderTimeline(readings);
  drawChart(readings.slice(0, 24));
  if (hasEnergyData) drawEnergyChart(readings.slice(0, 24));

  // ── Toggle sync ──
  const isOn = pwm > 0;
  const isAuto = !!latest.modo_remoto;
  els.lampToggle.checked = isOn;
  els.lampToggleStatus.textContent = isOn ? "Ligada" : "Desligada";
  els.manualToggleCard.classList.toggle("toggle-disabled", isAuto);
  els.autoToggle.checked = isAuto;
  els.autoToggleStatus.textContent = isAuto ? "Sensor ativo" : "Manual";

  // ── Tempo ligada ──
  const onReadings = readings.filter((r) => Number(r.intensidade_pwm || 0) > 0);
  const onSec = onReadings.length;
  const onHours = onSec / 3600;
  const tH = Math.floor(onSec / 3600);
  const tM = Math.floor((onSec % 3600) / 60);
  const tS = onSec % 60;
  els.tempoLigada.textContent = tH > 0 ? `${tH}h ${tM}m` : tM > 0 ? `${tM}m ${tS}s` : `${tS}s`;

  // ── Eficiência ──
  const presencaOn = onReadings.filter((r) => r.presenca_detectada).length;
  const eficiencia = onReadings.length > 0
    ? Math.min(100, Math.max(0, (presencaOn / onReadings.length) * 100)) : null;
  els.eficienciaPercent.textContent = eficiencia !== null ? fmtNumber(eficiencia, 0) : "--";

  const RING_C = 326.73;
  const ringOffset = eficiencia !== null ? RING_C * (1 - eficiencia / 100) : RING_C;
  els.ringFill.style.strokeDashoffset = ringOffset;
  els.ringFill.style.stroke = eficiencia === null ? "#8E8E93"
    : eficiencia >= 70 ? "#30D158"
    : eficiencia >= 40 ? "#FF9F0A"
    : "#FF3B30";

  const presencaTotal = readings.filter((r) => r.presenca_detectada).length;
  const presencaPct = readings.length > 0 ? (presencaTotal / readings.length) * 100 : 0;
  els.presenceFill.style.width = `${presencaPct}%`;
  els.presencaComLabel.textContent = `${presencaTotal} c/ presença`;
  els.presencaSemLabel.textContent = `${readings.length - presencaTotal} sem`;

  const avgPwm = onReadings.length > 0
    ? onReadings.reduce((s, r) => s + Number(r.intensidade_pwm || 0), 0) / onReadings.length : null;
  els.pwmMedio.textContent = avgPwm !== null ? fmtNumber(avgPwm, 0) : "--";

  // ── Economia ──
  const consumoRefKwh = (60 / 1000) * onHours;
  const economiaKwhVal = Math.max(0, consumoRefKwh - totalConsumption);
  const economiaPct = consumoRefKwh > 0
    ? Math.min(100, Math.max(0, (economiaKwhVal / consumoRefKwh) * 100)) : null;

  els.consumoReal.textContent = fmtEnergy(totalConsumption);
  els.consumoRef.textContent = fmtEnergy(consumoRefKwh);
  els.economiaKwh.textContent = economiaKwhVal > 0 ? fmtEnergy(economiaKwhVal) : "--";
  els.economiaPercent.textContent = economiaPct !== null ? fmtNumber(economiaPct, 0) : "--";

  const barScale = consumoRefKwh > 0 ? Math.min(100, (totalConsumption / consumoRefKwh) * 100) : 0;
  els.compFillRef.style.width = "100%";
  els.compFillReal.style.width = `${barScale}%`;
}

// ── Refresh (unchanged) ──

async function refresh() {
  try {
    const [lamp, readings] = await Promise.all([
      api("/lampada/status"),
      api("/leituras?limite=40"),
    ]);
    state.readings = readings;
    render(lamp, readings);
    setConnection(true, "Online");
  } catch (error) {
    setConnection(false, "Sem dados");
    console.error(error);
  }
}

// ── Event listeners ──

els.lampToggle.addEventListener("change", () => {
  sendCommand(els.lampToggle.checked ? "/lampada/ligar" : "/lampada/desligar");
});

els.autoToggle.addEventListener("change", () => {
  sendCommand(els.autoToggle.checked ? "/lampada/automatico" : "/lampada/desligar");
});

// Hidden legacy buttons (bindings preserved)
document.querySelector("#turnOn").addEventListener("click", () => sendCommand("/lampada/ligar"));
document.querySelector("#turnOff").addEventListener("click", () => sendCommand("/lampada/desligar"));

refresh();
setInterval(refresh, 1000);
