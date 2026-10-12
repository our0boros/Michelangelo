// Chisel strikes: carving, crack risk, planar fractures and detachment of loose pieces.
import { Volume } from './grid.js';
import { brush, toolRadius } from './tools.js';
import { fbm3 } from './noise.js';

const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const add = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];

function tangents(n) {
  const up = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const t1 = norm(cross(n, up));
  return [t1, cross(n, t1)];
}

/** Local cross-section: thinnest extent and the long axis through point q. */
export function sectionAt(grid, q, n) {
  const [t1, t2] = tangents(n);
  const s = Math.SQRT1_2;
  const dirs = [n, t1, t2, add(t1, t2).map((c) => c * s), add(t1, t2, -1).map((c) => c * s), [0, 1, 0]];
  let minExt = Infinity, maxExt = 0, longAxis = [0, 1, 0];
  for (const d of dirs) {
    const ext = grid.probe(q, d) + grid.probe(q, [-d[0], -d[1], -d[2]]);
    if (ext < minExt) minExt = ext;
    if (ext > maxExt) { maxExt = ext; longAxis = d; }
  }
  return { minExt, longAxis };
}

/** Deterministic crack assessment for a strike; used for both hover preview and the real hit. */
export function assessStrike(grid, hit, tool, force, level) {
  const r = toolRadius(tool, force);
  const q = add(hit.point, hit.normal, -Math.max(r, grid.v * 2));
  const sec = sectionAt(grid, q, hit.normal);
  const thin = Math.min(1, Math.max(0, (0.12 - sec.minExt) / 0.09));
  const flawHere = grid.sample(grid.flaw, q[0], q[1], q[2], 0);
  const stress = (tool.impact * force * force) / level.toughness;
  const risk = 0.02 + 0.6 * thin + 0.5 * flawHere;
  const chance = tool.impact === 0 ? 0 : Math.min(0.9, 0.12 * stress * stress * risk);
  return { r, q, sec, thin, chance };
}

/** Cut an irregular planar crack disc of radius R through point p with plane normal pn. */
function crackDisc(grid, p, pn, R, seed) {
  const box = grid.boxAround(p, R * 1.3);
  const { field, nx, ny, v, B } = grid;
  const half = v * 0.9;
  for (let k = box[2]; k <= box[5]; k++) {
    const z = grid.oz + k * v;
    for (let j = box[1]; j <= box[4]; j++) {
      const y = grid.oy + j * v;
      let idx = box[0] + nx * (j + ny * k);
      for (let i = box[0]; i <= box[3]; i++, idx++) {
        const x = grid.ox + i * v;
        const dx = x - p[0], dy = y - p[1], dz = z - p[2];
        const along = dx * pn[0] + dy * pn[1] + dz * pn[2];
        const radial = Math.sqrt(Math.max(0, dx * dx + dy * dy + dz * dz - along * along));
        const jag = fbm3(x * 18, y * 18, z * 18, seed, 2);
        if (radial > R * (0.7 + 0.6 * jag)) continue;
        const d = Math.abs(along + (jag - 0.5) * v * 2.5) - half;
        if (d < field[idx]) field[idx] = Math.max(-B, d);
      }
    }
  }
  grid.markDirty(...box);
}

/**
 * Pitching tool: shear a wedge off toward the nearest open edge. The wedge boundary is cut as a
 * thin jagged crack shell, so the wedge becomes an island that detachLoose() drops as debris.
 * Returns false when no edge is close enough (only a tiny chip comes off).
 */
