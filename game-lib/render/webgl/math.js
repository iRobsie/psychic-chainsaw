export function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  const out = new Float32Array(16);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[14] = 2 * far * near * nf;
  return out;
}

export function lookAt(eye, center, up) {
  const [ex, ey, ez] = eye;
  const [cx, cy, cz] = center;
  const [ux, uy, uz] = up;

  let fx = cx - ex;
  let fy = cy - ey;
  let fz = cz - ez;
  const fl = Math.hypot(fx, fy, fz) || 1;
  fx /= fl; fy /= fl; fz /= fl;

  let sx = fy * uz - fz * uy;
  let sy = fz * ux - fx * uz;
  let sz = fx * uy - fy * ux;
  const sl = Math.hypot(sx, sy, sz) || 1;
  sx /= sl; sy /= sl; sz /= sl;

  const ux2 = sy * fz - sz * fy;
  const uy2 = sz * fx - sx * fz;
  const uz2 = sx * fy - sy * fx;

  const out = new Float32Array(16);
  out[0] = sx; out[1] = ux2; out[2] = -fx; out[3] = 0;
  out[4] = sy; out[5] = uy2; out[6] = -fy; out[7] = 0;
  out[8] = sz; out[9] = uz2; out[10] = -fz; out[11] = 0;
  out[12] = -(sx * ex + sy * ey + sz * ez);
  out[13] = -(ux2 * ex + uy2 * ey + uz2 * ez);
  out[14] = fx * ex + fy * ey + fz * ez;
  out[15] = 1;
  return out;
}
