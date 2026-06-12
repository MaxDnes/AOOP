/* ============================================================
   AOP EXAM COMPANION · app engine
   No dependencies. Works from file:// fully offline.
   ============================================================ */

"use strict";

/* ---------------- categories (order + color) ---------------- */
const CATEGORIES = [
  { name: "3-Day Bootcamp",         color: "#7fd962" },
  { name: "Exam Playbooks",         color: "#e6b450" },
  { name: "Model Solutions",        color: "#7fd962" },
  { name: "Past Exams",             color: "#f07178" },
  { name: "Design Gallery",         color: "#f28fad" },
  { name: "OOP Fundamentals",       color: "#39bae6" },
  { name: "C# Language",            color: "#7fd962" },
  { name: "SOLID",                  color: "#d2a6ff" },
  { name: "Design Patterns",        color: "#d2a6ff" },
  { name: "Avalonia UI",            color: "#39bae6" },
  { name: "MVVM & Binding",         color: "#e6b450" },
  { name: "Collections & Generics", color: "#7fd962" },
  { name: "LINQ",                   color: "#7fd962" },
  { name: "Data & Files",           color: "#7fd962" },
  { name: "Threading & Async",      color: "#f07178" },
  { name: "Unit Testing",           color: "#39bae6" },
  { name: "Algorithms & Big-O",     color: "#d2a6ff" },
];

/* ---------------- tools registry (single source of truth) ----------------
   Every place that used to hardcode the tool list (router, nav, home cards,
   pin-button exclusion, boot whitelist, search pseudo-topics) reads THIS. */
const TOOLS = [
  { id: "guide",    label: "Exam Guide",      sub: "the 4-hour plan, tool by tool", icon: "★", color: "#e6b450", module: "GUIDE",
    homeTitle: "How to run the exam",
    homeDesc: "The 4-hour plan, tool by tool: which tool solves which problem, what to click, and what to hand in." },
  { id: "lab",      label: "Code Lab",        sub: "click any line, get the why",  icon: "⌬", color: "#39bae6", module: null,
    homeTitle: "Understand code, line by line",
    homeDesc: "The 9 exam-critical files. Click a line, get the why. Walk through with j / k." },
  { id: "builder",  label: "UI Builder",      sub: "tick features → full code",     icon: "⚒", color: "#e6b450", module: null,
    homeTitle: "Compose code from features",
    homeDesc: "Tick list / buttons / timer / canvas / JSON… get a complete ViewModel + AXAML, ready to paste." },
  { id: "designer", label: "Visual Designer", sub: "drag & drop → AXAML + VM",       icon: "⌗", color: "#7fd962", module: "DESIGNER",
    homeTitle: "Drag & drop → AXAML + VM",
    homeDesc: "Build the window visually: containers, controls, shapes, colors, bindings. Copy the generated MainWindow.axaml + ViewModel." },
  { id: "analyzer", label: "Analysis Lab",    sub: "paste code → violations + answer", icon: "⌖", color: "#f07178", module: "ANALYZER",
    homeTitle: "Paste code → violations + answer",
    homeDesc: "Paste the Problem 1 project, scan for OOP/SOLID violations, tick findings, get a full written-answer draft." },
  { id: "testlab",  label: "Test Lab",        sub: "paste code, get xUnit test proposals", icon: "⚗", color: "#39bae6", module: "TESTLAB",
    homeTitle: "Paste code → xUnit tests",
    homeDesc: "Paste a class or ViewModel, pick the kinds, get ready-to-paste xUnit files: plain, ViewModel, headless Avalonia, async, plus the exact-version csproj + runbook." },
  { id: "querylab", label: "Query Lab",       sub: "paste JSON, click queries, get Program.cs", icon: "⌹", color: "#7fd962", module: "QUERYLAB",
    homeTitle: "Paste JSON → LINQ → Program.cs",
    homeDesc: "Paste the Problem 4 JSON, click to build LINQ queries, and copy one complete Program.cs: null-safe deserialize, each query in order, console printing, and the exact-key results JSON." },
  { id: "asynclab", label: "Async Composer",  sub: "configure a worker, get the ViewModel", icon: "↻", color: "#d2a6ff", module: "ASYNCLAB",
    homeTitle: "Configure a worker → ViewModel",
    homeDesc: "Configure the Problem 3 async worker — pattern, mechanism, interval, commands — and get the complete MainWindowViewModel, plus matching AXAML and a headless xUnit test if you want them." },
  { id: "quiz",     label: "Quiz",            sub: "self-test, tracks weak spots",  icon: "?", color: "#d4bfff", module: "QUIZ",
    homeTitle: "Self-test, tracks weak spots",
    homeDesc: "100+ questions across all exam topics. Weak-topics mode resurfaces what you got wrong; exam-sim and drill modes too." },
];
const TOOL_IDS = TOOLS.map((t) => t.id);
function isToolRoute(id) {
  return TOOL_IDS.includes(id) || (id || "").indexOf("lab/") === 0;
}

const $ = (id) => document.getElementById(id);
const content = $("content");
const searchBox = $("search");

let current = null;            // current topic id or 'home'
let codeRegistry = [];         // raw code strings for copy buttons
let resultSel = 0;             // selected index in search results
let lastResults = [];

const store = {
  get pins() { try { return JSON.parse(localStorage.getItem("aop-pins") || "[]"); } catch { return []; } },
  set pins(v) { try { localStorage.setItem("aop-pins", JSON.stringify(v)); } catch {} },
  get recents() { try { return JSON.parse(localStorage.getItem("aop-recents") || "[]"); } catch { return []; } },
  set recents(v) { try { localStorage.setItem("aop-recents", JSON.stringify(v)); } catch {} },
  get tasks() { try { return JSON.parse(localStorage.getItem("aop-task-state") || "{}"); } catch { return {}; } },
  set tasks(v) { try { localStorage.setItem("aop-task-state", JSON.stringify(v)); } catch {} },
  get closedCats() { try { return JSON.parse(localStorage.getItem("aop-nav-closed") || "[]"); } catch { return []; } },
  set closedCats(v) { try { localStorage.setItem("aop-nav-closed", JSON.stringify(v)); } catch {} },
};

let renderingTopicId = "";

/* One-time migration: task keys changed from 'topicId:i' to
   'topicId:blockIndex:i' (blockIndex = the block's position in t.blocks).
   Copy each legacy two-part value into the FIRST tasks block of its topic,
   then stamp a version so this never runs twice. */
