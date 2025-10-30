export function spawnWorker(url, options = {}) {
  if (typeof Worker === 'undefined') {
    return null;
  }
  try {
    return new Worker(url, options);
  } catch (err) {
    console.warn('spawnWorker failed', err);
    return null;
  }
}

export function createWorkerQueue(worker, { maxInflight = 4 } = {}) {
  if (!worker) {
    return {
      post() {
        return false;
      },
      release() {},
      inflight: () => 0,
      terminate() {},
    };
  }

  let inflight = 0;
  const queue = [];

  function flush() {
    while (inflight < maxInflight && queue.length) {
      const job = queue.shift();
      inflight++;
      worker.postMessage(job.message, job.transfer);
    }
  }

  return {
    post(message, transfer = []) {
      queue.push({ message, transfer });
      flush();
      return true;
    },
    release() {
      if (inflight > 0) inflight--;
      flush();
    },
    inflight: () => inflight,
    terminate() {
      worker.terminate();
      inflight = 0;
      queue.length = 0;
    },
  };
}
