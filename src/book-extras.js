/* Cover choice: "A" (margin line), "B" (tally marks) or "none" (typed title only) */
const COVER = "A";
document.documentElement.dataset.cover = COVER;

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

/* ---------------------------------------------------------------
   Malayalam search
   mdBook's built-in search drops Malayalam words from its word index,
   so Malayalam queries find nothing. The full chapter text is still
   stored in the search data, so for queries containing Malayalam we
   search that text directly (substring match) and show the results in
   the normal results box.
---------------------------------------------------------------- */
(function () {
    "use strict";
    var ML = /[ഀ-ൿ]/;
    var norm = function (s) { return s.replace(/[‌‍]/g, "").toLowerCase(); };
    var esc = function (s) {
        return s.replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    };

    function teaser(body, terms) {
        var nb = norm(body), pos = -1, i;
        for (i = 0; i < terms.length; i++) {
            var p = nb.indexOf(terms[i]);
            if (p !== -1 && (pos === -1 || p < pos)) pos = p;
        }
        if (pos === -1) pos = 0;
        // norm() only removes ZWNJ/ZWJ, so work on a ZWNJ-free copy of the body
        var clean = body.replace(/[‌‍]/g, "");
        var start = Math.max(0, pos - 70), end = Math.min(clean.length, pos + 150);
        var snip = clean.slice(start, end);
        var out = esc(snip);
        terms.forEach(function (t) {
            var te = esc(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            out = out.replace(new RegExp(te, "gi"), function (m) { return "<em>" + m + "</em>"; });
        });
        return (start > 0 ? "… " : "") + out + (end < clean.length ? " …" : "");
    }

    function run(q) {
        var data = window.search, store = data && data.index && data.index.documentStore;
        var list = document.getElementById("mdbook-searchresults");
        var head = document.getElementById("mdbook-searchresults-header");
        var outer = document.getElementById("mdbook-searchresults-outer");
        var bar = document.getElementById("mdbook-searchbar-outer");
        if (!store || !list) return;
        var terms = norm(q).split(/\s+/).filter(Boolean);
        var hits = [];
        Object.keys(store.docs).forEach(function (id) {
            var d = store.docs[id], nb = norm(d.body + " " + d.title), score = 0;
            for (var i = 0; i < terms.length; i++) {
                var from = 0, c = 0, p;
                while ((p = nb.indexOf(terms[i], from)) !== -1) { c++; from = p + terms[i].length; }
                if (!c) return;               // every word must appear
                score += c;
            }
            if (norm(d.title).indexOf(terms[0]) !== -1) score += 20;
            hits.push({ id: id, d: d, score: score });
        });
        hits.sort(function (a, b) { return b.score - a.score; });
        var shown = hits.slice(0, 30);
        head.innerText = shown.length === 0
            ? "No search results for '" + q + "'."
            : shown.length + " search result" + (shown.length === 1 ? "" : "s") + " for '" + q + "':";
        list.innerHTML = "";
        shown.forEach(function (h, n) {
            var u = data.doc_urls[h.id].split("#");
            var base = (window.path_to_root || "") + u[0];
            var li = document.createElement("li");
            li.innerHTML = '<a href="' + base + "?highlight=" + encodeURIComponent(q) + "#" + (u[1] || "") +
                '">' + h.d.breadcrumbs + '</a><span class="teaser">' + teaser(h.d.body, terms) + "</span>";
            list.appendChild(li);
        });
        if (outer) outer.classList.remove("hidden");
        if (bar) bar.classList.remove("searching");
    }

    function init() {
        var box = document.getElementById("mdbook-searchbar");
        if (!box) return;
        // mdBook re-renders its own (empty) results on every keyup, so run
        // after it on keyup; also on "input" for keyboards/IMEs that don't
        // send key events.
        function go() {
            var q = box.value.trim();
            if (ML.test(q)) run(q);
        }
        box.addEventListener("keyup", go);
        box.addEventListener("input", go);
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();