const TASK_STATE_VERSION = 2;
function migrateTaskState() {
  let m;
  try { m = JSON.parse(localStorage.getItem("aop-task-state") || "{}"); } catch { return; }
  if (!m || typeof m !== "object") return;
  if ((m.__v | 0) >= TASK_STATE_VERSION) return;
  const firstTasksBlockIndex = (topicId) => {
    const t = (typeof TOPICS !== "undefined" ? TOPICS : []).find((x) => x.id === topicId);
    if (!t || !Array.isArray(t.blocks)) return null;
    for (let i = 0; i < t.blocks.length; i++) if (t.blocks[i] && t.blocks[i].tasks) return i;
    return null;
  };
  Object.keys(m).forEach((key) => {
    if (key === "__v") return;
    const parts = key.split(":");
    if (parts.length !== 2) return;                  // already 3-part or unrelated
    const topicId = parts[0], i = parts[1];
    if (!/^\d+$/.test(i)) return;
    const bi = firstTasksBlockIndex(topicId);
    if (bi == null) { delete m[key]; return; }        // topic/block gone — drop stale key
    const newKey = topicId + ":" + bi + ":" + i;
    if (m[newKey] === undefined) m[newKey] = m[key];
    delete m[key];
  });
  m.__v = TASK_STATE_VERSION;
  try { localStorage.setItem("aop-task-state", JSON.stringify(m)); } catch {}
}

/* ---------------- helpers ---------------- */
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function topicById(id) { return TOPICS.find((t) => t.id === id); }

