const { useState, useEffect, useRef, useCallback } = React;

const REFRESH_MS = 2000;
const CHART_WINDOW = 30;
const VOLTAGE = 12;
const HIGH_CURRENT_THRESHOLD = 1.0;

// ── Formatters ──────────────────────────────────────────────────────────────

function fmt(v, fallback = '--') {
  return v === null || v === undefined || v === '' ? fallback : v;
}

function fmtNum(v, decimals = 1) {
  const n = Number(v);
  return v === null || v === undefined || isNaN(n) ? '--' : n.toFixed(decimals);
}

function fmtEnergy(kwh) {
  if (kwh === null || kwh === undefined || isNaN(Number(kwh))) return '--';
  const v = Number(kwh);
  if (v >= 0.01) return `${v.toFixed(4)} kWh`;
  const wh = v * 1000;
  if (wh >= 0.01) return `${wh.toFixed(3)} Wh`;
  return `${(wh * 1000).toFixed(2)} mWh`;
}

function fmtDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function fmtTime(iso) {
  if (!iso) return '--';
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

// ── API ─────────────────────────────────────────────────────────────────────

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { Accept: 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`);
  return res.json();
}

// ── StatusBadge ─────────────────────────────────────────────────────────────

function StatusBadge({ ok, label }) {
  return (
    <div className={`status-badge ${ok ? 'badge-online' : 'badge-offline'}`}>
      <span className="badge-dot" />
      <span>{label}</span>
    </div>
  );
}

// ── Gauge (semicircle) ───────────────────────────────────────────────────────

function IntensityGauge({ percent }) {
  const pct = Math.max(0, Math.min(100, percent || 0));
  const arcLen = Math.PI * 54; // π × r, r=54
  const filled = (pct / 100) * arcLen;
  const color = pct > 70 ? '#16A34A' : pct > 30 ? '#CA8A04' : '#2563EB';

  return (
    <div className="gauge-wrap">
      <svg viewBox="0 0 130 76" className="gauge-svg" aria-hidden="true">
        {/* background arc */}
        <path
          d="M 11 65 A 54 54 0 0 1 119 65"
          fill="none"
          stroke="rgba(0,0,0,0.08)"
          strokeWidth="11"
          strokeLinecap="round"
        />
        {/* fill arc */}
        <path
          d="M 11 65 A 54 54 0 0 1 119 65"
          fill="none"
          stroke={color}
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${arcLen}`}
          style={{ transition: 'stroke-dasharray 0.4s ease, stroke 0.3s ease' }}
        />
      </svg>
      <div className="gauge-center">
        <span className="gauge-number" style={{ color }}>{pct}</span>
        <span className="gauge-pct">%</span>
      </div>
      <div className="gauge-caption">INTENSIDADE</div>
    </div>
  );
}

// ── MetricCard ───────────────────────────────────────────────────────────────

function MetricCard({ icon, value, unit, label, sub, alert }) {
  return (
    <article className={`metric-card${alert ? ' metric-alert' : ''}`}>
      <div className="mc-icon">{icon}</div>
      <div className="mc-body">
        <div className="mc-value">
          <span className="mc-number">{value}</span>
          {unit && <span className="mc-unit">{unit}</span>}
        </div>
        <div className="mc-label">{label}</div>
        {sub && <div className="mc-sub">{sub}</div>}
      </div>
    </article>
  );
}

// ── RealtimeChart ────────────────────────────────────────────────────────────

