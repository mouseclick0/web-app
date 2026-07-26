"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const express = require("express");
const cors = require("cors");
const { ensureYtDlp, getYtDlpPath } = require("./ensure-ytdlp");
const { ensureFfmpeg, getFfmpegPath } = require("./ensure-ffmpeg");

const PORT = Number(process.env.PORT) || 8787;
const FORMAT_PRESETS = {
  // Prefer merged video+audio; fall back to progressive single-file streams.
  best: "bv*+ba/b[ext=mp4]/b",
  "1080": "bv*[height<=1080]+ba/b[height<=1080][ext=mp4]/b[height<=1080]/bv*+ba/b",
  "720": "bv*[height<=720]+ba/b[height<=720][ext=mp4]/b[height<=720]/bv*+ba/b",
  "480": "bv*[height<=480]+ba/b[height<=480][ext=mp4]/b[height<=480]/bv*+ba/b",
  audio: "ba/b"
};

const VIDEO_EXTS = new Set([".mp4", ".mkv", ".webm", ".mov", ".avi"]);
const AUDIO_ONLY_EXTS = new Set([".m4a", ".mp3", ".opus", ".ogg", ".wav", ".aac", ".flac"]);

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "32kb" }));

const STATIC_ROOT = path.join(__dirname, "..");
app.use(express.static(STATIC_ROOT));

function assertHttpUrl(raw) {
  let parsed;
  try {
    parsed = new URL(String(raw || "").trim());
  } catch (error) {
    const err = new Error("Invalid URL");
    err.status = 400;
    throw err;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    const err = new Error("Only http/https URLs are allowed");
    err.status = 400;
    throw err;
  }
  return parsed.href;
}

function resolveFormat(key) {
  return FORMAT_PRESETS[String(key || "best")] || FORMAT_PRESETS.best;
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return h + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }
  return m + ":" + String(s).padStart(2, "0");
}

function safeFileName(name, fallback) {
  const base = String(name || fallback || "video")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return base || fallback || "video";
}

function listPresets() {
  return [
    { id: "best", label: "Best" },
    { id: "1080", label: "1080p" },
    { id: "720", label: "720p" },
    { id: "480", label: "480p" },
    { id: "audio", label: "Audio only" }
  ];
}

function runYtDlp(args) {
  return new Promise(function (resolve, reject) {
    const bin = getYtDlpPath();
    const child = spawn(bin, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", function (chunk) {
      stdout += chunk.toString();
    });
    child.stderr.on("data", function (chunk) {
      stderr += chunk.toString();
    });
    child.on("error", function (err) {
      reject(err);
    });
    child.on("close", function (code) {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error((stderr || stdout || "yt-dlp failed").trim().slice(0, 500)));
      }
    });
  });
}

function pickDownloadedFile(tempDir, preferAudio) {
  const files = fs.readdirSync(tempDir).filter(function (name) {
    return fs.statSync(path.join(tempDir, name)).isFile();
  });
  if (!files.length) return "";

  const ranked = files
    .map(function (name) {
      const full = path.join(tempDir, name);
      const ext = path.extname(name).toLowerCase();
      const size = fs.statSync(full).size;
      let score = size;
      if (preferAudio) {
        if (AUDIO_ONLY_EXTS.has(ext)) score += 1e15;
        if (VIDEO_EXTS.has(ext)) score -= 1e14;
      } else {
        if (VIDEO_EXTS.has(ext)) score += 1e15;
        if (AUDIO_ONLY_EXTS.has(ext)) score -= 1e14;
      }
      return { name: name, score: score };
    })
    .sort(function (a, b) {
      return b.score - a.score;
    });

  return ranked[0].name;
}

function ytDlpBaseArgs() {
  const ffmpegPath = getFfmpegPath();
  const args = [];
  if (ffmpegPath && fs.existsSync(ffmpegPath)) {
    args.push("--ffmpeg-location", path.dirname(ffmpegPath));
  }
  return args;
}

function cleanupDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (error) {}
}

app.get("/api/health", async function (_req, res) {
  try {
    const version = (await runYtDlp(["--version"])).trim();
    const ffmpegPath = getFfmpegPath();
    const ffmpegOk = !!(ffmpegPath && fs.existsSync(ffmpegPath));
    res.json({
      ok: true,
      engine: "yt-dlp",
      version: version,
      ffmpeg: ffmpegOk,
      port: PORT
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error && error.message ? error.message : "yt-dlp unavailable"
    });
  }
});

