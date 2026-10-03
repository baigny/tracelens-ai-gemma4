import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

const XNNPACK_NOTICE = "INFO: Created TensorFlow Lite XNNPACK delegate for CPU.";
let pendingInitializations = 0;
let restoreLogging: (() => void) | undefined;

function routeInitializationNotice() {
  if (pendingInitializations === 0) {
    const originalError = console.error;
    const routedError: typeof console.error = (...args: unknown[]) => {
      if (args.length === 1 && typeof args[0] === "string" && args[0].trim() === XNNPACK_NOTICE) {
        console.info(args[0]);
      } else {
        originalError.apply(console, args);
      }
    };
    // The WASM runtime captures console.error.bind(console) during creation.
    // Its captured logger also handles the notice emitted on first inference.
    console.error = routedError;
    restoreLogging = () => {
      if (console.error === routedError) console.error = originalError;
    };
  }
  pendingInitializations++;
  return () => {
    if (--pendingInitializations === 0) {
      restoreLogging?.();
      restoreLogging = undefined;
    }
  };
}

export async function createHandLandmarker() {
  const files = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm",
  );
  const restore = routeInitializationNotice();
  try {
    return await HandLandmarker.createFromOptions(files, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        delegate: "CPU",
      },
      runningMode: "VIDEO",
      numHands: 1,
    });
  } finally {
    restore();
  }
}
