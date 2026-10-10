import { runClassic } from "./classic-vm.mjs";

self.addEventListener("message", (event) => {
  const { id, source, stdin, maxSteps, maxOutput, traceLimit } = event.data;
  try {
    const result = runClassic(source, stdin, {
      maxSteps,
      maxOutput,
      traceLimit,
      onProgress(steps) {
        self.postMessage({ id, type: "progress", steps, maxSteps });
      },
    });
    self.postMessage({ id, type: "done", result });
  } catch (error) {
    self.postMessage({ id, type: "error", message: error.message });
  }
});
