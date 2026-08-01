/* My IP lookup page */
(function () {
  var state = {
    ipv4: "",
    ipv6: "",
    isp: "",
    country: "",
    city: ""
  };

  function t(key, params) {
    return typeof window.t === "function" ? window.t(key, params) : key;
  }

  function $(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    var el = $(id);
    if (el) el.textContent = value || t("ip.unknown");
  }

  function setStatus(msg, isError) {
    var el = $("ipStatus");
    if (!el) return;
    el.textContent = msg || "";
    el.className = "ip-status" + (isError ? " error" : "");
  }

  function isIPv6(ip) {
    return typeof ip === "string" && ip.indexOf(":") !== -1;
  }

  function isIPv4(ip) {
    return typeof ip === "string" && /^\d{1,3}(\.\d{1,3}){3}$/.test(ip);
  }

  async function fetchJson(url) {
    var res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("fetch failed");
    return res.json();
  }

  async function fetchText(url) {
    var res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("fetch failed");
    return (await res.text()).trim();
  }

  async function lookupIp() {
    setStatus(t("ip.status.loading"));
    setText("ipV4Value", "…");
    setText("ipV6Value", "…");
    setText("ipIspValue", "…");
    setText("ipCountryValue", "…");
    setText("ipCityValue", "…");

    var ipv4 = "";
    var ipv6 = "";
    var isp = "";
    var country = "";
    var city = "";

    try {
      var results = await Promise.allSettled([
        fetchJson("https://api.ipify.org?format=json"),
        fetchJson("https://api64.ipify.org?format=json"),
        fetchJson("https://ipwho.is/")
      ]);

      if (results[0].status === "fulfilled" && results[0].value && results[0].value.ip) {
        ipv4 = results[0].value.ip;
      }

      if (results[1].status === "fulfilled" && results[1].value && results[1].value.ip) {
        var candidate = results[1].value.ip;
        if (isIPv6(candidate)) ipv6 = candidate;
        else if (!ipv4 && isIPv4(candidate)) ipv4 = candidate;
      }

      if (results[2].status === "fulfilled" && results[2].value && results[2].value.success !== false) {
        var geo = results[2].value;
        if (!ipv4 && isIPv4(geo.ip)) ipv4 = geo.ip;
        if (!ipv6 && isIPv6(geo.ip)) ipv6 = geo.ip;
        country = geo.country || geo.country_code || "";
        city = geo.city || geo.region || "";
        isp =
          (geo.connection && (geo.connection.isp || geo.connection.org)) ||
          geo.isp ||
          geo.org ||
          "";
      }

      if (!ipv4) {
        try {
          ipv4 = await fetchText("https://api.ipify.org");
        } catch (e) {}
      }

      if (!country && ipv4) {
        try {
          var detail = await fetchJson("https://ipwho.is/" + encodeURIComponent(ipv4));
          if (detail && detail.success !== false) {
            country = detail.country || detail.country_code || country;
            city = detail.city || detail.region || city;
            isp =
              isp ||
              (detail.connection && (detail.connection.isp || detail.connection.org)) ||
              detail.isp ||
              detail.org ||
              "";
          }
        } catch (e) {}
      }

      state.ipv4 = ipv4 || "";
      state.ipv6 = ipv6 || "";
      state.isp = isp || "";
      state.country = country || "";
      state.city = city || "";

      setText("ipV4Value", state.ipv4 || t("ip.unavailable"));
      setText("ipV6Value", state.ipv6 || t("ip.unavailable"));
      setText("ipIspValue", state.isp || t("ip.unknown"));
      setText("ipCountryValue", state.country || t("ip.unknown"));
      setText("ipCityValue", state.city || t("ip.unknown"));

      if (!state.ipv4 && !state.ipv6) {
        setStatus(t("ip.status.error"), true);
      } else {
        setStatus(t("ip.status.ok"));
      }
    } catch (e) {
      setStatus(t("ip.status.error"), true);
      setText("ipV4Value", t("ip.unavailable"));
      setText("ipV6Value", t("ip.unavailable"));
      setText("ipIspValue", t("ip.unknown"));
      setText("ipCountryValue", t("ip.unknown"));
      setText("ipCityValue", t("ip.unknown"));
    }
  }

  function copyTarget() {
    if (state.ipv4) return state.ipv4;
    if (state.ipv6) return state.ipv6;
    return "";
  }

  async function copyIp() {
    var value = copyTarget();
    if (!value) {
      setStatus(t("ip.status.nothing"), true);
      return;
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        var ta = document.createElement("textarea");
        ta.value = value;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setStatus(t("ip.status.copied", { ip: value }));
    } catch (e) {
      setStatus(t("ip.status.copyFail"), true);
    }
  }

  function openIp() {
    lookupIp();
  }

  function wire() {
    var openBtn = $("openIpBtn");
    var view = $("ipView");
    if (!openBtn || !view) return;

    openBtn.addEventListener("click", function () {
      if (typeof showView === "function") showView(view);
      else {
        document.querySelectorAll("main").forEach(function (m) {
          m.hidden = m !== view;
        });
      }
      openIp();
    });

    var backBtn = $("backHomeFromIpBtn");
    if (backBtn) {
      backBtn.addEventListener("click", function () {
        if (typeof showView === "function" && $("homeView")) showView($("homeView"));
        openBtn.focus();
      });
    }

    $("ipCopyBtn").addEventListener("click", copyIp);
    $("ipRefreshBtn").addEventListener("click", lookupIp);

    window.refreshIpI18n = function () {
      if (!view.hidden) {
        setText("ipV4Value", state.ipv4 || t("ip.unavailable"));
        setText("ipV6Value", state.ipv6 || t("ip.unavailable"));
        setText("ipIspValue", state.isp || t("ip.unknown"));
        setText("ipCountryValue", state.country || t("ip.unknown"));
        setText("ipCityValue", state.city || t("ip.unknown"));
      }
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();
