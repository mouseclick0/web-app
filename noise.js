/* Ambient noise & nature sounds (Web Audio API, browser-only) */
(function () {
  "use strict";

  if (typeof window !== "undefined" && window.__WEBTOOLBAY_NOISE__) return;
  if (typeof window !== "undefined") window.__WEBTOOLBAY_NOISE__ = true;

  var BUFFER_SECONDS = 3;
  var DEFAULT_VOLUME = 0.35;
  var MAX_DURATION_STEPS = 12; // 0 = continuous, 1..12 = 10..120 minutes

  var els = {};
  var audioCtx = null;
  var masterGain = null;
  var buffers = Object.create(null);
  var activeNodes = [];
  var stopTimer = null;
  var tickTimer = null;
  var endsAt = 0;

  var state = {
    type: "white",
    playing: false,
    volume: DEFAULT_VOLUME,
    durationSteps: 0
  };

  function tt(key, params) {
    return typeof window.t === "function" ? window.t(key, params) : key;
  }

  function $(id) {
    return document.getElementById(id);
  }

  function ensureAudio() {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtx) {
      audioCtx = new Ctx();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = state.volume;
      masterGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function fillWhite(data) {
    for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  function fillPink(data) {
    var b0 = 0;
    var b1 = 0;
    var b2 = 0;
    var b3 = 0;
    var b4 = 0;
    var b5 = 0;
    var b6 = 0;
    for (var i = 0; i < data.length; i++) {
      var white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
  }

  function fillBrown(data) {
    var last = 0;
    for (var i = 0; i < data.length; i++) {
      var white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
  }

  function getNoiseBuffer(kind) {
    var ctx = ensureAudio();
    if (!ctx) return null;
    var key = kind || "white";
    if (buffers[key]) return buffers[key];
    var length = Math.floor(ctx.sampleRate * BUFFER_SECONDS);
    var buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    if (key === "pink") fillPink(data);
    else if (key === "brown") fillBrown(data);
    else fillWhite(data);
    buffers[key] = buffer;
    return buffer;
  }

  function track(node) {
    if (node) activeNodes.push(node);
    return node;
  }

  function clearTimers() {
    if (stopTimer) {
      clearTimeout(stopTimer);
      stopTimer = null;
    }
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
    endsAt = 0;
  }

  function stopNoise() {
    clearTimers();
    activeNodes.forEach(function (node) {
      try {
        if (node.stop) node.stop();
      } catch (e) {}
      try {
        node.disconnect();
      } catch (e2) {}
    });
    activeNodes = [];
    state.playing = false;
    renderPlayingUi();
    updateDurationLabel();
  }

  function connectLoopNoise(buffer, dest) {
    var src = track(audioCtx.createBufferSource());
    src.buffer = buffer;
    src.loop = true;
    src.connect(dest);
    return src;
  }

  function makeLfo(freq, depth, targetParam, offset) {
    var lfo = track(audioCtx.createOscillator());
    var depthGain = track(audioCtx.createGain());
    lfo.type = "sine";
    lfo.frequency.value = freq;
    depthGain.gain.value = depth;
    if (typeof offset === "number") targetParam.value = offset;
    lfo.connect(depthGain);
    depthGain.connect(targetParam);
    return lfo;
  }

  function buildGraph(type) {
    var ctx = ensureAudio();
    if (!ctx || !masterGain) return null;

    var out = track(ctx.createGain());
    out.gain.value = 1;
    out.connect(masterGain);

    var starters = [];

    function startAll() {
      starters.forEach(function (n) {
        try {
          n.start();
        } catch (e) {}
      });
    }

    if (type === "white" || type === "pink" || type === "brown") {
      var plain = connectLoopNoise(getNoiseBuffer(type), out);
      starters.push(plain);
      out.gain.value = type === "white" ? 0.55 : type === "pink" ? 0.7 : 0.85;
      return { start: startAll };
    }

    if (type === "rain") {
      var rainFilter = track(ctx.createBiquadFilter());
      rainFilter.type = "bandpass";
      rainFilter.frequency.value = 1800;
      rainFilter.Q.value = 0.7;
      var rainHp = track(ctx.createBiquadFilter());
      rainHp.type = "highpass";
      rainHp.frequency.value = 500;
      var rainGain = track(ctx.createGain());
      rainGain.gain.value = 0.55;
      var rainSrc = connectLoopNoise(getNoiseBuffer("pink"), rainHp);
      rainHp.connect(rainFilter);
      rainFilter.connect(rainGain);
      rainGain.connect(out);
      starters.push(rainSrc);
      starters.push(makeLfo(0.15, 220, rainFilter.frequency, 1800));
      return { start: startAll };
    }

    if (type === "waterfall") {
      var fallBp = track(ctx.createBiquadFilter());
      fallBp.type = "bandpass";
      fallBp.frequency.value = 700;
      fallBp.Q.value = 0.45;
      var fallLp = track(ctx.createBiquadFilter());
      fallLp.type = "lowpass";
      fallLp.frequency.value = 3200;
      var fallGain = track(ctx.createGain());
      fallGain.gain.value = 0.62;
      var fallSrc = connectLoopNoise(getNoiseBuffer("pink"), fallBp);
      fallBp.connect(fallLp);
      fallLp.connect(fallGain);
      fallGain.connect(out);
      starters.push(fallSrc);
      starters.push(makeLfo(0.07, 180, fallBp.frequency, 700));
      return { start: startAll };
    }

    if (type === "waves") {
      var waveLp = track(ctx.createBiquadFilter());
      waveLp.type = "lowpass";
      waveLp.frequency.value = 480;
      waveLp.Q.value = 0.6;
      var waveGain = track(ctx.createGain());
      waveGain.gain.value = 0.45;
      var waveSrc = connectLoopNoise(getNoiseBuffer("brown"), waveLp);
      waveLp.connect(waveGain);
      waveGain.connect(out);
      starters.push(waveSrc);
      starters.push(makeLfo(0.06, 0.28, waveGain.gain, 0.42));
      starters.push(makeLfo(0.05, 160, waveLp.frequency, 420));
      return { start: startAll };
    }

    if (type === "stream") {
      var streamBp = track(ctx.createBiquadFilter());
      streamBp.type = "bandpass";
      streamBp.frequency.value = 1100;
      streamBp.Q.value = 1.1;
      var streamHp = track(ctx.createBiquadFilter());
      streamHp.type = "highpass";
      streamHp.frequency.value = 350;
      var streamGain = track(ctx.createGain());
      streamGain.gain.value = 0.5;
      var streamSrc = connectLoopNoise(getNoiseBuffer("pink"), streamHp);
      streamHp.connect(streamBp);
      streamBp.connect(streamGain);
      streamGain.connect(out);
      starters.push(streamSrc);
      starters.push(makeLfo(0.22, 260, streamBp.frequency, 1100));
      starters.push(makeLfo(0.11, 0.08, streamGain.gain, 0.5));
      return { start: startAll };
    }

    if (type === "wind") {
      var windLp = track(ctx.createBiquadFilter());
      windLp.type = "lowpass";
      windLp.frequency.value = 320;
      windLp.Q.value = 0.8;
      var windGain = track(ctx.createGain());
      windGain.gain.value = 0.4;
      var windSrc = connectLoopNoise(getNoiseBuffer("brown"), windLp);
      windLp.connect(windGain);
      windGain.connect(out);
      starters.push(windSrc);
      starters.push(makeLfo(0.04, 220, windLp.frequency, 280));
      starters.push(makeLfo(0.035, 0.22, windGain.gain, 0.38));
      return { start: startAll };
    }

    // Fallback to white
    var fallback = connectLoopNoise(getNoiseBuffer("white"), out);
    starters.push(fallback);
    return { start: startAll };
  }

  function durationMinutes() {
    return state.durationSteps <= 0 ? 0 : state.durationSteps * 10;
  }

  function formatClock(totalSec) {
    var s = Math.max(0, Math.floor(totalSec));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ":" + (r < 10 ? "0" : "") + r;
  }

  function updateDurationLabel() {
    if (!els.durationValue) return;
    var mins = durationMinutes();
    if (mins <= 0) {
      els.durationValue.textContent = tt("noise.duration.continuous");
    } else {
      els.durationValue.textContent = tt("noise.duration.minutes", { n: mins });
    }
    if (els.remain) {
      if (state.playing && endsAt > 0) {
        var left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
        els.remain.hidden = false;
        els.remain.textContent = tt("noise.status.remaining", { time: formatClock(left) });
      } else {
        els.remain.hidden = true;
        els.remain.textContent = "";
      }
    }
  }

  function scheduleStop() {
    clearTimers();
    var mins = durationMinutes();
    if (mins <= 0) {
      updateDurationLabel();
      return;
    }
    var ms = mins * 60 * 1000;
    endsAt = Date.now() + ms;
    stopTimer = setTimeout(function () {
      stopNoise();
      setStatus(tt("noise.status.finished"), false);
    }, ms);
    tickTimer = setInterval(function () {
      updateDurationLabel();
      if (endsAt && Date.now() >= endsAt) {
        clearTimers();
      }
    }, 1000);
    updateDurationLabel();
  }

  function startNoise() {
    var ctx = ensureAudio();
    if (!ctx || !masterGain) {
      setStatus(tt("noise.status.unsupported"), true);
      return;
    }
    stopNoise();
    var graph = buildGraph(state.type);
    if (!graph) return;
    masterGain.gain.setValueAtTime(state.volume, ctx.currentTime);
    graph.start();
    state.playing = true;
    scheduleStop();
    setPlayingStatus();
    renderPlayingUi();
  }

  function typeLabel(type) {
    return tt("noise.type." + type);
  }

  function setPlayingStatus() {
    var mins = durationMinutes();
    if (mins > 0) {
      setStatus(
        tt("noise.status.playingTimed", {
          type: typeLabel(state.type),
          n: mins
        }),
        false
      );
    } else {
      setStatus(tt("noise.status.playing", { type: typeLabel(state.type) }), false);
    }
  }

  function setStatus(text, isError) {
    if (!els.status) return;
    els.status.textContent = text || "";
    els.status.className = "noise-status" + (isError ? " is-error" : "");
  }

  function renderPlayingUi() {
    if (els.playBtn) els.playBtn.hidden = state.playing;
    if (els.stopBtn) els.stopBtn.hidden = !state.playing;
    if (els.panel) els.panel.classList.toggle("is-playing", state.playing);
    if (els.viz) els.viz.setAttribute("aria-hidden", state.playing ? "false" : "true");
    if (els.typeBtns) {
      Array.prototype.forEach.call(els.typeBtns, function (btn) {
        var active = btn.getAttribute("data-noise-type") === state.type;
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-pressed", active ? "true" : "false");
      });
    }
    updateDurationLabel();
  }

  function setType(type) {
    if (!type || type === state.type) return;
    var wasPlaying = state.playing;
    state.type = type;
    renderPlayingUi();
    if (wasPlaying) startNoise();
    else setStatus(tt("noise.status.ready", { type: typeLabel(state.type) }), false);
  }

  function setVolume(value) {
    var v = Number(value);
    if (!Number.isFinite(v)) return;
    state.volume = Math.min(1, Math.max(0, v));
    if (masterGain && audioCtx) {
      masterGain.gain.setTargetAtTime(state.volume, audioCtx.currentTime, 0.03);
    }
    if (els.volumeValue) {
      els.volumeValue.textContent = Math.round(state.volume * 100) + "%";
    }
  }

  function setDurationSteps(value) {
    var n = Math.round(Number(value));
    if (!Number.isFinite(n)) n = 0;
    state.durationSteps = Math.min(MAX_DURATION_STEPS, Math.max(0, n));
    if (els.duration) els.duration.value = String(state.durationSteps);
    updateDurationLabel();
    if (state.playing) {
      scheduleStop();
      setPlayingStatus();
    }
  }

  function cacheEls() {
    els.view = $("noiseView");
    els.panel = $("noisePanel");
    els.viz = $("noiseViz");
    els.playBtn = $("noisePlayBtn");
    els.stopBtn = $("noiseStopBtn");
    els.volume = $("noiseVolume");
    els.volumeValue = $("noiseVolumeValue");
    els.duration = $("noiseDuration");
    els.durationValue = $("noiseDurationValue");
    els.remain = $("noiseRemain");
    els.status = $("noiseStatus");
    els.typeBtns = document.querySelectorAll("[data-noise-type]");
  }

  function refreshI18n() {
    if (!els.view) return;
    if (state.playing) setPlayingStatus();
    else setStatus(tt("noise.status.ready", { type: typeLabel(state.type) }), false);
    renderPlayingUi();
  }

  function bind() {
    if (!els.view || els.view.dataset.noiseBound === "1") return;
    els.view.dataset.noiseBound = "1";

    Array.prototype.forEach.call(els.typeBtns, function (btn) {
      btn.addEventListener("click", function () {
        setType(btn.getAttribute("data-noise-type"));
      });
    });

    if (els.playBtn) {
      els.playBtn.addEventListener("click", function () {
        startNoise();
      });
    }
    if (els.stopBtn) {
      els.stopBtn.addEventListener("click", function () {
        stopNoise();
        setStatus(tt("noise.status.stopped"), false);
      });
    }
    if (els.volume) {
      els.volume.addEventListener("input", function () {
        setVolume(els.volume.value);
      });
    }
    if (els.duration) {
      els.duration.addEventListener("input", function () {
        setDurationSteps(els.duration.value);
      });
    }

    document.addEventListener("visibilitychange", function () {
      if (document.hidden && state.playing && audioCtx) {
        audioCtx.suspend();
      } else if (!document.hidden && state.playing && audioCtx && audioCtx.state === "suspended") {
        audioCtx.resume();
      }
    });
  }

  function init() {
    cacheEls();
    if (!els.view) return;
    if (els.volume) els.volume.value = String(state.volume);
    if (els.duration) els.duration.value = String(state.durationSteps);
    setVolume(state.volume);
    updateDurationLabel();
    renderPlayingUi();
    setStatus(tt("noise.status.ready", { type: typeLabel(state.type) }), false);
    bind();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.stopNoise = stopNoise;
  window.refreshNoiseI18n = refreshI18n;
})();