/* inline markup: `code`, **bold**, [[id|label]] cross-links */
function inline(s) {
  let h = esc(s);
  // [[id|label]] and [[lab/<file>|label]] cross-links (slash allowed for lab routes)
  h = h.replace(/\[\[([\w\/-]+)\|([^\]]+)\]\]/g, '<a class="xref" onclick="go(\'$1\')">$2</a>');
  h = h.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  h = h.replace(/`([^`]+)`/g, "<code>$1</code>");
  return h;
}

/* ---------------- syntax highlighting ---------------- */
const CS_KEYWORDS = "abstract as async await base bool break byte case catch char checked class const continue decimal default delegate do double else enum event explicit extern false finally fixed float for foreach get goto if implicit in init int interface internal is lock long namespace new null object operator out override params partial private protected public readonly record ref required return sbyte sealed set short sizeof stackalloc static string struct switch this throw true try typeof uint ulong unchecked unsafe ushort using var virtual void volatile when where while yield field value nameof".split(" ");
const CS_TYPES = "Console Task List Dictionary HashSet SortedSet Queue Stack LinkedList LinkedListNode ObservableCollection IEnumerable IEnumerator ICollection IList IDictionary IComparable IComparer IDisposable INotifyPropertyChanged PropertyChangedEventArgs PropertyChangedEventHandler EventArgs EventHandler Action Func Predicate Thread Tasks Math Random DateTime TimeSpan Guid File Directory Path JsonSerializer JsonSerializerOptions JsonNamingPolicy Exception ArgumentException InvalidOperationException FileNotFoundException NullReferenceException AggregateException OperationCanceledException CancellationToken CancellationTokenSource SemaphoreSlim ManualResetEventSlim PeriodicTimer BlockingCollection ConcurrentBag ConcurrentQueue ConcurrentStack ConcurrentDictionary Interlocked Monitor StringBuilder String Int32 Object Window StackPanel DockPanel Grid Canvas WrapPanel UniformGrid RelativePanel Border Button TextBlock TextBox Label CheckBox RadioButton ComboBox ListBox Slider NumericUpDown Menu MenuItem TabControl TabItem Image Rectangle Ellipse ItemsControl ContentControl UserControl Application AppBuilder Dispatcher DispatcherTimer DispatcherPriority Avalonia ObservableObject RelayCommand IRelayCommand ICommand AsyncRelayCommand Thickness Orientation HorizontalAlignment VerticalAlignment Brushes IBrush SolidColorBrush Color Colors Bitmap AssetLoader IClassicDesktopStyleApplicationLifetime AvaloniaXamlLoader FluentTheme SimpleTheme StreamReader StreamWriter Assert Xunit Fact Theory InlineData AvaloniaFact AvaloniaTestApplication AvaloniaHeadlessPlatformOptions PhysicalKey RawInputModifiers KeyValuePair Enumerable Tuple Lazy Nullable Convert Encoding CultureInfo".split(" ");

function hiCS(code) {
  let h = esc(code);
  const slots = [];
  const stash = (html) => { slots.push(html); return "~S" + (slots.length - 1) + "Z~"; };

  // comments
  h = h.replace(/\/\*[\s\S]*?\*\//g, (m) => stash('<span class="tk-com">' + m + "</span>"));
  h = h.replace(/\/\/[^\n]*/g, (m) => stash('<span class="tk-com">' + m + "</span>"));
  // strings (interpolated, verbatim, normal, char)
  h = h.replace(/\$?@?&quot;(?:\\.|&quot;&quot;|(?!&quot;)[\s\S])*?&quot;/g, (m) => stash('<span class="tk-str">' + m + "</span>"));
  h = h.replace(/&#39;(?:\\.|[^&])*?&#39;|'(?:\\.|[^'])'/g, (m) => stash('<span class="tk-str">' + m + "</span>"));
  // attributes  [ObservableProperty] [RelayCommand(...)] [Fact] ...
  h = h.replace(/\[(assembly:\s*)?([A-Z]\w*)(\([^\]]*\))?\]/g, (m) => stash('<span class="tk-attr">' + m + "</span>"));
  // numbers
  h = h.replace(/\b(\d[\d_]*\.?\d*[MmFfDdLl]?)\b/g, '<span class="tk-num">$1</span>');
  // keywords
  h = h.replace(new RegExp("\\b(" + CS_KEYWORDS.join("|") + ")\\b", "g"), '<span class="tk-kw">$1</span>');
  // known types
  h = h.replace(new RegExp("\\b(" + CS_TYPES.join("|") + ")\\b", "g"), '<span class="tk-typ">$1</span>');

  h = h.replace(/~S(\d+)Z~/g, (m, i) => slots[+i]);
  return h;
}

function hiXML(code) {
  let h = esc(code);
  const slots = [];
  const stash = (html) => { slots.push(html); return "~S" + (slots.length - 1) + "Z~"; };

  h = h.replace(/&lt;!--[\s\S]*?--&gt;/g, (m) => stash('<span class="tk-com">' + m + "</span>"));
  // attribute="value"  (highlight {Binding ...} and {x:Type} inside values)
  h = h.replace(/([\w.:-]+)(=)(&quot;[^&]*?&quot;)/g, (m, n, eq, v) => {
    let vv = v.replace(/\{[^}]*\}/g, '<span class="tk-attr">$&</span>');
    return stash('<span class="tk-an">' + n + "</span>" + eq + '<span class="tk-str">' + vv + "</span>");
  });
  // tags
  h = h.replace(/(&lt;\/?)([\w.:]+)/g, '$1<span class="tk-tag">$2</span>');
  h = h.replace(/~S(\d+)Z~/g, (m, i) => slots[+i]);
  return h;
}

function hiBash(code) {
  let h = esc(code);
  const slots = [];
  const stash = (html) => { slots.push(html); return "~S" + (slots.length - 1) + "Z~"; };
  // stash comments FIRST so flag/keyword passes never reach inside them
  h = h.replace(/^(\s*#[^\n]*)$/gm, (m) => stash('<span class="tk-com">' + m + "</span>"));
  h = h.replace(/^(\s*)(dotnet|cd|mkdir|dir|ls)\b/gm, '$1<span class="tk-kw">$2</span>');
  h = h.replace(/(--?[\w-]+)/g, '<span class="tk-an">$1</span>');
  h = h.replace(/~S(\d+)Z~/g, (m, i) => slots[+i]);
  return h;
}

function hiJSON(code) {
  let h = esc(code);
  h = h.replace(/&quot;(\\.|[^&])*?&quot;(?=\s*:)/g, '<span class="tk-an">$&</span>');
  h = h.replace(/:\s*(&quot;(\\.|[^&])*?&quot;)/g, (m, v) => m.replace(v, '<span class="tk-str">' + v + "</span>"));
  h = h.replace(/\b(true|false|null)\b/g, '<span class="tk-kw">$1</span>');
  h = h.replace(/\b(\d+\.?\d*)\b/g, '<span class="tk-num">$1</span>');
  return h;
}

function highlight(code, lang) {
  if (lang === "csharp") return hiCS(code);
  if (lang === "xml") return hiXML(code);
  if (lang === "bash") return hiBash(code);
  if (lang === "json") return hiJSON(code);
  return esc(code);
}

/* ---------------- block rendering ----------------
   blockIndex = position of this block within t.blocks (passed by .map). Used
   to key task checkboxes uniquely even when a topic has several tasks blocks. */
function renderBlock(b, blockIndex) {
  if (b.h) return '<h2 class="bh" id="' + esc(b.h.toLowerCase().replace(/[^a-z0-9]+/g, "-")) + '">' + inline(b.h) + "</h2>";
  if (b.p) return '<p class="bp">' + inline(b.p) + "</p>";
  if (b.list) return '<ul class="bl">' + b.list.map((li) => "<li>" + inline(li) + "</li>").join("") + "</ul>";
  if (b.steps) return '<ol class="bl">' + b.steps.map((li) => "<li>" + inline(li) + "</li>").join("") + "</ol>";
  if (b.rule) return callout("co-rule", "▣", b.title || "RULE", b.rule);
  if (b.def) return callout("co-def", "◈", b.term ? "DEFINITION · " + esc(b.term) : "DEFINITION", b.def);
  if (b.tip) return callout("co-tip", "★", b.title || "EXAM TIP", b.tip);
  if (b.gotcha) return callout("co-gotcha", "⚠", b.title || "GOTCHA", b.gotcha);
  if (b.table) {
    return '<div class="tbl-wrap"><table class="bt"><thead><tr>' +
      b.table.head.map((h) => "<th>" + inline(h) + "</th>").join("") +
      "</tr></thead><tbody>" +
      b.table.rows.map((r) => "<tr>" + r.map((c) => "<td>" + inline(c) + "</td>").join("") + "</tr>").join("") +
      "</tbody></table></div>";
  }
  if (b.tasks) {
    const bi = blockIndex == null ? 0 : blockIndex;
    const total = b.tasks.length;
    let done = 0;
    const items = b.tasks.map((tx, i) => {
      const key = renderingTopicId + ":" + bi + ":" + i;
      const isDone = !!store.tasks[key];
      if (isDone) done++;
      return '<label class="task' + (isDone ? " done" : "") + '">' +
        '<input type="checkbox"' + (isDone ? " checked" : "") + ' onchange="toggleTask(\'' + key + '\', this)">' +
        "<span>" + inline(tx) + "</span></label>";
    }).join("");
    return '<div class="tasklist"><div class="task-progress">' + done + " / " + total + " done</div>" + items + "</div>";
  }
  if (b.reveal) {
    return '<details class="reveal"><summary>' + esc(b.label || "Show solution") + "</summary>" +
      b.reveal.map((sub, i) => renderBlock(sub, blockIndex)).join("") + "</details>";
  }
  if (b.preview !== undefined) {
    return '<div class="preview">' +
      '<div class="preview-chrome"><span class="pdot"></span><span class="pdot"></span><span class="pdot"></span>' +
      '<span class="preview-title">' + esc(b.title || "rendered result") + "</span></div>" +
      '<div class="preview-body">' + b.preview + "</div></div>";
  }
  if (b.code !== undefined) {
    const idx = codeRegistry.push(b.code) - 1;
    const lang = b.lang || "csharp";
    return '<div class="codeblock">' +
      '<div class="code-head">' +
      '<span class="code-lang lang-' + lang + '">' + lang + "</span>" +
      '<span class="code-title">' + esc(b.title || "") + "</span>" +
      '<button class="copybtn" onclick="copyCode(this,' + idx + ')">copy</button>' +
      "</div>" +
      '<pre class="code">' + highlight(b.code, lang) + "</pre></div>";
  }
  return "";
}

function callout(cls, icon, label, text) {
  return '<div class="callout ' + cls + '"><div class="co-icon">' + icon + "</div><div>" +
    '<span class="co-label">' + esc(label) + "</span>" + inline(text) + "</div></div>";
}

function toggleTask(key, el) {
  const m = store.tasks;
  if (el.checked) m[key] = 1; else delete m[key];
  store.tasks = m;
  const label = el.closest("label");
  label.classList.toggle("done", el.checked);
  const list = el.closest(".tasklist");
  if (list) {
    const boxes = list.querySelectorAll("input[type=checkbox]");
    let done = 0;
    boxes.forEach((bx) => { if (bx.checked) done++; });
    const prog = list.querySelector(".task-progress");
    if (prog) prog.textContent = done + " / " + boxes.length + " done";
  }
}

/* ---------------- topic page ---------------- */
function renderTopic(t) {
  codeRegistry = [];
  renderingTopicId = t.id;
  let h = '<div class="content-inner">';
  h += '<div class="crumb"><b>' + esc(t.cat) + "</b> / " + esc(t.title) + "</div>";
  h += '<h1 class="topic-title">' + esc(t.title) + "</h1>";
  if (t.tags && t.tags.length) {
    h += '<div class="topic-tags">' + t.tags.map((g) => '<span class="tag">' + esc(g) + "</span>").join("") + "</div>";
  }
  const heads = t.blocks.filter((b) => b.h);
  if (heads.length >= 3) {
    h += '<div class="toc">' + heads.map((b) => {
      const hid = b.h.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      return '<span class="toc-chip" onclick="scrollToHeading(\'' + hid + '\')">' + esc(b.h.replace(/\*\*/g, "").replace(/`/g, "")) + "</span>";
    }).join("") + "</div>";
  }
  h += t.blocks.map(renderBlock).join("");

  if (t.related && t.related.length) {
    h += '<div class="related"><div class="section-label">Related</div>';
    t.related.forEach((rid) => {
      const rt = topicById(rid);
      if (rt) h += '<span class="rel-chip" onclick="go(\'' + rid + '\')">' + esc(rt.title) + "</span>";
    });
    h += "</div>";
  }

  // prev / next within category
  const sib = TOPICS.filter((x) => x.cat === t.cat);
  const i = sib.indexOf(t);
  h += '<div class="pager">';
  if (i > 0) h += '<div class="pg prev" onclick="go(\'' + sib[i - 1].id + '\')"><div class="pg-dir">← Prev</div><div class="pg-title">' + esc(sib[i - 1].title) + "</div></div>";
  if (i < sib.length - 1) h += '<div class="pg next" onclick="go(\'' + sib[i + 1].id + '\')"><div class="pg-dir">Next →</div><div class="pg-title">' + esc(sib[i + 1].title) + "</div></div>";
  h += "</div></div>";
  return h;
}

