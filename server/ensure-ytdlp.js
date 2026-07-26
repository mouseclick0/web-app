"use strict";

const fs = require("fs");
const https = require("https");
const path = require("path");
const { spawnSync } = require("child_process");

const BIN_DIR = path.join(__dirname, "bin");
const isWin = process.platform === "win32";
const BINARY_NAME = isWin ? "yt-dlp.exe" : "yt-dlp";
const BINARY_PATH = path.join(BIN_DIR, BINARY_NAME);

const DOWNLOAD_URL = isWin
  ? "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
  : process.platform === "darwin"
    ? "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos"
    : "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp";

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
          reject(new Error("Failed to download yt-dlp (" + res.statusCode + ")"));
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

async function ensureYtDlp() {
  fs.mkdirSync(BIN_DIR, { recursive: true });
  if (!fs.existsSync(BINARY_PATH)) {
    console.log("Downloading yt-dlp binary...");
    await downloadFile(DOWNLOAD_URL, BINARY_PATH);
    if (!isWin) {
      fs.chmodSync(BINARY_PATH, 0o755);
    }
    console.log("Saved " + BINARY_PATH);
  }
  return BINARY_PATH;
}

function getYtDlpPath() {
  if (fs.existsSync(BINARY_PATH)) return BINARY_PATH;
  const which = spawnSync(isWin ? "where" : "which", ["yt-dlp"], { encoding: "utf8" });
  if (which.status === 0) {
    const first = String(which.stdout || "")
      .split(/\r?\n/)
      .map(function (line) {
        return line.trim();
      })
      .filter(Boolean)[0];
    if (first) return first;
  }
  return BINARY_PATH;
}

module.exports = {
  BIN_DIR,
  BINARY_PATH,
  ensureYtDlp,
  getYtDlpPath
};

if (require.main === module) {
  ensureYtDlp()
    .then(function () {
      console.log("yt-dlp ready");
    })
    .catch(function (err) {
      console.error(err.message || err);
      process.exit(1);
    });
}
