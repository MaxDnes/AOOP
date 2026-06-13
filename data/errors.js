/* ============ ERROR DECODER · UI module ============
   window.ERRORS = { render, init }; short alias window.ED for onclick handlers.
   Pure string rendering; all data + matching lives in data/errors-core.js
   (window.ERRORS_CORE).

   Paste the red error text from `dotnet build` / the IDE and get the plain-
   English cause + exact fix + which file. Or search / browse by category.
*/
(function (global) {
"use strict";

var CORE = function () { return global.ERRORS_CORE; };

var state = null;
function defaults() { return { paste: "", query: "", cat: "all" }; }
function ensureState() {
  if (state) return;
  try { state = JSON.parse(localStorage.getItem("aop-errors") || "null"); } catch (e) { state = null; }
  if (!state || typeof state !== "object") state = defaults();
  var d = defaults();
  Object.keys(d).forEach(function (k) { if (state[k] == null) state[k] = d[k]; });
}
function save() { try { localStorage.setItem("aop-errors", JSON.stringify(state)); } catch (e) {} }

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
/* escape, then turn `backtick` spans into <code> */
function fmt(s) {
  return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');
}

function catLabel(key) {
  var c = (CORE() ? CORE().CATEGORIES : []).find(function (x) { return x.key === key; });
  return c ? c.label : key;
}

/* ---------------- render ---------------- */
function render() {
  ensureState();
  var h = '<div class="content-inner content-wide">';

  h += '<div class="crumb"><b>ERROR DECODER</b></div>';
  h += '<h1 class="topic-title">It went red — now what</h1>';
  h += '<p class="ed-sub">No internet, no AI in the exam, so this is your offline lookup for the build and runtime errors that actually happen in this stack (.NET 9, Avalonia, CommunityToolkit.Mvvm, xUnit, System.Text.Json). Paste the red error text and I\'ll find the cause, the exact fix, and which file to touch.</p>';

  h += '<div class="ed-pastebox">';
  h += '<div class="ed-step">Paste the error</div>';
  h += '<textarea class="ed-ta" id="ed-paste" spellcheck="false" placeholder="// paste the red line(s) from dotnet build / dotnet test / the IDE — e.g. error CS0246: The type or namespace name \'ObservableObject\' could not be found" oninput="ED.setPaste(this.value)">' + esc(state.paste) + "</textarea>";
  h += '<button class="ed-btn" onclick="ED.clearPaste()">✕ clear</button>';
  h += "</div>";

  h += '<div class="ed-searchrow">';
  h += '<input class="ed-search" id="ed-search" type="text" spellcheck="false" autocomplete="off" placeholder="…or search: CS0246, headless, nuget, binding, thread, nullable…" value="' + esc(state.query) + '" oninput="ED.setQuery(this.value)">';
  h += "</div>";

  h += '<div id="ed-cats">' + catsHTML() + "</div>";
  h += '<div id="ed-list">' + listHTML() + "</div>";

  h += "</div>";
  return h;
}

function catsHTML() {
  var cats = CORE() ? CORE().CATEGORIES : [];
  var inMatch = state.paste.trim().length > 0;
  var h = '<div class="ed-cats' + (inMatch ? " ed-cats-dim" : "") + '">';
  h += chip("all", "All");
  cats.forEach(function (c) { h += chip(c.key, c.label); });
  h += "</div>";
  return h;
}
function chip(key, label) {
  var on = state.cat === key;
  return '<button class="ed-chip' + (on ? " on" : "") + '" onclick="ED.setCat(\'' + key + '\')">' + esc(label) + "</button>";
}

function listHTML() {
  var core = CORE();
  if (!core) return '<div class="ed-empty">Error Decoder core not loaded.</div>';

  if (state.paste.trim()) {
    var matched = core.match(state.paste);
    var h = '<div class="ed-resulthead">Best matches for your error · ' + matched.length + "</div>";
    if (!matched.length) {
      h += '<div class="ed-empty">No match in the offline knowledge base for that text. Try a keyword in the search box, or browse a category below. The most common cause of an unknown error is a generated file still under the <code>ExamApp</code> namespace — run it through the <b>Adapt Lab</b>.</div>';
      return h;
    }
    matched.forEach(function (m) { h += entryCard(m.entry, m.why); });
    return h;
  }

  var base = core.search(state.query);
  if (state.cat !== "all") base = base.filter(function (e) { return e.cat === state.cat; });
  var head = '<div class="ed-resulthead">' + base.length + " error" + (base.length === 1 ? "" : "s") +
    (state.cat !== "all" ? " · " + esc(catLabel(state.cat)) : "") +
    (state.query.trim() ? ' · matching "' + esc(state.query.trim()) + '"' : "") + "</div>";
  if (!base.length) return head + '<div class="ed-empty">Nothing matches that. Clear the search or pick a different category.</div>';
  var out = head;
  base.forEach(function (e) { out += entryCard(e, []); });
  return out;
}

function entryCard(e, why) {
  var h = '<div class="ed-card ed-cat-' + esc(e.cat) + '">';
  h += '<div class="ed-card-head">';
  if (e.code) h += '<span class="ed-code">' + esc(e.code) + "</span>";
  h += '<span class="ed-cat-badge">' + esc(catLabel(e.cat)) + "</span>";
  h += '<span class="ed-title">' + esc(e.title) + "</span>";
  h += "</div>";
  if (why && why.length) {
    h += '<div class="ed-why">matched: ' + why.map(function (w) { return esc(w); }).join(", ") + "</div>";
  }
  h += '<div class="ed-row"><span class="ed-lbl">Why</span><span class="ed-val">' + fmt(e.cause) + "</span></div>";
  h += '<div class="ed-row"><span class="ed-lbl ed-lbl-fix">Fix</span><span class="ed-val">' + fmt(e.fix) + "</span></div>";
  h += '<div class="ed-row"><span class="ed-lbl">File</span><span class="ed-val ed-file">' + esc(e.file) + "</span></div>";
  return h + "</div>";
}

function init() { ensureState(); }

/* ---------------- repaint (no-op without a DOM, so handlers are headless-safe) ---------------- */
function paintList() { if (typeof document === "undefined") return; var el = document.getElementById("ed-list"); if (el) el.innerHTML = listHTML(); }
function paintCats() { if (typeof document === "undefined") return; var el = document.getElementById("ed-cats"); if (el) el.innerHTML = catsHTML(); }

/* ---------------- handlers ---------------- */
function setPaste(v) { ensureState(); state.paste = v; save(); paintCats(); paintList(); }
function clearPaste() {
  ensureState(); state.paste = "";
  if (typeof document !== "undefined") { var el = document.getElementById("ed-paste"); if (el) el.value = ""; }
  save(); paintCats(); paintList();
}
function setQuery(v) { ensureState(); state.query = v; save(); paintList(); }
function setCat(k) { ensureState(); state.cat = k; save(); paintCats(); paintList(); }

var ED = { setPaste: setPaste, clearPaste: clearPaste, setQuery: setQuery, setCat: setCat };
var ERRORS = { render: render, init: init, listHTML: listHTML };

global.ERRORS = ERRORS;
global.ED = ED;
if (typeof module !== "undefined" && module.exports) module.exports = ERRORS;

})(typeof window !== "undefined" ? window : globalThis);
