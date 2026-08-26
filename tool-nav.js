/* Shared open/back helpers for tool pages and the homepage hub. */
(function (w) {
  function isToolLink(el) {
    if (!el || el.tagName !== "A") return false;
    var href = el.getAttribute("href") || "";
    return /(^|\/)tools\/[^"'?#]+\.html(?:[?#]|$)/.test(href);
  }

  function homeHref() {
    return "index.html";
  }

  function backHome(openBtn) {
    if (w.__WTB_TOOL_PAGE__) {
      w.location.href = homeHref();
      return;
    }
    var home = document.getElementById("homeView");
    if (typeof w.showView === "function" && home) w.showView(home);
    if (openBtn && typeof openBtn.focus === "function") openBtn.focus();
  }

  function showToolView(view) {
    if (typeof w.showView === "function") w.showView(view);
    else {
      document.querySelectorAll("main").forEach(function (m) {
        m.hidden = m !== view;
      });
    }
  }

  function wireToolPage(options) {
    var name = options.name;
    var openBtn = options.openBtn;
    var view = options.view;
    var onOpen = options.onOpen;
    if (!view) return;

    function open() {
      showToolView(view);
      if (typeof onOpen === "function") onOpen();
    }

    if (openBtn && !isToolLink(openBtn)) {
      openBtn.addEventListener("click", open);
    }

    if (options.backBtn) {
      options.backBtn.addEventListener("click", function () {
        if (typeof options.onBack === "function") options.onBack();
        backHome(openBtn);
      });
    }

    if (w.__WTB_INITIAL_VIEW__ === name) open();
  }

  w.wtbIsToolLink = isToolLink;
  w.wtbBackHome = backHome;
  w.wtbShowToolView = showToolView;
  w.wtbWireToolPage = wireToolPage;
})(window);
