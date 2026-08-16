# Local media API (yt-dlp + AI cutout + Ghibli)

Local Node server for:

1. **YouTube / video download** via [yt-dlp](https://github.com/yt-dlp/yt-dlp)
2. **Image background removal (누끼)** via [`@imgly/background-removal-node`](https://www.npmjs.com/package/@imgly/background-removal-node) (ONNX AI)
3. **Ghibli-style conversion** via AnimeGANv2 Hayao ONNX (`onnxruntime-node` + `sharp`)

GitHub Pages only hosts the static UI. Run this server on your PC for downloads, cutout, and Ghibli conversion.

> **Important:** Browsers block `http://127.0.0.1` from HTTPS GitHub Pages (mixed content). Open **http://127.0.0.1:8787/** served by this server.

## Setup

```bash
cd server
npm install
npm start
```

- First run downloads yt-dlp (and ffmpeg on Windows) into `server/bin/`.
- First cutout run downloads the ONNX cutout model (cached afterward).
- First Ghibli run downloads `AnimeGANv2_Hayao.onnx` into `server/models/` (CPU inference; larger images are slower).
- API + site: `http://127.0.0.1:8787/`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Server health, yt-dlp, cutout, ghibli flags |
| POST | `/api/info` | Video metadata |
| GET | `/api/download?url=&format=` | Video file (MP4) |
| POST | `/api/cutout` | multipart `image` + optional `model=medium\|small` → PNG |
| POST | `/api/ghibli` | multipart `image` + optional `style=hayao` → PNG |

## Cutout model

Uses **IMG.LY background-removal ONNX** (`medium` by default for best quality; `small` for speed).  
Much better than simple color-keying for people, hair, products, and busy backgrounds.

## Ghibli model

Uses **AnimeGANv2 Hayao** (anime / Hayao-like look, not full Studio Ghibli diffusion quality).  
Images are resized to 512×512 for inference, then scaled back to the original aspect.

## Front-end

1. `npm start`
2. Open `http://127.0.0.1:8787/`
3. Use owner/local tools (video, cutout, Ghibli) — or open the site with `?owner=1` when testing from static hosting patterns that hide local-only cards.
