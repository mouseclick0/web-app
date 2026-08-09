/* Weather page — Open-Meteo + Lucide */
(function () {
  var UNIT_KEY = "web-pages-weather-unit";
  var PLACE_KEY = "web-pages-weather-place";
  var FALLBACK = { name: "Seoul", latitude: 37.5665, longitude: 126.978, country: "KR" };

  var state = {
    unit: "c",
    place: null,
    forecast: null,
    loaded: false
  };

  function t(key, params) {
    return typeof window.t === "function" ? window.t(key, params) : key;
  }

  function $(id) {
    return document.getElementById(id);
  }

  function refreshIcons(root) {
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons({
        attrs: { "stroke-width": 1.75 },
        nameAttr: "data-lucide",
        root: root || document
      });
    }
  }

  function weatherIconName(code) {
    var c = Number(code);
    if (c === 0) return "sun";
    if (c <= 2) return "cloud-sun";
    if (c === 3) return "cloud";
    if (c === 45 || c === 48) return "cloud-fog";
    if (c >= 51 && c <= 67) return "cloud-drizzle";
    if (c >= 71 && c <= 77) return "cloud-snow";
    if (c >= 80 && c <= 82) return "cloud-rain";
    if (c >= 85 && c <= 86) return "cloud-snow";
    if (c >= 95) return "cloud-lightning";
    return "cloud";
  }

  function weatherLabel(code) {
    var c = Number(code);
    if (c === 0) return t("weather.code.clear");
    if (c === 1) return t("weather.code.mainlyClear");
    if (c === 2) return t("weather.code.partlyCloudy");
    if (c === 3) return t("weather.code.overcast");
    if (c === 45 || c === 48) return t("weather.code.fog");
    if (c >= 51 && c <= 57) return t("weather.code.drizzle");
    if (c >= 61 && c <= 67) return t("weather.code.rain");
    if (c >= 71 && c <= 77) return t("weather.code.snow");
    if (c >= 80 && c <= 82) return t("weather.code.showers");
    if (c >= 85 && c <= 86) return t("weather.code.snowShowers");
    if (c >= 95) return t("weather.code.thunder");
    return t("weather.code.unknown");
  }

  function loadUnit() {
    try {
      var u = localStorage.getItem(UNIT_KEY);
      state.unit = u === "f" ? "f" : "c";
    } catch (e) {
      state.unit = "c";
    }
  }

  function saveUnit() {
    try {
      localStorage.setItem(UNIT_KEY, state.unit);
    } catch (e) {}
  }

  function loadSavedPlace() {
    try {
      var raw = localStorage.getItem(PLACE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed.latitude === "number" && typeof parsed.longitude === "number") {
        return parsed;
      }
    } catch (e) {}
    return null;
  }

  function savePlace(place) {
    state.place = place;
    try {
      localStorage.setItem(PLACE_KEY, JSON.stringify(place));
    } catch (e) {}
  }

  function toDisplayTemp(celsius) {
    var n = Number(celsius);
    if (!isFinite(n)) return "--";
    if (state.unit === "f") return Math.round((n * 9) / 5 + 32);
    return Math.round(n);
  }

  function tempUnit() {
    return state.unit === "f" ? "°F" : "°C";
  }

  function formatTemp(celsius) {
    return toDisplayTemp(celsius) + "°";
  }

  function setStatus(msg) {
    var el = $("weatherStatus");
    if (el) el.textContent = msg || "";
  }

  function updateUnitButtons() {
    var cBtn = $("weatherUnitC");
    var fBtn = $("weatherUnitF");
    if (cBtn) cBtn.setAttribute("aria-pressed", state.unit === "c" ? "true" : "false");
    if (fBtn) fBtn.setAttribute("aria-pressed", state.unit === "f" ? "true" : "false");
  }

  function setIcon(container, name) {
    if (!container) return;
    container.innerHTML = '<i data-lucide="' + name + '"></i>';
    refreshIcons(container);
  }

  async function reverseGeocode(lat, lon) {
    try {
      var url =
        "https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=" +
        encodeURIComponent(lat) +
        "&longitude=" +
        encodeURIComponent(lon) +
        "&localityLanguage=" +
        encodeURIComponent(apiLang());
      var res = await fetch(url);
      if (!res.ok) throw new Error("reverse failed");
      var data = await res.json();
      var name = data.city || data.locality || data.principalSubdivision || t("weather.myLocation");
      return {
        name: name,
        latitude: lat,
        longitude: lon,
        country: data.countryCode || "",
        admin1: data.principalSubdivision || ""
      };
    } catch (e) {
      return {
        name: t("weather.myLocation"),
        latitude: lat,
        longitude: lon,
        country: "",
        admin1: ""
      };
    }
  }

  async function searchCities(query) {
    var lang = apiLang();
    var url =
      "https://geocoding-api.open-meteo.com/v1/search?name=" +
      encodeURIComponent(query) +
      "&count=6&language=" +
      encodeURIComponent(lang) +
      "&format=json";
    var res = await fetch(url);
    if (!res.ok) throw new Error("geocode failed");
    var data = await res.json();
    return Array.isArray(data.results) ? data.results : [];
  }

  async function fetchForecast(lat, lon) {
    var params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      current:
        "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation",
      hourly: "temperature_2m,precipitation_probability,precipitation,weather_code",
      daily:
        "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum",
      timezone: "auto",
      forecast_days: "7"
    });
    var res = await fetch("https://api.open-meteo.com/v1/forecast?" + params.toString());
    if (!res.ok) throw new Error("forecast failed");
    return res.json();
  }

  function hourlyStartIndex(hourlyTimes) {
    var now = Date.now();
    for (var i = 0; i < hourlyTimes.length; i++) {
      var tms = new Date(hourlyTimes[i]).getTime();
      if (tms >= now - 30 * 60 * 1000) return i;
    }
    return 0;
  }

  function renderHourly(forecast) {
    var box = $("weatherHourly");
    if (!box || !forecast || !forecast.hourly) return;
    var times = forecast.hourly.time || [];
    var temps = forecast.hourly.temperature_2m || [];
    var pops = forecast.hourly.precipitation_probability || [];
    var precs = forecast.hourly.precipitation || [];
    var codes = forecast.hourly.weather_code || [];
    var start = hourlyStartIndex(times);
    var html = "";
    for (var i = start; i < start + 24 && i < times.length; i++) {
      var d = new Date(times[i]);
      var hourLabel =
        d.getHours() === 0
          ? t("weather.midnight")
          : String(d.getHours()).padStart(2, "0") + t("weather.hourSuffix");
      var pop = pops[i] == null ? 0 : pops[i];
      var precip = precs[i] == null ? 0 : precs[i];
      var rainBit =
        precip > 0.05
          ? t("weather.rainYes")
          : pop >= 40
            ? t("weather.rainMaybe")
            : t("weather.rainNo");
      html +=
        '<article class="wx-hour">' +
        "<time>" +
        hourLabel +
        "</time>" +
        '<i data-lucide="' +
        weatherIconName(codes[i]) +
        '"></i>' +
        '<span class="wx-hour-temp">' +
        formatTemp(temps[i]) +
        "</span>" +
        '<span class="wx-hour-pop">' +
        pop +
        "% · " +
        rainBit +
        "</span>" +
        "</article>";
    }
    box.innerHTML = html;
    refreshIcons(box);
  }

  var LOCALE_TAGS = {
    ko: "ko-KR",
    en: "en-US",
    ja: "ja-JP",
    "zh-Hans": "zh-CN",
    "zh-Hant": "zh-TW",
    es: "es-ES",
    "pt-BR": "pt-BR"
  };

  function localeTag() {
    var lang = (window.getLang && getLang()) || "ko";
    return LOCALE_TAGS[lang] || "ko-KR";
  }

  // Geocoding endpoints expect a bare ISO 639-1 code, not a script or region tag.
  function apiLang() {
    var lang = (window.getLang && getLang()) || "ko";
    return lang.split("-")[0];
  }

  function dayLabel(isoDate, index) {
    if (index === 0) return t("weather.today");
    if (index === 1) return t("weather.tomorrow");
    var d = new Date(isoDate + "T12:00:00");
    return d.toLocaleDateString(localeTag(), { weekday: "short", month: "numeric", day: "numeric" });
  }

  function renderDaily(forecast) {
    var box = $("weatherDaily");
    if (!box || !forecast || !forecast.daily) return;
    var times = forecast.daily.time || [];
    var highs = forecast.daily.temperature_2m_max || [];
    var lows = forecast.daily.temperature_2m_min || [];
    var pops = forecast.daily.precipitation_probability_max || [];
    var precs = forecast.daily.precipitation_sum || [];
    var codes = forecast.daily.weather_code || [];
    var html = "";
    var count = Math.min(7, times.length);
    for (var i = 0; i < count; i++) {
      var pop = pops[i] == null ? "--" : pops[i];
      var precip = precs[i] == null ? "--" : Number(precs[i]).toFixed(1);
      var rainBit =
        Number(precs[i]) > 0.2
          ? t("weather.rainYes")
          : Number(pops[i]) >= 40
            ? t("weather.rainMaybe")
            : t("weather.rainNo");
      html +=
        '<article class="wx-day">' +
        '<div class="wx-day-head">' +
        "<strong>" +
        dayLabel(times[i], i) +
        "</strong>" +
        '<i data-lucide="' +
        weatherIconName(codes[i]) +
        '"></i>' +
        "</div>" +
        '<p class="wx-day-cond">' +
        weatherLabel(codes[i]) +
        "</p>" +
        '<p class="wx-day-temps"><span class="hi">' +
        formatTemp(highs[i]) +
        '</span><span class="lo">' +
        formatTemp(lows[i]) +
        "</span></p>" +
        '<p class="wx-day-pop">' +
        pop +
        "% · " +
        precip +
        " mm · " +
        rainBit +
        "</p>" +
        "</article>";
    }
    box.innerHTML = html;
    refreshIcons(box);
  }

  function renderForecast() {
    var forecast = state.forecast;
    var place = state.place;
    if (!forecast || !place) return;

    var current = forecast.current || {};
    var daily = forecast.daily || {};
    $("weatherPlace").textContent = placeLabel(place);
    $("weatherNowTemp").textContent = formatTemp(current.temperature_2m);
    $("weatherNowCondition").textContent = weatherLabel(current.weather_code);
    setIcon($("weatherNowIcon"), weatherIconName(current.weather_code));

    $("weatherTodayHigh").textContent = formatTemp(daily.temperature_2m_max && daily.temperature_2m_max[0]);
    $("weatherTodayLow").textContent = formatTemp(daily.temperature_2m_min && daily.temperature_2m_min[0]);
    $("weatherTodayPop").textContent =
      (daily.precipitation_probability_max && daily.precipitation_probability_max[0] != null
        ? daily.precipitation_probability_max[0]
        : "--") + "%";
    $("weatherTodayPrecip").textContent =
      (daily.precipitation_sum && daily.precipitation_sum[0] != null
        ? Number(daily.precipitation_sum[0]).toFixed(1)
        : "--") + " mm";
    $("weatherFeels").textContent = formatTemp(current.apparent_temperature);
    $("weatherHumidity").textContent =
      current.relative_humidity_2m != null ? current.relative_humidity_2m + "%" : "--%";
    $("weatherWind").textContent =
      current.wind_speed_10m != null ? Math.round(current.wind_speed_10m) + " km/h" : "--";
    $("weatherTodayCondition").textContent = weatherLabel(
      daily.weather_code && daily.weather_code[0] != null ? daily.weather_code[0] : current.weather_code
    );

    renderHourly(forecast);
    renderDaily(forecast);
    updateUnitButtons();
  }

  function placeLabel(place) {
    var parts = [place.name];
    if (place.admin1) parts.push(place.admin1);
    if (place.country) parts.push(place.country);
    return parts.filter(Boolean).join(", ");
  }

  async function loadPlace(place, statusKey) {
    setStatus(t(statusKey || "weather.status.loading"));
    savePlace(place);
    try {
      state.forecast = await fetchForecast(place.latitude, place.longitude);
      renderForecast();
      setStatus(t("weather.status.ready", { place: placeLabel(place) }));
      state.loaded = true;
    } catch (e) {
      setStatus(t("weather.status.error"));
    }
  }

  function getGeoPosition() {
    return new Promise(function (resolve, reject) {
      if (!navigator.geolocation) {
        reject(new Error("no geo"));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 10 * 60 * 1000
      });
    });
  }

  async function useMyLocation() {
    setStatus(t("weather.status.locating"));
    try {
      var pos = await getGeoPosition();
      var place = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      await loadPlace(place, "weather.status.loading");
    } catch (e) {
      setStatus(t("weather.status.locateFail"));
      if (!state.loaded) {
        await loadPlace(FALLBACK, "weather.status.fallback");
      }
    }
  }

  function hideSuggest() {
    var box = $("weatherSuggest");
    if (box) {
      box.classList.remove("show");
      box.innerHTML = "";
    }
  }

  function showSuggest(results) {
    var box = $("weatherSuggest");
    if (!box) return;
    if (!results.length) {
      hideSuggest();
      return;
    }
    box.innerHTML = results
      .map(function (item, idx) {
        var label = [item.name, item.admin1, item.country_code || item.country]
          .filter(Boolean)
          .join(", ");
        return (
          '<button type="button" role="option" data-idx="' +
          idx +
          '">' +
          label +
          "</button>"
        );
      })
      .join("");
    box.classList.add("show");
    box.querySelectorAll("button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var item = results[Number(btn.getAttribute("data-idx"))];
        hideSuggest();
        loadPlace({
          name: item.name,
          latitude: item.latitude,
          longitude: item.longitude,
          country: item.country_code || "",
          admin1: item.admin1 || ""
        });
      });
    });
  }

  async function runCitySearch() {
    var input = $("weatherCityInput");
    var q = ((input && input.value) || "").trim();
    if (q.length < 2) {
      setStatus(t("weather.status.cityShort"));
      return;
    }
    setStatus(t("weather.status.searching"));
    try {
      var results = await searchCities(q);
      if (!results.length) {
        setStatus(t("weather.status.noCity"));
        hideSuggest();
        return;
      }
      showSuggest(results);
      setStatus(t("weather.status.pickCity"));
    } catch (e) {
      setStatus(t("weather.status.error"));
    }
  }

  async function openWeather() {
    loadUnit();
    updateUnitButtons();
    refreshIcons($("weatherView"));
    var saved = loadSavedPlace();
    if (saved) {
      await loadPlace(saved);
      return;
    }
    await useMyLocation();
  }

  function wire() {
    var openBtn = $("openWeatherBtn");
    var backBtn = $("backHomeFromWeatherBtn");
    var view = $("weatherView");
    if (!openBtn || !view) return;

    openBtn.addEventListener("click", function () {
      if (typeof showView === "function") showView(view);
      else {
        document.querySelectorAll("main").forEach(function (m) {
          m.hidden = m !== view;
        });
      }
      openWeather();
      if ($("weatherCityInput")) $("weatherCityInput").focus();
    });

    if (backBtn) {
      backBtn.addEventListener("click", function () {
        hideSuggest();
        if (typeof showView === "function" && $("homeView")) showView($("homeView"));
        openBtn.focus();
      });
    }

    $("weatherUnitC").addEventListener("click", function () {
      state.unit = "c";
      saveUnit();
      renderForecast();
    });
    $("weatherUnitF").addEventListener("click", function () {
      state.unit = "f";
      saveUnit();
      renderForecast();
    });
    $("weatherLocateBtn").addEventListener("click", function () {
      useMyLocation();
    });
    $("weatherRefreshBtn").addEventListener("click", function () {
      if (state.place) loadPlace(state.place);
      else useMyLocation();
    });
    $("weatherSearchBtn").addEventListener("click", runCitySearch);
    $("weatherCityInput").addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        runCitySearch();
      }
    });
    document.addEventListener("click", function (e) {
      var search = document.querySelector(".weather-search");
      if (search && !search.contains(e.target)) hideSuggest();
    });

    window.refreshWeatherI18n = function () {
      if (state.forecast) renderForecast();
      refreshIcons($("weatherView"));
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();
