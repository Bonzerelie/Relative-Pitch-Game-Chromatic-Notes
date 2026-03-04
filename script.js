/* =========================
   /script.js
   Identifying Chromatic Notes
   ========================= */
   (() => {
    "use strict";
  
    const AUDIO_DIR = "audio";
    const LS_KEY_RANGE = "et_chromatic_range";
    const LS_KEY_NOTES = "et_chromatic_notes";
    const LS_KEY_INPUT = "et_chromatic_input";
    const LS_KEY_NAME = "et_chromatic_player_name";
  
    const UI_SND_SELECT = "select1.mp3";
    const UI_SND_BACK = "back1.mp3";
    const UI_SND_CORRECT = "correct1.mp3";
    const UI_SND_INCORRECT = "incorrect1.mp3";
  
    // Chromatic definitions
    const CHROMATIC_NAMES = ["C", "C#/Db", "D", "D#/Eb", "E", "F", "F#/Gb", "G", "G#/Ab", "A", "A#/Bb", "B"];
  
    // Mini keyboard display limits: 3 full octaves (C3 to B5)
    const DISPLAY_LO_PITCH = (3 * 12) + 0; // C3 (36)
    const DISPLAY_HI_PITCH = (5 * 12) + 11; // B5 (71)
  
    // Note stems (audio uses sharps)
    const PC_TO_STEM = {
      0: "c", 1: "csharp", 2: "d", 3: "dsharp", 4: "e", 5: "f",
      6: "fsharp", 7: "g", 8: "gsharp", 9: "a", 10: "asharp", 11: "b",
    };
  
    const RANGE_OPTIONS = [
      { key: "one", label: "Range: One Octave (C4 - B4)" },
      { key: "multi", label: "Range: Multiple Octaves (C2 - C6)" },
    ];
  
    const NOTES_OPTIONS = Array.from({ length: 11 }, (_, i) => {
      const count = i + 2;
      return { key: String(count), label: `Notes: C to ${CHROMATIC_NAMES[count - 1]}` };
    });
    
    const INPUT_OPTIONS = [
      { key: "buttons", label: "Input: Standard Buttons" },
      { key: "keyboard", label: "Input: Virtual Keyboard" },
    ];
  
    const $ = (id) => document.getElementById(id);
  
    const titleWrap = $("titleWrap");
    const titleImgWide = $("titleImgWide");
    const titleImgWrapped = $("titleImgWrapped");
  
    const beginBtn = $("beginBtn");
    const replayBtn = $("replayBtn");
    const nextBtn = $("nextBtn");
    const refTonicBtn = $("refTonicBtn"); // Plays C4
    const infoBtn = $("infoBtn");
  
    const phaseTitle = $("phaseTitle");
    const correctOut = $("correctOut");
    const incorrectOut = $("incorrectOut");
    const totalOut = $("totalOut");
    const accuracyOut = $("accuracyOut");
    const perNoteOut = $("perNoteOut"); 
  
    const answerButtons = $("answerButtons");
    const answerKeyboard = $("answerKeyboard");
    const feedbackOut = $("feedbackOut");
    const scaleMount = $("scaleMount");
  
    const settingsBtn = $("settingsBtn");
    const settingsModal = $("settingsModal");
    const settingsRangeSelect = $("settingsRangeSelect");
    const settingsNotesSelect = $("settingsNotesSelect");
    const settingsInputSelect = $("settingsInputSelect");
    const settingsRestartBtn = $("settingsRestartBtn");
    const settingsCancelBtn = $("settingsCancelBtn");
  
    const introModal = $("introModal");
    const introBeginBtn = $("introBeginBtn");
    const introBeginBtnTop = $("introBeginBtnTop"); 
    const introRangeSelect = $("introRangeSelect"); 
    const introNotesSelect = $("introNotesSelect"); 
    const introInputSelect = $("introInputSelect"); 

    const scoreModal = $("scoreModal");
    const modalScoreMeta = $("modalScoreMeta");
    const modalPlayerNameInput = $("modalPlayerNameInput");
    const modalDownloadScorecardBtn = $("modalDownloadScorecardBtn");
    const modalCorrectOut = $("modalCorrectOut");
    const modalIncorrectOut = $("modalIncorrectOut");
    const modalTotalOut = $("modalTotalOut");
    const modalAccuracyOut = $("modalAccuracyOut");
    const modalPerNoteOut = $("modalPerNoteOut");
    const scoreModalContinueBtn = $("scoreModalContinueBtn");
  
    const infoModal = $("infoModal");
    const infoClose = $("infoClose");
  
    const scoreMeta = $("scoreMeta");
    const downloadScorecardBtn = $("downloadScorecardBtn");
    const playerNameInput = $("playerNameInput");
  
    // ---------------- title image wide/wrapped ----------------
    function setTitleMode(mode) {
      if (!titleWrap) return;
      titleWrap.classList.toggle("titleModeWide", mode === "wide");
      titleWrap.classList.toggle("titleModeWrapped", mode === "wrapped");
    }
    function refreshTitleMode() {
      if (!titleImgWide || !titleImgWrapped) return;
      const wideOk = titleImgWide.naturalWidth > 0;
      const wrapOk = titleImgWrapped.naturalWidth > 0;
      if (!wideOk && wrapOk) setTitleMode("wrapped");
      else setTitleMode("wide");
    }
    if (titleImgWide) titleImgWide.addEventListener("load", refreshTitleMode);
    if (titleImgWrapped) titleImgWrapped.addEventListener("load", refreshTitleMode);
    window.addEventListener("resize", refreshTitleMode);
  
    // ---------------- iframe sizing ----------------
    let lastHeight = 0;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = Math.ceil(entry.contentRect.height);
        if (h !== lastHeight) {
          parent.postMessage({ iframeHeight: h }, "*");
          lastHeight = h;
        }
      }
    });
    ro.observe(document.documentElement);
  
    function postHeightNow() {
      try {
        const h = Math.max(
          document.documentElement.scrollHeight,
          document.body ? document.body.scrollHeight : 0
        );
        parent.postMessage({ iframeHeight: h }, "*");
      } catch {}
    }
    window.addEventListener("load", () => {
      postHeightNow();
      setTimeout(postHeightNow, 250);
      setTimeout(postHeightNow, 1000);
    });
  
    // ---------------- audio (WebAudio + synth fallback) ----------------
    let audioCtx = null;
    let masterGain = null;
  
    const bufferPromiseCache = new Map();
    const activeVoices = new Set();
    const activeUiAudios = new Set();
    let synthFallbackWarned = false;
  
    function ensureAudioGraph() {
      if (audioCtx) return audioCtx;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
  
      audioCtx = new Ctx();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.7; 
  
      const compressor = audioCtx.createDynamicsCompressor();
      compressor.threshold.value = -10;   
      compressor.knee.value = 12;         
      compressor.ratio.value = 12;        
      compressor.attack.value = 0.002;    
      compressor.release.value = 0.25;
  
      masterGain.connect(compressor);
      compressor.connect(audioCtx.destination);
      return audioCtx;
    }
  
    async function resumeAudioIfNeeded() {
      const ctx = ensureAudioGraph();
      if (!ctx) return;
      if (ctx.state === "suspended") {
        try { await ctx.resume(); } catch {}
      }
    }
  
    function trackVoice(src, gain, startTime) {
      const voice = { src, gain, startTime };
      activeVoices.add(voice);
      src.onended = () => activeVoices.delete(voice);
      return voice;
    }
  
    function stopAllNotes(fadeSec = 0.05) {
      const ctx = ensureAudioGraph();
      if (!ctx) return;
  
      const now = ctx.currentTime;
      const fade = Math.max(0.01, Number.isFinite(fadeSec) ? fadeSec : 0.05);
  
      activeVoices.forEach((v) => {
        try {
          v.gain.gain.cancelScheduledValues(now);
          v.gain.gain.setValueAtTime(v.gain.gain.value, now);
          v.gain.gain.exponentialRampToValueAtTime(0.0001, now + fade);
          v.src.stop(now + fade + 0.05);
        } catch (e) {}
      });
      activeVoices.clear();
    }
  
    function noteUrl(stem, octaveNum) { return `${AUDIO_DIR}/${stem}${octaveNum}.mp3`; }
  
    function loadBuffer(url) {
      if (bufferPromiseCache.has(url)) return bufferPromiseCache.get(url);
      const p = (async () => {
        const ctx = ensureAudioGraph();
        if (!ctx) return null;
        try {
          const res = await fetch(url);
          if (!res.ok) return null;
          const ab = await res.arrayBuffer();
          return await ctx.decodeAudioData(ab);
        } catch { return null; }
      })();
      bufferPromiseCache.set(url, p);
      return p;
    }
  
    function playBufferAt(buffer, whenSec, gain = 1) {
      const ctx = ensureAudioGraph();
      if (!ctx || !masterGain) return null;
  
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const g = ctx.createGain();
      const safeGain = Math.max(0, Number.isFinite(gain) ? gain : 1);
      const fadeIn = 0.02; 
      
      g.gain.value = 0;
      g.gain.setValueAtTime(0, 0);
      g.gain.setValueAtTime(0, whenSec);
      g.gain.linearRampToValueAtTime(safeGain, whenSec + fadeIn);
  
      src.connect(g);
      g.connect(masterGain);
      trackVoice(src, g, whenSec);
      src.start(whenSec);
      return src;
    }
  
    function playBufferWindowed(buffer, whenSec, playSec, fadeOutSec, gain = 1) {
      const ctx = ensureAudioGraph();
      if (!ctx || !masterGain) return null;
  
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const g = ctx.createGain();
      const safeGain = Math.max(0, Number.isFinite(gain) ? gain : 1);
  
      const dur = Math.max(0.02, Number.isFinite(playSec) ? playSec : 0.34);
      const fade = Math.min(Math.max(0.01, Number.isFinite(fadeOutSec) ? fadeOutSec : 0.06), dur * 0.8);
      const fadeIn = 0.02;
      const endAt = whenSec + dur;
      const fadeStart = Math.max(whenSec + 0.02, endAt - fade);
  
      g.gain.value = 0;
      g.gain.setValueAtTime(0, 0);
      g.gain.setValueAtTime(0, whenSec);
      g.gain.linearRampToValueAtTime(safeGain, whenSec + fadeIn);
      g.gain.setValueAtTime(safeGain, fadeStart);
      g.gain.linearRampToValueAtTime(0, endAt);
  
      src.connect(g);
      g.connect(masterGain);
      trackVoice(src, g, whenSec);
  
      try { src.start(whenSec, 0, dur); } catch { src.start(whenSec); src.stop(endAt); }
      return src;
    }
  
    function pitchFromPcOct(pc, oct) { return (oct * 12) + pc; }
    function pcFromPitch(p) { return ((p % 12) + 12) % 12; }
    function octFromPitch(p) { return Math.floor(p / 12); }
    function getStemForPc(pc) { return PC_TO_STEM[(pc + 12) % 12] || null; }
  
    function pitchToFrequency(pitch) {
      const A4 = pitchFromPcOct(9, 4);
      return 440 * Math.pow(2, (pitch - A4) / 12);
    }
  
    function playSynthToneWindowed(pitch, whenSec, playSec, fadeOutSec, gain = 0.65) {
      const ctx = ensureAudioGraph();
      if (!ctx || !masterGain) return null;
  
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(pitchToFrequency(pitch), whenSec);
  
      const g = ctx.createGain();
      const safeGain = Math.max(0, Number.isFinite(gain) ? gain : 0.65);
      const fadeIn = 0.01;
      const endAt = whenSec + Math.max(0.05, playSec);
  
      g.gain.setValueAtTime(0, whenSec);
      g.gain.linearRampToValueAtTime(safeGain, whenSec + fadeIn);
  
      const fade = Math.max(0.015, Number.isFinite(fadeOutSec) ? fadeOutSec : 0.06);
      const fadeStart = Math.max(whenSec + 0.02, endAt - fade);
      g.gain.setValueAtTime(safeGain, fadeStart);
      g.gain.linearRampToValueAtTime(0, endAt);
  
      osc.connect(g);
      g.connect(masterGain);
  
      trackVoice(osc, g, whenSec);
      osc.start(whenSec);
      osc.stop(endAt + 0.03);
      return osc;
    }
  
    function maybeWarnSynthFallback(missingUrl) {
      if (synthFallbackWarned) return;
      synthFallbackWarned = true;
      console.warn("Audio sample missing; using synthesized tones instead:", missingUrl);
      setFeedback(`Audio samples not found; using synthesized tones.<br/><small>Missing: <code>${missingUrl}</code></small>`);
    }
  
    async function loadPitchBuffer(pitch) {
      const pc = pcFromPitch(pitch);
      const oct = octFromPitch(pitch);
      const stem = getStemForPc(pc);
      if (!stem) return { missingUrl: "(unknown)", buffer: null, pitch };
      const url = noteUrl(stem, oct);
      const buf = await loadBuffer(url);
      if (!buf) return { missingUrl: url, buffer: null, pitch };
      return { missingUrl: null, buffer: buf, pitch };
    }
  
    async function playPitch(pitch, gain = 1) {
      await resumeAudioIfNeeded();
      const ctx = ensureAudioGraph();
      if (!ctx) return;
  
      stopAllNotesWithUi(0.06);
  
      const { missingUrl, buffer } = await loadPitchBuffer(pitch);
      const when = ctx.currentTime + 0.03; 
      if (!buffer) {
        maybeWarnSynthFallback(missingUrl);
        playSynthToneWindowed(pitch, when, 0.85, 0.08, 0.7);
        return;
      }
      playBufferAt(buffer, when, gain);
    }
  
    function stopAllUiSounds() {
      for (const a of Array.from(activeUiAudios)) {
        try { a.pause(); a.currentTime = 0; } catch {}
        activeUiAudios.delete(a);
      }
    }
  
    async function playUiSound(filename) {
      try {
        const url = `${AUDIO_DIR}/${filename}`;
        const buffer = await loadBuffer(url);
        if (!buffer) return;
        const ctx = ensureAudioGraph();
        if (!ctx) return;
        
        const when = ctx.currentTime;
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const g = ctx.createGain();
        g.gain.setValueAtTime(2.0, when);
  
        src.connect(g);
        g.connect(masterGain);
        trackVoice(src, g, when);
        src.start(when);
      } catch (e) { console.error("UI Sound error:", e); }
    }
  
    // ---------------- mini display SVG and interactive SVG ----------------
    const SVG_NS = "http://www.w3.org/2000/svg";
    function el(tag, attrs = {}, children = []) {
      const n = document.createElementNS(SVG_NS, tag);
      for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
      for (const c of children) n.appendChild(c);
      return n;
    }
  
    function isBlackPc(pc) { return [1, 3, 6, 8, 10].includes(pc); }
    function whiteIndexInOctave(pc) {
      const m = { 0: 0, 2: 1, 4: 2, 5: 3, 7: 4, 9: 5, 11: 6 };
      return m[pc] ?? null;
    }
    
    // Generates the top display visual keyboard (3 Octaves C3 to B5)
    function buildDisplayKeyboard(highlightPitchSet, scalePitchSet) {
      scaleMount.innerHTML = "";
  
      const lo = DISPLAY_LO_PITCH;
      const hi = DISPLAY_HI_PITCH;
  
      const all = [];
      for (let p = lo; p <= hi; p++) all.push(p);
  
      const WHITE_W = 24;
      const WHITE_H = 92;
      const BLACK_W = 14;
      const BLACK_H = 58;
      const BORDER = 8;
      const RADIUS = 14;
  
      const whitePitches = all.filter((p) => whiteIndexInOctave(pcFromPitch(p)) != null);
      const totalWhite = whitePitches.length;
  
      const innerW = totalWhite * WHITE_W;
      const outerW = innerW + BORDER * 2;
      const outerH = WHITE_H + BORDER * 2;
  
      const s = el("svg", {
        width: "100%",
        height: 128,
        viewBox: `0 0 ${outerW} ${outerH}`,
        style: "max-width: 600px; display: block; margin: 0 auto; overflow: visible;",
        preserveAspectRatio: "xMidYMid meet",
        role: "img",
      });
  
      const style = el("style");
      style.textContent = `
        :root{
          --scaleBlue:#4da3ff;
          --scaleBlue2:#2c7ef5;
          --scaleGlow: rgba(77,163,255,0.28);
        }
        .bg{ fill:#fff; stroke: rgba(0,0,0,0.18); stroke-width:1; }
        .frame{ fill:none; stroke: rgba(0,0,0,0.18); stroke-width:1; }
  
        .w rect{ fill:#fff; stroke:#222; stroke-width:1; }
        .w text{ font-family: Arial, Helvetica, sans-serif; font-size:11px; fill:#9a9a9a; pointer-events:none; user-select:none; }
  
        .b rect{ fill:#111; stroke:#111; stroke-width:1; }
        .b text{ font-family: Arial, Helvetica, sans-serif; font-size:10px; fill:#fff; pointer-events:none; user-select:none; opacity:0; }
  
        .w.hi rect{ fill: var(--scaleBlue); }
        .w.hi text{ fill: rgba(255,255,255,0.96); font-weight:800; }
  
        .b.hi rect{ fill: var(--scaleBlue2); }
        .b.hi text{ opacity:1; font-weight:800; }
        
        .w.in-scale rect{ fill: #e4e4e4; }
        .w.in-scale text{ fill: #aaa; }
        .b.in-scale rect{ fill: #444; }
        .b.in-scale text{ opacity: 0.3; }
  
        .cLbl{ font-weight:900; }
      `;
      s.appendChild(style);
  
      s.appendChild(el("rect", { class: "bg", x: 0, y: 0, width: outerW, height: outerH, rx: RADIUS, ry: RADIUS }));
      s.appendChild(el("rect", { class: "frame", x: 1, y: 1, width: outerW - 2, height: outerH - 2, rx: RADIUS, ry: RADIUS }));
  
      const gW = el("g", {});
      const gB = el("g", {});
      s.appendChild(gW);
      s.appendChild(gB);
  
      const startX = BORDER;
      const startY = BORDER;
  
      const whiteIndexByPitch = new Map();
      let wi = 0;
      for (const p of whitePitches) whiteIndexByPitch.set(p, wi++);
  
      for (const p of whitePitches) {
        const x = startX + (whiteIndexByPitch.get(p) || 0) * WHITE_W;
        const grp = el("g", { class: "w" });
        grp.appendChild(el("rect", { x, y: startY, width: WHITE_W, height: WHITE_H }));
  
        const lbl = highlightPitchSet.has(p) ? CHROMATIC_NAMES[pcFromPitch(p)].split("/")[0] : "";
        
        const text = el("text", {
          x: x + WHITE_W / 2,
          y: startY + WHITE_H - 10,
          "text-anchor": "middle",
          class: "cLbl"
        });
        text.textContent = lbl;
        grp.appendChild(text);
  
        if (highlightPitchSet.has(p)) grp.classList.add("hi");
        else if (scalePitchSet.has(p)) grp.classList.add("in-scale");
        
        gW.appendChild(grp);
      }
  
      for (let p = lo; p <= hi; p++) {
        const pc = pcFromPitch(p);
        if (!isBlackPc(pc)) continue;
  
        const leftPcByBlack = { 1: 0, 3: 2, 6: 5, 8: 7, 10: 9 };
        const leftPc = leftPcByBlack[pc];
        if (leftPc == null) continue;
  
        const oct = octFromPitch(p);
        const leftWhitePitch = pitchFromPcOct(leftPc, oct);
  
        const wIndex = whiteIndexByPitch.get(leftWhitePitch);
        if (wIndex == null) continue;
  
        const leftX = startX + wIndex * WHITE_W;
        const x = leftX + WHITE_W - BLACK_W / 2;
  
        const sharpNames = { 1: "C#", 3: "D#", 6: "F#", 8: "G#", 10: "A#" };
        const lbl = highlightPitchSet.has(p) ? (sharpNames[pc] || "") : "";

        const t = el("text", { x: x + BLACK_W / 2, y: startY + Math.round(BLACK_H * 0.55), "text-anchor": "middle" });
        t.textContent = lbl;
  
        const grp = el("g", { class: "b" });
        grp.appendChild(el("rect", { x, y: startY, width: BLACK_W, height: BLACK_H, rx: 4, ry: 4 }));
        grp.appendChild(t);
  
        if (highlightPitchSet.has(p)) grp.classList.add("hi");
        else if (scalePitchSet.has(p)) grp.classList.add("in-scale");
  
        gB.appendChild(grp);
      }
  
      scaleMount.appendChild(s);
    }

    // Generates a 1-Octave Interactive Virtual Piano SVG
    function buildInteractiveKeyboard(container, notesCount, onClick) {
      container.innerHTML = "";
      const WHITE_W = 40;
      const WHITE_H = 140;
      const BLACK_W = 26;
      const BLACK_H = 90;
      const BORDER = 4;

      const whitePcs = [0, 2, 4, 5, 7, 9, 11];
      const blackPcs = [1, 3, 6, 8, 10];
      
      const outerW = whitePcs.length * WHITE_W + BORDER * 2;
      const outerH = WHITE_H + BORDER * 2;

      const s = el("svg", {
        width: "100%",
        height: "100%",
        viewBox: `0 0 ${outerW} ${outerH}`,
        style: "max-width: 320px; display: block; margin: 0 auto; overflow: visible;",
        role: "img"
      });

      const style = el("style");
      style.textContent = `
        .int-w rect { fill: #fff; stroke: #222; stroke-width: 1; transition: fill 0.1s; cursor: pointer; }
        .int-w:hover rect { fill: #e9e9e9; }
        .int-b rect { fill: #222; stroke: #111; stroke-width: 1; transition: fill 0.1s; cursor: pointer; }
        .int-b:hover rect { fill: #3a3a3a; }
        
        .int-key.is-disabled rect { fill: #f0f0f0; stroke: #ccc; cursor: not-allowed; }
        .int-key.int-b.is-disabled rect { fill: #666; stroke: #555; }
        .int-key.is-disabled text { opacity: 0.3; }
        
        .int-key.chosen rect { stroke: var(--scaleBlue); stroke-width: 3; }
        .int-key.correct rect { fill: #1f9d55 !important; border-color: #116b38 !important; }
        .int-key.incorrect rect { fill: #d13b3b !important; border-color: #942525 !important; }
        
        .int-w text { font-family: Arial, Helvetica, sans-serif; font-size: 13px; fill: #444; pointer-events: none; font-weight: 800; }
        .int-b text { font-family: Arial, Helvetica, sans-serif; font-size: 11px; fill: #fff; pointer-events: none; font-weight: 800; }
      `;
      s.appendChild(style);

      const gW = el("g");
      const gB = el("g");
      s.appendChild(gW);
      s.appendChild(gB);

      let wIdx = 0;
      const xPosByPc = {};

      for (let pc = 0; pc < 12; pc++) {
        const isBlack = blackPcs.includes(pc);
        if (!isBlack) {
          const x = BORDER + wIdx * WHITE_W;
          xPosByPc[pc] = x;
          const grp = el("g", { class: `int-key int-w`, "data-pc": pc });
          grp.appendChild(el("rect", { x, y: BORDER, width: WHITE_W, height: WHITE_H, rx: 4, ry: 4 }));
          
          const txt = el("text", { x: x + WHITE_W / 2, y: BORDER + WHITE_H - 14, "text-anchor": "middle" });
          txt.textContent = CHROMATIC_NAMES[pc];
          grp.appendChild(txt);
          
          if (pc >= notesCount) grp.classList.add("is-disabled");
          else grp.addEventListener("click", () => onClick(grp, pc));
          
          gW.appendChild(grp);
          wIdx++;
        }
      }

      for (let pc = 0; pc < 12; pc++) {
        if (blackPcs.includes(pc)) {
          const leftPc = pc - 1; 
          const leftX = xPosByPc[leftPc];
          const x = leftX + WHITE_W - BLACK_W / 2;
          
          const grp = el("g", { class: `int-key int-b`, "data-pc": pc });
          grp.appendChild(el("rect", { x, y: BORDER, width: BLACK_W, height: BLACK_H, rx: 4, ry: 4 }));
          
          const txt = el("text", { x: x + BLACK_W / 2, y: BORDER + BLACK_H - 12, "text-anchor": "middle" });
          txt.textContent = CHROMATIC_NAMES[pc].split("/")[0];
          grp.appendChild(txt);
          
          if (pc >= notesCount) grp.classList.add("is-disabled");
          else grp.addEventListener("click", () => onClick(grp, pc));
          
          gB.appendChild(grp);
        }
      }

      container.appendChild(s);
    }
  
    // ---------------- state ----------------
    const score = { correct: 0, incorrect: 0, lastWasCorrect: null, perNote: {} };
  
    const state = {
      started: false,
      awaitingNext: false,
      target: null, // { pitch, pc, name }
      rangeMode: "one",
      notesCount: 12,
      inputMode: "keyboard"
    };
  
    // ---------------- UI helpers ----------------
    function setPulseSyncDelay(el) {
      if (!(el instanceof HTMLElement)) return;
      const nowSec = (performance.now ? performance.now() : Date.now()) / 1000;
      el.style.setProperty("--pulseSyncDelay", `${-nowSec}s`);
    }
  
    function setSyncedClass(el, className, on) {
      const had = el.classList.contains(className);
      el.classList.toggle(className, !!on);
      if (on && !had) setPulseSyncDelay(el);
    }
  
    function parseCssTimeToSec(v, fallbackSec) {
      const s = String(v || "").trim();
      if (!s) return fallbackSec;
      const ms = s.match(/^(-?\d+(?:\.\d+)?)ms$/i);
      if (ms) return Number(ms[1]) / 1000;
      const sec = s.match(/^(-?\d+(?:\.\d+)?)s$/i);
      if (sec) return Number(sec[1]);
      const n = Number(s);
      return Number.isFinite(n) ? n : fallbackSec;
    }
  
    function getCssTimeSec(varName, fallbackSec) {
      try {
        const v = getComputedStyle(document.documentElement).getPropertyValue(varName);
        const n = parseCssTimeToSec(v, fallbackSec);
        return Number.isFinite(n) ? n : fallbackSec;
      } catch { return fallbackSec; }
    }
  
    function getRefFadeOutSec() { return Math.max(0.01, getCssTimeSec("--refNoteFadeOut", 0.06)); }
    function setFeedback(html) { feedbackOut.innerHTML = html || ""; }
    function setPhase(title) { phaseTitle.textContent = title || ""; }
    function scoreTotal() { return score.correct + score.incorrect; }
  
    function scoreAccuracy() {
      const t = scoreTotal();
      if (!t) return 0;
      return (score.correct / t) * 100;
    }
  
    function renderScorePills() {
      const c = score.correct;
      const i = score.incorrect;
      const tot = c + i;
      const accStr = `${scoreAccuracy().toFixed(1)}%`;

      correctOut.textContent = String(c);
      incorrectOut.textContent = String(i);
      totalOut.textContent = String(tot);
      accuracyOut.textContent = accStr;

      if (modalCorrectOut) modalCorrectOut.textContent = String(c);
      if (modalIncorrectOut) modalIncorrectOut.textContent = String(i);
      if (modalTotalOut) modalTotalOut.textContent = String(tot);
      if (modalAccuracyOut) modalAccuracyOut.textContent = accStr;

      perNoteOut.innerHTML = "";
      if (modalPerNoteOut) modalPerNoteOut.innerHTML = "";

      const activeNames = CHROMATIC_NAMES.slice(0, state.notesCount);
      for (const name of activeNames) {
        const st = score.perNote[name] || { asked: 0, correct: 0 };
        const txt = `${name}: ${st.correct}/${st.asked}`;

        const el = document.createElement("div");
        el.className = "perNoteItem";
        el.textContent = txt;
        perNoteOut.appendChild(el);

        if (modalPerNoteOut) {
          const mel = document.createElement("div");
          mel.className = "perNoteItem";
          mel.textContent = txt;
          modalPerNoteOut.appendChild(mel);
        }
      }
    }
  
    function drawRoundRect(ctx, x, y, w, h, r) {
      const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.arcTo(x + w, y, x + w, y + h, rr);
      ctx.arcTo(x + w, y + h, x, y + h, rr);
      ctx.arcTo(x, y + h, x, y, rr);
      ctx.arcTo(x, y, x + w, y, rr);
      ctx.closePath();
    }
  
    async function downloadScorecardPng(nameInputEl) {
      const LAYOUT = {
        gapAfterImage: 32,           
        gapAfterUrl: 36,             
        gapAfterTitle: 30,           
        gapAfterMeta: 28,            
        gapAfterName: 22,            
        gapNoNameCompensation: 12,   
        mainGridRowGap: 14,          
        gapBeforePerNoteTitle: 32,   
        gapAfterPerNoteTitle: 26,    
        perNoteGridRowGap: 14,       
      };

      const range = rangeLabel(state.rangeMode);
      const limitStr = state.notesCount == 12 ? "All 12" : `C to ${CHROMATIC_NAMES[state.notesCount - 1]}`;
      const name = safeText(nameInputEl?.value);
      if (nameInputEl) saveName(name);
  
      const correct = score.correct;
      const incorrect = score.incorrect;
      const total = scoreTotal();
      const accuracy = `${scoreAccuracy().toFixed(1)}%`;
  
      // Base height + space for up to 6 rows in the 2-column grid
      const rowsNeeded = Math.ceil(state.notesCount / 2);
      const W = 720;
      const H = 720 + (rowsNeeded * 56); 
      const dpr = Math.max(1, Math.floor((window.devicePixelRatio || 1) * 100) / 100);
  
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
  
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
  
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, W, H);
  
      const pad = 34;
      const cardX = pad;
      const cardY = pad;
      const cardW = W - pad * 2;
      const cardH = H - pad * 2;
  
      ctx.fillStyle = "#f9f9f9";
      drawRoundRect(ctx, cardX, cardY, cardW, cardH, 18);
      ctx.fill();
  
      ctx.strokeStyle = "rgba(0,0,0,0.18)";
      ctx.lineWidth = 1;
      drawRoundRect(ctx, cardX, cardY, cardW, cardH, 18);
      ctx.stroke();
  
      const titleSrc = titleImgWide?.getAttribute("src") || "images/title.png";
      const titleImg = await loadImage(titleSrc);
  
      let yCursor = cardY + 26;
  
      if (titleImg) {
        const imgMaxW = Math.min(520, cardW - 40);
        const imgMaxH = 92;
        drawImageContain(ctx, titleImg, (W - imgMaxW) / 2, yCursor, imgMaxW, imgMaxH);
        yCursor += imgMaxH + LAYOUT.gapAfterImage;
      }

      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.font = "800 18px Arial, Helvetica, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("www.eartraininglab.com", W / 2, yCursor);
      yCursor += LAYOUT.gapAfterUrl;
  
      ctx.fillStyle = "#111";
      ctx.textAlign = "center";
      ctx.font = "700 26px Arial, Helvetica, sans-serif";
      ctx.fillText("Score Card", W / 2, yCursor);
      yCursor += LAYOUT.gapAfterTitle;
  
      ctx.font = "800 18px Arial, Helvetica, sans-serif";
      ctx.fillStyle = "rgba(0,0,0,0.70)";
      const metaLine = `Range: ${range}   •   Notes: ${limitStr}`;
      ctx.fillText(metaLine, W / 2, yCursor);
      yCursor += LAYOUT.gapAfterMeta;
  
      if (name) {
        ctx.fillText(`Name: ${name}`, W / 2, yCursor);
        yCursor += LAYOUT.gapAfterName;
      } else {
        yCursor += LAYOUT.gapNoNameCompensation; 
      }
  
      ctx.fillStyle = "#111";
      ctx.textAlign = "left";
  
      const rowX = cardX + 26;
      const rowW = cardW - 52;
      const rowH = 58;
      
      const rows = [
        ["Correct", String(correct)],
        ["Incorrect", String(incorrect)],
        ["Total Questions Asked", String(total)],
        ["Percentage Correct", accuracy],
      ];
  
      for (const [k, v] of rows) {
        ctx.fillStyle = "#ffffff";
        drawRoundRect(ctx, rowX, yCursor, rowW, rowH, 14);
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.16)";
        ctx.stroke();
  
        ctx.fillStyle = "rgba(0,0,0,0.70)";
        ctx.font = "900 18px Arial, Helvetica, sans-serif";
        ctx.fillText(k, rowX + 16, yCursor + 33);
  
        ctx.fillStyle = "#111";
        ctx.font = "900 22px Arial, Helvetica, sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(v, rowX + rowW - 16, yCursor + 37);
        ctx.textAlign = "left";
  
        yCursor += rowH + LAYOUT.mainGridRowGap;
      }

      yCursor += (LAYOUT.gapBeforePerNoteTitle - LAYOUT.mainGridRowGap); 
      
      ctx.textAlign = "center";
      ctx.font = "800 16px Arial, Helvetica, sans-serif";
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillText("Per Note Statistics", W / 2, yCursor);
      yCursor += LAYOUT.gapAfterPerNoteTitle;

      const activeNames = CHROMATIC_NAMES.slice(0, state.notesCount);
      const cols = 2;
      const itemW = (rowW - LAYOUT.perNoteGridRowGap) / 2;
      const itemH = 42;
      let currentX = rowX;

      ctx.textAlign = "left";
      for (let i = 0; i < activeNames.length; i++) {
        const name = activeNames[i];
        const st = score.perNote[name] || {asked: 0, correct: 0};
        const pct = st.asked > 0 ? Math.round((st.correct / st.asked) * 100) : 0;
        const textLeft = `${name}: ${st.correct}/${st.asked}`;
        const textRight = `${pct}%`;

        ctx.fillStyle = "#ffffff";
        drawRoundRect(ctx, currentX, yCursor, itemW, itemH, 10);
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.16)";
        ctx.stroke();

        ctx.fillStyle = "rgba(0,0,0,0.8)";
        ctx.font = "800 16px Arial, Helvetica, sans-serif";
        ctx.fillText(textLeft, currentX + 16, yCursor + 26);

        ctx.fillStyle = "#111";
        ctx.font = "900 16px Arial, Helvetica, sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(textRight, currentX + itemW - 16, yCursor + 26);
        ctx.textAlign = "left";

        if ((i + 1) % cols === 0) {
          currentX = rowX;
          yCursor += itemH + LAYOUT.perNoteGridRowGap;
        } else {
          currentX += itemW + LAYOUT.perNoteGridRowGap;
        }
      }
  
      ctx.textAlign = "center";
      ctx.font = "800 14px Arial, Helvetica, sans-serif";
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillText("Identifying Chromatic Notes - www.eartraininglab.com", W / 2, cardY + cardH - 24);
  
      const fileBase = name ? `${sanitizeFilenamePart(name)}_scorecard` : "scorecard";
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${fileBase}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, "image/png");
    }
  
    function setAnswerButtonsEnabled(enabled) {
      if (state.inputMode === "buttons") {
        answerButtons.querySelectorAll("button").forEach((b) => (b.disabled = !enabled));
      } else {
        answerKeyboard.classList.toggle("locked", !enabled);
      }
    }
  
    function clearAnswerButtonStates() {
      const els = state.inputMode === "buttons" 
        ? answerButtons.querySelectorAll("button") 
        : answerKeyboard.querySelectorAll(".int-key");

      els.forEach((el) => {
        el.classList.remove("correct", "incorrect", "chosen");
        if (state.inputMode === "buttons") el.setAttribute("aria-pressed", "false");
      });
    }
  
    function updateControls() {
      const canReplay = state.started && !!state.target;
      replayBtn.disabled = !canReplay;
      setSyncedClass(replayBtn, "pulse", canReplay);
  
      refTonicBtn.disabled = !state.started;
  
      const canNext = state.started && state.awaitingNext;
      nextBtn.disabled = !canNext;
      setSyncedClass(nextBtn, "nextReady", canNext);
  
      beginBtn.textContent = state.started ? "End/Restart Game" : "Begin Game";
      setSyncedClass(beginBtn, "pulse", !state.started);
      beginBtn.classList.toggle("primary", !state.started);
      beginBtn.classList.toggle("isRestart", state.started);
  
      setAnswerButtonsEnabled(state.started && !state.awaitingNext && !!state.target);
    }
  
    function getAppliedRangeValue() { return String(state.rangeMode); }
    function getAppliedNotesValue() { return String(state.notesCount); }
    function getAppliedInputValue() { return String(state.inputMode); }
    
    function isSettingsDirty() {
      return String(settingsRangeSelect.value) !== getAppliedRangeValue()
          || String(settingsNotesSelect.value) !== getAppliedNotesValue()
          || String(settingsInputSelect.value) !== getAppliedInputValue();
    }
    
    function updateSettingsDirtyUi() {
      const dirty = isSettingsDirty();
      settingsRestartBtn.disabled = !dirty;
      settingsRestartBtn.classList.toggle("is-disabled", !dirty);
    }
  
    function renderAnswerInputs() {
      answerButtons.innerHTML = "";
      answerKeyboard.innerHTML = "";

      if (state.inputMode === "buttons") {
        answerButtons.classList.remove("hidden");
        answerKeyboard.classList.add("hidden");

        const activeNames = CHROMATIC_NAMES.slice(0, state.notesCount);
        for (let i = 0; i < activeNames.length; i++) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "noteBtn";
            btn.dataset.pc = String(i);
            btn.setAttribute("aria-pressed", "false");
            btn.innerHTML = `<span class="note">${activeNames[i]}</span>`;
            btn.addEventListener("click", () => onAnswerClick(btn, i));
            answerButtons.appendChild(btn);
        }
      } else {
        answerButtons.classList.add("hidden");
        answerKeyboard.classList.remove("hidden");
        buildInteractiveKeyboard(answerKeyboard, state.notesCount, onAnswerClick);
      }
    }
  
    function updateMiniKeyboard() {
      const C4_PITCH = pitchFromPcOct(0, 4); // Root reference C4
      
      // In-scale pitches (greyed out if inactive) - capped tightly at 1 octave between C4 and B4.
      const scalePitchSet = new Set();
      for (let i = 0; i < 12; i++) {
        scalePitchSet.add(C4_PITCH + i); 
      }
      
      // Active pitches (highlighted blue) - naturally capped by notesCount
      const activePitchSet = new Set();
      for (let pc = 0; pc < state.notesCount; pc++) {
        activePitchSet.add(C4_PITCH + pc);
      }
      
      buildDisplayKeyboard(activePitchSet, scalePitchSet);
    }
  
    // ---------------- game flow ----------------
    function randomInt(min, max) {
      const a = Math.ceil(min);
      const b = Math.floor(max);
      return Math.floor(Math.random() * (b - a + 1)) + a;
    }
  
    function pickRandomTargetPitch() {
      const pc = randomInt(0, state.notesCount - 1);
      let oct;
      
      // Multiple Octaves mode strictly uses C2 to C6
      if (state.rangeMode === "multi") {
        let availableOctaves = [2, 3, 4, 5];
        if (pc === 0) availableOctaves.push(6); // allows exact C6 peak note
        oct = availableOctaves[randomInt(0, availableOctaves.length - 1)];
      } else {
        oct = 4; // C4 is the new default single octave root
      }
      
      return { pitch: oct * 12 + pc, pc, name: CHROMATIC_NAMES[pc] };
    }
  
    async function startRound({ autoplay = true } = {}) {
      if (!state.started) return;
  
      clearAnswerButtonStates();
      state.awaitingNext = false;
  
      const t = pickRandomTargetPitch();
      state.target = t;

      if (score.perNote[state.target.name]) {
        score.perNote[state.target.name].asked += 1;
      }
  
      setPhase("Identify pitch relative to C");
      setFeedback("Which note was that? 🔉");
      
      updateControls();
      await new Promise(requestAnimationFrame);
  
      if (autoplay) await playPitch(state.target.pitch, 1);
    }
  
    function resetScore() {
      score.correct = 0;
      score.incorrect = 0;
      score.lastWasCorrect = null;
      score.perNote = {};
      
      const activeNames = CHROMATIC_NAMES.slice(0, state.notesCount);
      for (const name of activeNames) {
        score.perNote[name] = { asked: 0, correct: 0 };
      }

      renderScorePills();
    }
  
    async function startGame() {
      stopAllNotesWithUi(0.06);
      stopAllUiSounds();

      renderAnswerInputs();
      updateMiniKeyboard();
      resetScore();
      
      state.started = true;
      state.awaitingNext = false;
      state.target = null;
  
      updateControls();
      updateScoreMeta();
      await startRound({ autoplay: true });
    }
  
    function returnToStartScreen({ openIntro = false } = {}) {
      stopAllNotesWithUi(0.06);
      stopAllUiSounds();
  
      state.started = false;
      state.awaitingNext = false;
      state.target = null;
  
      clearAnswerButtonStates();
      resetScore();
      setPhase("Ready");
  
      if (openIntro) {
        openModal(introModal);
        try { introBeginBtn.focus(); } catch {}
      }
      setFeedback("Press <strong>Begin Game</strong> to start.");
      
      updateControls();
    }
  
    async function onAnswerClick(element, clickedPc) {
      if (!state.started || state.awaitingNext || !state.target) return;
    
      clearAnswerButtonStates();
      element.classList.add("chosen");
      if (state.inputMode === "buttons") element.setAttribute("aria-pressed", "true");
    
      const isCorrect = clickedPc === state.target.pc;
  
      const fadeOutSec = getRefFadeOutSec();
      stopAllNotesWithUi(fadeOutSec);
      stopAllUiSounds();
  
      if (isCorrect) {
        setTimeout(() => playUiSound(UI_SND_CORRECT), 20);      
      } else {
        playUiSound(UI_SND_INCORRECT);
      }
    
      score.lastWasCorrect = isCorrect;
      if (isCorrect) {
        score.correct += 1;
        if (score.perNote[state.target.name]) {
          score.perNote[state.target.name].correct += 1;
        }
      } else {
        score.incorrect += 1;
      }
    
      renderScorePills();
    
      if (isCorrect) {
        element.classList.add("correct");
        setFeedback(`✅ Correct - nice one! That note was <strong>${state.target.name}</strong>.`);
      } else {
        element.classList.add("incorrect");
        
        // Find and highlight correct answer
        const correctEl = state.inputMode === "buttons" 
            ? answerButtons.querySelector(`button[data-pc="${state.target.pc}"]`)
            : answerKeyboard.querySelector(`.int-key[data-pc="${state.target.pc}"]`);
        
        if (correctEl) correctEl.classList.add("correct");
        setFeedback(`❌ Uh oh! That note was actually <strong>${state.target.name}</strong>. Give it another go!`);
      }
    
      state.awaitingNext = true;
      updateControls();
    }
  
    async function replayTarget() {
      if (!state.started || !state.target) return;
      await playPitch(state.target.pitch, 1);
    }
  
    function stopAllNotesWithUi(fadeSec = 0.05) {
      stopAllNotes(fadeSec);
    }
  
    // Unified Reference to C4 root.
    async function playC4Reference() {
      await resumeAudioIfNeeded();
      const ctx = ensureAudioGraph();
      if (!ctx) return;
  
      const fadeOutSec = getRefFadeOutSec();
      const noteSec = 7;
  
      stopAllNotesWithUi(fadeOutSec);
  
      const pitch = pitchFromPcOct(0, 4); // C4
      const when = ctx.currentTime + 0.03;
  
      const { missingUrl, buffer } = await loadPitchBuffer(pitch);
      if (!buffer) {
        maybeWarnSynthFallback(missingUrl);
        playSynthToneWindowed(pitch, when, noteSec, fadeOutSec, 0.7);
        return;
      }
      playBufferWindowed(buffer, when, noteSec, fadeOutSec, 0.95);
    }
  
    // ---------------- modals ----------------
    let lastFocusEl = null;
  
    function openModal(modalEl) {
      lastFocusEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      modalEl.classList.remove("hidden");
      postHeightNow();
    }
  
    function closeModal(modalEl) {
      modalEl.classList.add("hidden");
      postHeightNow();
      if (lastFocusEl) {
        try { lastFocusEl.focus(); } catch {}
      }
    }
  
    function isVisible(modalEl) { return !modalEl.classList.contains("hidden"); }
    function loadInitialRange() { return "one"; }
    function loadInitialNotes() {
      const saved = localStorage.getItem(LS_KEY_NOTES);
      return saved ? String(saved) : "12"; 
    }
    function loadInitialInput() {
      const saved = localStorage.getItem(LS_KEY_INPUT);
      return saved ? String(saved) : "keyboard"; 
    }
  
    function loadInitialName() {
      const saved = localStorage.getItem(LS_KEY_NAME);
      const v = String(saved || "").trim();
      return v.slice(0, 32);
    }
  
    function saveName(name) { try { localStorage.setItem(LS_KEY_NAME, String(name || "").trim().slice(0, 32)); } catch {} }
    function saveRange(mode) { try { localStorage.setItem(LS_KEY_RANGE, mode); } catch {} }
    function saveNotes(notes) { try { localStorage.setItem(LS_KEY_NOTES, notes); } catch {} }
    function saveInput(mode) { try { localStorage.setItem(LS_KEY_INPUT, mode); } catch {} }
  
    function sanitizeFilenamePart(s) {
      const v = String(s || "").trim().replace(/\s+/g, "_");
      const cleaned = v.replace(/[^a-zA-Z0-9_\-]+/g, "");
      return cleaned.slice(0, 32) || "";
    }
  
    async function loadImage(src) {
      return await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
      });
    }
  
    function drawImageContain(ctx, img, x, y, w, h) {
      const iw = img.naturalWidth || img.width || 1;
      const ih = img.naturalHeight || img.height || 1;
      const r = Math.min(w / iw, h / ih);
      const dw = Math.max(1, iw * r);
      const dh = Math.max(1, ih * r);
      const dx = x + (w - dw) / 2;
      const dy = y + (h - dh) / 2;
      ctx.drawImage(img, dx, dy, dw, dh);
      return { w: dw, h: dh, x: dx, y: dy };
    }
  
    function safeText(s) { return String(s || "").replace(/[\u0000-\u001f\u007f]/g, "").trim(); }

    function syncNames(val) {
      if (playerNameInput && playerNameInput.value !== val) playerNameInput.value = val;
      if (modalPlayerNameInput && modalPlayerNameInput.value !== val) modalPlayerNameInput.value = val;
    }
    if (playerNameInput) playerNameInput.addEventListener("input", (e) => syncNames(e.target.value));
    if (modalPlayerNameInput) modalPlayerNameInput.addEventListener("input", (e) => syncNames(e.target.value));
  
    // ---------------- events ----------------
    
    let scoreModalContinueCallback = null;

    function showScoreModal(onContinue) {
      scoreModalContinueCallback = onContinue;
      openModal(scoreModal);
      try { scoreModalContinueBtn.focus(); } catch {}
    }

    scoreModalContinueBtn.addEventListener("click", () => {
      playUiSound(UI_SND_SELECT);
      closeModal(scoreModal);
      if (scoreModalContinueCallback) scoreModalContinueCallback();
    });

    beginBtn.addEventListener("click", async () => {
      if (!state.started) {
        if (introModal && !introModal.classList.contains("hidden")) closeModal(introModal);
        await startGame();
        return;
      }
      
      showScoreModal(() => {
        returnToStartScreen({ openIntro: true });
      });
    });
  
    replayBtn.addEventListener("click", async () => { await replayTarget(); });
  
    nextBtn.addEventListener("click", async () => {
      if (!state.started || !state.awaitingNext) return;
      const fadeOutSec = getRefFadeOutSec(); 
      stopAllNotesWithUi(fadeOutSec);        
      stopAllUiSounds(); 
      await startRound({ autoplay: true });
    });
  
    refTonicBtn.addEventListener("click", async () => { await playC4Reference(); });
  
    downloadScorecardBtn.addEventListener("click", async () => {
      playUiSound(UI_SND_SELECT);
      await downloadScorecardPng(playerNameInput);
    });

    modalDownloadScorecardBtn.addEventListener("click", async () => {
      playUiSound(UI_SND_SELECT);
      await downloadScorecardPng(modalPlayerNameInput);
    });
  
    // ---------------- settings selects (<select>) ----------------
  
    function populateSelect(sel, options) {
      if (!sel) return;
      sel.innerHTML = "";
      for (const opt of options) {
        const o = document.createElement("option");
        o.value = opt.key;
        o.textContent = opt.label;
        sel.appendChild(o);
      }
    }
  
    function rangeLabel(mode) {
      const m = mode === "multi" ? "multi" : "one";
      const label = RANGE_OPTIONS.find((r) => r.key === m)?.label || (m === "multi" ? "Range: Multiple Octaves" : "Range: One Octave");
      return label.replace(/^Range:\s*/, "");
    }
  
    function updateScoreMeta() {
      const limitStr = state.notesCount == 12 ? "All 12" : `C to ${CHROMATIC_NAMES[state.notesCount - 1]}`;
      if (scoreMeta) scoreMeta.textContent = `Range: ${rangeLabel(state.rangeMode)} • Notes: ${limitStr}`;
      if (modalScoreMeta) modalScoreMeta.textContent = `Range: ${rangeLabel(state.rangeMode)} • Notes: ${limitStr}`;
    }
  
    function updateSettingsSelectUi() {
      if (settingsRangeSelect) settingsRangeSelect.value = state.rangeMode;
      if (settingsNotesSelect) settingsNotesSelect.value = state.notesCount;
      if (settingsInputSelect) settingsInputSelect.value = state.inputMode;
      updateScoreMeta();
    }
  
    function applyRangeMode(mode) { state.rangeMode = mode === "multi" ? "multi" : "one"; }
    function applyNotesMode(notesStr) { state.notesCount = parseInt(notesStr) || 12; }
    function applyInputMode(mode) { state.inputMode = mode === "keyboard" ? "keyboard" : "buttons"; }
  
    function openSettingsModal() {
      stopAllNotesWithUi(getRefFadeOutSec());
      updateSettingsSelectUi();
      openModal(settingsModal);
      updateSettingsDirtyUi();
      try { settingsRangeSelect.focus(); } catch {}
    }
  
    settingsRangeSelect.addEventListener("change", updateSettingsDirtyUi);
    settingsNotesSelect.addEventListener("change", updateSettingsDirtyUi);
    settingsInputSelect.addEventListener("change", updateSettingsDirtyUi);
  
    settingsBtn.addEventListener("click", () => {
      playUiSound(UI_SND_SELECT);
      openSettingsModal();
    });
  
    settingsCancelBtn.addEventListener("click", () => {
      playUiSound(UI_SND_BACK);
      updateSettingsSelectUi();
      updateSettingsDirtyUi(); 
      closeModal(settingsModal);
    });
  
    settingsRestartBtn.addEventListener("click", () => {
      if (settingsRestartBtn.disabled) return;
      const newRange = String(settingsRangeSelect.value || "one");
      const newNotes = String(settingsNotesSelect.value || "12");
      const newInput = String(settingsInputSelect.value || "buttons");
  
      closeModal(settingsModal);
      playUiSound(UI_SND_SELECT);

      showScoreModal(() => {
        saveRange(newRange);
        saveNotes(newNotes);
        saveInput(newInput);
    
        stopAllNotesWithUi(0.06);
        stopAllUiSounds();
    
        state.started = false;
        state.awaitingNext = false;
        state.target = null;
        
        applyRangeMode(newRange);
        applyNotesMode(newNotes);
        applyInputMode(newInput);
        
        updateSettingsSelectUi();
        renderAnswerInputs();
        updateMiniKeyboard();
        resetScore();
    
        setPhase("Ready");
        setFeedback("Press <strong>Begin Game</strong> to start.");
        updateControls();
        
        try { beginBtn.focus(); } catch {}
      });
    });
  
    // ---------------- intro modal ----------------
    function handleIntroContinue() {
      playUiSound(UI_SND_SELECT);
      
      const newRange = String(introRangeSelect.value || "one");
      const newNotes = String(introNotesSelect.value || "12");
      const newInput = String(introInputSelect.value || "buttons");
  
      saveRange(newRange);
      saveNotes(newNotes);
      saveInput(newInput);
  
      applyRangeMode(newRange);
      applyNotesMode(newNotes);
      applyInputMode(newInput);
      
      updateSettingsSelectUi();
      renderAnswerInputs();
      updateMiniKeyboard();
      resetScore();
  
      if (settingsRangeSelect) settingsRangeSelect.value = newRange;
      if (settingsNotesSelect) settingsNotesSelect.value = newNotes;
      if (settingsInputSelect) settingsInputSelect.value = newInput;
  
      closeModal(introModal);
      setFeedback("Press <strong>Begin Game</strong> to start.");
      try { beginBtn.focus(); } catch {}
    }
  
    introBeginBtn.addEventListener("click", handleIntroContinue);
    introBeginBtnTop.addEventListener("click", handleIntroContinue);
  
    infoBtn.addEventListener("click", () => {
      stopAllNotesWithUi(getRefFadeOutSec());
      playUiSound(UI_SND_SELECT);
      openModal(infoModal);
      try { infoClose.focus(); } catch {}
    });
  
    infoClose.addEventListener("click", () => {
      playUiSound(UI_SND_BACK);
      closeModal(infoModal);
    });
  
    [infoModal, settingsModal].forEach((m) => {
      m.addEventListener("click", (e) => {
        if (e.target === m) {
          playUiSound(UI_SND_BACK);
          if (m === settingsModal) updateSettingsSelectUi();
          closeModal(m);
        }
      });
    });
  
    introModal.addEventListener("click", (e) => {
      if (e.target === introModal) {
        playUiSound(UI_SND_BACK);
      }
    });
  
    window.addEventListener("keydown", async (e) => {
      if (e.key === "Escape") {
        if (isVisible(settingsModal)) {
          playUiSound(UI_SND_BACK);
          updateSettingsSelectUi();
          closeModal(settingsModal);
          return;
        }
        if (isVisible(infoModal)) {
          playUiSound(UI_SND_BACK);
          closeModal(infoModal);
          return;
        }
        return;
      }
  
      if (isVisible(settingsModal) || isVisible(infoModal) || isVisible(introModal) || isVisible(scoreModal)) return;
  
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        await replayTarget();
        return;
      }
  
      if (e.key === " " || e.code === "Space") {
        if (!nextBtn.disabled) {
          e.preventDefault();
          await startRound({ autoplay: true });
        }
      }
    });
  
    // ---------------- init ----------------
    function init() {
      setPulseSyncDelay(beginBtn);
      setPulseSyncDelay(introBeginBtn);
      setPulseSyncDelay(introBeginBtnTop); 
  
      const initialName = loadInitialName();
      if (playerNameInput) playerNameInput.value = initialName;
      if (modalPlayerNameInput) modalPlayerNameInput.value = initialName;
  
      populateSelect(settingsRangeSelect, RANGE_OPTIONS);
      populateSelect(settingsNotesSelect, NOTES_OPTIONS);
      populateSelect(settingsInputSelect, INPUT_OPTIONS);
      
      populateSelect(introRangeSelect, RANGE_OPTIONS);
      populateSelect(introNotesSelect, NOTES_OPTIONS);
      populateSelect(introInputSelect, INPUT_OPTIONS);
  
      const initialRange = loadInitialRange();
      const initialNotes = loadInitialNotes();
      const initialInput = loadInitialInput();
      
      applyRangeMode(initialRange);
      applyNotesMode(initialNotes);
      applyInputMode(initialInput);
      
      updateSettingsSelectUi();
  
      if (introRangeSelect) introRangeSelect.value = initialRange;
      if (introNotesSelect) introNotesSelect.value = initialNotes;
      if (introInputSelect) introInputSelect.value = initialInput;
  
      renderAnswerInputs();
      updateMiniKeyboard();
      renderScorePills();
      
      setPhase("Ready");
      setFeedback("Press <strong>Begin Game</strong> to start.");
      updateControls();
  
      openModal(introModal);
      try { introBeginBtn.focus(); } catch {}
    }
  
    init();
  })();
