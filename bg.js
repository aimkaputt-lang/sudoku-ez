// Interaktiver Hintergrund: ruhig, aber die Farbe wandert mit dem Spielfortschritt (0..1).
//
//   0 %  fast schwarzes Graublau
//  33 %  Blau
//  66 %  Violett
// 100 %  Pink
//
// Dazu kleine, langsam funkelnde Sterne (ab ~12 %). Farbwechsel passieren sehr weich
// über mehrere Sekunden, damit man sich weiter konzentrieren kann.
const Bg = (() => {
  const cv = document.getElementById('bg');
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1, raf = 0;
  let target = 0, p = 0;
  const t0 = performance.now();

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  // ---------- Farbwelt ----------
  // top/bottom: Verlauf des Grundes · hue/sat: Farbton und Sättigung der Lichter
  const PALETTE = [
    { at: 0.00, top: [20, 24, 34],  bottom: [7, 9, 15],   hue: 220, sat: 25 },
    { at: 0.33, top: [20, 34, 76],  bottom: [6, 11, 30],  hue: 222, sat: 70 },
    { at: 0.66, top: [44, 24, 86],  bottom: [13, 8, 33],  hue: 268, sat: 70 },
    { at: 1.00, top: [74, 20, 68],  bottom: [22, 6, 29],  hue: 320, sat: 72 },
  ];
  function palette() {
    let a = PALETTE[0], b = PALETTE[PALETTE.length - 1];
    for (let i = 0; i < PALETTE.length - 1; i++) {
      if (p >= PALETTE[i].at && p <= PALETTE[i + 1].at) { a = PALETTE[i]; b = PALETTE[i + 1]; break; }
    }
    const t = (p - a.at) / (b.at - a.at || 1);
    const mix = (x, y) => x.map((v, i) => Math.round(lerp(v, y[i], t)));
    // Notizmodus: Farbe weich zu Grau entsättigen
    const toGrey = (c) => {
      const l = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
      return c.map((v) => Math.round(lerp(v, l, grey)));
    };
    return { top: toGrey(mix(a.top, b.top)), bottom: toGrey(mix(a.bottom, b.bottom)),
             hue: lerp(a.hue, b.hue, t), sat: lerp(a.sat, b.sat, t) * (1 - grey) };
  }
  let grey = 0, greyTarget = 0;
  const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;

  // ---------- Elemente ----------
  const OFFSETS = [0, 18, -25, 35, -40]; // Farbabstand der Lichter zum Grundton
  const orbs = OFFSETS.map((off) => ({
    off,
    x: Math.random(), y: Math.random(),
    r: 0.4 + Math.random() * 0.35,
    sx: 0.03 + Math.random() * 0.05,
    sy: 0.03 + Math.random() * 0.04,
    ph: Math.random() * Math.PI * 2,
  }));
  const stars = Array.from({ length: 90 }, () => ({
    x: Math.random(), y: Math.random(),
    s: Math.random() * 1.1 + 0.3,
    ph: Math.random() * Math.PI * 2,
    th: 0.12 + Math.random() * 0.75,   // ab welchem Fortschritt der Stern erscheint
  }));
  const parts = [];    // Funken bei richtigen Zahlen
  const ripples = [];  // Wellen beim Antippen

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ---------- Zeichnen ----------
  function frame(now) {
    const t = (now - t0) / 1000;
    p += (target - p) * 0.006;           // sehr weicher Übergang (einige Sekunden)
    grey += (greyTarget - grey) * 0.06;  // Notizmodus: in etwa einer halben Sekunde grau
    const pal = palette();
    const m = Math.max(W, H);

    // Grundverlauf
    ctx.globalCompositeOperation = 'source-over';
    const g = ctx.createLinearGradient(0, 0, W * 0.4, H);
    g.addColorStop(0, rgb(pal.top));
    g.addColorStop(1, rgb(pal.bottom));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Weiche farbige Lichter, die langsam wandern
    ctx.globalCompositeOperation = 'lighter';
    for (const o of orbs) {
      const a = 0.05 + 0.15 * p;
      const x = (o.x + Math.sin(t * o.sx + o.ph) * 0.25) * W;
      const y = (o.y + Math.cos(t * o.sy + o.ph * 1.3) * 0.25) * H;
      const r = o.r * m;
      const hue = pal.hue + o.off * (0.3 + p * 0.7);
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, `hsla(${hue},${pal.sat}%,55%,${a})`);
      rg.addColorStop(1, `hsla(${hue},${pal.sat}%,55%,0)`);
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, W, H);
    }

    // Kleine, langsam funkelnde Sterne
    if (p > 0.1) {
      for (const s of stars) {
        const vis = clamp((p - s.th) * 6, 0, 1);
        if (vis <= 0) continue;
        const tw = 0.45 + 0.55 * Math.sin(t * 1.2 + s.ph);
        ctx.fillStyle = `hsla(${pal.hue},40%,92%,${vis * tw * 0.75})`;
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H, s.s, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Funken
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i];
      q.life -= 1 / 60;
      if (q.life <= 0) { parts.splice(i, 1); continue; }
      q.vx *= 0.97; q.vy = q.vy * 0.97 + 0.04;
      q.x += q.vx; q.y += q.vy;
      const a = q.life / q.max;
      ctx.fillStyle = `hsla(${q.hue},90%,65%,${a})`;
      ctx.beginPath();
      ctx.arc(q.x, q.y, q.size * (0.5 + a * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }

    // Wellen
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      r.life -= 1 / 45;
      if (r.life <= 0) { ripples.splice(i, 1); continue; }
      r.r += 3 + (1 - r.life) * 4;
      ctx.strokeStyle = `hsla(${pal.hue},80%,72%,${r.life * 0.28})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Vignette, damit das Spielfeld lesbar bleibt
    ctx.globalCompositeOperation = 'source-over';
    const v = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.25, W / 2, H * 0.45, m * 0.8);
    v.addColorStop(0, 'rgba(4,4,10,0)');
    v.addColorStop(1, 'rgba(4,4,10,0.55)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);

    raf = requestAnimationFrame(frame);
  }

  function start() { if (!raf) raf = requestAnimationFrame(frame); }
  function stop() { cancelAnimationFrame(raf); raf = 0; }

  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  resize();
  start();

  return {
    setProgress(v) { target = clamp(v, 0, 1); },
    jump(v) { target = p = clamp(v, 0, 1); }, // sofort, ohne Übergang (zum Testen)
    get hue() { return palette().hue; },
    setGrey(on) { greyTarget = on ? 1 : 0; },
    ripple(x, y) { if (ripples.length < 8) ripples.push({ x, y, r: 4, life: 1 }); },
    burst(x, y, n = 14, hue) {
      const h = hue == null ? palette().hue : hue;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * 3.5;
        parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.5,
          hue: h + Math.random() * 50 - 25, size: 1.5 + Math.random() * 2.5,
          life: 0.7 + Math.random() * 0.6, max: 1.3 });
      }
    },
    celebrate() {
      target = 1;
      for (let k = 0; k < 6; k++) {
        setTimeout(() => this.burst(W * (0.15 + Math.random() * 0.7), H * (0.15 + Math.random() * 0.5),
          40, [320, 268, 222, 300, 45, 340][k]), k * 220);
      }
    },
  };
})();
