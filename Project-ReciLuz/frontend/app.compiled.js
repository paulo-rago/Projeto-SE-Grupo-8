const { useState, useEffect, useRef, useCallback, useMemo } = React;
const REFRESH_MS = 2e3;
const CHART_WINDOW = 30;
const VOLTAGE = 12;
const HIGH_CURRENT_THRESHOLD = 1;
const fmt = (v, fallback = "--") => v === null || v === void 0 || v === "" ? fallback : v;
const fmtNum = (v, dec = 1) => {
  const n = Number(v);
  return v === null || v === void 0 || isNaN(n) ? "--" : n.toFixed(dec);
};
const fmtEnergy = (kwh) => {
  if (kwh === null || kwh === void 0 || isNaN(Number(kwh))) return "--";
  const v = Number(kwh);
  if (v >= 0.01) return `${v.toFixed(4)} kWh`;
  const wh = v * 1e3;
  if (wh >= 0.01) return `${wh.toFixed(3)} Wh`;
  return `${(wh * 1e3).toFixed(2)} mWh`;
};
const fmtDuration = (s) => {
  const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
};
const fmtTime = (iso) => !iso ? "--" : new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { Accept: "application/json", ...options.headers },
    ...options
  });
  if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`);
  return res.json();
}
function HeroScene() {
  return /* @__PURE__ */ React.createElement("div", { className: "scene", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("svg", { className: "layer-sky par", "data-par": "0.08", viewBox: "0 0 1600 900", preserveAspectRatio: "xMidYMid slice", style: { height: "100%" } }, /* @__PURE__ */ React.createElement("defs", null, /* @__PURE__ */ React.createElement("radialGradient", { id: "sun", cx: "50%", cy: "92%", r: "60%" }, /* @__PURE__ */ React.createElement("stop", { offset: "0%", stopColor: "#FFD995", stopOpacity: "0.85" }), /* @__PURE__ */ React.createElement("stop", { offset: "30%", stopColor: "#F5A87A", stopOpacity: "0.45" }), /* @__PURE__ */ React.createElement("stop", { offset: "60%", stopColor: "#B05E60", stopOpacity: "0.15" }), /* @__PURE__ */ React.createElement("stop", { offset: "100%", stopColor: "#1B2748", stopOpacity: "0" }))), /* @__PURE__ */ React.createElement("rect", { width: "1600", height: "900", fill: "url(#sun)" }), /* @__PURE__ */ React.createElement("ellipse", { cx: "280", cy: "220", rx: "170", ry: "14", fill: "#E89E5C", opacity: "0.20" }), /* @__PURE__ */ React.createElement("ellipse", { cx: "1280", cy: "180", rx: "220", ry: "12", fill: "#F0B97A", opacity: "0.18" }), /* @__PURE__ */ React.createElement("ellipse", { cx: "800", cy: "280", rx: "140", ry: "9", fill: "#FFD995", opacity: "0.15" })), /* @__PURE__ */ React.createElement("svg", { className: "layer-stars par", "data-par": "0.05", viewBox: "0 0 1600 600", preserveAspectRatio: "xMidYMid slice", style: { height: "65%" } }, Array.from({ length: 60 }).map((_, i) => {
    const x = i * 137 % 1600;
    const y = i * 73 % 280;
    const r = 0.6 + i % 3 * 0.35;
    return /* @__PURE__ */ React.createElement("circle", { key: i, className: `twinkle ${i % 4 === 0 ? "t2" : i % 3 === 0 ? "t3" : i % 5 === 0 ? "t4" : ""}`, cx: x, cy: y, r, fill: "#fff", opacity: 0.55 });
  })), /* @__PURE__ */ React.createElement("svg", { className: "layer-skyline par", "data-par": "0.18", viewBox: "0 0 1600 480", preserveAspectRatio: "xMidYEnd slice" }, /* @__PURE__ */ React.createElement("defs", null, /* @__PURE__ */ React.createElement("linearGradient", { id: "skylineGrad", x1: "0", y1: "0", x2: "0", y2: "1" }, /* @__PURE__ */ React.createElement("stop", { offset: "0%", stopColor: "#1A2444" }), /* @__PURE__ */ React.createElement("stop", { offset: "100%", stopColor: "#0B1530" }))), /* @__PURE__ */ React.createElement("g", { opacity: "0.55", fill: "#2A3656" }, /* @__PURE__ */ React.createElement("rect", { x: "40", y: "260", width: "90", height: "220" }), /* @__PURE__ */ React.createElement("rect", { x: "140", y: "230", width: "60", height: "250" }), /* @__PURE__ */ React.createElement("rect", { x: "210", y: "250", width: "55", height: "230" }), /* @__PURE__ */ React.createElement("rect", { x: "275", y: "280", width: "45", height: "200" }), /* @__PURE__ */ React.createElement("rect", { x: "1320", y: "210", width: "75", height: "270" }), /* @__PURE__ */ React.createElement("rect", { x: "1405", y: "250", width: "55", height: "230" }), /* @__PURE__ */ React.createElement("rect", { x: "1475", y: "230", width: "45", height: "250" })), /* @__PURE__ */ React.createElement("g", { fill: "url(#skylineGrad)" }, /* @__PURE__ */ React.createElement("rect", { x: "330", y: "310", width: "60", height: "170" }), /* @__PURE__ */ React.createElement("polygon", { points: "330,310 360,290 390,310" }), /* @__PURE__ */ React.createElement("rect", { x: "390", y: "290", width: "55", height: "190" }), /* @__PURE__ */ React.createElement("rect", { x: "385", y: "285", width: "65", height: "8" }), /* @__PURE__ */ React.createElement("rect", { x: "445", y: "305", width: "60", height: "175" }), /* @__PURE__ */ React.createElement("path", { d: "M 445 305 Q 475 280 505 305 Z" }), /* @__PURE__ */ React.createElement("rect", { x: "510", y: "260", width: "95", height: "220" }), /* @__PURE__ */ React.createElement("path", { d: "M 510 260 Q 510 245 525 245 L 590 245 Q 605 245 605 260 Z" }), /* @__PURE__ */ React.createElement("rect", { x: "540", y: "195", width: "35", height: "70" }), /* @__PURE__ */ React.createElement("path", { d: "M 540 195 Q 540 175 557 168 Q 575 175 575 195 Z" }), /* @__PURE__ */ React.createElement("rect", { x: "555", y: "152", width: "4", height: "16" }), /* @__PURE__ */ React.createElement("polygon", { points: "553,152 561,152 557,144" }), /* @__PURE__ */ React.createElement("rect", { x: "605", y: "320", width: "40", height: "160" }), /* @__PURE__ */ React.createElement("rect", { x: "645", y: "305", width: "45", height: "175" }), /* @__PURE__ */ React.createElement("rect", { x: "690", y: "325", width: "38", height: "155" }), /* @__PURE__ */ React.createElement("rect", { x: "735", y: "245", width: "130", height: "235" }), /* @__PURE__ */ React.createElement("polygon", { points: "735,245 800,210 865,245" }), /* @__PURE__ */ React.createElement("rect", { x: "785", y: "215", width: "30", height: "8" }), /* @__PURE__ */ React.createElement("rect", { x: "752", y: "160", width: "24", height: "90" }), /* @__PURE__ */ React.createElement("polygon", { points: "747,160 781,160 764,138" }), /* @__PURE__ */ React.createElement("rect", { x: "760", y: "128", width: "8", height: "12" }), /* @__PURE__ */ React.createElement("rect", { x: "824", y: "160", width: "24", height: "90" }), /* @__PURE__ */ React.createElement("polygon", { points: "819,160 853,160 836,138" }), /* @__PURE__ */ React.createElement("rect", { x: "832", y: "128", width: "8", height: "12" }), /* @__PURE__ */ React.createElement("rect", { x: "865", y: "305", width: "55", height: "175" }), /* @__PURE__ */ React.createElement("path", { d: "M 865 305 Q 892 285 920 305 Z" }), /* @__PURE__ */ React.createElement("rect", { x: "920", y: "290", width: "50", height: "190" }), /* @__PURE__ */ React.createElement("polygon", { points: "920,290 920,275 935,275 935,265 950,265 950,275 970,275 970,290" }), /* @__PURE__ */ React.createElement("rect", { x: "980", y: "230", width: "60", height: "250" }), /* @__PURE__ */ React.createElement("polygon", { points: "980,230 982,210 1038,210 1040,230" }), /* @__PURE__ */ React.createElement("ellipse", { cx: "1010", cy: "210", rx: "30", ry: "22" }), /* @__PURE__ */ React.createElement("rect", { x: "1003", y: "168", width: "14", height: "22" }), /* @__PURE__ */ React.createElement("ellipse", { cx: "1010", cy: "168", rx: "10", ry: "6" }), /* @__PURE__ */ React.createElement("rect", { x: "1008", y: "148", width: "4", height: "22" }), /* @__PURE__ */ React.createElement("polygon", { points: "1005,148 1015,148 1010,138" }), /* @__PURE__ */ React.createElement("rect", { x: "1040", y: "315", width: "40", height: "165" }), /* @__PURE__ */ React.createElement("rect", { x: "1080", y: "295", width: "50", height: "185" }), /* @__PURE__ */ React.createElement("polygon", { points: "1080,295 1105,278 1130,295" }), /* @__PURE__ */ React.createElement("rect", { x: "1135", y: "190", width: "55", height: "290", fill: "#222D4D" }), /* @__PURE__ */ React.createElement("rect", { x: "1192", y: "225", width: "42", height: "255" }), /* @__PURE__ */ React.createElement("rect", { x: "1238", y: "310", width: "55", height: "170" }), /* @__PURE__ */ React.createElement("path", { d: "M 1238 310 Q 1265 290 1293 310 Z" }), /* @__PURE__ */ React.createElement("rect", { x: "1293", y: "295", width: "50", height: "185" }), /* @__PURE__ */ React.createElement("rect", { x: "1343", y: "275", width: "60", height: "205" }), /* @__PURE__ */ React.createElement("polygon", { points: "1343,275 1373,255 1403,275" }), /* @__PURE__ */ React.createElement("rect", { x: "1365", y: "222", width: "16", height: "56" }), /* @__PURE__ */ React.createElement("polygon", { points: "1361,222 1385,222 1373,205" })), /* @__PURE__ */ React.createElement("g", { fill: "#F5A623" }, [
    [345, 350, 3, 4],
    [345, 390, 3, 4],
    [345, 430, 3, 4],
    [400, 330, 3, 4],
    [400, 370, 3, 4],
    [400, 410, 3, 4],
    [420, 440, 3, 4],
    [458, 340, 3, 4],
    [478, 380, 3, 4],
    [463, 420, 3, 4],
    [530, 290, 4, 5],
    [560, 300, 4, 5],
    [585, 290, 4, 5],
    [550, 210, 3, 4],
    [615, 360, 3, 4],
    [618, 410, 3, 4],
    [655, 340, 3, 4],
    [670, 380, 3, 4],
    [660, 420, 3, 4],
    [700, 360, 3, 4],
    [702, 420, 3, 4],
    [761, 180, 3, 4],
    [833, 180, 3, 4],
    [765, 280, 3, 4],
    [800, 300, 3, 4],
    [835, 280, 3, 4],
    [770, 330, 3, 4],
    [830, 330, 3, 4],
    [800, 380, 3, 4],
    [800, 430, 3, 4],
    [880, 335, 3, 4],
    [900, 375, 3, 4],
    [885, 420, 3, 4],
    [935, 320, 3, 4],
    [955, 360, 3, 4],
    [945, 410, 3, 4],
    [988, 250, 2, 3],
    [1e3, 250, 2, 3],
    [1015, 250, 2, 3],
    [1030, 250, 2, 3],
    [988, 290, 3, 4],
    [1010, 330, 3, 4],
    [1030, 290, 3, 4],
    [1010, 400, 3, 4],
    [1052, 345, 3, 4],
    [1055, 395, 3, 4],
    [1063, 440, 3, 4],
    [1093, 325, 3, 4],
    [1115, 365, 3, 4],
    [1100, 410, 3, 4],
    [1145, 220, 3, 3],
    [1160, 220, 3, 3],
    [1175, 220, 3, 3],
    [1145, 250, 3, 3],
    [1175, 250, 3, 3],
    [1145, 280, 3, 3],
    [1160, 280, 3, 3],
    [1175, 280, 3, 3],
    [1145, 310, 3, 3],
    [1145, 340, 3, 3],
    [1160, 340, 3, 3],
    [1175, 340, 3, 3],
    [1145, 370, 3, 3],
    [1160, 370, 3, 3],
    [1145, 400, 3, 3],
    [1175, 400, 3, 3],
    [1145, 430, 3, 3],
    [1160, 430, 3, 3],
    [1175, 430, 3, 3],
    [1200, 255, 3, 3],
    [1215, 255, 3, 3],
    [1200, 290, 3, 3],
    [1200, 325, 3, 3],
    [1215, 325, 3, 3],
    [1200, 360, 3, 3],
    [1200, 395, 3, 3],
    [1215, 395, 3, 3],
    [1200, 430, 3, 3],
    [1248, 340, 3, 4],
    [1268, 380, 3, 4],
    [1253, 420, 3, 4],
    [1303, 335, 3, 4],
    [1323, 375, 3, 4],
    [1310, 420, 3, 4],
    [1355, 310, 3, 4],
    [1385, 310, 3, 4],
    [1370, 360, 3, 4],
    [1370, 410, 3, 4]
  ].map(([x, y, w, h], i) => /* @__PURE__ */ React.createElement("rect", { key: i, x, y, width: w, height: h, opacity: 0.65 + i % 4 * 0.08 })))), /* @__PURE__ */ React.createElement("svg", { className: "layer-bridge par", "data-par": "0.32", viewBox: "0 0 1600 360", preserveAspectRatio: "xMidYEnd slice" }, /* @__PURE__ */ React.createElement("defs", null, /* @__PURE__ */ React.createElement("linearGradient", { id: "water", x1: "0", y1: "0", x2: "0", y2: "1" }, /* @__PURE__ */ React.createElement("stop", { offset: "0%", stopColor: "#3A3D5C" }), /* @__PURE__ */ React.createElement("stop", { offset: "100%", stopColor: "#1E2440" }))), /* @__PURE__ */ React.createElement("rect", { x: "-1600", y: "160", width: "4800", height: "200", fill: "url(#water)" }), /* @__PURE__ */ React.createElement("g", { stroke: "#F5A623", strokeWidth: "1", opacity: "0.18" }, /* @__PURE__ */ React.createElement("line", { x1: "-1600", y1: "210", x2: "3200", y2: "210" }), /* @__PURE__ */ React.createElement("line", { x1: "-1600", y1: "240", x2: "3200", y2: "240" }), /* @__PURE__ */ React.createElement("line", { x1: "-1600", y1: "280", x2: "3200", y2: "280" }), /* @__PURE__ */ React.createElement("line", { x1: "-1600", y1: "320", x2: "3200", y2: "320" })), /* @__PURE__ */ React.createElement("g", { stroke: "#FFD58A", strokeWidth: "2", opacity: "0.30", strokeDasharray: "20 30" }, /* @__PURE__ */ React.createElement("line", { x1: "-1600", y1: "220", x2: "3200", y2: "220" }))), /* @__PURE__ */ React.createElement("svg", { className: "layer-fg par", "data-par": "0.5", viewBox: "0 0 1600 280", preserveAspectRatio: "xMidYEnd slice" }, /* @__PURE__ */ React.createElement("defs", null, /* @__PURE__ */ React.createElement("linearGradient", { id: "teal", x1: "0", y1: "0", x2: "0", y2: "1" }, /* @__PURE__ */ React.createElement("stop", { offset: "0%", stopColor: "#1F9CA1" }), /* @__PURE__ */ React.createElement("stop", { offset: "100%", stopColor: "#0F5F63" })), /* @__PURE__ */ React.createElement("radialGradient", { id: "bulbGlow", cx: "50%", cy: "50%", r: "50%" }, /* @__PURE__ */ React.createElement("stop", { offset: "0%", stopColor: "#FFE7A0", stopOpacity: "1" }), /* @__PURE__ */ React.createElement("stop", { offset: "30%", stopColor: "#FFC560", stopOpacity: "0.85" }), /* @__PURE__ */ React.createElement("stop", { offset: "70%", stopColor: "#F5A623", stopOpacity: "0.35" }), /* @__PURE__ */ React.createElement("stop", { offset: "100%", stopColor: "#F5A623", stopOpacity: "0" })), /* @__PURE__ */ React.createElement("linearGradient", { id: "castGrad", x1: "0", y1: "0", x2: "0", y2: "1" }, /* @__PURE__ */ React.createElement("stop", { offset: "0%", stopColor: "#FFD58A", stopOpacity: "0.55" }), /* @__PURE__ */ React.createElement("stop", { offset: "100%", stopColor: "#F5A623", stopOpacity: "0" }))), /* @__PURE__ */ React.createElement("rect", { x: "-1600", y: "220", width: "4800", height: "60", fill: "#2A2330" }), /* @__PURE__ */ React.createElement("rect", { x: "-1600", y: "218", width: "4800", height: "4", fill: "#E6D2B5" }), /* @__PURE__ */ React.createElement("g", { fill: "#F7EDE2", opacity: "0.6" }, Array.from({ length: 18 }).map((_, i) => /* @__PURE__ */ React.createElement("rect", { key: i, x: 20 + i * 92, y: 250, width: 56, height: 4, rx: 1 }))), /* @__PURE__ */ React.createElement("rect", { x: "-1600", y: "138", width: "4800", height: "14", fill: "url(#teal)" }), /* @__PURE__ */ React.createElement("rect", { x: "-1600", y: "152", width: "4800", height: "42", fill: "#F2E0C4" }), /* @__PURE__ */ React.createElement("rect", { x: "-1600", y: "194", width: "4800", height: "10", fill: "url(#teal)" }), /* @__PURE__ */ React.createElement("rect", { x: "-1600", y: "204", width: "4800", height: "6", fill: "#0F5F63" }), /* @__PURE__ */ React.createElement("rect", { x: "-1600", y: "210", width: "4800", height: "10", fill: "#D7BC9A" }), /* @__PURE__ */ React.createElement("g", { fill: "#F2E0C4", stroke: "#B89B7A", strokeWidth: "0.6" }, Array.from({ length: 64 }).map((_, i) => {
    const x = 12 + i * 25;
    return /* @__PURE__ */ React.createElement("g", { key: i }, /* @__PURE__ */ React.createElement("ellipse", { cx: x, cy: 170, rx: 6, ry: 10 }), /* @__PURE__ */ React.createElement("ellipse", { cx: x, cy: 184, rx: 5, ry: 4 }), /* @__PURE__ */ React.createElement("rect", { x: x - 3, y: 188, width: 6, height: 6 }));
  })), [140, 460, 800, 1140, 1460].map((cx, idx) => {
    const headOffset = 28;
    return /* @__PURE__ */ React.createElement("g", { key: idx, className: "lamp-light", "data-lamp-index": idx }, /* @__PURE__ */ React.createElement("ellipse", { className: "lamp-cast", cx, cy: 235, rx: 120, ry: 32, fill: "url(#castGrad)" }), /* @__PURE__ */ React.createElement("rect", { x: cx - 12, y: 130, width: 24, height: 10, fill: "#1A1820" }), /* @__PURE__ */ React.createElement("rect", { x: cx - 4, y: 20, width: 8, height: 120, fill: "#1A1820" }), /* @__PURE__ */ React.createElement("rect", { x: cx - 9, y: 50, width: 18, height: 5, fill: "#1A1820" }), /* @__PURE__ */ React.createElement("rect", { x: cx - headOffset - 4, y: 18, width: (headOffset + 4) * 2, height: 5, fill: "#1A1820" }), /* @__PURE__ */ React.createElement("path", { d: `M ${cx - headOffset} 20 Q ${cx - headOffset} 8 ${cx - headOffset - 4} 8`, stroke: "#1A1820", strokeWidth: "3", fill: "none" }), /* @__PURE__ */ React.createElement("path", { d: `M ${cx + headOffset} 20 Q ${cx + headOffset} 8 ${cx + headOffset + 4} 8`, stroke: "#1A1820", strokeWidth: "3", fill: "none" }), [-headOffset, headOffset].map((dx, k) => /* @__PURE__ */ React.createElement("g", { key: k }, /* @__PURE__ */ React.createElement("circle", { className: "lamp-glow", cx: cx + dx, cy: 6, r: 48, fill: "url(#bulbGlow)" }), /* @__PURE__ */ React.createElement("polygon", { points: `${cx + dx - 8},10 ${cx + dx + 8},10 ${cx + dx + 6},22 ${cx + dx - 6},22`, fill: "#1A1820" }), /* @__PURE__ */ React.createElement("polygon", { points: `${cx + dx - 9},10 ${cx + dx + 9},10 ${cx + dx},2`, fill: "#1A1820" }), /* @__PURE__ */ React.createElement("circle", { cx: cx + dx, cy: 1, r: 1.5, fill: "#1A1820" }), /* @__PURE__ */ React.createElement("ellipse", { className: "lamp-bulb", cx: cx + dx, cy: 16, rx: 5, ry: 6, fill: "#FFE7A0" }))));
  })));
}
function Embers() {
  const list = useMemo(() => Array.from({ length: 24 }).map((_, i) => ({
    left: (Math.random() * 100).toFixed(1) + "%",
    duration: (12 + Math.random() * 18).toFixed(1) + "s",
    delay: (Math.random() * 18).toFixed(1) + "s",
    dx: (Math.random() * 100 - 50).toFixed(0) + "px",
    size: 2 + Math.random() * 2
  })), []);
  return /* @__PURE__ */ React.createElement("div", { className: "embers", "aria-hidden": "true" }, list.map((e, i) => /* @__PURE__ */ React.createElement("span", { key: i, className: "ember", style: {
    left: e.left,
    animationDuration: e.duration,
    animationDelay: e.delay,
    width: e.size + "px",
    height: e.size + "px",
    ["--dx"]: e.dx
  } })));
}
function Hero() {
  useEffect(() => {
    const hero = document.querySelector(".hero");
    const timers = [];
    const reveal = (selector, from, to, opts) => {
      const els2 = document.querySelectorAll(selector);
      els2.forEach((el) => {
        Object.assign(el.style, to);
        try {
          const anim = el.animate([from, to], {
            duration: opts.duration || 900,
            delay: opts.delay || 0,
            fill: "forwards",
            easing: opts.easing || "ease-out"
          });
          if (anim.startTime === null && document.timeline.currentTime !== null) {
            anim.startTime = document.timeline.currentTime;
          }
        } catch (e) {
        }
      });
    };
    reveal(
      ".hero-eyebrow",
      { opacity: 0, transform: "translateY(10px)" },
      { opacity: 1, transform: "translateY(0)" },
      { duration: 900, delay: 200 }
    );
    reveal(
      ".hero-title",
      { opacity: 0, transform: "translateY(20px) scale(0.97)", filter: "blur(8px)" },
      { opacity: 1, transform: "translateY(0) scale(1)", filter: "blur(0)" },
      { duration: 1200, delay: 400 }
    );
    reveal(
      ".hero-sub",
      { opacity: 0, transform: "translateY(10px)" },
      { opacity: 1, transform: "translateY(0)" },
      { duration: 900, delay: 700 }
    );
    reveal(
      ".hero-stats",
      { opacity: 0, transform: "translate(-50%, 10px)" },
      { opacity: 1, transform: "translate(-50%, 0)" },
      { duration: 900, delay: 1e3 }
    );
    reveal(
      ".scroll-cue",
      { opacity: 0, transform: "translate(-50%, 10px)" },
      { opacity: 1, transform: "translate(-50%, 0)" },
      { duration: 900, delay: 1200 }
    );
    if (hero) hero.classList.add("entered");
    const lamps = document.querySelectorAll(".lamp-light");
    lamps.forEach((l, i) => {
      timers.push(setTimeout(() => {
        l.classList.add("lit");
        const bulbs = l.querySelectorAll(".lamp-bulb");
        const glows = l.querySelectorAll(".lamp-glow");
        const casts = l.querySelectorAll(".lamp-cast");
        const kick = (els2, target, duration) => {
          els2.forEach((el) => {
            el.style.opacity = String(target);
            try {
              const a = el.animate(
                [{ opacity: 0 }, { opacity: target }],
                { duration, fill: "forwards", easing: "ease-out" }
              );
              if (a.startTime === null && document.timeline.currentTime !== null) {
                a.startTime = document.timeline.currentTime;
              }
            } catch (e) {
            }
          });
        };
        kick(bulbs, 1, 1200);
        kick(glows, 0.95, 1400);
        kick(casts, 0.7, 1600);
      }, 1300 + i * 450));
    });
    const pulseTimer = setTimeout(() => {
      const glows = document.querySelectorAll(".lamp-glow");
      glows.forEach((g, i) => {
        try {
          const anim = g.animate(
            [
              { transform: "scale(1)", opacity: 0.85 },
              { transform: "scale(1.08)", opacity: 1 },
              { transform: "scale(1)", opacity: 0.85 }
            ],
            {
              duration: 4e3 + i % 3 * 400,
              iterations: Infinity,
              easing: "ease-in-out",
              delay: i * 150
            }
          );
          if (anim.startTime === null && document.timeline.currentTime !== null) {
            anim.startTime = document.timeline.currentTime;
          }
        } catch (e) {
        }
      });
    }, 3500);
    timers.push(pulseTimer);
    const els = document.querySelectorAll(".par");
    const onScroll = () => {
      const y = window.scrollY;
      const h = window.innerHeight;
      if (y > h) return;
      els.forEach((el) => {
        const r = parseFloat(el.dataset.par || "0.1");
        el.style.transform = `translate3d(-50%, ${y * r}px, 0)`;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
  return /* @__PURE__ */ React.createElement("header", { className: "hero" }, /* @__PURE__ */ React.createElement(HeroScene, null), /* @__PURE__ */ React.createElement(Embers, null), /* @__PURE__ */ React.createElement("nav", { className: "hero-nav" }, /* @__PURE__ */ React.createElement("div", { className: "hero-nav-brand" }, /* @__PURE__ */ React.createElement("span", { className: "bulb", "aria-hidden": "true" }), "ReciLuz"), /* @__PURE__ */ React.createElement("div", { className: "hero-nav-links" }, /* @__PURE__ */ React.createElement("a", { href: "#sobre" }, "Sobre"), /* @__PURE__ */ React.createElement("a", { href: "#arquitetura" }, "Arquitetura"), /* @__PURE__ */ React.createElement("a", { href: "#dashboard" }, "Dashboard"))), /* @__PURE__ */ React.createElement("div", { className: "hero-content" }, /* @__PURE__ */ React.createElement("div", { className: "hero-eyebrow" }, /* @__PURE__ */ React.createElement("span", { className: "dot" }), " Prefeitura do Recife \xB7 Piloto"), /* @__PURE__ */ React.createElement("h1", { className: "hero-title" }, "ReciLuz"), /* @__PURE__ */ React.createElement("p", { className: "hero-sub" }, "Gest\xE3o ", /* @__PURE__ */ React.createElement("strong", null, "Inteligente"), " de Ilumina\xE7\xE3o P\xFAblica \u2014 sensores, telemetria e controle remoto para iluminar o Recife com menos energia e mais seguran\xE7a.")), /* @__PURE__ */ React.createElement("div", { className: "hero-stats" }, /* @__PURE__ */ React.createElement("div", { className: "hs-item" }, /* @__PURE__ */ React.createElement("div", { className: "hs-num" }, "\u221268%"), /* @__PURE__ */ React.createElement("div", { className: "hs-label" }, "Energia m\xE9dia")), /* @__PURE__ */ React.createElement("div", { className: "hs-div" }), /* @__PURE__ */ React.createElement("div", { className: "hs-item" }, /* @__PURE__ */ React.createElement("div", { className: "hs-num" }, "2 s"), /* @__PURE__ */ React.createElement("div", { className: "hs-label" }, "Lat\xEAncia MQTT")), /* @__PURE__ */ React.createElement("div", { className: "hs-div" }), /* @__PURE__ */ React.createElement("div", { className: "hs-item" }, /* @__PURE__ */ React.createElement("div", { className: "hs-num" }, "24/7"), /* @__PURE__ */ React.createElement("div", { className: "hs-label" }, "Telemetria"))), /* @__PURE__ */ React.createElement("a", { className: "scroll-cue", href: "#sobre", "aria-label": "Rolar para baixo" }, /* @__PURE__ */ React.createElement("span", null, "Explorar"), /* @__PURE__ */ React.createElement("span", { className: "arrow" }, /* @__PURE__ */ React.createElement("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("polyline", { points: "6 9 12 15 18 9" })))));
}
const FEATURES = [
  {
    accent: "#1B8A8F",
    accentSoft: "rgba(27,138,143,0.10)",
    tag: "Sensor",
    title: "Presen\xE7a adaptativa",
    text: "Sensor ultrass\xF4nico detecta proximidade de pedestres e ve\xEDculos e ajusta o brilho da LED em tempo real, evitando iluminar ruas vazias.",
    icon: /* @__PURE__ */ React.createElement("svg", { width: "22", height: "22", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("circle", { cx: "12", cy: "12", r: "3" }), /* @__PURE__ */ React.createElement("path", { d: "M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" }))
  },
  {
    accent: "#F5A623",
    accentSoft: "rgba(245,166,35,0.14)",
    tag: "Efici\xEAncia",
    title: "Economia mensur\xE1vel",
    text: "Sensor de corrente ACS712 mede o consumo real e compara com uma refer\xEAncia fixa de 60 W. A economia aparece em tempo real no painel.",
    icon: /* @__PURE__ */ React.createElement("svg", { width: "22", height: "22", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("polyline", { points: "22 12 18 12 15 21 9 3 6 12 2 12" }))
  },
  {
    accent: "#2C3E6B",
    accentSoft: "rgba(44,62,107,0.10)",
    tag: "Conectividade",
    title: "ESP32 + MQTT",
    text: "Cada poste publica leituras a cada 2 segundos via MQTT. Comandos remotos chegam ao firmware com lat\xEAncia sub-segundo.",
    icon: /* @__PURE__ */ React.createElement("svg", { width: "22", height: "22", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("path", { d: "M5 12.55a11 11 0 0 1 14 0" }), /* @__PURE__ */ React.createElement("path", { d: "M2 8.82a15 15 0 0 1 20 0" }), /* @__PURE__ */ React.createElement("path", { d: "M8.5 16.43a6 6 0 0 1 7 0" }), /* @__PURE__ */ React.createElement("line", { x1: "12", y1: "20", x2: "12.01", y2: "20" }))
  }
];
function About() {
  return /* @__PURE__ */ React.createElement("section", { id: "sobre", className: "about" }, /* @__PURE__ */ React.createElement("div", { className: "about-inner" }, /* @__PURE__ */ React.createElement("div", { className: "reveal" }, /* @__PURE__ */ React.createElement("div", { className: "about-eyebrow" }, "O Projeto Reciluz"), /* @__PURE__ */ React.createElement("h2", { className: "about-title" }, "Iluminar o ", /* @__PURE__ */ React.createElement("em", null, "Recife"), " gastando menos \u2014", /* @__PURE__ */ React.createElement("br", null), "controle inteligente, transpar\xEAncia total."), /* @__PURE__ */ React.createElement("p", { className: "about-lead" }, "Reciluz \xE9 uma plataforma de ilumina\xE7\xE3o p\xFAblica que conecta postes equipados com sensores a um painel de gest\xE3o \xFAnico. Cada l\xE2mpada decide sozinha quando acender, com que intensidade e por quanto tempo \u2014 guiada pela presen\xE7a real de pessoas e ve\xEDculos. O resultado \xE9 uma cidade mais segura, contas de energia mais baixas e dados em tempo real para a equipe de manuten\xE7\xE3o.")), /* @__PURE__ */ React.createElement("div", { className: "features" }, FEATURES.map((f, i) => /* @__PURE__ */ React.createElement("article", { key: i, className: "feature reveal", style: {
    ["--accent"]: f.accent,
    ["--accent-soft"]: f.accentSoft,
    transitionDelay: `${i * 0.1}s`
  } }, /* @__PURE__ */ React.createElement("div", { className: "feature-icon" }, f.icon), /* @__PURE__ */ React.createElement("div", { className: "feature-tag" }, f.tag), /* @__PURE__ */ React.createElement("h3", { className: "feature-title" }, f.title), /* @__PURE__ */ React.createElement("p", { className: "feature-text" }, f.text)))), /* @__PURE__ */ React.createElement("div", { id: "arquitetura", className: "stack reveal" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", { className: "stack-h" }, "Do poste \xE0 ", /* @__PURE__ */ React.createElement("em", null, "nuvem"), " \u2014 em 2 segundos."), /* @__PURE__ */ React.createElement("p", { className: "stack-p" }, "Hardware open-source, protocolo padronizado e front-end web acess\xEDvel em qualquer navegador. A arquitetura modular permite escalar do piloto para milhares de pontos.")), /* @__PURE__ */ React.createElement("div", { className: "flow" }, /* @__PURE__ */ React.createElement("div", { className: "flow-node" }, /* @__PURE__ */ React.createElement("div", { className: "fn-ic" }, "\u{1F50C}"), /* @__PURE__ */ React.createElement("div", { className: "fn-lab" }, "Sensor"), /* @__PURE__ */ React.createElement("div", { className: "fn-name" }, "ESP32")), /* @__PURE__ */ React.createElement("div", { className: "flow-arrow" }, "\u2192"), /* @__PURE__ */ React.createElement("div", { className: "flow-node" }, /* @__PURE__ */ React.createElement("div", { className: "fn-ic" }, "\u{1F4E1}"), /* @__PURE__ */ React.createElement("div", { className: "fn-lab" }, "Broker"), /* @__PURE__ */ React.createElement("div", { className: "fn-name" }, "MQTT")), /* @__PURE__ */ React.createElement("div", { className: "flow-arrow" }, "\u2192"), /* @__PURE__ */ React.createElement("div", { className: "flow-node" }, /* @__PURE__ */ React.createElement("div", { className: "fn-ic" }, "\u{1F5C4}\uFE0F"), /* @__PURE__ */ React.createElement("div", { className: "fn-lab" }, "API"), /* @__PURE__ */ React.createElement("div", { className: "fn-name" }, "FastAPI")), /* @__PURE__ */ React.createElement("div", { className: "flow-arrow" }, "\u2192"), /* @__PURE__ */ React.createElement("div", { className: "flow-node" }, /* @__PURE__ */ React.createElement("div", { className: "fn-ic" }, "\u{1F4CA}"), /* @__PURE__ */ React.createElement("div", { className: "fn-lab" }, "Painel"), /* @__PURE__ */ React.createElement("div", { className: "fn-name" }, "Reciluz"))))));
}
function IntensityGauge({ percent }) {
  const pct = Math.max(0, Math.min(100, percent || 0));
  const arcLen = Math.PI * 64;
  const filled = pct / 100 * arcLen;
  const color = pct > 70 ? "#F5A623" : pct > 30 ? "#1B8A8F" : "#2C3E6B";
  return /* @__PURE__ */ React.createElement("div", { className: "gauge-wrap" }, /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 160 90", className: "gauge-svg", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("path", { d: "M 16 80 A 64 64 0 0 1 144 80", fill: "none", stroke: "rgba(26,37,64,0.08)", strokeWidth: "12", strokeLinecap: "round" }), /* @__PURE__ */ React.createElement(
    "path",
    {
      d: "M 16 80 A 64 64 0 0 1 144 80",
      fill: "none",
      stroke: color,
      strokeWidth: "12",
      strokeLinecap: "round",
      strokeDasharray: `${filled} ${arcLen}`,
      style: { transition: "stroke-dasharray .4s ease, stroke .3s ease" }
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "gauge-center" }, /* @__PURE__ */ React.createElement("span", { className: "gauge-num", style: { color } }, pct), /* @__PURE__ */ React.createElement("span", { className: "gauge-pct" }, "%")), /* @__PURE__ */ React.createElement("div", { className: "gauge-cap" }, "Intensidade"));
}
function Metric({ icon, value, unit, label, sub, alert, iconColor = "#1B8A8F", iconBg = "rgba(27,138,143,0.10)" }) {
  return /* @__PURE__ */ React.createElement("article", { className: `metric${alert ? " alert" : ""}` }, /* @__PURE__ */ React.createElement("div", { className: "m-ic", style: { ["--ic"]: iconColor, ["--ic-bg"]: iconBg } }, icon), /* @__PURE__ */ React.createElement("div", { className: "m-body" }, /* @__PURE__ */ React.createElement("div", { className: "m-value" }, /* @__PURE__ */ React.createElement("span", { className: "m-num" }, value), unit && /* @__PURE__ */ React.createElement("span", { className: "m-unit" }, unit)), /* @__PURE__ */ React.createElement("div", { className: "m-lab" }, label), sub && /* @__PURE__ */ React.createElement("div", { className: "m-sub" }, sub)));
}
function RealtimeChart({ readings }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current = new Chart(canvasRef.current, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: "Intensidade (%)",
            data: [],
            borderColor: "#F5A623",
            backgroundColor: "rgba(245,166,35,0.12)",
            tension: 0.4,
            fill: true,
            pointRadius: 2,
            borderWidth: 2,
            yAxisID: "y"
          },
          {
            label: "Corrente \xD710 (A)",
            data: [],
            borderColor: "#1B8A8F",
            backgroundColor: "transparent",
            tension: 0.4,
            fill: false,
            pointRadius: 2,
            borderWidth: 2,
            yAxisID: "y"
          },
          {
            label: "Dist\xE2ncia (cm)",
            data: [],
            borderColor: "#2C3E6B",
            backgroundColor: "transparent",
            tension: 0.4,
            fill: false,
            pointRadius: 2,
            borderWidth: 1.5,
            borderDash: [4, 3],
            yAxisID: "y2"
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            position: "top",
            labels: { boxWidth: 8, font: { size: 11, family: "Manrope" }, padding: 14, usePointStyle: true, color: "#6B7791" }
          },
          tooltip: {
            backgroundColor: "#1A2540",
            titleFont: { family: "Space Grotesk", size: 12 },
            bodyFont: { family: "Manrope", size: 11 },
            cornerRadius: 8,
            padding: 10,
            displayColors: true
          }
        },
        scales: {
          x: { grid: { color: "rgba(26,37,64,0.04)" }, ticks: { font: { size: 10 }, maxTicksLimit: 7, color: "#9AA4BC" } },
          y: { position: "left", min: 0, max: 100, grid: { color: "rgba(26,37,64,0.04)" }, ticks: { font: { size: 10 }, color: "#9AA4BC", stepSize: 25 } },
          y2: { position: "right", min: 0, max: 100, grid: { drawOnChartArea: false }, ticks: { font: { size: 10 }, color: "#2C3E6B", stepSize: 25 } }
        }
      }
    });
    return () => {
      if (chartRef.current) chartRef.current.destroy();
    };
  }, []);
  useEffect(() => {
    if (!chartRef.current || !readings.length) return;
    const data = readings.slice().reverse().slice(-CHART_WINDOW);
    const c = chartRef.current;
    c.data.labels = data.map((r) => fmtTime(r.criada_em));
    c.data.datasets[0].data = data.map((r) => Math.round(Number(r.intensidade_pwm || 0) / 255 * 100));
    c.data.datasets[1].data = data.map((r) => +(Number(r.corrente || 0) * 10).toFixed(2));
    c.data.datasets[2].data = data.map((r) => +Number(r.distancia_cm || 0).toFixed(1));
    c.update("none");
  }, [readings]);
  return /* @__PURE__ */ React.createElement("div", { className: "chart-box" }, /* @__PURE__ */ React.createElement("canvas", { ref: canvasRef }));
}
function EventLog({ readings, cmdLogs }) {
  if (!readings.length && !cmdLogs.length) return /* @__PURE__ */ React.createElement("div", { className: "log-empty" }, "Aguardando eventos...");
  return /* @__PURE__ */ React.createElement("div", { className: "log-list" }, cmdLogs.map((l, i) => /* @__PURE__ */ React.createElement("div", { key: `c-${i}`, className: "log-row cmd" }, /* @__PURE__ */ React.createElement("span", { className: "log-msg" }, l))), readings.slice(0, 12).map((r) => /* @__PURE__ */ React.createElement("div", { key: r.id, className: `log-row ${r.presenca_detectada ? "presence" : ""}` }, /* @__PURE__ */ React.createElement("span", { className: "log-time" }, fmtTime(r.criada_em)), /* @__PURE__ */ React.createElement("span", { className: "log-mode" }, r.modo || r.status_lampada || "--"), /* @__PURE__ */ React.createElement("span", { className: "log-detail" }, fmtNum(r.distancia_cm, 0), " cm \xB7 PWM ", fmt(r.intensidade_pwm), " \xB7 ", fmtNum(r.corrente, 3), " A"), r.presenca_detectada && /* @__PURE__ */ React.createElement("span", { className: "log-tag" }, "Presen\xE7a"))));
}
function SavingsRing({ pct }) {
  const circ = 2 * Math.PI * 52;
  const filled = Math.max(0, Math.min(100, pct || 0)) / 100 * circ;
  const color = pct >= 50 ? "#0E8A4F" : pct >= 20 ? "#F5A623" : "#DC2626";
  return /* @__PURE__ */ React.createElement("div", { className: "ring-wrap" }, /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 120 120", className: "ring-svg", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("circle", { cx: "60", cy: "60", r: "52", fill: "none", stroke: "rgba(26,37,64,0.07)", strokeWidth: "10" }), /* @__PURE__ */ React.createElement(
    "circle",
    {
      cx: "60",
      cy: "60",
      r: "52",
      fill: "none",
      stroke: color,
      strokeWidth: "10",
      strokeLinecap: "round",
      strokeDasharray: `${filled} ${circ}`,
      transform: "rotate(-90 60 60)",
      style: { transition: "stroke-dasharray .6s ease, stroke .3s ease" }
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "ring-center" }, /* @__PURE__ */ React.createElement("span", { className: "ring-num", style: { color } }, pct !== null ? Math.round(pct) : "--"), /* @__PURE__ */ React.createElement("span", { className: "ring-unit" }, "%")));
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
  const pwmPct = Math.round(pwm / 255 * 100);
  const current = Number(latest.corrente || 0);
  const power = Number(latest.potencia || 0);
  const distance = Number(latest.distancia_cm || 0);
  const isOn = pwm > 0;
  const isAuto = !latest.modo_remoto;
  const highCurrent = current > HIGH_CURRENT_THRESHOLD;
  const onReadings = readings.filter((r) => Number(r.intensidade_pwm || 0) > 0);
  const onSeconds = onReadings.length * (REFRESH_MS / 1e3);
  const onHours = onSeconds / 3600;
  const totalKwh = readings.reduce((s, r) => s + Number(r.consumo_estimado || 0), 0);
  const refKwh = 60 / 1e3 * onHours;
  const savingsKwh = Math.max(0, refKwh - totalKwh);
  const savingsPct = refKwh > 0 ? Math.min(100, Math.max(0, savingsKwh / refKwh * 100)) : null;
  const avgPower = readings.length ? readings.reduce((s, r) => s + Number(r.potencia || 0), 0) / readings.length : null;
  const peakPower = readings.length ? Math.max(...readings.map((r) => Number(r.potencia || 0))) : null;
  const avgPwmPct = onReadings.length ? Math.round(onReadings.reduce((s, r) => s + Number(r.intensidade_pwm || 0), 0) / onReadings.length / 255 * 100) : null;
  const presenceCount = readings.filter((r) => r.presenca_detectada).length;
  const log = useCallback((msg) => {
    const t = (/* @__PURE__ */ new Date()).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setCmdLogs((prev) => [`[${t}] ${msg}`, ...prev].slice(0, 20));
  }, []);
  const refresh = useCallback(async () => {
    try {
      const [lampData, readingsData] = await Promise.all([
        api("/lampada/status"),
        api("/leituras?limite=40")
      ]);
      setLamp(lampData);
      setReadings(readingsData);
      setEsp32Online(true);
      const r0 = readingsData[0];
      if (r0 && r0.criada_em) {
        const age = (Date.now() - new Date(r0.criada_em).getTime()) / 1e3;
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
      await api(path, { method: "POST" });
      log(msg);
      await refresh();
    } catch (e) {
      log(`Erro: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }, [busy, refresh, log]);
  const toggleLamp = () => sendCmd(
    isOn ? "/lampada/desligar" : "/lampada/ligar",
    isOn ? "L\xE2mpada desligada (manual)" : "L\xE2mpada ligada (manual)"
  );
  const toggleAuto = () => sendCmd(
    isAuto ? "/lampada/desligar" : "/lampada/automatico",
    isAuto ? "Modo autom\xE1tico desativado" : "Modo autom\xE1tico ativado"
  );
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "divider" }, /* @__PURE__ */ React.createElement("div", { className: "divider-inner" }, /* @__PURE__ */ React.createElement("h2", { id: "dashboard", className: "divider-h" }, "Painel de ", /* @__PURE__ */ React.createElement("span", { className: "ac" }, "controle ao vivo"), " \u2014 telemetria do poste piloto."), /* @__PURE__ */ React.createElement("div", { className: "divider-meta" }, /* @__PURE__ */ React.createElement("span", { className: "live-dot" }, /* @__PURE__ */ React.createElement("span", { className: "d" }), " Ao vivo"), /* @__PURE__ */ React.createElement("span", null, "Atualiza\xE7\xE3o a cada 2 s")))), /* @__PURE__ */ React.createElement("section", { className: "dash-section" }, /* @__PURE__ */ React.createElement("div", { className: "dash" }, /* @__PURE__ */ React.createElement("header", { className: "d-header" }, /* @__PURE__ */ React.createElement("div", { className: "d-brand" }, /* @__PURE__ */ React.createElement("div", { className: "d-bulb", "aria-hidden": "true" }), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "d-name" }, "ReciLuz"), /* @__PURE__ */ React.createElement("div", { className: "d-tag" }, "Ilumina\xE7\xE3o Inteligente \xB7 ESP32 + MQTT"))), /* @__PURE__ */ React.createElement("div", { className: "d-status" }, /* @__PURE__ */ React.createElement("span", { className: `s-badge ${esp32Online ? "s-on" : "s-off"}` }, /* @__PURE__ */ React.createElement("span", { className: "d" }), " ESP32"), /* @__PURE__ */ React.createElement("span", { className: `s-badge ${mqttFresh ? "s-on" : "s-off"}` }, /* @__PURE__ */ React.createElement("span", { className: "d" }), " MQTT"), /* @__PURE__ */ React.createElement("span", { className: "s-time" }, fmtTime(latest.criada_em)))), /* @__PURE__ */ React.createElement("section", { className: "ctrls" }, /* @__PURE__ */ React.createElement("div", { className: "ctrl" }, /* @__PURE__ */ React.createElement("div", { className: "ctrl-lab" }, "Modo atual"), /* @__PURE__ */ React.createElement("div", { className: `ctrl-pill ${isAuto ? "pill-auto" : "pill-manual"}` }, isAuto ? /* @__PURE__ */ React.createElement(React.Fragment, null, "\u25C9 Autom\xE1tico") : /* @__PURE__ */ React.createElement(React.Fragment, null, "\u25CE Manual")), /* @__PURE__ */ React.createElement("p", { className: "ctrl-desc" }, isAuto ? "Brilho controlado pela dist\xE2ncia do sensor." : isOn ? "L\xE2mpada ligada por comando manual." : "L\xE2mpada apagada por comando manual."), /* @__PURE__ */ React.createElement("div", { className: `lamp-status ${isOn ? "on" : "off"}`, title: isOn ? "Ligada" : "Desligada" })), /* @__PURE__ */ React.createElement("div", { className: `ctrl ctrl-center${isAuto ? " dim" : ""}` }, /* @__PURE__ */ React.createElement("div", { className: "ctrl-lab" }, "Controle manual"), /* @__PURE__ */ React.createElement(
    "button",
    {
      className: `btn-big ${isOn && !isAuto ? "btn-amber-on" : "btn-amber-off"}`,
      onClick: toggleLamp,
      disabled: busy || isAuto
    },
    /* @__PURE__ */ React.createElement("svg", { width: "22", height: "22", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.2", strokeLinecap: "round" }, /* @__PURE__ */ React.createElement("path", { d: "M12 2v6M18.36 5.64A9 9 0 1 1 5.64 5.64" })),
    isOn && !isAuto ? "LIGADA" : "DESLIGADA"
  ), isAuto && /* @__PURE__ */ React.createElement("p", { className: "hint" }, "Desative o modo autom\xE1tico primeiro")), /* @__PURE__ */ React.createElement("div", { className: "ctrl ctrl-center" }, /* @__PURE__ */ React.createElement("div", { className: "ctrl-lab" }, "Modo autom\xE1tico"), /* @__PURE__ */ React.createElement(
    "button",
    {
      className: `btn-big ${isAuto ? "btn-teal-on" : "btn-teal-off"}`,
      onClick: toggleAuto,
      disabled: busy
    },
    /* @__PURE__ */ React.createElement("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("circle", { cx: "12", cy: "12", r: "3" }), /* @__PURE__ */ React.createElement("path", { d: "M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" })),
    isAuto ? "ATIVO" : "INATIVO"
  ), /* @__PURE__ */ React.createElement("p", { className: "hint" }, isAuto ? "Quanto mais pr\xF3ximo, maior o brilho" : "Toque para ativar o sensor"))), /* @__PURE__ */ React.createElement("section", { className: "gauge-row" }, /* @__PURE__ */ React.createElement("div", { className: "gauge-card" }, /* @__PURE__ */ React.createElement(IntensityGauge, { percent: pwmPct }), /* @__PURE__ */ React.createElement("div", { className: "gauge-meta" }, /* @__PURE__ */ React.createElement("div", { className: "gm-i" }, /* @__PURE__ */ React.createElement("span", { className: "gm-lab" }, "PWM"), /* @__PURE__ */ React.createElement("span", { className: "gm-val" }, fmt(latest.intensidade_pwm, "--"), "/255")), /* @__PURE__ */ React.createElement("div", { className: "gm-div" }), /* @__PURE__ */ React.createElement("div", { className: "gm-i" }, /* @__PURE__ */ React.createElement("span", { className: "gm-lab" }, "Status"), /* @__PURE__ */ React.createElement("span", { className: `gm-val ${isOn ? "on" : "off"}` }, isOn ? "Ligada" : "Desligada")))), /* @__PURE__ */ React.createElement("div", { className: "metrics-grid" }, /* @__PURE__ */ React.createElement(
    Metric,
    {
      iconColor: "#2C3E6B",
      iconBg: "rgba(44,62,107,0.10)",
      icon: /* @__PURE__ */ React.createElement("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round" }, /* @__PURE__ */ React.createElement("path", { d: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" })),
      value: fmtNum(distance, 0),
      unit: "cm",
      label: "Dist\xE2ncia",
      sub: latest.presenca_detectada ? "\u25CF Presen\xE7a detectada" : "\u25CB Sem presen\xE7a"
    }
  ), /* @__PURE__ */ React.createElement(
    Metric,
    {
      alert: highCurrent,
      iconColor: highCurrent ? "#DC2626" : "#F5A623",
      iconBg: highCurrent ? "rgba(220,38,38,0.12)" : "rgba(245,166,35,0.14)",
      icon: /* @__PURE__ */ React.createElement("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("path", { d: "M13 2L3 14h9l-1 8 10-12h-9l1-8z" })),
      value: fmtNum(current, 3),
      unit: "A",
      label: "Corrente",
      sub: "Sensor ACS712"
    }
  ), /* @__PURE__ */ React.createElement(
    Metric,
    {
      iconColor: "#1B8A8F",
      iconBg: "rgba(27,138,143,0.10)",
      icon: /* @__PURE__ */ React.createElement("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("rect", { x: "2", y: "7", width: "20", height: "14", rx: "2" }), /* @__PURE__ */ React.createElement("path", { d: "M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" }), /* @__PURE__ */ React.createElement("line", { x1: "12", y1: "12", x2: "12", y2: "16" }), /* @__PURE__ */ React.createElement("line", { x1: "10", y1: "14", x2: "14", y2: "14" })),
      value: fmtNum(power, 2),
      unit: "W",
      label: "Pot\xEAncia",
      sub: `${VOLTAGE}V \xD7 ${fmtNum(current, 3)}A`
    }
  ), /* @__PURE__ */ React.createElement(
    Metric,
    {
      iconColor: "#6E5BBE",
      iconBg: "rgba(110,91,190,0.10)",
      icon: /* @__PURE__ */ React.createElement("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("path", { d: "M23 6l-9.5 9.5-5-5L1 18" }), /* @__PURE__ */ React.createElement("polyline", { points: "17 6 23 6 23 12" })),
      value: VOLTAGE,
      unit: "V",
      label: "Tens\xE3o",
      sub: "LED 12 V DC"
    }
  ), /* @__PURE__ */ React.createElement(
    Metric,
    {
      iconColor: "#0E8A4F",
      iconBg: "rgba(14,138,79,0.10)",
      icon: /* @__PURE__ */ React.createElement("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("polyline", { points: "22 12 18 12 15 21 9 3 6 12 2 12" })),
      value: fmtEnergy(totalKwh),
      unit: "",
      label: "Consumo Acum.",
      sub: "Energia total acumulada"
    }
  ), /* @__PURE__ */ React.createElement(
    Metric,
    {
      iconColor: "#0E8A4F",
      iconBg: "rgba(14,138,79,0.10)",
      icon: /* @__PURE__ */ React.createElement("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("path", { d: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" }), /* @__PURE__ */ React.createElement("path", { d: "M7 13s.5 3 5 3 5-3 5-3" }), /* @__PURE__ */ React.createElement("line", { x1: "9", y1: "9", x2: "9.01", y2: "9" }), /* @__PURE__ */ React.createElement("line", { x1: "15", y1: "9", x2: "15.01", y2: "9" })),
      value: savingsPct !== null ? `${Math.round(savingsPct)}%` : "--",
      unit: "",
      label: "Economia",
      sub: "vs l\xE2mpada 60 W"
    }
  ))), /* @__PURE__ */ React.createElement("section", { className: "chart-row" }, /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "p-head" }, /* @__PURE__ */ React.createElement("h3", { className: "p-title" }, "Monitoramento em Tempo Real"), /* @__PURE__ */ React.createElement("span", { className: "p-badge" }, readings.length, " amostras")), /* @__PURE__ */ React.createElement(RealtimeChart, { readings })), /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "p-head" }, /* @__PURE__ */ React.createElement("h3", { className: "p-title" }, "Log de Eventos")), /* @__PURE__ */ React.createElement(EventLog, { readings, cmdLogs }))), /* @__PURE__ */ React.createElement("section", { className: "analytics" }, /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "p-head" }, /* @__PURE__ */ React.createElement("h3", { className: "p-title" }, "Economia Estimada"), /* @__PURE__ */ React.createElement("span", { className: "p-badge" }, "ref. 60 W cont\xEDnua")), /* @__PURE__ */ React.createElement("div", { className: "an-body" }, /* @__PURE__ */ React.createElement(SavingsRing, { pct: savingsPct }), /* @__PURE__ */ React.createElement("div", { className: "an-stats" }, /* @__PURE__ */ React.createElement("div", { className: "an-row" }, /* @__PURE__ */ React.createElement("span", { className: "an-lab" }, "Consumo real"), /* @__PURE__ */ React.createElement("span", { className: "an-val" }, fmtEnergy(totalKwh))), /* @__PURE__ */ React.createElement("div", { className: "an-row" }, /* @__PURE__ */ React.createElement("span", { className: "an-lab" }, "Refer\xEAncia (60 W)"), /* @__PURE__ */ React.createElement("span", { className: "an-val" }, fmtEnergy(refKwh))), /* @__PURE__ */ React.createElement("div", { className: "an-row an-highlight" }, /* @__PURE__ */ React.createElement("span", { className: "an-lab" }, "Energia economizada"), /* @__PURE__ */ React.createElement("span", { className: "an-val" }, fmtEnergy(savingsKwh))), /* @__PURE__ */ React.createElement("div", { className: "cmp-bars" }, /* @__PURE__ */ React.createElement("div", { className: "cmp-row" }, /* @__PURE__ */ React.createElement("span", { className: "cmp-lab" }, "Refer\xEAncia"), /* @__PURE__ */ React.createElement("div", { className: "cmp-track" }, /* @__PURE__ */ React.createElement("div", { className: "cmp-fill cmp-ref", style: { width: "100%" } }))), /* @__PURE__ */ React.createElement("div", { className: "cmp-row" }, /* @__PURE__ */ React.createElement("span", { className: "cmp-lab" }, "Real"), /* @__PURE__ */ React.createElement("div", { className: "cmp-track" }, /* @__PURE__ */ React.createElement("div", { className: "cmp-fill cmp-real", style: { width: `${refKwh > 0 ? Math.min(100, totalKwh / refKwh * 100) : 0}%` } }))))))), /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "p-head" }, /* @__PURE__ */ React.createElement("h3", { className: "p-title" }, "Consumo & Efici\xEAncia")), /* @__PURE__ */ React.createElement("div", { className: "sl" }, /* @__PURE__ */ React.createElement("div", { className: "sl-row" }, /* @__PURE__ */ React.createElement("span", { className: "sl-lab" }, "Pot\xEAncia m\xE9dia"), /* @__PURE__ */ React.createElement("span", { className: "sl-val" }, fmtNum(avgPower, 2), " W")), /* @__PURE__ */ React.createElement("div", { className: "sl-row" }, /* @__PURE__ */ React.createElement("span", { className: "sl-lab" }, "Pico de pot\xEAncia"), /* @__PURE__ */ React.createElement("span", { className: "sl-val" }, fmtNum(peakPower, 2), " W")), /* @__PURE__ */ React.createElement("div", { className: "sl-row" }, /* @__PURE__ */ React.createElement("span", { className: "sl-lab" }, "Acumulado total"), /* @__PURE__ */ React.createElement("span", { className: "sl-val" }, fmtEnergy(totalKwh))), /* @__PURE__ */ React.createElement("div", { className: "sl-row" }, /* @__PURE__ */ React.createElement("span", { className: "sl-lab" }, "Tempo ligada"), /* @__PURE__ */ React.createElement("span", { className: "sl-val" }, fmtDuration(Math.round(onSeconds)))), /* @__PURE__ */ React.createElement("div", { className: "sl-row" }, /* @__PURE__ */ React.createElement("span", { className: "sl-lab" }, "Intensidade m\xE9dia"), /* @__PURE__ */ React.createElement("span", { className: "sl-val" }, avgPwmPct !== null ? `${avgPwmPct}%` : "--")), /* @__PURE__ */ React.createElement("div", { className: "sl-row" }, /* @__PURE__ */ React.createElement("span", { className: "sl-lab" }, "Leituras com presen\xE7a"), /* @__PURE__ */ React.createElement("span", { className: "sl-val" }, presenceCount, " / ", readings.length))), /* @__PURE__ */ React.createElement("div", { className: "presence-sec" }, /* @__PURE__ */ React.createElement("div", { className: "presence-top" }, /* @__PURE__ */ React.createElement("span", { className: "presence-lab" }, "Detec\xE7\xF5es de presen\xE7a"), /* @__PURE__ */ React.createElement("span", { className: "presence-pct" }, readings.length > 0 ? Math.round(presenceCount / readings.length * 100) : 0, "%")), /* @__PURE__ */ React.createElement("div", { className: "presence-track" }, /* @__PURE__ */ React.createElement("div", { className: "presence-fill", style: { width: `${readings.length > 0 ? presenceCount / readings.length * 100 : 0}%` } }))))), /* @__PURE__ */ React.createElement("footer", { className: "foot" }, /* @__PURE__ */ React.createElement("span", null, "ReciLuz Dashboard \xB7 Atualiza\xE7\xE3o a cada ", REFRESH_MS / 1e3, "s"), /* @__PURE__ */ React.createElement("span", null, "\xDAltima leitura: ", /* @__PURE__ */ React.createElement("strong", null, fmtTime(latest.criada_em)))))));
}
function SiteFooter() {
  return /* @__PURE__ */ React.createElement("footer", { className: "site-foot" }, /* @__PURE__ */ React.createElement("div", { className: "site-foot-inner" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "sf-brand" }, /* @__PURE__ */ React.createElement("span", { className: "bulb" }), " ReciLuz"), /* @__PURE__ */ React.createElement("p", { className: "sf-tag" }, "Plataforma de gest\xE3o inteligente para a ilumina\xE7\xE3o p\xFAblica do Recife. Sensores, dados e controle remoto a servi\xE7o de uma cidade mais segura e eficiente.")), /* @__PURE__ */ React.createElement("div", { className: "sf-col" }, /* @__PURE__ */ React.createElement("h4", null, "Projeto"), /* @__PURE__ */ React.createElement("ul", null, /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement("a", { href: "#sobre" }, "Sobre o sistema")), /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement("a", { href: "#arquitetura" }, "Arquitetura")), /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement("a", { href: "#dashboard" }, "Painel ao vivo")))), /* @__PURE__ */ React.createElement("div", { className: "sf-col" }, /* @__PURE__ */ React.createElement("h4", null, "Documenta\xE7\xE3o"), /* @__PURE__ */ React.createElement("ul", null, /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement("a", { href: "https://github.com/paulo-rago/Projeto-SE-Grupo-8", target: "_blank", rel: "noopener" }, "Reposit\xF3rio GitHub")), /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement("a", { href: "#" }, "API \xB7 Especifica\xE7\xE3o MQTT")), /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement("a", { href: "#" }, "Manual do poste"))))), /* @__PURE__ */ React.createElement("div", { className: "sf-bottom" }, /* @__PURE__ */ React.createElement("span", null, "\xA9 2026 ReciLuz \xB7 Projeto SE \u2014 Grupo 8"), /* @__PURE__ */ React.createElement("span", null, "Recife \xB7 Pernambuco \xB7 Brasil")));
}
function useReveal() {
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) e.target.classList.add("in");
      });
    }, { threshold: 0.15 });
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}
function App() {
  useReveal();
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Hero, null), /* @__PURE__ */ React.createElement(About, null), /* @__PURE__ */ React.createElement(Dashboard, null), /* @__PURE__ */ React.createElement(SiteFooter, null));
}
ReactDOM.createRoot(document.getElementById("root")).render(/* @__PURE__ */ React.createElement(App, null));
