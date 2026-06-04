const { useState, useEffect, useRef, useCallback, useMemo } = React;

const REFRESH_MS = 2000;
const CHART_WINDOW = 30;
const VOLTAGE = 12;
const HIGH_CURRENT_THRESHOLD = 1.0;

/* ─────────────────────────── FORMATTERS */
const fmt = (v, fallback = '--') => (v === null || v === undefined || v === '') ? fallback : v;
const fmtNum = (v, dec = 1) => {
  const n = Number(v);
  return (v === null || v === undefined || isNaN(n)) ? '--' : n.toFixed(dec);
};
const fmtEnergy = (kwh) => {
  if (kwh === null || kwh === undefined || isNaN(Number(kwh))) return '--';
  const v = Number(kwh);
  if (v >= 0.01) return `${v.toFixed(4)} kWh`;
  const wh = v * 1000;
  if (wh >= 0.01) return `${wh.toFixed(3)} Wh`;
  return `${(wh * 1000).toFixed(2)} mWh`;
};
const fmtDuration = (s) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
};
const fmtTime = (iso) => !iso ? '--' :
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

/* ─────────────────────────── API */
async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { Accept: 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`);
  return res.json();
}

/* ─────────────────────────── HERO SVG SCENE */
function HeroScene() {
  return (
    <div className="scene" aria-hidden="true">
      {/* SKY */}
      <svg className="layer-sky par" data-par="0.08" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" style={{ height: '100%' }}>
        <defs>
          <radialGradient id="sun" cx="50%" cy="92%" r="60%">
            <stop offset="0%" stopColor="#FFD995" stopOpacity="0.85" />
            <stop offset="30%" stopColor="#F5A87A" stopOpacity="0.45" />
            <stop offset="60%" stopColor="#B05E60" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#1B2748" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="1600" height="900" fill="url(#sun)" />
        <ellipse cx="280" cy="220" rx="170" ry="14" fill="#E89E5C" opacity="0.20" />
        <ellipse cx="1280" cy="180" rx="220" ry="12" fill="#F0B97A" opacity="0.18" />
        <ellipse cx="800" cy="280" rx="140" ry="9" fill="#FFD995" opacity="0.15" />
      </svg>

      {/* STARS */}
      <svg className="layer-stars par" data-par="0.05" viewBox="0 0 1600 600" preserveAspectRatio="xMidYMid slice" style={{ height: '65%' }}>
        {Array.from({ length: 60 }).map((_, i) => {
          const x = (i * 137) % 1600;
          const y = (i * 73) % 280;
          const r = 0.6 + (i % 3) * 0.35;
          return <circle key={i} className={`twinkle ${i % 4 === 0 ? 't2' : i % 3 === 0 ? 't3' : i % 5 === 0 ? 't4' : ''}`} cx={x} cy={y} r={r} fill="#fff" opacity={0.55} />;
        })}
      </svg>

      {/* SKYLINE */}
      <svg className="layer-skyline par" data-par="0.18" viewBox="0 0 1600 480" preserveAspectRatio="xMidYEnd slice">
        <defs>
          <linearGradient id="skylineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1A2444" />
            <stop offset="100%" stopColor="#0B1530" />
          </linearGradient>
        </defs>
        <g opacity="0.55" fill="#2A3656">
          <rect x="40" y="260" width="90" height="220" /><rect x="140" y="230" width="60" height="250" />
          <rect x="210" y="250" width="55" height="230" /><rect x="275" y="280" width="45" height="200" />
          <rect x="1320" y="210" width="75" height="270" /><rect x="1405" y="250" width="55" height="230" />
          <rect x="1475" y="230" width="45" height="250" />
        </g>
        <g fill="url(#skylineGrad)">
          <rect x="330" y="310" width="60" height="170" />
          <polygon points="330,310 360,290 390,310" />
          <rect x="390" y="290" width="55" height="190" />
          <rect x="385" y="285" width="65" height="8" />
          <rect x="445" y="305" width="60" height="175" />
          <path d="M 445 305 Q 475 280 505 305 Z" />
          <rect x="510" y="260" width="95" height="220" />
          <path d="M 510 260 Q 510 245 525 245 L 590 245 Q 605 245 605 260 Z" />
          <rect x="540" y="195" width="35" height="70" />
          <path d="M 540 195 Q 540 175 557 168 Q 575 175 575 195 Z" />
          <rect x="555" y="152" width="4" height="16" />
          <polygon points="553,152 561,152 557,144" />
          <rect x="605" y="320" width="40" height="160" /><rect x="645" y="305" width="45" height="175" />
          <rect x="690" y="325" width="38" height="155" />
          <rect x="735" y="245" width="130" height="235" />
          <polygon points="735,245 800,210 865,245" />
          <rect x="785" y="215" width="30" height="8" />
          <rect x="752" y="160" width="24" height="90" />
          <polygon points="747,160 781,160 764,138" />
          <rect x="760" y="128" width="8" height="12" />
          <rect x="824" y="160" width="24" height="90" />
          <polygon points="819,160 853,160 836,138" />
          <rect x="832" y="128" width="8" height="12" />
          <rect x="865" y="305" width="55" height="175" />
          <path d="M 865 305 Q 892 285 920 305 Z" />
          <rect x="920" y="290" width="50" height="190" />
          <polygon points="920,290 920,275 935,275 935,265 950,265 950,275 970,275 970,290" />
          <rect x="980" y="230" width="60" height="250" />
          <polygon points="980,230 982,210 1038,210 1040,230" />
          <ellipse cx="1010" cy="210" rx="30" ry="22" />
          <rect x="1003" y="168" width="14" height="22" />
          <ellipse cx="1010" cy="168" rx="10" ry="6" />
          <rect x="1008" y="148" width="4" height="22" />
          <polygon points="1005,148 1015,148 1010,138" />
          <rect x="1040" y="315" width="40" height="165" /><rect x="1080" y="295" width="50" height="185" />
          <polygon points="1080,295 1105,278 1130,295" />
          <rect x="1135" y="190" width="55" height="290" fill="#222D4D" />
          <rect x="1192" y="225" width="42" height="255" />
          <rect x="1238" y="310" width="55" height="170" />
          <path d="M 1238 310 Q 1265 290 1293 310 Z" />
          <rect x="1293" y="295" width="50" height="185" />
          <rect x="1343" y="275" width="60" height="205" />
          <polygon points="1343,275 1373,255 1403,275" />
          <rect x="1365" y="222" width="16" height="56" />
          <polygon points="1361,222 1385,222 1373,205" />
        </g>
        <g fill="#F5A623">
          {[
            [345,350,3,4],[345,390,3,4],[345,430,3,4],[400,330,3,4],[400,370,3,4],[400,410,3,4],[420,440,3,4],
            [458,340,3,4],[478,380,3,4],[463,420,3,4],[530,290,4,5],[560,300,4,5],[585,290,4,5],[550,210,3,4],
            [615,360,3,4],[618,410,3,4],[655,340,3,4],[670,380,3,4],[660,420,3,4],[700,360,3,4],[702,420,3,4],
            [761,180,3,4],[833,180,3,4],[765,280,3,4],[800,300,3,4],[835,280,3,4],[770,330,3,4],[830,330,3,4],[800,380,3,4],[800,430,3,4],
            [880,335,3,4],[900,375,3,4],[885,420,3,4],[935,320,3,4],[955,360,3,4],[945,410,3,4],
            [988,250,2,3],[1000,250,2,3],[1015,250,2,3],[1030,250,2,3],[988,290,3,4],[1010,330,3,4],[1030,290,3,4],[1010,400,3,4],
            [1052,345,3,4],[1055,395,3,4],[1063,440,3,4],[1093,325,3,4],[1115,365,3,4],[1100,410,3,4],
            [1145,220,3,3],[1160,220,3,3],[1175,220,3,3],[1145,250,3,3],[1175,250,3,3],[1145,280,3,3],[1160,280,3,3],[1175,280,3,3],
            [1145,310,3,3],[1145,340,3,3],[1160,340,3,3],[1175,340,3,3],[1145,370,3,3],[1160,370,3,3],
            [1145,400,3,3],[1175,400,3,3],[1145,430,3,3],[1160,430,3,3],[1175,430,3,3],
            [1200,255,3,3],[1215,255,3,3],[1200,290,3,3],[1200,325,3,3],[1215,325,3,3],[1200,360,3,3],[1200,395,3,3],[1215,395,3,3],[1200,430,3,3],
            [1248,340,3,4],[1268,380,3,4],[1253,420,3,4],[1303,335,3,4],[1323,375,3,4],[1310,420,3,4],
            [1355,310,3,4],[1385,310,3,4],[1370,360,3,4],[1370,410,3,4],
          ].map(([x, y, w, h], i) => (
            <rect key={i} x={x} y={y} width={w} height={h} opacity={0.65 + ((i % 4) * 0.08)} />
          ))}
        </g>
      </svg>

      {/* BRIDGE WATER LAYER */}
      <svg className="layer-bridge par" data-par="0.32" viewBox="0 0 1600 360" preserveAspectRatio="xMidYEnd slice">
        <defs>
          <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3A3D5C" /><stop offset="100%" stopColor="#1E2440" />
          </linearGradient>
        </defs>
        <rect x="-1600" y="160" width="4800" height="200" fill="url(#water)" />
        <g stroke="#F5A623" strokeWidth="1" opacity="0.18">
          <line x1="-1600" y1="210" x2="3200" y2="210" /><line x1="-1600" y1="240" x2="3200" y2="240" />
          <line x1="-1600" y1="280" x2="3200" y2="280" /><line x1="-1600" y1="320" x2="3200" y2="320" />
        </g>
        <g stroke="#FFD58A" strokeWidth="2" opacity="0.30" strokeDasharray="20 30">
          <line x1="-1600" y1="220" x2="3200" y2="220" />
        </g>
      </svg>

      {/* FOREGROUND BRIDGE */}
      <svg className="layer-fg par" data-par="0.5" viewBox="0 0 1600 280" preserveAspectRatio="xMidYEnd slice">
        <defs>
          <linearGradient id="teal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1F9CA1" /><stop offset="100%" stopColor="#0F5F63" />
          </linearGradient>
          <radialGradient id="bulbGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFE7A0" stopOpacity="1" />
            <stop offset="30%" stopColor="#FFC560" stopOpacity="0.85" />
            <stop offset="70%" stopColor="#F5A623" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#F5A623" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="castGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFD58A" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#F5A623" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect x="-1600" y="220" width="4800" height="60" fill="#2A2330" />
        <rect x="-1600" y="218" width="4800" height="4" fill="#E6D2B5" />
        <g fill="#F7EDE2" opacity="0.6">
          {Array.from({ length: 18 }).map((_, i) => (
            <rect key={i} x={20 + i * 92} y={250} width={56} height={4} rx={1} />
          ))}
        </g>
        <rect x="-1600" y="138" width="4800" height="14" fill="url(#teal)" />
        <rect x="-1600" y="152" width="4800" height="42" fill="#F2E0C4" />
        <rect x="-1600" y="194" width="4800" height="10" fill="url(#teal)" />
        <rect x="-1600" y="204" width="4800" height="6" fill="#0F5F63" />
        <rect x="-1600" y="210" width="4800" height="10" fill="#D7BC9A" />
        <g fill="#F2E0C4" stroke="#B89B7A" strokeWidth="0.6">
          {Array.from({ length: 64 }).map((_, i) => {
            const x = 12 + i * 25;
            return (
              <g key={i}>
                <ellipse cx={x} cy={170} rx={6} ry={10} />
                <ellipse cx={x} cy={184} rx={5} ry={4} />
                <rect x={x - 3} y={188} width={6} height={6} />
              </g>
            );
          })}
        </g>
        {[140, 460, 800, 1140, 1460].map((cx, idx) => {
          const headOffset = 28;
          return (
            <g key={idx} className="lamp-light" data-lamp-index={idx}>
              <ellipse className="lamp-cast" cx={cx} cy={235} rx={120} ry={32} fill="url(#castGrad)" />
              <rect x={cx - 12} y={130} width={24} height={10} fill="#1A1820" />
              <rect x={cx - 4} y={20} width={8} height={120} fill="#1A1820" />
              <rect x={cx - 9} y={50} width={18} height={5} fill="#1A1820" />
              <rect x={cx - headOffset - 4} y={18} width={(headOffset + 4) * 2} height={5} fill="#1A1820" />
              <path d={`M ${cx - headOffset} 20 Q ${cx - headOffset} 8 ${cx - headOffset - 4} 8`} stroke="#1A1820" strokeWidth="3" fill="none" />
              <path d={`M ${cx + headOffset} 20 Q ${cx + headOffset} 8 ${cx + headOffset + 4} 8`} stroke="#1A1820" strokeWidth="3" fill="none" />
              {[-headOffset, headOffset].map((dx, k) => (
                <g key={k}>
                  <circle className="lamp-glow" cx={cx + dx} cy={6} r={48} fill="url(#bulbGlow)" />
                  <polygon points={`${cx + dx - 8},10 ${cx + dx + 8},10 ${cx + dx + 6},22 ${cx + dx - 6},22`} fill="#1A1820" />
                  <polygon points={`${cx + dx - 9},10 ${cx + dx + 9},10 ${cx + dx},2`} fill="#1A1820" />
                  <circle cx={cx + dx} cy={1} r={1.5} fill="#1A1820" />
                  <ellipse className="lamp-bulb" cx={cx + dx} cy={16} rx={5} ry={6} fill="#FFE7A0" />
                </g>
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ─────────────────────────── EMBERS */
function Embers() {
  const list = useMemo(() => Array.from({ length: 24 }).map((_, i) => ({
    left: (Math.random() * 100).toFixed(1) + '%',
    duration: (12 + Math.random() * 18).toFixed(1) + 's',
    delay: (Math.random() * 18).toFixed(1) + 's',
    dx: (Math.random() * 100 - 50).toFixed(0) + 'px',
    size: 2 + Math.random() * 2,
  })), []);
  return (
    <div className="embers" aria-hidden="true">
      {list.map((e, i) => (
        <span key={i} className="ember" style={{
          left: e.left,
          animationDuration: e.duration,
          animationDelay: e.delay,
          width: e.size + 'px',
          height: e.size + 'px',
          ['--dx']: e.dx,
        }} />
      ))}
    </div>
  );
}

/* ─────────────────────────── HERO */
function Hero() {
  useEffect(() => {
    const hero = document.querySelector('.hero');
    const timers = [];

    const reveal = (selector, from, to, opts) => {
      const els = document.querySelectorAll(selector);
      els.forEach((el) => {
        Object.assign(el.style, to);
        try {
          const anim = el.animate([from, to], {
            duration: opts.duration || 900,
            delay: opts.delay || 0,
            fill: 'forwards',
            easing: opts.easing || 'ease-out',
          });
          if (anim.startTime === null && document.timeline.currentTime !== null) {
            anim.startTime = document.timeline.currentTime;
          }
        } catch (e) { }
      });
    };

    reveal('.hero-eyebrow',
      { opacity: 0, transform: 'translateY(10px)' },
      { opacity: 1, transform: 'translateY(0)' },
      { duration: 900, delay: 200 });
    reveal('.hero-title',
      { opacity: 0, transform: 'translateY(20px) scale(0.97)', filter: 'blur(8px)' },
      { opacity: 1, transform: 'translateY(0) scale(1)', filter: 'blur(0)' },
      { duration: 1200, delay: 400 });
    reveal('.hero-sub',
      { opacity: 0, transform: 'translateY(10px)' },
      { opacity: 1, transform: 'translateY(0)' },
      { duration: 900, delay: 700 });
    reveal('.hero-stats',
      { opacity: 0, transform: 'translate(-50%, 10px)' },
      { opacity: 1, transform: 'translate(-50%, 0)' },
      { duration: 900, delay: 1000 });
    reveal('.scroll-cue',
      { opacity: 0, transform: 'translate(-50%, 10px)' },
      { opacity: 1, transform: 'translate(-50%, 0)' },
      { duration: 900, delay: 1200 });

    if (hero) hero.classList.add('entered');

    const lamps = document.querySelectorAll('.lamp-light');
    lamps.forEach((l, i) => {
      timers.push(setTimeout(() => {
        l.classList.add('lit');
        const bulbs = l.querySelectorAll('.lamp-bulb');
        const glows = l.querySelectorAll('.lamp-glow');
        const casts = l.querySelectorAll('.lamp-cast');
        const kick = (els, target, duration) => {
          els.forEach((el) => {
            el.style.opacity = String(target);
            try {
              const a = el.animate(
                [{ opacity: 0 }, { opacity: target }],
                { duration, fill: 'forwards', easing: 'ease-out' }
              );
              if (a.startTime === null && document.timeline.currentTime !== null) {
                a.startTime = document.timeline.currentTime;
              }
            } catch (e) { }
          });
        };
        kick(bulbs, 1, 1200);
        kick(glows, 0.95, 1400);
        kick(casts, 0.7, 1600);
      }, 1300 + i * 450));
    });

    const pulseTimer = setTimeout(() => {
      const glows = document.querySelectorAll('.lamp-glow');
      glows.forEach((g, i) => {
        try {
          const anim = g.animate(
            [
              { transform: 'scale(1)', opacity: 0.85 },
              { transform: 'scale(1.08)', opacity: 1 },
              { transform: 'scale(1)', opacity: 0.85 },
            ],
            {
              duration: 4000 + (i % 3) * 400,
              iterations: Infinity,
              easing: 'ease-in-out',
              delay: i * 150,
            }
          );
          if (anim.startTime === null && document.timeline.currentTime !== null) {
            anim.startTime = document.timeline.currentTime;
          }
        } catch (e) { }
      });
    }, 3500);
    timers.push(pulseTimer);

    const els = document.querySelectorAll('.par');
    const onScroll = () => {
      const y = window.scrollY;
      const h = window.innerHeight;
      if (y > h) return;
      els.forEach(el => {
        const r = parseFloat(el.dataset.par || '0.1');
        el.style.transform = `translate3d(-50%, ${y * r}px, 0)`;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <header className="hero">
      <HeroScene />
      <Embers />

      <nav className="hero-nav">
        <div className="hero-nav-brand">
          <span className="bulb" aria-hidden="true" />
          ReciLuz
        </div>
        <div className="hero-nav-links">
          <a href="#sobre">Sobre</a>
          <a href="#arquitetura">Arquitetura</a>
          <a href="#dashboard">Dashboard</a>
        </div>
      </nav>

      <div className="hero-content">
        <div className="hero-eyebrow">
          <span className="dot" /> Prefeitura do Recife · Piloto
        </div>
        <h1 className="hero-title">ReciLuz</h1>
        <p className="hero-sub">
          Gestão <strong>Inteligente</strong> de Iluminação Pública —
          sensores, telemetria e controle remoto para iluminar o Recife com menos energia e mais segurança.
        </p>
      </div>

      <div className="hero-stats">
        <div className="hs-item">
          <div className="hs-num">−68%</div>
          <div className="hs-label">Energia média</div>
        </div>
        <div className="hs-div" />
        <div className="hs-item">
          <div className="hs-num">2 s</div>
          <div className="hs-label">Latência MQTT</div>
        </div>
        <div className="hs-div" />
        <div className="hs-item">
          <div className="hs-num">24/7</div>
          <div className="hs-label">Telemetria</div>
        </div>
      </div>

      <a className="scroll-cue" href="#sobre" aria-label="Rolar para baixo">
        <span>Explorar</span>
        <span className="arrow">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </a>
    </header>
  );
}

/* ─────────────────────────── ABOUT */
const FEATURES = [
  {
    accent: '#1B8A8F', accentSoft: 'rgba(27,138,143,0.10)',
    tag: 'Sensor', title: 'Presença adaptativa',
    text: 'Sensor ultrassônico detecta proximidade de pedestres e veículos e ajusta o brilho da LED em tempo real, evitando iluminar ruas vazias.',
    icon: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" /></svg>)
  },
  {
    accent: '#F5A623', accentSoft: 'rgba(245,166,35,0.14)',
    tag: 'Eficiência', title: 'Economia mensurável',
    text: 'Sensor de corrente ACS712 mede o consumo real e compara com uma referência fixa de 60 W. A economia aparece em tempo real no painel.',
    icon: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>)
  },
  {
    accent: '#2C3E6B', accentSoft: 'rgba(44,62,107,0.10)',
    tag: 'Conectividade', title: 'ESP32 + MQTT',
    text: 'Cada poste publica leituras a cada 2 segundos via MQTT. Comandos remotos chegam ao firmware com latência sub-segundo.',
    icon: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.55a11 11 0 0 1 14 0" /><path d="M2 8.82a15 15 0 0 1 20 0" /><path d="M8.5 16.43a6 6 0 0 1 7 0" /><line x1="12" y1="20" x2="12.01" y2="20" /></svg>)
  },
];

function About() {
  return (
    <section id="sobre" className="about">
      <div className="about-inner">
        <div className="reveal">
          <div className="about-eyebrow">O Projeto Reciluz</div>
          <h2 className="about-title">
            Iluminar o <em>Recife</em> gastando menos —<br />
            controle inteligente, transparência total.
          </h2>
          <p className="about-lead">
            Reciluz é uma plataforma de iluminação pública que conecta postes equipados com sensores
            a um painel de gestão único. Cada lâmpada decide sozinha quando acender, com que intensidade
            e por quanto tempo — guiada pela presença real de pessoas e veículos. O resultado é uma cidade
            mais segura, contas de energia mais baixas e dados em tempo real para a equipe de manutenção.
          </p>
        </div>

        <div className="features">
          {FEATURES.map((f, i) => (
            <article key={i} className="feature reveal" style={{
              ['--accent']: f.accent,
              ['--accent-soft']: f.accentSoft,
              transitionDelay: `${i * 0.1}s`,
            }}>
              <div className="feature-icon">{f.icon}</div>
              <div className="feature-tag">{f.tag}</div>
              <h3 className="feature-title">{f.title}</h3>
              <p className="feature-text">{f.text}</p>
            </article>
          ))}
        </div>

        <div id="arquitetura" className="stack reveal">
          <div>
            <h3 className="stack-h">
              Do poste à <em>nuvem</em> — em 2 segundos.
            </h3>
            <p className="stack-p">
              Hardware open-source, protocolo padronizado e front-end web acessível em qualquer
              navegador. A arquitetura modular permite escalar do piloto para milhares de pontos.
            </p>
          </div>
          <div className="flow">
            <div className="flow-node">
              <div className="fn-ic">🔌</div>
              <div className="fn-lab">Sensor</div>
              <div className="fn-name">ESP32</div>
            </div>
            <div className="flow-arrow">→</div>
            <div className="flow-node">
              <div className="fn-ic">📡</div>
              <div className="fn-lab">Broker</div>
              <div className="fn-name">MQTT</div>
            </div>
            <div className="flow-arrow">→</div>
            <div className="flow-node">
              <div className="fn-ic">🗄️</div>
              <div className="fn-lab">API</div>
              <div className="fn-name">FastAPI</div>
            </div>
            <div className="flow-arrow">→</div>
            <div className="flow-node">
              <div className="fn-ic">📊</div>
              <div className="fn-lab">Painel</div>
              <div className="fn-name">Reciluz</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── DASHBOARD COMPONENTS */

function IntensityGauge({ percent }) {
  const pct = Math.max(0, Math.min(100, percent || 0));
  const arcLen = Math.PI * 64;
  const filled = (pct / 100) * arcLen;
  const color = pct > 70 ? '#F5A623' : pct > 30 ? '#1B8A8F' : '#2C3E6B';
  return (
    <div className="gauge-wrap">
      <svg viewBox="0 0 160 90" className="gauge-svg" aria-hidden="true">
        <path d="M 16 80 A 64 64 0 0 1 144 80" fill="none" stroke="rgba(26,37,64,0.08)" strokeWidth="12" strokeLinecap="round" />
        <path d="M 16 80 A 64 64 0 0 1 144 80" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={`${filled} ${arcLen}`}
          style={{ transition: 'stroke-dasharray .4s ease, stroke .3s ease' }} />
      </svg>
      <div className="gauge-center">
        <span className="gauge-num" style={{ color }}>{pct}</span>
        <span className="gauge-pct">%</span>
      </div>
      <div className="gauge-cap">Intensidade</div>
    </div>
  );
}

function Metric({ icon, value, unit, label, sub, alert, iconColor = '#1B8A8F', iconBg = 'rgba(27,138,143,0.10)' }) {
  return (
    <article className={`metric${alert ? ' alert' : ''}`}>
      <div className="m-ic" style={{ ['--ic']: iconColor, ['--ic-bg']: iconBg }}>{icon}</div>
      <div className="m-body">
        <div className="m-value">
          <span className="m-num">{value}</span>
          {unit && <span className="m-unit">{unit}</span>}
        </div>
        <div className="m-lab">{label}</div>
        {sub && <div className="m-sub">{sub}</div>}
      </div>
    </article>
  );
}

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
            label: 'Intensidade (%)', data: [], borderColor: '#F5A623',
            backgroundColor: 'rgba(245,166,35,0.12)', tension: 0.4, fill: true,
            pointRadius: 2, borderWidth: 2, yAxisID: 'y'
          },
          {
            label: 'Corrente ×10 (A)', data: [], borderColor: '#1B8A8F',
            backgroundColor: 'transparent', tension: 0.4, fill: false,
            pointRadius: 2, borderWidth: 2, yAxisID: 'y'
          },
          {
            label: 'Distância (cm)', data: [], borderColor: '#2C3E6B',
            backgroundColor: 'transparent', tension: 0.4, fill: false,
            pointRadius: 2, borderWidth: 1.5, borderDash: [4, 3], yAxisID: 'y2'
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 300 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: { boxWidth: 8, font: { size: 11, family: 'Manrope' }, padding: 14, usePointStyle: true, color: '#6B7791' }
          },
          tooltip: {
            backgroundColor: '#1A2540',
            titleFont: { family: 'Space Grotesk', size: 12 },
            bodyFont: { family: 'Manrope', size: 11 },
            cornerRadius: 8, padding: 10, displayColors: true,
          }
        },
        scales: {
          x: { grid: { color: 'rgba(26,37,64,0.04)' }, ticks: { font: { size: 10 }, maxTicksLimit: 7, color: '#9AA4BC' } },
          y: { position: 'left', min: 0, max: 100, grid: { color: 'rgba(26,37,64,0.04)' }, ticks: { font: { size: 10 }, color: '#9AA4BC', stepSize: 25 } },
          y2: { position: 'right', min: 0, max: 100, grid: { drawOnChartArea: false }, ticks: { font: { size: 10 }, color: '#2C3E6B', stepSize: 25 } },
        }
      }
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
  return <div className="chart-box"><canvas ref={canvasRef} /></div>;
}

function EventLog({ readings, cmdLogs }) {
  if (!readings.length && !cmdLogs.length) return <div className="log-empty">Aguardando eventos...</div>;
  return (
    <div className="log-list">
      {cmdLogs.map((l, i) => (
        <div key={`c-${i}`} className="log-row cmd">
          <span className="log-msg">{l}</span>
        </div>
      ))}
      {readings.slice(0, 12).map(r => (
        <div key={r.id} className={`log-row ${r.presenca_detectada ? 'presence' : ''}`}>
          <span className="log-time">{fmtTime(r.criada_em)}</span>
          <span className="log-mode">{r.modo || r.status_lampada || '--'}</span>
          <span className="log-detail">{fmtNum(r.distancia_cm, 0)} cm · PWM {fmt(r.intensidade_pwm)} · {fmtNum(r.corrente, 3)} A · {fmtNum(r.nivel_ruido_db, 1)} dB</span>
          {r.presenca_detectada && <span className="log-tag">Presença</span>}
          {r.som_detectado && <span className="log-tag">Ruído</span>}
        </div>
      ))}
    </div>
  );
}

function SavingsRing({ pct }) {
  const circ = 2 * Math.PI * 52;
  const filled = (Math.max(0, Math.min(100, pct || 0)) / 100) * circ;
  const color = pct >= 50 ? '#0E8A4F' : pct >= 20 ? '#F5A623' : '#DC2626';
  return (
    <div className="ring-wrap">
      <svg viewBox="0 0 120 120" className="ring-svg" aria-hidden="true">
        <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(26,37,64,0.07)" strokeWidth="10" />
        <circle cx="60" cy="60" r="52" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${filled} ${circ}`} transform="rotate(-90 60 60)"
          style={{ transition: 'stroke-dasharray .6s ease, stroke .3s ease' }} />
      </svg>
      <div className="ring-center">
        <span className="ring-num" style={{ color }}>{pct !== null ? Math.round(pct) : '--'}</span>
        <span className="ring-unit">%</span>
      </div>
    </div>
  );
}

