// Sudoku-Generator: erzeugt ein komplettes Gitter und entfernt dann Zahlen,
// solange das Rätsel genau eine Lösung behält.
const Sudoku = (() => {
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function canPlace(g, i, n) {
    const r = (i / 9) | 0, c = i % 9;
    for (let k = 0; k < 9; k++) {
      if (g[r * 9 + k] === n || g[k * 9 + c] === n) return false;
    }
    const br = r - (r % 3), bc = c - (c % 3);
    for (let y = 0; y < 3; y++)
      for (let x = 0; x < 3; x++)
        if (g[(br + y) * 9 + bc + x] === n) return false;
    return true;
  }

  function fill(g) {
    const i = g.indexOf(0);
    if (i < 0) return true;
    for (const n of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      if (canPlace(g, i, n)) {
        g[i] = n;
        if (fill(g)) return true;
        g[i] = 0;
      }
    }
    return false;
  }

  // Zählt Lösungen bis zum Limit (wählt immer das Feld mit den wenigsten Kandidaten)
  function countSolutions(g, limit) {
    let best = -1, bestC = null;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const c = [];
      for (let n = 1; n <= 9; n++) if (canPlace(g, i, n)) c.push(n);
      if (!c.length) return 0;
      if (!bestC || c.length < bestC.length) {
        best = i; bestC = c;
        if (c.length === 1) break;
      }
    }
    if (best < 0) return 1;
    let count = 0;
    for (const n of bestC) {
      g[best] = n;
      count += countSolutions(g, limit - count);
      g[best] = 0;
      if (count >= limit) break;
    }
    return count;
  }

  function attempt(clues) {
    const solution = new Array(81).fill(0);
    fill(solution);
    const puzzle = solution.slice();
    let filled = 81;
    for (const i of shuffle([...Array(81).keys()])) {
      if (filled <= clues) break;
      const v = puzzle[i];
      puzzle[i] = 0;
      if (countSolutions(puzzle.slice(), 2) !== 1) puzzle[i] = v;
      else filled--;
    }
    return { puzzle, solution, filled };
  }

  // Bei schweren Stufen so lange neue Rätsel probieren, bis das Zeitbudget aufgebraucht ist –
  // das Rätsel mit den wenigsten Vorgaben gewinnt. (17 ist das theoretische Minimum.)
  function generate(clues, budgetMs = 0) {
    const start = performance.now();
    const elapsed = () => performance.now() - start;
    let best = null;
    // 1) Viele zufällige Rätsel, das beste merken (ca. ein Drittel der Zeit)
    do {
      const r = attempt(clues);
      if (!best || r.filled < best.filled) best = r;
      if (best.filled <= clues) break;
    } while (elapsed() < budgetMs * 0.35);

    // 2) Das beste Rätsel gezielt weiter ausdünnen: eine Vorgabe gegen eine andere
    //    tauschen und dann versuchen, noch weitere zu entfernen
    while (best.filled > clues && elapsed() < budgetMs) {
      const p = best.puzzle.slice();
      const given = [], empty = [];
      for (let i = 0; i < 81; i++) (p[i] ? given : empty).push(i);
      const g = given[(Math.random() * given.length) | 0];
      const e = empty[(Math.random() * empty.length) | 0];
      p[g] = 0;
      p[e] = best.solution[e];
      if (countSolutions(p.slice(), 2) !== 1) continue;
      let filled = given.length;
      for (const i of shuffle(given.filter((k) => k !== g).concat(e))) {
        const v = p[i];
        p[i] = 0;
        if (countSolutions(p.slice(), 2) !== 1) p[i] = v;
        else filled--;
      }
      if (filled < best.filled) best = { puzzle: p, solution: best.solution, filled };
    }
    return { puzzle: best.puzzle, solution: best.solution, clues: best.filled };
  }

  return { generate };
})();
