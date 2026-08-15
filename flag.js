/* Flag quiz: show a flag, pick 1 of 4 countries, reveal capital */
(function () {
  "use strict";

  // Loaded from flag-countries.js (UN members + territories).
  var COUNTRIES =
    typeof window !== "undefined" &&
    window.FLAG_COUNTRIES &&
    window.FLAG_COUNTRIES.length
      ? window.FLAG_COUNTRIES
      : [];

  var BEST_KEY = "webtoolbay-flag-best";
  var USED_KEY = "webtoolbay-flag-used";
  var MAX_LIVES = 3;

  var els = {};
  var audioCtx = null;
  var state = {
    playing: false,
    answered: false,
    lives: MAX_LIVES,
    streak: 0,
    score: 0,
    best: 0,
    current: null,
    choices: [],
    usedCodes: Object.create(null)
  };

  function ensureAudio() {
    var AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!audioCtx) audioCtx = new AudioCtx();
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function playTone(freq, startOffset, duration, type, gainValue) {
    var ctx = ensureAudio();
    if (!ctx || !freq) return;
    var now = ctx.currentTime + (startOffset || 0);
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type || "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainValue || 0.18, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.04, duration - 0.02));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.03);
  }

  function playCorrectSound() {
    playTone(523.25, 0, 0.12, "triangle", 0.16);
    playTone(659.25, 0.09, 0.12, "triangle", 0.18);
    playTone(783.99, 0.18, 0.18, "triangle", 0.2);
  }

  function playWrongSound() {
    playTone(220, 0, 0.16, "square", 0.1);
    playTone(164.81, 0.12, 0.22, "square", 0.12);
  }

  function tt(key, params) {
    return typeof window.t === "function" ? window.t(key, params) : key;
  }

  function langBucket() {
    var lang = typeof window.getLang === "function" ? window.getLang() : "ko";
    return lang === "ko" ? "ko" : "en";
  }

  function labelOf(country) {
    var bucket = langBucket();
    return (country[bucket] || country.en).name;
  }

  function capitalOf(country) {
    var bucket = langBucket();
    return (country[bucket] || country.en).capital;
  }

  function flagUrl(countryOrCode) {
    var country =
      typeof countryOrCode === "object" && countryOrCode
        ? countryOrCode
        : COUNTRIES.filter(function (c) {
            return c.code === countryOrCode;
          })[0];
    if (country && country.flag) return country.flag;
    var code = country ? country.code : String(countryOrCode || "");
    // SVG keeps official proportions (e.g. square CH, non-rectangular NP).
    return "https://flagcdn.com/" + code + ".svg";
  }

  function fitFlagImage() {
    var img = els.flagImg;
    if (!img || !img.parentElement) return;
    var frame = img.parentElement;
    var pad = 24;
    var fw = Math.max(1, frame.clientWidth - pad);
    var fh = Math.max(1, frame.clientHeight - pad);
    var nw = img.naturalWidth || 0;
    var nh = img.naturalHeight || 0;
    if (!nw || !nh) {
      // SVG may report 0 until laid out; fall back to viewBox-ish square.
      nw = 320;
      nh = 320;
    }
    var scale = Math.min(fw / nw, fh / nh);
    img.style.width = Math.max(1, Math.floor(nw * scale)) + "px";
    img.style.height = Math.max(1, Math.floor(nh * scale)) + "px";
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  function maxTierForStreak(streak) {
    // Well-known first; raise difficulty as the run streak grows.
    if (streak >= 121) return 3;
    if (streak >= 61) return 2;
    return 1;
  }

  function readUsedCodes() {
    var map = Object.create(null);
    try {
      var raw = sessionStorage.getItem(USED_KEY);
      if (!raw) return map;
      var list = JSON.parse(raw);
      if (Array.isArray(list)) {
        list.forEach(function (code) {
          if (code) map[String(code)] = true;
        });
      }
    } catch (e) {}
    return map;
  }

  function writeUsedCodes() {
    try {
      sessionStorage.setItem(USED_KEY, JSON.stringify(Object.keys(state.usedCodes)));
    } catch (e) {}
  }

  function clearUsedCodes() {
    state.usedCodes = Object.create(null);
    try {
      sessionStorage.removeItem(USED_KEY);
    } catch (e) {}
  }

  function markUsed(code) {
    if (!code) return;
    state.usedCodes[String(code)] = true;
    writeUsedCodes();
  }

  function unusedCountries(maxTier) {
    return COUNTRIES.filter(function (c) {
      return c.tier <= maxTier && !state.usedCodes[c.code];
    });
  }

  function pickAnswer() {
    var maxTier = maxTierForStreak(state.streak);
    var pool = [];
    // Prefer the hardest unlocked tier so difficulty rises with streak.
    for (var t = maxTier; t >= 1; t--) {
      pool = COUNTRIES.filter(function (c) {
        return c && c.code && c.tier === t && !state.usedCodes[c.code];
      });
      if (pool.length) break;
    }
    // If the unlocked pool is empty before the next streak gate, keep going.
    if (!pool.length) {
      pool = COUNTRIES.filter(function (c) {
        return c && c.code && !state.usedCodes[c.code];
      });
    }
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function pickChoices(answer) {
    var sameTier = COUNTRIES.filter(function (c) {
      return c.code !== answer.code && Math.abs(c.tier - answer.tier) <= 1;
    });
    if (sameTier.length < 3) {
      sameTier = COUNTRIES.filter(function (c) { return c.code !== answer.code; });
    }
    var distractors = shuffle(sameTier).slice(0, 3);
    return shuffle([answer].concat(distractors));
  }

  function loadBest() {
    try {
      var n = Number(localStorage.getItem(BEST_KEY) || 0);
      state.best = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    } catch (e) {
      state.best = 0;
    }
  }

  function saveBest() {
    if (state.score > state.best) {
      state.best = state.score;
      try {
        localStorage.setItem(BEST_KEY, String(state.best));
      } catch (e) {}
    }
  }

  function renderHud() {
    if (els.streak) els.streak.textContent = String(state.streak);
    if (els.score) els.score.textContent = String(state.score);
    if (els.best) els.best.textContent = String(state.best);
    if (els.lives) {
      var hearts = "";
      for (var i = 0; i < MAX_LIVES; i++) {
        hearts += i < state.lives ? "❤️" : "🖤";
      }
      els.lives.textContent = hearts;
      els.lives.setAttribute("aria-label", tt("flag.livesAria", { n: state.lives }));
    }
  }

  function setIdle() {
    state.playing = false;
    state.answered = false;
    state.current = null;
    state.choices = [];
    if (els.playArea) els.playArea.hidden = true;
    if (els.idle) els.idle.hidden = false;
    if (els.feedback) {
      els.feedback.hidden = true;
      els.feedback.className = "flag-feedback";
      els.feedback.textContent = "";
    }
    if (els.nextBtn) els.nextBtn.hidden = true;
    if (els.restartBtn) els.restartBtn.hidden = true;
    renderHud();
  }

  function startGame(resetUsed) {
    ensureAudio();
    state.playing = true;
    state.answered = false;
    state.lives = MAX_LIVES;
    state.streak = 0;
    state.score = 0;
    if (resetUsed !== false) {
      clearUsedCodes();
    } else {
      state.usedCodes = readUsedCodes();
    }
    if (els.idle) els.idle.hidden = true;
    if (els.playArea) els.playArea.hidden = false;
    if (els.restartBtn) els.restartBtn.hidden = true;
    nextRound();
  }

  function showRestartOnly() {
    if (els.nextBtn) els.nextBtn.hidden = true;
    if (els.restartBtn) els.restartBtn.hidden = false;
  }

  function gameOver() {
    state.playing = false;
    if (state.current) markUsed(state.current.code);
    saveBest();
    renderHud();
    if (els.feedback) {
      els.feedback.hidden = false;
      els.feedback.className = "flag-feedback is-over";
      els.feedback.innerHTML =
        "<strong>" +
        escapeHtml(tt("flag.gameOver")) +
        "</strong><span>" +
        escapeHtml(tt("flag.gameOverDetail", { score: state.score, best: state.best })) +
        "</span>";
    }
    showRestartOnly();
    if (els.choices) {
      Array.prototype.forEach.call(els.choices.querySelectorAll("button"), function (btn) {
        btn.disabled = true;
      });
    }
  }

  function deckComplete() {
    state.playing = false;
    saveBest();
    renderHud();
    if (els.feedback) {
      els.feedback.hidden = false;
      els.feedback.className = "flag-feedback is-correct";
      els.feedback.innerHTML =
        "<strong>" +
        escapeHtml(tt("flag.deckDone")) +
        "</strong><span>" +
        escapeHtml(tt("flag.deckDoneDetail", { score: state.score })) +
        "</span>";
    }
    showRestartOnly();
    if (els.choices) {
      els.choices.innerHTML = "";
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatDetailLine(key, country, capital) {
    return escapeHtml(tt(key))
      .split("{country}")
      .join('<b class="flag-hl-country">' + escapeHtml(country) + "</b>")
      .split("{capital}")
      .join('<b class="flag-hl-capital">' + escapeHtml(capital) + "</b>");
  }

  function renderAnswerFeedback(correct) {
    if (!els.feedback || !state.current) return;
    els.feedback.hidden = false;
    els.feedback.className = "flag-feedback " + (correct ? "is-correct" : "is-wrong");
    els.feedback.innerHTML =
      "<strong>" +
      escapeHtml(tt(correct ? "flag.correct" : "flag.wrong")) +
      "</strong><span>" +
      formatDetailLine(
        correct ? "flag.capitalLine" : "flag.answerLine",
        labelOf(state.current),
        capitalOf(state.current)
      ) +
      "</span>";
  }

  function nextRound() {
    if (!state.playing) return;
    state.answered = false;
    var answer = pickAnswer();
    if (!answer) {
      deckComplete();
      return;
    }
    state.current = answer;
    markUsed(answer.code);
    state.choices = pickChoices(answer);

    if (els.flagImg) {
      els.flagImg.alt = tt("flag.flagAlt");
      els.flagImg.removeAttribute("width");
      els.flagImg.removeAttribute("height");
      els.flagImg.removeAttribute("srcset");
      els.flagImg.removeAttribute("sizes");
      els.flagImg.onload = function () {
        fitFlagImage();
      };
      // Cache-bust so a previous SVG is not reused by the browser for a new round.
      var url = flagUrl(answer);
      els.flagImg.src = url + (url.indexOf("?") === -1 ? "?" : "&") + "r=" + encodeURIComponent(answer.code);
      if (els.flagImg.complete) fitFlagImage();
    }
    if (els.feedback) {
      els.feedback.hidden = true;
      els.feedback.className = "flag-feedback";
      els.feedback.textContent = "";
    }
    if (els.nextBtn) els.nextBtn.hidden = true;
    renderChoices();
    renderHud();
  }

  function renderChoices() {
    if (!els.choices) return;
    els.choices.innerHTML = "";
    state.choices.forEach(function (country) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "flag-choice";
      btn.textContent = labelOf(country);
      btn.dataset.code = country.code;
      btn.addEventListener("click", function () {
        onPick(country.code, btn);
      });
      els.choices.appendChild(btn);
    });
  }

  function onPick(code, btn) {
    if (!state.playing || state.answered || !state.current) return;
    state.answered = true;
    // Lock this flag out for the rest of the run, win or lose.
    markUsed(state.current.code);
    var correct = code === state.current.code;
    var buttons = els.choices.querySelectorAll("button");
    Array.prototype.forEach.call(buttons, function (b) {
      b.disabled = true;
      if (b.dataset.code === state.current.code) b.classList.add("is-correct");
      if (b === btn && !correct) b.classList.add("is-wrong");
    });

    if (correct) {
      state.streak += 1;
      state.score += 10 + Math.min(state.streak, 20);
      saveBest();
      playCorrectSound();
      renderAnswerFeedback(true);
      if (els.nextBtn) {
        els.nextBtn.hidden = false;
        els.nextBtn.focus();
      }
    } else {
      state.lives -= 1;
      playWrongSound();
      renderAnswerFeedback(false);
      if (state.lives <= 0) {
        gameOver();
      } else if (els.nextBtn) {
        els.nextBtn.hidden = false;
        els.nextBtn.focus();
      }
    }
    renderHud();
  }

  function cacheEls() {
    els.view = document.getElementById("flagView");
    els.idle = document.getElementById("flagIdle");
    els.playArea = document.getElementById("flagPlayArea");
    els.startBtn = document.getElementById("flagStartBtn");
    els.nextBtn = document.getElementById("flagNextBtn");
    els.restartBtn = document.getElementById("flagRestartBtn");
    els.flagImg = document.getElementById("flagImage");
    els.choices = document.getElementById("flagChoices");
    els.feedback = document.getElementById("flagFeedback");
    els.streak = document.getElementById("flagStreakHud");
    els.score = document.getElementById("flagScoreHud");
    els.best = document.getElementById("flagBestHud");
    els.lives = document.getElementById("flagLivesHud");
  }

  function bind() {
    if (!els.view) return;
    if (els.startBtn) {
      els.startBtn.addEventListener("click", function () {
        startGame(true);
      });
    }
    if (els.nextBtn) {
      els.nextBtn.addEventListener("click", function () {
        // Never restart from "next" — that was clearing used flags mid-run.
        if (!state.playing || state.lives <= 0 || !state.answered) return;
        nextRound();
      });
    }
    if (els.restartBtn) {
      els.restartBtn.addEventListener("click", function () {
        startGame(true);
      });
    }
    window.addEventListener("resize", function () {
      if (state.playing && els.flagImg && els.flagImg.src) fitFlagImage();
    });
  }

  function refreshI18n() {
    if (!els.view || els.view.hidden) return;
    if (state.playing && state.current && !state.answered) {
      renderChoices();
    } else if (state.playing && state.current && state.answered) {
      // Keep choice button labels in sync after language switch mid-round.
      var buttons = els.choices ? els.choices.querySelectorAll("button") : [];
      Array.prototype.forEach.call(buttons, function (b) {
        var found = COUNTRIES.filter(function (c) { return c.code === b.dataset.code; })[0];
        if (found) b.textContent = labelOf(found);
      });
      if (els.feedback && !els.feedback.hidden && state.current) {
        var wasCorrect = els.feedback.classList.contains("is-correct");
        if (els.feedback.classList.contains("is-over")) {
          els.feedback.innerHTML =
            "<strong>" +
            escapeHtml(tt("flag.gameOver")) +
            "</strong><span>" +
            escapeHtml(tt("flag.gameOverDetail", { score: state.score, best: state.best })) +
            "</span>";
        } else {
          renderAnswerFeedback(wasCorrect);
        }
      }
    }
    renderHud();
  }

  function init() {
    cacheEls();
    if (!els.view) return;
    state.usedCodes = readUsedCodes();
    loadBest();
    setIdle();
    bind();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.refreshFlagI18n = refreshI18n;
})();
