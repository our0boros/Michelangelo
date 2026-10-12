// Splits the StoneGrid into fixed cell chunks; only dirty chunks are remeshed after a strike.
import * as THREE from 'three';
import { meshRegion } from './mesher.js';
import { geometryFromMesh } from './marble.js';

const CHUNK = 16;

export class StoneMesh {
  constructor(grid, material) {
    this.grid = grid;
    this.material = material;
    this.group = new THREE.Group();
    this.cx = Math.ceil((grid.nx - 1) / CHUNK);
    this.cy = Math.ceil((grid.ny - 1) / CHUNK);
    this.cz = Math.ceil((grid.nz - 1) / CHUNK);
    this.meshes = new Array(this.cx * this.cy * this.cz).fill(null);
    for (let c = 0; c < this.meshes.length; c++) this.rebuild(c);
    grid.takeDirty();
  }

  rebuild(c) {
    const { grid } = this;
    const ci = c % this.cx, cj = ((c / this.cx) | 0) % this.cy, ck = (c / (this.cx * this.cy)) | 0;
    const c0 = [ci * CHUNK, cj * CHUNK, ck * CHUNK];
    const c1 = [Math.min(grid.nx - 2, c0[0] + CHUNK - 1), Math.min(grid.ny - 2, c0[1] + CHUNK - 1), Math.min(grid.nz - 2, c0[2] + CHUNK - 1)];
    const m = meshRegion(grid, c0, c1);
    const old = this.meshes[c];
    if (old) { this.group.remove(old); old.geometry.dispose(); this.meshes[c] = null; }
    if (m.index.length === 0) return;
    const mesh = new THREE.Mesh(geometryFromMesh(m), this.material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    this.meshes[c] = mesh;
  }

  /** Remesh chunks touched since the last update. Point edits affect cells one step below. */
  update() {
    const d = this.grid.takeDirty();
    if (!d) return;
    const lo = (a) => Math.max(0, Math.floor((a - 1) / CHUNK));
    const hi = (a, n) => Math.min(n - 1, Math.floor(a / CHUNK));
    for (let k = lo(d[2]); k <= hi(d[5], this.cz); k++)
      for (let j = lo(d[1]); j <= hi(d[4], this.cy); j++)
        for (let i = lo(d[0]); i <= hi(d[3], this.cx); i++) this.rebuild(i + this.cx * (j + this.cy * k));
  }

  /** Full rebuild, e.g. after toggling material-flag layers globally. */
  rebuildAll() {
    for (let c = 0; c < this.meshes.length; c++) this.rebuild(c);
    this.grid.takeDirty();
  }

  dispose() {
    for (const m of this.meshes) if (m) m.geometry.dispose();
    this.group.clear();
  }
}
