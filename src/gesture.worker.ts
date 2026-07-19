import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

const modelAssetPath = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
let tracker: HandLandmarker | null = null;
let trackerPromise: Promise<HandLandmarker> | null = null;

async function prepareTracker() {
  if (tracker) return tracker;
  if (trackerPromise) return trackerPromise;

  trackerPromise = (async () => {
    const files = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm");
    return HandLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath, delegate: "CPU" },
      runningMode: "VIDEO",
      numHands: 1,
      minHandDetectionConfidence: .48,
      minHandPresenceConfidence: .48,
      minTrackingConfidence: .48,
    });
  })().catch(error => {
    trackerPromise = null;
    throw error;
  });

  tracker = await trackerPromise;
  return tracker;
}

self.addEventListener("message", async (event: MessageEvent) => {
  const message = event.data as { type: "init" } | { type: "frame"; frame: ImageBitmap | ImageData; timestamp: number };

  if (message.type === "init") {
    try {
      await prepareTracker();
      self.postMessage({ type: "ready" });
    } catch {
      self.postMessage({ type: "error", stage: "init" });
    }
    return;
  }

  try {
    const handLandmarker = await prepareTracker();
    const result = handLandmarker.detectForVideo(message.frame, message.timestamp);
    const hand = result.landmarks?.[0]?.map(point => ({ x: point.x, y: point.y })) ?? null;
    if (message.frame instanceof ImageBitmap) message.frame.close();
    self.postMessage({ type: "result", hand, timestamp: message.timestamp });
  } catch {
    if (message.frame instanceof ImageBitmap) message.frame.close();
    self.postMessage({ type: "error", stage: "frame", timestamp: message.timestamp });
  }
});
