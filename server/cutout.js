"use strict";

const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: function (_req, file, cb) {
    if (!file.mimetype || file.mimetype.indexOf("image/") !== 0) {
      cb(new Error("Only image uploads are allowed"));
      return;
    }
    cb(null, true);
  }
});

let removeBackgroundFn = null;

async function getRemoveBackground() {
  if (removeBackgroundFn) return removeBackgroundFn;
  const mod = await import("@imgly/background-removal-node");
  removeBackgroundFn = mod.removeBackground || (mod.default && mod.default.removeBackground);
  if (!removeBackgroundFn) {
    throw new Error("@imgly/background-removal-node export not found");
  }
  return removeBackgroundFn;
}

function resolveModel(raw) {
  const model = String(raw || "medium").toLowerCase();
  return model === "small" ? "small" : "medium";
}

function registerCutoutRoutes(app) {
  app.post("/api/cutout", function (req, res) {
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

        const model = resolveModel(req.body && req.body.model);
        const removeBackground = await getRemoveBackground();

        // Pass a Blob — Windows file paths like C:\... break imgly ("Unsupported protocol: c:").
        const inputBlob = new Blob([req.file.buffer], {
          type: req.file.mimetype || "image/png"
        });

        const blob = await removeBackground(inputBlob, {
          model: model,
          debug: false,
          output: {
            format: "image/png",
            quality: 1,
            type: "foreground"
          }
        });

        const arrayBuffer = await blob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const baseName = String(req.file.originalname || "image")
          .replace(/\.[^.]+$/, "")
          .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
          .slice(0, 80) || "image";

        res.setHeader("Content-Type", "image/png");
        res.setHeader(
          "Content-Disposition",
          "attachment; filename=\"" + baseName + "-cutout.png\"; filename*=UTF-8''" + encodeURIComponent(baseName + "-cutout.png")
        );
        res.setHeader("Content-Length", String(buffer.length));
        res.send(buffer);
      } catch (error) {
        console.error("cutout error:", error);
        if (!res.headersSent) {
          res.status(500).json({
            ok: false,
            error: error && error.message ? error.message : "Background removal failed"
          });
        }
      }
    });
  });
}

module.exports = {
  registerCutoutRoutes,
  getRemoveBackground
};
