// Papier-Formen: Jedes Element mit der Klasse "paper" bekommt eine leicht ungleichmäßige
// Form – die Ecken sind ein wenig auseinandergezogen bzw. nach oben/unten verschoben,
// bleiben aber abgerundet. Die Form wird als Maske auf ::before (Fläche) und ::after
// (Schatten, "Papier auf Papier") gelegt, die Farbe kommt aus CSS (--fill / --shade).
//
// Elemente mit "torn" bekommen oben eine gerissene Papierkante.
const Paper = (() => {
  let counter = 1;

  // kleiner, reproduzierbarer Zufall pro Element
  function rng(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return () => (s = (s * 16807) % 2147483647) / 2147483647;
  }

  function svgUrl(svg) {
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }

  // Ecke-Punkte mit leichtem Versatz, dann abgerundetes Vieleck
  function shapePath(w, h, seed, radius) {
    const r = rng(seed);
    const jx = Math.min(7, w * 0.035);
    const jy = Math.min(6, h * 0.12);
    const pts = [
      [r() * jx, r() * jy],
      [w - r() * jx, r() * jy],
      [w - r() * jx, h - r() * jy],
      [r() * jx, h - r() * jy],
    ];
    const R = Math.min(radius, h / 2, w / 2);
    let d = '';
    for (let i = 0; i < 4; i++) {
      const p0 = pts[(i + 3) % 4], p1 = pts[i], p2 = pts[(i + 1) % 4];
      const a = toward(p1, p0, R), b = toward(p1, p2, R);
      d += (i === 0 ? `M${a[0]},${a[1]}` : `L${a[0]},${a[1]}`) + `Q${p1[0]},${p1[1]} ${b[0]},${b[1]}`;
    }
    return d + 'Z';
  }
  function toward(p, q, dist) {
    const dx = q[0] - p[0], dy = q[1] - p[1];
    const len = Math.hypot(dx, dy) || 1;
    const t = Math.min(dist, len / 2) / len;
    return [+(p[0] + dx * t).toFixed(2), +(p[1] + dy * t).toFixed(2)];
  }

  function shape(el) {
    const w = el.offsetWidth, h = el.offsetHeight;
    if (!w || !h) return;
    if (!el._seed) el._seed = (counter++ * 7919) % 100000 + 17;
    const radius = parseFloat(getComputedStyle(el).getPropertyValue('--radius')) || 18;
    const d = shapePath(w, h, el._seed, radius);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path d="${d}" fill="#000"/></svg>`;
    el.style.setProperty('--shape', svgUrl(svg));
  }

  // Gerissene Kante: Zacken in unregelmäßigen Abständen und Höhen
  function tornEdge(el) {
    const w = Math.max(el.offsetWidth, 320);
    if (!el._seed) el._seed = (counter++ * 7919) % 100000 + 17;
    const r = rng(el._seed);
    const H = 40;
    let x = 0, d = `M0,${H} L0,${(12 + r() * 20).toFixed(1)}`;
    while (x < w) {
      const step = 28 + r() * 46;
      const mid = x + step * (0.35 + r() * 0.3);
      d += ` L${mid.toFixed(1)},${(r() * 10).toFixed(1)} L${(x + step).toFixed(1)},${(18 + r() * 22).toFixed(1)}`;
      x += step;
    }
    d += ` L${w},${H} Z`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${H}" viewBox="0 0 ${w} ${H}" preserveAspectRatio="none"><path d="${d}" fill="#000"/></svg>`;
    el.style.setProperty('--torn', svgUrl(svg));
  }

  const ro = new ResizeObserver((entries) => {
    for (const e of entries) {
      if (e.target.classList.contains('paper')) shape(e.target);
      if (e.target.classList.contains('torn')) tornEdge(e.target);
    }
  });

  function apply(root = document) {
    root.querySelectorAll('.paper, .torn').forEach((el) => {
      if (el._papered) return;
      el._papered = true;
      ro.observe(el);
    });
  }

  // Neue Elemente (Menüs, Dialoge, Statistik) automatisch erfassen
  new MutationObserver(() => apply()).observe(document.body, { childList: true, subtree: true });
  apply();

  return { apply };
})();
