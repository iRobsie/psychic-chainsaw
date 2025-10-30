import { createGLContext, autoResize } from '../../game-lib/render/webgl/context.js';
import { createProgram } from '../../game-lib/render/webgl/shaders.js';
import { createBuffer, createVertexArrayHelper } from '../../game-lib/render/webgl/buffers.js';
import { perspective, lookAt } from '../../game-lib/render/webgl/math.js';
import { spawnWorker, createWorkerQueue } from '../../game-lib/render/webgl/worker.js';

const workerURL = new URL('./mesher.worker.js', import.meta.url);

export function startTinyCraft() {
  const cv = document.getElementById('cv');
  if (!cv) {
    throw new Error('TinyCraft canvas not found');
  }

  const HUD = {
    fps: document.getElementById('fps'),
    seed: document.getElementById('seed'),
    hot: document.getElementById('hot'),
    mm: document.getElementById('mm'),
    btnFS: document.getElementById('btnFS'),
    btnAim: document.getElementById('btnAim'),
    btnSave: document.getElementById('btnSave'),
    btnLoad: document.getElementById('btnLoad'),
  };

  const ctx = createGLContext(cv, {
    extensions: ['OES_vertex_array_object'],
  });
  const { gl, gl2, isWebGL2, extensions } = ctx;
  const vaoHelper = createVertexArrayHelper({
    gl,
    gl2,
    vaoExt: extensions.OES_vertex_array_object,
  });
  autoResize(gl, { canvas: cv, maxPixelRatio: 2 });

  const W = { Y: 128, CH: 16 };
  let CH_R = 7;
  const EYE = 1.62;
  const SENS = 0.0022;
  const GRV = 22;
  const SPD = 5;
  const SPD2 = 9;
  const JMP = 7.5;
  const RAY = 12;
  let fogD = 230;
  let fogC = [0.6, 0.8, 1];

  const I = { AIR: 0, GRS: 1, DIR: 2, STO: 3, SAN: 4, WAT: 5, LOG: 6, LEA: 7, PLK: 8, ORE: 9 };
  const IT = [
    { id: I.AIR, n: 'Air', s: 0, c: [0, 0, 0] },
    { id: I.GRS, n: 'Grass', s: 1, c: [0.32, 0.84, 0.32] },
    { id: I.DIR, n: 'Dirt', s: 1, c: [0.55, 0.35, 0.22] },
    { id: I.STO, n: 'Stone', s: 1, c: [0.65, 0.65, 0.69] },
    { id: I.SAN, n: 'Sand', s: 1, c: [0.92, 0.86, 0.58] },
    { id: I.WAT, n: 'Water', s: 0, c: [0.22, 0.52, 0.96] },
    { id: I.LOG, n: 'Log', s: 1, c: [0.58, 0.42, 0.28] },
    { id: I.LEA, n: 'Leaves', s: 0, c: [0.2, 0.62, 0.26] },
    { id: I.PLK, n: 'Planks', s: 1, c: [0.8, 0.65, 0.45] },
    { id: I.ORE, n: 'Ore', s: 1, c: [0.52, 0.52, 0.57] },
  ];
  const HOT = [I.GRS, I.DIR, I.SAN, I.STO, I.PLK, I.LOG, I.LEA, I.WAT];

  let sel = 3;
  function paintHot() {
    HUD.hot.innerHTML = '';
    HOT.forEach((id, i) => {
      const d = document.createElement('div');
      d.className = 'slot' + (i === sel ? ' sel' : '');
      const s = document.createElement('div');
      s.className = 'sw';
      const c = (IT.find(x => x.id === id)?.c) || [1, 0, 1];
      s.style.background = `rgb(${(c[0] * 255) | 0} ${(c[1] * 255) | 0} ${(c[2] * 255) | 0})`;
      d.appendChild(s);
      HUD.hot.appendChild(d);
    });
  }
  paintHot();

  function COL(id) { return IT[id]?.c || [1, 0, 1]; }
  function SOL(id) { return IT[id]?.s !== 0; }

  function h32(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function m32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  let seed = localStorage.tc_seed || ('s' + Math.random().toString(36).slice(2));
  let RNG = m32(h32(seed));
  HUD.seed.textContent = 'seed ' + seed;

  const edits = new Map();
  const CH = new Map();

  function k3(x, y, z) {
    return x + ',' + y + ',' + z;
  }
  function inW(x, y, z) {
    return y >= 0 && y < W.Y;
  }
  const sea = () => Math.floor(W.Y * 0.19);
  function n2(x, z) {
    return Math.sin(x * 0.09) + Math.cos(z * 0.08) + Math.sin((x + z) * 0.05) * 0.6;
  }
  function hAt(x, z) {
    const vr = Math.floor(W.Y * 0.08);
    return Math.max(2, Math.min(W.Y - 6, sea() + Math.floor(n2(x, z) * vr)));
  }
  function baseId(x, y, z) {
    const h = hAt(x, z);
    const S = sea();
    if (y > h) {
      if (y < S - 1) return I.WAT;
      return I.AIR;
    }
    if (y === h) return h < S + 2 ? I.SAN : I.GRS;
    if (y >= h - 3) return I.DIR;
    return I.STO;
  }
  function veins(x, y, z) {
    if (y > W.Y * 0.5) return 0;
    const r = (Math.sin(x * 11.4 + z * 7.1 + y * 3.7) * 0.5 + 0.5);
    return r > 0.945;
  }
  function treeCenter(x, z) {
    const H = hAt(x, z);
    const S = sea();
    if (H <= S + 1) return null;
    const base = baseId(x, H, z);
    if (base !== I.GRS) return null;
    const r = ((h32(seed + ':T:' + ((x >> 3) + ',' + (z >> 3))) >>> 0) % 1013) / 1013;
    if (r < 0.035) return { y: H + 1, th: 4 + ((h32('th' + x + ',' + z) % 3) | 0) };
    return null;
  }
  function idFromProc(x, y, z) {
    const H = hAt(x, z);
    const S = sea();
    const c = treeCenter(x, z);
    if (c) {
      const top = c.y + c.th;
      if (y >= c.y && y <= top) return I.LOG;
      if (y >= top - 2) {
        if ((x - (x | 0)) ** 2 + (z - (z | 0)) ** 2 <= 4) return I.LEA;
      }
    }
    return null;
  }
  function getId(x, y, z) {
    if (!inW(x, y, z)) return I.AIR;
    const key = ((x | 0) << 20) ^ (y << 10) ^ (z | 0);
    if (edits.has(key)) return edits.get(key);
    let id = baseId(x, y, z);
    if (id === I.STO && veins(x, y, z)) id = I.ORE;
    const t = idFromProc(x, y, z);
    if (t != null) id = t;
    return id;
  }
  function setId(x, y, z, id) {
    const key = ((x | 0) << 20) ^ (y << 10) ^ (z | 0);
    edits.set(key, id);
    touchNeighbors(x, y, z);
  }

  function touchNeighbors(x, y, z) {
    const cx = Math.floor(x / W.CH);
    const cy = Math.floor(y / W.CH);
    const cz = Math.floor(z / W.CH);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          const k = k3(cx + dx, cy + dy, cz + dz);
          const c = CH.get(k);
          if (c) c.d = 1;
        }
      }
    }
  }

  function ensureChunks(px, pz) {
    const cx = Math.floor(px / W.CH);
    const cz = Math.floor(pz / W.CH);
    for (let dz = -CH_R; dz <= CH_R; dz++) {
      for (let dx = -CH_R; dx <= CH_R; dx++) {
        for (let cy = 0; cy < Math.ceil(W.Y / W.CH); cy++) {
          const k = k3(cx + dx, cy, cz + dz);
          if (!CH.has(k)) CH.set(k, { p: [cx + dx, cy, cz + dz], d: 1, sb: null, sc: 0, wb: null, wc: 0, vaoS: null, vaoW: null });
        }
      }
    }
  }

  const worker = spawnWorker(workerURL, { type: 'module' });
  const workerQueue = createWorkerQueue(worker, { maxInflight: 6 });
  if (worker) worker.postMessage({ cmd: 'init', CH: W.CH, WY: W.Y });

  function packIds(cx, cy, cz) {
    const CHp = W.CH + 2;
    const out = new Uint16Array(CHp * CHp * CHp);
    let i = 0;
    const sx = cx * W.CH - 1;
    const sy = cy * W.CH - 1;
    const sz = cz * W.CH - 1;
    for (let y = 0; y < CHp; y++) {
      for (let z = 0; z < CHp; z++) {
        for (let x = 0; x < CHp; x++) {
          out[i++] = getId(sx + x, sy + y, sz + z);
        }
      }
    }
    return { buf: out, sx, sy, sz };
  }

  function meshLocal(idsBuf, sx, sy, sz) {
    const CHp = W.CH + 2;
    const ids = new Uint16Array(idsBuf);
    const at = (x, y, z) => ids[(y * CHp + z) * CHp + x];
    const DIR = [
      { n: [1, 0, 0], f: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
      { n: [-1, 0, 0], f: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
      { n: [0, 1, 0], f: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
      { n: [0, -1, 0], f: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
      { n: [0, 0, 1], f: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
      { n: [0, 0, -1], f: [[0, 1, 0], [1, 1, 0], [1, 0, 0], [0, 0, 0]] },
    ];
    const sv = [];
    const wv = [];
    const col = IT.map(x => x.c || [1, 0, 1]);
    for (let y = 1; y <= W.CH; y++) {
      for (let z = 1; z <= W.CH; z++) {
        for (let x = 1; x <= W.CH; x++) {
          const id = at(x, y, z);
          if (id === I.AIR) continue;
          const base = col[id];
          for (const df of DIR) {
            const nx = x + df.n[0];
            const ny = y + df.n[1];
            const nz = z + df.n[2];
            const nid = at(nx, ny, nz);
            let draw = false;
            if (id === I.WAT) {
              draw = nid !== I.WAT;
            } else {
              draw = nid === I.AIR || nid === I.LEA || nid === I.WAT;
            }
            if (!draw) continue;
            const sh = 0.9 + (df.n[1] > 0.5 ? 0.12 : df.n[1] < -0.5 ? -0.28 : 0);
            const c = [base[0] * sh, base[1] * sh, base[2] * sh];
            const arr = id === I.WAT ? wv : sv;
            const wat = id === I.WAT ? 1 : 0;
            for (const i of [0, 1, 2, 0, 2, 3]) {
              const p = df.f[i];
              arr.push(sx + x - 1 + p[0], sy + y - 1 + p[1], sz + z - 1 + p[2], ...df.n, ...c, wat);
            }
          }
        }
      }
    }
    return { sb: new Float32Array(sv), wb: new Float32Array(wv) };
  }

  function installMesh(c, { sb, wb }) {
    if (c.sb) gl.deleteBuffer(c.sb);
    if (c.wb) gl.deleteBuffer(c.wb);
    if (c.vaoS) vaoHelper.delete(c.vaoS);
    if (c.vaoW) vaoHelper.delete(c.vaoW);

    c.sb = createBuffer(gl, { data: sb });
    c.sc = sb.length / 10;
    c.wb = createBuffer(gl, { data: wb });
    c.wc = wb.length / 10;

    const setup = buffer => () => {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(L.p);
      gl.enableVertexAttribArray(L.n);
      gl.enableVertexAttribArray(L.c);
      gl.enableVertexAttribArray(L.t);
      gl.vertexAttribPointer(L.p, 3, gl.FLOAT, false, 40, 0);
      gl.vertexAttribPointer(L.n, 3, gl.FLOAT, false, 40, 12);
      gl.vertexAttribPointer(L.c, 3, gl.FLOAT, false, 40, 24);
      gl.vertexAttribPointer(L.t, 1, gl.FLOAT, false, 40, 36);
    };

    c.vaoS = vaoHelper.create(setup(c.sb));
    c.vaoW = vaoHelper.create(setup(c.wb));
    c.d = 0;
    c.req = 0;
  }

  function requestBuild(c) {
    const data = packIds(c.p[0], c.p[1], c.p[2]);
    const key = k3(...c.p);
    c.req = 1;
    if (!workerQueue.post({ cmd: 'mesh', ids: data.buf.buffer, sx: data.sx, sy: data.sy, sz: data.sz, key }, [data.buf.buffer])) {
      const res = meshLocal(data.buf.buffer, data.sx, data.sy, data.sz);
      installMesh(c, res);
      c.req = 0;
    }
  }

  if (worker) {
    worker.addEventListener('message', e => {
      const d = e.data;
      if (d.cmd === 'built') {
        workerQueue.release();
        const c = CH.get(d.key);
        if (!c) return;
        installMesh(c, { sb: d.sb, wb: d.wb });
      }
    });
  }

  const VS = `#ifdef GL_ES\nprecision mediump float;\n#endif\nattribute vec3 aP,aN,aC; attribute float aT; uniform mat4 uP,uV; uniform vec3 uL; uniform float uTime; varying vec3 vC; varying float vZ; varying float vT; void main(){ vec3 p=aP; if(aT>0.5 && aN.y>0.5){ p.y += sin((aP.x+aP.z)*0.18 + uTime*1.6)*0.06; } vec4 e=uV*vec4(p,1.); gl_Position=uP*e; float d=max(dot(normalize(aN),normalize(uL)),0.)*.6+.4; vC=aC*d; vZ=-e.z; vT=aT; }`;
  const FS = `#ifdef GL_ES\nprecision mediump float;\n#endif\nvarying vec3 vC; varying float vZ; varying float vT; uniform vec3 uFogC; uniform float uFogD; uniform float uUW; void main(){ float f=clamp((uFogD - vZ)/uFogD,0.,1.); vec3 col=vC; if(vT>0.5){ col=mix(vec3(.18,.46,.95), col, .35); } if(uUW>0.5){ col=mix(vec3(.35,.6,.9), col, .65); } gl_FragColor=vec4(mix(uFogC,col,f), (vT>0.5? .55:1.)); }`;
  const PG = createProgram(gl, VS, FS);
  gl.useProgram(PG);
  const L = {
    p: gl.getAttribLocation(PG, 'aP'),
    n: gl.getAttribLocation(PG, 'aN'),
    c: gl.getAttribLocation(PG, 'aC'),
    t: gl.getAttribLocation(PG, 'aT'),
    P: gl.getUniformLocation(PG, 'uP'),
    V: gl.getUniformLocation(PG, 'uV'),
    L: gl.getUniformLocation(PG, 'uL'),
    FC: gl.getUniformLocation(PG, 'uFogC'),
    FD: gl.getUniformLocation(PG, 'uFogD'),
    TIME: gl.getUniformLocation(PG, 'uTime'),
    UW: gl.getUniformLocation(PG, 'uUW'),
  };

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  let yaw = 0;
  let pitch = 0;
  let pos = [0, 0, 0];
  let vel = [0, 0, 0];
  let ground = 0;
  function eye() { return [pos[0], pos[1] + EYE, pos[2]]; }
  function fwd() { return [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)]; }
  function flat() { return [Math.sin(yaw), 0, Math.cos(yaw)]; }
  function right() { const f = flat(); return [f[2], 0, -f[0]]; }
  function freeAbove(x, y, z) {
    const a1 = getId(x, y + 1, z);
    const a2 = getId(x, y + 2, z);
    return (a1 !== I.WAT && a2 !== I.WAT && !SOL(a1) && !SOL(a2));
  }
  function topDry(x, z) {
    for (let y = W.Y - 4; y >= 2; y--) if (SOL(getId(x, y, z)) && freeAbove(x, y, z)) return y;
    return null;
  }
  function findSpawn() {
    const S = sea();
    let best = null;
    const rMax = 400;
    for (let r = 2; r < rMax; r += 2) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
        const x = (Math.cos(a) * r) | 0;
        const z = (Math.sin(a) * r) | 0;
        const y = topDry(x, z);
        if (y != null) {
          const h = hAt(x, z);
          if (h > S + 1) {
            best = [x, y, z];
            return best;
          }
          best = [x, y, z];
        }
      }
    }
    return best;
  }
  function respawn() {
    const s = findSpawn();
    if (s) {
      pos = [s[0] + 0.5, s[1] + 0.05, s[2] + 0.5];
      vel = [0, 0, 0];
    } else {
      pos = [0, sea() + 6, 0];
      vel = [0, 0, 0];
    }
    ensureChunks(pos[0], pos[2]);
  }

  const k = new Set();
  window.addEventListener('keydown', e => {
    if (e.repeat) return;
    k.add(e.code);
    if (e.code.startsWith('Digit')) {
      const n = +e.code.slice(5);
      if (n >= 1 && n <= HOT.length) {
        sel = n - 1;
        paintHot();
      }
    }
    if (e.code === 'KeyR') {
      seed = 's' + Math.random().toString(36).slice(2);
      localStorage.tc_seed = seed;
      RNG = m32(h32(seed));
      edits.clear();
      CH.clear();
      respawn();
    }
  });
  window.addEventListener('keyup', e => k.delete(e.code));

  let hover = 1;
  let drag = 0;
  let prev = null;
  window.addEventListener('mousemove', e => {
    let dx = 0;
    let dy = 0;
    if (document.pointerLockElement === cv) {
      dx = e.movementX;
      dy = -e.movementY;
    } else if (drag || hover) {
      if (prev) {
        dx = e.clientX - prev[0];
        dy = -(e.clientY - prev[1]);
      }
      prev = [e.clientX, e.clientY];
    }
    yaw -= dx * SENS;
    pitch = clamp(pitch + dy * SENS, -1.4, 1.4);
  });
  cv.addEventListener('mousedown', e => { if (e.button === 1) { drag = 1; prev = null; } });
  window.addEventListener('mouseup', e => { if (e.button === 1) drag = 0; });
  window.addEventListener('contextmenu', e => e.preventDefault());

  let gp = null;
  function pollGP() {
    const gs = navigator.getGamepads?.();
    gp = gs ? gs[0] : null;
  }

  function rc(o, d, max) {
    let x = Math.floor(o[0]);
    let y = Math.floor(o[1]);
    let z = Math.floor(o[2]);
    const sx = d[0] > 0 ? 1 : -1;
    const sy = d[1] > 0 ? 1 : -1;
    const sz = d[2] > 0 ? 1 : -1;
    const tdx = Math.abs(1 / (d[0] || 1e-9));
    const tdy = Math.abs(1 / (d[1] || 1e-9));
    const tdz = Math.abs(1 / (d[2] || 1e-9));
    let tx = (sx > 0 ? (x + 1 - o[0]) : (o[0] - x)) * tdx;
    let ty = (sy > 0 ? (y + 1 - o[1]) : (o[1] - y)) * tdy;
    let tz = (sz > 0 ? (z + 1 - o[2]) : (o[2] - z)) * tdz;
    let t = 0;
    let nx = 0, ny = 0, nz = 0;
    while (t <= max) {
      if (!inW(x, y, z)) return null;
      const id = getId(x, y, z);
      if (id !== I.AIR) return { x, y, z, n: [-nx, -ny, -nz], id };
      if (tx < ty) {
        if (tx < tz) {
          x += sx; t = tx; tx += tdx; nx = sx; ny = 0; nz = 0;
        } else {
          z += sz; t = tz; tz += tdz; nx = 0; ny = 0; nz = sz;
        }
      } else {
        if (ty < tz) {
          y += sy; t = ty; ty += tdy; nx = 0; ny = sy; nz = 0;
        } else {
          z += sz; t = tz; tz += tdz; nx = 0; ny = 0; nz = sz;
        }
      }
    }
    return null;
  }

  window.addEventListener('mousedown', e => {
    if (e.button !== 0 && e.button !== 2) return;
    const h = rc(eye(), fwd(), RAY);
    if (e.button === 0 && h) {
      setId(h.x, h.y, h.z, I.AIR);
      rebuildAround(h.x, h.y, h.z);
      sfx('break');
    }
    if (e.button === 2 && h) {
      const x = h.x + h.n[0];
      const y = h.y + h.n[1];
      const z = h.z + h.n[2];
      if (!inW(x, y, z)) return;
      const id = HOT[sel];
      if (id === I.WAT) return;
      if (!(pos[0] + 0.3 <= x || pos[0] - 0.3 >= x + 1 || pos[1] + 1.8 <= y || pos[1] >= y + 1 || pos[2] + 0.3 <= z || pos[2] - 0.3 >= z + 1)) return;
      setId(x, y, z, id);
      rebuildAround(x, y, z);
      sfx('place');
    }
  });

  function rebuildAround(x, y, z) {
    const cx = Math.floor(x / W.CH);
    const cy = Math.floor(y / W.CH);
    const cz = Math.floor(z / W.CH);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          const k = k3(cx + dx, cy + dy, cz + dz);
          const c = CH.get(k);
          if (c) c.d = 1;
        }
      }
    }
  }

  function aabbStep(a, dt) {
    pos[a] += vel[a] * dt;
    const half = 0.3;
    const minX = Math.floor(pos[0] - half);
    const maxX = Math.floor(pos[0] + half);
    const minY = Math.floor(pos[1]);
    const maxY = Math.floor(pos[1] + 1.8);
    const minZ = Math.floor(pos[2] - half);
    const maxZ = Math.floor(pos[2] + half);
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        for (let x = minX; x <= maxX; x++) {
          const id = getId(x, y, z);
          if (id === I.AIR || id === I.LEA || id === I.WAT) continue;
          if (a === 0) {
            pos[0] = vel[0] > 0 ? x - half : x + 1 + half;
            vel[0] = 0;
          } else if (a === 1) {
            if (vel[1] > 0) pos[1] = y - 1.8;
            else { pos[1] = y + 1; ground = 1; }
            vel[1] = 0;
          } else {
            pos[2] = vel[2] > 0 ? z - half : z + 1 + half;
            vel[2] = 0;
          }
        }
      }
    }
  }

  const mmVis = HUD.mm;
  let mmOff = null;
  let mmCtx = null;
  if ('OffscreenCanvas' in window) {
    mmOff = new OffscreenCanvas(64, 64);
    mmCtx = mmOff.getContext('2d');
  } else {
    mmOff = mmVis;
    mmCtx = mmVis.getContext('2d');
  }

  function drawMini() {
    const ctx2d = mmCtx;
    const R = 64;
    const px = pos[0];
    const pz = pos[2];
    const img = ctx2d.createImageData(R, R);
    for (let dz = 0; dz < R; dz++) {
      for (let dx = 0; dx < R; dx++) {
        const wx = Math.floor(px - 32 + dx);
        const wz = Math.floor(pz - 32 + dz);
        let c = [0, 0, 0];
        for (let y = W.Y - 1; y >= 0; y--) {
          const id = getId(wx, y, wz);
          if (id !== I.AIR) {
            c = COL(id);
            break;
          }
        }
        const i = (dz * R + dx) * 4;
        img.data[i] = c[0] * 255;
        img.data[i + 1] = c[1] * 255;
        img.data[i + 2] = c[2] * 255;
        img.data[i + 3] = 255;
      }
    }
    ctx2d.putImageData(img, 0, 0);
    if (mmOff !== mmVis) {
      createImageBitmap(mmOff).then(bm => {
        const c2 = mmVis.getContext('2d');
        c2.clearRect(0, 0, 64, 64);
        c2.drawImage(bm, 0, 0);
      });
    }
    const c2 = mmVis.getContext('2d');
    c2.strokeStyle = 'white';
    c2.strokeRect(0, 0, 64, 64);
    c2.fillStyle = 'white';
    c2.fillRect(31, 31, 2, 2);
  }

  let AC = null;
  let master = null;
  let lp = null;
  function initAudio() {
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain();
      master.gain.value = 0.4;
      lp = AC.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 16000;
      master.connect(lp).connect(AC.destination);
    } catch (err) {
      console.warn('Audio init failed', err);
    }
  }
  function beep(freq = 440, dur = 0.06, vol = 0.2) {
    if (!AC) return;
    const o = AC.createOscillator();
    const g = AC.createGain();
    o.type = 'triangle';
    o.frequency.value = freq;
    o.connect(g).connect(master);
    const t = AC.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.start(t);
    o.stop(t + dur);
  }
  function sfx(kind) {
    if (kind === 'place') beep(660, 0.05, 0.15);
    else if (kind === 'break') beep(220, 0.08, 0.18);
  }

  const DBN = 'tinycraft-db';
  const ST = 'world';
  function idbOpen() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(DBN, 1);
      r.onupgradeneeded = () => { r.result.createObjectStore(ST); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  async function idbPut(key, val) {
    try {
      const db = await idbOpen();
      const tx = db.transaction(ST, 'readwrite');
      tx.objectStore(ST).put(val, key);
      return await new Promise((res, rej) => {
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
    } catch (e) {
      console.warn('idbPut', e);
    }
  }
  async function idbGet(key) {
    try {
      const db = await idbOpen();
      const tx = db.transaction(ST);
      const req = tx.objectStore(ST).get(key);
      return await new Promise((res, rej) => {
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
    } catch (e) {
      console.warn('idbGet', e);
      return null;
    }
  }
  async function save() {
    const arr = [];
    edits.forEach((v, i) => arr.push([i, v]));
    const payload = { seed, pos, ed: arr };
    await idbPut('save', payload);
    localStorage.tc_seed = seed;
  }
  async function load() {
    const d = await idbGet('save');
    if (!d) {
      console.log('no save');
      return;
    }
    seed = d.seed || seed;
    RNG = m32(h32(seed));
    pos = d.pos || pos;
    edits.clear();
    for (const [i, v] of (d.ed || [])) edits.set(i, v);
    CH.clear();
    respawn();
  }
  HUD.btnSave.onclick = () => save();
  HUD.btnLoad.onclick = () => load();

  function rebuildSome() {
    let b = 0;
    for (const [, c] of CH) {
      if (c.d && !c.req) {
        requestBuild(c);
        b++;
        if (b >= 16) break;
      }
    }
  }

  function bootstrap(rad = 3) {
    const cx = Math.floor(pos[0] / W.CH);
    const cz = Math.floor(pos[2] / W.CH);
    for (let cy = 0; cy < Math.ceil(W.Y / W.CH); cy++) {
      for (let dz = -rad; dz <= rad; dz++) {
        for (let dx = -rad; dx <= rad; dx++) {
          const k = k3(cx + dx, cy, cz + dz);
          const c = { p: [cx + dx, cy, cz + dz], d: 1 };
          CH.set(k, c);
        }
      }
    }
  }

  HUD.btnFS.onclick = () => {
    const D = document;
    if (!D.fullscreenElement) {
      cv.requestFullscreen?.();
    } else {
      D.exitFullscreen?.();
    }
  };
  HUD.btnAim.onclick = () => cv.requestPointerLock?.();
  cv.addEventListener('click', () => {
    if (!AC) initAudio();
    if (document.pointerLockElement !== cv) cv.requestPointerLock?.();
  });

  respawn();
  bootstrap(3);
  let last = performance.now();
  let acc = 0;
  let fc = 0;
  gl.clearColor(0.53, 0.71, 0.95, 1);

  function drawChunk(c) {
    if (c.vaoS) {
      vaoHelper.bind(c.vaoS);
    } else if (c.sb) {
      gl.bindBuffer(gl.ARRAY_BUFFER, c.sb);
      gl.enableVertexAttribArray(L.p);
      gl.enableVertexAttribArray(L.n);
      gl.enableVertexAttribArray(L.c);
      gl.enableVertexAttribArray(L.t);
      gl.vertexAttribPointer(L.p, 3, gl.FLOAT, false, 40, 0);
      gl.vertexAttribPointer(L.n, 3, gl.FLOAT, false, 40, 12);
      gl.vertexAttribPointer(L.c, 3, gl.FLOAT, false, 40, 24);
      gl.vertexAttribPointer(L.t, 1, gl.FLOAT, false, 40, 36);
    }
    gl.drawArrays(gl.TRIANGLES, 0, c.sc);
    if (c.vaoS) vaoHelper.unbind();
  }

  function drawWater(c) {
    if (c.vaoW) {
      vaoHelper.bind(c.vaoW);
    } else if (c.wb) {
      gl.bindBuffer(gl.ARRAY_BUFFER, c.wb);
      gl.enableVertexAttribArray(L.p);
      gl.enableVertexAttribArray(L.n);
      gl.enableVertexAttribArray(L.c);
      gl.enableVertexAttribArray(L.t);
      gl.vertexAttribPointer(L.p, 3, gl.FLOAT, false, 40, 0);
      gl.vertexAttribPointer(L.n, 3, gl.FLOAT, false, 40, 12);
      gl.vertexAttribPointer(L.c, 3, gl.FLOAT, false, 40, 24);
      gl.vertexAttribPointer(L.t, 1, gl.FLOAT, false, 40, 36);
    }
    gl.drawArrays(gl.TRIANGLES, 0, c.wc);
    if (c.vaoW) vaoHelper.unbind();
  }

  function step(t) {
    const dt = Math.min((t - last) / 1000, 0.05);
    last = t;
    fc++;
    acc += dt;
    if (acc > 0.4) {
      HUD.fps.textContent = 'FPS ' + Math.round(fc / acc) + ' | chunks ' + CH.size + ' | inflight ' + workerQueue.inflight();
      fc = 0;
      acc = 0;
    }

    pollGP();
    const sprint = (k.has('ShiftLeft') || k.has('ShiftRight') || (gp && gp.buttons[10]?.pressed));
    const f = flat();
    const r = right();
    let mx = 0;
    let mz = 0;
    if (k.has('KeyW')) { mx += f[0]; mz += f[2]; }
    if (k.has('KeyS')) { mx -= f[0]; mz -= f[2]; }
    if (k.has('KeyA')) { mx += r[0]; mz += r[2]; }
    if (k.has('KeyD')) { mx -= r[0]; mz -= r[2]; }
    if (gp) {
      mx += gp.axes[0] || 0;
      mz += gp.axes[1] ? -(gp.axes[1]) : 0;
      yaw -= (gp.axes[2] || 0) * SENS * 18;
      pitch = clamp(pitch + (-(gp.axes[3] || 0)) * SENS * 18, -1.4, 1.4);
    }
    const headW = getId(pos[0] | 0, (pos[1] + 1.5) | 0, pos[2] | 0) === I.WAT;
    const bodyW = getId(pos[0] | 0, (pos[1] + 0.9) | 0, pos[2] | 0) === I.WAT;
    const feetW = getId(pos[0] | 0, (pos[1] + 0.2) | 0, pos[2] | 0) === I.WAT;
    const inWtr = headW || bodyW || feetW;
    if (AC) {
      lp.frequency.setTargetAtTime(inWtr ? 1200 : 16000, AC.currentTime, 0.08);
    }
    const spd = (sprint ? SPD2 : SPD) * (inWtr ? 0.38 : 1);
    const Lm = Math.hypot(mx, mz);
    if (Lm > 1e-6) {
      vel[0] = (mx / Lm) * spd;
      vel[2] = (mz / Lm) * spd;
    } else {
      vel[0] = vel[2] = 0;
    }
    if (inWtr) {
      if (k.has('Space') || (gp && gp.buttons[0]?.pressed)) vel[1] += 6 * dt;
      if (k.has('ControlLeft') || k.has('ControlRight') || (gp && gp.buttons[1]?.pressed)) vel[1] -= 6 * dt;
      vel[1] -= GRV * 0.25 * dt;
      if (feetW) vel[1] += 1.5 * dt;
      vel[1] = clamp(vel[1], -3, 3);
    } else {
      if ((k.has('Space') || k.has('KeyX') || (gp && gp.buttons[0]?.pressed)) && ground) {
        vel[1] = JMP;
        ground = 0;
      }
      vel[1] -= GRV * dt;
    }

    aabbStep(0, dt);
    aabbStep(1, dt);
    aabbStep(2, dt);

    ensureChunks(pos[0], pos[2]);
    rebuildSome();

    const asp = cv.width / cv.height;
    const proj = perspective(Math.PI / 3, asp, 0.1, 600);
    const e = eye();
    const dir = fwd();
    const cen = [e[0] + dir[0], e[1] + dir[1], e[2] + dir[2]];
    const view = lookAt(e, cen, [0, 1, 0]);
    const uw = getId(e[0] | 0, e[1] | 0, e[2] | 0) === I.WAT;
    const fog = uw ? 120 : fogD;
    gl.clearColor(uw ? 0.35 : 0.53, uw ? 0.6 : 0.71, uw ? 0.9 : 0.95, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(PG);
    gl.uniformMatrix4fv(L.P, false, proj);
    gl.uniformMatrix4fv(L.V, false, view);
    const sun = [0.6, 0.7, 0.2];
    gl.uniform3f(L.L, sun[0], sun[1], sun[2]);
    gl.uniform3f(L.FC, fogC[0], fogC[1], fogC[2]);
    gl.uniform1f(L.FD, fog);
    gl.uniform1f(L.TIME, t * 0.001);
    gl.uniform1f(L.UW, uw ? 1 : 0);

    for (const [, c] of CH) {
      if (c.sb && c.sc) {
        drawChunk(c);
      }
    }
    gl.depthMask(false);
    for (const [, c] of CH) {
      if (c.wb && c.wc) {
        drawWater(c);
      }
    }
    gl.depthMask(true);

    if ((t | 0) % 6 === 0) drawMini();
    requestAnimationFrame(step);
  }

  requestAnimationFrame(step);

  (function () {
    if (!('serviceWorker' in navigator)) return;
    if (!location.protocol.startsWith('http')) return;
    try {
      const swSrc = `self.addEventListener('install',e=>{e.waitUntil(caches.open('tcache').then(c=>c.addAll([location.pathname||'./'])))});self.addEventListener('fetch',e=>{e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)))})`;
      const swURL = URL.createObjectURL(new Blob([swSrc], { type: 'text/javascript' }));
      navigator.serviceWorker.register(swURL).catch(() => {});
      const man = { name: 'TinyCraft', short_name: 'TinyCraft', display: 'standalone', start_url: '.', icons: [] };
      const mURL = URL.createObjectURL(new Blob([JSON.stringify(man)], { type: 'application/json' }));
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = mURL;
      document.head.appendChild(link);
    } catch (e) {
      console.log('SW/manifest skipped', e);
    }
  })();

  try {
    const M = lookAt([0, 0, 0], [0, 0, -1], [0, 1, 0]);
    console.assert(M instanceof Float32Array && M.length === 16, 'lookAt() matrix');
    console.info('[GL2]', isWebGL2, '[VAO]', vaoHelper.isSupported());
  } catch (e) {
    console.warn('sanity', e);
  }
}
