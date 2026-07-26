"use strict";

const fs = require("fs");
const https = require("https");
const path = require("path");
const { spawnSync } = require("child_process");
const { BIN_DIR } = require("./ensure-ytdlp");

const isWin = process.platform === "win32";
const FFMPEG_NAME = isWin ? "ffmpeg.exe" : "ffmpeg";
const FFMPEG_PATH = path.join(BIN_DIR, FFMPEG_NAME);

const WIN_ZIP_URL =
  "https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip";

function downloadFile(url, dest) {
  return new Promise(function (resolve, reject) {
    const file = fs.createWriteStream(dest);
    https
      .get(url, { headers: { "User-Agent": "web-app-ytdlp-server" } }, function (res) {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlink(dest, function () {});
          downloadFile(res.headers.location, dest).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlink(dest, function () {});
          reject(new Error("Failed to download ffmpeg (" + res.statusCode + ")"));
          return;
        }
        res.pipe(file);
        file.on("finish", function () {
          file.close(resolve);
        });
      })
      .on("error", function (err) {
        file.close();
        fs.unlink(dest, function () {});
        reject(err);
      });
  });
}

function findFfmpegOnPath() {
  const which = spawnSync(isWin ? "where" : "which", ["ffmpeg"], { encoding: "utf8" });
  if (which.status !== 0) return "";
  return (
    String(which.stdout || "")
      .split(/\r?\n/)
      .map(function (line) {
        return line.trim();
      })
      .filter(Boolean)[0] || ""
  );
}

function extractWinZip(zipPath, destDir) {
  const ps = [
    "$ErrorActionPreference = 'Stop'",
    "Expand-Archive -LiteralPath '" + zipPath.replace(/'/g, "''") + "' -DestinationPath '" + destDir.replace(/'/g, "''") + "' -Force"
  ].join("; ");
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", ps],
    { encoding: "utf8", windowsHide: true }
  );
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "Expand-Archive failed").trim().slice(0, 300));
  }
}

function findExtractedFfmpeg(rootDir) {
  const stack = [rootDir];
  while (stack.length) {
    const dir = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      continue;
    }
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile() && entry.name.toLowerCase() === FFMPEG_NAME.toLowerCase()) {
        return full;
      }
    }
  }
  return "";
}

async function ensureFfmpeg() {
  if (fs.existsSync(FFMPEG_PATH)) {
    return FFMPEG_PATH;
  }

  const onPath = findFfmpegOnPath();
  if (onPath) {
    return onPath;
  }

  fs.mkdirSync(BIN_DIR, { recursive: true });

  if (!isWin) {
    throw new Error(
      "ffmpeg not found. Install ffmpeg and ensure it is on PATH, then restart the server."
    );
  }

  console.log("Downloading ffmpeg (needed to merge YouTube video+audio)...");
  const zipPath = path.join(BIN_DIR, "ffmpeg-download.zip");
  const extractDir = path.join(BIN_DIR, "ffmpeg-extract");
  await downloadFile(WIN_ZIP_URL, zipPath);
  fs.rmSync(extractDir, { recursive: true, force: true });
  fs.mkdirSync(extractDir, { recursive: true });
  extractWinZip(zipPath, extractDir);

  const found = findExtractedFfmpeg(extractDir);
  if (!found) {
    throw new Error("ffmpeg.exe not found inside downloaded archive");
  }
  fs.copyFileSync(found, FFMPEG_PATH);

  try {
    fs.unlinkSync(zipPath);
  } catch (e) {}
  try {
    fs.rmSync(extractDir, { recursive: true, force: true });
  } catch (e) {}

  console.log("Saved " + FFMPEG_PATH);
  return FFMPEG_PATH;
}

function getFfmpegPath() {
  if (fs.existsSync(FFMPEG_PATH)) return FFMPEG_PATH;
  return findFfmpegOnPath() || FFMPEG_PATH;
}

module.exports = {
  FFMPEG_PATH,
  ensureFfmpeg,
  getFfmpegPath
};

if (require.main === module) {
  ensureFfmpeg()
    .then(function (p) {
      console.log("ffmpeg ready:", p);
    })
    .catch(function (err) {
      console.error(err.message || err);
      process.exit(1);
    });
}
