# WebGL helpers

Reusable utilities for projects that render with WebGL/WebGL2.

- `context.js` – create a context once and opt-in to automatic canvas resizing.
- `shaders.js` – compile individual shaders and link them into programs with helpful errors.
- `buffers.js` – convenience helpers for buffer uploads plus a vertex-array wrapper that works with WebGL2 or the `OES_vertex_array_object` extension.
- `math.js` – minimal matrix helpers (`perspective` + `lookAt`) for camera setup.
- `worker.js` – helper helpers for spawning workers and simple inflight queues, handy when offloading chunk meshing.

Each module is standalone ES modules so demos can cherry-pick what they need:

```js
import { createGLContext, autoResize } from '../../game-lib/render/webgl/context.js';
import { createProgram } from '../../game-lib/render/webgl/shaders.js';
import { createVertexArrayHelper } from '../../game-lib/render/webgl/buffers.js';
import { perspective, lookAt } from '../../game-lib/render/webgl/math.js';
```

The helpers do not impose any scene structure—they simply reduce the boilerplate around context setup so games like TinyCraft can share the same GL plumbing.
