// Naive surface nets over a Volume region. Emits flat arrays ready for BufferGeometry.
// Per-vertex attributes: position, normal, target distance (for guides), plaster, polish.

const CORNERS = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];

/**
 * Mesh cells [c0, c1) of a volume (cell (i,j,k) spans points i..i+1).
 * Cells adjacent to the region border are included so neighbouring chunks share vertices exactly.
 */
export function meshRegion(vol, c0 = [0, 0, 0], c1 = [vol.nx - 2, vol.ny - 2, vol.nz - 2]) {
  const { field, target, plaster, polish, nx, ny, v } = vol;
  const sxy = nx * ny;
  // Vertex ids for cells c0-1 .. c1 on each axis (quads at point p use cells p-1 and p).
  const ex = c1[0] - c0[0] + 2, ey = c1[1] - c0[1] + 2, ez = c1[2] - c0[2] + 2;
  const ids = new Int32Array(ex * ey * ez).fill(-1);
  const pos = [], nrm = [], tgt = [], pls = [], pol = [], idx = [];
  const cornerVal = new Float32Array(8);

  const cellId = (i, j, k) => (i - c0[0] + 1) + ex * ((j - c0[1] + 1) + ey * (k - c0[2] + 1));

  const vertexFor = (i, j, k) => {
    const id = cellId(i, j, k);
    if (ids[id] >= 0) return ids[id];
    const base = i + nx * j + sxy * k;
    let px = 0, py = 0, pz = 0, cnt = 0;
    for (let c = 0; c < 8; c++) {
      const o = CORNERS[c];
      cornerVal[c] = field[base + o[0] + nx * o[1] + sxy * o[2]];
    }
    for (const [a, b] of EDGES) {
      const fa = cornerVal[a], fb = cornerVal[b];
      if ((fa > 0) === (fb > 0)) continue;
      const t = fa / (fa - fb);
      const oa = CORNERS[a], ob = CORNERS[b];
      px += oa[0] + (ob[0] - oa[0]) * t;
      py += oa[1] + (ob[1] - oa[1]) * t;
      pz += oa[2] + (ob[2] - oa[2]) * t;
      cnt++;
    }
    px = vol.ox + (i + px / cnt) * v;
    py = vol.oy + (j + py / cnt) * v;
    pz = vol.oz + (k + pz / cnt) * v;
    const n = vol.normal(px, py, pz);
    const vi = pos.length / 3;
    pos.push(px, py, pz);
    nrm.push(n[0], n[1], n[2]);
    tgt.push(vol.sample(target, px, py, pz, 1));
    // Material flags: nearest grid point slightly inside the surface.
    const qi = Math.round((px - vol.ox) / v - n[0] * 0.5), qj = Math.round((py - vol.oy) / v - n[1] * 0.5);
    const qk = Math.round((pz - vol.oz) / v - n[2] * 0.5);
    const q = Math.min(vol.count - 1, Math.max(0, qi + nx * qj + sxy * qk));
    pls.push(plaster[q]);
    pol.push(polish[q]);
    ids[id] = vi;
    return vi;
  };

  const quad = (a, b, c, d, flip) => {
    if (flip) idx.push(a, c, b, a, d, c);
    else idx.push(a, b, c, a, c, d);
  };

  // Each grid edge from point p to p+axis that crosses the surface produces one quad
  // joining the four cells around that edge. Only edges whose start point lies in the region.
  for (let k = c0[2]; k <= c1[2]; k++) for (let j = c0[1]; j <= c1[1]; j++) for (let i = c0[0]; i <= c1[0]; i++) {
    const p = i + nx * j + sxy * k;
    const inside = field[p] > 0;
    if (i < nx - 1 && j > 0 && k > 0 && (field[p + 1] > 0) !== inside) {
      quad(vertexFor(i, j - 1, k - 1), vertexFor(i, j, k - 1), vertexFor(i, j, k), vertexFor(i, j - 1, k), !inside);
    }
    if (j < vol.ny - 1 && i > 0 && k > 0 && (field[p + nx] > 0) !== inside) {
      quad(vertexFor(i - 1, j, k - 1), vertexFor(i - 1, j, k), vertexFor(i, j, k), vertexFor(i, j, k - 1), !inside);
    }
    if (k < vol.nz - 1 && i > 0 && j > 0 && (field[p + sxy] > 0) !== inside) {
      quad(vertexFor(i - 1, j - 1, k), vertexFor(i, j - 1, k), vertexFor(i, j, k), vertexFor(i - 1, j, k), !inside);
    }
  }

  return {
    position: new Float32Array(pos), normal: new Float32Array(nrm), target: new Float32Array(tgt),
    plaster: new Float32Array(pls), polish: new Float32Array(pol),
    index: pos.length / 3 > 65535 ? new Uint32Array(idx) : new Uint16Array(idx),
  };
}
