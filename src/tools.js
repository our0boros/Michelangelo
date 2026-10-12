// Tool table + volumetric brush operations on a StoneGrid.

// radius: metres at normal force. impact: crack stress multiplier (0 = never cracks).
// mode: carve | rasp | pitch | polish | plaster. repeat: ms between strikes while held.
export const TOOLS = [
  { id: 'pitch', key: '1', name: '劈石凿', mode: 'pitch', radius: 0.07, impact: 2.2, repeat: 420,
    desc: '刻意制造平行于表面的裂面，让边角的大块余料整块崩落。只在棱角附近有效，离成品近时极危险。' },
  { id: 'point', key: '2', name: '尖凿', mode: 'carve', radius: 0.028, impact: 1.5, repeat: 150,
    desc: '粗坯主力。去料快，冲击大。' },
  { id: 'claw', key: '3', name: '齿凿', mode: 'carve', radius: 0.016, impact: 0.9, repeat: 140,
    desc: '中等去料，用于贴近成品轮廓。' },
  { id: 'flat', key: '4', name: '平凿', mode: 'carve', radius: 0.008, impact: 0.4, repeat: 120,
    desc: '精修细节，几乎不会开裂。' },
  { id: 'rasp', key: '5', name: '锉刀', mode: 'rasp', radius: 0.018, impact: 0, repeat: 60,
    desc: '按住拖动，沿表面薄薄地锉平。不会开裂。' },
  { id: 'polish', key: '6', name: '砂纸', mode: 'polish', radius: 0.03, impact: 0, repeat: 50,
    desc: '打磨表面，提升光泽与估价。' },
  { id: 'plaster', key: '7', name: '石膏', mode: 'plaster', radius: 0.012, impact: 0, repeat: 110,
    desc: '修补过雕或裂缝。修补处会降低估价，且用量有限。' },
];

export const FORCES = [
  { id: 'light', name: '轻', f: 0.6 },
  { id: 'medium', name: '中', f: 1.0 },
  { id: 'heavy', name: '重', f: 1.5 },
];

export const toolRadius = (tool, f) => tool.radius * Math.pow(f, 0.6);

/**
 * Apply a spherical brush. Returns { removed, removedTarget, added } point counts.
 * carve: subtract sphere; add: union sphere (plaster); polish: flag surface band.
 * `limit` caps how many points `add` may create (plaster budget).
 */
export function brush(grid, c, r, op, limit = Infinity) {
  const box = grid.boxAround(c, r + grid.B);
  const { field, target, plaster, polish, nx, ny, v, B } = grid;
  let removed = 0, removedTarget = 0, added = 0;
  for (let k = box[2]; k <= box[5]; k++) {
    const z = grid.oz + k * v;
    for (let j = box[1]; j <= box[4]; j++) {
      const y = grid.oy + j * v;
      let idx = box[0] + nx * (j + ny * k);
      for (let i = box[0]; i <= box[3]; i++, idx++) {
        const x = grid.ox + i * v;
        const dist = Math.hypot(x - c[0], y - c[1], z - c[2]);
        const prev = field[idx];
        if (op === 'carve') {
          const d = dist - r;
          if (d >= prev) continue;
          field[idx] = Math.max(-B, d);
          if (prev > 0 && d <= 0) {
            removed++;
            if (target[idx] < 0) removedTarget++;
            plaster[idx] = 0;
            polish[idx] = 0;
          }
        } else if (op === 'add') {
          const d = r - dist;
          if (d <= prev) continue;
          if (prev <= 0 && d > 0) {
            if (added >= limit) continue;
            added++;
            plaster[idx] = 1;
          }
          field[idx] = Math.min(B, d);
        } else if (op === 'polish') {
          if (dist < r && prev > -v && prev < 2 * v) polish[idx] = 1;
        }
      }
    }
  }
  grid.markDirty(...box);
  return { removed, removedTarget, added };
}
