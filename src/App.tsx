"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Slide = { id: string; eyebrow: string; title: string; short: string; description: string; tags: string[]; link?: string; accent: string; stat: string; statLabel: string };

const slides: Slide[] = [
  { id: "intro", eyebrow: "01 / PROFILE", title: "Vidya Singh", short: "AI engineer building systems that can see, reason and respond.", description: "Computer Science & Artificial Intelligence student in Kolkata, focused on reliable computer vision, full-stack workflows and production-ready software.", tags: ["Computer Vision", "AI / ML", "Software Engineering"], accent: "#d6b875", stat: "2026", statLabel: "B.Tech · MSIT" },
  { id: "spare", eyebrow: "02 / FEATURED BUILD", title: "Spare Part Recognition", short: "A vision system for identifying real-world industrial components.", description: "Modular Python and OpenCV recognition with preprocessing, feature matching, metadata lookup, structured predictions and evaluation reports—designed for reliable end-to-end use.", tags: ["Python", "OpenCV", "FastAPI-ready"], link: "https://github.com/vidyaaaas/spare-part-recognition", accent: "#b8aa94", stat: "E2E", statLabel: "Recognition workflow" },
  { id: "landmark", eyebrow: "03 / COMPUTER VISION", title: "Landmark Detection", short: "Transfer learning that turns pixels into places.", description: "Landmark classification using ResNet and InceptionV3, improved through data augmentation, hyperparameter tuning and model optimization.", tags: ["TensorFlow", "CNN", "Transfer Learning"], link: "https://github.com/vidyaaaas/Landmark-Detection-2", accent: "#9aa9ad", stat: "85–90%", statLabel: "Model accuracy" },
  { id: "research", eyebrow: "04 / PRODUCT THINKING", title: "App Research Case Study", short: "Research translated into clear, useful product decisions.", description: "A structured product research case study that connects user insight, problem framing and interface thinking into an actionable design narrative.", tags: ["Research", "UX Strategy", "Case Study"], link: "https://github.com/vidyaaaas/app-research-case-study", accent: "#c0a37c", stat: "360°", statLabel: "Product perspective" },
  { id: "deepfake", eyebrow: "05 / DEEP LEARNING", title: "Multi-Modal Deepfake Detection", short: "Detecting synthetic media across visual, pulse and audio signals.", description: "A modular pipeline combining rPPG, facial features and audio spectrograms, with evaluation and performance tracking across modalities.", tags: ["PyTorch", "rPPG", "Audio + Video"], accent: "#9b96a5", stat: "93.57%", statLabel: "Detection accuracy" },
  { id: "experience", eyebrow: "06 / EXPERIENCE", title: "AI Engineer Intern", short: "From experimental models to dependable application workflows.", description: "At Hari Chand Anand & Co., I build computer vision pipelines for spare-part recognition. Previously at Coincent.ai, I worked on Python, ML fundamentals and landmark detection.", tags: ["OpenCV", "Evaluation", "Backend Logic"], accent: "#93a49d", stat: "2×", statLabel: "Engineering internships" },
];

const mod = (n: number, m: number) => ((n % m) + m) % m;

