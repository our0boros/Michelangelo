// Renders a pencil-style draft of the target: front + side silhouettes with depth shading,
// block outline, proportion lines, and the current carving progress overlay.

/** Precompute front/side depth maps from the grid's target layer. */
export function buildDraft(grid, res = 120) {
  const [sx, sy, sz] = grid.size;
  const views = [
    { name: '正面', w: sx, h: sy, depth: sz, map: (u, vv, t) => [u, vv, t], dir: -1 },
    { name: '侧面', w: sz, h: sy, depth: sx, map: (u, vv, t) => [t, vv, u], dir: 1 },
  ];
  for (const view of views) {
    const W = Math.max(8, Math.round((res * view.w) / sy)), H = res;
    const shade = new Float32Array(W * H).fill(-1);
    const steps = Math.ceil(view.depth / grid.v);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = ((x + 0.5) / W - 0.5) * view.w, vv = (1 - (y + 0.5) / H) * sy;
      for (let s = 0; s <= steps; s++) {
        // March from the viewer toward the block (front view looks along -z, side along +x).
        const t = view.dir < 0 ? view.depth / 2 - s * grid.v : -view.depth / 2 + s * grid.v;
        const p = view.map(u, vv, t);
        if (grid.sample(grid.target, p[0], p[1], p[2], 1) < 0) { shade[x + y * W] = s / steps; break; }
      }
    }
    Object.assign(view, { W, H, shade });
  }
  return views;
}

/** Draw both views side by side on a 2D canvas; `field` overlay shows remaining stone. */
export function drawDraft(ctx, grid, views, { showStone = true } = {}) {
  const { width, height } = ctx.canvas;
  ctx.fillStyle = '#f3e7cf';
  ctx.fillRect(0, 0, width, height);
  const gap = 14, margin = 18;
  const totalW = views.reduce((a, v) => a + v.W, 0) + gap;
  const scale = Math.min((width - 2 * margin) / totalW, (height - 2 * margin - 14) / views[0].H);
  let ox = (width - totalW * scale) / 2;
  const oy = margin + 10;
  ctx.font = '12px serif';
  for (const view of views) {
    const w = view.W * scale, h = view.H * scale;
    // Block outline.
    ctx.strokeStyle = 'rgba(80,60,40,0.55)';
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(ox, oy, w, h);
    ctx.setLineDash([]);
    // Proportion lines every eighth of the height (classical canon).
    ctx.strokeStyle = 'rgba(138,75,42,0.25)';
    for (let q = 1; q < 8; q++) {
      const y = oy + (h * q) / 8;
      ctx.beginPath(); ctx.moveTo(ox - 4, y); ctx.lineTo(ox + w + 4, y); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(ox + w / 2, oy - 4); ctx.lineTo(ox + w / 2, oy + h + 4); ctx.stroke();
    // Remaining stone footprint (where silhouette of current block extends beyond target).
    if (showStone) {
      ctx.fillStyle = 'rgba(120,100,80,0.18)';
      const isFront = view.name === '正面';
      const [sx, sy, sz] = grid.size;
      for (let y = 0; y < view.H; y += 2) for (let x = 0; x < view.W; x += 2) {
        if (view.shade[x + y * view.W] >= 0) continue;
        const u = ((x + 1) / view.W - 0.5) * view.w, vv = (1 - (y + 1) / view.H) * sy;
        const depth = isFront ? sz : sx;
        let solid = false;
        for (let t = -depth / 2; t <= depth / 2 && !solid; t += grid.v * 1.5) {
          solid = isFront ? grid.stoneAt(u, vv, t) > 0 : grid.stoneAt(t, vv, u) > 0;
        }
        if (solid) ctx.fillRect(ox + x * scale, oy + y * scale, 2 * scale, 2 * scale);
      }
    }
    // Silhouette with hatched depth shading.
    for (let y = 0; y < view.H; y++) for (let x = 0; x < view.W; x++) {
      const s = view.shade[x + y * view.W];
      if (s < 0) continue;
      const tone = 0.15 + 0.6 * s;
      const hatch = (x + y) % 4 === 0 ? 0.12 : 0;
      ctx.fillStyle = `rgba(50,35,25,${(1 - tone) * 0.55 + hatch})`;
      ctx.fillRect(ox + x * scale, oy + y * scale, scale + 0.5, scale + 0.5);
    }
    // Outline pass: edge pixels drawn darker.
    ctx.fillStyle = 'rgba(30,20,12,0.85)';
    for (let y = 0; y < view.H; y++) for (let x = 0; x < view.W; x++) {
      const inside = view.shade[x + y * view.W] >= 0;
      if (!inside) continue;
      const edge = x === 0 || y === 0 || x === view.W - 1 || y === view.H - 1 ||
        view.shade[x - 1 + y * view.W] < 0 || view.shade[x + 1 + y * view.W] < 0 ||
        view.shade[x + (y - 1) * view.W] < 0 || view.shade[x + (y + 1) * view.W] < 0;
      if (edge) ctx.fillRect(ox + x * scale, oy + y * scale, scale + 0.3, scale + 0.3);
    }
    ctx.fillStyle = '#5a4030';
    ctx.fillText(view.name, ox, oy - 4);
    ox += w + gap * scale;
  }
}
