(() => {
  'use strict';

  // ---------- Einstellungen ----------
  const LEVELS = [
    { name: 'Kinderleicht',   desc: 'Zum Aufwärmen',          clues: 46, mult: 1,   par: 8,  color: '#4ade80' },
    { name: 'Mittelschlecht', desc: 'Ein bisschen Denken',    clues: 38, mult: 1.5, par: 12, color: '#a3e635' },
    { name: 'Der Profi',      desc: 'Für Kenner',             clues: 32, mult: 2,   par: 18, color: '#facc15' },
    { name: 'Gehirnjogging',  desc: 'Ab jetzt wird’s ernst',  clues: 27, mult: 3,   par: 25, color: '#fb923c' },
    { name: 'Traumatherapie', desc: 'Viel Glück.',            clues: 23, mult: 4,   par: 35, color: '#e2104c' },
  ];
  const SAVE_KEY = 'sudoku-save-v1';
  const BEST_KEY = 'sudoku-best-v1';
  const STATS_KEY = 'sudoku-stats-v1'; // { [stufe]: { solved, bestTime, totalTime, noHint } }

  const $ = (s) => document.querySelector(s);
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  };

  // ---------- Antippen ----------
  // Ein Button löst erst beim Loslassen aus, und nur wenn der Finger noch darauf ist.
  // Zieht man den Finger herunter, wird der Druck abgebrochen (falls man sich vertippt hat).
  const SLOP = 12; // Pixel Spielraum am Rand
  function tap(el, fn) {
    let id = null;
    const inside = (e) => {
      const r = el.getBoundingClientRect();
      return e.clientX >= r.left - SLOP && e.clientX <= r.right + SLOP &&
             e.clientY >= r.top - SLOP && e.clientY <= r.bottom + SLOP;
    };
    const end = () => { id = null; el.classList.remove('pressed'); };
    el.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      id = e.pointerId;
      el.classList.add('pressed');
      try { el.setPointerCapture(id); } catch {}
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId === id) el.classList.toggle('pressed', inside(e));
    });
    el.addEventListener('pointerup', (e) => {
      if (e.pointerId !== id) return;
      const ok = inside(e);
      end();
      if (ok) fn(e);
    });
    el.addEventListener('pointercancel', end);
    // Tastatur (Enter / Leertaste) am PC
    el.addEventListener('click', (e) => { if (e.detail === 0) fn(e); });
  }

  // ---------- Zustand ----------
  let G = null;          // aktuelles Spiel
  let sel = -1;          // ausgewähltes Feld
  let notesMode = false;
  let history = [];
  let running = false, lastTick = 0, lastSave = 0, timerId = 0, resumeOnVisible = false;
  const flashUntil = new Array(81).fill(0);
  const flashDelay = new Array(81).fill(0);
  const flashBig = new Array(81).fill(false);
  let restartFlash = false;

  const boardEl = $('#board');
  const cells = [];
  const keys = [];

  // ---------- Aufbau ----------
  function buildBoard() {
    for (let b = 0; b < 9; b++) {
      const box = document.createElement('div');
      box.className = 'box';
      for (let k = 0; k < 9; k++) {
        const r = Math.floor(b / 3) * 3 + Math.floor(k / 3);
        const c = (b % 3) * 3 + (k % 3);
        const i = r * 9 + c;
        const el = document.createElement('div');
        el.className = 'cell';
        el.dataset.i = i;
        box.appendChild(el);
        cells[i] = el;
      }
      boardEl.appendChild(box);
    }
    boardEl.addEventListener('pointerdown', (e) => {
      const el = e.target.closest('.cell');
      if (el) select(+el.dataset.i);
    });
  }

  function buildNumpad() {
    const pad = $('#numpad');
    for (let n = 1; n <= 9; n++) {
      const b = document.createElement('button');
      b.className = 'key paper';
      b.textContent = n;
      tap(b, () => input(n));
      pad.appendChild(b);
      keys[n] = b;
    }
  }

  function buildMenu() {
    const wrap = $('#levels');
    wrap.innerHTML = '';
    const best = store.get(BEST_KEY) || {};
    LEVELS.forEach((L, idx) => {
      const b = document.createElement('button');
      b.className = 'paper btn level';
      b.innerHTML = `
        <span class="dot" style="background:${L.color};box-shadow:0 0 12px ${L.color}"></span>
        <span class="level-text"><span class="level-title">${L.name}</span><span class="level-desc">${L.desc}</span></span>
        <span class="level-best">${best[idx] ? '★ ' + best[idx] : ''}</span>`;
      tap(b, () => requestNewGame(idx));
      wrap.appendChild(b);
    });
    const saved = store.get(SAVE_KEY);
    const rb = $('#resumeBtn');
    if (saved) {
      rb.classList.remove('hidden');
      $('#resumeInfo').textContent = `${LEVELS[saved.level].name} · ${fmtTime(saved.elapsed)} · ${Math.round(progressOf(saved) * 100)} %`;
    } else rb.classList.add('hidden');
  }

  // ---------- Bildschirme ----------
  function show(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
    if (id === 'menu') { buildMenu(); menuView('main'); }
    if (id === 'stats') buildStats();
    if (id !== 'game') { Bg.setProgress(0); Bg.setGrey(false); }
    // Leiste unten nur auf Menü und Statistik
    const bar = $('#tabbar');
    bar.classList.toggle('hidden-bar', id === 'game');
    bar.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === id));
    bar.dataset.active = id;
  }

  // ---------- Statistik ----------
  function statOf(stats, level) {
    const s = Object.assign({ started: 0, solved: 0, perfect: 0, bestTime: 0, totalTime: 0 }, stats[level]);
    s.started = Math.max(s.started, s.solved); // ältere Daten hatten noch keinen Start-Zähler
    return s;
  }
  function recordStart(level) {
    const stats = store.get(STATS_KEY) || {};
    const s = statOf(stats, level);
    s.started++;
    stats[level] = s;
    store.set(STATS_KEY, stats);
  }
  function recordWin(g) {
    const stats = store.get(STATS_KEY) || {};
    const s = statOf(stats, g.level);
    s.solved++;
    s.totalTime += g.elapsed;
    if (!s.bestTime || g.elapsed < s.bestTime) s.bestTime = g.elapsed;
    if (!g.mistakes) s.perfect++;
    stats[g.level] = s;
    store.set(STATS_KEY, stats);
  }

  // Statistik: pro Schwierigkeit eine Seite, wischbar; oben die Stufen zum Antippen
  let statIdx = 0;
  function buildStats() {
    const stats = store.get(STATS_KEY) || {};
    const best = store.get(BEST_KEY) || {};
    const row = (label, value, extra = '') =>
      `<div class="srow"><span>${label}</span><b>${value}</b></div>${extra}`;

    $('#statChips').innerHTML = LEVELS.map((L, i) =>
      `<button class="paper chip" data-i="${i}"><span class="dot" style="background:${L.color}"></span>${L.name}</button>`).join('');

    $('#statSlides').innerHTML = LEVELS.map((L, i) => {
      const s = statOf(stats, i);
      const rate = s.started ? Math.round((s.solved / s.started) * 100) : 0;
      return `
        <div class="slide">
          <div class="sgroup paper">
            <h3>Spiele</h3>
            ${row('Gestartete Spiele', s.started)}
            ${row('Gewonnene Spiele', s.solved)}
            ${row('Gewinnrate', s.started ? rate + ' %' : '–',
              `<div class="stat-bar"><span style="width:${rate}%;background:${L.color}"></span></div>`)}
            ${row('Fehlerfrei gewonnen', s.perfect)}
          </div>
          <div class="sgroup paper">
            <h3>Rekorde</h3>
            ${row('Bestpunktzahl', best[i] || '–')}
            ${row('Beste Zeit', s.bestTime ? fmtTime(s.bestTime) : '–')}
            ${row('Durchschnittszeit', s.solved ? fmtTime(s.totalTime / s.solved) : '–')}
          </div>
        </div>`;
    }).join('');

    document.querySelectorAll('#statChips .chip').forEach((c) => tap(c, () => goStat(+c.dataset.i, true)));
    requestAnimationFrame(() => goStat(statIdx, false));
  }

  function goStat(i, smooth) {
    const slides = $('#statSlides');
    slides.scrollTo({ left: i * slides.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
    markStat(i);
  }
  function markStat(i) {
    statIdx = i;
    document.querySelectorAll('#statChips .chip').forEach((c, k) => {
      const on = k === i;
      if (on && !c.classList.contains('active')) c.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
      c.classList.toggle('active', on);
    });
  }
  // Beim Wischen die passende Stufe oben markieren
  $('#statSlides').addEventListener('scroll', () => {
    const el = $('#statSlides');
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== statIdx) markStat(i);
  }, { passive: true });

  // Hauptmenü hat zwei Ansichten: Start-Ansicht und Schwierigkeitsauswahl
  function menuView(v) {
    const open = v === 'levels';
    $('#menu').classList.toggle('pick', open);
    $('#startBtn').textContent = open ? 'Abbrechen' : 'Neues Spiel';
  }

  // ---------- Spielstart ----------
  function requestNewGame(level) {
    if (store.get(SAVE_KEY)) {
      modal(`<h2>Neues Spiel?</h2><p>Dein pausiertes Spiel geht dabei verloren.</p>
        <button class="paper btn sheet-btn primary" data-act="ok">Neues Spiel starten</button>
        <button class="paper btn sheet-btn ghost" data-act="cancel">Abbrechen</button>`,
        { ok: () => newGame(level) });
    } else newGame(level);
  }

  function newGame(level) {
    $('#loading').classList.remove('hidden');
    setTimeout(() => {
      const { puzzle, solution } = Sudoku.generate(LEVELS[level].clues);
      G = {
        level, puzzle, solution,
        values: puzzle.slice(),
        notes: new Array(81).fill(0),
        hint: new Array(81).fill(0),
        scored: new Array(81).fill(0),
        mistakes: 0, hints: 0, score: 0, elapsed: 0,
      };
      recordStart(level);
      $('#loading').classList.add('hidden');
      enterGame();
    }, 50);
  }

  function resumeGame() {
    const saved = store.get(SAVE_KEY);
    if (!saved) return;
    G = saved;
    enterGame();
  }

  function restartGame() {
    G.values = G.puzzle.slice();
    G.notes.fill(0); G.hint.fill(0); G.scored.fill(0);
    G.mistakes = 0; G.hints = 0; G.score = 0; G.elapsed = 0;
    recordStart(G.level);
    enterGame();
  }

  function enterGame() {
    sel = -1; notesMode = false; history = [];
    $('#levelName').textContent = LEVELS[G.level].name;
    show('game');
    render();
    save();
    startTimer();
  }

  // ---------- Timer ----------
  function fmtTime(ms) {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const mm = String(m).padStart(2, '0'), ss = String(sec).padStart(2, '0');
    return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }
  function tick() {
    if (!running) return;
    const now = performance.now();
    G.elapsed += now - lastTick;
    lastTick = now;
    $('#timer').textContent = fmtTime(G.elapsed);
    if (now - lastSave > 5000) save();
  }
  function startTimer() {
    running = true;
    lastTick = performance.now();
    clearInterval(timerId);
    timerId = setInterval(tick, 250);
    $('#timer').textContent = fmtTime(G.elapsed);
  }
  function stopTimer() {
    tick();
    running = false;
    clearInterval(timerId);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (running) { stopTimer(); save(); resumeOnVisible = true; }
    } else if (resumeOnVisible) {
      resumeOnVisible = false;
      startTimer();
    }
  });

  // ---------- Speichern ----------
  function save() {
    if (!G) return;
    lastSave = performance.now();
    store.set(SAVE_KEY, G);
  }

  // ---------- Hilfsfunktionen ----------
  const rowOf = (i) => (i / 9) | 0;
  const colOf = (i) => i % 9;
  const boxOf = (i) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);
  function peers(i) {
    const r = rowOf(i), c = colOf(i), b = boxOf(i), out = [];
    for (let k = 0; k < 81; k++) if (k !== i && (rowOf(k) === r || colOf(k) === c || boxOf(k) === b)) out.push(k);
    return out;
  }
  function progressOf(g) {
    let empty = 0, done = 0;
    for (let i = 0; i < 81; i++) {
      if (g.puzzle[i]) continue;
      empty++;
      if (g.values[i] === g.solution[i]) done++;
    }
    return empty ? done / empty : 0;
  }
  function correct(i) { return G.values[i] !== 0 && G.values[i] === G.solution[i]; }

  function pushHistory() {
    history.push({ values: G.values.slice(), notes: G.notes.slice(), hint: G.hint.slice() });
    if (history.length > 200) history.shift();
  }

  function cellCenter(i) {
    const r = cells[i].getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  }

  let toastTimer = 0;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
  }

  // ---------- Aktionen ----------
  function select(i) {
    sel = i;
    render();
  }

  function input(n) {
    if (!G) return;
    if (sel < 0) { toast('Tippe zuerst auf ein Feld'); return; }
    const i = sel;
    if (G.puzzle[i] || correct(i)) return;

    if (notesMode) {
      if (G.values[i]) return;
      pushHistory();
      G.notes[i] ^= 1 << n;
      save(); render();
      return;
    }
    if (G.values[i] === n) return;

    pushHistory();
    G.values[i] = n;
    G.notes[i] = 0;
    const m = LEVELS[G.level].mult;

    if (n !== G.solution[i]) {
      G.mistakes++;
      G.score = Math.max(0, G.score - Math.round(5 * m));
      cells[i].classList.remove('shake');
      void cells[i].offsetWidth;
      cells[i].classList.add('shake');
    } else {
      if (!G.scored[i]) { G.scored[i] = 1; G.score += Math.round(10 * m); }
      placedCorrect(i, n);
    }
    save(); render(); checkWin(i);
  }

  // Nach einer richtigen Zahl: Notizen bei Nachbarn entfernen, fertige Gruppen feiern
  function placedCorrect(i, n) {
    for (const k of peers(i)) G.notes[k] &= ~(1 << n);
    const [x, y] = cellCenter(i);
    const groups = [];
    const r = rowOf(i), c = colOf(i), b = boxOf(i);
    const rowCells = [], colCells = [], boxCells = [];
    for (let k = 0; k < 81; k++) {
      if (rowOf(k) === r) rowCells.push(k);
      if (colOf(k) === c) colCells.push(k);
      if (boxOf(k) === b) boxCells.push(k);
    }
    for (const grp of [rowCells, colCells, boxCells]) if (grp.every(correct)) groups.push(grp);
    Bg.burst(x, y, groups.length ? 26 : 12);
    if (groups.length) wave(i, groups.flat(), false);
  }

  // Welle: startet am eingegebenen Feld und läuft von dort Feld für Feld nach außen.
  // Reihe/Spalte: in beide Richtungen · Block und ganzes Spiel: ringförmig
  const WAVE_STEP = 60, WAVE_LEN = 650;
  function wave(origin, list, big) {
    const r0 = rowOf(origin), c0 = colOf(origin), now = Date.now();
    let maxDelay = 0;
    for (const k of new Set(list)) {
      const d = Math.max(Math.abs(rowOf(k) - r0), Math.abs(colOf(k) - c0));
      const delay = d * WAVE_STEP;
      // Liegt ein Feld in mehreren fertigen Gruppen, zählt die frühere Welle
      if (flashUntil[k] > now && flashDelay[k] <= delay) continue;
      flashDelay[k] = delay;
      flashUntil[k] = now + delay + WAVE_LEN;
      flashBig[k] = big;
      maxDelay = Math.max(maxDelay, delay);
    }
    document.documentElement.style.setProperty('--wave-hue', Math.round(Bg.hue));
    restartFlash = true;
    setTimeout(render, maxDelay + WAVE_LEN + 30);
    return maxDelay + WAVE_LEN;
  }

  function erase() {
    if (!G || sel < 0) return;
    const i = sel;
    if (G.puzzle[i] || correct(i)) return;
    if (!G.values[i] && !G.notes[i]) return;
    pushHistory();
    if (G.values[i]) G.values[i] = 0; else G.notes[i] = 0;
    save(); render();
  }

  function undo() {
    if (!G || !history.length) { toast('Nichts zum Rückgängigmachen'); return; }
    const h = history.pop();
    G.values = h.values; G.notes = h.notes; G.hint = h.hint;
    save(); render();
  }

  function useHint() {
    if (!G) return;
    const i = sel;
    if (i < 0 || G.puzzle[i] || correct(i)) { toast('Tippe zuerst auf ein leeres Feld'); return; }
    pushHistory();
    G.values[i] = G.solution[i];
    G.notes[i] = 0;
    G.hint[i] = 1;
    G.scored[i] = 1;      // Joker-Felder bringen keine Punkte
    G.hints++;
    placedCorrect(i, G.solution[i]);
    save(); render(); checkWin(i);
  }

  function toggleNotes() {
    notesMode = !notesMode;
    render();
  }

  // ---------- Darstellung ----------
  function render() {
    if (!G) return;
    const sv = sel >= 0 ? G.values[sel] : 0;
    const sr = sel >= 0 ? rowOf(sel) : -1, sc = sel >= 0 ? colOf(sel) : -1;
    const now = Date.now();
    const counts = new Array(10).fill(0);

    for (let i = 0; i < 81; i++) {
      const el = cells[i], v = G.values[i];
      let cls = 'cell';
      if (G.puzzle[i]) cls += ' given';
      else if (v) cls += v !== G.solution[i] ? ' wrong' : G.hint[i] ? ' hint' : ' user';
      if (v && v === G.solution[i]) counts[v]++;

      if (i === sel) cls += ' selected';
      else if (sv && v === sv) cls += ' same';
      else if (rowOf(i) === sr || colOf(i) === sc) cls += ' related';
      const flashing = flashUntil[i] > now;
      if (flashing) cls += flashBig[i] ? ' flash big' : ' flash';
      if (el.classList.contains('shake') && v && v !== G.solution[i]) cls += ' shake';
      // Neue Welle: Animation neu starten, auch wenn das Feld schon animiert war
      if (flashing && restartFlash && el.classList.contains('flash')) {
        el.classList.remove('flash');
        void el.offsetWidth;
      }
      el.style.animationDelay = flashing ? flashDelay[i] + 'ms' : '';
      el.className = cls;

      const key = v ? 'v' + v : 'n' + G.notes[i] + '_' + sv;
      if (el._key !== key) {
        el._key = key;
        if (v) el.innerHTML = `<span class="val">${v}</span>`;
        else if (G.notes[i]) {
          let h = '<div class="notes">';
          for (let n = 1; n <= 9; n++) {
            const on = G.notes[i] & (1 << n);
            h += `<span${on && n === sv ? ' class="hl"' : ''}>${on ? n : ''}</span>`;
          }
          el.innerHTML = h + '</div>';
        } else el.innerHTML = '';
      }
    }

    restartFlash = false;
    for (let n = 1; n <= 9; n++) keys[n].classList.toggle('done', counts[n] >= 9);
    $('#score').textContent = G.score;
    $('#mistakes').textContent = G.mistakes;
    $('#notesBtn').classList.toggle('on', notesMode);
    $('#numpad').classList.toggle('notes-mode', notesMode);
    $('#notesBtn .state').textContent = notesMode ? 'AN' : 'AUS';
    const badge = $('#hintBadge');
    badge.textContent = G.hints;
    badge.classList.toggle('hidden', !G.hints);
    Bg.setProgress(progressOf(G));
    Bg.setGrey(notesMode);
  }

  // ---------- Spielende ----------
  function checkWin(last) {
    for (let i = 0; i < 81; i++) if (G.values[i] !== G.solution[i]) return;
    // Große Welle über das ganze Feld, ausgehend von der letzten Zahl
    const waveTime = wave(last, [...Array(81).keys()], true);
    stopTimer();
    store.del(SAVE_KEY);
    recordWin(G);
    const L = LEVELS[G.level];
    const mins = G.elapsed / 60000;
    const timeBonus = Math.max(0, Math.round((L.par - mins) * 20 * L.mult));
    const hintPenalty = Math.round(G.hints * 30 * L.mult);
    const total = Math.max(0, G.score + timeBonus - hintPenalty);
    const best = store.get(BEST_KEY) || {};
    const record = !best[G.level] || total > best[G.level];
    if (record) { best[G.level] = total; store.set(BEST_KEY, best); }
    sel = -1; render();
    Bg.celebrate();
    const lvl = G.level;
    setTimeout(() => {
      modal(`
        <h2>Geschafft! 🎉</h2>
        <p class="muted">${L.name}${record ? ' · <span class="record">Neuer Rekord!</span>' : ''}</p>
        <div class="total">${total}</div>
        <div class="summary">
          <div><span>Zeit</span><b>${fmtTime(G.elapsed)}</b></div>
          <div><span>Fehler</span><b>${G.mistakes}</b></div>
          <div><span>Joker</span><b>${G.hints}</b></div>
        </div>
        <div class="breakdown">
          <div><span>Spielpunkte</span><b>${G.score}</b></div>
          <div><span>Zeitbonus</span><b>+${timeBonus}</b></div>
          <div><span>Joker (${G.hints}×)</span><b class="neg">−${hintPenalty}</b></div>
        </div>
        <button class="paper btn sheet-btn primary" data-act="again">Nochmal</button>
        <button class="paper btn sheet-btn" data-act="menu">Hauptmenü</button>`,
        { again: () => newGame(lvl), menu: () => { G = null; show('menu'); } }, false);
    }, waveTime + 350);
  }

  // ---------- Dialoge ----------
  function modal(html, actions, dismissable = true) {
    const m = $('#modal'), sheet = $('#sheet');
    sheet.innerHTML = html;
    m.classList.remove('hidden');
    requestAnimationFrame(() => m.classList.add('open'));
    const close = () => {
      m.classList.remove('open');
      setTimeout(() => m.classList.add('hidden'), 220);
    };
    sheet.querySelectorAll('[data-act]').forEach((b) => tap(b, () => {
      close();
      actions[b.dataset.act] && actions[b.dataset.act]();
      if (b.dataset.act === 'cancel' && actions.onCancel) actions.onCancel();
    }));
    m.onclick = (e) => {
      if (e.target === m && dismissable) { close(); actions.onCancel && actions.onCancel(); }
    };
  }

  function backDialog() {
    stopTimer();
    modal(`
      <h2>Spiel unterbrechen?</h2>
      <p class="muted">${LEVELS[G.level].name} · ${fmtTime(G.elapsed)}</p>
      <button class="paper btn sheet-btn primary" data-act="pause">Pausieren</button>
      <button class="paper btn sheet-btn" data-act="restart">Neu starten</button>
      <button class="paper btn sheet-btn danger" data-act="quit">Beenden</button>
      <button class="paper btn sheet-btn ghost" data-act="cancel">Weiterspielen</button>`,
      {
        pause: () => { save(); G = null; show('menu'); },
        restart: () => restartGame(),
        quit: () => { store.del(SAVE_KEY); G = null; show('menu'); },
        onCancel: () => startTimer(),
      });
  }

  // ---------- Ereignisse ----------
  tap($('#backBtn'), backDialog);
  tap($('#undoBtn'), undo);
  tap($('#eraseBtn'), erase);
  tap($('#hintBtn'), useHint);
  tap($('#notesBtn'), toggleNotes);
  tap($('#resumeBtn'), resumeGame);
  tap($('#startBtn'), () => menuView($('#menu').classList.contains('pick') ? 'main' : 'levels'));
  document.querySelectorAll('#tabbar .tab').forEach((t) => tap(t, () => {
    if (!t.classList.contains('active')) show(t.dataset.tab);
  }));
  document.addEventListener('pointerdown', (e) => Bg.ripple(e.clientX, e.clientY));

  // Tastatur (für den PC)
  document.addEventListener('keydown', (e) => {
    if (!G || !$('#game').classList.contains('active') || !$('#modal').classList.contains('hidden')) return;
    if (e.key >= '1' && e.key <= '9') input(+e.key);
    else if (e.key === 'Backspace' || e.key === 'Delete') erase();
    else if (e.key === 'n') toggleNotes();
    else if (e.key === 'h') useHint();
    else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) undo();
    else if (e.key.startsWith('Arrow')) {
      if (sel < 0) sel = 0;
      const r = rowOf(sel), c = colOf(sel);
      const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
      select(((r + d[0] + 9) % 9) * 9 + ((c + d[1] + 9) % 9));
      e.preventDefault();
    }
  });

  // ---------- Start ----------
  buildBoard();
  buildNumpad();
  show('menu');

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
