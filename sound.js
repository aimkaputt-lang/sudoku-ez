// Sounds: alle Töne werden live im Browser erzeugt (Web Audio), es gibt keine Sounddateien.
// Klangidee: weich und holzig wie eine kleine Marimba, passend zum Papier-Stil.
//
// iOS spielt Web-Audio erst nach einer Berührung ab – deshalb wird der Audio-Kontext
// beim ersten Antippen "aufgeweckt". Ist der Lautlos-Schalter am iPhone an, bleibt alles stumm.
const Snd = (() => {
  let ctx = null, master = null;
  let enabled = true;

  // Pentatonische Töne für die Ziffern 1–9 (C-Dur-Pentatonik), klingt immer harmonisch
  const NOTES = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98];

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  // Beim ersten Berühren aufwecken (iOS-Vorgabe)
  ['pointerdown', 'touchstart', 'keydown'].forEach((t) =>
    window.addEventListener(t, () => { if (enabled) ensure(); }, { passive: true }));

  // Ein Marimba-artiger Ton: Grundton + leiser Oberton, schnelles Ausklingen
  function marimba(freq, when = 0, vol = 0.5, len = 0.35) {
    if (!enabled || !ensure()) return;
    const t = ctx.currentTime + when;
    [[1, vol], [4, vol * 0.12]].forEach(([mul, v], k) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq * mul;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (k ? len * 0.4 : len));
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + len + 0.05);
    });
  }

  // Kurzes Papier-Ticken: gefiltertes Rauschen
  let noiseBuf = null;
  function tick(vol = 0.25, freq = 2400) {
    if (!enabled || !ensure()) return;
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    }
    const src = ctx.createBufferSource();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    src.buffer = noiseBuf;
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = 1.2;
    g.gain.value = vol;
    src.connect(f).connect(g).connect(master);
    src.start();
  }

  // Dumpfer, kurzer Ton für Fehler (gleitet nach unten)
  function thud() {
    if (!enabled || !ensure()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(110, t + 0.22);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.45, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 0.3);
  }

  return {
    setEnabled(v) { enabled = !!v; if (enabled) ensure(); },
    tap() { tick(0.22, 2600); },                         // Buttons
    soft() { tick(0.14, 1800); },                        // Notiz, Radieren, Rückgängig
    digit(n) { marimba(NOTES[(n - 1) % 9], 0, 0.42); },   // richtige Zahl – Tonhöhe je Ziffer
    wrong() { thud(); },
    hint() { marimba(1318.51, 0, 0.3, 0.25); marimba(1760, 0.07, 0.25, 0.3); },
    // Fertige Reihe/Spalte/Block: kleines aufsteigendes Arpeggio, läuft mit der Welle
    group(count = 1) {
      const seq = [523.25, 659.25, 783.99, 1046.5];
      const n = Math.min(seq.length, 2 + count);
      for (let i = 0; i < n; i++) marimba(seq[i], i * 0.07, 0.32, 0.4);
    },
    win() {
      const seq = [523.25, 659.25, 783.99, 1046.5, 1318.51];
      seq.forEach((f, i) => marimba(f, i * 0.09, 0.38, 0.5));
      [523.25, 659.25, 783.99].forEach((f) => marimba(f, 0.55, 0.22, 1.1));
    },
    lose() { [392, 329.63, 261.63].forEach((f, i) => marimba(f, i * 0.14, 0.35, 0.45)); },
  };
})();
