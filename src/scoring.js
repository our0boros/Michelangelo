// Appraisal: compares the carved field against the target sculpture.
// Pure functions of grid state so they are unit-testable without WebGL.

/** Tolerance band (metres) within which the surface counts as "on target". */
export const tolerance = (grid) => grid.v * 0.75;

/** Snapshot of how much excess stone existed at the start; required for completion %. */
export function baseline(grid) {
  const tol = tolerance(grid);
  let excess = 0, target = 0;
  for (let i = 0; i < grid.count; i++) {
    if (grid.field[i] <= 0) continue;
    if (grid.target[i] > tol) excess++;
    else if (grid.target[i] < -tol) target++;
  }
  return { excess, target };
}

export function measure(grid, base) {
  const tol = tolerance(grid);
  const { field, target, plaster, polish, v } = grid;
  let excess = 0, kept = 0, plastered = 0, surface = 0, polished = 0;
  for (let i = 0; i < grid.count; i++) {
    const t = target[i], f = field[i];
    if (f > 0) {
      if (t > tol) excess++;
      else if (t < -tol) { if (plaster[i]) plastered++; else kept++; }
    }
    // Surface band of the finished form: points near both the target and the carved surface.
    if (Math.abs(t) < 2 * v && f > -v && f < 2 * v) { surface++; if (polish[i] && !plaster[i]) polished++; }
  }
  return {
    completion: base.excess ? 1 - excess / base.excess : 1,
    fidelity: base.target ? (kept + 0.5 * plastered) / base.target : 1,
    plasterShare: base.target ? plastered / base.target : 0,
    polish: surface ? polished / surface : 0,
  };
}

/**
 * Florin valuation + grade. `cracks` = count of fracture events that damaged the target,
 * `strikes` = total tool uses (efficiency bonus for decisive carving).
 */
export function appraise(level, m, { cracks = 0, strikes = 0 } = {}) {
  const roughFactor = Math.pow(Math.max(0, m.completion), 1.5);
  const fidelityFactor = Math.pow(Math.max(0, Math.min(1, m.fidelity)), 4);
  const plasterFactor = 1 - Math.min(0.8, m.plasterShare * 6);
  const finishFactor = 0.7 + 0.3 * m.polish; // unpolished stone sells for 70%; full polish = ceiling
  const crackFactor = Math.pow(0.93, cracks);
  const value = Math.round(level.baseValue * roughFactor * fidelityFactor * plasterFactor * finishFactor * crackFactor);
  const ratio = value / level.baseValue;
  const grade = ratio >= 0.85 ? 'S' : ratio >= 0.65 ? 'A' : ratio >= 0.45 ? 'B' : ratio >= 0.25 ? 'C' : 'D';
  const stars = ratio >= 0.65 ? 3 : ratio >= 0.4 ? 2 : ratio >= 0.2 ? 1 : 0;
  return {
    value, grade, stars, strikes,
    factors: { roughFactor, fidelityFactor, plasterFactor, finishFactor, crackFactor },
  };
}

/** Level counts as ruined when too much of the figure itself has been lost. */
export const isRuined = (m) => m.fidelity < 0.72;
