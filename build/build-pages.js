/*
 * Generates the static info pages in every supported language.
 *
 *   node build/build-pages.js
 *
 * Korean is written to the repository root so existing URLs keep working;
 * every other language is written to its own directory (en/, es/, ...).
 * Edit build/chrome.json and build/pages/*.json, never the generated HTML.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PAGES_DIR = path.join(__dirname, "pages");

// Change this one line when the site moves to its own domain.
const BASE_URL = "https://mouseclick0.github.io/web-app/";

const BRAND = "WebToolBay";
const DEFAULT_LANG = "ko";
const LANGS = ["ko", "en", "ja", "zh-Hans", "zh-Hant", "es", "pt-BR"];
const PAGE_FILES = ["about", "faq", "contact", "privacy", "terms"];

// Pages that exist in every language, so links between them stay in the same folder.
const SIBLINGS = new Set([
  "about.html",
  "faq.html",
  "contact.html",
  "privacy.html",
  "terms.html"
]);

const GUIDE_PAGES = [
  "guides/index.html",
  "guides/overview.html",
  "guides/weather.html",
  "guides/calendar.html",
  "guides/ip.html",
  "guides/ocr.html",
  "guides/convert.html",
  "guides/editor.html",
  "guides/picker.html",
  "guides/speech.html",
  "guides/lotto.html",
  "guides/games.html",
  "guides/chess.html"
];

const EOL = "\r\n";
const chrome = readJson(path.join(__dirname, "chrome.json"));

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function esc(s) {
  return String(s)
    .replace(/&(?![a-zA-Z#0-9]+;)/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function attr(s) {
  return String(s).replace(/&(?![a-zA-Z#0-9]+;)/g, "&amp;").replace(/"/g, "&quot;");
}

/* Content is authored with root-relative links; rewrite them for the output folder. */
function rewrite(html, prefix) {
  return String(html).replace(/href="([^"]+)"/g, function (m, href) {
    if (/^(https?:|mailto:|#|\/)/.test(href)) return m;
    if (SIBLINGS.has(href)) return m;
    return 'href="' + prefix + href + '"';
  });
}

function pageUrl(lang, file) {
  return BASE_URL + (lang === DEFAULT_LANG ? "" : lang + "/") + file;
}

function renderBlocks(blocks, prefix) {
  const out = [];
  for (const b of blocks) {
    if (b.t === "lead") {
      out.push('      <p class="lead">' + rewrite(b.x, prefix) + "</p>");
    } else if (b.t === "p") {
      out.push("      <p>" + rewrite(b.x, prefix) + "</p>");
    } else if (b.t === "h2") {
      out.push("", "      <h2>" + esc(b.x) + "</h2>");
    } else if (b.t === "ul") {
      out.push("      <ul>");
      for (const item of b.items) {
        out.push("        <li>" + rewrite(item, prefix) + "</li>");
      }
      out.push("      </ul>");
    } else if (b.t === "cta") {
      out.push("", '      <div class="cta-row">');
      for (const l of b.links) {
        out.push(
          '        <a class="btn' +
            (l.primary ? " btn-primary" : "") +
            '" href="' +
            attr(SIBLINGS.has(l.href) ? l.href : prefix + l.href) +
            '">' +
            esc(l.label) +
            "</a>"
        );
      }
      out.push("      </div>");
    } else if (b.t === "qa") {
      out.push("", "      <h2>" + esc(b.q) + "</h2>");
      out.push("      <p>" + rewrite(b.a, prefix) + "</p>");
    } else if (b.t === "form") {
      out.push(renderForm(b));
    } else {
      throw new Error("unknown block type: " + b.t);
    }
  }
  return out.join(EOL);
}

/* Question/answer pages get FAQPage markup so search engines can show rich results. */
function faqJsonLd(blocks) {
  const qas = blocks.filter(function (b) {
    return b.t === "qa";
  });
  if (!qas.length) return null;
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: qas.map(function (b) {
      return {
        "@type": "Question",
        name: b.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: String(b.a).replace(/<[^>]+>/g, "")
        }
      };
    })
  };
  return (
    '  <script type="application/ld+json">' +
    EOL +
    JSON.stringify(data, null, 2)
      .split("\n")
      .map(function (l) {
        return "  " + l;
      })
      .join(EOL) +
    EOL +
    "  </" +
    "script>"
  );
}

