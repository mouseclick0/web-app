# Local media API (yt-dlp + AI cutout)

Local Node server for:

1. **YouTube / video download** via [yt-dlp](https://github.com/yt-dlp/yt-dlp)
2. **Image background removal (누끼)** via [`@imgly/background-removal-node`](https://www.npmjs.com/package/@imgly/background-removal-node) (ONNX AI)

GitHub Pages only hosts the static UI. Run this server on your PC for downloads and cutout.

> **Important:** Browsers block `http://127.0.0.1` from HTTPS GitHub Pages (mixed content). Open **http://127.0.0.1:8787/** served by this server.

## Setup

```bash
cd server
npm install
npm start
```

- First run downloads yt-dlp (and ffmpeg on Windows) into `server/bin/`.
- First cutout run downloads the ONNX model (cached afterward).
- API + site: `http://127.0.0.1:8787/`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Server health, yt-dlp, cutout flags |
| POST | `/api/info` | Video metadata |
| GET | `/api/download?url=&format=` | Video file (MP4) |
| POST | `/api/cutout` | multipart `image` + optional `model=medium\|small` → PNG |

## Cutout model

Uses **IMG.LY background-removal ONNX** (`medium` by default for best quality; `small` for speed).  
Much better than simple color-keying for people, hair, products, and busy backgrounds.

## Front-end

1. `npm start`
2. Open **http://127.0.0.1:8787/**
3. Use **유튜브 동영상 다운로드** or **이미지 누끼 제거**

Optional: `PORT=9000 npm start`

## Video has sound but no picture?

ffmpeg is required to merge YouTube video+audio. The server auto-downloads it on Windows into `server/bin/`. Restart `npm start` and download again (not Audio only).
