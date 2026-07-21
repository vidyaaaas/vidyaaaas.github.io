import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

const modelAssetPath = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const wasmAssetPath = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";

let tracker: HandLandmarker | null = null;
let trackerPromise: Promise<HandLandmarker> | null = null;

async function prepareTracker() {
  if (tracker) return tracker;
  if (trackerPromise) return trackerPromise;

  trackerPromise = (async () => {
    const files = await FilesetResolver.forVisionTasks(wasmAssetPath, true);
    return HandLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath, delegate: "CPU" },
      runningMode: "VIDEO",
      numHands: 1,
      minHandDetectionConfidence: 0.48,
      minHandPresenceConfidence: 0.48,
      minTrackingConfidence: 0.48,
    });
  })().catch(error => {
    trackerPromise = null;
    throw error;
  });

  tracker = await trackerPromise;
  return tracker;
}

self.addEventListener("message", async (event: MessageEvent) => {
  const message = event.data as
    | { type: "init" }
    | { type: "frame"; frame: ImageBitmap | ImageData; timestamp: number };

  if (message.type === "init") {
    const started = performance.now();
    try {
      await prepareTracker();
      self.postMessage({ type: "ready", initializationMs: performance.now() - started });
    } catch (error) {
      self.postMessage({ type: "error", stage: "init", message: error instanceof Error ? error.message : "Hand AI could not initialize" });
    }
    return;
  }

  const started = performance.now();
  try {
    const handLandmarker = await prepareTracker();
    const result = handLandmarker.detectForVideo(message.frame, message.timestamp);
    const hand = result.landmarks?.[0]?.map(point => ({ x: point.x, y: point.y })) ?? null;
    if ("close" in message.frame) message.frame.close();
    self.postMessage({
      type: "result",
      hand,
      timestamp: message.timestamp,
      inferenceMs: performance.now() - started,
    });
  } catch (error) {
    if ("close" in message.frame) message.frame.close();
    self.postMessage({
      type: "error",
      stage: "frame",
      timestamp: message.timestamp,
      message: error instanceof Error ? error.message : "Hand frame could not be processed",
    });
  }
});
