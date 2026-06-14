"use strict";
/* Syntax highlighter core. Regression coverage for the "HTML code leaking into
   the page" bug: a highlighting pass wrote a <span class="tk-..."> directly into
   the string, and a later pass matched text *inside* that markup and split the
   tag, leaking e.g. `class="tk-num">5` onto the page.

   Invariant used below: every source `<`/`>` is HTML-escaped to `&lt;`/`&gt;`
   before any token pass runs, so in the FINAL output the only raw `<` characters
   belong to the highlighter's own tags. Therefore every raw `<` must begin either
   `<span class="tk-...">` or `</span>`. Any other raw `<` is leaked markup. */
const { test, ok, includes, notIncludes } = require("./t.js");
const C = require("../data/highlight-core.js");

/* Every raw '<' in highlighter output must start a tk-span or a </span> close. */
function assertNoLeakedMarkup(out, label) {
  const parts = out.split("<");
  for (let i = 1; i < parts.length; i++) {
    const seg = parts[i];
    ok(seg.startsWith('span class="tk-') || seg.startsWith("/span>"),
      (label || "output") + ": leaked raw markup at <" + seg.slice(0, 40));
  }
}

/* ---------- the reported bug: C# numbers next to method calls ---------- */
test("C#: number spans are not split by the keyword pass (the leak bug)", () => {
  // straight from the screenshot: `printNumber(square(5));` rendered as
  // `printNumber(square(class="tk-num">5));`
  const out = C.hiCS("printNumber(square(5));");
  notIncludes(out, "<span <span", "the keyword pass split the number's <span>");
  notIncludes(out, '"tk-kw">class</span>', "the word `class` inside tk-num got highlighted");
  includes(out, '<span class="tk-num">5</span>', "the number 5 should be a clean tk-num span");
  assertNoLeakedMarkup(out, "printNumber(square(5))");
});

test("C#: multiple numbers and args stay well-formed", () => {
  const samples = [
    "int result = add(3, 4);   // 7",
    "for (int i = 0; i < values.Length; i++)",
    "Func<int, int, int> add = (a, b) => a + b;",
    "double pi = 3.14159; long big = 1_000_000L;",
    "Action<int> printNumber = (num) => Console.WriteLine(num);",
  ];
  samples.forEach((s) => assertNoLeakedMarkup(C.hiCS(s), s));
});

/* the exact LINQ "Same query twice" block from the reported screenshot:
   `new List<int> { 1, 2, 3, 4, 5 }` rendered each number as `class="tk-num">N`.
   The full multi-line block (collection initializer + lambda + query syntax)
   must round-trip with clean tk-num spans and no leaked markup. */
test("C#: the LINQ slide block (collection initializer + query syntax) never leaks tk-num", () => {
  const code = [
    "var numbers = new List<int> { 1, 2, 3, 4, 5 };",
    "",
    "// Method chaining",
    "var evensMethod = numbers.Where(n => n % 2 == 0).ToList();",
    "",
    "// Query syntax",
    "var evensQuery = from n in numbers",
    "                 where n % 2 == 0",
    "                 select n;",
  ].join("\n");
  const out = C.hiCS(code);
  assertNoLeakedMarkup(out, "LINQ slide block");
  notIncludes(out, '>class="tk-num"', "no split number span leaked as text");
  notIncludes(out, "<span <span", "the keyword pass must not split any number span");
  /* every literal 1..5 is a clean number span */
  [1, 2, 3, 4, 5].forEach((n) => includes(out, '<span class="tk-num">' + n + "</span>", "number " + n));
});

test("C#: numbers, keywords and types still highlight correctly", () => {
  const out = C.hiCS("int x = 5;");
  includes(out, '<span class="tk-num">5</span>', "number");
  includes(out, '<span class="tk-kw">int</span>', "keyword");
  const t = C.hiCS("Console.WriteLine(num);");
  includes(t, '<span class="tk-typ">Console</span>', "known type");
});

test("C#: the literal word `class` in real code is still a keyword", () => {
  const out = C.hiCS("public class Foo { }");
  includes(out, '<span class="tk-kw">class</span>', "class keyword");
  assertNoLeakedMarkup(out, "public class Foo");
});

/* ---------- the parallel bash bug ---------- */
test("bash: the flag pass does not chew into the command's tk-kw span", () => {
  // `tk-kw` contains a hyphen; `(--?[\w-]+)` would otherwise match `-kw`.
  ["dotnet build", "dotnet new avalonia.mvvm -o ExamApp", "cd ExamApp", "mkdir Models"]
    .forEach((s) => {
      const out = C.hiBash(s);
      notIncludes(out, "tk<span", s + ": flag pass split the tk-kw span");
      assertNoLeakedMarkup(out, s);
    });
  includes(C.hiBash("dotnet build"), '<span class="tk-kw">dotnet</span>', "dotnet keyword");
  includes(C.hiBash("dotnet new x -o App"), '<span class="tk-an">-o</span>', "real flag still highlighted");
});

/* ---------- the other two languages stay well-formed too ---------- */
test("xml: tag/attribute highlighting leaks no markup", () => {
  const out = C.hiXML('<Button Content="Add" Command="{Binding AddCommand}" Width="80"/>');
  assertNoLeakedMarkup(out, "Button axaml");
  includes(out, '<span class="tk-tag">Button</span>', "tag name");
});

test("json: value/number highlighting leaks no markup", () => {
  const out = C.hiJSON('{ "name": "Tower", "height": 30, "active": true }');
  assertNoLeakedMarkup(out, "json object");
  includes(out, '<span class="tk-num">30</span>', "number value");
});

/* ---------- the dispatcher ---------- */
test("highlight() routes by language and escapes unknown langs", () => {
  includes(C.highlight("int x = 5;", "csharp"), '<span class="tk-num">5</span>');
  includes(C.highlight("a < b", "plaintext"), "a &lt; b");
});