function pitchChip(grid, hit, r, seed) {
  const n = hit.normal;
  const [t1, t2] = tangents(n);
  const depth = r * 0.6;
  const under = add(hit.point, n, -depth);
  let e = null, edgeDist = Infinity;
  for (let a = 0; a < 8; a++) {
    const th = (a / 8) * Math.PI * 2;
    const d = add(t1.map((c) => c * Math.cos(th)), t2, Math.sin(th));
    const ext = grid.probe(under, d, r * 3);
    if (ext < edgeDist) { edgeDist = ext; e = d; }
  }
  if (edgeDist >= r * 1.3) return false;
  const dep = depth;
  const s = r * 1.1; // crack surfaces this far behind the strike point
  const reach = edgeDist;
  // Plane through A = hit - e*s (on surface) and Bp = hit + e*reach - n*dep, normal pointing outward.
  const pn = norm(add(n.map((c) => c * (s + reach)), e, dep));
  const A = add(hit.point, e, -s);
  const R = r * 2.4;
  const center = add(hit.point, e, reach * 0.5);
  const box = grid.boxAround(center, R * 1.4);
  const { field, nx, ny, v, B } = grid;
  const half = v * 0.8;
  for (let k = box[2]; k <= box[5]; k++) {
    const z = grid.oz + k * v;
    for (let j = box[1]; j <= box[4]; j++) {
      const y = grid.oy + j * v;
      let idx = box[0] + nx * (j + ny * k);
      for (let i = box[0]; i <= box[3]; i++, idx++) {
        if (field[idx] <= -half) continue;
        const x = grid.ox + i * v;
        const jag = (fbm3(x * 22, y * 22, z * 22, seed, 2) - 0.5) * v * 3;
        const plane = (x - A[0]) * pn[0] + (y - A[1]) * pn[1] + (z - A[2]) * pn[2] + jag;
        const ball = Math.hypot(x - center[0], y - center[1], z - center[2]) - R * (1 + jag * 4);
        const sdW = Math.max(-plane, ball); // wedge = outer side of plane ∩ ball
        const d = Math.abs(sdW) - half;
        if (d < field[idx]) field[idx] = Math.max(-B, d);
      }
    }
  }
  grid.markDirty(...box);
  return true;
}

/** Perform one strike. Returns an event summary for the game layer. */
export function strike(grid, hit, tool, force, level, rng, plasterLeft = Infinity) {
  const ev = { removed: 0, removedTarget: 0, added: 0, crack: null, fragments: [], lostTarget: 0 };
  const n = hit.normal;
  const sum = (res) => { ev.removed += res.removed; ev.removedTarget += res.removedTarget; ev.added += res.added; };

  if (tool.mode === 'polish') { brush(grid, hit.point, toolRadius(tool, force), 'polish'); return ev; }
  if (tool.mode === 'plaster') {
    const r = toolRadius(tool, force);
    sum(brush(grid, add(hit.point, n, r * 0.35), r, 'add', plasterLeft));
    return ev;
  }
  if (tool.mode === 'rasp') {
    const r = toolRadius(tool, force);
    sum(brush(grid, add(hit.point, n, r - grid.v * 0.6 * force), r, 'carve'));
    return ev;
  }

  const a = assessStrike(grid, hit, tool, force, level);
  const seed = (rng() * 1e9) | 0;
  if (tool.mode === 'pitch') {
    if (pitchChip(grid, hit, a.r, seed)) ev.crack = 'pitch';
    else {
      sum(brush(grid, add(hit.point, n, -a.r * 0.1), a.r * 0.3, 'carve'));
      ev.crack = 'no-edge';
    }
    if (ev.crack === 'pitch' && a.thin > 0.25 && rng() < a.chance) {
      crackDisc(grid, a.q, a.sec.longAxis, a.sec.minExt * 1.6 + 0.02, seed + 1);
      ev.crack = 'snap';
    }
  } else {
    sum(brush(grid, add(hit.point, n, -a.r * 0.35), a.r, 'carve'));
    if (rng() < a.chance) {
      if (a.thin > 0.25) {
        crackDisc(grid, a.q, a.sec.longAxis, a.sec.minExt * 1.6 + 0.02, seed);
        ev.crack = 'snap';
      } else {
        sum(brush(grid, add(hit.point, n, -a.r * 0.6), a.r * 1.8, 'carve'));
        ev.crack = 'spall';
      }
    }
  }
  detachLoose(grid, ev);
  return ev;
}

