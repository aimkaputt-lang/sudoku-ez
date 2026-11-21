// Hintergrund im Papier-Stil: gepunktetes Papier, das mit dem Fortschritt die Farbe wechselt.
//
// Immer nur EINE Farbe auf einmal – Fläche und Punkte zusammen. Die Punkte sind dabei
// immer etwas dunkler als die Fläche.
//
//   0 – 25 %   Papier (creme)
//  25 – 50 %   Rot    #e2104c
//  50 – 75 %   Grün   #4fc96b
//  75 – 100 %  Lila   #c083dd
//
// Der Wechsel passiert weich über etwa eine Sekunde. Im Notizmodus wird alles grauer.
const Bg = (() => {
  const cv = document.getElementById('bg');
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1, raf = 0;
  let target = 0;
  let grey = 0, greyTarget = 0;
  let dots = [];
  let dirty = true;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  const STAGES = [
    { at: 0.00, color: [245, 243, 238] }, // Papier
    { at: 0.25, color: [226, 16, 76] },   // Rot
    { at: 0.50, color: [79, 201, 107] },  // Grün
    { at: 0.75, color: [192, 131, 221] }, // Lila
  ];
  const DOT_DARKEN = 0.9;  // Punkte = Fläche × 0.9 (etwas dunkler)
  const SPARK_DARKEN = 0.55;

  function stageOf(v) {
    let s = 0;
    for (let i = 0; i < STAGES.length; i++) if (v >= STAGES[i].at) s = i;
    return s;
  }
  let stage = 0;
  let cur = STAGES[0].color.slice();   // aktuell gezeigte Farbe (gleitet zur Zielfarbe)

  const toGrey = (c, g) => {
    const l = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
    return c.map((v) => Math.round(lerp(v, l, g)));
  };
  const darken = (c, f) => c.map((v) => Math.round(v * f));

  function rng(seed) {
    let s = seed;
    return () => (s = (s * 16807) % 2147483647) / 2147483647;
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.__appH || window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const r = rng(4242);
    const gap = 26;
    dots = [];
    for (let y = gap / 2; y < H + gap; y += gap) {
      for (let x = gap / 2; x < W + gap; x += gap) {
        dots.push({ x: x + (r() - 0.5) * 5, y: y + (r() - 0.5) * 5, s: 1.6 + r() * 1.6 });
      }
    }
    dirty = true;
  }

  const parts = [];
  const ripples = [];

  function setStage(s) {
    if (s === stage) return;
    stage = s;
    document.documentElement.dataset.bg = s; // für lesbare Texte auf farbigem Grund (style.css)
  }

  function frame() {
    const goal = STAGES[stage].color;
    let moving = false;
    for (let i = 0; i < 3; i++) {
      const d = goal[i] - cur[i];
      if (Math.abs(d) > 0.3) { cur[i] += d * 0.05; moving = true; } else cur[i] = goal[i];
    }
    const dg = (greyTarget - grey) * 0.08;
    if (Math.abs(dg) > 0.001) moving = true;
    grey += dg;
    if (parts.length || ripples.length) moving = true;

    if (moving || dirty) {
      dirty = false;
      const base = toGrey(cur.map(Math.round), grey);
      ctx.fillStyle = `rgb(${base})`;
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = `rgb(${darken(base, DOT_DARKEN)})`;
      for (const d of dots) {
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.s, 0, Math.PI * 2);
        ctx.fill();
      }

      // Tintenspritzer bei richtigen Zahlen: dunklere Variante der aktuellen Farbe
      const spark = darken(base, SPARK_DARKEN);
      for (let i = parts.length - 1; i >= 0; i--) {
        const q = parts[i];
        q.life -= 1 / 60;
        if (q.life <= 0) { parts.splice(i, 1); continue; }
        q.vx *= 0.9; q.vy *= 0.9;
        q.x += q.vx; q.y += q.vy;
        const a = Math.min(1, q.life / q.max * 1.6);
        ctx.fillStyle = `rgba(${spark},${a * 0.9})`;
        ctx.beginPath();
        ctx.arc(q.x, q.y, q.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Kreise beim Antippen
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.life -= 1 / 40;
        if (r.life <= 0) { ripples.splice(i, 1); continue; }
        r.r += 2.5 + (1 - r.life) * 3;
        ctx.strokeStyle = `rgba(29,29,27,${r.life * 0.14})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    raf = requestAnimationFrame(frame);
  }

  function start() { if (!raf) raf = requestAnimationFrame(frame); }
  function stop() { cancelAnimationFrame(raf); raf = 0; }

  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  resize();
  document.documentElement.dataset.bg = 0;
  start();

  return {
    setProgress(v) { target = clamp(v, 0, 1); setStage(stageOf(target)); },
    jump(v) { target = clamp(v, 0, 1); setStage(stageOf(target)); cur = STAGES[stage].color.slice(); dirty = true; },
    get hue() { return 0; },
    setGrey(on) { greyTarget = on ? 1 : 0; },
    ripple(x, y) { if (ripples.length < 6) ripples.push({ x, y, r: 3, life: 1 }); },
    burst(x, y, n = 12) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 5;
        parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          size: 1.2 + Math.random() * 2.6, life: 0.6 + Math.random() * 0.5, max: 1.1 });
      }
    },
    celebrate() {
      for (let k = 0; k < 6; k++) {
        setTimeout(() => this.burst(W * (0.15 + Math.random() * 0.7), H * (0.12 + Math.random() * 0.45), 36), k * 200);
      }
    },
  };
})();
