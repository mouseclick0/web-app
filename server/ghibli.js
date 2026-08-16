"use strict";

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: function (_req, file, cb) {
    const name = String(file.originalname || "").toLowerCase();
    const okMime = !!(file.mimetype && file.mimetype.indexOf("image/") === 0);
    const okExt = /\.(png|jpe?g|webp|gif|bmp)$/i.test(name);
    if (!okMime && !okExt) {
      cb(new Error("Only image uploads are allowed"));
      return;
    }
    cb(null, true);
  }
});

const MODELS_DIR = path.join(__dirname, "models");
const MODEL_SIZE = 512;

const STYLES = {
  hayao: {
    file: "AnimeGANv2_Hayao.onnx",
    url: "https://huggingface.co/vumichien/AnimeGANv2_Hayao/resolve/main/AnimeGANv2_Hayao.onnx"
  }
};

let ort = null;
let sharp = null;
const sessions = Object.create(null);
let downloadPromise = null;

function getOrt() {
  if (!ort) ort = require("onnxruntime-node");
  return ort;
}

function getSharp() {
  if (!sharp) sharp = require("sharp");
  return sharp;
}

function resolveStyle(raw) {
  const key = String(raw || "hayao").toLowerCase();
  return STYLES[key] ? key : "hayao";
}

function guessMime(file) {
  if (file.mimetype && file.mimetype.indexOf("image/") === 0) return file.mimetype;
  const name = String(file.originalname || "").toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".gif")) return "image/gif";
  if (name.endsWith(".bmp")) return "image/bmp";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  return "image/png";
}

function downloadFile(url, destPath) {
  return new Promise(function (resolve, reject) {
    const file = fs.createWriteStream(destPath);
    const getter = url.indexOf("https:") === 0 ? https : http;
    const req = getter.get(url, { headers: { "User-Agent": "webtoolbay-ghibli/1.0" } }, function (res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlink(destPath, function () {});
        downloadFile(res.headers.location, destPath).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlink(destPath, function () {});
        reject(new Error("Model download failed (" + res.statusCode + ")"));
        return;
      }
      res.pipe(file);
      file.on("finish", function () {
        file.close(resolve);
      });
    });
    req.on("error", function (err) {
      file.close();
      fs.unlink(destPath, function () {});
      reject(err);
    });
  });
}

async function ensureModel(styleKey) {
  const style = STYLES[styleKey];
  if (!style) throw new Error("Unknown style");
  if (!fs.existsSync(MODELS_DIR)) fs.mkdirSync(MODELS_DIR, { recursive: true });
  const dest = path.join(MODELS_DIR, style.file);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1000000) return dest;

  if (downloadPromise) {
    await downloadPromise;
    if (fs.existsSync(dest) && fs.statSync(dest).size > 1000000) return dest;
  }

  const tmp = dest + ".part";
  downloadPromise = (async function () {
    console.log("[ghibli] downloading model:", style.url);
    await downloadFile(style.url, tmp);
    fs.renameSync(tmp, dest);
    console.log("[ghibli] model ready:", dest);
  })();

  try {
    await downloadPromise;
  } finally {
    downloadPromise = null;
  }
  return dest;
}

async function getSession(styleKey) {
  if (sessions[styleKey]) return sessions[styleKey];
  const modelPath = await ensureModel(styleKey);
  const session = await getOrt().InferenceSession.create(modelPath, {
    executionProviders: ["cpu"]
  });
  sessions[styleKey] = session;
  return session;
}

function clampByte(v) {
  if (v < 0) return 0;
  if (v > 255) return 255;
  return v | 0;
}

async function stylizeBuffer(imageBuffer, styleKey) {
  const sharpLib = getSharp();
  const session = await getSession(styleKey);

  const resized = await sharpLib(imageBuffer)
    .rotate()
    .resize(MODEL_SIZE, MODEL_SIZE, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const h = resized.info.height;
  const w = resized.info.width;
  const rgb = resized.data;
  const plane = h * w;
  // AnimeGANv2 Hayao ONNX expects NHWC float32 in [-1, 1].
  const floatData = new Float32Array(1 * h * w * 3);
  for (let i = 0; i < plane; i++) {
    const o = i * 3;
    floatData[o] = rgb[o] / 127.5 - 1;
    floatData[o + 1] = rgb[o + 1] / 127.5 - 1;
    floatData[o + 2] = rgb[o + 2] / 127.5 - 1;
  }

  const inputName = session.inputNames[0];
  const outputName = session.outputNames[0];
  const tensor = new (getOrt().Tensor)("float32", floatData, [1, h, w, 3]);
  const feeds = {};
  feeds[inputName] = tensor;
  const results = await session.run(feeds);
  const out = results[outputName];
  if (!out || !out.data) throw new Error("Model returned empty output");

  const outData = out.data;
  const outDims = out.dims || [];
  const outRgb = Buffer.alloc(plane * 3);
  const isNchw =
    outDims.length === 4 && outDims[1] === 3 && outDims[2] === h && outDims[3] === w;
  for (let i = 0; i < plane; i++) {
    const o = i * 3;
    if (isNchw) {
      outRgb[o] = clampByte((outData[i] + 1) * 127.5);
      outRgb[o + 1] = clampByte((outData[plane + i] + 1) * 127.5);
      outRgb[o + 2] = clampByte((outData[plane * 2 + i] + 1) * 127.5);
    } else {
      outRgb[o] = clampByte((outData[o] + 1) * 127.5);
      outRgb[o + 1] = clampByte((outData[o + 1] + 1) * 127.5);
      outRgb[o + 2] = clampByte((outData[o + 2] + 1) * 127.5);
    }
  }

  // Restore original aspect by resampling stylized square back to source size.
  const meta = await sharpLib(imageBuffer).rotate().metadata();
  const targetW = meta.width || w;
  const targetH = meta.height || h;

  return sharpLib(outRgb, { raw: { width: w, height: h, channels: 3 } })
    .resize(targetW, targetH, { fit: "fill" })
    .png()
    .toBuffer();
}

function registerGhibliRoutes(app) {
  app.post("/api/ghibli", function (req, res) {
    upload.single("image")(req, res, async function (err) {
      try {
        if (err) {
          res.status(400).json({ ok: false, error: err.message || "Upload failed" });
          return;
        }
        if (!req.file || !req.file.buffer) {
          res.status(400).json({ ok: false, error: "image file is required" });
          return;
        }

        const style = resolveStyle(req.body && req.body.style);
        const png = await stylizeBuffer(req.file.buffer, style);
        const baseName = String(req.file.originalname || "image")
          .replace(/\.[^.]+$/, "")
          .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
          .slice(0, 80) || "image";

        res.setHeader("Content-Type", "image/png");
        res.setHeader(
          "Content-Disposition",
          "attachment; filename=\"" +
            baseName +
            "-ghibli.png\"; filename*=UTF-8''" +
            encodeURIComponent(baseName + "-ghibli.png")
        );
        res.setHeader("Content-Length", String(png.length));
        res.send(png);
      } catch (error) {
        console.error("ghibli error:", error);
        if (!res.headersSent) {
          res.status(500).json({
            ok: false,
            error: error && error.message ? error.message : "Ghibli stylization failed"
          });
        }
      }
    });
  });
}

module.exports = {
  registerGhibliRoutes,
  STYLES
};
