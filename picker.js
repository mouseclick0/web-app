/* Image colour picker: reads pixels from an image entirely in the browser */
(function () {
  var MAX_BYTES = 20 * 1024 * 1024;
  var MIN_ZOOM = 0.25;
  var MAX_ZOOM = 4;
  var ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];
  var MAX_SWATCHES = 24;
  // Pointer travel that still counts as a click rather than a pan.
  var CLICK_SLOP = 4;

  // Natural-size copy of the image; every pixel read happens here.
  var pixels = null;
  var pixelCtx = null;
  var zoom = 1;
  var picked = null;
  var palette = [];
  var copyResetTimer = null;
  var copyResetBtn = null;

  function t(key, params) {
    return typeof window.t === "function" ? window.t(key, params) : key;
  }

  function $(id) {
    return document.getElementById(id);
  }

  function setStatus(msg, isError) {
    var el = $("pickerStatus");
    if (!el) return;
    el.textContent = msg || "";
    el.className = "cutout-status" + (isError ? " error" : "");
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  /* ---------- colour conversion ---------- */

  function toHex(rgb) {
    return (
      "#" +
      [rgb.r, rgb.g, rgb.b]
        .map(function (v) {
          return ("0" + v.toString(16)).slice(-2);
        })
        .join("")
        .toUpperCase()
    );
  }

  function toRgbText(rgb) {
    return "rgb(" + rgb.r + ", " + rgb.g + ", " + rgb.b + ")";
  }

  function rgbToHsl(rgb) {
    var r = rgb.r / 255;
    var g = rgb.g / 255;
    var b = rgb.b / 255;
    var max = Math.max(r, g, b);
    var min = Math.min(r, g, b);
    var d = max - min;
    var l = (max + min) / 2;
    var h = 0;
    var s = 0;

    if (d !== 0) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }

    return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  function rgbToHsv(rgb) {
    var r = rgb.r / 255;
    var g = rgb.g / 255;
    var b = rgb.b / 255;
    var max = Math.max(r, g, b);
    var min = Math.min(r, g, b);
    var d = max - min;
    var h = 0;

    if (d !== 0) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }

    return {
      h: Math.round(h),
      s: Math.round((max === 0 ? 0 : d / max) * 100),
      v: Math.round(max * 100)
    };
  }

  /* Plain arithmetic conversion, not a colour-managed profile. */
  function rgbToCmyk(rgb) {
    var r = rgb.r / 255;
    var g = rgb.g / 255;
    var b = rgb.b / 255;
    var k = 1 - Math.max(r, g, b);
    if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
    return {
      c: Math.round(((1 - r - k) / (1 - k)) * 100),
      m: Math.round(((1 - g - k) / (1 - k)) * 100),
      y: Math.round(((1 - b - k) / (1 - k)) * 100),
      k: Math.round(k * 100)
    };
  }

  function formatValues(rgb) {
    var hsl = rgbToHsl(rgb);
    var hsv = rgbToHsv(rgb);
    var cmyk = rgbToCmyk(rgb);
    return {
      hex: toHex(rgb),
      rgb: toRgbText(rgb),
      hsl: "hsl(" + hsl.h + ", " + hsl.s + "%, " + hsl.l + "%)",
      hsv: "hsv(" + hsv.h + ", " + hsv.s + "%, " + hsv.v + "%)",
      cmyk: "cmyk(" + cmyk.c + "%, " + cmyk.m + "%, " + cmyk.y + "%, " + cmyk.k + "%)"
    };
  }

  /* Keeps the readout legible on both very light and very dark swatches. */
  function readableInk(rgb) {
    var luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    return luminance > 0.6 ? "#14212e" : "#ffffff";
  }

  /* ---------- image loading ---------- */

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

  function adoptImage(bitmap) {
    pixels = document.createElement("canvas");
    pixels.width = bitmap.width;
    pixels.height = bitmap.height;
    pixelCtx = pixels.getContext("2d", { willReadFrequently: true });
    pixelCtx.drawImage(bitmap, 0, 0);
    if (bitmap.close) bitmap.close();

    var panel = $("pickerPanel");
    if (panel) panel.hidden = false;

    picked = null;
    setZoom(fitZoom(), true);
    renderPicked();
    setStatus(t("picker.status.loaded", { width: pixels.width, height: pixels.height }));
  }

  async function acceptFile(file) {
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      setStatus(t("picker.status.notImage"), true);
      return;
    }
    if (file.size > MAX_BYTES) {
      setStatus(t("picker.status.tooLarge"), true);
      return;
    }

    setStatus(t("picker.status.loading"));
    try {
      adoptImage(await decodeImage(file));
    } catch (e) {
      setStatus(t("picker.status.decodeError"), true);
    }
  }

  /*
   * Remote images can only be read back when the host sends CORS headers,
   * so a blocked host is reported instead of silently failing on getImageData.
   */
  function loadFromUrl(url) {
    if (!url) {
      setStatus(t("picker.status.urlEmpty"), true);
      return;
    }

    setStatus(t("picker.status.loading"));
    var img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = function () {
      try {
        var probe = document.createElement("canvas");
        probe.width = 1;
        probe.height = 1;
        var ctx = probe.getContext("2d");
        ctx.drawImage(img, 0, 0);
        ctx.getImageData(0, 0, 1, 1);
      } catch (e) {
        setStatus(t("picker.status.urlBlocked"), true);
        return;
      }
      adoptImage(img);
    };
    img.onerror = function () {
      setStatus(t("picker.status.urlBlocked"), true);
    };
    img.src = url;
  }

  /* ---------- zoom and rendering ---------- */

  function fitZoom() {
    var wrap = $("pickerStageWrap");
    if (!pixels || !wrap) return 1;
    var available = wrap.clientWidth || pixels.width;
    return clamp(Math.min(1, available / pixels.width), MIN_ZOOM, MAX_ZOOM);
  }

  function drawStage() {
    var canvas = $("pickerCanvas");
    if (!canvas || !pixels) return;

    var w = Math.max(1, Math.round(pixels.width * zoom));
    var h = Math.max(1, Math.round(pixels.height * zoom));
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext("2d");
    // Above 100% the individual pixels should stay square, not blur together.
    ctx.imageSmoothingEnabled = zoom < 1;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(pixels, 0, 0, w, h);
  }

  function setZoom(next, skipCentre) {
    var wrap = $("pickerStageWrap");
    var previous = zoom;
    zoom = clamp(next, MIN_ZOOM, MAX_ZOOM);

    var anchorX = 0.5;
    var anchorY = 0.5;
    if (wrap && !skipCentre && wrap.scrollWidth > 0) {
      anchorX = (wrap.scrollLeft + wrap.clientWidth / 2) / wrap.scrollWidth;
      anchorY = (wrap.scrollTop + wrap.clientHeight / 2) / wrap.scrollHeight;
    }

    drawStage();

    if (wrap && !skipCentre && previous !== zoom) {
      wrap.scrollLeft = anchorX * wrap.scrollWidth - wrap.clientWidth / 2;
      wrap.scrollTop = anchorY * wrap.scrollHeight - wrap.clientHeight / 2;
    }

    var label = $("pickerZoomValue");
    if (label) label.textContent = Math.round(zoom * 100) + "%";
    syncZoomButtons();
  }

  function stepZoom(direction) {
    var current = zoom;
    if (direction > 0) {
      for (var i = 0; i < ZOOM_STEPS.length; i++) {
        if (ZOOM_STEPS[i] > current + 0.001) return setZoom(ZOOM_STEPS[i]);
      }
      return setZoom(MAX_ZOOM);
    }
    for (var j = ZOOM_STEPS.length - 1; j >= 0; j--) {
      if (ZOOM_STEPS[j] < current - 0.001) return setZoom(ZOOM_STEPS[j]);
    }
    return setZoom(MIN_ZOOM);
  }

  function syncZoomButtons() {
    var out = $("pickerZoomOutBtn");
    var into = $("pickerZoomInBtn");
    if (out) out.disabled = !pixels || zoom <= MIN_ZOOM + 0.001;
    if (into) into.disabled = !pixels || zoom >= MAX_ZOOM - 0.001;
  }

  /* ---------- reading a pixel ---------- */

  function pixelAt(clientX, clientY) {
    var canvas = $("pickerCanvas");
    if (!canvas || !pixels) return null;
    var rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    var x = Math.floor(((clientX - rect.left) / rect.width) * pixels.width);
    var y = Math.floor(((clientY - rect.top) / rect.height) * pixels.height);
    if (x < 0 || y < 0 || x >= pixels.width || y >= pixels.height) return null;

    var d = pixelCtx.getImageData(x, y, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2], a: d[3], x: x, y: y };
  }

  function renderHover(rgb) {
    var chip = $("pickerHoverChip");
    var swatch = $("pickerHoverSwatch");
    var text = $("pickerHoverText");
    if (!chip || !swatch || !text) return;

    if (!rgb) {
      chip.classList.add("is-empty");
      return;
    }
    chip.classList.remove("is-empty");
    swatch.style.background = toHex(rgb);
    text.textContent = toHex(rgb) + " · " + rgb.x + ", " + rgb.y;
  }

  function renderPicked() {
    var empty = $("pickerEmpty");
    var detail = $("pickerDetail");
    if (!picked) {
      if (empty) empty.hidden = false;
      if (detail) detail.hidden = true;
      return;
    }
    if (empty) empty.hidden = true;
    if (detail) detail.hidden = false;

    var values = formatValues(picked);
    var swatch = $("pickerSwatch");
    if (swatch) {
      swatch.style.background = values.hex;
      swatch.style.color = readableInk(picked);
      swatch.textContent = values.hex;
    }

    ["hex", "rgb", "hsl", "hsv", "cmyk"].forEach(function (key) {
      var field = $("pickerValue_" + key);
      if (field) field.value = values[key];
    });

    var note = $("pickerAlphaNote");
    if (note) {
      if (picked.a === 0) {
        note.hidden = false;
        note.textContent = t("picker.transparent");
      } else if (picked.a < 255) {
        note.hidden = false;
        note.textContent = t("picker.alphaNote", {
          alpha: Math.round((picked.a / 255) * 100)
        });
      } else {
        note.hidden = true;
      }
    }
  }

  /* ---------- palette ---------- */

  function renderPalette() {
    var list = $("pickerPalette");
    var empty = $("pickerPaletteEmpty");
    if (!list) return;

    list.textContent = "";
    if (!palette.length) {
      if (empty) empty.hidden = false;
    } else if (empty) {
      empty.hidden = true;
    }

    palette.forEach(function (rgb, index) {
      var hex = toHex(rgb);
      var item = document.createElement("li");
      item.className = "picker-swatch-item";

      var use = document.createElement("button");
      use.type = "button";
      use.className = "picker-swatch";
      use.style.background = hex;
      use.title = hex;
      use.setAttribute("aria-label", hex);
      use.addEventListener("click", function () {
        picked = { r: rgb.r, g: rgb.g, b: rgb.b, a: 255, x: rgb.x, y: rgb.y };
        renderPicked();
      });

      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "picker-swatch-remove";
      remove.textContent = "\u00d7";
      remove.setAttribute("aria-label", t("picker.removeSwatch", { hex: hex }));
      remove.addEventListener("click", function () {
        palette.splice(index, 1);
        renderPalette();
      });

      item.appendChild(use);
      item.appendChild(remove);
      list.appendChild(item);
    });

    var copyAll = $("pickerCopyAllBtn");
    var clear = $("pickerClearPaletteBtn");
    if (copyAll) copyAll.disabled = !palette.length;
    if (clear) clear.disabled = !palette.length;
  }

  function addSwatch() {
    if (!picked) return;
    var hex = toHex(picked);
    var exists = palette.some(function (c) {
      return toHex(c) === hex;
    });
    if (exists) {
      setStatus(t("picker.status.duplicate", { hex: hex }));
      return;
    }
    if (palette.length >= MAX_SWATCHES) palette.shift();
    palette.push({ r: picked.r, g: picked.g, b: picked.b, x: picked.x, y: picked.y });
    renderPalette();
    setStatus(t("picker.status.added", { hex: hex }));
  }

  /* ---------- clipboard ---------- */

  async function copyText(text, button) {
    var ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch (e) {
      // Older browsers and insecure origins still need the textarea trick.
      try {
        var area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        ok = document.execCommand("copy");
        document.body.removeChild(area);
      } catch (err) {
        ok = false;
      }
    }

    if (!ok) {
      setStatus(t("picker.status.copyError"), true);
      return;
    }

    setStatus(t("picker.status.copied", { value: text }));
    if (button) showCopiedLabel(button);
  }

  /*
   * Only one button shows the confirmation at a time, so a second copy has to put
   * the previous button back before claiming the timer.
   */
  function restoreCopyLabel() {
    if (!copyResetBtn) return;
    var label = copyResetBtn.getAttribute("data-label");
    if (label) copyResetBtn.textContent = label;
    copyResetBtn = null;
  }

  function showCopiedLabel(button) {
    clearTimeout(copyResetTimer);
    restoreCopyLabel();

    button.setAttribute("data-label", button.textContent);
    button.textContent = t("picker.copied");
    copyResetBtn = button;
    copyResetTimer = setTimeout(restoreCopyLabel, 1200);
  }

  /* ---------- stage interaction ---------- */

  function wireStage() {
    var wrap = $("pickerStageWrap");
    var canvas = $("pickerCanvas");
    if (!wrap || !canvas) return;

    var panning = false;
    var moved = 0;
    var startX = 0;
    var startY = 0;
    var scrollX = 0;
    var scrollY = 0;

    canvas.addEventListener("pointerdown", function (event) {
      if (!pixels) return;
      panning = true;
      moved = 0;
      startX = event.clientX;
      startY = event.clientY;
      scrollX = wrap.scrollLeft;
      scrollY = wrap.scrollTop;
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch (e) {}
    });

    canvas.addEventListener("pointermove", function (event) {
      if (!pixels) return;

      if (panning) {
        var dx = event.clientX - startX;
        var dy = event.clientY - startY;
        moved = Math.max(moved, Math.abs(dx), Math.abs(dy));
        if (moved > CLICK_SLOP) {
          wrap.scrollLeft = scrollX - dx;
          wrap.scrollTop = scrollY - dy;
          renderHover(null);
          return;
        }
      }

      renderHover(pixelAt(event.clientX, event.clientY));
    });

    canvas.addEventListener("pointerleave", function () {
      renderHover(null);
    });

    canvas.addEventListener("pointerup", function (event) {
      if (!pixels) return;
      var wasPan = moved > CLICK_SLOP;
      panning = false;
      try {
        if (canvas.hasPointerCapture(event.pointerId)) {
          canvas.releasePointerCapture(event.pointerId);
        }
      } catch (e) {}
      if (wasPan) return;

      var hit = pixelAt(event.clientX, event.clientY);
      if (!hit) return;
      picked = hit;
      renderPicked();
      setStatus(t("picker.status.picked", { hex: toHex(hit), x: hit.x, y: hit.y }));
    });

    canvas.addEventListener("pointercancel", function () {
      panning = false;
    });
  }

  /* ---------- setup ---------- */

  function wireDropZone() {
    var zone = $("pickerUploadZone");
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

  function wirePaste() {
    document.addEventListener("paste", function (event) {
      var view = $("pickerView");
      if (!view || view.hidden) return;
      var items = event.clipboardData && event.clipboardData.items;
      if (!items) return;

      for (var i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image/") === 0) {
          var file = items[i].getAsFile();
          if (file) {
            event.preventDefault();
            setStatus(t("picker.status.pasted"));
            acceptFile(file);
          }
          return;
        }
      }
    });
  }

  /* Chromium exposes a system-wide picker; offer it only where it exists. */
  function wireEyeDropper() {
    var btn = $("pickerEyeDropperBtn");
    if (!btn) return;
    if (typeof window.EyeDropper !== "function") {
      btn.hidden = true;
      return;
    }

    btn.addEventListener("click", async function () {
      try {
        var result = await new window.EyeDropper().open();
        var hex = String(result.sRGBHex || "").replace("#", "");
        if (hex.length !== 6) throw new Error("bad value");
        picked = {
          r: parseInt(hex.slice(0, 2), 16),
          g: parseInt(hex.slice(2, 4), 16),
          b: parseInt(hex.slice(4, 6), 16),
          a: 255,
          x: 0,
          y: 0
        };
        renderPicked();
        setStatus(t("picker.status.picked", { hex: toHex(picked), x: 0, y: 0 }));
      } catch (e) {
        // An aborted pick is a normal outcome, not an error worth reporting.
        if (e && e.name === "AbortError") return;
        setStatus(t("picker.status.eyedropperError"), true);
      }
    });
  }

  function wire() {
    var openBtn = $("openPickerBtn");
    var view = $("pickerView");
    if (!openBtn || !view) return;

    openBtn.addEventListener("click", function () {
      if (typeof showView === "function") showView(view);
      else {
        document.querySelectorAll("main").forEach(function (m) {
          m.hidden = m !== view;
        });
      }
    });

    var backBtn = $("backHomeFromPickerBtn");
    if (backBtn) {
      backBtn.addEventListener("click", function () {
        if (typeof showView === "function" && $("homeView")) showView($("homeView"));
        openBtn.focus();
      });
    }

    var input = $("pickerInput");
    if (input) {
      input.addEventListener("change", function (event) {
        acceptFile(event.target.files && event.target.files[0]);
        event.target.value = "";
      });
    }

    var urlBtn = $("pickerUrlBtn");
    var urlInput = $("pickerUrlInput");
    if (urlBtn && urlInput) {
      urlBtn.addEventListener("click", function () {
        loadFromUrl(urlInput.value.trim());
      });
      urlInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          loadFromUrl(urlInput.value.trim());
        }
      });
    }

    var zoomOut = $("pickerZoomOutBtn");
    var zoomIn = $("pickerZoomInBtn");
    var zoomFit = $("pickerZoomFitBtn");
    var zoomActual = $("pickerZoomActualBtn");
    if (zoomOut) zoomOut.addEventListener("click", function () { stepZoom(-1); });
    if (zoomIn) zoomIn.addEventListener("click", function () { stepZoom(1); });
    if (zoomFit) zoomFit.addEventListener("click", function () { setZoom(fitZoom()); });
    if (zoomActual) zoomActual.addEventListener("click", function () { setZoom(1); });

    document.querySelectorAll("[data-picker-copy]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var field = $("pickerValue_" + btn.getAttribute("data-picker-copy"));
        if (field && field.value) copyText(field.value, btn);
      });
    });

    var addBtn = $("pickerAddSwatchBtn");
    if (addBtn) addBtn.addEventListener("click", addSwatch);

    var copyAll = $("pickerCopyAllBtn");
    if (copyAll) {
      copyAll.addEventListener("click", function () {
        if (!palette.length) return;
        copyText(palette.map(toHex).join("\n"), copyAll);
      });
    }

    var clearBtn = $("pickerClearPaletteBtn");
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        palette = [];
        renderPalette();
        setStatus(t("picker.status.cleared"));
      });
    }

    wireDropZone();
    wireStage();
    wirePaste();
    wireEyeDropper();

    window.refreshPickerI18n = function () {
      // A language switch has already relabelled the buttons, so drop any pending restore.
      clearTimeout(copyResetTimer);
      copyResetBtn = null;
      renderPicked();
      renderPalette();
      if (!pixels) setStatus(t("picker.status.idle"));
      else setStatus(t("picker.status.loaded", { width: pixels.width, height: pixels.height }));
    };

    renderPalette();
    renderPicked();
    syncZoomButtons();
    setStatus(t("picker.status.idle"));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();
