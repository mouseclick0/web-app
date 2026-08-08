/* Image format converter (PNG, JPG, WebP, BMP) running fully in the browser */
(function () {
  var JSZIP_SRC = "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js";
  var MAX_FILES = 20;
  var MAX_BYTES = 20 * 1024 * 1024;

  var FORMATS = {
    png: { mime: "image/png", ext: "png", alpha: true, lossy: false },
    jpeg: { mime: "image/jpeg", ext: "jpg", alpha: false, lossy: true },
    webp: { mime: "image/webp", ext: "webp", alpha: true, lossy: true },
    bmp: { mime: "image/bmp", ext: "bmp", alpha: false, lossy: false }
  };

  var items = [];
  var zipPromise = null;
  var webpSupported = null;
  var busy = false;

  function t(key, params) {
    return typeof window.t === "function" ? window.t(key, params) : key;
  }

  function $(id) {
    return document.getElementById(id);
  }

  function setStatus(msg, isError) {
    var el = $("convertStatus");
    if (!el) return;
    el.textContent = msg || "";
    el.className = "cutout-status" + (isError ? " error" : "");
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  }

  function currentFormat() {
    var select = $("convertFormat");
    var key = (select && select.value) || "png";
    return FORMATS[key] ? key : "png";
  }

  /* Safari cannot encode WebP from a canvas and silently returns PNG instead. */
  function detectWebpSupport() {
    if (webpSupported !== null) return Promise.resolve(webpSupported);

    return new Promise(function (resolve) {
      var canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      canvas.toBlob(
        function (blob) {
          webpSupported = !!blob && blob.type === "image/webp";
          resolve(webpSupported);
        },
        "image/webp",
        0.8
      );
    });
  }

  function loadZipLibrary() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    if (zipPromise) return zipPromise;

    zipPromise = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = JSZIP_SRC;
      script.async = true;
      script.onload = function () {
        if (window.JSZip) resolve(window.JSZip);
        else reject(new Error("JSZip missing"));
      };
      script.onerror = function () {
        zipPromise = null;
        reject(new Error("JSZip load failed"));
      };
      document.head.appendChild(script);
    });

    return zipPromise;
  }

  async function decodeImage(file) {
    if (typeof createImageBitmap === "function") {
      try {
        return await createImageBitmap(file, { imageOrientation: "from-image" });
      } catch (e) {}
      try {
        return await createImageBitmap(file);
      } catch (e) {}
    }

    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("decode failed"));
      };
      img.src = url;
    });
  }

  function targetSize(width, height) {
    var select = $("convertResize");
    var limit = select ? parseInt(select.value, 10) : 0;
    if (!limit || limit <= 0) return { width: width, height: height };

    var longest = Math.max(width, height);
    if (longest <= limit) return { width: width, height: height };

    var scale = limit / longest;
    return {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale))
    };
  }

  /* No browser can encode BMP from a canvas, so build the file by hand. */
  function encodeBmp(imageData) {
    var width = imageData.width;
    var height = imageData.height;
    var data = imageData.data;
    var rowSize = Math.floor((24 * width + 31) / 32) * 4;
    var pixelSize = rowSize * height;
    var headerSize = 14 + 40;
    var buffer = new ArrayBuffer(headerSize + pixelSize);
    var view = new DataView(buffer);
    var bytes = new Uint8Array(buffer);

    view.setUint8(0, 0x42);
    view.setUint8(1, 0x4d);
    view.setUint32(2, headerSize + pixelSize, true);
    view.setUint32(10, headerSize, true);

    view.setUint32(14, 40, true);
    view.setInt32(18, width, true);
    view.setInt32(22, height, true);
    view.setUint16(26, 1, true);
    view.setUint16(28, 24, true);
    view.setUint32(30, 0, true);
    view.setUint32(34, pixelSize, true);
    view.setInt32(38, 2835, true);
    view.setInt32(42, 2835, true);

    for (var row = 0; row < height; row++) {
      var src = (height - 1 - row) * width * 4;
      var dst = headerSize + row * rowSize;
      for (var x = 0; x < width; x++) {
        bytes[dst++] = data[src + 2];
        bytes[dst++] = data[src + 1];
        bytes[dst++] = data[src];
        src += 4;
      }
    }

    return new Blob([buffer], { type: "image/bmp" });
  }

  function canvasToBlob(canvas, mime, quality) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(
        function (blob) {
          if (blob) resolve(blob);
          else reject(new Error("encode failed"));
        },
        mime,
        quality
      );
    });
  }

  async function convertItem(item, formatKey) {
    var format = FORMATS[formatKey];
    var source = await decodeImage(item.file);
    var size = targetSize(source.width, source.height);
    var canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;

    var ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";

    if (!format.alpha) {
      var bgInput = $("convertBackground");
      ctx.fillStyle = (bgInput && bgInput.value) || "#ffffff";
      ctx.fillRect(0, 0, size.width, size.height);
    }

    ctx.drawImage(source, 0, 0, size.width, size.height);
    if (source.close) source.close();

    var blob;
    if (formatKey === "bmp") {
      blob = encodeBmp(ctx.getImageData(0, 0, size.width, size.height));
    } else {
      var quality = parseInt(($("convertQuality") || {}).value || "90", 10) / 100;
      blob = await canvasToBlob(canvas, format.mime, format.lossy ? quality : undefined);
      if (blob.type !== format.mime) throw new Error("unsupported output");
    }

    item.blob = blob;
    item.outputName = item.baseName + "." + format.ext;
    item.outputSize = blob.size;
    item.width = size.width;
    item.height = size.height;
  }

  function renderList() {
    var list = $("convertList");
    if (!list) return;

    list.innerHTML = "";
    list.hidden = items.length === 0;

    items.forEach(function (item, index) {
      var row = document.createElement("li");
      row.className = "convert-item";

      var thumb = document.createElement("img");
      thumb.className = "convert-thumb";
      thumb.src = item.previewUrl;
      thumb.alt = "";
      row.appendChild(thumb);

      var meta = document.createElement("div");
      meta.className = "convert-meta";

      var name = document.createElement("strong");
      name.textContent = item.outputName || item.file.name;
      meta.appendChild(name);

      var detail = document.createElement("span");
      if (item.blob) {
        detail.textContent = t("convert.item.done", {
          from: formatBytes(item.file.size),
          to: formatBytes(item.outputSize),
          width: item.width,
          height: item.height
        });
      } else if (item.error) {
        detail.textContent = t("convert.item.failed");
      } else {
        detail.textContent = t("convert.item.pending", { size: formatBytes(item.file.size) });
      }
      meta.appendChild(detail);
      row.appendChild(meta);

      var actions = document.createElement("div");
      actions.className = "convert-item-actions";

      if (item.blob) {
        var save = document.createElement("button");
        save.type = "button";
        save.className = "convert-mini-btn";
        save.textContent = t("convert.item.save");
        save.addEventListener("click", function () {
          downloadBlob(item.blob, item.outputName);
        });
        actions.appendChild(save);
      }

      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "convert-mini-btn ghost";
      remove.textContent = t("convert.item.remove");
      remove.addEventListener("click", function () {
        URL.revokeObjectURL(item.previewUrl);
        items.splice(index, 1);
        renderList();
        syncButtons();
        setStatus(items.length ? t("convert.status.ready", { count: items.length }) : t("convert.status.idle"));
      });
      actions.appendChild(remove);

      row.appendChild(actions);
      list.appendChild(row);
    });
  }

  function syncButtons() {
    var hasFiles = items.length > 0;
    var converted = items.filter(function (item) {
      return !!item.blob;
    });

    var runBtn = $("convertRunBtn");
    var zipBtn = $("convertZipBtn");
    var clearBtn = $("convertClearBtn");

    if (runBtn) runBtn.disabled = busy || !hasFiles;
    if (zipBtn) zipBtn.disabled = busy || converted.length === 0;
    if (clearBtn) clearBtn.disabled = busy || !hasFiles;
  }

  function syncFormatOptions() {
    var format = currentFormat();
    var lossy = FORMATS[format].lossy;
    var alpha = FORMATS[format].alpha;

    var qualityRow = $("convertQualityRow");
    if (qualityRow) qualityRow.hidden = !lossy;

    var backgroundRow = $("convertBackgroundRow");
    if (backgroundRow) backgroundRow.hidden = alpha;
  }

  function downloadBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function acceptFiles(fileList) {
    var incoming = Array.prototype.slice.call(fileList || []);
    if (!incoming.length) return;

    var skipped = 0;
    incoming.forEach(function (file) {
      if (items.length >= MAX_FILES) {
        skipped++;
        return;
      }
      if (!/^image\//.test(file.type)) {
        skipped++;
        return;
      }
      if (file.size > MAX_BYTES) {
        skipped++;
        return;
      }

      items.push({
        file: file,
        baseName: file.name.replace(/\.[^.]+$/, "") || "image",
        previewUrl: URL.createObjectURL(file),
        blob: null,
        error: false
      });
    });

    renderList();
    syncButtons();

    if (skipped) setStatus(t("convert.status.skipped", { count: skipped, max: MAX_FILES }), true);
    else setStatus(t("convert.status.ready", { count: items.length }));
  }

  async function runConversion() {
    if (busy || !items.length) return;

    var format = currentFormat();
    if (format === "webp") {
      var ok = await detectWebpSupport();
      if (!ok) {
        setStatus(t("convert.status.webpUnsupported"), true);
        return;
      }
    }

    busy = true;
    syncButtons();

    var failed = 0;
    for (var i = 0; i < items.length; i++) {
      setStatus(t("convert.status.working", { current: i + 1, total: items.length }));
      try {
        items[i].error = false;
        await convertItem(items[i], format);
      } catch (e) {
        items[i].blob = null;
        items[i].error = true;
        failed++;
      }
      renderList();
    }

    busy = false;
    syncButtons();

    if (failed) setStatus(t("convert.status.partial", { failed: failed, total: items.length }), true);
    else setStatus(t("convert.status.done", { count: items.length, format: FORMATS[format].ext.toUpperCase() }));
  }

  async function downloadZip() {
    var converted = items.filter(function (item) {
      return !!item.blob;
    });
    if (!converted.length) return;

    busy = true;
    syncButtons();
    setStatus(t("convert.status.zipping"));

    try {
      var JSZip = await loadZipLibrary();
      var zip = new JSZip();
      var used = {};

      converted.forEach(function (item) {
        var name = item.outputName;
        if (used[name]) {
          used[name] += 1;
          name = item.baseName + "-" + used[item.outputName] + "." + name.split(".").pop();
        } else {
          used[name] = 1;
        }
        zip.file(name, item.blob);
      });

      var blob = await zip.generateAsync({ type: "blob" });
      downloadBlob(blob, "converted-images.zip");
      setStatus(t("convert.status.zipDone", { count: converted.length }));
    } catch (e) {
      setStatus(t("convert.status.zipError"), true);
    } finally {
      busy = false;
      syncButtons();
    }
  }

  function clearAll() {
    items.forEach(function (item) {
      URL.revokeObjectURL(item.previewUrl);
    });
    items = [];
    renderList();
    syncButtons();
    setStatus(t("convert.status.idle"));
  }

  function wireDropZone() {
    var zone = $("convertUploadZone");
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
      if (busy) return;
      var files = event.dataTransfer && event.dataTransfer.files;
      if (files && files.length) acceptFiles(files);
    });
  }

  async function markWebpOption() {
    var supported = await detectWebpSupport();
    if (supported) return;

    var option = document.querySelector('#convertFormat option[value="webp"]');
    if (option) {
      option.disabled = true;
      option.textContent = t("convert.format.webpUnavailable");
    }

    var note = $("convertWebpNote");
    if (note) note.hidden = false;

    if (currentFormat() === "webp") {
      $("convertFormat").value = "png";
      syncFormatOptions();
    }
  }

  function wire() {
    var openBtn = $("openConvertBtn");
    var view = $("convertView");
    if (!openBtn || !view) return;

    openBtn.addEventListener("click", function () {
      if (typeof showView === "function") showView(view);
      else {
        document.querySelectorAll("main").forEach(function (m) {
          m.hidden = m !== view;
        });
      }
    });

    var backBtn = $("backHomeFromConvertBtn");
    if (backBtn) {
      backBtn.addEventListener("click", function () {
        if (typeof showView === "function" && $("homeView")) showView($("homeView"));
        openBtn.focus();
      });
    }

    var input = $("convertInput");
    if (input) {
      input.addEventListener("change", function (event) {
        acceptFiles(event.target.files);
        event.target.value = "";
      });
    }

    var formatSelect = $("convertFormat");
    if (formatSelect) {
      formatSelect.addEventListener("change", function () {
        syncFormatOptions();
      });
    }

    var quality = $("convertQuality");
    if (quality) {
      quality.addEventListener("input", function () {
        var output = $("convertQualityValue");
        if (output) output.textContent = quality.value + "%";
      });
    }

    $("convertRunBtn").addEventListener("click", runConversion);
    $("convertZipBtn").addEventListener("click", downloadZip);
    $("convertClearBtn").addEventListener("click", clearAll);

    wireDropZone();
    syncFormatOptions();
    syncButtons();
    setStatus(t("convert.status.idle"));
    markWebpOption();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();
