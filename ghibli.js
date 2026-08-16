/* Local AI: convert photo to Ghibli-like anime style via /api/ghibli */
(function () {
  "use strict";

  if (typeof window !== "undefined" && window.__WEBTOOLBAY_GHIBLI__) return;
  if (typeof window !== "undefined") window.__WEBTOOLBAY_GHIBLI__ = true;

  var API_KEY = "web-pages-ytdlp-api";
  var DEFAULT_API = "http://127.0.0.1:8787";

  var els = {};
  var serverOk = false;
  var sourceFile = null;
  var sourceFileName = "ghibli";
  var resultUrl = null;

  function tt(key, params) {
    return typeof window.t === "function" ? window.t(key, params) : key;
  }

  function $(id) {
    return document.getElementById(id);
  }

  function getApiUrl() {
    return (els.apiInput && els.apiInput.value ? els.apiInput.value : "").trim().replace(/\/+$/, "") || DEFAULT_API;
  }

  function loadSavedApi() {
    if (!els.apiInput) return;
    try {
      els.apiInput.value = localStorage.getItem(API_KEY) || DEFAULT_API;
    } catch (e) {
      els.apiInput.value = DEFAULT_API;
    }
  }

  function saveApi() {
    var value = getApiUrl();
    try {
      localStorage.setItem(API_KEY, value);
    } catch (e) {}
  }

  function setHealth(text, kind) {
    if (!els.health) return;
    els.health.textContent = text || "";
    els.health.className = "video-health" + (kind ? " " + kind : "");
  }

  function setStatus(text) {
    if (!els.status) return;
    els.status.textContent = text || "";
  }

  function updateRunEnabled() {
    if (els.runBtn) els.runBtn.disabled = !(sourceFile && serverOk);
  }

  async function checkHealth() {
    var apiBase = getApiUrl();
    saveApi();
    setHealth(tt("ghibli.health.checking"));
    serverOk = false;
    try {
      var response = await fetch(apiBase + "/api/health", { method: "GET" });
      var data = await response.json();
      if (!response.ok || !data || !data.ok) {
        throw new Error((data && data.error) || "health failed");
      }
      if (!data.ghibli) {
        serverOk = false;
        setHealth(tt("ghibli.health.outdated"), "bad");
        updateRunEnabled();
        return false;
      }
      serverOk = true;
      setHealth(tt("ghibli.health.ok"), "ok");
    } catch (error) {
      serverOk = false;
      setHealth(tt("ghibli.health.bad"), "bad");
    }
    updateRunEnabled();
    return serverOk;
  }

  function clearResult() {
    if (resultUrl) {
      URL.revokeObjectURL(resultUrl);
      resultUrl = null;
    }
    if (els.resultImg) {
      els.resultImg.removeAttribute("src");
      els.resultImg.hidden = true;
    }
    if (els.downloadBtn) els.downloadBtn.disabled = true;
  }

  function loadImageFile(file) {
    if (!file || !String(file.type || "").startsWith("image/")) {
      setStatus(tt("ghibli.status.badFile"));
      return;
    }
    clearResult();
    sourceFile = file;
    sourceFileName = String(file.name || "image").replace(/\.[^.]+$/, "") || "ghibli";
    var reader = new FileReader();
    reader.onload = function () {
      if (els.originalImg) {
        els.originalImg.src = reader.result;
        els.originalImg.hidden = false;
      }
      if (els.previewGrid) els.previewGrid.hidden = false;
      updateRunEnabled();
      setStatus(tt("ghibli.status.loaded"));
    };
    reader.onerror = function () {
      setStatus(tt("ghibli.status.loadFail"));
    };
    reader.readAsDataURL(file);
  }

  async function runStylize() {
    if (!sourceFile) return;
    var healthy = await checkHealth();
    if (!healthy) {
      setStatus(tt("ghibli.status.needServer"));
      return;
    }

    els.runBtn.disabled = true;
    if (els.downloadBtn) els.downloadBtn.disabled = true;
    setStatus(tt("ghibli.status.processing"));

    try {
      var form = new FormData();
      form.append("image", sourceFile, sourceFile.name || "image.png");
      form.append("style", (els.styleSelect && els.styleSelect.value) || "hayao");

      var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      var timer = null;
      if (controller) {
        timer = setTimeout(function () {
          controller.abort();
        }, 180000);
      }

      var response = await fetch(getApiUrl() + "/api/ghibli", {
        method: "POST",
        body: form,
        signal: controller ? controller.signal : undefined
      });
      if (timer) clearTimeout(timer);

      if (!response.ok) {
        var message = tt("ghibli.status.fail");
        if (response.status === 404) message = tt("ghibli.health.outdated");
        else {
          try {
            var data = await response.json();
            if (data && data.error) message = data.error;
          } catch (e) {}
        }
        throw new Error(message);
      }

      var blob = await response.blob();
      clearResult();
      resultUrl = URL.createObjectURL(blob);
      if (els.resultImg) {
        els.resultImg.src = resultUrl;
        els.resultImg.hidden = false;
      }
      if (els.downloadBtn) els.downloadBtn.disabled = false;
      setStatus(tt("ghibli.status.done"));
    } catch (error) {
      if (error && error.name === "AbortError") {
        setStatus(tt("ghibli.status.timeout"));
      } else {
        setStatus((error && error.message) || tt("ghibli.status.fail"));
      }
    } finally {
      updateRunEnabled();
    }
  }

  function downloadResult() {
    if (!resultUrl) return;
    var link = document.createElement("a");
    link.download = sourceFileName + "-ghibli.png";
    link.href = resultUrl;
    link.click();
  }

  function cacheEls() {
    els.view = $("ghibliView");
    els.apiInput = $("ghibliApiInput");
    els.health = $("ghibliHealth");
    els.uploadZone = $("ghibliUploadZone");
    els.fileInput = $("ghibliInput");
    els.styleSelect = $("ghibliStyleSelect");
    els.runBtn = $("ghibliRunBtn");
    els.downloadBtn = $("ghibliDownloadBtn");
    els.status = $("ghibliStatus");
    els.previewGrid = $("ghibliPreviewGrid");
    els.originalImg = $("ghibliOriginalPreview");
    els.resultImg = $("ghibliResultPreview");
  }

  function bind() {
    if (!els.view || els.view.dataset.ghibliBound === "1") return;
    els.view.dataset.ghibliBound = "1";

    if (els.apiInput) {
      els.apiInput.addEventListener("change", function () {
        saveApi();
        checkHealth();
      });
    }
    if (els.fileInput) {
      els.fileInput.addEventListener("change", function () {
        var file = els.fileInput.files && els.fileInput.files[0];
        if (file) loadImageFile(file);
      });
    }
    if (els.uploadZone) {
      ["dragenter", "dragover"].forEach(function (ev) {
        els.uploadZone.addEventListener(ev, function (e) {
          e.preventDefault();
          els.uploadZone.classList.add("is-drag");
        });
      });
      ["dragleave", "drop"].forEach(function (ev) {
        els.uploadZone.addEventListener(ev, function (e) {
          e.preventDefault();
          els.uploadZone.classList.remove("is-drag");
        });
      });
      els.uploadZone.addEventListener("drop", function (e) {
        var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) loadImageFile(file);
      });
    }
    if (els.runBtn) els.runBtn.addEventListener("click", runStylize);
    if (els.downloadBtn) els.downloadBtn.addEventListener("click", downloadResult);
  }

  function onOpen() {
    loadSavedApi();
    checkHealth();
    if (els.fileInput) els.fileInput.focus();
  }

  function init() {
    cacheEls();
    if (!els.view) return;
    loadSavedApi();
    bind();
    setStatus(tt("ghibli.status.idle"));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.openGhibliTool = onOpen;
  window.refreshGhibliI18n = function () {
    if (!els.view) return;
    if (!sourceFile) setStatus(tt("ghibli.status.idle"));
  };
})();
