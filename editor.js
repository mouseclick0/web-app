/* Image editor (crop, rotate, flip, resize) running fully in the browser */
(function () {
  var MAX_BYTES = 20 * 1024 * 1024;
  var MAX_SIDE = 10000;

  var FORMATS = {
    png: { mime: "image/png", ext: "png", alpha: true, lossy: false },
    jpeg: { mime: "image/jpeg", ext: "jpg", alpha: false, lossy: true },
    webp: { mime: "image/webp", ext: "webp", alpha: true, lossy: true }
  };

  var RATIOS = {
    free: 0,
    "1:1": 1,
    "4:3": 4 / 3,
    "3:4": 3 / 4,
    "16:9": 16 / 9,
    "9:16": 9 / 16
  };

  var source = null;
  var work = null;
  var ops = [];
  var sel = null;
  var drag = null;
  var baseName = "image";
  var webpSupported = null;

  function t(key, params) {
    return typeof window.t === "function" ? window.t(key, params) : key;
  }

  function $(id) {
    return document.getElementById(id);
  }

  function clamp(value, min, max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
  }

  function setStatus(msg, isError) {
    var el = $("editorStatus");
    if (!el) return;
    el.textContent = msg || "";
    el.className = "cutout-status" + (isError ? " error" : "");
  }

  function currentFormat() {
    var select = $("editorFormat");
    var key = (select && select.value) || "png";
    return FORMATS[key] ? key : "png";
  }

  function currentRatio() {
    var select = $("editorRatio");
    var key = (select && select.value) || "free";
    return RATIOS[key] || 0;
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

  function makeCanvas(width, height) {
    var canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    return canvas;
  }

  /* Halving repeatedly keeps large downscales from looking jagged. */
  function scaleCanvas(canvas, width, height) {
    var current = canvas;
    while (current.width >= width * 2 && current.height >= height * 2 && current.width > 2 && current.height > 2) {
      var half = makeCanvas(current.width / 2, current.height / 2);
      var halfCtx = half.getContext("2d");
      halfCtx.imageSmoothingQuality = "high";
      halfCtx.drawImage(current, 0, 0, half.width, half.height);
      current = half;
    }

    var out = makeCanvas(width, height);
    var ctx = out.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(current, 0, 0, out.width, out.height);
    return out;
  }

  function applyOp(canvas, op) {
    if (op.type === "rotate") {
      var rotated = makeCanvas(canvas.height, canvas.width);
      var rctx = rotated.getContext("2d");
      if (op.dir === "cw") {
        rctx.translate(rotated.width, 0);
        rctx.rotate(Math.PI / 2);
      } else {
        rctx.translate(0, rotated.height);
        rctx.rotate(-Math.PI / 2);
      }
      rctx.drawImage(canvas, 0, 0);
      return rotated;
    }

    if (op.type === "flip") {
      var flipped = makeCanvas(canvas.width, canvas.height);
      var fctx = flipped.getContext("2d");
      if (op.axis === "h") {
        fctx.translate(flipped.width, 0);
        fctx.scale(-1, 1);
      } else {
        fctx.translate(0, flipped.height);
        fctx.scale(1, -1);
      }
      fctx.drawImage(canvas, 0, 0);
      return flipped;
    }

    if (op.type === "crop") {
      var cropped = makeCanvas(op.w, op.h);
      var cctx = cropped.getContext("2d");
      cctx.drawImage(canvas, Math.round(op.x), Math.round(op.y), cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);
      return cropped;
    }

    if (op.type === "resize") {
      return scaleCanvas(canvas, op.w, op.h);
    }

    return canvas;
  }

  function rebuild() {
    var canvas = source;
    for (var i = 0; i < ops.length; i++) canvas = applyOp(canvas, ops[i]);
    work = canvas;
  }

  function displayScale() {
    var canvas = $("editorCanvas");
    if (!canvas || !work || !canvas.clientWidth) return 1;
    return canvas.clientWidth / work.width;
  }

  function pointFromEvent(event) {
    var canvas = $("editorCanvas");
    var rect = canvas.getBoundingClientRect();
    var scale = rect.width ? work.width / rect.width : 1;
    return {
      x: clamp((event.clientX - rect.left) * scale, 0, work.width),
      y: clamp((event.clientY - rect.top) * scale, 0, work.height)
    };
  }

  function minSelection() {
    var scale = displayScale();
    return Math.max(2, 12 / (scale || 1));
  }

  /* Shared by drag-to-create and corner handles: one corner stays put. */
  function rectFromFixedCorner(fixed, point, ratio) {
    var dirX = point.x >= fixed.x ? 1 : -1;
    var dirY = point.y >= fixed.y ? 1 : -1;
    var maxW = dirX > 0 ? work.width - fixed.x : fixed.x;
    var maxH = dirY > 0 ? work.height - fixed.y : fixed.y;
    var w = Math.min(Math.abs(point.x - fixed.x), maxW);
    var h = Math.min(Math.abs(point.y - fixed.y), maxH);

    if (ratio) {
      if (w / ratio > h) h = w / ratio;
      else w = h * ratio;
      if (w > maxW) {
        w = maxW;
        h = w / ratio;
      }
      if (h > maxH) {
        h = maxH;
        w = h * ratio;
      }
    }

    return {
      x: dirX > 0 ? fixed.x : fixed.x - w,
      y: dirY > 0 ? fixed.y : fixed.y - h,
      w: w,
      h: h
    };
  }

  function centeredSelection(ratio) {
    var w = work.width;
    var h = work.height;
    if (ratio) {
      if (w / ratio > h) w = h * ratio;
      else h = w / ratio;
    }
    return { x: (work.width - w) / 2, y: (work.height - h) / 2, w: w, h: h };
  }

  function fitSelectionToRatio(ratio) {
    if (!work) return;
    if (!ratio) return;

    if (!sel) {
      sel = centeredSelection(ratio);
      return;
    }

    var cx = sel.x + sel.w / 2;
    var cy = sel.y + sel.h / 2;
    var w = sel.w;
    var h = sel.h;
    if (w / ratio > h) w = h * ratio;
    else h = w / ratio;

    if (w > work.width) {
      w = work.width;
      h = w / ratio;
    }
    if (h > work.height) {
      h = work.height;
      w = h * ratio;
    }

    sel = {
      x: clamp(cx - w / 2, 0, work.width - w),
      y: clamp(cy - h / 2, 0, work.height - h),
      w: w,
      h: h
    };
  }

  function rectFromHandle(handle, origin, point, ratio) {
    if (handle.length === 2) {
      var fixed = {
        x: handle.indexOf("w") >= 0 ? origin.x + origin.w : origin.x,
        y: handle.indexOf("n") >= 0 ? origin.y + origin.h : origin.y
      };
      return rectFromFixedCorner(fixed, point, ratio);
    }

    var min = minSelection();
    var rect = { x: origin.x, y: origin.y, w: origin.w, h: origin.h };

    if (handle === "n") {
      var bottom = origin.y + origin.h;
      rect.y = clamp(point.y, 0, bottom - min);
      rect.h = bottom - rect.y;
    } else if (handle === "s") {
      rect.h = clamp(point.y, origin.y + min, work.height) - origin.y;
    } else if (handle === "w") {
      var right = origin.x + origin.w;
      rect.x = clamp(point.x, 0, right - min);
      rect.w = right - rect.x;
    } else if (handle === "e") {
      rect.w = clamp(point.x, origin.x + min, work.width) - origin.x;
    }

    return rect;
  }

  function renderSelection() {
    var box = $("editorCrop");
    var info = $("editorCropInfo");
    if (!box) return;

    if (!work || !sel) {
      box.hidden = true;
      if (info) info.textContent = t("editor.crop.none");
      syncButtons();
      return;
    }

    var scale = displayScale();
    box.hidden = false;
    box.classList.toggle("ratio-locked", !!currentRatio());
    box.style.left = sel.x * scale + "px";
    box.style.top = sel.y * scale + "px";
    box.style.width = sel.w * scale + "px";
    box.style.height = sel.h * scale + "px";

    if (info) {
      info.textContent = t("editor.crop.size", {
        width: Math.round(sel.w),
        height: Math.round(sel.h)
      });
    }

    syncButtons();
  }

  function renderCanvas() {
    var canvas = $("editorCanvas");
    if (!canvas || !work) return;

    canvas.width = work.width;
    canvas.height = work.height;
    canvas.getContext("2d").drawImage(work, 0, 0);

    var stage = $("editorStage");
    if (stage) stage.hidden = false;

    var info = $("editorSizeInfo");
    if (info) {
      info.textContent = t("editor.sizeInfo", {
        width: work.width,
        height: work.height,
        originalWidth: source.width,
        originalHeight: source.height
      });
    }

    renderSelection();
  }

  function syncSizeInputs() {
    if (!work) return;
    var widthInput = $("editorWidth");
    var heightInput = $("editorHeight");
    if (widthInput) widthInput.value = work.width;
    if (heightInput) heightInput.value = work.height;
  }

  function syncButtons() {
    var loaded = !!work;
    var pairs = [
      ["editorRotateLeftBtn", loaded],
      ["editorRotateRightBtn", loaded],
      ["editorFlipHBtn", loaded],
      ["editorFlipVBtn", loaded],
      ["editorApplyResizeBtn", loaded],
      ["editorSaveBtn", loaded],
      ["editorResetBtn", loaded && ops.length > 0],
      ["editorUndoBtn", loaded && ops.length > 0],
      ["editorApplyCropBtn", loaded && !!sel],
      ["editorClearCropBtn", loaded && !!sel]
    ];

    pairs.forEach(function (pair) {
      var el = $(pair[0]);
      if (el) el.disabled = !pair[1];
    });
  }

  function syncFormatOptions() {
    var format = FORMATS[currentFormat()];
    var qualityRow = $("editorQualityRow");
    if (qualityRow) qualityRow.hidden = !format.lossy;
    var backgroundRow = $("editorBackgroundRow");
    if (backgroundRow) backgroundRow.hidden = format.alpha;
  }

  function pushOp(op) {
    ops.push(op);
    rebuild();
    sel = null;
    renderCanvas();
    syncSizeInputs();
    syncButtons();
  }

  function undo() {
    if (!ops.length) return;
    ops.pop();
    rebuild();
    sel = null;
    renderCanvas();
    syncSizeInputs();
    setStatus(ops.length ? t("editor.status.undone") : t("editor.status.reset"));
  }

  function resetAll() {
    if (!source) return;
    ops = [];
    rebuild();
    sel = null;
    renderCanvas();
    syncSizeInputs();
    setStatus(t("editor.status.reset"));
  }

  function applyCrop() {
    if (!work || !sel) return;

    var x = clamp(Math.round(sel.x), 0, work.width - 1);
    var y = clamp(Math.round(sel.y), 0, work.height - 1);
    var w = clamp(Math.round(sel.w), 1, work.width - x);
    var h = clamp(Math.round(sel.h), 1, work.height - y);

    pushOp({ type: "crop", x: x, y: y, w: w, h: h });
    setStatus(t("editor.status.cropped", { width: w, height: h }));
  }

  function applyResize() {
    if (!work) return;

    var width = parseInt(($("editorWidth") || {}).value, 10);
    var height = parseInt(($("editorHeight") || {}).value, 10);

    if (!width || !height || width < 1 || height < 1 || width > MAX_SIDE || height > MAX_SIDE) {
      setStatus(t("editor.status.sizeInvalid", { max: MAX_SIDE }), true);
      syncSizeInputs();
      return;
    }

    if (width === work.width && height === work.height) {
      setStatus(t("editor.status.sizeSame"));
      return;
    }

    pushOp({ type: "resize", w: width, h: height });
    setStatus(t("editor.status.resized", { width: width, height: height }));
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

  async function save() {
    if (!work) return;

    var formatKey = currentFormat();
    var format = FORMATS[formatKey];

    if (formatKey === "webp" && !(await detectWebpSupport())) {
      setStatus(t("editor.status.webpUnsupported"), true);
      return;
    }

    var canvas = work;
    if (!format.alpha) {
      canvas = makeCanvas(work.width, work.height);
      var ctx = canvas.getContext("2d");
      var background = $("editorBackground");
      ctx.fillStyle = (background && background.value) || "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(work, 0, 0);
    }

    try {
      var quality = parseInt(($("editorQuality") || {}).value || "92", 10) / 100;
      var blob = await canvasToBlob(canvas, format.mime, format.lossy ? quality : undefined);
      if (blob.type !== format.mime) throw new Error("unsupported output");
      downloadBlob(blob, baseName + "-edited." + format.ext);
      setStatus(t("editor.status.saved", { width: work.width, height: work.height }));
    } catch (e) {
      setStatus(t("editor.status.saveError"), true);
    }
  }

  async function acceptFile(file) {
    if (!file) return;

    if (!/^image\//.test(file.type)) {
      setStatus(t("editor.status.notImage"), true);
      return;
    }
    if (file.size > MAX_BYTES) {
      setStatus(t("editor.status.tooLarge"), true);
      return;
    }

    setStatus(t("editor.status.loading"));

    try {
      var decoded = await decodeImage(file);
      source = makeCanvas(decoded.width, decoded.height);
      source.getContext("2d").drawImage(decoded, 0, 0);
      if (decoded.close) decoded.close();
    } catch (e) {
      setStatus(t("editor.status.decodeError"), true);
      return;
    }

    baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    ops = [];
    sel = null;
    rebuild();

    var panel = $("editorPanel");
    if (panel) panel.hidden = false;

    renderCanvas();
    syncSizeInputs();
    syncButtons();
    setStatus(t("editor.status.loaded", { width: source.width, height: source.height }));
  }

  function onPointerDown(event) {
    if (!work) return;
    if (event.button !== undefined && event.button !== 0) return;

    var box = $("editorCrop");
    var handle = event.target.closest ? event.target.closest(".editor-handle") : null;
    var point = pointFromEvent(event);

    if (handle) {
      drag = { mode: "resize", handle: handle.getAttribute("data-handle"), origin: sel };
    } else if (sel && box && !box.hidden && box.contains(event.target)) {
      drag = { mode: "move", start: point, origin: sel };
    } else {
      drag = { mode: "create", anchor: point };
      sel = { x: point.x, y: point.y, w: 0, h: 0 };
    }

    var stage = $("editorStage");
    if (stage && stage.setPointerCapture) stage.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function onPointerMove(event) {
    if (!drag || !work) return;

    var point = pointFromEvent(event);
    var ratio = currentRatio();

    if (drag.mode === "create") {
      sel = rectFromFixedCorner(drag.anchor, point, ratio);
    } else if (drag.mode === "move") {
      var origin = drag.origin;
      sel = {
        x: clamp(origin.x + (point.x - drag.start.x), 0, work.width - origin.w),
        y: clamp(origin.y + (point.y - drag.start.y), 0, work.height - origin.h),
        w: origin.w,
        h: origin.h
      };
    } else {
      sel = rectFromHandle(drag.handle, drag.origin, point, ratio);
    }

    renderSelection();
  }

  function onPointerUp(event) {
    if (!drag) return;
    drag = null;

    var stage = $("editorStage");
    if (stage && stage.releasePointerCapture) {
      try {
        stage.releasePointerCapture(event.pointerId);
      } catch (e) {}
    }

    var min = minSelection();
    if (sel && (sel.w < min || sel.h < min)) sel = null;
    renderSelection();
  }

  function wireStage() {
    var stage = $("editorStage");
    if (!stage) return;

    stage.addEventListener("pointerdown", onPointerDown);
    stage.addEventListener("pointermove", onPointerMove);
    stage.addEventListener("pointerup", onPointerUp);
    stage.addEventListener("pointercancel", onPointerUp);
  }

  function wireDropZone() {
    var zone = $("editorUploadZone");
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
      var files = event.dataTransfer && event.dataTransfer.files;
      if (files && files.length) acceptFile(files[0]);
    });
  }

  function wireResizeInputs() {
    var widthInput = $("editorWidth");
    var heightInput = $("editorHeight");
    var lock = $("editorLockAspect");
    if (!widthInput || !heightInput) return;

    widthInput.addEventListener("input", function () {
      if (!work || !lock || !lock.checked) return;
      var value = parseInt(widthInput.value, 10);
      if (!value || value < 1) return;
      heightInput.value = Math.max(1, Math.round((value * work.height) / work.width));
    });

    heightInput.addEventListener("input", function () {
      if (!work || !lock || !lock.checked) return;
      var value = parseInt(heightInput.value, 10);
      if (!value || value < 1) return;
      widthInput.value = Math.max(1, Math.round((value * work.width) / work.height));
    });
  }

  async function markWebpOption() {
    if (await detectWebpSupport()) return;

    var option = document.querySelector('#editorFormat option[value="webp"]');
    if (option) {
      option.disabled = true;
      option.textContent = t("convert.format.webpUnavailable");
    }

    var note = $("editorWebpNote");
    if (note) note.hidden = false;

    if (currentFormat() === "webp") {
      $("editorFormat").value = "png";
      syncFormatOptions();
    }
  }

  function wire() {
    var openBtn = $("openEditorBtn");
    var view = $("editorView");
    if (!openBtn || !view) return;

    openBtn.addEventListener("click", function () {
      if (typeof showView === "function") showView(view);
      else {
        document.querySelectorAll("main").forEach(function (m) {
          m.hidden = m !== view;
        });
      }
      renderSelection();
    });

    var backBtn = $("backHomeFromEditorBtn");
    if (backBtn) {
      backBtn.addEventListener("click", function () {
        if (typeof showView === "function" && $("homeView")) showView($("homeView"));
        openBtn.focus();
      });
    }

    var input = $("editorInput");
    if (input) {
      input.addEventListener("change", function (event) {
        acceptFile(event.target.files && event.target.files[0]);
        event.target.value = "";
      });
    }

    $("editorRotateLeftBtn").addEventListener("click", function () {
      pushOp({ type: "rotate", dir: "ccw" });
      setStatus(t("editor.status.rotated"));
    });

    $("editorRotateRightBtn").addEventListener("click", function () {
      pushOp({ type: "rotate", dir: "cw" });
      setStatus(t("editor.status.rotated"));
    });

    $("editorFlipHBtn").addEventListener("click", function () {
      pushOp({ type: "flip", axis: "h" });
      setStatus(t("editor.status.flipped"));
    });

    $("editorFlipVBtn").addEventListener("click", function () {
      pushOp({ type: "flip", axis: "v" });
      setStatus(t("editor.status.flipped"));
    });

    $("editorRatio").addEventListener("change", function () {
      if (!work) return;
      fitSelectionToRatio(currentRatio());
      renderSelection();
    });

    $("editorApplyCropBtn").addEventListener("click", applyCrop);

    $("editorClearCropBtn").addEventListener("click", function () {
      sel = null;
      renderSelection();
    });

    $("editorApplyResizeBtn").addEventListener("click", applyResize);
    $("editorUndoBtn").addEventListener("click", undo);
    $("editorResetBtn").addEventListener("click", resetAll);
    $("editorSaveBtn").addEventListener("click", save);

    var formatSelect = $("editorFormat");
    if (formatSelect) formatSelect.addEventListener("change", syncFormatOptions);

    var quality = $("editorQuality");
    if (quality) {
      quality.addEventListener("input", function () {
        var output = $("editorQualityValue");
        if (output) output.textContent = quality.value + "%";
      });
    }

    window.addEventListener("resize", renderSelection);

    wireStage();
    wireDropZone();
    wireResizeInputs();
    syncFormatOptions();
    syncButtons();
    setStatus(t("editor.status.idle"));
    markWebpOption();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();