/* ─────────────────────────── HEALTH CARD */
function HealthCard({ icon, iconColor, iconBg, value, unit, label, pct, barColor, stats, alert }) {
  return (
    <div className={`health-card${alert ? ' health-alert' : ''}`}>
      <div className="hc-header">
        <div className="hc-icon" style={{ background: iconBg, color: iconColor }}>{icon}</div>
        <div>
          <span className="hc-label">{label}</span>
          {alert && <span className="hc-badge-alert">Alerta</span>}
        </div>
      </div>
      <div className="hc-value-row">
        <span className="hc-value">{value}</span>
        <span className="hc-unit">{unit}</span>
      </div>
      {pct !== null && pct !== undefined && (
        <div className="hc-bar-track">
          <div className="hc-bar-fill" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: barColor }} />
        </div>
      )}
      {stats && stats.length > 0 && (
        <div className="hc-stats">
          {stats.map((s, i) => (
            <div key={i} className="hc-stat">
              <strong>{s.value}</strong>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── LEGEND DRAWER */
function LegendDrawer() {
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  const Group = ({ icon, title, children }) => (
    <div className="lg-group">
      <div className="lg-group-header">
        <span className="lg-group-icon">{icon}</span>
        <span className="lg-group-title">{title}</span>
      </div>
      {children}
    </div>
  );

  const Row = ({ term, def }) => (
    <div className="lg-row">
      <span className="lg-term">{term}</span>
      <span className="lg-def">{def}</span>
    </div>
  );

  return (
    <>
      <button className="legend-fab" onClick={() => setOpen(true)} aria-label="Abrir guia de leitura">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <span>Guia</span>
      </button>

      {open && (
        <div className="legend-overlay" onClick={close} role="dialog" aria-modal="true" aria-label="Guia de leitura">
          <aside className="legend-drawer" onClick={e => e.stopPropagation()}>

            {/* ── Header */}
            <div className="lg-header">
              <div className="lg-header-left">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color:'var(--teal)'}}>
                  <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <h2 className="lg-title">Guia de Leitura</h2>
              </div>
              <button className="lg-close" onClick={close} aria-label="Fechar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="lg-body">

              {/* ── Grupo 1: Modos */}
              <Group title="Modos de Operação" icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
              }>
                <Row term="Automático" def="O ESP32 ajusta o brilho pela distância do HC-SR04. Quanto mais próximo, maior a intensidade." />
                <Row term="Controle manual" def="Ativo quando o modo automático está desativado. Permite ligar, desligar e ajustar o brilho pelo dashboard." />
              </Group>

              {/* ── Grupo 2: Métricas */}
              <Group title="Métricas de Iluminação" icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
              }>
                <Row term="Intensidade (%)" def="PWM ÷ 255 × 100. Potência luminosa relativa do LED." />
                <Row term="Distância (cm)" def="Lida pelo HC-SR04. Valores baixos indicam presença próxima." />
                <Row term="Corrente (A)" def="Medida pelo ACS712. Reflete o consumo elétrico real do LED." />
                <Row term="Potência (W)" def="12 V × corrente lida pelo ACS712." />
                <Row term="Consumo acum. (Wh)" def="Potência × tempo acumulado desde o início da sessão." />
                <Row term="Economia (%)" def="Comparação com uma lâmpada de 60 W ligada continuamente no mesmo período." />
              </Group>

              {/* ── Grupo 3: Saúde ambiental */}
              <Group title="Saúde Ambiental" icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 0v10l6.5 3.5"/>
                </svg>
              }>
                <Row term="Temperatura (°C)" def="DHT22. O card exibe média, mínimo e máximo da sessão atual." />
                <Row
                  term="Umidade (%)"
                  def={
                    <span>DHT22. Classificada por faixa:
                      <span className="lg-chip" style={{'--c':'#3b82f6','--cb':'rgba(59,130,246,0.12)'}}>Seco</span>
                      <span className="lg-chip" style={{'--c':'#22c55e','--cb':'rgba(34,197,94,0.12)'}}>Confortável</span>
                      <span className="lg-chip" style={{'--c':'#6366f1','--cb':'rgba(99,102,241,0.12)'}}>Úmido</span>
                    </span>
                  }
                />
                <Row term="Ruído (dB)" def="Microfone analógico. Evento registrado ao ultrapassar o limiar configurado no firmware (55 dB)." />
              </Group>

              {/* ── Grupo 4: Badges */}
              <Group title="Badges e Status" icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              }>
                <div className="lg-badges-grid">
                  <div className="lg-badge-item">
                    <span className="s-badge s-on"><span className="d"/>ESP32</span>
                    <span className="lg-badge-desc">Microcontrolador conectado e enviando dados.</span>
                  </div>
                  <div className="lg-badge-item">
                    <span className="s-badge s-on"><span className="d"/>MQTT</span>
                    <span className="lg-badge-desc">Broker ativo, mensagens chegando em tempo real.</span>
                  </div>
                  <div className="lg-badge-item">
                    <span className="s-badge" style={{background:'rgba(34,197,94,0.12)',color:'#16a34a'}}><span className="d" style={{background:'#16a34a'}}/>Presença</span>
                    <span className="lg-badge-desc">Objeto ou pessoa detectado pelo HC-SR04.</span>
                  </div>
                  <div className="lg-badge-item">
                    <span className="s-badge" style={{background:'rgba(245,166,35,0.14)',color:'#b45309'}}><span className="d" style={{background:'#f59e0b'}}/>Ligada</span>
                    <span className="lg-badge-desc">LED com PWM {'>'} 0, emitindo luz.</span>
                  </div>
                  <div className="lg-badge-item">
                    <span className="log-tag" style={{background:'rgba(44,62,107,0.10)',color:'#2C3E6B'}}>MODO PRESENÇA</span>
                    <span className="lg-badge-desc">Evento no log: modo automático detectou presença e ajustou o brilho.</span>
                  </div>
                  <div className="lg-badge-item">
                    <span className="log-tag" style={{background:'rgba(245,166,35,0.13)',color:'#92400e'}}>CMD REMOTO</span>
                    <span className="lg-badge-desc">Evento no log: comando manual recebido pelo dashboard.</span>
                  </div>
                </div>
              </Group>

              {/* ── Grupo 5: Gráfico */}
              <Group title="Gráfico de Tempo Real" icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
              }>
                <div className="lg-chart-legend">
                  <div className="lg-chart-row">
                    <span className="lg-chart-dot" style={{background:'#F5A623'}}/>
                    <div>
                      <strong>Intensidade (%)</strong>
                      <span>Eixo esquerdo · valor direto em %.</span>
                    </div>
                  </div>
                  <div className="lg-chart-row">
                    <span className="lg-chart-dot" style={{background:'#1B8A8F'}}/>
                    <div>
                      <strong>Corrente ×10 (A)</strong>
                      <span>Eixo esquerdo · multiplicada por 10 apenas para visualização na mesma escala.</span>
                    </div>
                  </div>
                  <div className="lg-chart-row">
                    <span className="lg-chart-dot" style={{background:'#9AA4BC'}}/>
                    <div>
                      <strong>Distância (cm)</strong>
                      <span>Eixo direito · escala independente.</span>
                    </div>
                  </div>
                </div>

                <div className="lg-tip">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  O gráfico mantém as últimas 30 leituras (≈ 60 s). Passe o mouse sobre os pontos para ver os valores exatos.
                </div>
              </Group>

            </div>{/* end lg-body */}
          </aside>
        </div>
      )}
    </>
  );
}