function RealtimeChart({ readings }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Intensidade (%)',
            data: [],
            borderColor: '#16A34A',
            backgroundColor: 'rgba(22,163,74,0.08)',
            tension: 0.4,
            fill: true,
            pointRadius: 2,
            yAxisID: 'y',
          },
          {
            label: 'Corrente ×10 (A)',
            data: [],
            borderColor: '#2563EB',
            backgroundColor: 'transparent',
            tension: 0.4,
            fill: false,
            pointRadius: 2,
            yAxisID: 'y',
          },
          {
            label: 'Distância (cm)',
            data: [],
            borderColor: '#CA8A04',
            backgroundColor: 'transparent',
            tension: 0.4,
            fill: false,
            pointRadius: 2,
            borderDash: [4, 3],
            yAxisID: 'y2',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: { boxWidth: 10, font: { size: 11 }, padding: 14, usePointStyle: true },
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(0,0,0,0.04)' },
            ticks: { font: { size: 10 }, maxTicksLimit: 7, color: '#9CA3AF' },
          },
          y: {
            position: 'left',
            min: 0,
            max: 100,
            grid: { color: 'rgba(0,0,0,0.04)' },
            ticks: { font: { size: 10 }, color: '#9CA3AF', stepSize: 25 },
          },
          y2: {
            position: 'right',
            min: 0,
            max: 100,
            grid: { drawOnChartArea: false },
            ticks: { font: { size: 10 }, color: '#CA8A04', stepSize: 25 },
          },
        },
      },
    });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, []);

  useEffect(() => {
    if (!chartRef.current || !readings.length) return;
    const data = readings.slice().reverse().slice(-CHART_WINDOW);
    const c = chartRef.current;
    c.data.labels = data.map(r => fmtTime(r.criada_em));
    c.data.datasets[0].data = data.map(r => Math.round((Number(r.intensidade_pwm || 0) / 255) * 100));
    c.data.datasets[1].data = data.map(r => +(Number(r.corrente || 0) * 10).toFixed(2));
    c.data.datasets[2].data = data.map(r => +Number(r.distancia_cm || 0).toFixed(1));
    c.update('none');
  }, [readings]);

  return (
    <div className="chart-container">
      <canvas ref={canvasRef} />
    </div>
  );
}

// ── EventLog ─────────────────────────────────────────────────────────────────