function renderForm(b) {
  return [
    "",
    '      <form class="contact-form" id="contactPageForm" action="' +
      attr(b.action) +
      '" method="POST">',
    '        <input type="hidden" name="_subject" value="' + attr(b.subject) + '" />',
    "        <label>",
    "          " + esc(b.nameLabel),
    '          <input name="name" type="text" autocomplete="name" required />',
    "        </label>",
    "        <label>",
    "          " + esc(b.emailLabel),
    '          <input name="email" type="email" autocomplete="email" required />',
    "        </label>",
    "        <label>",
    "          " + esc(b.messageLabel),
    '          <textarea name="message" required placeholder="' +
      attr(b.messagePlaceholder) +
      '"></textarea>',
    "        </label>",
    '        <button class="btn btn-primary" type="submit" id="contactPageSubmit">' +
      esc(b.submitLabel) +
      "</button>",
    '        <p class="form-status" id="contactPageStatus" aria-live="polite"></p>',
    "      </form>"
  ].join(EOL);
}

function langSwitcher(lang, file) {
  // Relative targets so the switcher keeps working under any domain or subpath.
  const prefix = lang === DEFAULT_LANG ? "" : "../";
  const opts = LANGS.map(function (l) {
    const href = prefix + (l === DEFAULT_LANG ? "" : l + "/") + file;
    return (
      '        <option value="' +
      attr(l) +
      '" data-href="' +
      attr(href) +
      '"' +
      (l === lang ? " selected" : "") +
      ">" +
      esc(chrome.languageNames[l]) +
      "</option>"
    );
  });
  return [
    '      <select class="page-lang-select" id="pageLangSelect" aria-label="' +
      attr(chrome.strings[lang].langAria) +
      '">',
    opts.join(EOL),
    "      </select>"
  ].join(EOL);
}

/*
 * Offers the visitor their browser language instead of redirecting them.
 * Automatic redirects would stop crawlers from reaching every translation,
 * so the choice stays with the reader and the banner speaks the target language.
 */
function langHintScript(lang) {
  return [
    "    (function () {",
    "      var PAGE_LANG = " + JSON.stringify(lang) + ";",
    "      var HINTS = " + JSON.stringify(chrome.hint) + ";",
    "      try {",
    '        if (localStorage.getItem("web-pages-lang-picked")) return;',
    '        if (localStorage.getItem("web-pages-lang-hint") === "off") return;',
    "      } catch (e) {}",
    "",
    "      var HANT = /(^|-)(hant|tw|hk|mo)(-|$)/;",
    "      function normalize(code) {",
    '        var c = String(code || "").toLowerCase().replace(/_/g, "-");',
    '        var base = c.split("-")[0];',
    '        if (base === "ko") return "ko";',
    '        if (base === "en") return "en";',
    '        if (base === "ja") return "ja";',
    '        if (base === "es") return "es";',
    '        if (base === "pt") return "pt-BR";',
    '        if (base === "zh") return HANT.test(c) ? "zh-Hant" : "zh-Hans";',
    '        if (base === "yue") return /hans|-cn(-|$)/.test(c) ? "zh-Hans" : "zh-Hant";',
    "        return null;",
    "      }",
    "",
    "      var list = navigator.languages && navigator.languages.length",
    "        ? navigator.languages",
    "        : navigator.language ? [navigator.language] : [];",
    "      var want = null;",
    "      for (var i = 0; i < list.length && !want; i++) want = normalize(list[i]);",
    "      // Unsupported languages get the English offer, matching the single-page app.",
    '      if (!want) want = "en";',
    "      if (want === PAGE_LANG || !HINTS[want]) return;",
    "",
    '      var sel = document.getElementById("pageLangSelect");',
    '      var opt = sel && sel.querySelector(\'option[value="\' + want + \'"]\');',
    "      if (!opt) return;",
    "",
    "      var text = HINTS[want];",
    '      var bar = document.createElement("div");',
    '      bar.className = "lang-hint";',
    '      bar.setAttribute("lang", want);',
    '      var msg = document.createElement("p");',
    "      msg.textContent = text.suggest;",
    '      var go = document.createElement("a");',
    '      go.className = "lang-hint-go";',
    '      go.href = opt.getAttribute("data-href");',
    "      go.textContent = text.view;",
    '      go.addEventListener("click", function () {',
    "        try {",
    '          localStorage.setItem("web-pages-lang", want);',
    '          localStorage.setItem("web-pages-lang-picked", "1");',
    "        } catch (e) {}",
    "      });",
    '      var close = document.createElement("button");',
    '      close.type = "button";',
    '      close.className = "lang-hint-close";',
    '      close.setAttribute("aria-label", text.dismiss);',
    '      close.textContent = "\\u00d7";',
    '      close.addEventListener("click", function () {',
    "        try {",
    '          localStorage.setItem("web-pages-lang-hint", "off");',
    "        } catch (e) {}",
    "        bar.remove();",
    "      });",
    "",
    "      bar.appendChild(msg);",
    "      bar.appendChild(go);",
    "      bar.appendChild(close);",
    "      document.body.insertBefore(bar, document.body.firstChild);",
    "    })();"
  ].join(EOL);
}

