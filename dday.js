/* D-Day calculator: days until / since a target date (exclusive of start day) */
(function () {
  "use strict";

  if (typeof window !== "undefined" && window.__WEBTOOLBAY_DDAY__) return;
  if (typeof window !== "undefined") window.__WEBTOOLBAY_DDAY__ = true;

  var lastDiff = null;
  var lastTitle = "";

  function t(key, params) {
    return typeof window.t === "function" ? window.t(key, params) : key;
  }

  function $(id) {
    return document.getElementById(id);
  }

  function todayYmd() {
    var now = new Date();
    return (
      now.getFullYear() +
      "-" +
      String(now.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(now.getDate()).padStart(2, "0")
    );
  }

  function parseYmd(value) {
    var m = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    var y = Number(m[1]);
    var mo = Number(m[2]);
    var d = Number(m[3]);
    var date = new Date(y, mo - 1, d);
    if (
      date.getFullYear() !== y ||
      date.getMonth() !== mo - 1 ||
      date.getDate() !== d
    ) {
      return null;
    }
    return date;
  }

  function dayDiff(base, target) {
    var a = Date.UTC(base.getFullYear(), base.getMonth(), base.getDate());
    var b = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
    return Math.round((b - a) / 86400000);
  }

  function formatDisplayDate(date) {
    var lang = (window.getLang && window.getLang()) || "ko";
    try {
      return new Intl.DateTimeFormat(lang, {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "short"
      }).format(date);
    } catch (e) {
      return (
        date.getFullYear() +
        "-" +
        String(date.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(date.getDate()).padStart(2, "0")
      );
    }
  }

  function setResultIdle() {
    lastDiff = null;
    lastTitle = "";
    var badge = $("ddayBadge");
    var detail = $("ddayDetail");
    var title = $("ddayResultTitle");
    var panel = $("ddayResult");
    if (badge) {
      badge.textContent = "–";
      badge.className = "dday-badge";
    }
    if (detail) detail.textContent = t("dday.result.idle");
    if (title) {
      title.textContent = "";
      title.hidden = true;
    }
    if (panel) panel.className = "dday-result";
  }

  function renderResult(diff, eventName, base, target) {
    lastDiff = diff;
    lastTitle = eventName || "";

    var badge = $("ddayBadge");
    var detail = $("ddayDetail");
    var title = $("ddayResultTitle");
    var panel = $("ddayResult");
    if (!badge || !detail) return;

    if (title) {
      if (eventName) {
        title.textContent = eventName;
        title.hidden = false;
      } else {
        title.textContent = "";
        title.hidden = true;
      }
    }

    var mode;
    if (diff > 0) {
      mode = "minus";
      badge.textContent = "D - " + diff;
      detail.textContent = t("dday.result.minus", {
        n: diff,
        target: formatDisplayDate(target),
        base: formatDisplayDate(base)
      });
    } else if (diff < 0) {
      mode = "plus";
      badge.textContent = "D + " + Math.abs(diff);
      detail.textContent = t("dday.result.plus", {
        n: Math.abs(diff),
        target: formatDisplayDate(target),
        base: formatDisplayDate(base)
      });
    } else {
      mode = "day";
      badge.textContent = "D - Day";
      detail.textContent = t("dday.result.day", {
        target: formatDisplayDate(target),
        base: formatDisplayDate(base)
      });
    }

    badge.className = "dday-badge is-" + mode;
    if (panel) panel.className = "dday-result is-" + mode;
  }

  function calculate() {
    var targetEl = $("ddayTargetInput");
    var baseEl = $("ddayBaseInput");
    var nameEl = $("ddayNameInput");
    var target = parseYmd(targetEl && targetEl.value);
    var base = parseYmd(baseEl && baseEl.value);

    if (!target) {
      setResultIdle();
      setStatus(t("dday.status.needTarget"), true);
      return;
    }
    if (!base) {
      setResultIdle();
      setStatus(t("dday.status.needBase"), true);
      return;
    }

    var name = ((nameEl && nameEl.value) || "").trim();
    renderResult(dayDiff(base, target), name, base, target);
    setStatus(t("dday.status.done"));
  }

  function resetForm() {
    var nameEl = $("ddayNameInput");
    var targetEl = $("ddayTargetInput");
    var baseEl = $("ddayBaseInput");
    if (nameEl) nameEl.value = "";
    if (targetEl) targetEl.value = "";
    if (baseEl) baseEl.value = todayYmd();
    setResultIdle();
    setStatus(t("dday.status.reset"));
    if (targetEl) targetEl.focus();
  }

  function setStatus(msg, isError) {
    var el = $("ddayStatus");
    if (!el) return;
    el.textContent = msg || "";
    el.className = "cutout-status" + (isError ? " error" : "");
  }

  function openTool() {
    var baseEl = $("ddayBaseInput");
    if (baseEl && !baseEl.value) baseEl.value = todayYmd();
    if (lastDiff === null) setResultIdle();
    var targetEl = $("ddayTargetInput");
    if (targetEl) targetEl.focus();
  }

  function wire() {
    var openBtn = $("openDdayBtn");
    var view = $("ddayView");
    if (!view) return;

    if (typeof window.wtbWireToolPage === "function") {
      window.wtbWireToolPage({
        name: "dday",
        openBtn: openBtn,
        backBtn: $("backHomeFromDdayBtn"),
        view: view,
        onOpen: openTool
      });
    }

    var form = $("ddayForm");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        calculate();
      });
    }

    var resetBtn = $("ddayResetBtn");
    if (resetBtn) resetBtn.addEventListener("click", resetForm);

    var baseEl = $("ddayBaseInput");
    if (baseEl && !baseEl.value) baseEl.value = todayYmd();
    setResultIdle();
    setStatus("");

    window.refreshDdayI18n = function () {
      if (!view || view.hidden) return;
      if (lastDiff === null) {
        setResultIdle();
        return;
      }
      var target = parseYmd($("ddayTargetInput") && $("ddayTargetInput").value);
      var base = parseYmd($("ddayBaseInput") && $("ddayBaseInput").value);
      if (target && base) renderResult(lastDiff, lastTitle, base, target);
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();