/* ─────────────────────────── DASHBOARD (real API) */
function NewsletterSection() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const assinar = async () => {
    if (!email) return;
    setLoading(true);
    try {
      await api('/relatorio/assinar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setStatus('ok');
    } catch {
      setStatus('erro');
    } finally {
      setLoading(false);
    }
  };

  const cancelar = async () => {
    setLoading(true);
    try {
      await api('/relatorio/cancelar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setStatus('cancel');
    } catch {
      setStatus('erro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="newsletter-section reveal">
      <div className="newsletter-card">
        <h3 className="newsletter-title">Relatório Diário por E-mail</h3>
        <p className="newsletter-desc">
          Receba todo dia às 08h um resumo com temperatura, umidade, consumo e muito mais.
        </p>
        {status === 'ok'     && <p className="newsletter-ok">Inscrição confirmada! Você receberá relatórios diários.</p>}
        {status === 'cancel' && <p className="newsletter-ok">Inscrição cancelada com sucesso.</p>}
        {status === 'erro'   && <p className="newsletter-err">Erro ao processar. Verifique o e-mail e tente novamente.</p>}
        {!status && (
          <div className="newsletter-form">
            <input
              className="newsletter-input"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && assinar()}
            />
            <button
              className="btn-big btn-teal-on"
              onClick={assinar}
              disabled={loading || !email}
            >
              {loading ? '...' : 'Assinar'}
            </button>
          </div>
        )}
        {status === 'ok' && (
          <button className="newsletter-cancel-link" onClick={cancelar} disabled={loading}>
            {loading ? '...' : 'Cancelar inscrição'}
          </button>
        )}
        {status === 'erro' && (
          <button className="newsletter-cancel-link" onClick={() => setStatus(null)}>
            Tentar novamente
          </button>
        )}
      </div>
    </section>
  );
}

function Dashboard() {
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
  // modo_remoto=true no firmware = controle remoto/manual ativo → isAuto=false
  const isAuto = !latest.modo_remoto;
  const highCurrent = current > HIGH_CURRENT_THRESHOLD;

  const onReadings = readings.filter(r => Number(r.intensidade_pwm || 0) > 0);
  const onSeconds = onReadings.length * (REFRESH_MS / 1000);
  const onHours = onSeconds / 3600;
  const totalKwh = readings.reduce((s, r) => s + Number(r.consumo_estimado || 0), 0);
  const refKwh = (60 / 1000) * onHours;
  const savingsKwh = Math.max(0, refKwh - totalKwh);
  const savingsPct = refKwh > 0 ? Math.min(100, Math.max(0, (savingsKwh / refKwh) * 100)) : null;
  const avgPower = readings.length ? readings.reduce((s, r) => s + Number(r.potencia || 0), 0) / readings.length : null;
  const peakPower = readings.length ? Math.max(...readings.map(r => Number(r.potencia || 0))) : null;
  const avgPwmPct = onReadings.length ? Math.round(onReadings.reduce((s, r) => s + Number(r.intensidade_pwm || 0), 0) / onReadings.length / 255 * 100) : null;
  const presenceCount = readings.filter(r => r.presenca_detectada).length;
  const soundCount = readings.filter(r => r.som_detectado).length;

  // health metrics
  const temperatura = latest.temperatura !== undefined ? Number(latest.temperatura) : null;
  const umidade = latest.umidade !== undefined ? Number(latest.umidade) : null;
  const noiseDb = Number(latest.nivel_ruido_db || 0);
  const noiseAlert = !!latest.som_detectado;
  const validTemps = readings.map(r => Number(r.temperatura)).filter(v => !isNaN(v) && v > 0);
  const avgTemp = validTemps.length ? validTemps.reduce((s, v) => s + v, 0) / validTemps.length : null;
  const minTemp = validTemps.length ? Math.min(...validTemps) : null;
  const maxTemp = validTemps.length ? Math.max(...validTemps) : null;
  const validHumidity = readings.map(r => Number(r.umidade)).filter(v => !isNaN(v) && v > 0);
  const avgHumidity = validHumidity.length ? validHumidity.reduce((s, v) => s + v, 0) / validHumidity.length : null;
  const validNoise = readings.map(r => Number(r.nivel_ruido_db)).filter(v => !isNaN(v) && v > 0);
  const avgNoiseDb = validNoise.length ? validNoise.reduce((s, v) => s + v, 0) / validNoise.length : null;
  const maxNoiseDb = validNoise.length ? Math.max(...validNoise) : null;

  const log = useCallback((msg) => {
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
      if (r0 && r0.criada_em) {
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

  const toggleLamp = () => sendCmd(
    isOn ? '/lampada/desligar' : '/lampada/ligar',
    isOn ? 'Lâmpada desligada (manual)' : 'Lâmpada ligada (manual)'
  );
  const toggleAuto = () => sendCmd(
    isAuto ? '/lampada/desligar' : '/lampada/automatico',
    isAuto ? 'Modo automático desativado' : 'Modo automático ativado'
  );

  return (
    <>
      <div className="divider">
        <div className="divider-inner">
          <h2 id="dashboard" className="divider-h">
            Painel de <span className="ac">controle ao vivo</span> — telemetria do poste piloto.
          </h2>
          <div className="divider-meta">
            <span className="live-dot"><span className="d" /> Ao vivo</span>
            <span>Atualização a cada 2 s</span>
          </div>
        </div>
      </div>

      <section className="dash-section">
        <div className="dash">

          {/* header */}
          <header className="d-header">
            <div className="d-brand">
              <div className="d-bulb" aria-hidden="true" />
              <div>
                <div className="d-name">ReciLuz</div>
                <div className="d-tag">Iluminação Inteligente · ESP32 + MQTT</div>
              </div>
            </div>
            <div className="d-status">
              <span className={`s-badge ${esp32Online ? 's-on' : 's-off'}`}><span className="d" /> ESP32</span>
              <span className={`s-badge ${mqttFresh ? 's-on' : 's-off'}`}><span className="d" /> MQTT</span>
              <span className="s-time">{fmtTime(latest.criada_em)}</span>
            </div>
          </header>

          {/* controls */}
          <section className="ctrls">
            <div className="ctrl">
              <div className="ctrl-lab">Modo atual</div>
              <div className={`ctrl-pill ${isAuto ? 'pill-auto' : 'pill-manual'}`}>
                {isAuto ? <>◉ Automático</> : <>◎ Manual</>}
              </div>
              <p className="ctrl-desc">
                {isAuto
                  ? 'Brilho controlado pela distância do sensor.'
                  : (isOn ? 'Lâmpada ligada por comando manual.' : 'Lâmpada apagada por comando manual.')}
              </p>
              <div className={`lamp-status ${isOn ? 'on' : 'off'}`} title={isOn ? 'Ligada' : 'Desligada'} />
            </div>

            <div className={`ctrl ctrl-center${isAuto ? ' dim' : ''}`}>
              <div className="ctrl-lab">Controle manual</div>
              <button className={`btn-big ${(isOn && !isAuto) ? 'btn-amber-on' : 'btn-amber-off'}`}
                onClick={toggleLamp} disabled={busy || isAuto}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M12 2v6M18.36 5.64A9 9 0 1 1 5.64 5.64" />
                </svg>
                {isOn && !isAuto ? 'LIGADA' : 'DESLIGADA'}
              </button>
              {isAuto && <p className="hint">Desative o modo automático primeiro</p>}
            </div>

            <div className="ctrl ctrl-center">
              <div className="ctrl-lab">Modo automático</div>
              <button className={`btn-big ${isAuto ? 'btn-teal-on' : 'btn-teal-off'}`}
                onClick={toggleAuto} disabled={busy}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
                </svg>
                {isAuto ? 'ATIVO' : 'INATIVO'}
              </button>
              <p className="hint">
                {isAuto ? 'Quanto mais próximo, maior o brilho' : 'Toque para ativar o sensor'}
              </p>
            </div>
          </section>

          {/* gauge + metrics */}
          <section className="gauge-row">
            <div className="gauge-card">
              <IntensityGauge percent={pwmPct} />
              <div className="gauge-meta">
                <div className="gm-i">
                  <span className="gm-lab">PWM</span>
                  <span className="gm-val">{fmt(latest.intensidade_pwm, '--')}/255</span>
                </div>
                <div className="gm-div" />
                <div className="gm-i">
                  <span className="gm-lab">Status</span>
                  <span className={`gm-val ${isOn ? 'on' : 'off'}`}>{isOn ? 'Ligada' : 'Desligada'}</span>
                </div>
              </div>
            </div>

            <div className="metrics-grid">
              <Metric
                iconColor="#2C3E6B" iconBg="rgba(44,62,107,0.10)"
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>}
                value={fmtNum(distance, 0)} unit="cm"
                label="Distância"
                sub={latest.presenca_detectada ? '● Presença detectada' : '○ Sem presença'}
              />
              <Metric
                alert={highCurrent}
                iconColor={highCurrent ? '#DC2626' : '#F5A623'} iconBg={highCurrent ? 'rgba(220,38,38,0.12)' : 'rgba(245,166,35,0.14)'}
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>}
                value={fmtNum(current, 3)} unit="A"
                label="Corrente"
                sub="Sensor ACS712"
              />
              <Metric
                iconColor="#1B8A8F" iconBg="rgba(27,138,143,0.10)"
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /><line x1="12" y1="12" x2="12" y2="16" /><line x1="10" y1="14" x2="14" y2="14" /></svg>}
                value={fmtNum(power, 2)} unit="W"
                label="Potência"
                sub={`${VOLTAGE}V × ${fmtNum(current, 3)}A`}
              />
              <Metric
                iconColor="#6E5BBE" iconBg="rgba(110,91,190,0.10)"
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 10v4" /><path d="M6 7v10" /><path d="M10 4v16" /><path d="M14 8v8" /><path d="M18 6v12" /><path d="M22 10v4" /></svg>}
                value={fmtNum(latest.nivel_ruido_db, 1)} unit="dB"
                label="Ruído"
                sub={latest.som_detectado ? 'Acima do limite' : 'Ambiente estável'}
              />
              <Metric
                iconColor="#0E8A4F" iconBg="rgba(14,138,79,0.10)"
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>}
                value={fmtEnergy(totalKwh)} unit=""
                label="Consumo Acum."
                sub="Energia total acumulada"
              />
              <Metric
                iconColor="#0E8A4F" iconBg="rgba(14,138,79,0.10)"
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" /><path d="M7 13s.5 3 5 3 5-3 5-3" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></svg>}
                value={savingsPct !== null ? `${Math.round(savingsPct)}%` : '--'} unit=""
                label="Economia"
                sub="vs lâmpada 60 W"
              />
            </div>
          </section>

          {/* chart + log */}
          <section className="chart-row">
            <div className="panel">
              <div className="p-head">
                <h3 className="p-title">Monitoramento em Tempo Real</h3>
                <span className="p-badge">{readings.length} amostras</span>
              </div>
              <RealtimeChart readings={readings} />
            </div>
            <div className="panel">
              <div className="p-head">
                <h3 className="p-title">Log de Eventos</h3>
              </div>
              <EventLog readings={readings} cmdLogs={cmdLogs} />
            </div>
          </section>

          {/* analytics */}
          <section className="analytics">
            <div className="panel">
              <div className="p-head">
                <h3 className="p-title">Economia Estimada</h3>
                <span className="p-badge">ref. 60 W contínua</span>
              </div>
              <div className="an-body">
                <SavingsRing pct={savingsPct} />
                <div className="an-stats">
                  <div className="an-row">
                    <span className="an-lab">Consumo real</span>
                    <span className="an-val">{fmtEnergy(totalKwh)}</span>
                  </div>
                  <div className="an-row">
                    <span className="an-lab">Referência (60 W)</span>
                    <span className="an-val">{fmtEnergy(refKwh)}</span>
                  </div>
                  <div className="an-row an-highlight">
                    <span className="an-lab">Energia economizada</span>
                    <span className="an-val">{fmtEnergy(savingsKwh)}</span>
                  </div>
                  <div className="cmp-bars">
                    <div className="cmp-row">
                      <span className="cmp-lab">Referência</span>
                      <div className="cmp-track">
                        <div className="cmp-fill cmp-ref" style={{ width: '100%' }} />
                      </div>
                    </div>
                    <div className="cmp-row">
                      <span className="cmp-lab">Real</span>
                      <div className="cmp-track">
                        <div className="cmp-fill cmp-real" style={{ width: `${refKwh > 0 ? Math.min(100, (totalKwh / refKwh) * 100) : 0}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="p-head">
                <h3 className="p-title">Consumo &amp; Eficiência</h3>
              </div>
              <div className="sl">
                <div className="sl-row"><span className="sl-lab">Potência média</span><span className="sl-val">{fmtNum(avgPower, 2)} W</span></div>
                <div className="sl-row"><span className="sl-lab">Pico de potência</span><span className="sl-val">{fmtNum(peakPower, 2)} W</span></div>
                <div className="sl-row"><span className="sl-lab">Acumulado total</span><span className="sl-val">{fmtEnergy(totalKwh)}</span></div>
                <div className="sl-row"><span className="sl-lab">Tempo ligada</span><span className="sl-val">{fmtDuration(Math.round(onSeconds))}</span></div>
                <div className="sl-row"><span className="sl-lab">Intensidade média</span><span className="sl-val">{avgPwmPct !== null ? `${avgPwmPct}%` : '--'}</span></div>
                <div className="sl-row"><span className="sl-lab">Leituras com presença</span><span className="sl-val">{presenceCount} / {readings.length}</span></div>
                <div className="sl-row"><span className="sl-lab">Leituras com ruído</span><span className="sl-val">{soundCount} / {readings.length}</span></div>
              </div>
              <div className="presence-sec">
                <div className="presence-top">
                  <span className="presence-lab">Detecções de presença</span>
                  <span className="presence-pct">{readings.length > 0 ? Math.round((presenceCount / readings.length) * 100) : 0}%</span>
                </div>
                <div className="presence-track">
                  <div className="presence-fill" style={{ width: `${readings.length > 0 ? (presenceCount / readings.length) * 100 : 0}%` }} />
                </div>
              </div>
            </div>
          </section>

          {/* HEALTH */}
          <section className="health-section reveal">
            <div className="p-head">
              <div>
                <h3 className="p-title">Saúde Ambiental</h3>
                <p className="health-sub">Temperatura, umidade e ruído captados pelo DHT22 e microfone</p>
              </div>
              <span className="p-badge">Ambiente</span>
            </div>
            <div className="health-grid">
              <HealthCard
                iconColor="#E05C3A" iconBg="rgba(224,92,58,0.10)"
                icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>}
                value={temperatura !== null ? fmtNum(temperatura, 1) : '--'}
                unit="°C"
                label="Temperatura"
                pct={temperatura !== null ? (temperatura / 50) * 100 : null}
                barColor={temperatura !== null && temperatura > 35 ? '#DC2626' : temperatura !== null && temperatura > 27 ? '#F5A623' : '#1B8A8F'}
                stats={[
                  { value: avgTemp !== null ? fmtNum(avgTemp, 1) + '°C' : '--', label: 'média' },
                  { value: minTemp !== null ? fmtNum(minTemp, 1) + '°C' : '--', label: 'mín' },
                  { value: maxTemp !== null ? fmtNum(maxTemp, 1) + '°C' : '--', label: 'máx' },
                ]}
              />
              <HealthCard
                iconColor="#1B8A8F" iconBg="rgba(27,138,143,0.10)"
                icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>}
                value={umidade !== null ? fmtNum(umidade, 1) : '--'}
                unit="%"
                label="Umidade"
                pct={umidade !== null ? umidade : null}
                barColor={umidade !== null && umidade > 80 ? '#1B8A8F' : umidade !== null && umidade > 60 ? '#22C55E' : '#F5A623'}
                stats={[
                  { value: avgHumidity !== null ? fmtNum(avgHumidity, 1) + '%' : '--', label: 'média' },
                  { value: umidade === null ? '--' : umidade < 30 ? 'Seco' : umidade < 60 ? 'Normal' : umidade < 80 ? 'Úmido' : 'Muito úmido', label: 'nível' },
                ]}
              />
              <HealthCard
                alert={noiseAlert}
                iconColor={noiseAlert ? '#DC2626' : '#6E5BBE'} iconBg={noiseAlert ? 'rgba(220,38,38,0.12)' : 'rgba(110,91,190,0.10)'}
                icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 10v4"/><path d="M6 7v10"/><path d="M10 4v16"/><path d="M14 8v8"/><path d="M18 6v12"/><path d="M22 10v4"/></svg>}
                value={fmtNum(noiseDb, 1)}
                unit="dB"
                label="Nível de Ruído"
                pct={(noiseDb / 100) * 100}
                barColor={noiseAlert ? '#DC2626' : noiseDb > 60 ? '#F5A623' : '#6E5BBE'}
                stats={[
                  { value: avgNoiseDb !== null ? fmtNum(avgNoiseDb, 1) + ' dB' : '--', label: 'média' },
                  { value: maxNoiseDb !== null ? fmtNum(maxNoiseDb, 1) + ' dB' : '--', label: 'pico' },
                  { value: `${soundCount}/${readings.length}`, label: 'eventos' },
                ]}
              />
            </div>
          </section>

          <NewsletterSection />

          <footer className="foot">
            <span>ReciLuz Dashboard · Atualização a cada {REFRESH_MS / 1000}s</span>
            <span>Última leitura: <strong>{fmtTime(latest.criada_em)}</strong></span>
          </footer>

        </div>
      </section>
    </>
  );
}

/* ─────────────────────────── SITE FOOTER */
function SiteFooter() {
  return (
    <footer className="site-foot">
      <div className="site-foot-inner">
        <div>
          <div className="sf-brand"><span className="bulb" /> ReciLuz</div>
          <p className="sf-tag">
            Plataforma de gestão inteligente para a iluminação pública do Recife.
            Sensores, dados e controle remoto a serviço de uma cidade mais segura e eficiente.
          </p>
        </div>
        <div className="sf-col">
          <h4>Projeto</h4>
          <ul>
            <li><a href="#sobre">Sobre o sistema</a></li>
            <li><a href="#arquitetura">Arquitetura</a></li>
            <li><a href="#dashboard">Painel ao vivo</a></li>
          </ul>
        </div>
        <div className="sf-col">
          <h4>Documentação</h4>
          <ul>
            <li><a href="https://github.com/paulo-rago/Projeto-SE-Grupo-8" target="_blank" rel="noopener">Repositório GitHub</a></li>
            <li><a href="#">API · Especificação MQTT</a></li>
            <li><a href="#">Manual do poste</a></li>
          </ul>
        </div>
      </div>
      <div className="sf-bottom">
        <span>© 2026 ReciLuz · Projeto SE — Grupo 8</span>
        <span>Recife · Pernambuco · Brasil</span>
      </div>
    </footer>
  );
}

/* ─────────────────────────── REVEAL ON SCROLL */
function useReveal() {
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in'); });
    }, { threshold: 0.15 });
    document.querySelectorAll('.reveal').forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);
}

/* ─────────────────────────── ROOT */
function App() {
  useReveal();
  return (
    <>
      <Hero />
      <About />
      <Dashboard />
      <SiteFooter />
      <LegendDrawer />
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
