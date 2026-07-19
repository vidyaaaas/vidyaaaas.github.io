"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Slide = { id: string; eyebrow: string; title: string; short: string; description: string; tags: string[]; link?: string; accent: string; stat: string; statLabel: string };

type HandPoint = { x: number; y: number };
type GestureWorkerMessage = { type: "ready" } | { type: "result"; hand: HandPoint[] | null; timestamp: number } | { type: "error"; stage: "init" | "frame"; timestamp?: number };
let gestureWorkerPromise: Promise<Worker> | null = null;

function loadGestureWorker() {
  if (gestureWorkerPromise) return gestureWorkerPromise;
  gestureWorkerPromise = new Promise<Worker>((resolve, reject) => {
    const worker = new Worker(new URL("./gesture.worker.ts", import.meta.url), { type: "module" });
    const cleanup = () => {
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
    };
    const handleMessage = (event: MessageEvent<GestureWorkerMessage>) => {
      if (event.data.type === "ready") {
        cleanup();
        resolve(worker);
      } else if (event.data.type === "error" && event.data.stage === "init") {
        cleanup();
        worker.terminate();
        reject(new Error("Gesture engine initialization failed"));
      }
    };
    const handleError = () => {
      cleanup();
      worker.terminate();
      reject(new Error("Gesture engine failed"));
    };
    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);
    worker.postMessage({ type: "init" });
  }).catch(error => {
    gestureWorkerPromise = null;
    throw error;
  });
  return gestureWorkerPromise;
}

const slides: Slide[] = [
  { id: "intro", eyebrow: "01 / PROFILE", title: "Vidya Singh", short: "AI engineer building systems that can see, reason and respond.", description: "Computer Science & Artificial Intelligence student in Kolkata, focused on reliable computer vision, full-stack workflows and production-ready software.", tags: ["Computer Vision", "AI / ML", "Software Engineering"], accent: "#ffe8b5", stat: "2026", statLabel: "B.Tech · MSIT" },
  { id: "spare", eyebrow: "02 / FEATURED BUILD", title: "Spare Part Recognition", short: "A vision system for identifying real-world industrial components.", description: "Modular Python and OpenCV recognition with preprocessing, feature matching, metadata lookup, structured predictions and evaluation reports—designed for reliable end-to-end use.", tags: ["Python", "OpenCV", "FastAPI-ready"], link: "https://github.com/vidyaaaas/spare-part-recognition", accent: "#d9944a", stat: "E2E", statLabel: "Recognition workflow" },
  { id: "landmark", eyebrow: "03 / COMPUTER VISION", title: "Landmark Detection", short: "Transfer learning that turns pixels into places.", description: "Landmark classification using ResNet and InceptionV3, improved through data augmentation, hyperparameter tuning and model optimization.", tags: ["TensorFlow", "CNN", "Transfer Learning"], link: "https://github.com/vidyaaaas/Landmark-Detection-2", accent: "#f1c878", stat: "85–90%", statLabel: "Model accuracy" },
  { id: "research", eyebrow: "04 / PRODUCT THINKING", title: "App Research Case Study", short: "Research translated into clear, useful product decisions.", description: "A structured product research case study that connects user insight, problem framing and interface thinking into an actionable design narrative.", tags: ["Research", "UX Strategy", "Case Study"], link: "https://github.com/vidyaaaas/app-research-case-study", accent: "#b87537", stat: "360°", statLabel: "Product perspective" },
  { id: "deepfake", eyebrow: "05 / DEEP LEARNING", title: "Multi-Modal Deepfake Detection", short: "Detecting synthetic media across visual, pulse and audio signals.", description: "A modular pipeline combining rPPG, facial features and audio spectrograms, with evaluation and performance tracking across modalities.", tags: ["PyTorch", "rPPG", "Audio + Video"], accent: "#e1aa65", stat: "93.57%", statLabel: "Detection accuracy" },
  { id: "experience", eyebrow: "06 / EXPERIENCE", title: "AI Engineer Intern", short: "From experimental models to dependable application workflows.", description: "At Hari Chand Anand & Co., I build computer vision pipelines for spare-part recognition. Previously at Coincent.ai, I worked on Python, ML fundamentals and landmark detection.", tags: ["OpenCV", "Evaluation", "Backend Logic"], accent: "#fff0c2", stat: "2×", statLabel: "Engineering internships" },
];

