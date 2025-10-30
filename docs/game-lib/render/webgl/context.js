export function createGLContext(canvas, {
  preferWebGL2 = true,
  attributes = { antialias: true, alpha: false },
  extensions = []
} = {}) {
  if (!canvas) {
    throw new Error('createGLContext: canvas element is required');
  }

  let gl2 = null;
  if (preferWebGL2) {
    gl2 = canvas.getContext('webgl2', attributes) || null;
  }
  const gl = gl2 || canvas.getContext('webgl', attributes);
  if (!gl) {
    throw new Error('WebGL not supported');
  }

  const acquiredExtensions = {};
  const needed = Array.isArray(extensions) ? extensions : [extensions];
  for (const name of needed) {
    if (!name) continue;
    if (gl2 && name === 'OES_vertex_array_object') {
      // WebGL2 has native vertex array objects – skip extension lookup.
      continue;
    }
    acquiredExtensions[name] = gl.getExtension(name) || null;
  }

  return {
    gl,
    gl2,
    isWebGL2: !!gl2,
    canvas,
    extensions: acquiredExtensions,
  };
}

export function resizeCanvasToDisplaySize(gl, {
  canvas = gl.canvas,
  maxPixelRatio = 2,
  width,
  height,
} = {}) {
  if (!canvas) return { width: 0, height: 0, pixelRatio: 1 };
  const pixelRatio = Math.min(window.devicePixelRatio || 1, maxPixelRatio);
  let displayWidth = width;
  let displayHeight = height;
  if (displayWidth == null || displayHeight == null) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width && rect.height) {
      displayWidth = Math.floor(rect.width * pixelRatio);
      displayHeight = Math.floor(rect.height * pixelRatio);
    } else {
      displayWidth = Math.floor((width ?? window.innerWidth) * pixelRatio);
      displayHeight = Math.floor((height ?? window.innerHeight) * pixelRatio);
    }
  }

  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;
  }
  gl.viewport(0, 0, canvas.width, canvas.height);
  return { width: canvas.width, height: canvas.height, pixelRatio };
}

export function autoResize(gl, {
  canvas = gl.canvas,
  maxPixelRatio = 2,
  width,
  height,
} = {}) {
  function resize() {
    return resizeCanvasToDisplaySize(gl, { canvas, maxPixelRatio, width, height });
  }
  const handler = () => resize();
  window.addEventListener('resize', handler, { passive: true });
  const info = resize();
  return {
    info,
    dispose() {
      window.removeEventListener('resize', handler);
    },
    resize,
  };
}
