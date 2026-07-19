import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

const modelAssetPath = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
let tracker: HandLandmarker | null = null;
let trackerPromise: Promise<HandLandmarker> | null = null;

async function prepareTracker() {
  if (tracker) return tracker;
  if (trackerPromise) return trackerPromise;

  trackerPromise = (async () => {
    const files = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm");
    const options = {
      baseOptions: { modelAssetPath, delegate: "GPU" as const },
      runningMode: "VIDEO" as const,
      numHands: 1,
      minHandDetectionConfidence: .55,
      minHandPresenceConfidence: .55,
      minTrackingConfidence: .55,
    };

    try {
      return await HandLandmarker.createFromOptions(files, options);
    } catch {
      return await HandLandmarker.createFromOptions(files, {
        ...options,
        baseOptions: { modelAssetPath, delegate: "CPU" as const },
      });
    }
  })();

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
      trackerPromise = null;
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
