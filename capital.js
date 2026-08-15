/* Capital quiz: show country + flag, pick 1 of 4 capitals */
(function () {
  "use strict";

  if (typeof window !== "undefined" && window.__WEBTOOLBAY_CAPITAL_QUIZ__) return;
  if (typeof window !== "undefined") window.__WEBTOOLBAY_CAPITAL_QUIZ__ = true;

  var COUNTRIES =
    typeof window !== "undefined" &&
    window.FLAG_COUNTRIES &&
    window.FLAG_COUNTRIES.length
      ? window.FLAG_COUNTRIES
      : [];

  var CITIES =
    typeof window !== "undefined" && window.FLAG_CITIES ? window.FLAG_CITIES : {};

  var BEST_KEY = "webtoolbay-capital-best";
  var USED_KEY = "webtoolbay-capital-used";
  var MAX_LIVES = 3;

  var els = {};
  var audioCtx = null;
  var state = {
    playing: false,
    answered: false,
    picking: false,
    lives: MAX_LIVES,
    streak: 0,
    score: 0,
    best: 0,
    current: null,
    choices: [],
    usedCodes: Object.create(null),
    usedList: []
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
    if (streak >= 121) return 3;
    if (streak >= 61) return 2;
    return 1;
  }

  function isUsed(code) {
    return !!state.usedCodes[String(code)];
  }

  function readUsedList() {
    try {
      var raw = sessionStorage.getItem(USED_KEY);
      if (!raw) return [];
      var list = JSON.parse(raw);
      if (!Array.isArray(list)) return [];
      return list
        .map(function (code) {
          return code ? String(code) : "";
        })
        .filter(Boolean);
    } catch (e) {
      return [];
    }
  }

  function applyUsedList(list) {
    state.usedList = [];
    state.usedCodes = Object.create(null);
    (list || []).forEach(function (code) {
      if (!code || state.usedCodes[code]) return;
      state.usedCodes[code] = true;
      state.usedList.push(code);
    });
  }

  function writeUsedCodes() {
    try {
      sessionStorage.setItem(USED_KEY, JSON.stringify(state.usedList));
    } catch (e) {}
  }

  function clearUsedCodes() {
    state.usedList = [];
    state.usedCodes = Object.create(null);
    try {
      sessionStorage.removeItem(USED_KEY);
    } catch (e) {}
  }

  function markUsed(code) {
    if (!code) return;
    var key = String(code);
    if (state.usedCodes[key]) return;
    state.usedCodes[key] = true;
    state.usedList.push(key);
    writeUsedCodes();
  }

  function mergeUsedFromStorage() {
    var stored = readUsedList();
    if (!stored.length) return;
    stored.forEach(function (code) {
      markUsed(code);
    });
  }

  function pickAnswer() {
    mergeUsedFromStorage();
    var maxTier = maxTierForStreak(state.streak);
    var pool = [];
    for (var t = maxTier; t >= 1; t--) {
      pool = COUNTRIES.filter(function (c) {
        return c && c.code && c.tier === t && !isUsed(c.code);
      });
      if (pool.length) break;
    }
    if (!pool.length) {
      pool = COUNTRIES.filter(function (c) {
        return c && c.code && !isUsed(c.code);
      });
    }
    if (!pool.length) return null;
    var pick = pool[Math.floor(Math.random() * pool.length)];
    markUsed(pick.code);
    return pick;
  }

  // Same-country cities only; buttons show city names.
  function cityEntriesOf(country) {
    var data = CITIES[country.code];
    if (!data || !data.ko || !data.en || !data.ko.length) {
      return [{ ko: country.ko.capital, en: country.en.capital }];
    }
    var out = [];
    var n = Math.min(data.ko.length, data.en.length);
    for (var i = 0; i < n; i++) {
      if (!data.ko[i] || !data.en[i]) continue;
      out.push({ ko: data.ko[i], en: data.en[i] });
    }
    return out.length ? out : [{ ko: country.ko.capital, en: country.en.capital }];
  }

  function cityLabel(entry) {
    if (!entry) return "";
    var bucket = langBucket();
    return entry[bucket] || entry.en;
  }

  function isCapitalEntry(entry, country) {
    return (
      !!entry &&
      !!country &&
      (entry.en === country.en.capital || entry.ko === country.ko.capital)
    );
  }

  function pickChoices(answer) {
    var entries = cityEntriesOf(answer);
    var capitalEntry = null;
    for (var i = 0; i < entries.length; i++) {
      if (isCapitalEntry(entries[i], answer)) {
        capitalEntry = entries[i];
        break;
      }
    }
    if (!capitalEntry) {
      capitalEntry = { ko: answer.ko.capital, en: answer.en.capital };
      entries = [capitalEntry].concat(entries);
    }
    var distractors = shuffle(
      entries.filter(function (e) {
        return !isCapitalEntry(e, answer);
      })
    ).slice(0, 3);
    return shuffle([capitalEntry].concat(distractors));
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
      els.lives.setAttribute("aria-label", tt("capital.livesAria", { n: state.lives }));
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
    if (els.countryName) els.countryName.textContent = "";
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
      applyUsedList(readUsedList());
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
        escapeHtml(tt("capital.gameOver")) +
        "</strong><span>" +
        escapeHtml(tt("capital.gameOverDetail", { score: state.score, best: state.best })) +
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
        escapeHtml(tt("capital.deckDone")) +
        "</strong><span>" +
        escapeHtml(tt("capital.deckDoneDetail", { score: state.score })) +
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
      escapeHtml(tt(correct ? "capital.correct" : "capital.wrong")) +
      "</strong><span>" +
      formatDetailLine(
        "capital.answerLine",
        labelOf(state.current),
        capitalOf(state.current)
      ) +
      "</span>";
  }

  function nextRound() {
    if (!state.playing || state.picking) return;
    state.picking = true;
    state.answered = false;
    var answer = pickAnswer();
    if (!answer) {
      state.picking = false;
      deckComplete();
      return;
    }
    state.current = answer;
    markUsed(answer.code);
    state.choices = pickChoices(answer);

    if (els.countryName) {
      els.countryName.textContent = labelOf(answer);
    }
    if (els.flagImg) {
      els.flagImg.alt = tt("capital.flagAlt", { country: labelOf(answer) });
      els.flagImg.removeAttribute("width");
      els.flagImg.removeAttribute("height");
      els.flagImg.removeAttribute("srcset");
      els.flagImg.removeAttribute("sizes");
      els.flagImg.onload = function () {
        fitFlagImage();
      };
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
    state.picking = false;
  }

  function renderChoices() {
    if (!els.choices) return;
    els.choices.innerHTML = "";
    state.choices.forEach(function (entry) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "flag-choice";
      btn.textContent = cityLabel(entry);
      btn.dataset.en = entry.en;
      btn.addEventListener("click", function () {
        onPick(entry.en, btn);
      });
      els.choices.appendChild(btn);
    });
  }

  function onPick(enKey, btn) {
    if (!state.playing || state.answered || !state.current) return;
    state.answered = true;
    markUsed(state.current.code);
    var correct = enKey === state.current.en.capital;
    var buttons = els.choices.querySelectorAll("button");
    Array.prototype.forEach.call(buttons, function (b) {
      b.disabled = true;
      if (b.dataset.en === state.current.en.capital) b.classList.add("is-correct");
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
    els.view = document.getElementById("capitalView");
    els.idle = document.getElementById("capitalIdle");
    els.playArea = document.getElementById("capitalPlayArea");
    els.startBtn = document.getElementById("capitalStartBtn");
    els.nextBtn = document.getElementById("capitalNextBtn");
    els.restartBtn = document.getElementById("capitalRestartBtn");
    els.flagImg = document.getElementById("capitalFlagImage");
    els.countryName = document.getElementById("capitalCountryName");
    els.choices = document.getElementById("capitalChoices");
    els.feedback = document.getElementById("capitalFeedback");
    els.streak = document.getElementById("capitalStreakHud");
    els.score = document.getElementById("capitalScoreHud");
    els.best = document.getElementById("capitalBestHud");
    els.lives = document.getElementById("capitalLivesHud");
  }

  function bind() {
    if (!els.view || els.view.dataset.capitalBound === "1") return;
    els.view.dataset.capitalBound = "1";
    if (els.startBtn) {
      els.startBtn.addEventListener("click", function () {
        startGame(true);
      });
    }
    if (els.nextBtn) {
      els.nextBtn.addEventListener("click", function () {
        if (!state.playing || state.lives <= 0 || !state.answered || state.picking) return;
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
    if (state.playing && state.current) {
      if (els.countryName) els.countryName.textContent = labelOf(state.current);
    }
    if (state.playing && state.current && !state.answered) {
      renderChoices();
    } else if (state.playing && state.current && state.answered) {
      var buttons = els.choices ? els.choices.querySelectorAll("button") : [];
      Array.prototype.forEach.call(buttons, function (b) {
        var found = state.choices.filter(function (entry) {
          return entry.en === b.dataset.en;
        })[0];
        if (found) b.textContent = cityLabel(found);
      });
      if (els.feedback && !els.feedback.hidden && state.current) {
        var wasCorrect = els.feedback.classList.contains("is-correct");
        if (els.feedback.classList.contains("is-over")) {
          els.feedback.innerHTML =
            "<strong>" +
            escapeHtml(tt("capital.gameOver")) +
            "</strong><span>" +
            escapeHtml(tt("capital.gameOverDetail", { score: state.score, best: state.best })) +
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
    applyUsedList(readUsedList());
    loadBest();
    setIdle();
    bind();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.refreshCapitalI18n = refreshI18n;
})();