const mod = (n: number, m: number) => ((n % m) + m) % m;

function MiniatureScene({ slide, expanded = false }: { slide: Slide; expanded?: boolean }) {
  return <span className={`miniScene${expanded ? " expanded" : ""}`} data-scene={slide.id} aria-hidden="true">
    <span className="sceneBackdrop" />
    <span className="sceneBeam" />
    <span className="sceneArchitecture" />
    <span className="sceneCore" />
    <span className="sceneFloor" />
    <span className="sceneDust" />
    <span className="sceneCaption"><i />{slide.stat}</span>
  </span>;
}

export default function Home() {
  const [selected, setSelected] = useState(0);
  const [open, setOpen] = useState<Slide | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [camera, setCamera] = useState<"idle" | "loading" | "warming" | "live" | "error">("idle");
  const [cameraError, setCameraError] = useState("");
  const [gesture, setGesture] = useState("Move to explore");
  const [handSeen, setHandSeen] = useState(false);
  const drag = useRef<{ active: boolean; x: number; moved: number; index: number | null }>({ active: false, x: 0, moved: 0, index: null });
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const orbitRaf = useRef(0);
  const handRaf = useRef(0);
  const rotRef = useRef(0);
  const pausedRef = useRef(false);
  const directionRef = useRef<1 | -1>(1);
  const selectedRef = useRef(0);
  const openRef = useRef<Slide | null>(null);
  const gestureRef = useRef(gesture);
  const handSeenRef = useRef(false);
  const cameraAutoStartRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const gestureWorkerRef = useRef<Worker | null>(null);
  const workerMessageHandlerRef = useRef<((event: MessageEvent<GestureWorkerMessage>) => void) | null>(null);
  const framePendingRef = useRef(false);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const updatePaused = useCallback((next: boolean) => {
    if (pausedRef.current === next) return;
    pausedRef.current = next;
    setPaused(next);
  }, []);

  const updateGesture = useCallback((next: string) => {
    if (gestureRef.current === next) return;
    gestureRef.current = next;
    setGesture(next);
  }, []);

  const updateHandSeen = useCallback((next: boolean) => {
    if (handSeenRef.current === next) return;
    handSeenRef.current = next;
    setHandSeen(next);
  }, []);

  const paintOrbit = useCallback((rotation: number) => {
    const nearest = mod(Math.round(-rotation / 60), slides.length);
    const selectionChanged = nearest !== selectedRef.current;
    if (selectionChanged) {
      selectedRef.current = nearest;
      setSelected(nearest);
    }

    cardRefs.current.forEach((card, i) => {
      if (!card) return;
      const angle = (rotation + i * 60) * Math.PI / 180;
      const sine = Math.sin(angle);
      const depth = Math.cos(angle);
      const x = (sine * 43).toFixed(3);
      const y = (Math.abs(sine) * 11 + (1 - depth) * 9).toFixed(3);
      const scale = (.58 + (depth + 1) * .27).toFixed(4);
      card.style.transform = `translate3d(-50%,-50%,0) translate3d(${x}vw,${y}vh,0) scale(${scale})`;
      card.style.opacity = `${.18 + (depth + 1) * .41}`;
      if (selectionChanged) {
        card.style.zIndex = `${Math.round((depth + 1) * 50)}`;
        const active = nearest === i;
        card.classList.toggle("active", active);
        card.setAttribute("aria-selected", String(active));
      }
    });
  }, []);

  const setOrbitRotation = useCallback((rotation: number) => {
    rotRef.current = rotation;
    paintOrbit(rotation);
  }, [paintOrbit]);

  useEffect(() => {
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(50, now - last);
      last = now;
      if (!pausedRef.current && !openRef.current) {
        rotRef.current += dt * .03 * directionRef.current;
        paintOrbit(rotRef.current);
      }
      orbitRaf.current = requestAnimationFrame(tick);
    };
    paintOrbit(rotRef.current);
    orbitRaf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(orbitRaf.current);
  }, [paintOrbit]);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => () => {
    cancelAnimationFrame(handRaf.current);
    if (gestureWorkerRef.current && workerMessageHandlerRef.current) {
      gestureWorkerRef.current.removeEventListener("message", workerMessageHandlerRef.current);
    }
    streamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (connection?.saveData || connection?.effectiveType?.includes("2g")) return;
    const timer = window.setTimeout(() => { loadGestureWorker().catch(() => undefined); }, 350);
    return () => window.clearTimeout(timer);
  }, []);

  const closeGuide = () => {
    localStorage.setItem("gesture-guide-seen", "true");
    setGuideOpen(false);
  };

  const navigate = useCallback((dir: number) => {
    updatePaused(true);
    setOrbitRotation(rotRef.current - dir * 60);
    updateGesture(dir > 0 ? "Orbit right" : "Orbit left");
  }, [setOrbitRotation, updateGesture, updatePaused]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") navigate(1);
      if (e.key === "ArrowLeft") navigate(-1);
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); open ? setOpen(null) : setOpen(slides[selected]); }
      if (e.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [navigate, open, selected]);

  const startCamera = async () => {
    if (camera === "live" || camera === "loading" || camera === "warming") return;
    setGuideOpen(false);
    localStorage.setItem("gesture-guide-seen", "true");
    setCameraError("");
    setCamera("loading");
    updateGesture("REQUESTING CAMERA ACCESS");
    let acquiredStream: MediaStream | null = null;
    try {
      if (!window.isSecureContext) throw new DOMException("Camera requires HTTPS", "SecurityError");
      if (!navigator.mediaDevices?.getUserMedia) throw new DOMException("Camera API unavailable", "NotSupportedError");
      const permissions = navigator.permissions as Permissions | undefined;
      const permission = await permissions?.query({ name: "camera" as PermissionName }).catch(() => null);
      if (permission?.state === "denied") throw new DOMException("Camera permission is blocked", "NotAllowedError");
      if (permission?.state === "prompt") updateGesture("SELECT ALLOW IN THE CAMERA PROMPT");

      const streamRequest = navigator.mediaDevices.getUserMedia({ video: true, audio: false }).then(stream => {
        acquiredStream = stream;
        const track = stream.getVideoTracks()[0];
        track?.applyConstraints({
          width: { ideal: 320 },
          height: { ideal: 240 },
          frameRate: { ideal: 24, max: 30 },
          facingMode: "user",
        }).catch(() => undefined);
        return stream;
      });
      const workerRequest = loadGestureWorker();
      const stream = await streamRequest;
      streamRef.current = stream;
      if (!videoRef.current) throw new Error("Camera preview unavailable");
      videoRef.current.srcObject = stream; await videoRef.current.play();
      setCamera("warming");
      updateGesture("CAMERA READY · CALIBRATING HAND AI");
      const worker = await workerRequest;
      gestureWorkerRef.current = worker;
      setCamera("live"); updateGesture("Show your hand");
      let lastX = 0.5, smoothedX = 0.5, velocityX = 0;
      let lastIndexY = 0.5, indexVelocity = 0, lastTap = 0, tapArmed = false, tapReadyAt = 0;
      let fistFrames = 0, openFrames = 0, lostAt = 0, directionFrames = 0;
      let directionCandidate: 1 | -1 | null = null;
      let lastInference = 0;
      let lastVideoTime = -1;
      const mobile = window.matchMedia("(max-width: 800px), (pointer: coarse)").matches;
      const inferenceInterval = 1000 / (mobile ? 11 : 16);

      const processHand = (hand: HandPoint[] | null, now: number) => {
        if (hand && hand.length >= 21) {
          lostAt = 0;
          const x = 1 - hand[8].x;
          smoothedX = smoothedX * .72 + x * .28;
          velocityX = velocityX * .62 + (smoothedX - lastX) * .38;
          indexVelocity = indexVelocity * .55 + (hand[8].y - lastIndexY) * .45;
          const extended = (tip: number, pip: number) => hand[tip].y < hand[pip].y - .018;
          const folded = (tip: number, pip: number) => hand[tip].y > hand[pip].y - .004;
          const indexUp = extended(8, 6);
          const otherFolded = folded(12, 10) && folded(16, 14) && folded(20, 18);
          const fist = folded(8, 6) && otherFolded;
          const openHand = indexUp && extended(12, 10) && extended(16, 14) && extended(20, 18);
          const indexOnly = indexUp && otherFolded;
          fistFrames = fist ? Math.min(3, fistFrames + 1) : 0;
          openFrames = openHand ? Math.min(3, openFrames + 1) : 0;

          if (indexOnly && !tapArmed) {
            tapArmed = true;
            tapReadyAt = now;
            indexVelocity = 0;
          } else if (!indexOnly && !fist) tapArmed = false;

          const tappingDown = indexOnly && tapArmed && now - tapReadyAt > 70 && indexVelocity > .014;
          updateHandSeen(true);

          if (tappingDown && now - lastTap > 650) {
            updatePaused(true);
            setOpen(slides[selectedRef.current]);
            lastTap = now; tapArmed = false; updateGesture("INDEX TAP · OPEN CENTER");
          } else if (fistFrames >= 2) {
            updatePaused(true); tapArmed = false; directionFrames = 0; updateGesture("FIST · ORBIT STOPPED");
          } else {
            if (openFrames >= 2) updatePaused(false);

            if (Math.abs(velocityX) > .0038) {
              const candidate: 1 | -1 = velocityX > 0 ? 1 : -1;
              if (directionCandidate === candidate) directionFrames += 1;
              else { directionCandidate = candidate; directionFrames = 1; }
              if (directionFrames >= 2) {
                directionRef.current = candidate;
                updateGesture(candidate > 0 ? "MOVE RIGHT · ROTATE RIGHT" : "MOVE LEFT · ROTATE LEFT");
              }
            } else {
              directionFrames = 0;
              directionCandidate = null;
              if (openFrames >= 2) updateGesture("OPEN HAND · ORBIT RUNNING");
            }

            if (indexOnly && directionFrames === 0) updateGesture("INDEX READY · TAP DOWN");
          }
          lastX = smoothedX; lastIndexY = hand[8].y;
        } else {
          if (!lostAt) lostAt = now;
          fistFrames = 0; openFrames = 0; directionFrames = 0; directionCandidate = null;
          if (now - lostAt > 260) {
            updateHandSeen(false);
            updatePaused(false);
            updateGesture("NO HAND · AUTO ORBIT");
          }
        }
      };

      if (workerMessageHandlerRef.current) worker.removeEventListener("message", workerMessageHandlerRef.current);
      const handleWorkerMessage = (event: MessageEvent<GestureWorkerMessage>) => {
        if (event.data.type === "result") {
          framePendingRef.current = false;
          processHand(event.data.hand, event.data.timestamp);
        } else if (event.data.type === "error" && event.data.stage === "frame") {
          framePendingRef.current = false;
          processHand(null, event.data.timestamp ?? performance.now());
        }
      };
      workerMessageHandlerRef.current = handleWorkerMessage;
      worker.addEventListener("message", handleWorkerMessage);

      const track = (now: number) => {
        const video = videoRef.current;
        if (!video || video.readyState < 2 || document.hidden || framePendingRef.current || now - lastInference < inferenceInterval || video.currentTime === lastVideoTime) {
          handRaf.current = requestAnimationFrame(track);
          return;
        }
        lastInference = now;
        lastVideoTime = video.currentTime;
        framePendingRef.current = true;
        if (typeof createImageBitmap === "function") {
          createImageBitmap(video).then(frame => {
            worker.postMessage({ type: "frame", frame, timestamp: now }, [frame]);
          }).catch(() => { framePendingRef.current = false; });
        } else {
          const canvas = captureCanvasRef.current ?? document.createElement("canvas");
          captureCanvasRef.current = canvas;
          canvas.width = mobile ? 224 : 256;
          canvas.height = mobile ? 168 : 192;
          const context = canvas.getContext("2d", { alpha: false });
          if (context) {
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const frame = context.getImageData(0, 0, canvas.width, canvas.height);
            worker.postMessage({ type: "frame", frame, timestamp: now }, [frame.data.buffer]);
          } else framePendingRef.current = false;
        }
        handRaf.current = requestAnimationFrame(track);
      };
      handRaf.current = requestAnimationFrame(track);
    } catch (error) {
      (streamRef.current ?? acquiredStream)?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      framePendingRef.current = false;
      setCamera("error");
      const name = error instanceof DOMException ? error.name : "";
      const message = name === "NotAllowedError"
        ? "CAMERA IS BLOCKED IN THIS BROWSER"
        : name === "NotFoundError"
          ? "NO CAMERA FOUND"
          : name === "NotReadableError"
            ? "CAMERA BUSY · CLOSE OTHER CAMERA APPS"
            : name === "SecurityError" || name === "NotSupportedError"
              ? "CAMERA NEEDS A SECURE SUPPORTED BROWSER"
              : "CAMERA COULD NOT START IN THIS BROWSER";
      setCameraError(message);
      updateGesture(message);
    }
  };

  useEffect(() => {
    if (cameraAutoStartRef.current || new URLSearchParams(window.location.search).get("camera") !== "1") return;
    cameraAutoStartRef.current = true;
    window.history.replaceState({}, "", `${window.location.pathname}${window.location.hash}`);
    const timer = window.setTimeout(() => { startCamera(); }, 300);
    return () => window.clearTimeout(timer);
  }, []);

  const activateSlide = useCallback((index: number) => {
    const wasSelected = selectedRef.current === index;
    updatePaused(true);
    setOrbitRotation(-index * 60);
    if (wasSelected) setOpen(slides[index]);
  }, [setOrbitRotation, updatePaused]);

  const pointerDown = (e: React.PointerEvent) => {
    const card = (e.target as HTMLElement).closest<HTMLElement>("[data-orbit-index]");
    const index = card ? Number(card.dataset.orbitIndex) : null;
    drag.current = { active: true, x: e.clientX, moved: 0, index };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    updatePaused(true);
  };
  const pointerMove = (e: React.PointerEvent) => { if (!drag.current.active) return; const dx=e.clientX-drag.current.x; drag.current.x=e.clientX; drag.current.moved+=Math.abs(dx); setOrbitRotation(rotRef.current + dx*.16); updateGesture("Drag · orbit"); };
  const pointerUp = () => { if (drag.current.moved < 8 && drag.current.index !== null) activateSlide(drag.current.index); drag.current.active=false; drag.current.index=null; };
  const pointerCancel = () => { drag.current.active = false; drag.current.index = null; };

  return <main className={`universe${camera === "live" || camera === "warming" ? " cameraActive" : ""}`}>
    <div className="cinemaAtmosphere" aria-hidden="true"><span className="lightSweep sweepOne"/><span className="lightSweep sweepTwo"/><span className="filmGrain"/><span className="vignette"/></div>
    <div className="stars" aria-hidden="true" />
    <header className="topbar">
      <a className="brand" href="#top" aria-label="Vidya Singh home"><span>VS</span><b>VIDYA SINGH</b></a>
      <div className="status"><i className={camera === "live" || camera === "warming" ? "live" : ""}/>{camera === "live" || camera === "warming" ? gesture : "GESTURE PORTFOLIO"}</div>
      <nav><button onClick={()=>setGuideOpen(true)}>GESTURE GUIDE</button><button onClick={()=>setContactOpen(true)}>CONTACT</button><a href="https://www.linkedin.com/in/vidya-singh-465350328" target="_blank">LINKEDIN ↗</a></nav>
    </header>

    <section className="hero" id="top">
      <div className="heroCopy">
        <p className="kicker"><span>SELECTED WORKS</span> AI ENGINEER · CREATIVE DEVELOPER</p>
        <h1 className="portfolioTitle">Building<br/><em>intelligent</em><br/>experiences.</h1>
        <p className="intro">I turn computer vision, research and bold ideas into intelligent software that sees, understands and solves real-world problems.</p>
        <div className="cinemaCredits"><span><b>DISCIPLINE</b>AI / VISION / SOFTWARE</span><span><b>EDITION</b>PORTFOLIO · 2026</span></div>
      </div>
      <div className="orbitWrap" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerCancel}>
        <div className="horizon"><span className="orbitHalo"/></div>
        <div className="orbitStage" aria-hidden="true"><span/><i/></div>
        <div className="orbit" role="listbox" aria-label="Portfolio slides">
          {slides.map((s,i) => {
            const angle = i * 60 * Math.PI / 180;
            const x = Math.sin(angle) * 43;
            const z = Math.cos(angle);
            const y = Math.abs(Math.sin(angle)) * 11 + (1-z)*9;
            const scale = .58 + (z+1)*.27;
            const opacity = .18 + (z+1)*.41;
            return <button key={s.id} data-orbit-index={i} ref={element => { cardRefs.current[i] = element; }} className={`orbCard ${selected===i?"active":""}`} style={{"--x":`${x}vw`,"--y":`${y}vh`,"--s":scale,"--o":opacity,"--accent":s.accent,"--z":Math.round((z+1)*50)} as React.CSSProperties} onClick={(e)=>{e.stopPropagation();if(e.detail===0)activateSlide(i)}} role="option" aria-selected={selected===i}>
              <span className="cardHeader"><span className="cardNum">0{i+1}</span><span className="cardEyebrow">{s.eyebrow.split(" / ")[1]}</span></span>
              <MiniatureScene slide={s}/>
              <span className="cardCopy"><strong>{s.title}</strong><small>{s.short}</small></span>
              <span className="cardAction"><i/> ENTER THE SCENE <b>↗</b></span>
            </button>
          })}
        </div>
      </div>
      <div className="controls">
        <button onClick={startCamera} className="gestureBtn"><span>✦</span>{camera === "loading" ? "OPENING CAMERA…" : camera === "warming" ? "CALIBRATING HAND AI…" : camera === "live" ? "GESTURES LIVE" : camera === "error" ? "RETRY CAMERA" : "ENABLE HAND CONTROL"}</button>
        <button className="pause" onClick={()=>updatePaused(!pausedRef.current)} aria-label={paused?"Resume orbit":"Pause orbit"}>{paused?"▶":"Ⅱ"}</button>
        <p><b>FIST</b> STOP · <b>OPEN HAND</b> START<br/><b>MOVE LEFT / RIGHT</b> SET DIRECTION · <b>INDEX TAP</b> OPEN</p>
      </div>
      <div className="counter"><b>0{selected+1}</b><span>/ 0{slides.length}</span></div>
      {camera === "idle" && <button className="gesturePrompt" onClick={startCamera}><span className="handGlyph">☝</span><b>CONTROL THIS ORBIT<br/>WITH YOUR HAND</b><small>Activate camera tracking →</small></button>}
      <aside className={`gestureDock ${camera === "live" || camera === "warming" ? "show" : ""}`}>
        <div className="feedWrap"><video ref={videoRef} className="cameraFeed" muted playsInline/><span className="scanLine"/><b>{camera === "warming" ? "CAMERA READY · LOADING AI" : handSeen ? "HAND LOCKED" : "SEARCHING FOR HAND"}</b></div>
        <div className="gestureReadout"><small>LIVE GESTURE</small><strong>{gesture}</strong><div><span>FIST</span> stop · <span>OPEN</span> start<br/><span>MOVE</span> direction · <span>INDEX TAP</span> open</div></div>
      </aside>
    </section>

    {camera === "error" && <section className="cameraRecovery" aria-modal="true" role="dialog" aria-label="Restore camera access">
      <button className="cameraRecoveryClose" onClick={()=>{setCamera("idle");setCameraError("");}} aria-label="Close camera help">×</button>
      <div className="cameraRecoveryInner">
        <p>CAMERA ACCESS REQUIRED</p>
        <h2>One final step.<br/><em>Let the site see your hand.</em></h2>
        <strong>{cameraError}</strong>
        <ol><li>Click the lock or camera icon beside the website address.</li><li>Change Camera to Allow.</li><li>Reload the page and select Enable Hand Control.</li></ol>
        <div className="cameraRecoveryActions"><button onClick={startCamera}>TRY CAMERA AGAIN</button><a href="https://vidyaaaas.github.io/?camera=1" target="_blank" rel="external noreferrer">OPEN IN CHROME / SAFARI ↗</a></div>
        <small>In-app browsers can block camera prompts. Opening the portfolio in Chrome or Safari restores the normal permission request.</small>
      </div>
    </section>}

    {open && <section className="detail" data-scene={open.id} style={{"--accent":open.accent} as React.CSSProperties} aria-modal="true" role="dialog">
      <div className="detailGlow"/><MiniatureScene slide={open} expanded/><span className="detailIndex" aria-hidden="true">{open.eyebrow.split(" / ")[0]}</span><button className="close" onClick={()=>setOpen(null)} aria-label="Close slide">CLOSE <span>×</span></button>
      <div className="detailInner">
        <p className="reveal r1"><span>VIDYA SINGH · SELECTED WORKS</span>{open.eyebrow}</p><h2 className="reveal r2">{open.title}</h2>
        <div className="detailGrid reveal r3"><p>{open.description}</p><div className="metric"><b>{open.stat}</b><span>{open.statLabel}</span></div></div>
        <div className="tags reveal r4">{open.tags.map(t=><span key={t}>{t}</span>)}</div>
        <div className="detailActions reveal r5">{open.link && <a href={open.link} target="_blank">EXPLORE PROJECT ↗</a>}<a href="/Vidya_Singh_Resume.pdf" target="_blank">VIEW RÉSUMÉ ↗</a></div>
      </div>
    </section>}
    {contactOpen && <section className="contactPanel" aria-modal="true" role="dialog" aria-label="Contact Vidya Singh">
      <button className="close" onClick={()=>setContactOpen(false)} aria-label="Close contact panel">CLOSE <span>×</span></button>
      <div className="contactInner"><p>LET'S CONNECT</p><h2>Contact<br/><em>Vidya.</em></h2><div className="contactList">
        <div><small>EMAIL</small><strong>singhvidya623@gmail.com</strong></div>
        <div><small>PHONE</small><strong>+91 62904 24147</strong></div>
        <div><small>LINKEDIN</small><a href="https://www.linkedin.com/in/vidya-singh-465350328" target="_blank">vidya-singh-465350328 ↗</a></div>
      </div></div>
    </section>}
    {guideOpen && <section className="guidePanel" aria-modal="true" role="dialog" aria-label="Hand gesture guide">
      <button className="close" onClick={closeGuide} aria-label="Close gesture guide">GOT IT <span>×</span></button>
      <div className="guideInner">
        <p>CAMERA CONTROL · QUICK GUIDE</p><h2>Your hand.<br/><em>The controller.</em></h2>
        <div className="gestureGrid">
          <article><span>✊</span><small>01 · PAUSE</small><strong>Close your fist</strong><p>Hold a closed fist in view to stop the orbit instantly.</p></article>
          <article><span>🖐</span><small>02 · PLAY</small><strong>Open your hand</strong><p>Show an open palm to restart the automatic rotation.</p></article>
          <article><span>↔</span><small>03 · DIRECTION</small><strong>Move left or right</strong><p>Move your visible fingers sideways to set the orbit direction.</p></article>
          <article><span>☝</span><small>04 · OPEN</small><strong>Tap your index</strong><p>Fold the other fingers, then tap your index downward to open the centered slide.</p></article>
        </div>
        <div className="guideTip"><b>FOR BEST TRACKING</b><span>Face the camera · keep your full hand visible · use even lighting · allow camera permission</span></div>
        <button className="guideStart" onClick={closeGuide}>ENTER THE ORBIT →</button>
      </div>
    </section>}
    <footer><span>AVAILABLE FOR SOFTWARE ENGINEERING & AI OPPORTUNITIES</span><span>KOLKATA, INDIA · 2026</span></footer>
  </main>;
}
