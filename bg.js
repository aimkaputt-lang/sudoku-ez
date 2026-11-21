// Hintergrund im Papier-Stil: gepunktetes Papier.
//
// Die Punkte sitzen in einem lockeren Raster, jeder leicht versetzt und unterschiedlich groß,
// damit es nach echtem Papier aussieht. Mit dem Spielfortschritt (0..1) werden nach und nach
// zufällige Punkte "eingefärbt" – wie mit Tinte ausgemalt. Jeder Punkt hat eine feste Farbe
// (Rot #e2104c, Grün #4fc96b oder Lila #c083dd), die sich nicht mehr ändert.
// Im Notizmodus wird alles grauer.
const Bg = (() => {
  const cv = document.getElementById('bg');
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1, raf = 0;
  let target = 0, p = 0;
  let grey = 0, greyTarget = 0;
  let dots = [];
  let dirty = true;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  const PAPER = [245, 243, 238];
  const PAPER_GREY = [234, 233, 230];
  const DOT = [226, 223, 216];

  // Feste Tintenfarben: jeder Punkt bekommt eine davon und behält sie
  const INKS = [
    [226, 16, 76],   // #e2104c Rot
    [79, 201, 107],  // #4fc96b Grün
    [192, 131, 221], // #c083dd Lila
  ];
  const mixRgb = (a, b, t) => a.map((v, i) => Math.round(lerp(v, b[i], t)));
  const toGrey = (c, g) => {
    const l = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
    return c.map((v) => Math.round(lerp(v, l, g)));
  };
  // für die Welle in app.js (wird dort nicht mehr für Farben genutzt)
  function inkHue() { return 0; }

  // Zufall mit festem Startwert, damit das Punktmuster immer gleich aussieht
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
        dots.push({
          x: x + (r() - 0.5) * 5,
          y: y + (r() - 0.5) * 5,
          s: 1.6 + r() * 1.6,
          rank: r(),                     // ab welchem Fortschritt der Punkt eingefärbt wird
          ink: INKS[Math.floor(r() * 3)], // feste Farbe des Punkts
        });
      }
    }
    dirty = true;
  }

  const parts = [];
  const ripples = [];

  function frame() {
    const dp = (target - p) * 0.01;
    const dg = (greyTarget - grey) * 0.08;
    const moving = Math.abs(dp) > 0.0002 || Math.abs(dg) > 0.001 || parts.length || ripples.length;
    p += dp; grey += dg;

    if (moving || dirty) {
      dirty = false;
      const paper = PAPER.map((v, i) => Math.round(lerp(v, PAPER_GREY[i], grey)));
      ctx.fillStyle = `rgb(${paper})`;
      ctx.fillRect(0, 0, W, H);

      for (const d of dots) {
        const ink = clamp((p - d.rank * 0.98) * 14, 0, 1);
        ctx.beginPath();
        if (ink <= 0) {
          ctx.fillStyle = `rgb(${DOT})`;
          ctx.arc(d.x, d.y, d.s, 0, Math.PI * 2);
        } else {
          // vom grauen Punkt weich zur festen Farbe; im Notizmodus wieder grau
          ctx.fillStyle = `rgb(${toGrey(mixRgb(DOT, d.ink, ink), grey)})`;
          ctx.arc(d.x, d.y, d.s * (1 + ink * 0.45), 0, Math.PI * 2);
        }
        ctx.fill();
      }

      // Tintenspritzer bei richtigen Zahlen
      for (let i = parts.length - 1; i >= 0; i--) {
        const q = parts[i];
        q.life -= 1 / 60;
        if (q.life <= 0) { parts.splice(i, 1); continue; }
        q.vx *= 0.9; q.vy *= 0.9;
        q.x += q.vx; q.y += q.vy;
        const a = Math.min(1, q.life / q.max * 1.6);
        ctx.fillStyle = `rgba(${toGrey(q.color, grey)},${a * 0.9})`;
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
        ctx.strokeStyle = `rgba(29,29,27,${r.life * 0.12})`;
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
  start();

  return {
    setProgress(v) { target = clamp(v, 0, 1); },
    jump(v) { target = p = clamp(v, 0, 1); dirty = true; },
    get hue() { return inkHue(); },
    setGrey(on) { greyTarget = on ? 1 : 0; },
    ripple(x, y) { if (ripples.length < 6) ripples.push({ x, y, r: 3, life: 1 }); },
    burst(x, y, n = 12, hue) {
      // Tintenspritzer in den drei festen Farben
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 5;
        parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          color: INKS[Math.floor(Math.random() * 3)], size: 1.2 + Math.random() * 2.6,
          life: 0.6 + Math.random() * 0.5, max: 1.1 });
      }
    },
    celebrate() {
      target = 1;
      for (let k = 0; k < 6; k++) {
        setTimeout(() => this.burst(W * (0.15 + Math.random() * 0.7), H * (0.12 + Math.random() * 0.45), 36), k * 200);
      }
    },
  };
})();
