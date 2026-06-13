/* ============ DESIGN PROCESS (GUI Design — Lecture 7) ============
   The non-coding GUI-design theory from Lecture 7 (GUI Design & Testing):
   UI prototyping classified on two axes — FIDELITY (how close it looks) and
   RESOLUTION (how much functionality is implemented) — plus the prototype
   artifacts (sketch, wireframe, paper prototype, mockup / functional prototype)
   and the vertical/horizontal distinction. Same topic schema + block types as
   the rest of the content (window.TOPICS.push), category "Design Process". */

window.TOPICS.push(

{
id: "proc-prototyping",
title: "UI Prototyping: fidelity & resolution",
cat: "Design Process",
tags: ["prototype", "prototyping", "fidelity", "resolution", "vertical", "horizontal", "wireframe", "mockup", "sketch", "paper prototype", "functional prototype", "gui design", "lecture 7"],
related: ["proc-context", "mv-mvc-vs-mvvm"],
blocks: [
  { def: "A prototype is an early, partial version of a UI built to explore ideas and get feedback before committing to the full build. Lecture 7 classifies prototypes on TWO independent axes: FIDELITY — how close the prototype LOOKS to the final application — and RESOLUTION — how much of the final application's FUNCTIONALITY is already implemented.", term: "Prototype (Lecture 7 framing)" },
  { rule: "Keep the two axes straight — they are the heart of this topic: **Fidelity = how it LOOKS. Resolution = how much actually WORKS.** They are independent: a prototype can be high on one and low on the other." },
  { h: "Resolution → vertical vs horizontal prototypes" },
  { p: "The slide states it directly: \"the resolution of a prototype can be roughly differentiated as vertical and horizontal prototypes.\"" },
  { table: { head: ["Kind", "Slide description", "Shape"], rows: [
    ["Horizontal (\"thin\")", "A single base view for each menu item — broad coverage of the whole UI, but little real functionality underneath", "wide & shallow"],
    ["Vertical (\"thick\")", "A single menu item implemented in detail with ALL its sub-views and functionalities, while other items might not be", "narrow & deep"],
  ]}},
  { tip: "Exam phrasing to recognize: \"focuses on a single, complete user flow while leaving other functionality unimplemented\" = VERTICAL prototype. \"a single base view for each menu item, broad but nothing works underneath\" = HORIZONTAL prototype. Both describe RESOLUTION, not fidelity." },
  { h: "Fidelity → how close it looks to the finished app" },
  { table: { head: ["Fidelity", "Looks like", "When"], rows: [
    ["Low", "Sketches, wireframes, paper prototypes — boxes and labels, no real styling or data", "cheap, fast, early — invites big changes"],
    ["High", "Mockups and functional prototypes — real colors, fonts, layout, often interactive", "later, costlier — usability testing & sign-off"],
  ]}},
  { h: "The prototype artifacts (low → high fidelity)" },
  { list: [
    "**Sketch** — rough freehand drawing of a screen. Lowest fidelity, low resolution.",
    "**Wireframe** — a structural blueprint: placement and hierarchy of elements, no color or final content ('what goes where'). Low fidelity, low resolution.",
    "**Paper prototype** — paper screens you swap/move by hand to fake interaction; low fidelity but can reach higher resolution because you can 'run' a whole flow.",
    "**Mockup** — a static high-fidelity picture of the finished look (real colors/fonts), but not really functional.",
    "**Functional prototype** — high fidelity AND high resolution: looks like the product and actually works.",
  ]},
  { rule: "Memorize the 2×2: low-fidelity = sketch / wireframe / paper; high-fidelity = mockup / functional prototype. Low resolution = horizontal (broad, nothing works); high resolution = vertical (one item built deep). Fidelity and resolution are separate axes." },
]},

{
id: "proc-context",
title: "Wider context: dev models & MVP (background — not in the slides)",
cat: "Design Process",
tags: ["iterative", "incremental", "waterfall", "throwaway", "evolutionary", "mvp", "background"],
related: ["proc-prototyping"],
blocks: [
  { p: "These are standard software-engineering ideas worth knowing, but they are NOT in the AOP GUI Design slides (which cover prototyping fidelity/resolution). Treat them as background for understanding, not as guaranteed exam material — Lecture 7 itself does not define them." },
  { h: "What happens to a prototype" },
  { table: { head: ["Approach", "Idea"], rows: [
    ["Throwaway (rapid)", "Built only to learn/validate, then discarded; the real system is rebuilt fresh from the lessons"],
    ["Evolutionary", "The same prototype is refined until it gradually becomes the production system"],
  ]}},
  { h: "Process models" },
  { list: [
    "**Iterative & incremental** — deliver the system in small working slices and revisit earlier work each cycle as feedback arrives (vs **waterfall**, a single linear pass where late mistakes are expensive).",
    "**MVP (Minimum Viable Product)** — a real, shippable product with just enough features to deliver value and learn from real users. Not a prototype: a vertical prototype proves a flow internally; an MVP goes to actual customers.",
  ]},
]}

);
