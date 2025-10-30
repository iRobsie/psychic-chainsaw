const DIR = [
  { n: [1, 0, 0], f: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { n: [-1, 0, 0], f: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
  { n: [0, 1, 0], f: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { n: [0, -1, 0], f: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], f: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { n: [0, 0, -1], f: [[0, 1, 0], [1, 1, 0], [1, 0, 0], [0, 0, 0]] },
];

let CH = 16;
let WY = 128;
const I = { AIR: 0, GRS: 1, DIR: 2, STO: 3, SAN: 4, WAT: 5, LOG: 6, LEA: 7, PLK: 8, ORE: 9 };
const SOL = id => id !== I.AIR && id !== I.LEA && id !== I.WAT;
const COLORS = [
  [0, 0, 0],
  [0.32, 0.84, 0.32],
  [0.55, 0.35, 0.22],
  [0.65, 0.65, 0.69],
  [0.92, 0.86, 0.58],
  [0.22, 0.52, 0.96],
  [0.58, 0.42, 0.28],
  [0.2, 0.62, 0.26],
  [0.8, 0.65, 0.45],
  [0.52, 0.52, 0.57],
];

self.onmessage = e => {
  const d = e.data;
  if (d.cmd === 'init') {
    CH = d.CH;
    WY = d.WY;
    return;
  }
  if (d.cmd === 'mesh') {
    const CHp = CH + 2;
    const ids = new Uint16Array(d.ids);
    const at = (x, y, z) => ids[(y * CHp + z) * CHp + x];
    const solids = [];
    const waters = [];
    const { sx, sy, sz } = d;
    for (let y = 1; y <= CH; y++) {
      for (let z = 1; z <= CH; z++) {
        for (let x = 1; x <= CH; x++) {
          const id = at(x, y, z);
          if (id === I.AIR) continue;
          const base = COLORS[id] || [1, 0, 1];
          for (const face of DIR) {
            const nx = x + face.n[0];
            const ny = y + face.n[1];
            const nz = z + face.n[2];
            const nid = at(nx, ny, nz);
            let draw = false;
            if (id === I.WAT) {
              draw = nid !== I.WAT;
            } else {
              draw = nid === I.AIR || nid === I.LEA || nid === I.WAT;
            }
            if (!draw) continue;
            const shade = 0.9 + (face.n[1] > 0.5 ? 0.12 : face.n[1] < -0.5 ? -0.28 : 0);
            const c = [base[0] * shade, base[1] * shade, base[2] * shade];
            const out = id === I.WAT ? waters : solids;
            const wat = id === I.WAT ? 1 : 0;
            for (const idx of [0, 1, 2, 0, 2, 3]) {
              const p = face.f[idx];
              out.push(sx + x - 1 + p[0], sy + y - 1 + p[1], sz + z - 1 + p[2], ...face.n, ...c, wat);
            }
          }
        }
      }
    }
    const sb = new Float32Array(solids);
    const wb = new Float32Array(waters);
    self.postMessage({ cmd: 'built', key: d.key, sb, wb }, { transfer: [sb.buffer, wb.buffer] });
  }
};