app.post("/api/info", async function (req, res) {
  try {
    const url = assertHttpUrl(req.body && req.body.url);
    const raw = await runYtDlp([
      "--dump-single-json",
      "--no-warnings",
      "--no-playlist",
      "--skip-download",
      url
    ]);
    const data = JSON.parse(raw);
    const title = data.title || data.fulltitle || "video";
    const extHint = data.ext || "mp4";

    res.json({
      ok: true,
      id: data.id || "",
      title: title,
      thumbnail: data.thumbnail || (Array.isArray(data.thumbnails) && data.thumbnails.length
        ? data.thumbnails[data.thumbnails.length - 1].url
        : ""),
      duration: Number(data.duration) || 0,
      durationText: formatDuration(data.duration),
      uploader: data.uploader || data.channel || "",
      webpageUrl: data.webpage_url || url,
      ext: extHint,
      filename: safeFileName(title, "video") + "." + (extHint === "webm" ? "webm" : "mp4"),
      formats: listPresets()
    });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({
      ok: false,
      error: error && error.message ? error.message : "Failed to fetch video info"
    });
  }
});

app.get("/api/download", async function (req, res) {
  let tempDir = "";
  try {
    const url = assertHttpUrl(req.query.url);
    const formatKey = String(req.query.format || "best");
    const format = resolveFormat(formatKey);
    const preferAudio = formatKey === "audio";
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ytdlp-"));
    const outTemplate = path.join(tempDir, "%(title).80B.%(ext)s");

    const downloadArgs = ytDlpBaseArgs().concat([
      "-f",
      format,
      "--no-warnings",
      "--no-playlist",
      "--merge-output-format",
      "mp4",
      "--restrict-filenames",
      "-o",
      outTemplate,
      url
    ]);

    try {
      await runYtDlp(downloadArgs);
    } catch (mergeError) {
      // Without a successful merge, retry a progressive (single-file) format.
      if (preferAudio) throw mergeError;
      cleanupDir(tempDir);
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ytdlp-"));
      const fallbackOut = path.join(tempDir, "%(title).80B.%(ext)s");
      await runYtDlp(
        ytDlpBaseArgs().concat([
          "-f",
          "b[ext=mp4]/best[ext=mp4]/b/best",
          "--no-warnings",
          "--no-playlist",
          "--restrict-filenames",
          "-o",
          fallbackOut,
          url
        ])
      );
    }

    const chosen = pickDownloadedFile(tempDir, preferAudio);
    if (!chosen) {
      throw new Error("Download produced no file");
    }

    const filePath = path.join(tempDir, chosen);
    const downloadName = safeFileName(chosen, preferAudio ? "audio.m4a" : "video.mp4");

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename*=UTF-8''" + encodeURIComponent(downloadName)
    );

    const stream = fs.createReadStream(filePath);
    stream.on("error", function () {
      if (!res.headersSent) res.status(500).end();
      cleanupDir(tempDir);
      tempDir = "";
    });
    stream.on("close", function () {
      cleanupDir(tempDir);
      tempDir = "";
    });
    res.on("close", function () {
      if (tempDir) cleanupDir(tempDir);
    });
    stream.pipe(res);
  } catch (error) {
    if (tempDir) cleanupDir(tempDir);
    const status = error.status || 500;
    if (!res.headersSent) {
      res.status(status).json({
        ok: false,
        error: error && error.message ? error.message : "Download failed"
      });
    }
  }
});

ensureYtDlp()
  .then(function () {
    return ensureFfmpeg().catch(function (err) {
      console.warn("ffmpeg setup warning:", err.message || err);
      console.warn("Video+audio merge may fail until ffmpeg is available.");
    });
  })
  .then(function () {
    app.listen(PORT, "127.0.0.1", function () {
      console.log("yt-dlp local API listening on http://127.0.0.1:" + PORT);
      console.log("Open http://127.0.0.1:" + PORT + "/ for the download UI (avoids HTTPS mixed-content blocks).");
    });
  })
  .catch(function (err) {
    console.error("Failed to prepare yt-dlp:", err.message || err);
    process.exit(1);
  });
