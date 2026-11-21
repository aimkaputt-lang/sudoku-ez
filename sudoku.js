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

  // Bei schweren Stufen mehrere Versuche, das Ergebnis mit den wenigsten Vorgaben gewinnt
  function generate(clues) {
    const tries = clues < 30 ? 4 : 1;
    let best = null;
    for (let t = 0; t < tries; t++) {
      const r = attempt(clues);
      if (!best || r.filled < best.filled) best = r;
      if (best.filled <= clues) break;
    }
    return { puzzle: best.puzzle, solution: best.solution };
  }

  return { generate };
})();
