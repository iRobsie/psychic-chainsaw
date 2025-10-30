export function createBuffer(gl, { target = gl.ARRAY_BUFFER, data = null, usage = gl.STATIC_DRAW } = {}) {
  const buffer = gl.createBuffer();
  if (!buffer) {
    throw new Error('Unable to create buffer');
  }
  gl.bindBuffer(target, buffer);
  if (data) {
    gl.bufferData(target, data, usage);
  }
  return buffer;
}

export function updateBuffer(gl, buffer, data, { target = gl.ARRAY_BUFFER, usage = gl.STATIC_DRAW } = {}) {
  gl.bindBuffer(target, buffer);
  gl.bufferData(target, data, usage);
}

export function createVertexArrayHelper({ gl, gl2 = null, vaoExt = null }) {
  const isWebGL2 = !!gl2;
  const ext = !isWebGL2 ? vaoExt || gl.getExtension('OES_vertex_array_object') : null;

  function withVertexArray(setup) {
    if (isWebGL2) {
      const vao = gl2.createVertexArray();
      gl2.bindVertexArray(vao);
      setup();
      gl2.bindVertexArray(null);
      return vao;
    }
    if (ext) {
      const vao = ext.createVertexArrayOES();
      ext.bindVertexArrayOES(vao);
      setup();
      ext.bindVertexArrayOES(null);
      return vao;
    }
    setup();
    return null;
  }

  function bindVertexArray(vao) {
    if (!vao) return;
    if (isWebGL2) {
      gl2.bindVertexArray(vao);
    } else if (ext) {
      ext.bindVertexArrayOES(vao);
    }
  }

  function unbindVertexArray() {
    if (isWebGL2) {
      gl2.bindVertexArray(null);
    } else if (ext) {
      ext.bindVertexArrayOES(null);
    }
  }

  function deleteVertexArray(vao) {
    if (!vao) return;
    if (isWebGL2) {
      gl2.deleteVertexArray(vao);
    } else if (ext) {
      ext.deleteVertexArrayOES(vao);
    }
  }

  return {
    create: withVertexArray,
    bind: bindVertexArray,
    unbind: unbindVertexArray,
    delete: deleteVertexArray,
    isSupported: () => isWebGL2 || !!ext,
  };
}
