// Voxel stone: a clamped signed field sampled on grid points.
// field > 0 = stone, <= 0 = air. target < 0 = inside the reference sculpture.
import { roundBox } from './sdf.js';
import { fbm3 } from './noise.js';

/** Regular grid of scalar layers; shared by the main block and falling fragments. */
export class Volume {
  constructor(nx, ny, nz, ox, oy, oz, v, B) {
    Object.assign(this, { nx, ny, nz, ox, oy, oz, v, B });
    const n = nx * ny * nz;
    this.count = n;
    this.field = new Float32Array(n).fill(-B);
    this.target = new Float32Array(n);
    this.flaw = new Float32Array(n);
    this.plaster = new Uint8Array(n);
    this.polish = new Uint8Array(n);
  }

  index(i, j, k) { return i + this.nx * (j + this.ny * k); }

  /** Trilinear sample of a layer at world position; returns `outside` beyond the grid. */
  sample(arr, x, y, z, outside) {
    const gx = (x - this.ox) / this.v, gy = (y - this.oy) / this.v, gz = (z - this.oz) / this.v;
    if (gx < 0 || gy < 0 || gz < 0 || gx >= this.nx - 1 || gy >= this.ny - 1 || gz >= this.nz - 1) return outside;
    const i = gx | 0, j = gy | 0, k = gz | 0;
    const fx = gx - i, fy = gy - j, fz = gz - k;
    const sy = this.nx, sz = this.nx * this.ny;
    const b = i + sy * j + sz * k;
    const c00 = arr[b] + (arr[b + 1] - arr[b]) * fx;
    const c10 = arr[b + sy] + (arr[b + sy + 1] - arr[b + sy]) * fx;
    const c01 = arr[b + sz] + (arr[b + sz + 1] - arr[b + sz]) * fx;
    const c11 = arr[b + sz + sy] + (arr[b + sz + sy + 1] - arr[b + sz + sy]) * fx;
    const c0 = c00 + (c10 - c00) * fy, c1 = c01 + (c11 - c01) * fy;
    return c0 + (c1 - c0) * fz;
  }

  stoneAt(x, y, z) { return this.sample(this.field, x, y, z, -this.B); }

  /** Outward surface normal (field grows inward, so normal = -grad). */
  normal(x, y, z) {
    const h = this.v * 0.75;
    const gx = this.stoneAt(x + h, y, z) - this.stoneAt(x - h, y, z);
    const gy = this.stoneAt(x, y + h, z) - this.stoneAt(x, y - h, z);
    const gz = this.stoneAt(x, y, z + h) - this.stoneAt(x, y, z - h);
    const l = Math.hypot(gx, gy, gz) || 1;
    return [-gx / l, -gy / l, -gz / l];
  }
}

export class StoneGrid extends Volume {
  constructor(level, seed = 1) {
    const v = level.voxel, [sx, sy, sz] = level.size, pad = 2;
    super(
      Math.ceil(sx / v) + 1 + 2 * pad, Math.ceil(sy / v) + 1 + 2 * pad, Math.ceil(sz / v) + 1 + 2 * pad,
      -sx / 2 - pad * v, -pad * v, -sz / 2 - pad * v, v, 3 * v,
    );
    this.pad = pad;
    this.size = level.size;
    this.visited = new Uint8Array(this.count);
    this.queue = new Int32Array(this.count);
    this.dirty = null;

    const block = roundBox([0, sy / 2, 0], [sx / 2, sy / 2, sz / 2], 0.004);
    const shape = level.shape();
    const B = this.B;
    for (let k = 0, idx = 0; k < this.nz; k++) {
      const z = this.oz + k * v;
      for (let j = 0; j < this.ny; j++) {
        const y = this.oy + j * v;
        for (let i = 0; i < this.nx; i++, idx++) {
          const x = this.ox + i * v;
          this.field[idx] = Math.max(-B, Math.min(B, -block(x, y, z)));
          this.target[idx] = shape(x, y, z);
          // Ridged noise gives thin vein sheets; only the sharpest ridges become flaws.
          const ridge = 1 - Math.abs(2 * fbm3(x * 7, y * 4, z * 7, seed, 3) - 1);
          this.flaw[idx] = level.flaw * Math.max(0, (ridge - 0.9) / 0.1);
        }
      }
    }
  }

  /** Grid points at or below this row are anchored to the workbench. */
  get anchorRow() { return this.pad + 1; }

  /** March a ray (o, unit d) to the first stone surface. */
  raycast(o, d) {
    const lo = [this.ox, this.oy, this.oz];
    const hi = [this.ox + (this.nx - 1) * this.v, this.oy + (this.ny - 1) * this.v, this.oz + (this.nz - 1) * this.v];
    let t0 = 0, t1 = Infinity;
    for (let a = 0; a < 3; a++) {
      if (Math.abs(d[a]) < 1e-12) { if (o[a] < lo[a] || o[a] > hi[a]) return null; continue; }
      let ta = (lo[a] - o[a]) / d[a], tb = (hi[a] - o[a]) / d[a];
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    }
    if (t0 > t1) return null;
    const at = (t) => this.stoneAt(o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t);
    const step = this.v * 0.5;
    let prevT = t0, prev = at(t0);
    for (let t = t0 + step; t <= t1; t += step) {
      const cur = at(t);
      if (cur > 0 && prev <= 0) {
        let a = prevT, b = t;
        for (let it = 0; it < 8; it++) { const m = (a + b) / 2; if (at(m) > 0) b = m; else a = m; }
        const point = [o[0] + d[0] * b, o[1] + d[1] * b, o[2] + d[2] * b];
        return { point, normal: this.normal(...point), t: b };
      }
      prevT = t; prev = cur;
    }
    return null;
  }

  /** Distance travelled through stone from p along unit dir (capped). */
  probe(p, dir, max = 0.6) {
    const step = this.v * 0.5;
    let t = 0;
    while (t < max && this.stoneAt(p[0] + dir[0] * t, p[1] + dir[1] * t, p[2] + dir[2] * t) > 0) t += step;
    return t;
  }

  markDirty(i0, j0, k0, i1, j1, k1) {
    const d = this.dirty;
    if (!d) { this.dirty = [i0, j0, k0, i1, j1, k1]; return; }
    d[0] = Math.min(d[0], i0); d[1] = Math.min(d[1], j0); d[2] = Math.min(d[2], k0);
    d[3] = Math.max(d[3], i1); d[4] = Math.max(d[4], j1); d[5] = Math.max(d[5], k1);
  }

  takeDirty() { const d = this.dirty; this.dirty = null; return d; }

  /** Index box covering a world-space sphere, clamped to the grid. */
  boxAround(c, r) {
    const v = this.v;
    return [
      Math.max(0, Math.floor((c[0] - r - this.ox) / v)), Math.max(0, Math.floor((c[1] - r - this.oy) / v)),
      Math.max(0, Math.floor((c[2] - r - this.oz) / v)), Math.min(this.nx - 1, Math.ceil((c[0] + r - this.ox) / v)),
      Math.min(this.ny - 1, Math.ceil((c[1] + r - this.oy) / v)), Math.min(this.nz - 1, Math.ceil((c[2] + r - this.oz) / v)),
    ];
  }
}