function EventLog({ readings, cmdLogs }) {
  return (
    <div className="log-scroll">
      {readings.length === 0 && cmdLogs.length === 0 ? (
        <div className="log-empty">Aguardando eventos...</div>
      ) : (
        <>
          {cmdLogs.map((l, i) => (
            <div key={`cmd-${i}`} className="log-row log-cmd">
              <span className="log-msg">{l}</span>
            </div>
          ))}
          {readings.slice(0, 12).map(r => (
            <div key={r.id} className={`log-row${r.presenca_detectada ? ' log-presence' : ''}`}>
              <span className="log-time">{fmtTime(r.criada_em)}</span>
              <span className="log-mode">{r.modo || r.status_lampada || '--'}</span>
              <span className="log-detail">
                {fmtNum(r.distancia_cm, 0)} cm · PWM {fmt(r.intensidade_pwm)} · {fmtNum(r.corrente, 3)} A
              </span>
              {r.presenca_detectada && <span className="log-tag">Presença</span>}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── SavingsRing ──────────────────────────────────────────────────────────────

function SavingsRing({ pct }) {
  const circ = 2 * Math.PI * 46;
  const filled = (Math.max(0, Math.min(100, pct || 0)) / 100) * circ;
  const color = pct >= 50 ? '#16A34A' : pct >= 20 ? '#CA8A04' : '#DC2626';
  return (
    <div className="ring-wrap">
      <svg viewBox="0 0 108 108" className="ring-svg" aria-hidden="true">
        <circle cx="54" cy="54" r="46" fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="10" />
        <circle
          cx="54" cy="54" r="46"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circ}`}
          transform="rotate(-90 54 54)"
          style={{ transition: 'stroke-dasharray 0.6s ease, stroke 0.3s ease' }}
        />
      </svg>
      <div className="ring-center">
        <span className="ring-number" style={{ color }}>{pct !== null ? Math.round(pct) : '--'}</span>
        <span className="ring-unit">%</span>
      </div>
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────

function App() {
  const [lamp, setLamp] = useState(null);
  const [readings, setReadings] = useState([]);
  const [esp32Online, setEsp32Online] = useState(false);
  const [mqttFresh, setMqttFresh] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cmdLogs, setCmdLogs] = useState([]);

  const latest = readings[0] || {};
  const pwm = Number(latest.intensidade_pwm || 0);
  const pwmPct = Math.round((pwm / 255) * 100);
  const current = Number(latest.corrente || 0);
  const power = Number(latest.potencia || 0);
  const distance = Number(latest.distancia_cm || 0);
  const isOn = pwm > 0;
  // modo_remoto=true no firmware significa "controle remoto/manual ativo"
  // isAuto=true deve significar "modo automático por sensor ativo" → lógica invertida
  const isAuto = !latest.modo_remoto;
  const highCurrent = current > HIGH_CURRENT_THRESHOLD;

  const onReadings = readings.filter(r => Number(r.intensidade_pwm || 0) > 0);
  const onHours = onReadings.length / 3600;
  const totalKwh = readings.reduce((s, r) => s + Number(r.consumo_estimado || 0), 0);
  const refKwh = (60 / 1000) * onHours;
  const savingsKwh = Math.max(0, refKwh - totalKwh);
  const savingsPct = refKwh > 0 ? Math.min(100, Math.max(0, (savingsKwh / refKwh) * 100)) : null;
  const avgPower = readings.length
    ? readings.reduce((s, r) => s + Number(r.potencia || 0), 0) / readings.length : null;
  const peakPower = readings.length
    ? Math.max(...readings.map(r => Number(r.potencia || 0))) : null;
  const avgPwmPct = onReadings.length
    ? Math.round(onReadings.reduce((s, r) => s + Number(r.intensidade_pwm || 0), 0) / onReadings.length / 255 * 100) : null;
  const presenceCount = readings.filter(r => r.presenca_detectada).length;

  const log = useCallback(msg => {
    const t = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setCmdLogs(prev => [`[${t}] ${msg}`, ...prev].slice(0, 20));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [lampData, readingsData] = await Promise.all([
        api('/lampada/status'),
        api('/leituras?limite=40'),
      ]);
      setLamp(lampData);
      setReadings(readingsData);
      setEsp32Online(true);
      const r0 = readingsData[0];
      if (r0?.criada_em) {
        const age = (Date.now() - new Date(r0.criada_em).getTime()) / 1000;
        setMqttFresh(age < 15);
      } else {
        setMqttFresh(false);
      }
    } catch {
      setEsp32Online(false);
      setMqttFresh(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const sendCmd = useCallback(async (path, msg) => {
    if (busy) return;
    setBusy(true);
    try {
      await api(path, { method: 'POST' });
      log(msg);
      await refresh();
    } catch (e) {
      log(`Erro: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }, [busy, refresh, log]);

  const toggleLamp = () => sendCmd(isOn ? '/lampada/desligar' : '/lampada/ligar',
    isOn ? 'Lâmpada desligada (manual)' : 'Lâmpada ligada (manual)');
  const toggleAuto = () => sendCmd(isAuto ? '/lampada/desligar' : '/lampada/automatico',
    isAuto ? 'Modo automático desativado' : 'Modo automático ativado');

  return (
    <div className="app">

      {/* ── Header ── */}
      <header className="header">
        <div className="header-brand">
          <div className="brand-bulb" aria-hidden="true">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="14" r="8" fill="#FDE68A" stroke="#CA8A04" strokeWidth="1.5"/>
              <path d="M13 22h6M13.5 25h5M14 28h4" stroke="#CA8A04" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M16 6V4M8 8L6.5 6.5M24 8l1.5-1.5M6 14H4M28 14h-2" stroke="#CA8A04" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <h1 className="brand-name">ReciLuz</h1>
            <p className="brand-tagline">Iluminação Inteligente · ESP32 + MQTT</p>
          </div>
        </div>
        <div className="header-right">
          <StatusBadge ok={esp32Online} label="ESP32" />
          <StatusBadge ok={mqttFresh} label="MQTT" />
          <div className="header-time">{fmtTime(latest.criada_em)}</div>
        </div>
      </header>

      <div className="shell">

        {/* ── Alert bar ── */}
        {highCurrent && (
          <div className="alert-bar" role="alert">
            <span className="alert-icon">⚠</span>
            <span>
              Corrente elevada detectada: <strong>{fmtNum(current, 3)} A</strong> — verifique o circuito!
            </span>
          </div>
        )}

        {/* ── Controls ── */}
        <section className="controls-grid">

          {/* Current mode */}
          <div className="card mode-card">
            <div className="mode-label">MODO ATUAL</div>
            <div className={`mode-pill ${isAuto ? 'mode-auto' : 'mode-manual'}`}>
              {isAuto ? (
                <><span className="mode-icon">◉</span> Automático</>
              ) : (
                <><span className="mode-icon">◎</span> Manual</>
              )}
            </div>
            <p className="mode-desc">
              {isAuto
                ? 'Brilho controlado pela distância do sensor'
                : isOn ? 'Lâmpada ligada por comando manual' : 'Lâmpada apagada'}
            </p>
            <div className={`lamp-dot ${isOn ? 'lamp-on' : 'lamp-off'}`} title={isOn ? 'Ligada' : 'Desligada'} />
          </div>

          {/* Manual control */}
          <div className={`card ctrl-card${isAuto ? ' ctrl-disabled' : ''}`}>
            <div className="ctrl-label">CONTROLE MANUAL</div>
            <button
              className={`btn-power ${isOn && !isAuto ? 'btn-power-on' : 'btn-power-off'}`}
              onClick={toggleLamp}
              disabled={busy || isAuto}
              aria-pressed={isOn && !isAuto}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M12 2v6M18.36 5.64A9 9 0 1 1 5.64 5.64"/>
              </svg>
              {isOn && !isAuto ? 'LIGADA' : 'DESLIGADA'}
            </button>
            {isAuto && <p className="ctrl-hint">Desative o modo automático primeiro</p>}
          </div>

          {/* Auto control */}
          <div className="card ctrl-card">
            <div className="ctrl-label">MODO AUTOMÁTICO</div>
            <button
              className={`btn-auto ${isAuto ? 'btn-auto-on' : 'btn-auto-off'}`}
              onClick={toggleAuto}
              disabled={busy}
              aria-pressed={isAuto}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
              </svg>
              {isAuto ? 'ATIVO' : 'INATIVO'}
            </button>
            <p className="ctrl-hint">
              {isAuto ? 'Quanto mais próximo, maior o brilho' : 'Toque para ativar o sensor'}
            </p>
          </div>

        </section>

        {/* ── Gauge + Metrics ── */}
        <section className="gauge-section">

          <div className="card gauge-card">
            <IntensityGauge percent={pwmPct} />
            <div className="gauge-meta">
              <div className="gm-item">
                <span className="gm-label">PWM</span>
                <span className="gm-value">{fmt(latest.intensidade_pwm, '--')}/255</span>
              </div>
              <div className="gm-divider" />
              <div className="gm-item">
                <span className="gm-label">Status</span>
                <span className={`gm-value ${isOn ? 'gm-on' : 'gm-off'}`}>{isOn ? 'Ligada' : 'Desligada'}</span>
              </div>
            </div>
          </div>

          <div className="metrics-grid">
            <MetricCard
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>}
              value={fmtNum(distance, 0)} unit="cm"
              label="Distância"
              sub={latest.presenca_detectada ? '● Presença detectada' : '○ Sem presença'}
            />
            <MetricCard
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={highCurrent ? '#DC2626' : '#CA8A04'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>}
              value={fmtNum(current, 3)} unit="A"
              label="Corrente"
              sub="Sensor ACS712"
              alert={highCurrent}
            />
            <MetricCard
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>}
              value={fmtNum(power, 2)} unit="W"
              label="Potência"
              sub={`${VOLTAGE}V × ${fmtNum(current, 3)}A`}
            />
            <MetricCard
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 6l-9.5 9.5-5-5L1 18"/><polyline points="17 6 23 6 23 12"/></svg>}
              value={VOLTAGE} unit="V"
              label="Tensão"
              sub="LED 12 V DC"
            />
            <MetricCard
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0891B2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
              value={fmtEnergy(totalKwh)} unit=""
              label="Consumo Acum."
              sub="Energia total acumulada"
            />
            <MetricCard
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M7 13s.5 3 5 3 5-3 5-3"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>}
              value={savingsPct !== null ? `${Math.round(savingsPct)}%` : '--'} unit=""
              label="Economia"
              sub="vs lâmpada 60 W"
            />
          </div>

        </section>

        {/* ── Chart + Log ── */}
        <section className="chart-log-section">

          <div className="card chart-card">
            <div className="card-head">
              <h2 className="card-title">Monitoramento em Tempo Real</h2>
              <span className="card-badge">{readings.length} amostras</span>
            </div>
            <RealtimeChart readings={readings} />
          </div>

          <div className="card log-card">
            <div className="card-head">
              <h2 className="card-title">Log de Eventos</h2>
            </div>
            <EventLog readings={readings} cmdLogs={cmdLogs} />
          </div>

        </section>

        {/* ── Analytics ── */}
        <section className="analytics-section">

          {/* Economia */}
          <div className="card analytics-card">
            <div className="card-head">
              <h2 className="card-title">Economia Estimada</h2>
              <span className="card-badge">ref. 60 W contínua</span>
            </div>
            <div className="analytics-body">
              <SavingsRing pct={savingsPct} />
              <div className="analytics-stats">
                <div className="astat-row">
                  <span className="astat-label">Consumo real</span>
                  <span className="astat-value">{fmtEnergy(totalKwh)}</span>
                </div>
                <div className="astat-row">
                  <span className="astat-label">Referência (60 W)</span>
                  <span className="astat-value">{fmtEnergy(refKwh)}</span>
                </div>
                <div className="astat-row astat-highlight">
                  <span className="astat-label">Energia economizada</span>
                  <span className="astat-value">{fmtEnergy(savingsKwh)}</span>
                </div>
                <div className="compare-bars">
                  <div className="compare-row">
                    <span className="compare-label">Referência</span>
                    <div className="compare-track">
                      <div className="compare-fill compare-ref" style={{ width: '100%' }} />
                    </div>
                  </div>
                  <div className="compare-row">
                    <span className="compare-label">Real</span>
                    <div className="compare-track">
                      <div
                        className="compare-fill compare-real"
                        style={{ width: `${refKwh > 0 ? Math.min(100, (totalKwh / refKwh) * 100) : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Consumo */}
          <div className="card analytics-card">
            <div className="card-head">
              <h2 className="card-title">Consumo & Eficiência</h2>
            </div>
            <div className="stats-list">
              <div className="sl-row">
                <span className="sl-label">Potência média</span>
                <span className="sl-value">{fmtNum(avgPower, 2)} W</span>
              </div>
              <div className="sl-row">
                <span className="sl-label">Pico de potência</span>
                <span className="sl-value">{fmtNum(peakPower, 2)} W</span>
              </div>
              <div className="sl-row">
                <span className="sl-label">Acumulado total</span>
                <span className="sl-value">{fmtEnergy(totalKwh)}</span>
              </div>
              <div className="sl-row">
                <span className="sl-label">Tempo ligada</span>
                <span className="sl-value">{fmtDuration(onReadings.length)}</span>
              </div>
              <div className="sl-row">
                <span className="sl-label">Intensidade média</span>
                <span className="sl-value">{avgPwmPct !== null ? `${avgPwmPct}%` : '--'}</span>
              </div>
              <div className="sl-row">
                <span className="sl-label">Leituras com presença</span>
                <span className="sl-value">{presenceCount} / {readings.length}</span>
              </div>
            </div>
            <div className="presence-section">
              <div className="presence-top">
                <span className="presence-label">Detecções de presença</span>
                <span className="presence-pct">
                  {readings.length > 0 ? Math.round((presenceCount / readings.length) * 100) : 0}%
                </span>
              </div>
              <div className="presence-track">
                <div
                  className="presence-fill"
                  style={{ width: `${readings.length > 0 ? (presenceCount / readings.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

        </section>

      </div>

      <footer className="footer">
        <span>ReciLuz Dashboard · Atualização a cada {REFRESH_MS / 1000}s</span>
        <span>Última leitura: {fmtTime(latest.criada_em)}</span>
      </footer>

    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