/* ---------------- home page ---------------- */
function renderHome() {
  codeRegistry = [];
  let h = '<div class="content-inner">';
  h += '<div class="hero"><h1>Everything you need,<br><span class="hl">two keystrokes away.</span></h1>' +
    '<p>The complete AOP (F26) curriculum as a searchable codebase: every pattern, rule and gotcha from all 12 lectures, the course example projects, and both 2025 exams with full solutions. Press <span class="kbd">/</span> and type.</p></div>';

  h += '<div class="section-label">Tools</div><div class="homegrid">';
  TOOLS.forEach((tool) => {
    h += '<div class="homecard toolcard" style="--cat-color:' + tool.color + '" onclick="go(\'' + tool.id + '\')">' +
      '<div class="hc-cat">' + esc(tool.label) + '</div>' +
      '<div class="hc-title">' + esc(tool.homeTitle) + '</div>' +
      '<div class="hc-desc">' + esc(tool.homeDesc) + "</div></div>";
  });
  h += "</div>";

  const bc = TOPICS.filter((t) => t.cat === "3-Day Bootcamp");
  if (bc.length) {
    h += '<div class="section-label">Your 3-day bootcamp</div><div class="homegrid">';
    bc.forEach((t, i) => (h += homeCard(t, i)));
    h += "</div>";
  }

  h += '<div class="section-label">The playbooks</div><div class="homegrid">';
  TOPICS.filter((t) => t.cat === "Exam Playbooks").forEach((t, i) => {
    h += homeCard(t, i);
  });
  h += "</div>";

  const pins = store.pins.map(topicById).filter(Boolean);
  if (pins.length) {
    h += '<div class="section-label">Pinned</div><div class="homegrid">';
    pins.forEach((t, i) => (h += homeCard(t, i)));
    h += "</div>";
  }

  const recents = store.recents.map(topicById).filter(Boolean).slice(0, 8);
  if (recents.length) {
    h += '<div class="section-label">Recently viewed</div><div class="homegrid">';
    recents.forEach((t, i) => (h += homeCard(t, i)));
    h += "</div>";
  }

  h += '<div class="section-label">Browse all categories</div><div class="homegrid">';
  CATEGORIES.forEach((c, i) => {
    const n = TOPICS.filter((t) => t.cat === c.name).length;
    if (!n) return;
    h += '<div class="homecard" style="--cat-color:' + c.color + '" onclick="openCat(\'' + c.name.replace(/'/g, "\\'") + '\')">' +
      '<div class="hc-cat">' + esc(c.name) + '</div>' +
      '<div class="hc-title">' + n + " topics</div>" +
      '<div class="hc-desc">' + TOPICS.filter((t) => t.cat === c.name).slice(0, 4).map((t) => esc(t.title)).join(" · ") + "…</div></div>";
  });
  h += "</div></div>";
  return h;
}

function homeCard(t, i) {
  const cat = CATEGORIES.find((c) => c.name === t.cat) || {};
  const desc = (t.blocks.find((b) => b.p) || {}).p || "";
  return '<div class="homecard" style="--cat-color:' + (cat.color || "#e6b450") + ";animation-delay:" + i * 0.04 + 's" onclick="go(\'' + t.id + '\')">' +
    '<div class="hc-cat">' + esc(t.cat) + "</div>" +
    '<div class="hc-title">' + esc(t.title) + "</div>" +
    '<div class="hc-desc">' + esc(desc.replace(/[`*]|\[\[[\w-]+\|/g, "").replace(/\]\]/g, "")).slice(0, 110) + "</div></div>";
}

/* ---------------- navigation ---------------- */
function go(id, replace) {
  searchBox.value = "";
  lastResults = [];
  current = id;
  pushHash(id, replace);
  if (id === "home") {
    content.innerHTML = renderHome();
  } else if (id === "lab") {
    content.innerHTML = renderLabIndex();
  } else if (id.indexOf("lab/") === 0) {
    content.innerHTML = renderLabFile(id.slice(4));
  } else if (id === "builder") {
    content.innerHTML = renderBuilder();
  } else if (toolModule(id)) {
    const mod = window[toolModule(id)];
    content.innerHTML = mod.render();
    setTimeout(() => mod.init(), 0);
  } else {
    const t = topicById(id);
    if (!t) { content.innerHTML = renderNotFound(id); content.scrollTop = 0; buildNav(); updatePinBtn(); return; }
    content.innerHTML = renderTopic(t);
    const r = store.recents.filter((x) => x !== id);
    r.unshift(id);
    store.recents = r.slice(0, 12);
  }
  content.scrollTop = 0;
  buildNav();
  updatePinBtn();
}

/* module-backed tools (designer/analyzer/testlab/quiz): returns the global name */
function toolModule(id) {
  const t = TOOLS.find((x) => x.id === id);
  return t && t.module && window[t.module] ? t.module : null;
}

/* history: pushState on real navigation, replaceState on boot/back so the
   forward stack stays sane. file:// safe — every call wrapped in try/catch. */
function pushHash(id, replace) {
  const hash = id === "home" ? "#" : "#" + id;
  try {
    // re-rendering the page we're already on (e.g. clearing search) must not
    // stack a duplicate history entry — replace instead of push.
    const cur = location.hash || "#";
    if (replace || cur === hash) history.replaceState({ id }, "", hash);
    else history.pushState({ id }, "", hash);
  } catch {}
}

/* unknown route: small "did you mean" panel reusing the search scorer */
function renderNotFound(id) {
  const guesses = search(String(id).replace(/[\/-]+/g, " ")).slice(0, 6);
  let h = '<div class="content-inner">';
  h += '<div class="crumb"><b>NOT FOUND</b> / ' + esc(id) + "</div>";
  h += '<h1 class="topic-title">No route “' + esc(id) + '”</h1>';
  h += '<p class="bp">That id isn’t a topic or a tool. ' +
    (guesses.length ? "Did you mean one of these?" : "Try the search (press <span class=\"kbd\">/</span>).") + "</p>";
  if (guesses.length) {
    h += '<div class="homegrid">';
    guesses.forEach((t, i) => { h += homeCard(t, i); });
    h += "</div>";
  }
  h += '<div class="pager"><div class="pg next" onclick="go(\'home\')"><div class="pg-dir">Home →</div><div class="pg-title">Back to start</div></div></div>';
  h += "</div>";
  return h;
}

function openCat(name) {
  const first = TOPICS.find((t) => t.cat === name);
  if (first) go(first.id);
}

function buildNav() {
  const nav = $("nav");
  const closed = store.closedCats;
  let h = "";
  h += '<div class="nav-tools"><div class="nav-group-label">Exam Day</div>';
  TOOLS.forEach((tool) => {
    const active = current === tool.id || (tool.id === "lab" && (current || "").indexOf("lab/") === 0);
    h += '<div class="nav-tool' + (active ? " active" : "") + '" onclick="go(\'' + tool.id + '\')">' +
      '<span class="nt-icon">' + tool.icon + '</span><span class="nt-text"><b>' + esc(tool.label) +
      "</b><i>" + esc(tool.sub) + "</i></span></div>";
  });
  h += "</div>";
  CATEGORIES.forEach((c) => {
    const items = TOPICS.filter((t) => t.cat === c.name);
    if (!items.length) return;
    const isClosed = closed.includes(c.name);
    h += '<div class="nav-cat' + (isClosed ? " closed" : "") + '" style="--cat-color:' + c.color + '">' +
      '<div class="nav-cat-head" onclick="toggleCat(this,\'' + c.name.replace(/'/g, "\\'") + '\')">' +
      '<span class="tick">▾</span>' + esc(c.name) +
      '<span class="count">' + items.length + "</span></div>" +
      '<div class="nav-items">';
    items.forEach((t) => {
      h += '<div class="nav-item' + (current === t.id ? " active" : "") + '" onclick="go(\'' + t.id + '\')">' +
        esc(t.title) + (store.pins.includes(t.id) ? '<span class="pin-ind">★</span>' : "") + "</div>";
    });
    h += "</div></div>";
  });
  nav.innerHTML = h;
}

function toggleCat(el, name) {
  let closed = store.closedCats;
  if (closed.includes(name)) closed = closed.filter((x) => x !== name);
  else closed.push(name);
  store.closedCats = closed;
  el.parentElement.classList.toggle("closed");
}

/* ---------------- CODE LAB ---------------- */
let labFileId = null;
let labNoteIdx = -1;   // index into the file's annotated-line list

function labFile(id) { return (window.LAB_FILES || []).find((f) => f.id === id); }

function renderLabIndex() {
  let h = '<div class="content-inner">';
  h += '<div class="crumb"><b>CODE LAB</b></div>';
  h += '<h1 class="topic-title">Code Lab</h1>';
  h += '<p class="bp">The nine files the exam is built from, explained <b>line by line</b>. Open one, then click any marked line — or just press <span class="kbd">j</span> / <span class="kbd">k</span> to be walked through the file note by note.</p>';
  h += '<div class="homegrid">';
  (window.LAB_FILES || []).forEach((f, i) => {
    const notes = f.lines.filter((l) => l.n).length;
    h += '<div class="homecard" style="--cat-color:#39bae6;animation-delay:' + i * 0.04 + 's" onclick="go(\'lab/' + f.id + '\')">' +
      '<div class="hc-cat">' + esc(f.lang) + " · " + notes + " notes</div>" +
      '<div class="hc-title">' + esc(f.title) + "</div>" +
      '<div class="hc-desc">' + esc(f.sub) + "</div></div>";
  });
  h += "</div></div>";
  return h;
}

function renderLabFile(id) {
  const f = labFile(id);
  if (!f) return renderLabIndex();
  labFileId = id;
  const noteLines = f.lines.map((l, i) => (l.n ? i : -1)).filter((i) => i >= 0);
  labNoteIdx = 0;
  codeRegistry = [f.lines.map((l) => l.c).join("\n")];

  let h = '<div class="content-inner content-wide">';
  h += '<div class="crumb"><b>CODE LAB</b> / ' + esc(f.title) + "</div>";
  h += '<h1 class="topic-title">' + esc(f.title) + "</h1>";
  h += '<p class="bp" style="margin-bottom:18px">' + esc(f.sub) +
    ' &nbsp;·&nbsp; <span class="kbd">j</span> next note · <span class="kbd">k</span> previous · <button class="copybtn" onclick="copyCode(this,0)">copy whole file</button></p>';

  h += '<div class="lab">';
  h += '<div class="lab-code"><div class="lab-lines" id="lablines">';
  f.lines.forEach((l, i) => {
    const hasNote = !!l.n;
    h += '<div class="lline' + (hasNote ? " has-note" : "") + '" id="ll-' + i + '"' +
      (hasNote ? ' onclick="labSelect(' + i + ')"' : "") + ">" +
      '<span class="lno">' + (i + 1) + "</span>" +
      '<span class="lcode">' + (l.c === "" ? "&nbsp;" : highlight(l.c, f.lang)) + "</span>" +
      (hasNote ? '<span class="ldot">●</span>' : "") +
      "</div>";
  });
  h += "</div></div>";
  h += '<aside class="lab-note"><div class="lab-note-inner" id="labnote"></div></aside>';
  h += "</div>";

  // prev / next file
  const files = window.LAB_FILES || [];
  const fi = files.indexOf(f);
  h += '<div class="pager">';
  if (fi > 0) h += '<div class="pg prev" onclick="go(\'lab/' + files[fi - 1].id + '\')"><div class="pg-dir">← Prev file</div><div class="pg-title">' + esc(files[fi - 1].title) + "</div></div>";
  if (fi < files.length - 1) h += '<div class="pg next" onclick="go(\'lab/' + files[fi + 1].id + '\')"><div class="pg-dir">Next file →</div><div class="pg-title">' + esc(files[fi + 1].title) + "</div></div>";
  h += "</div></div>";

  setTimeout(() => { if (noteLines.length) labSelect(noteLines[0], true); }, 0);
  return h;
}

function labSelect(lineIdx, noScroll) {
  const f = labFile(labFileId);
  if (!f) return;
  const noteLines = f.lines.map((l, i) => (l.n ? i : -1)).filter((i) => i >= 0);
  labNoteIdx = Math.max(0, noteLines.indexOf(lineIdx));

  document.querySelectorAll(".lline.active").forEach((el) => el.classList.remove("active"));
  const lineEl = document.getElementById("ll-" + lineIdx);
  if (lineEl) {
    lineEl.classList.add("active");
    if (!noScroll) lineEl.scrollIntoView({ block: "center", behavior: "smooth" });
  }
  const noteEl = document.getElementById("labnote");
  if (noteEl) {
    noteEl.innerHTML =
      '<div class="ln-pos">note ' + (labNoteIdx + 1) + " / " + noteLines.length + "</div>" +
      '<div class="ln-line">' + esc(f.lines[lineIdx].c.trim() || "(blank line)") + "</div>" +
      '<div class="ln-text">' + inline(f.lines[lineIdx].n) + "</div>" +
      '<div class="ln-nav">' +
      '<button class="copybtn" onclick="labStep(-1)">← prev (k)</button>' +
      '<button class="copybtn" onclick="labStep(1)">next (j) →</button></div>';
  }
}

function labStep(dir) {
  const f = labFile(labFileId);
  if (!f) return;
  const noteLines = f.lines.map((l, i) => (l.n ? i : -1)).filter((i) => i >= 0);
  labNoteIdx = Math.min(noteLines.length - 1, Math.max(0, labNoteIdx + dir));
  labSelect(noteLines[labNoteIdx]);
}

/* ---------------- UI BUILDER ---------------- */
function builderSel() {
  try {
    const saved = JSON.parse(localStorage.getItem("aop-builder") || "null");
    return new Set(saved || ["list", "add", "guard", "select", "status"]);
  } catch { return new Set(["list", "add", "guard", "select", "status"]); }
}
function saveBuilderSel(sel) {
  try { localStorage.setItem("aop-builder", JSON.stringify([...sel])); } catch {}
}

function renderBuilder() {
  const sel = builderSel();
  const B = window.BUILDER;
  codeRegistry = [];

  let h = '<div class="content-inner content-wide">';
  h += '<div class="crumb"><b>UI BUILDER</b></div>';
  h += '<h1 class="topic-title">UI Builder</h1>';
  h += '<p class="bp">Tick the features your task needs; the complete ViewModel + AXAML appear on the right, wired together coherently (dependencies select themselves). Copy, paste, rename, done.</p>';

  h += '<div class="b-presets">';
  B.PRESETS.forEach((p, i) => {
    h += '<button class="preset-btn" onclick="applyPreset(' + i + ')">' + esc(p.name) + "</button>";
  });
  h += '<button class="preset-btn clear" onclick="applyPreset(-1)">Clear</button>';
  h += "</div>";

  h += '<div class="builder">';
  h += '<div class="b-features">';
  B.FEATURES.forEach((ft) => {
    const on = sel.has(ft.key);
    h += '<label class="b-feature' + (on ? " on" : "") + '">' +
      '<input type="checkbox"' + (on ? " checked" : "") + ' onchange="toggleFeature(\'' + ft.key + '\')">' +
      "<span><b>" + esc(ft.label) + "</b><i>" + esc(ft.desc) +
      (ft.deps.length ? " · needs: " + ft.deps.join(", ") : "") + "</i></span></label>";
  });
  h += "</div>";

  h += '<div class="b-output">';
  const panes = B.generate(sel);
  panes.forEach((p) => {
    const idx = codeRegistry.push(p.code) - 1;
    h += '<div class="codeblock">' +
      '<div class="code-head"><span class="code-lang lang-' + p.lang + '">' + p.lang + "</span>" +
      '<span class="code-title">' + esc(p.title) + "</span>" +
      '<button class="copybtn" onclick="copyCode(this,' + idx + ')">copy</button></div>' +
      '<pre class="code">' + highlight(p.code, p.lang) + "</pre></div>";
  });
  h += "</div></div></div>";
  return h;
}

function toggleFeature(key) {
  const sel = builderSel();
  const B = window.BUILDER;
  const featureByKey = (k) => B.FEATURES.find((f) => f.key === k);
  if (sel.has(key)) {
    sel.delete(key);
    // cascade: drop features whose dependencies are now gone
    let changed = true;
    while (changed) {
      changed = false;
      B.FEATURES.forEach((f) => {
        if (sel.has(f.key) && f.deps.some((d) => !sel.has(d))) { sel.delete(f.key); changed = true; }
      });
    }
  } else {
    sel.add(key);
    const addDeps = (k) => {
      (featureByKey(k).deps || []).forEach((d) => { if (!sel.has(d)) { sel.add(d); addDeps(d); } });
    };
    addDeps(key);
  }
  saveBuilderSel(sel);
  const st = content.scrollTop;
  content.innerHTML = renderBuilder();
  content.scrollTop = st;
}

function applyPreset(i) {
  const keys = i < 0 ? [] : window.BUILDER.PRESETS[i].keys;
  saveBuilderSel(new Set(keys));
  const st = content.scrollTop;
  content.innerHTML = renderBuilder();
  content.scrollTop = st;
}

function scrollToHeading(hid) {
  const el = document.getElementById(hid);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ---------------- pins ---------------- */
function updatePinBtn() {
  const b = $("pinbtn");
  if (!current || current === "home" || isToolRoute(current)) { b.style.visibility = "hidden"; return; }
  b.style.visibility = "visible";
  const pinned = store.pins.includes(current);
  b.textContent = pinned ? "★" : "☆";
  b.classList.toggle("pinned", pinned);
}
$("pinbtn").addEventListener("click", () => {
  if (!current || current === "home") return;
  let p = store.pins;
  if (p.includes(current)) p = p.filter((x) => x !== current);
  else p.push(current);
  store.pins = p;
  updatePinBtn();
  buildNav();
});

/* ---------------- copy ---------------- */
function copyCode(btn, idx) {
  const text = codeRegistry[idx];
  const done = () => {
    btn.textContent = "copied ✓";
    btn.classList.add("done");
    const toast = $("toast");
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 1400);
    setTimeout(() => { btn.textContent = "copy"; btn.classList.remove("done"); }, 1800);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else fallbackCopy(text, done);
}
function fallbackCopy(text, done) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); } catch {}
  document.body.removeChild(ta);
  done();
}

/* ---------------- search ---------------- */
function collectBlockText(b, s) {
  ["p", "rule", "def", "tip", "gotcha", "h"].forEach((k) => { if (b[k]) s.push(b[k]); });
  if (b.list) s.push(b.list.join(" "));
  if (b.steps) s.push(b.steps.join(" "));
  if (b.tasks) s.push(b.tasks.join(" "));
  if (b.table) s.push(b.table.head.join(" ") + " " + b.table.rows.map((r) => r.join(" ")).join(" "));
  if (b.code) s.push(b.code);
  if (b.reveal) b.reveal.forEach((sub) => collectBlockText(sub, s));
}

function topicText(t) {
  if (t._txt) return t._txt;
  let s = [];
  t.blocks.forEach((b) => collectBlockText(b, s));
  t._txt = s.join(" ").toLowerCase();
  return t._txt;
}

/* lab files + the module tools participate in search as pseudo-topics.
   Base _txt is cheap; deep _txt (full quiz/analyzer/testlab prose) is built
   ONCE, lazily, after all scripts load — concatenated and cached. */
const TOOL_TOPICS = (window.LAB_FILES || []).map((f) => ({
  id: "lab/" + f.id,
  title: "Code Lab · " + f.title,
  cat: "Code Lab",
  tags: ["lab", "annotated", "line by line"],
  blocks: [],
  _txt: (f.title + " " + f.sub + " " + f.lines.map((l) => l.c + " " + (l.n || "")).join(" ")).toLowerCase(),
})).concat([{
  id: "guide",
  title: "Exam Guide · the 4-hour plan, tool by tool",
  cat: "Tools",
  tags: ["guide", "plan", "exam", "submission", "orientation"],
  blocks: [],
  _txt: "exam guide plan orientation 4-hour the four plays problem 1 analysis lab problem 2 visual designer problem 3 async composer test lab self-check problem 4 query lab minute zero environment check verify-exam-env verify-submission exam family summer reexam time budget click path two-button rule export project zip download submission files flat 6-file folder packaging ritual how to run the exam what to hand in",
}, {
  id: "builder",
  title: "UI Builder · compose ViewModel + AXAML from features",
  cat: "Tools",
  tags: ["builder", "generate", "compose", "bundle"],
  blocks: [],
  _txt: "ui builder generate compose viewmodel axaml features list add button slider canvas timer async json status bundle",
}, {
  id: "designer",
  title: "Visual Designer · drag & drop → AXAML + ViewModel",
  cat: "Tools",
  tags: ["designer", "drag", "drop", "visual", "axaml"],
  blocks: [],
  _txt: "visual designer drag drop axaml viewmodel layout grid canvas stackpanel dockpanel shapes colors swatch binding inspector toolbox resize recolor move pixel",
}, {
  id: "analyzer",
  title: "Analysis Lab · paste code → violations + written answer",
  cat: "Tools",
  tags: ["analyzer", "solid", "scan", "violation", "answer"],
  blocks: [],
  _txt: "solid analysis scanner violation downcast srp ocp lsp isp dip encapsulation written answer paste code findings problem 1",
}, {
  id: "testlab",
  title: "Test Lab · paste code → xUnit test proposals",
  cat: "Tools",
  tags: ["testlab", "test", "xunit", "headless", "fact", "theory", "assert"],
  blocks: [],
  _txt: "test lab xunit fact theory inlinedata assert avalonia headless avaloniafact testapplication scaffold viewmodel relaycommand observableproperty async task delay cancellation csproj runbook offline dotnet test paste code problem 3",
}, {
  id: "querylab",
  title: "Query Lab · paste JSON → LINQ → Program.cs",
  cat: "Tools",
  tags: ["querylab", "json", "linq", "query", "deserialize", "program.cs"],
  blocks: [],
  _txt: "query lab json linq deserialize serialize program.cs problem 4 jsonserializer jsonpropertyname jsonnamingpolicy nullable null-safe where filter equals contains empty collection nested any orderby sort group aggregate count average max min above average top n select fields binary search exact key results spaceships trip reexam recipes summer 2025 spaceship military travelling",
}, {
  id: "asynclab",
  title: "Async Composer · configure a worker → ViewModel",
  cat: "Tools",
  tags: ["asynclab", "async", "counter", "timer", "viewmodel", "worker"],
  blocks: [],
  _txt: "async composer lab counter progress worker list mutator dispatchertimer task delay cancellationtokensource dispatcher uithread post viewmodel mainwindowviewmodel relaycommand observableproperty start stop reset resume toggle canexecute interval 100ms step ui thread problem 3 reexam counter axaml headless xunit test",
}, {
  id: "quiz",
  title: "Quiz · self-test with weak-topic tracking",
  cat: "Tools",
  tags: ["quiz", "test", "practice", "questions"],
  blocks: [],
  _txt: "quiz test questions practice self-test multiple choice weak topics sprint score stats exam sim drill weak10",
}]);

/* Deep search index: fold quiz-bank prose, analyzer rule theory, and testlab
   capability keywords into the matching pseudo-topics' _txt. One pass, cached
   on a flag, so the cost is paid once and is well under 50ms. */
let _deepSearchBuilt = false;
function buildDeepSearchIndex() {
  if (_deepSearchBuilt) return;
  _deepSearchBuilt = true;
  const byId = (id) => TOOL_TOPICS.find((t) => t.id === id);
  // quiz questions: question + choices + explanation
  const quiz = byId("quiz");
  if (quiz && Array.isArray(window.QUIZ_BANK)) {
    const parts = [];
    window.QUIZ_BANK.forEach((q) => {
      parts.push(q.q || "");
      if (Array.isArray(q.choices)) parts.push(q.choices.join(" "));
      parts.push(q.explain || q.answer || "");
    });
    quiz._txt = (quiz._txt + " " + parts.join(" ")).toLowerCase();
  }
  // analyzer rule prose: title + theory + fix + principle names/summaries
  const analyzer = byId("analyzer");
  const AC = window.ANALYZER_CORE;
  if (analyzer && AC) {
    const parts = [];
    (AC.RULES || []).forEach((r) => {
      parts.push(r.title || "", r.theory || "", r.fix || "", r.principle || "");
    });
    Object.keys(AC.PRINCIPLES || {}).forEach((k) => {
      const p = AC.PRINCIPLES[k];
      parts.push(k, p.name || "", p.summary || "");
    });
    analyzer._txt = (analyzer._txt + " " + parts.join(" ")).toLowerCase();
  }
  // testlab capability keywords (from its core PKG + mode names)
  const testlab = byId("testlab");
  const TC = window.TESTLAB_CORE;
  if (testlab && TC && TC.PKG) {
    const pkg = Object.keys(TC.PKG).map((k) => k + " " + TC.PKG[k]).join(" ");
    testlab._txt = (testlab._txt + " " + pkg + " plain viewmodel headless async csproj runbook").toLowerCase();
  }
}

function search(q) {
  buildDeepSearchIndex();
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const scored = [];
  TOPICS.concat(TOOL_TOPICS).forEach((t) => {
    let score = 0;
    const title = t.title.toLowerCase();
    const tags = (t.tags || []).join(" ").toLowerCase();
    const body = topicText(t);
    for (const term of terms) {
      let s = 0;
      if (title.includes(term)) s += title.startsWith(term) ? 30 : 18;
      if (tags.includes(term)) s += 12;
      const n = body.split(term).length - 1;
      if (n > 0) s += Math.min(n, 6) * 2;
      if (s === 0) { score = 0; break; }  // all terms must match somewhere
      score += s;
    }
    if (score > 0) scored.push({ t, score });
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 40).map((x) => x.t);
}

function snippet(t, terms) {
  const body = topicText(t);
  let pos = -1;
  for (const term of terms) { pos = body.indexOf(term); if (pos >= 0) break; }
  if (pos < 0) pos = 0;
  const start = Math.max(0, pos - 60);
  let s = (start > 0 ? "…" : "") + body.slice(start, start + 170) + "…";
  terms.forEach((term) => {
    s = s.replace(new RegExp("(" + term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi"), "[[[MK]]]$1[[[/MK]]]");
  });
  return esc(s).split("[[[MK]]]").join("<mark>").split("[[[/MK]]]").join("</mark>");
}

function renderResults(q) {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  lastResults = search(q);
  resultSel = 0;
  let h = '<div class="content-inner">';
  h += '<div class="crumb"><b>SEARCH</b> / ' + esc(q) + " · " + lastResults.length + " hits</div>";
  if (!lastResults.length) {
    h += '<div class="nores">No matches. Try a shorter term: "binding", "lock", "groupby", "headless"…</div>';
  }
  lastResults.forEach((t, i) => {
    h += '<div class="result' + (i === resultSel ? " sel" : "") + '" data-i="' + i + '" onclick="go(\'' + t.id + '\')">' +
      '<div class="r-cat">' + esc(t.cat) + "</div>" +
      '<div class="r-title">' + esc(t.title) + "</div>" +
      '<div class="r-snip">' + snippet(t, terms) + "</div></div>";
  });
  h += "</div>";
  content.innerHTML = h;
  content.scrollTop = 0;
}

let searchTimer = null;
searchBox.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    const q = searchBox.value.trim();
    if (q.length >= 2) renderResults(q);
    else if (!q) go(current && current !== "home" ? current : "home");
  }, 120);
});

searchBox.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { searchBox.value = ""; searchBox.blur(); go(current || "home"); }
  if (!lastResults.length) return;
  if (e.key === "ArrowDown") { e.preventDefault(); resultSel = Math.min(resultSel + 1, lastResults.length - 1); paintSel(); }
  if (e.key === "ArrowUp") { e.preventDefault(); resultSel = Math.max(resultSel - 1, 0); paintSel(); }
  if (e.key === "Enter") { e.preventDefault(); go(lastResults[resultSel].id); searchBox.blur(); }
});

function paintSel() {
  document.querySelectorAll(".result").forEach((el, i) => {
    el.classList.toggle("sel", i === resultSel);
    if (i === resultSel) el.scrollIntoView({ block: "nearest" });
  });
}

/* ---------------- global keys ---------------- */
document.addEventListener("keydown", (e) => {
  const tag = (e.target.tagName || "").toUpperCase();
  if (e.target === searchBox || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.target.isContentEditable) return;
  if (e.key === "/" || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k")) {
    e.preventDefault(); searchBox.focus(); searchBox.select();
  } else if (current && current.indexOf("lab/") === 0 && (e.key === "j" || e.key === "k") && !e.ctrlKey && !e.metaKey) {
    e.preventDefault(); labStep(e.key === "j" ? 1 : -1);
  } else if (e.key.toLowerCase() === "h" && !e.ctrlKey && !e.metaKey) {
    go("home");
  } else if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && current && current.indexOf("lab/") === 0) {
    // navigate between Code Lab files
    const files = window.LAB_FILES || [];
    const idx = files.findIndex((f) => "lab/" + f.id === current);
    if (idx < 0) return;
    const next = e.key === "ArrowLeft" ? idx - 1 : idx + 1;
    if (next >= 0 && next < files.length) go("lab/" + files[next].id);
  } else if (e.key === "ArrowLeft" && current && current !== "home") {
    const t = topicById(current); if (!t) return;
    const sib = TOPICS.filter((x) => x.cat === t.cat); const i = sib.indexOf(t);
    if (i > 0) go(sib[i - 1].id);
  } else if (e.key === "ArrowRight" && current && current !== "home") {
    const t = topicById(current); if (!t) return;
    const sib = TOPICS.filter((x) => x.cat === t.cat); const i = sib.indexOf(t);
    if (i < sib.length - 1) go(sib[i + 1].id);
  }
});

$("burger").addEventListener("click", () => $("sidebar").classList.toggle("hidden"));

/* ---------------- history (Back / Forward) ---------------- */
function routeExists(id) {
  if (!id || id === "home") return true;
  if (TOOL_IDS.includes(id)) return true;
  if (id.indexOf("lab/") === 0) return !!labFile(id.slice(4));
  return !!topicById(id);
}
function hashId() {
  const raw = location.hash.replace(/^#/, "");
  return raw || "home";
}
function onHistoryNav() {
  const id = hashId();
  if (id === current) return;          // already showing it (e.g. our own pushState)
  go(id, true);                         // replace so we don't double-stack
}
window.addEventListener("popstate", onHistoryNav);
window.addEventListener("hashchange", onHistoryNav);

/* ---------------- boot ---------------- */
migrateTaskState();       // one-time legacy task-key upgrade (topicId:i -> topicId:bi:i)
buildDeepSearchIndex();   // fold quiz/analyzer/testlab prose into search once, now
buildNav();
const bootId = hashId();
go(routeExists(bootId) ? bootId : "home", true);