/** Flood-fill from the anchored base; every unreachable stone island becomes a fragment. */
export function detachLoose(grid, ev) {
  const { field, visited, queue, nx, ny, nz } = grid;
  visited.fill(0);
  let head = 0, tail = 0;
  for (let k = 0; k < nz; k++) for (let j = 0; j <= grid.anchorRow; j++) for (let i = 0; i < nx; i++) {
    const idx = i + nx * (j + ny * k);
    if (field[idx] > 0) { visited[idx] = 1; queue[tail++] = idx; }
  }
  tail = flood(grid, head, tail);
  for (let idx = 0; idx < grid.count; idx++) {
    if (field[idx] > 0 && !visited[idx]) {
      visited[idx] = 2;
      queue[0] = idx;
      const end = flood(grid, 0, 1, 2);
      ev.fragments.push(extractFragment(grid, queue.slice(0, end), ev));
    }
  }
  return ev;
}

function flood(grid, head, tail, mark = 1) {
  const { field, visited, queue, nx, ny, nz } = grid;
  const sxy = nx * ny;
  while (head < tail) {
    const idx = queue[head++];
    const i = idx % nx, j = ((idx / nx) | 0) % ny, k = (idx / sxy) | 0;
    if (i > 0 && field[idx - 1] > 0 && !visited[idx - 1]) { visited[idx - 1] = mark; queue[tail++] = idx - 1; }
    if (i < nx - 1 && field[idx + 1] > 0 && !visited[idx + 1]) { visited[idx + 1] = mark; queue[tail++] = idx + 1; }
    if (j > 0 && field[idx - nx] > 0 && !visited[idx - nx]) { visited[idx - nx] = mark; queue[tail++] = idx - nx; }
    if (j < ny - 1 && field[idx + nx] > 0 && !visited[idx + nx]) { visited[idx + nx] = mark; queue[tail++] = idx + nx; }
    if (k > 0 && field[idx - sxy] > 0 && !visited[idx - sxy]) { visited[idx - sxy] = mark; queue[tail++] = idx - sxy; }
    if (k < nz - 1 && field[idx + sxy] > 0 && !visited[idx + sxy]) { visited[idx + sxy] = mark; queue[tail++] = idx + sxy; }
  }
  return tail;
}

/** Move island points into a standalone Volume (for the falling-debris mesh) and clear them. */
function extractFragment(grid, points, ev) {
  const { nx, ny, field, target, plaster, B } = grid;
  const sxy = nx * ny;
  let i0 = Infinity, j0 = Infinity, k0 = Infinity, i1 = -1, j1 = -1, k1 = -1;
  for (const idx of points) {
    const i = idx % nx, j = ((idx / nx) | 0) % ny, k = (idx / sxy) | 0;
    if (i < i0) i0 = i; if (j < j0) j0 = j; if (k < k0) k0 = k;
    if (i > i1) i1 = i; if (j > j1) j1 = j; if (k > k1) k1 = k;
  }
  i0--; j0--; k0--; i1++; j1++; k1++;
  const v = grid.v;
  const vol = new Volume(i1 - i0 + 1, j1 - j0 + 1, k1 - k0 + 1,
    grid.ox + i0 * v, grid.oy + j0 * v, grid.oz + k0 * v, v, B);
  let lost = 0, plastered = 0, cx = 0, cy = 0, cz = 0;
  for (const idx of points) {
    const i = idx % nx, j = ((idx / nx) | 0) % ny, k = (idx / sxy) | 0;
    const f = vol.index(i - i0, j - j0, k - k0);
    vol.field[f] = field[idx];
    vol.target[f] = target[idx];
    if (target[idx] < 0) lost++;
    if (plaster[idx]) { plastered++; vol.plaster[f] = 1; }
    cx += i; cy += j; cz += k;
    field[idx] = -B;
    plaster[idx] = 0;
    grid.polish[idx] = 0;
  }
  const m = points.length;
  ev.lostTarget += lost;
  ev.removed += m;
  ev.removedTarget += lost;
  grid.markDirty(Math.max(0, i0), Math.max(0, j0), Math.max(0, k0), i1, j1, k1);
  return {
    vol, points: m, lostTarget: lost, plastered,
    center: [grid.ox + (cx / m) * v, grid.oy + (cy / m) * v, grid.oz + (cz / m) * v],
  };
}
