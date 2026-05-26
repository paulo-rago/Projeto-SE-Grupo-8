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
  timeline: document.querySelector("#timeline"),
  chart: document.querySelector("#historyChart"),
  energyChart: document.querySelector("#energyChart"),
  buttons: [
    document.querySelector("#turnOn"),
    document.querySelector("#turnOff"),
    document.querySelector("#autoMode"),
  ],
};

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
  if (value >= 0.01) {
    return `${value.toFixed(4)} kWh`;
  }

  const wh = value * 1000;
  if (wh >= 0.01) {
    return `${wh.toFixed(3)} Wh`;
  }

  return `${(wh * 1000).toFixed(2)} mWh`;
}

function fmtDate(value) {
  if (!value) {
    return "--";
  }
  const normalized = typeof value === "string" && !value.includes("Z") ? value : value;
  return new Date(normalized).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function parseReadingDate(value) {
  if (!value) {
    return null;
  }
  return new Date(value);
}

function secondsSince(value) {
  const date = parseReadingDate(value);
  if (!date || Number.isNaN(date.getTime())) {
    return null;
  }
  return Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
}

function setConnection(online, text) {
  els.connection.classList.toggle("online", online);
  els.connection.classList.toggle("offline", !online);
  els.connectionText.textContent = text;
}

function setFreshness(latest) {
  const age = secondsSince(latest?.criada_em);

  if (age === null) {
    els.freshness.classList.remove("online");
    els.freshness.classList.add("offline");
    els.freshnessText.textContent = "Sem leitura";
    return;
  }

  const fresh = age <= 12;
  els.freshness.classList.toggle("online", fresh);
  els.freshness.classList.toggle("offline", !fresh);
  els.freshnessText.textContent = fresh ? `Leitura há ${age}s` : `Desatualizado há ${age}s`;
}

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
  if (state.busy) {
    return;
  }

  state.busy = true;
  els.buttons.forEach((button) => {
    button.disabled = true;
  });

  try {
    await api(path, { method: "POST" });
    await refresh();
  } catch (error) {
    setConnection(false, "Erro no comando");
    console.error(error);
  } finally {
    state.busy = false;
    els.buttons.forEach((button) => {
      button.disabled = false;
    });
  }
}

function drawChart(readings) {
  const canvas = els.chart;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const pad = 36;
  const data = readings.slice().reverse();

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#f6f8f7";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "#dce3df";
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i += 1) {
    const y = pad + ((height - pad * 2) / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(width - pad, y);
    ctx.stroke();
  }

  if (data.length < 2) {
    ctx.fillStyle = "#66736d";
    ctx.font = "700 18px system-ui";
    ctx.fillText("Aguardando leituras", pad, height / 2);
    return;
  }

  function x(index) {
    return pad + ((width - pad * 2) / (data.length - 1)) * index;
  }

  function y(value, max) {
    const safe = Math.max(0, Math.min(Number(value || 0), max));
    return height - pad - (safe / max) * (height - pad * 2);
  }

  function line(values, color, max) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    values.forEach((value, index) => {
      const px = x(index);
      const py = y(value, max);
      if (index === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    });
    ctx.stroke();
  }

  line(data.map((item) => item.intensidade_pwm), "#16845b", 255);
  line(data.map((item) => item.distancia_cm), "#0f7a83", 80);

  ctx.fillStyle = "#17211d";
  ctx.font = "800 13px system-ui";
  ctx.fillText("PWM", pad, 22);
  ctx.fillStyle = "#0f7a83";
  ctx.fillText("Distancia", pad + 56, 22);
}

function drawEnergyChart(readings) {
  const canvas = els.energyChart;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const pad = 34;
  const data = readings.slice().reverse();

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#f6f8f7";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "#dce3df";
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i += 1) {
    const y = pad + ((height - pad * 2) / 3) * i;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(width - pad, y);
    ctx.stroke();
  }

  if (data.length < 2) {
    ctx.fillStyle = "#66736d";
    ctx.font = "700 16px system-ui";
    ctx.fillText("Aguardando consumo", pad, height / 2);
    return;
  }

  const maxPower = Math.max(10.2, ...data.map((item) => Number(item.potencia || 0)));
  const maxConsumption = Math.max(0.00002, ...data.map((item) => Number(item.consumo_estimado || 0)));
  const barWidth = Math.max(6, (width - pad * 2) / data.length - 5);

  data.forEach((item, index) => {
    const value = Number(item.consumo_estimado || 0);
    const x = pad + ((width - pad * 2) / data.length) * index + 2;
    const barHeight = (value / maxConsumption) * (height - pad * 2);
    ctx.fillStyle = "rgba(15, 122, 131, 0.28)";
    ctx.fillRect(x, height - pad - barHeight, barWidth, barHeight);
  });

  ctx.strokeStyle = "#b97813";
  ctx.lineWidth = 4;
  ctx.beginPath();
  data.forEach((item, index) => {
    const x = pad + ((width - pad * 2) / (data.length - 1)) * index;
    const value = Number(item.potencia || 0);
    const y = height - pad - (value / maxPower) * (height - pad * 2);
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();

  ctx.fillStyle = "#17211d";
  ctx.font = "800 13px system-ui";
  ctx.fillText("Linha: potência instantânea", pad, 22);
  ctx.fillStyle = "#0f7a83";
  ctx.fillText("Barras: energia por amostra", pad + 190, 22);
}

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
  els.heroStatus.dataset.mode = latest.modo_remoto
    ? "remote"
    : latest.presenca_detectada
      ? "presence"
      : "night";
  if (latest.id && previousReadingId && latest.id !== previousReadingId) {
    els.heroStatus.classList.remove("pulse");
    void els.heroStatus.offsetWidth;
    els.heroStatus.classList.add("pulse");
  }
  setFreshness(latest);

  const energyReadings = readings.filter((item) => item.potencia !== null || item.consumo_estimado !== null);
  const totalConsumption = energyReadings.reduce((sum, item) => sum + Number(item.consumo_estimado || 0), 0);
  const totalPower = energyReadings.reduce((sum, item) => sum + Number(item.potencia || 0), 0);
  const averagePower = energyReadings.length ? totalPower / energyReadings.length : null;
  const peakPower = energyReadings.length
    ? Math.max(...energyReadings.map((item) => Number(item.potencia || 0)))
    : null;
  const maxReferencePower = 10.2;
  const estimatedSavings = averagePower === null
    ? null
    : Math.max(0, Math.min(100, ((maxReferencePower - averagePower) / maxReferencePower) * 100));

  els.totalConsumption.textContent = fmtEnergy(totalConsumption);
  els.averagePower.textContent = fmtNumber(averagePower, 2);
  els.peakPower.textContent = fmtNumber(peakPower, 2);
  els.estimatedSavings.textContent = fmtNumber(estimatedSavings, 0);
  els.energyWindow.textContent = `${energyReadings.length} amostras recentes`;

  renderTimeline(readings);
  drawChart(readings.slice(0, 24));
  drawEnergyChart(readings.slice(0, 24));
}

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

document.querySelector("#turnOn").addEventListener("click", () => sendCommand("/lampada/ligar"));
document.querySelector("#turnOff").addEventListener("click", () => sendCommand("/lampada/desligar"));
document.querySelector("#autoMode").addEventListener("click", () => sendCommand("/lampada/automatico"));

refresh();
setInterval(refresh, 1000);