function head(lang, file, page, content) {
  const prefix = lang === DEFAULT_LANG ? "" : "../";
  const alternates = LANGS.map(function (l) {
    return (
      '  <link rel="alternate" hreflang="' +
      attr(l) +
      '" href="' +
      attr(pageUrl(l, file)) +
      '" />'
    );
  });
  alternates.push(
    '  <link rel="alternate" hreflang="x-default" href="' +
      attr(pageUrl(DEFAULT_LANG, file)) +
      '" />'
  );

  const lines = [
    "<!DOCTYPE html>",
    '<html lang="' + attr(lang) + '">',
    "<head>",
    '  <meta charset="UTF-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    "  <title>" + esc(content.title) + " | " + BRAND + "</title>",
    '  <meta name="description" content="' + attr(content.description) + '" />',
    '  <link rel="canonical" href="' + attr(pageUrl(lang, file)) + '" />',
    alternates.join(EOL),
    '  <link rel="preconnect" href="https://fonts.googleapis.com" />',
    '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
    '  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@500;700&family=Noto+Sans+KR:wght@400;600;700&display=swap" rel="stylesheet" />',
    '  <link rel="stylesheet" href="' + prefix + 'site.css" />'
  ];
  if (page.extraStyle) lines.push("  <style>" + EOL + page.extraStyle + EOL + "  </style>");
  lines.push("</head>");
  return lines.join(EOL);
}

function buildPage(page, lang) {
  const file = page.file;
  const prefix = lang === DEFAULT_LANG ? "" : "../";
  const c = page.langs[lang];
  if (!c) throw new Error(page.file + " is missing the " + lang + " translation");
  const s = chrome.strings[lang];

  const parts = [
    head(lang, file, page, c),
    "<body>",
    '  <header class="site-header">',
    '    <div class="site-header-inner">',
    '      <a class="site-brand" href="' + prefix + 'index.html">' + BRAND + "</a>",
    '      <nav class="site-nav" aria-label="' + attr(s.navAria) + '">',
    '        <a href="' + prefix + 'index.html">' + esc(s.home) + "</a>",
    '        <a href="' + prefix + 'guides/index.html">' + esc(s.guides) + "</a>",
    '        <a href="faq.html">' + esc(s.faq) + "</a>",
    '        <a href="about.html">' + esc(s.about) + "</a>",
    '        <a href="contact.html">' + esc(s.contact) + "</a>",
    "      </nav>",
    langSwitcher(lang, file),
    "    </div>",
    "  </header>",
    "",
    '  <main class="site-main">',
    '    <p class="breadcrumb"><a href="' +
      prefix +
      'index.html">' +
      esc(s.home) +
      "</a> · " +
      esc(c.breadcrumb) +
      "</p>",
    '    <article class="article-card">',
    "      <h1>" + esc(c.h1) + "</h1>",
    renderBlocks(c.blocks, prefix),
    "    </article>",
    "  </main>",
    ""
  ];

  const jsonLd = faqJsonLd(c.blocks);
  if (jsonLd) parts.push(jsonLd, "");

  parts.push(
    '  <footer class="site-footer">',
    '    <div class="site-footer-inner">',
    '      <nav aria-label="' + attr(s.footerNavAria) + '">',
    '        <a href="about.html">' + esc(s.about) + "</a>",
    '        <a href="' + prefix + 'guides/index.html">' + esc(s.guides) + "</a>",
    '        <a href="faq.html">' + esc(s.faq) + "</a>",
    '        <a href="privacy.html">' + esc(s.privacy) + "</a>",
    '        <a href="terms.html">' + esc(s.terms) + "</a>",
    '        <a href="contact.html">' + esc(s.contact) + "</a>",
    "      </nav>",
    '      <p>© <span id="y"></span> ' +
      BRAND +
      (c.footerNote ? ". " + esc(c.footerNote) : "") +
      "</p>",
    "    </div>",
    "  </footer>",
    "  <script>",
    '    document.getElementById("y").textContent = new Date().getFullYear();',
    "    (function () {",
    "      // This page's language comes from its URL, so carry it over to the single-page app.",
    "      try {",
    '        localStorage.setItem("web-pages-lang", ' + JSON.stringify(lang) + ");",
    "      } catch (e) {}",
    '      var sel = document.getElementById("pageLangSelect");',
    "      if (!sel) return;",
      '      sel.addEventListener("change", function () {',
    "        var opt = sel.options[sel.selectedIndex];",
    "        try {",
    '          localStorage.setItem("web-pages-lang", sel.value);',
    '          localStorage.setItem("web-pages-lang-picked", "1");',
    "        } catch (e) {}",
    '        window.location.href = opt.getAttribute("data-href");',
    "      });",
    "    })();",
    langHintScript(lang)
  );

  if (page.formScript) {
    parts.push(formScript(c));
  }
  parts.push("  </script>", "</body>", "</html>", "");
  return parts.join(EOL);
}

