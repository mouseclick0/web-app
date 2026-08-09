/* Solar ↔ lunar converter (korean-lunar-calendar) */
(function () {
  var ZODIAC = [
    { key: "rat", emoji: "🐭" },
    { key: "ox", emoji: "🐮" },
    { key: "tiger", emoji: "🐯" },
    { key: "rabbit", emoji: "🐰" },
    { key: "dragon", emoji: "🐲" },
    { key: "snake", emoji: "🐍" },
    { key: "horse", emoji: "🐴" },
    { key: "sheep", emoji: "🐑" },
    { key: "monkey", emoji: "🐵" },
    { key: "rooster", emoji: "🐔" },
    { key: "dog", emoji: "🐶" },
    { key: "pig", emoji: "🐷" }
  ];

  var syncing = false;

  function t(key, params) {
    return typeof window.t === "function" ? window.t(key, params) : key;
  }

  function $(id) {
    return document.getElementById(id);
  }

  function makeCalendar() {
    if (typeof KoreanLunarCalendar !== "function") return null;
    return new KoreanLunarCalendar();
  }

  function num(el, fallback) {
    var n = Number(el && el.value);
    return Number.isFinite(n) ? n : fallback;
  }

  function setInputs(prefix, year, month, day, leap) {
    var y = $(prefix + "Year");
    var m = $(prefix + "Month");
    var d = $(prefix + "Day");
    if (y) y.value = String(year);
    if (m) m.value = String(month);
    if (d) d.value = String(day);
    if (prefix === "lunar") {
      var leapEl = $("lunarLeap");
      if (leapEl) leapEl.checked = !!leap;
    }
  }

  function zodiacFromIndex(idx) {
    var i = ((idx % 12) + 12) % 12;
    var z = ZODIAC[i];
    return {
      emoji: z.emoji,
      name: t("calendar.zodiac." + z.key),
      index: i
    };
  }

  function setStatus(msg, isError) {
    var el = $("calendarStatus");
    if (!el) return;
    el.textContent = msg || "";
    el.className = "calendar-status" + (isError ? " error" : "");
  }

  function formatYmd(year, month, day, leap) {
    var leapBit = leap ? t("calendar.leapPrefix") : "";
    var lang = (window.getLang && getLang()) || "ko";
    if (lang === "en") {
      return (
        leapBit +
        year +
        "-" +
        String(month).padStart(2, "0") +
        "-" +
        String(day).padStart(2, "0")
      );
    }
    if (lang === "es" || lang === "pt-BR") {
      return (
        leapBit +
        String(day).padStart(2, "0") +
        "/" +
        String(month).padStart(2, "0") +
        "/" +
        year
      );
    }
    // Remaining languages append CJK date unit characters.
    return (
      leapBit +
      year +
      t("calendar.unit.year") +
      " " +
      month +
      t("calendar.unit.month") +
      " " +
      day +
      t("calendar.unit.day")
    );
  }

  function renderSummary(cal) {
    var solar = cal.getSolarCalendar();
    var lunar = cal.getLunarCalendar();
    var gapja = cal.getKoreanGapja();
    var gapjaZh = cal.getChineseGapja();
    var idx = cal.getGapJaIndex();
    var zodiac = zodiacFromIndex(idx.ganji.year);

    $("calendarSolarOut").textContent = formatYmd(solar.year, solar.month, solar.day, false);
    $("calendarLunarOut").textContent = formatYmd(
      lunar.year,
      lunar.month,
      lunar.day,
      lunar.intercalation
    );

    $("calendarGapjaYear").textContent = gapja.year + (gapjaZh.year ? " · " + gapjaZh.year : "");
    $("calendarGapjaMonth").textContent = gapja.month + (gapjaZh.month ? " · " + gapjaZh.month : "");
    $("calendarGapjaDay").textContent = gapja.day + (gapjaZh.day ? " · " + gapjaZh.day : "");

    $("calendarZodiacEmoji").textContent = zodiac.emoji;
    $("calendarZodiacName").textContent = zodiac.name;
    $("calendarZodiacHint").textContent = t("calendar.zodiacHint", {
      animal: zodiac.emoji + " " + zodiac.name
    });
  }

  function applyFromSolar() {
    var cal = makeCalendar();
    if (!cal) {
      setStatus(t("calendar.status.libMissing"), true);
      return;
    }
    var y = num($("solarYear"), 0);
    var m = num($("solarMonth"), 0);
    var d = num($("solarDay"), 0);
    if (!cal.setSolarDate(y, m, d)) {
      setStatus(t("calendar.status.invalidSolar"), true);
      return;
    }
    var lunar = cal.getLunarCalendar();
    syncing = true;
    setInputs("lunar", lunar.year, lunar.month, lunar.day, lunar.intercalation);
    syncing = false;
    renderSummary(cal);
    setStatus(t("calendar.status.ok"));
  }

  function applyFromLunar() {
    var cal = makeCalendar();
    if (!cal) {
      setStatus(t("calendar.status.libMissing"), true);
      return;
    }
    var y = num($("lunarYear"), 0);
    var m = num($("lunarMonth"), 0);
    var d = num($("lunarDay"), 0);
    var leap = !!($("lunarLeap") && $("lunarLeap").checked);
    if (!cal.setLunarDate(y, m, d, leap)) {
      setStatus(t("calendar.status.invalidLunar"), true);
      return;
    }
    var solar = cal.getSolarCalendar();
    syncing = true;
    setInputs("solar", solar.year, solar.month, solar.day);
    syncing = false;
    renderSummary(cal);
    setStatus(t("calendar.status.ok"));
  }

  function loadToday() {
    var now = new Date();
    syncing = true;
    setInputs("solar", now.getFullYear(), now.getMonth() + 1, now.getDate());
    syncing = false;
    applyFromSolar();
    setStatus(t("calendar.status.today"));
  }

  function fillYearOptions(selectId, min, max, selected) {
    var el = $(selectId);
    if (!el) return;
    var html = "";
    for (var y = max; y >= min; y--) {
      html +=
        '<option value="' +
        y +
        '"' +
        (y === selected ? " selected" : "") +
        ">" +
        y +
        "</option>";
    }
    el.innerHTML = html;
  }

  function fillMonthDayOptions() {
    var monthHtml = "";
    for (var m = 1; m <= 12; m++) {
      monthHtml += '<option value="' + m + '">' + m + "</option>";
    }
    ["solarMonth", "lunarMonth"].forEach(function (id) {
      var el = $(id);
      if (el) el.innerHTML = monthHtml;
    });
    var dayHtml = "";
    for (var d = 1; d <= 31; d++) {
      dayHtml += '<option value="' + d + '">' + d + "</option>";
    }
    ["solarDay", "lunarDay"].forEach(function (id) {
      var el = $(id);
      if (el) el.innerHTML = dayHtml;
    });
  }

  function openCalendar() {
    fillMonthDayOptions();
    var now = new Date();
    fillYearOptions("solarYear", 1000, 2050, now.getFullYear());
    fillYearOptions("lunarYear", 1000, 2050, now.getFullYear());
    loadToday();
  }

  function wire() {
    var openBtn = $("openCalendarBtn");
    var view = $("calendarView");
    if (!openBtn || !view) return;

    openBtn.addEventListener("click", function () {
      if (typeof showView === "function") showView(view);
      else {
        document.querySelectorAll("main").forEach(function (m) {
          m.hidden = m !== view;
        });
      }
      openCalendar();
    });

    var backBtn = $("backHomeFromCalendarBtn");
    if (backBtn) {
      backBtn.addEventListener("click", function () {
        if (typeof showView === "function" && $("homeView")) showView($("homeView"));
        openBtn.focus();
      });
    }

    $("calendarTodayBtn").addEventListener("click", loadToday);
    $("solarConvertBtn").addEventListener("click", applyFromSolar);
    $("lunarConvertBtn").addEventListener("click", applyFromLunar);

    ["solarYear", "solarMonth", "solarDay"].forEach(function (id) {
      $(id).addEventListener("change", function () {
        if (!syncing) applyFromSolar();
      });
    });
    ["lunarYear", "lunarMonth", "lunarDay", "lunarLeap"].forEach(function (id) {
      $(id).addEventListener("change", function () {
        if (!syncing) applyFromLunar();
      });
    });

    window.refreshCalendarI18n = function () {
      if (!$("calendarView") || $("calendarView").hidden) return;
      if ($("solarYear") && $("solarYear").value) applyFromSolar();
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();
