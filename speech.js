/* Speech time calculator: estimates how long a script takes to read aloud */
(function () {
  /* Units per minute at 100% speed: syllables or characters for CJK, words for English. */
  var RATES = { ko: 300, ja: 320, zh: 240, en: 130 };
  var PRESETS = { slow: 80, normal: 100, fast: 120, anchor: 135 };
  var SENTENCE_PAUSE = 0.35;
  var PARAGRAPH_PAUSE = 0.8;
  var TARGET_TOLERANCE = 3;

  function t(key, params) {
    return typeof window.t === "function" ? window.t(key, params) : key;
  }

  function $(id) {
    return document.getElementById(id);
  }

  function num(value) {
    return Number(value).toLocaleString();
  }

  function countMatches(text, pattern) {
    var found = text.match(pattern);
    return found ? found.length : 0;
  }

  function analyze(text) {
    var hangul = countMatches(text, /[\uac00-\ud7a3]/g);
    var kana = countMatches(text, /[\u3040-\u30ff]/g);
    var han = countMatches(text, /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g);
    /* Accented letters must stay inside a word so "não" counts once, not twice. */
    var words = countMatches(
      text,
      /[A-Za-z\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u017f][A-Za-z\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u017f'\u2019-]*/g
    );
    var digitChars = countMatches(text, /\d/g);
    var digitRuns = countMatches(text, /\d+/g);
    var cjk = hangul + kana + han;

    /* Kana only appears in Japanese, so it settles Han characters that Chinese also uses. */
    var script;
    if (cjk === 0) script = "en";
    else if (hangul >= kana + han) script = "ko";
    else if (kana > 0) script = "ja";
    else script = "zh";

    var paragraphs = text.split(/\n\s*\n/).filter(function (block) {
      return block.trim().length > 0;
    }).length;

    return {
      empty: text.trim().length === 0,
      script: script,
      cjkUnits: cjk + digitChars,
      wordUnits: words + (script === "en" ? digitRuns : 0),
      words: words,
      charsWithSpaces: Array.from(text).length,
      charsNoSpaces: Array.from(text.replace(/\s/g, "")).length,
      bytes: new TextEncoder().encode(text).length,
      sentences: countMatches(text, /[.!?\u3002\uff01\uff1f\u2026]+(?=\s|$)/g),
      paragraphs: paragraphs
    };
  }

  function estimate(stats, speed, usePauses) {
    if (stats.empty) return 0;

    var factor = speed / 100;
    var seconds = 0;

    if (stats.script === "en") {
      seconds = (stats.wordUnits / (RATES.en * factor)) * 60;
    } else {
      seconds = (stats.cjkUnits / (RATES[stats.script] * factor)) * 60;
      if (stats.words) seconds += (stats.words / (RATES.en * factor)) * 60;
    }

    if (usePauses) {
      seconds += stats.sentences * SENTENCE_PAUSE;
      seconds += Math.max(0, stats.paragraphs - 1) * PARAGRAPH_PAUSE;
    }

    return seconds;
  }

  function unitsPerSecond(stats, speed) {
    var rate = stats.script === "en" ? RATES.en : RATES[stats.script];
    return (rate * (speed / 100)) / 60;
  }

  function formatTime(totalSeconds) {
    var whole = Math.round(totalSeconds);
    var hours = Math.floor(whole / 3600);
    var minutes = Math.floor((whole % 3600) / 60);
    var seconds = whole % 60;

    if (hours) return t("speech.time.h", { h: hours, m: minutes, s: seconds });
    if (minutes) return t("speech.time.m", { m: minutes, s: seconds });
    return t("speech.time.s", { s: seconds });
  }

  function formatAmount(stats, units) {
    var rounded = Math.max(1, Math.round(units));
    return stats.script === "en"
      ? t("speech.unit.words", { n: num(rounded) })
      : t("speech.unit.chars", { n: num(rounded) });
  }

  function currentSpeed() {
    var slider = $("speechSpeed");
    var value = slider ? parseInt(slider.value, 10) : 100;
    return value >= 60 && value <= 140 ? value : 100;
  }

  function usePauses() {
    var box = $("speechPause");
    return !box || box.checked;
  }

  function targetSeconds() {
    var minutes = parseInt(($("speechTargetMin") || {}).value, 10);
    var seconds = parseInt(($("speechTargetSec") || {}).value, 10);
    if (isNaN(minutes) || minutes < 0) minutes = 0;
    if (isNaN(seconds) || seconds < 0) seconds = 0;
    return minutes * 60 + Math.min(59, seconds);
  }

  function renderStats(stats) {
    var list = $("speechStats");
    if (!list) return;

    var rows = [
      [t("speech.stat.withSpaces"), t("speech.unit.chars", { n: num(stats.charsWithSpaces) })],
      [t("speech.stat.noSpaces"), t("speech.unit.chars", { n: num(stats.charsNoSpaces) })],
      [t("speech.stat.bytes"), t("speech.unit.bytes", { n: num(stats.bytes) })],
      [t("speech.stat.words"), t("speech.unit.count", { n: num(stats.words) })],
      [t("speech.stat.sentences"), t("speech.unit.count", { n: num(stats.sentences) })],
      [t("speech.stat.paragraphs"), t("speech.unit.count", { n: num(stats.paragraphs) })]
    ];

    list.innerHTML = "";
    rows.forEach(function (row) {
      var item = document.createElement("li");
      var label = document.createElement("span");
      label.textContent = row[0];
      var value = document.createElement("strong");
      value.textContent = row[1];
      item.appendChild(label);
      item.appendChild(value);
      list.appendChild(item);
    });
  }

  function renderBreakdown(stats) {
    var el = $("speechBreakdown");
    if (!el) return;

    if (stats.empty) {
      el.textContent = t("speech.breakdown.empty");
      return;
    }

    if (stats.script === "en") {
      el.textContent = t("speech.breakdown.words", { words: num(stats.wordUnits) });
    } else if (stats.words) {
      el.textContent = t("speech.breakdown.mixed", {
        chars: num(stats.cjkUnits),
        words: num(stats.words)
      });
    } else {
      el.textContent = t("speech.breakdown.chars", { chars: num(stats.cjkUnits) });
    }
  }

  function renderTarget(stats, seconds, speed) {
    var el = $("speechTargetMsg");
    if (!el) return;

    var target = targetSeconds();
    if (!target || stats.empty) {
      el.textContent = t("speech.target.idle");
      el.className = "speech-target-msg";
      return;
    }

    var diff = seconds - target;
    if (Math.abs(diff) <= TARGET_TOLERANCE) {
      el.textContent = t("speech.target.match");
      el.className = "speech-target-msg match";
      return;
    }

    var amount = formatAmount(stats, Math.abs(diff) * unitsPerSecond(stats, speed));
    if (diff > 0) {
      el.textContent = t("speech.target.over", { time: formatTime(Math.abs(diff)), amount: amount });
      el.className = "speech-target-msg over";
    } else {
      el.textContent = t("speech.target.under", { time: formatTime(Math.abs(diff)), amount: amount });
      el.className = "speech-target-msg under";
    }
  }

  function render() {
    var input = $("speechInput");
    if (!input) return;

    var text = input.value || "";
    var stats = analyze(text);
    var speed = currentSpeed();
    var seconds = estimate(stats, speed, usePauses());

    var timeEl = $("speechTime");
    if (timeEl) timeEl.textContent = formatTime(seconds);

    var speedValue = $("speechSpeedValue");
    if (speedValue) speedValue.textContent = speed + "%";

    renderBreakdown(stats);
    renderStats(stats);
    renderTarget(stats, seconds, speed);
    syncPresets(speed);

    return { stats: stats, seconds: seconds, speed: speed };
  }

  function syncPresets(speed) {
    document.querySelectorAll("#speechPresets .speech-preset").forEach(function (button) {
      var value = PRESETS[button.getAttribute("data-preset")];
      button.classList.toggle("active", value === speed);
    });
  }

  function setStatus(msg, isError) {
    var el = $("speechStatus");
    if (!el) return;
    el.textContent = msg || "";
    el.className = "cutout-status" + (isError ? " error" : "");
  }

  async function copySummary() {
    var current = render();
    if (!current || current.stats.empty) {
      setStatus(t("speech.status.nothing"), true);
      return;
    }

    var stats = current.stats;
    var lines = [
      t("speech.copy.time", { time: formatTime(current.seconds) }),
      t("speech.copy.speed", { speed: current.speed }),
      t("speech.stat.withSpaces") + ": " + t("speech.unit.chars", { n: num(stats.charsWithSpaces) }),
      t("speech.stat.noSpaces") + ": " + t("speech.unit.chars", { n: num(stats.charsNoSpaces) }),
      t("speech.stat.words") + ": " + t("speech.unit.count", { n: num(stats.words) }),
      t("speech.stat.sentences") + ": " + t("speech.unit.count", { n: num(stats.sentences) })
    ];

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setStatus(t("speech.status.copied"));
    } catch (e) {
      setStatus(t("speech.status.copyError"), true);
    }
  }

  function clearScript() {
    var input = $("speechInput");
    if (!input) return;
    input.value = "";
    input.focus();
    render();
    setStatus(t("speech.status.cleared"));
  }

  function wire() {
    var openBtn = $("openSpeechBtn");
    var view = $("speechView");
    if (!view) return;

    if (typeof window.wtbWireToolPage === "function") {
      window.wtbWireToolPage({
        name: "speech",
        openBtn: openBtn,
        backBtn: $("backHomeFromSpeechBtn"),
        view: view
      });
    }

    ["speechInput", "speechSpeed", "speechTargetMin", "speechTargetSec"].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener("input", function () { render(); });
    });

    var pause = $("speechPause");
    if (pause) pause.addEventListener("change", function () { render(); });

    document.querySelectorAll("#speechPresets .speech-preset").forEach(function (button) {
      button.addEventListener("click", function () {
        var value = PRESETS[button.getAttribute("data-preset")];
        if (!value) return;
        var slider = $("speechSpeed");
        if (slider) slider.value = value;
        render();
      });
    });

    var copyBtn = $("speechCopyBtn");
    if (copyBtn) copyBtn.addEventListener("click", copySummary);

    var clearBtn = $("speechClearBtn");
    if (clearBtn) clearBtn.addEventListener("click", clearScript);

    window.refreshSpeechI18n = function () {
      render();
      setStatus("");
    };

    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();