export default function Home() {
  const [rotation, setRotation] = useState(0);
  const [selected, setSelected] = useState(0);
  const [open, setOpen] = useState<Slide | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [orbitDirection, setOrbitDirection] = useState<1 | -1>(1);
  const [camera, setCamera] = useState<"idle" | "loading" | "live" | "error">("idle");
  const [gesture, setGesture] = useState("Move to explore");
  const [handPos, setHandPos] = useState({ x: 50, y: 50, seen: false, pinching: false });
  const drag = useRef({ active: false, x: 0, moved: 0 });
  const videoRef = useRef<HTMLVideoElement>(null);
  const orbitRaf = useRef(0);
  const handRaf = useRef(0);
  const rotRef = useRef(rotation);
  rotRef.current = rotation;

  useEffect(() => {
    if (paused || open) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(32, now - last); last = now;
      setRotation(v => v + dt * 0.03 * orbitDirection);
      orbitRaf.current = requestAnimationFrame(tick);
    };
    orbitRaf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(orbitRaf.current);
  }, [paused, open, orbitDirection]);

  useEffect(() => () => cancelAnimationFrame(handRaf.current), []);

  useEffect(() => {
    if (!localStorage.getItem("gesture-guide-seen")) setGuideOpen(true);
  }, []);

  const closeGuide = () => {
    localStorage.setItem("gesture-guide-seen", "true");
    setGuideOpen(false);
  };

  useEffect(() => {
    const nearest = mod(Math.round(-rotation / 60), slides.length);
    setSelected(nearest);
  }, [rotation]);

  const navigate = useCallback((dir: number) => {
    setPaused(true);
    setRotation(v => v - dir * 60);
    setGesture(dir > 0 ? "Orbit right" : "Orbit left");
  }, []);

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
    if (camera === "live") return;
    setCamera("loading");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: false });
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream; await videoRef.current.play();
      const vision = await import("@mediapipe/tasks-vision");
      const files = await vision.FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm");
      const landmarker = await vision.HandLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task" }, runningMode: "VIDEO", numHands: 1 });
      setCamera("live"); setGesture("Show your hand");
      let lastX = 0.5, smoothedX = 0.5, lastIndexY = 0.5, lastTap = 0, tapArmed = false;
      const track = () => {
        const video = videoRef.current;
        if (!video || video.readyState < 2) { handRaf.current = requestAnimationFrame(track); return; }
        const result = landmarker.detectForVideo(video, performance.now());
        const hand = result.landmarks?.[0];
        if (hand) {
          const x = 1 - hand[8].x;
          smoothedX = smoothedX * .7 + x * .3;
          const dx = smoothedX - lastX;
          const extended = (tip: number, pip: number) => hand[tip].y < hand[pip].y - .018;
          const folded = (tip: number, pip: number) => hand[tip].y > hand[pip].y - .004;
          const indexUp = extended(8, 6);
          const otherFolded = folded(12, 10) && folded(16, 14) && folded(20, 18);
          const fist = folded(8, 6) && otherFolded;
          const openHand = indexUp && extended(12, 10) && extended(16, 14) && extended(20, 18);
          const indexOnly = indexUp && otherFolded;
          const tappingDown = indexOnly && tapArmed && hand[8].y - lastIndexY > .028;
          setHandPos({ x: x * 100, y: hand[8].y * 100, seen: true, pinching: tappingDown });

          if (tappingDown && performance.now() - lastTap > 700) {
            setPaused(true);
            setOpen(slides[mod(Math.round(-rotRef.current / 60), slides.length)]);
            lastTap = performance.now(); tapArmed = false; setGesture("INDEX TAP · OPEN CENTER");
          } else if (fist) {
            setPaused(true); tapArmed = false; setGesture("FIST · ORBIT STOPPED");
          } else {
            if (Math.abs(dx) > .0055) {
              const dir: 1 | -1 = dx > 0 ? 1 : -1;
              setOrbitDirection(dir); setGesture(dir > 0 ? "MOVE RIGHT · ROTATE RIGHT" : "MOVE LEFT · ROTATE LEFT");
            } else if (openHand) setGesture("OPEN HAND · ORBIT RUNNING");
            else if (indexOnly) setGesture("INDEX READY · TAP DOWN");
            if (openHand) setPaused(false);
            if (indexOnly && !tapArmed) tapArmed = true;
          }
          lastX = smoothedX; lastIndexY = hand[8].y;
        } else {
          setHandPos(p => p.seen ? { ...p, seen: false } : p);
          setPaused(false);
          setGesture("NO HAND · AUTO ORBIT");
        }
        handRaf.current = requestAnimationFrame(track);
      };
      handRaf.current = requestAnimationFrame(track);
    } catch { setCamera("error"); setGesture("Camera unavailable · use pointer"); }
  };

  const pointerDown = (e: React.PointerEvent) => { drag.current = { active: true, x: e.clientX, moved: 0 }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); setPaused(true); };
  const pointerMove = (e: React.PointerEvent) => { if (!drag.current.active) return; const dx=e.clientX-drag.current.x; drag.current.x=e.clientX; drag.current.moved+=Math.abs(dx); setRotation(v=>v+dx*.16); setGesture("Drag · orbit"); };
  const pointerUp = () => { if (drag.current.moved < 8) setOpen(slides[selected]); drag.current.active=false; };

  return <main className="universe">
    <div className="stars" aria-hidden="true" />
    <header className="topbar">
      <a className="brand" href="#top" aria-label="Vidya Singh home"><span>VS</span><b>VIDYA SINGH</b></a>
      <div className="status"><i className={camera === "live" ? "live" : ""}/>{camera === "live" ? gesture : "GESTURE PORTFOLIO"}</div>
      <nav><button onClick={()=>setGuideOpen(true)}>GESTURE GUIDE</button><button onClick={()=>setContactOpen(true)}>CONTACT</button><a href="https://www.linkedin.com/in/vidya-singh-465350328" target="_blank">LINKEDIN ↗</a></nav>
    </header>

    <section className="hero" id="top">
      <div className="heroCopy">
        <p className="kicker">AI ENGINEER · CREATIVE DEVELOPER</p>
        <h1 className="portfolioTitle">Building<br/><em>intelligent</em><br/>experiences.</h1>
        <p className="intro">I build intelligent experiences where computer vision meets thoughtful software.</p>
      </div>
      <div className="orbitWrap" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp}>
        <div className="horizon" />
        <div className="orbit" role="listbox" aria-label="Portfolio slides">
          {slides.map((s,i) => {
            const angle = (rotation + i * 60) * Math.PI / 180;
            const x = Math.sin(angle) * 43;
            const z = Math.cos(angle);
            const y = Math.abs(Math.sin(angle)) * 11 + (1-z)*9;
            const scale = .58 + (z+1)*.27;
            const opacity = .18 + (z+1)*.41;
            return <button key={s.id} className={`orbCard ${selected===i?"active":""}`} style={{"--x":`${x}vw`,"--y":`${y}vh`,"--s":scale,"--o":opacity,"--accent":s.accent,"--z":Math.round((z+1)*50)} as React.CSSProperties} onClick={(e)=>{e.stopPropagation();setPaused(true);setRotation(-i*60);if(selected===i)setOpen(s)}} role="option" aria-selected={selected===i}>
              <span className="cardNum">0{i+1}</span><span className="cardEyebrow">{s.eyebrow.split(" / ")[1]}</span><strong>{s.title}</strong><span className="cardLine"/><small>{s.short}</small><span className="cardAction">TAP TO ENTER ↗</span>
            </button>
          })}
        </div>
      </div>
      <div className="controls">
        <button onClick={startCamera} className="gestureBtn"><span>✦</span>{camera === "loading" ? "STARTING…" : camera === "live" ? "GESTURES LIVE" : "ENABLE HAND CONTROL"}</button>
        <button className="pause" onClick={()=>setPaused(v=>!v)} aria-label={paused?"Resume orbit":"Pause orbit"}>{paused?"▶":"Ⅱ"}</button>
        <p><b>FIST</b> STOP · <b>OPEN HAND</b> START<br/><b>MOVE LEFT / RIGHT</b> SET DIRECTION · <b>INDEX TAP</b> OPEN</p>
      </div>
      <div className="counter"><b>0{selected+1}</b><span>/ 0{slides.length}</span></div>
      {camera === "idle" && <button className="gesturePrompt" onClick={startCamera}><span className="handGlyph">☝</span><b>CONTROL THIS ORBIT<br/>WITH YOUR HAND</b><small>Activate camera tracking →</small></button>}
      <aside className={`gestureDock ${camera === "live" ? "show" : ""}`}>
        <div className="feedWrap"><video ref={videoRef} className="cameraFeed" muted playsInline/><span className="scanLine"/><b>{handPos.seen ? "HAND LOCKED" : "SEARCHING FOR HAND"}</b></div>
        <div className="gestureReadout"><small>LIVE GESTURE</small><strong>{gesture}</strong><div><span>FIST</span> stop · <span>OPEN</span> start<br/><span>MOVE</span> direction · <span>INDEX TAP</span> open</div></div>
      </aside>
    </section>

    {open && <section className="detail" style={{"--accent":open.accent} as React.CSSProperties} aria-modal="true" role="dialog">
      <div className="detailGlow"/><button className="close" onClick={()=>setOpen(null)} aria-label="Close slide">CLOSE <span>×</span></button>
      <div className="detailInner">
        <p className="reveal r1">{open.eyebrow}</p><h2 className="reveal r2">{open.title}</h2>
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
