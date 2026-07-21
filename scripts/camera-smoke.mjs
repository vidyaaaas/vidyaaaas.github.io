import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const port = 9333;
const profile = mkdtempSync(join(tmpdir(), "vidya-portfolio-camera-"));
const browser = spawn(edge, [
  "--headless=new",
  "--no-first-run",
  "--no-default-browser-check",
  "--use-fake-ui-for-media-stream",
  "--use-fake-device-for-media-stream",
  "--disable-background-timer-throttling",
  "--disable-renderer-backgrounding",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  "http://127.0.0.1:4173/",
], { stdio: "ignore" });

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function getTarget() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
      const target = targets.find(item => item.type === "page" && item.url.includes("127.0.0.1:4173"));
      if (target) return target;
    } catch { /* browser is still starting */ }
    await delay(250);
  }
  throw new Error("Edge debugging target did not start");
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.addEventListener("open", () => resolve(socket), { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
}

let socket;
let sequence = 0;
const pending = new Map();
const consoleMessages = [];

function send(method, params = {}) {
  const id = ++sequence;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression, attempts = 30) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (response.exceptionDetails) throw new Error(response.exceptionDetails.text || "Browser evaluation failed");
      return response.result.value;
    } catch (error) {
      if (!String(error).toLowerCase().includes("execution context") || attempt === attempts - 1) throw error;
      await delay(100);
    }
  }
}

try {
  const target = await getTarget();
  socket = await connect(target.webSocketDebuggerUrl);
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const operation = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) operation.reject(new Error(message.error.message));
      else operation.resolve(message.result);
      return;
    }
    if (message.method === "Runtime.consoleAPICalled") {
      consoleMessages.push(message.params.args.map(arg => arg.value ?? arg.description ?? "").join(" "));
    }
  });

  await send("Runtime.enable");
  await send("Page.enable");
  await evaluate(`new Promise(resolve => {
    if (document.readyState === "complete") resolve();
    else addEventListener("load", resolve, { once: true });
  })`);
  const waitForPortfolio = () => evaluate(`new Promise((resolve, reject) => {
      const started = performance.now();
      const poll = () => {
        if (document.querySelector(".gestureBtn")) resolve();
        else if (performance.now() - started > 10000) reject(new Error("Portfolio UI did not mount"));
        else setTimeout(poll, 50);
      };
      poll();
    })`);
  const runCameraFlow = async () => {
    await waitForPortfolio();
    await evaluate(`document.querySelector(".gestureBtn").click()`);
    return evaluate(`new Promise(resolve => {
      const started = performance.now();
      const poll = () => {
        const button = document.querySelector(".gestureBtn")?.textContent || "";
        const video = document.querySelector("video");
        if (button.includes("GESTURES LIVE") || button.includes("RETRY HAND AI") || button.includes("RETRY CAMERA") || performance.now() - started > 70000) {
          resolve({
            button,
            elapsedMs: performance.now() - started,
            videoReadyState: video?.readyState ?? -1,
            hasStream: Boolean(video?.srcObject),
            measures: performance.getEntriesByType("measure")
              .filter(entry => entry.name.startsWith("gesture:"))
              .map(entry => ({ name: entry.name, duration: entry.duration })),
          });
        } else setTimeout(poll, 100);
      };
      poll();
    })`);
  };

  const result = await runCameraFlow();

  const frameHealth = await evaluate(`new Promise(resolve => {
    const gaps = [];
    let frames = 0;
    let previous = performance.now();
    const started = previous;
    const frame = now => {
      gaps.push(now - previous);
      previous = now;
      frames += 1;
      if (now - started >= 2000) resolve({ frames, maxGapMs: Math.max(...gaps), averageGapMs: (now - started) / frames });
      else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  })`);

  await send("Page.reload", { ignoreCache: false });
  await delay(1000);
  const warmResult = await runCameraFlow();

  const interactions = await evaluate(`(async () => {
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const activeCard = document.querySelector(".orbCard.active");
    activeCard?.click();
    await wait(100);
    const detailOpened = Boolean(document.querySelector(".detail"));
    document.querySelector(".detail .close")?.click();
    const transformAfterClose = activeCard?.style.transform || "";
    await wait(450);
    const orbitResumed = transformAfterClose !== (activeCard?.style.transform || "");

    const navButtons = [...document.querySelectorAll("nav button")];
    navButtons.find(button => button.textContent.includes("CONTACT"))?.click();
    await wait(50);
    const contact = document.querySelector(".contactPanel")?.textContent || "";
    const contactOpened = contact.includes("singhvidya623@gmail.com") && contact.includes("+91 62904 24147");
    document.querySelector(".contactPanel .close")?.click();

    navButtons.find(button => button.textContent.includes("GESTURE GUIDE"))?.click();
    await wait(50);
    const guideOpened = Boolean(document.querySelector(".guidePanel"));
    dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await wait(50);
    const guideClosedWithEscape = !document.querySelector(".guidePanel");
    return { detailOpened, orbitResumed, contactOpened, guideOpened, guideClosedWithEscape };
  })()`);

  console.log(JSON.stringify({ result, warmResult, frameHealth, interactions, consoleMessages: consoleMessages.filter(message => message.includes("Gesture timing")) }, null, 2));
  if (!result.hasStream || result.videoReadyState < 2 || !result.button.includes("GESTURES LIVE") || !warmResult.button.includes("GESTURES LIVE") || Object.values(interactions).some(value => !value)) process.exitCode = 1;
} finally {
  socket?.close();
  browser.kill();
  await delay(300);
  if (profile.startsWith(join(tmpdir(), "vidya-portfolio-camera-"))) {
    try { rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 250 }); } catch { /* Edge can briefly retain profile files */ }
  }
}
