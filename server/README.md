# Local development server (not public)

This folder is for **local development on your own computer only**.

- It is **not** part of the public WebToolBay site at [webtoolbay.com](https://webtoolbay.com/).
- Visitors use the hosted tools under `/tools/` on GitHub Pages. No account or local install is required.
- `/server/` is blocked in `robots.txt` and should not be linked from public pages.

## For maintainers

If you work on this repository locally and need the Node server:

```bash
cd server
npm install
npm start
```

The process listens on the port set in `index.js` (default in that file). Use it only on your machine for development and testing.

Do not expose this server to the public internet. Production traffic should use the static site and browser-based tools only.