function formScript(c) {
  const f = c.blocks.find(function (b) {
    return b.t === "form";
  });
  if (!f) throw new Error("formScript requested but no form block found");
  return [
    "    (function () {",
    '      var form = document.getElementById("contactPageForm");',
    '      var status = document.getElementById("contactPageStatus");',
    '      var btn = document.getElementById("contactPageSubmit");',
    "      if (!form) return;",
    '      form.addEventListener("submit", async function (e) {',
    "        e.preventDefault();",
    "        btn.disabled = true;",
    '        status.className = "form-status";',
    "        status.textContent = " + JSON.stringify(f.sending) + ";",
    "        try {",
    "          var res = await fetch(form.action, {",
    '            method: "POST",',
    "            body: new FormData(form),",
    '            headers: { Accept: "application/json" }',
    "          });",
    "          if (res.ok) {",
    "            form.reset();",
    '            status.className = "form-status ok";',
    "            status.textContent = " + JSON.stringify(f.success) + ";",
    "          } else {",
    '            status.className = "form-status error";',
    "            status.textContent = " + JSON.stringify(f.failure) + ";",
    "          }",
    "        } catch (err) {",
    '          status.className = "form-status error";',
    "          status.textContent = " + JSON.stringify(f.networkError) + ";",
    "        }",
    "        btn.disabled = false;",
    "      });",
    "    })();"
  ].join(EOL);
}

function buildSitemap() {
  const urls = [
    { loc: BASE_URL, freq: "weekly", pri: "1.0" },
    { loc: BASE_URL + "index.html", freq: "weekly", pri: "1.0" }
  ];
  for (const name of PAGE_FILES) {
    for (const lang of LANGS) {
      urls.push({
        loc: pageUrl(lang, name + ".html"),
        freq: "monthly",
        pri: lang === DEFAULT_LANG ? "0.8" : "0.6"
      });
    }
  }
  for (const g of GUIDE_PAGES) {
    urls.push({
      loc: BASE_URL + g,
      freq: "monthly",
      pri: g === "guides/index.html" ? "0.9" : "0.8"
    });
  }
  const body = urls
    .map(function (u) {
      return (
        "  <url><loc>" +
        u.loc +
        "</loc><changefreq>" +
        u.freq +
        "</changefreq><priority>" +
        u.pri +
        "</priority></url>"
      );
    })
    .join(EOL);
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    EOL +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    EOL +
    body +
    EOL +
    "</urlset>" +
    EOL
  );
}

function main() {
  // Pass page names to rebuild a subset, e.g. `node build/build-pages.js faq`.
  const only = process.argv.slice(2);
  const targets = only.length ? only : PAGE_FILES;
  const written = [];
  for (const name of targets) {
    const page = readJson(path.join(PAGES_DIR, name + ".json"));
    for (const lang of LANGS) {
      const dir = lang === DEFAULT_LANG ? ROOT : path.join(ROOT, lang);
      fs.mkdirSync(dir, { recursive: true });
      const out = path.join(dir, page.file);
      fs.writeFileSync(out, buildPage(page, lang), "utf8");
      written.push(path.relative(ROOT, out).replace(/\\/g, "/"));
    }
  }
  fs.writeFileSync(path.join(ROOT, "sitemap.xml"), buildSitemap(), "utf8");
  written.push("sitemap.xml");

  console.log("generated " + written.length + " files:");
  for (const w of written) console.log("  " + w);
}

main();
