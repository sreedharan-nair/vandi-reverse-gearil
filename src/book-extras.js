/* Text-size buttons + reading progress bar for the book.
   Loaded through book.toml -> additional-js. */
(function () {
    "use strict";

    var KEY = "book-font-scale";
    var STEPS = [0.85, 0.95, 1, 1.1, 1.2, 1.35, 1.5];
    var root = document.documentElement;

    function load() {
        try {
            var v = parseFloat(localStorage.getItem(KEY));
            if (STEPS.indexOf(v) !== -1) return v;
        } catch (e) {}
        return 1;
    }
    function save(v) {
        try { localStorage.setItem(KEY, String(v)); } catch (e) {}
    }
    var scale = load();
    function apply() {
        root.style.setProperty("--book-scale", String(scale));
        var small = document.getElementById("font-smaller");
        var big = document.getElementById("font-larger");
        if (small) small.disabled = scale <= STEPS[0];
        if (big) big.disabled = scale >= STEPS[STEPS.length - 1];
    }
    function step(dir) {
        var i = STEPS.indexOf(scale) + dir;
        if (i < 0 || i >= STEPS.length) return;
        scale = STEPS[i];
        save(scale);
        apply();
    }
    apply(); // apply the saved size straight away

    function makeButton(id, label, title, handler) {
        var b = document.createElement("button");
        b.type = "button";
        b.id = id;
        b.className = "icon-button font-size-button";
        b.title = title;
        b.setAttribute("aria-label", title);
        b.textContent = label;
        b.addEventListener("click", handler);
        return b;
    }

    function init() {
        // --- text size buttons, placed at the start of the right-hand menu buttons
        var holder = document.querySelector(".menu-bar .right-buttons");
        if (holder && !document.getElementById("font-smaller")) {
            holder.insertBefore(
                makeButton("font-larger", "A+", "Larger text", function () { step(1); }),
                holder.firstChild
            );
            holder.insertBefore(
                makeButton("font-smaller", "A−", "Smaller text", function () { step(-1); }),
                holder.firstChild
            );
        }
        apply();

        // --- reading progress bar
        var bar = document.createElement("div");
        bar.id = "reading-progress";
        bar.setAttribute("role", "presentation");
        document.body.appendChild(bar);

        function update(el) {
            var max = el.scrollHeight - el.clientHeight;
            var p = max > 0 ? el.scrollTop / max : 0;
            bar.style.transform = "scaleX(" + Math.min(1, Math.max(0, p)) + ")";
        }
        // scroll events don't bubble, so listen in the capture phase and
        // react only to the page's own scrolling area (not the sidebar)
        document.addEventListener("scroll", function (e) {
            var t = e.target;
            if (t === document) {
                update(document.scrollingElement || root);
            } else if (t.classList && t.classList.contains("content")) {
                update(t);
            }
        }, true);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
