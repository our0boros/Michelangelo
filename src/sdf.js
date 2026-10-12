// Minimal signed-distance toolkit for authoring sculpture targets.
// Every shape is (x, y, z) => signed distance (negative = inside), in metres.

const len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);

export const sphere = (cx, cy, cz, r) => (x, y, z) => len3(x - cx, y - cy, z - cz) - r;

/** Approximate ellipsoid distance (Inigo Quilez bound). */
export const ellipsoid = (cx, cy, cz, rx, ry, rz) => (x, y, z) => {
  const px = (x - cx) / rx, py = (y - cy) / ry, pz = (z - cz) / rz;
  const k0 = len3(px, py, pz);
  const k1 = len3(px / rx, py / ry, pz / rz);
  return k1 === 0 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
};

/** Capsule between a and b; radius may taper from ra to rb. */
export const capsule = (a, b, ra, rb = ra) => {
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const bb = bax * bax + bay * bay + baz * baz || 1e-9;
  return (x, y, z) => {
    const pax = x - a[0], pay = y - a[1], paz = z - a[2];
    const h = Math.min(1, Math.max(0, (pax * bax + pay * bay + paz * baz) / bb));
    return len3(pax - bax * h, pay - bay * h, paz - baz * h) - (ra + (rb - ra) * h);
  };
};

/** Box centred at c with half extents h and corner radius r. */
export const roundBox = (c, h, r = 0) => (x, y, z) => {
  const qx = Math.abs(x - c[0]) - h[0] + r, qy = Math.abs(y - c[1]) - h[1] + r, qz = Math.abs(z - c[2]) - h[2] + r;
  const outside = len3(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0));
  return outside + Math.min(Math.max(qx, qy, qz), 0) - r;
};

/** Vertical cylinder centred at c (y = centre), radius r, half height hh. */
export const cylinder = (c, r, hh) => (x, y, z) => {
  const dx = Math.hypot(x - c[0], z - c[2]) - r, dy = Math.abs(y - c[1]) - hh;
  return Math.min(Math.max(dx, dy), 0) + Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
};

const smin = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};

/** Smooth union of shapes; k = blend radius in metres (0 = hard). */
export const union = (k, ...shapes) => (x, y, z) => {
  let d = shapes[0](x, y, z);
  for (let i = 1; i < shapes.length; i++) {
    const e = shapes[i](x, y, z);
    d = k > 0 ? smin(d, e, k) : Math.min(d, e);
  }
  return d;
};

/** Smooth subtraction a minus b. */
export const subtract = (k, a, b) => (x, y, z) => {
  const da = a(x, y, z), db = -b(x, y, z);
  if (k <= 0) return Math.max(da, db);
  return -smin(-da, -db, k);
};

export const intersect = (a, b) => (x, y, z) => Math.max(a(x, y, z), b(x, y, z));

/** Mirror across the x = 0 plane (bilateral symmetry). */
export const mirrorX = (shape) => (x, y, z) => shape(Math.abs(x), y, z);

/** Rotate a shape around the vertical axis by angle (radians). */
export const rotateY = (shape, angle, cx = 0, cz = 0) => {
  const c = Math.cos(angle), s = Math.sin(angle);
  return (x, y, z) => {
    const dx = x - cx, dz = z - cz;
    return shape(cx + c * dx + s * dz, y, cz - s * dx + c * dz);
  };
};

/** Rotate around the x axis through pivot (cy, cz). Positive angle tilts +y toward +z. */
export const rotateX = (shape, angle, cy = 0, cz = 0) => {
  const c = Math.cos(angle), s = Math.sin(angle);
  return (x, y, z) => {
    const dy = y - cy, dz = z - cz;
    return shape(x, cy + c * dy + s * dz, cz - s * dy + c * dz);
  };
};

/** Rotate around the z axis through pivot (cx, cy). */
export const rotateZ = (shape, angle, cx = 0, cy = 0) => {
  const c = Math.cos(angle), s = Math.sin(angle);
  return (x, y, z) => {
    const dx = x - cx, dy = y - cy;
    return shape(cx + c * dx + s * dy, cy - s * dx + c * dy, z);
  };
};
