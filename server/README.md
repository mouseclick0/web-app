# Local yt-dlp API

Downloads YouTube (and other) videos for the **유튜브 동영상 다운로드** page using [yt-dlp](https://github.com/yt-dlp/yt-dlp).

GitHub Pages only hosts the static UI. This Node server must run on your PC for real downloads.

> **Important:** Browsers block `http://127.0.0.1` calls from an HTTPS GitHub Pages site (mixed content). For downloads, open the UI served by this local server instead.

## Setup

```bash
cd server
npm install
npm start
```

- First run downloads the yt-dlp binary into `server/bin/` (ignored by git).
- API + site: `http://127.0.0.1:8787/`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Server + yt-dlp version |
| POST | `/api/info` | Body `{ "url": "..." }` → title, duration, format presets |
| GET | `/api/download?url=...&format=best\|1080\|720\|480\|audio` | File download |

## Front-end

1. Run `npm start` in this folder.
2. Open **http://127.0.0.1:8787/** in the browser.
3. Go to **유튜브 동영상 다운로드**.
4. Keep API URL as `http://127.0.0.1:8787`.
5. Paste a video URL → **불러오기** → choose quality → **다운로드**.

Optional: `PORT=9000 npm start` then set the same port in the page API field.

## Video has sound but no picture?

YouTube separates video and audio streams. Merging them needs **ffmpeg**.

This server downloads ffmpeg into `server/bin/` on first start (Windows). Restart with:

```bash
npm start
```

Then download again (choose 720p/1080p/Best — not Audio only).
