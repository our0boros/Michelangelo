import { describe, it, expect } from 'vitest';
import { LEVELS } from '../src/levels.js';
import { StoneGrid } from '../src/grid.js';
import { TOOLS } from '../src/tools.js';
import { strike, detachLoose } from '../src/fracture.js';
import { baseline, measure, appraise, isRuined } from '../src/scoring.js';
import { mulberry32 } from '../src/noise.js';

const level = LEVELS[0];
const tool = (id) => TOOLS.find((t) => t.id === id);
const emptyEv = () => ({ removed: 0, removedTarget: 0, fragments: [], lostTarget: 0 });

/** Carve the grid exactly to the target surface. */
function carvePerfect(g) {
  for (let i = 0; i < g.count; i++) g.field[i] = Math.max(-g.B, Math.min(g.B, -g.target[i]));
}

describe('scoring', () => {
  it('values a perfect, fully polished carve near the level ceiling', () => {
    const g = new StoneGrid(level, 1);
    const base = baseline(g);
    carvePerfect(g);
    g.polish.fill(1);
    const m = measure(g, base);
    expect(m.completion).toBeGreaterThan(0.99);
    expect(m.fidelity).toBeGreaterThan(0.99);
    const r = appraise(level, m);
    expect(r.grade).toBe('S');
    expect(r.value).toBeGreaterThan(level.baseValue * 0.95);
  });

  it('an untouched block is worth nothing', () => {
    const g = new StoneGrid(level, 1);
    const r = appraise(level, measure(g, baseline(g)));
    expect(r.value).toBe(0);
    expect(r.stars).toBe(0);
  });

  it('plaster restores half credit for lost volume and costs value', () => {
    const g = new StoneGrid(level, 1);
    const base = baseline(g);
    carvePerfect(g);
    // Remove the head region (y > 0.8) of the figure.
    const lost = [];
    for (let i = 0; i < g.count; i++) {
      const j = ((i / g.nx) | 0) % g.ny;
      if (g.oy + j * g.v > 0.8 && g.field[i] > 0) { g.field[i] = -g.B; lost.push(i); }
    }
    const damaged = measure(g, base);
    for (const i of lost) { g.field[i] = g.B; g.plaster[i] = 1; }
    const patched = measure(g, base);
    expect(patched.fidelity).toBeGreaterThan(damaged.fidelity);
    expect(patched.fidelity).toBeLessThan(1);
    expect(appraise(level, patched).factors.plasterFactor).toBeLessThan(1);
  });

  it('declares the work ruined once a large share of the figure is gone', () => {
    const g = new StoneGrid(level, 1);
    const base = baseline(g);
    carvePerfect(g);
    for (let i = 0; i < g.count; i++) if (((i / g.nx) | 0) % g.ny > g.ny * 0.45) g.field[i] = -g.B;
    expect(isRuined(measure(g, base))).toBe(true);
  });
});

describe('fracture and connectivity', () => {
  it('a full horizontal cut detaches the upper part as one fragment and reports lost figure', () => {
    const g = new StoneGrid(level, 1);
    for (let i = 0; i < g.count; i++) {
      const j = ((i / g.nx) | 0) % g.ny;
      if (Math.abs(g.oy + j * g.v - 0.6) < g.v * 0.6) g.field[i] = -g.B;
    }
    const ev = detachLoose(g, emptyEv());
    expect(ev.fragments).toHaveLength(1);
    expect(ev.lostTarget).toBeGreaterThan(0);
    expect(g.stoneAt(0, 0.8, 0)).toBeLessThanOrEqual(0); // removed from the block
    expect(g.stoneAt(0, 0.3, 0)).toBeGreaterThan(0); // base remains
  });

  it('pitching tool breaks a slab off at an edge but not mid-face', () => {
    const g = new StoneGrid(level, 1);
    const rng = mulberry32(5);
    const edge = strike(g, g.raycast([0, 0.97, 1], [0, 0, -1]), tool('pitch'), 1.5, level, rng);
    expect(edge.crack).not.toBe('no-edge');
    expect(edge.fragments.length).toBeGreaterThan(0);

    const g2 = new StoneGrid(level, 1);
    const mid = strike(g2, g2.raycast([0, 0.5, 1], [0, 0, -1]), tool('pitch'), 1.5, level, mulberry32(5));
    expect(mid.crack).toBe('no-edge');
    expect(mid.fragments).toHaveLength(0);
  });

  it('plaster never exceeds the remaining budget', () => {
    const g = new StoneGrid(level, 1);
    const hit = g.raycast([0, 0.5, 1], [0, 0, -1]);
    const ev = strike(g, hit, tool('plaster'), 1.5, level, mulberry32(1), 7);
    expect(ev.added).toBeLessThanOrEqual(7);
    expect(ev.added).toBeGreaterThan(0);
  });
});
