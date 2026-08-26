/* Image to text (OCR) page, powered by Tesseract.js in the browser */
(function () {
  var TESSERACT_SRC = "https://cdn.jsdelivr.net/npm/tesseract.js@7/dist/tesseract.min.js";
  var MAX_BYTES = 12 * 1024 * 1024;

  var state = {
    file: null,
    previewUrl: "",
    text: "",
    busy: false
  };

  var worker = null;
  var workerLang = "";
  var libPromise = null;

  function t(key, params) {
    return typeof window.t === "function" ? window.t(key, params) : key;
  }

  function $(id) {
    return document.getElementById(id);
  }

  function setStatus(msg, isError) {
    var el = $("ocrStatus");
    if (!el) return;
    el.textContent = msg || "";
    el.className = "cutout-status" + (isError ? " error" : "");
  }

  function setProgress(ratio) {
    var wrap = $("ocrProgress");
    var fill = $("ocrProgressFill");
    if (!wrap || !fill) return;
    if (ratio == null) {
      wrap.hidden = true;
      fill.style.width = "0%";
      return;
    }
    var pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
    wrap.hidden = false;
    fill.style.width = pct + "%";
  }

  function setBusy(busy) {
    state.busy = busy;
    var runBtn = $("ocrRunBtn");
    var langSelect = $("ocrLangSelect");
    var input = $("ocrImageInput");
    if (runBtn) runBtn.disabled = busy || !state.file;
    if (langSelect) langSelect.disabled = busy;
    if (input) input.disabled = busy;
  }

  function setResult(text) {
    state.text = text || "";
    var area = $("ocrResult");
    if (area) area.value = state.text;
    var hasText = state.text.trim().length > 0;
    var copyBtn = $("ocrCopyBtn");
    var downloadBtn = $("ocrDownloadBtn");
    if (copyBtn) copyBtn.disabled = !hasText;
    if (downloadBtn) downloadBtn.disabled = !hasText;
  }

  function loadLibrary() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (libPromise) return libPromise;

    libPromise = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = TESSERACT_SRC;
      script.async = true;
      script.onload = function () {
        if (window.Tesseract) resolve(window.Tesseract);
        else reject(new Error("Tesseract missing"));
      };
      script.onerror = function () {
        libPromise = null;
        reject(new Error("Tesseract load failed"));
      };
      document.head.appendChild(script);
    });

    return libPromise;
  }

  function onWorkerLog(log) {
    if (!log || typeof log.progress !== "number") return;
    var status = String(log.status || "");
    if (status.indexOf("recogniz") !== -1) {
      setStatus(t("ocr.status.recognizing", { pct: Math.round(log.progress * 100) }));
    } else {
      setStatus(t("ocr.status.preparing", { pct: Math.round(log.progress * 100) }));
    }
    setProgress(log.progress);
  }

  async function ensureWorker(lang) {
    if (worker && workerLang === lang) return worker;

    if (worker) {
      try {
        await worker.terminate();
      } catch (e) {}
      worker = null;
      workerLang = "";
    }

    var Tesseract = await loadLibrary();
    worker = await Tesseract.createWorker(lang, 1, { logger: onWorkerLog });
    workerLang = lang;
    return worker;
  }

  function clearPreview() {
    if (state.previewUrl) {
      URL.revokeObjectURL(state.previewUrl);
      state.previewUrl = "";
    }
  }

  function acceptFile(file) {
    if (!file) return;

    if (!/^image\//.test(file.type)) {
      setStatus(t("ocr.status.fileType"), true);
      return;
    }

    if (file.size > MAX_BYTES) {
      setStatus(t("ocr.status.tooLarge"), true);
      return;
    }

    clearPreview();
    state.file = file;
    state.previewUrl = URL.createObjectURL(file);

    var img = $("ocrPreview");
    var box = $("ocrPreviewBox");
    if (img) img.src = state.previewUrl;
    if (box) box.hidden = false;

    setResult("");
    setProgress(null);
    setStatus(t("ocr.status.ready", { name: file.name }));

    var runBtn = $("ocrRunBtn");
    if (runBtn) runBtn.disabled = false;
  }

  async function runOcr() {
    if (state.busy || !state.file) return;

    var langSelect = $("ocrLangSelect");
    var lang = (langSelect && langSelect.value) || "kor+eng";

    setBusy(true);
    setResult("");
    setProgress(0);
    setStatus(t("ocr.status.starting"));

    try {
      var activeWorker = await ensureWorker(lang);
      var result = await activeWorker.recognize(state.file);
      var text = (result && result.data && result.data.text ? result.data.text : "").trim();

      setResult(text);
      setProgress(null);

      if (text) setStatus(t("ocr.status.done", { chars: text.length }));
      else setStatus(t("ocr.status.empty"), true);
    } catch (e) {
      setProgress(null);
      setStatus(t("ocr.status.error"), true);
      if (worker) {
        try {
          await worker.terminate();
        } catch (err) {}
        worker = null;
        workerLang = "";
      }
    } finally {
      setBusy(false);
    }
  }

  async function copyText() {
    var area = $("ocrResult");
    var value = area ? area.value : state.text;
    if (!value || !value.trim()) {
      setStatus(t("ocr.status.nothing"), true);
      return;
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        area.select();
        document.execCommand("copy");
      }
      setStatus(t("ocr.status.copied"));
    } catch (e) {
      setStatus(t("ocr.status.copyFail"), true);
    }
  }

  function downloadText() {
    var area = $("ocrResult");
    var value = area ? area.value : state.text;
    if (!value || !value.trim()) {
      setStatus(t("ocr.status.nothing"), true);
      return;
    }

    var blob = new Blob([value], { type: "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    var base = state.file && state.file.name ? state.file.name.replace(/\.[^.]+$/, "") : "ocr";

    link.href = url;
    link.download = base + ".txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function wireDropZone() {
    var zone = $("ocrUploadZone");
    if (!zone) return;

    ["dragenter", "dragover"].forEach(function (name) {
      zone.addEventListener(name, function (event) {
        event.preventDefault();
        zone.classList.add("drag-over");
      });
    });

    ["dragleave", "drop"].forEach(function (name) {
      zone.addEventListener(name, function (event) {
        event.preventDefault();
        zone.classList.remove("drag-over");
      });
    });

    zone.addEventListener("drop", function (event) {
      if (state.busy) return;
      var files = event.dataTransfer && event.dataTransfer.files;
      if (files && files.length) acceptFile(files[0]);
    });
  }

  function wire() {
    var openBtn = $("openOcrBtn");
    var view = $("ocrView");
    if (!view) return;

    if (typeof window.wtbWireToolPage === "function") {
      window.wtbWireToolPage({
        name: "ocr",
        openBtn: openBtn,
        backBtn: $("backHomeFromOcrBtn"),
        view: view,
        onOpen: function () {
          if (!state.file) setStatus(t("ocr.status.idle"));
        }
      });
    }

    var input = $("ocrImageInput");
    if (input) {
      input.addEventListener("change", function (event) {
        var files = event.target.files;
        if (files && files.length) acceptFile(files[0]);
      });
    }

    var langSelect = $("ocrLangSelect");
    if (langSelect) {
      langSelect.addEventListener("change", function () {
        if (state.file) setStatus(t("ocr.status.langChanged"));
      });
    }

    $("ocrRunBtn").addEventListener("click", runOcr);
    $("ocrCopyBtn").addEventListener("click", copyText);
    $("ocrDownloadBtn").addEventListener("click", downloadText);

    wireDropZone();
    setStatus(t("ocr.status.idle"));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();
