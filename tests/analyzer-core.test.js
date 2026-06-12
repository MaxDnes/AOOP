"use strict";
const { test, eq, ok, includes, notIncludes } = require("./t.js");
const A = require("../data/analyzer-core.js");
const fs = require("fs"), path = require("path");

function scanSnippet(text) { return A.scan([{ name: "Test.cs", text }]).findings; }
function hasRule(findings, id) { return findings.some((f) => f.ruleId === id); }
function byRule(findings, id) { return findings.filter((f) => f.ruleId === id); }

/* ---- rule: concrete downcast ---- */
test("flags 'as ConcreteRepo' downcast", () => {
  const f = scanSnippet(`
class InMemoryRepo : IRepo { public void Save() {} public int Bonus() => 1; }
class Planner {
  private readonly IRepo _repo;
  public Planner(IRepo repo) { _repo = repo; }
  public void Run() { var c = _repo as InMemoryRepo; c.Bonus(); }
}`);
  ok(hasRule(f, "downcast"), "downcast rule should fire");
  const d = byRule(f, "downcast")[0];
  eq(d.principle, "DIP");   /* spec 15 defect 1: downcast leads with DIP, not LSP */
  includes(d.paragraph, "InMemoryRepo");
  includes(d.paragraph, "Dependency Inversion");
  includes(d.paragraph, "Liskov");   /* LSP kept as a secondary mention */
});
test("does NOT flag 'as IInterface' or 'as string'", () => {
  const f = scanSnippet(`
interface IRepo {}
class A { void M(object o) { var x = o as IRepo; var s = o as string; } }`);
  ok(!hasRule(f, "downcast"));
});

/* ---- rule: new concrete in ctor ---- */
test("flags new of project class inside constructor", () => {
  const f = scanSnippet(`
class FileLogger {}
class Service {
  private FileLogger _log;
  public Service() { _log = new FileLogger(); }
}`);
  ok(hasRule(f, "new-in-ctor"));
  eq(byRule(f, "new-in-ctor")[0].principle, "DIP");
});
test("does NOT flag new List<> or new of injected abstractions", () => {
  const f = scanSnippet(`
class Service { private List<int> _xs; public Service() { _xs = new List<int>(); } }`);
  ok(!hasRule(f, "new-in-ctor"), "BCL collections are fine");
});

/* ---- rule: NotImplementedException in member ---- */
test("flags NotImplementedException / NotSupportedException", () => {
  const f = scanSnippet(`
interface IDoc { void Print(); void Fax(); }
class Web : IDoc { public void Print() {} public void Fax() { throw new NotImplementedException(); } }`);
  ok(hasRule(f, "not-implemented"));
});

/* ---- rule: type-check chain ---- */
test("flags is-type chains and GetType comparisons", () => {
  const f = scanSnippet(`
class Shape {}
class Circle : Shape {}
class Square : Shape {}
class Area {
  public double Of(Shape s) {
    if (s is Circle) return 1;
    else if (s is Square) return 2;
    return 0;
  }
}`);
  ok(hasRule(f, "type-check-chain"));
  eq(byRule(f, "type-check-chain")[0].principle, "OCP");
});
test("single 'is' pattern alone does not fire the chain rule", () => {
  const f = scanSnippet(`class A { bool M(object o) => o is string; }`);
  ok(!hasRule(f, "type-check-chain"));
});

/* ---- rule: public mutable field ---- */
test("flags public fields; ignores const/readonly/properties", () => {
  const f = scanSnippet(`
class M {
  public int Count;
  public const int Max = 5;
  public readonly int Id = 1;
  public int Ok { get; set; }
}`);
  eq(byRule(f, "public-field").length, 1);
  eq(byRule(f, "public-field")[0].principle, "ENC");
});

/* ---- rule: console in domain ---- */
test("flags Console.* in non-Program classes only", () => {
  const f = A.scan([
    { name: "Program.cs", text: `class Program { static void Main() { Console.WriteLine("hi"); } }` },
    { name: "Order.cs",   text: `class Order { public void Save() { Console.WriteLine("saved"); } }` },
  ]).findings;
  eq(byRule(f, "console-in-domain").length, 1);
  eq(byRule(f, "console-in-domain")[0].file, "Order.cs");
});

/* ---- rule: fat interface ---- */
test("flags interface with >= 5 members as ISP smell", () => {
  const f = scanSnippet(`
interface IDocument { void Open(); void Close(); void Print(); void Fax(); void Scan(); void Email(); }`);
  ok(hasRule(f, "fat-interface"));
  eq(byRule(f, "fat-interface")[0].principle, "ISP");
});

/* ---- rule: static mutable state ---- */
test("flags public static mutable fields", () => {
  const f = scanSnippet(`class G { public static int Counter = 0; }`);
  ok(hasRule(f, "static-mutable"));
});

/* ---- rule: member hiding ---- */
test("flags 'new' member hiding", () => {
  const f = scanSnippet(`
class Base { public void Run() {} }
class Derived : Base { public new void Run() {} }`);
  ok(hasRule(f, "member-hiding"));
});

/* ---- rule: god class ---- */
test("flags class mixing I/O + persistence + domain or > 200 lines", () => {
  const body = Array.from({ length: 30 }, (_, i) => `  public void M${i}() { }`).join("\n");
  const f = scanSnippet(`
class Everything {
  public void Load() { var t = File.ReadAllText("x.json"); }
  public void Show() { Console.WriteLine("x"); }
  public decimal Total() => 42m;
${body}
}`);
  ok(hasRule(f, "god-class"));
});

/* ---- robustness ---- */
test("scan never throws on garbage input and returns empty on empty", () => {
  eq(A.scan([]).findings.length, 0);
  A.scan([{ name: "x.cs", text: "}}}{{{ class ;;; %%%" }]); // must not throw
});
test("a crashing rule is skipped, not fatal", () => {
  const evil = { id: "evil", principle: "SRP", severity: "info", title: "evil",
                 theory: "", fix: "", scan() { throw new Error("boom"); } };
  A.RULES.push(evil);
  try { A.scan([{ name: "x.cs", text: "class A {}" }]); }
  finally { A.RULES.pop(); }
});

/* ---- real exam calibration ---- */
function loadFixtures(dir) {
  const base = path.join(__dirname, "fixtures", dir);
  return fs.readdirSync(base).filter((f) => f.endsWith(".cs"))
    .map((f) => ({ name: f, text: fs.readFileSync(path.join(base, f), "utf8") }));
}
test("re-exam 2025: finds the planted InMemoryRecipeRepository downcast", () => {
  const { findings } = A.scan(loadFixtures("reexam2025"));
  const d = byRule(findings, "downcast");
  ok(d.some((x) => x.excerpt.indexOf("InMemoryRecipeRepository") !== -1),
     "must flag the as-InMemoryRecipeRepository downcast; got: " + JSON.stringify(d.map((x) => x.excerpt)));
});
test("re-exam 2025: surfaces at least 3 distinct principles", () => {
  const { findings } = A.scan(loadFixtures("reexam2025"));
  ok(new Set(findings.map((f) => f.principle)).size >= 3,
     "principles found: " + [...new Set(findings.map((f) => f.principle))].join(","));
});
test("summer 2025: scanner produces findings on DocumentManager", () => {
  const { findings } = A.scan(loadFixtures("summer2025"));
  ok(findings.length >= 3, "expected >=3 findings, got " + findings.length);
});

/* ======================================================================
   NEW RULES (spec 02 §1) — each gets a positive + a negative case
   ====================================================================== */

/* ---- rule: pattern-switch-dispatch ---- */
test("pattern-switch-dispatch fires on a type-matching switch (positive)", () => {
  const f = scanSnippet(`
class Invoice {} class Report {}
class Describer {
  string Describe(object d) => d switch {
    Invoice i => "inv",
    Report r => "rep",
    _ => "?"
  };
}`);
  ok(hasRule(f, "pattern-switch-dispatch"), "switch over project types must fire");
  const it = byRule(f, "pattern-switch-dispatch")[0];
  eq(it.principle, "OCP");
  eq(it.severity, "high", "2+ arms => high severity");
});
test("pattern-switch-dispatch ignores a switch over non-project values (negative)", () => {
  const f = scanSnippet(`
class Calc {
  int Of(int code) => code switch { 1 => 10, 2 => 20, _ => 0 };
}`);
  ok(!hasRule(f, "pattern-switch-dispatch"), "value/enum switch must not fire");
});

/* ---- rule: single-is-downcast ---- */
test("single-is-downcast fires on 'is ProjectType ident' that is then used (positive)", () => {
  const f = scanSnippet(`
interface IDoc { } class Validatable : IDoc { public bool Check() => true; }
class Proc {
  void Run(IDoc d) { if (d is Validatable v) { v.Check(); } }
}`);
  ok(hasRule(f, "single-is-downcast"), "is-narrowing whose ident is used must fire");
  eq(byRule(f, "single-is-downcast")[0].principle, "LSP");
});
test("single-is-downcast does NOT fire when the bound ident is unused (negative)", () => {
  const f = scanSnippet(`
interface IDoc {} class Validatable : IDoc {}
class Proc { bool Run(IDoc d) => d is Validatable v; }`);
  ok(!hasRule(f, "single-is-downcast"), "unused binding is not the smell this rule targets");
});

/* ---- rule: unused-injected-dependency (the ReExam _rules) ---- */
test("unused-injected-dependency fires on an injected field never read (positive)", () => {
  const f = scanSnippet(`
interface IRule {}
class Planner {
  private readonly List<IRule> _rules;
  private readonly INotifier _notifier;
  public Planner(List<IRule> rules, INotifier notifier) { _rules = rules; _notifier = notifier; }
  public void Go() { _notifier.Notify("hi"); }
}`);
  ok(hasRule(f, "unused-injected-dependency"), "_rules stored-but-never-read must fire");
  const it = byRule(f, "unused-injected-dependency")[0];
  eq(it.principle, "DIP");
  eq(it.severity, "high");
});
test("unused-injected-dependency does NOT fire when the field IS used (negative)", () => {
  const f = scanSnippet(`
interface IRule { bool Ok(); }
class Planner {
  private readonly List<IRule> _rules;
  public Planner(List<IRule> rules) { _rules = rules; }
  public bool Go() => _rules.All(r => r.Ok());
}`);
  ok(!hasRule(f, "unused-injected-dependency"), "a field that is read is not dead");
});

/* ---- rule: object-collection ---- */
test("object-collection fires on List<object> and notes OfType (positive)", () => {
  const f = scanSnippet(`
interface IDoc {}
class Store {
  private readonly List<object> _all = new List<object>();
  public void M() { var docs = _all.OfType<IDoc>().ToList(); }
}`);
  ok(hasRule(f, "object-collection"), "List<object> must fire");
  const it = byRule(f, "object-collection")[0];
  eq(it.principle, "OCP");
  includes(it.message, "OfType<IDoc>", "OfType<T> companion should be detected and named");
});
test("object-collection does NOT fire on a strongly-typed collection (negative)", () => {
  const f = scanSnippet(`
interface IDoc {}
class Store { private readonly List<IDoc> _all = new List<IDoc>(); }`);
  ok(!hasRule(f, "object-collection"), "typed collection is fine");
});

/* ---- rule: file-io-in-domain ---- */
test("file-io-in-domain fires on File.* inside a non-persistence class (positive)", () => {
  const f = scanSnippet(`
class InvoiceService {
  public void Save(string s) { File.WriteAllText("x.json", s); }
}`);
  ok(hasRule(f, "file-io-in-domain"), "File I/O in a domain class must fire");
  eq(byRule(f, "file-io-in-domain")[0].principle, "SRP");
});
test("file-io-in-domain does NOT fire inside a *Repository class (negative)", () => {
  const f = scanSnippet(`
class InvoiceRepository {
  public void Save(string s) { File.WriteAllText("x.json", s); }
}`);
  ok(!hasRule(f, "file-io-in-domain"), "persistence types are allowed to touch the file system");
});

/* ---- rule: marker-interface ---- */
test("marker-interface fires on a zero-member interface (positive)", () => {
  const f = scanSnippet(`public interface IDisplayableInfo {}`);
  ok(hasRule(f, "marker-interface"), "empty interface must fire");
  const it = byRule(f, "marker-interface")[0];
  eq(it.principle, "ISP");
  eq(it.severity, "info", "marker is an info-level talking point, not a hard violation");
});
test("marker-interface does NOT fire on an interface with members (negative)", () => {
  const f = scanSnippet(`public interface IDoc { void Go(); }`);
  ok(!hasRule(f, "marker-interface"), "interface with members is not a marker");
});

/* ======================================================================
   PRESENCE DETECTION (spec 02 §2)
   ====================================================================== */
function presenceOf(findings, principle) {
  return findings.filter((f) => f.kind === "presence" && f.principle === principle);
}
test("presence: DIP detected from constructor-injected project interfaces", () => {
  const f = scanSnippet(`
interface IRepo { void Save(); }
class Service {
  private readonly IRepo _repo;
  public Service(IRepo repo) { _repo = repo; }
}`);
  ok(presenceOf(f, "DIP").length >= 1, "DIP presence must be detected");
  const p = presenceOf(f, "DIP")[0];
  eq(p.verdict, "present");
  includes(p.paragraph, "Dependency Inversion is present");
});
test("presence: OCP/Strategy detected from an interface with 2+ implementations", () => {
  const f = scanSnippet(`
interface IRule { bool Ok(); }
class VegRule : IRule { public bool Ok() => true; }
class NutRule : IRule { public bool Ok() => true; }
class Planner { private readonly IRule _r; public Planner(IRule r){ _r = r; } }`);
  const ocp = presenceOf(f, "OCP");
  ok(ocp.length >= 1, "Strategy presence must be detected");
  includes(ocp[0].paragraph, "VegRule");
  includes(ocp[0].paragraph, "NutRule");
});
test("presence: ISP detected from small role interfaces", () => {
  const f = scanSnippet(`
interface IProcessable { bool Process(); }
interface ISummarizable { string Summary(); }`);
  ok(presenceOf(f, "ISP").length >= 1, "small role interfaces => ISP present");
});

/* ======================================================================
   REAL EXAM CALIBRATION — re-exam planted smells + presence (spec 02 §Tests)
   ====================================================================== */
test("re-exam 2025: unused-injected-dependency fires on the planted _rules list", () => {
  const { findings } = A.scan(loadFixtures("reexam2025"));
  const u = byRule(findings, "unused-injected-dependency");
  ok(u.some((x) => /\b_rules\b/.test(x.message) || /\b_rules\b/.test(x.paragraph)),
     "_rules must be flagged as a dead injected dependency; got: " + JSON.stringify(u.map((x) => x.message)));
});
test("re-exam 2025: presence finds DIP + ISP + at least one pattern", () => {
  const { findings } = A.scan(loadFixtures("reexam2025"));
  ok(presenceOf(findings, "DIP").length >= 1, "DIP presence expected (constructor injection / repository)");
  ok(presenceOf(findings, "ISP").length >= 1, "ISP presence expected (small role interfaces)");
  /* a pattern: OCP/Strategy (IDietaryRule has 2 impls) or the repository pattern */
  const patterns = findings.filter((f) => f.kind === "presence" &&
    (f.principle === "OCP" || /Repository pattern|Strategy|Observer/.test(f.title || "")));
  ok(patterns.length >= 1, "at least one pattern (Strategy/Repository/Observer) presence expected");
});
test("re-exam 2025: both planted smells coexist (downcast + dead dependency)", () => {
  const { findings } = A.scan(loadFixtures("reexam2025"));
  ok(hasRule(findings, "downcast"), "the as-InMemoryRecipeRepository downcast must still fire");
  ok(hasRule(findings, "unused-injected-dependency"), "the dead _rules dependency must fire");
});

/* ---- summer 2025: at least one NEW-rule or presence finding beyond the old set ---- */
test("summer 2025: new rules + presence fire (single-is-downcast, object-collection, marker, presence)", () => {
  const { findings } = A.scan(loadFixtures("summer2025"));
  ok(hasRule(findings, "single-is-downcast"), "is IValidatable/IDisplayableInfo narrowing must fire");
  ok(hasRule(findings, "object-collection"), "List<object> _allDocuments must fire");
  ok(hasRule(findings, "marker-interface"), "IDisplayableInfo {} marker must fire");
  ok(hasRule(findings, "new-in-ctor"), "new DocumentProcessor(logger) in the ctor must fire");
  ok(findings.some((f) => f.kind === "presence" && f.principle === "ISP"),
     "the role interfaces should register as ISP-present");
});

/* ======================================================================
   ANSWER ASSEMBLY v2 — rubric-shaped, 5 sections in order, mixed kinds,
   alternate skeletons differ (spec 02 §3 + §Tests)
   ====================================================================== */
test("assembleAnswer: all five SOLID sections appear in S-O-L-I-D order", () => {
  const { findings } = A.scan(loadFixtures("summer2025"));
  const draft = A.assembleAnswer(findings, { project: "DocumentManager" });
  const order = ["(SRP)", "(OCP)", "(LSP)", "(ISP)", "(DIP)"];
  let prev = -1;
  order.forEach((tag) => {
    const at = draft.indexOf(tag);
    ok(at >= 0, "section heading " + tag + " missing");
    ok(at > prev, "section " + tag + " out of rubric order");
    prev = at;
  });
  includes(draft, "=== Summary ===", "draft must end with a summary section");
});
test("assembleAnswer: a section mixes a presence paragraph with a violation paragraph", () => {
  const { findings } = A.scan(loadFixtures("summer2025"));
  const draft = A.assembleAnswer(findings, { project: "DocumentManager" });
  /* DIP has both a presence finding and the new-in-ctor violation in summer2025 */
  const dipStart = draft.indexOf("(DIP)");
  const summary = draft.indexOf("=== Summary ===");
  const dipSection = draft.slice(dipStart, summary);
  includes(dipSection, "Dependency Inversion is present", "DIP presence paragraph expected");
  includes(dipSection, "Violation", "DIP violation paragraph expected in the same section");
});
test("assembleAnswer: two findings of the same rule use different skeletons", () => {
  /* object-collection has 2 alternate skeletons; two findings must read differently */
  const f = scanSnippet(`
interface IDoc {}
class A { private List<object> _a = new List<object>(); void M(){ var x=_a.OfType<IDoc>().ToList(); } }
class B { private List<object> _b = new List<object>(); void N(){ var y=_b.OfType<IDoc>().ToList(); } }`);
  const oc = byRule(f, "object-collection");
  eq(oc.length, 2, "expected two object-collection findings");
  ok(oc[0].paragraph !== oc[1].paragraph,
     "alternate skeletons must make the two paragraphs read differently");
});

test("assembleAnswer produces structured prose with evidence", () => {
  const { findings } = A.scan(loadFixtures("reexam2025"));
  const draft = A.assembleAnswer(findings.slice(0, 3), { project: "FamilyMealPlanner" });
  includes(draft, "FamilyMealPlanner");
  includes(draft, findings[0].file);
  ok(draft.length > 400, "draft should be a real draft, got " + draft.length + " chars");
});

/* ======================================================================
   EXAM FIXTURES (spec 02 §4 + §Tests) — Node-loadable, shape, verbatim
   ====================================================================== */
const FX = require("../data/exam-fixtures.js");
test("exam-fixtures.js: loads under Node with both 2025 sets", () => {
  ok(FX && FX.summer2025 && FX.reexam2025, "both fixture sets must be present");
  ok(typeof FX.summer2025.label === "string" && FX.summer2025.label.length > 0, "summer label");
  ok(typeof FX.reexam2025.label === "string" && FX.reexam2025.label.length > 0, "reexam label");
});
test("exam-fixtures.js: summer >= 6 files, reexam >= 5 files, every file has name+text", () => {
  ok(FX.summer2025.files.length >= 6, "summer needs >= 6 files, got " + FX.summer2025.files.length);
  ok(FX.reexam2025.files.length >= 5, "reexam needs >= 5 files, got " + FX.reexam2025.files.length);
  [].concat(FX.summer2025.files, FX.reexam2025.files).forEach((f) => {
    ok(typeof f.name === "string" && f.name && typeof f.text === "string" && f.text.length,
       "each fixture file needs a name and non-empty text");
  });
});
test("exam-fixtures.js: every answerKey entry has principle/verdict/paragraph", () => {
  ["summer2025", "reexam2025"].forEach((k) => {
    const ak = FX[k].answerKey;
    ok(Array.isArray(ak) && ak.length === 5, k + " answerKey must cover all 5 principles");
    ak.forEach((e) => {
      ok(typeof e.principle === "string" && e.principle, k + " entry needs a principle");
      ok(typeof e.verdict === "string" && e.verdict, k + " entry needs a verdict");
      ok(typeof e.paragraph === "string" && e.paragraph.length > 40, k + " entry needs a real paragraph");
    });
  });
});
test("exam-fixtures.js: in-app file contents are scannable and reproduce the planted smells", () => {
  /* the in-app copies (CRLF, BOM and all) must scan to the same planted smells */
  const re = A.scan(FX.reexam2025.files).findings;
  ok(hasRule(re, "downcast") && hasRule(re, "unused-injected-dependency"),
     "the in-app re-exam copy must reproduce both planted smells");
  const su = A.scan(FX.summer2025.files).findings;
  ok(hasRule(su, "single-is-downcast") && hasRule(su, "object-collection") && hasRule(su, "marker-interface"),
     "the in-app summer copy must reproduce its new-rule smells");
});

/* ======================================================================
   ANALYZER MODES (spec 08) — violations / implementations / full answer
   ====================================================================== */

/* a fixed findings set with both a presence finding and a violation in the
   same principle (DIP), so each mode's filter is unambiguous */
const MODE_FINDINGS = [
  { kind: "presence", ruleId: "presence-dip-0", principle: "DIP", verdict: "present",
    file: "Service.cs", line: 7, message: "DIP present",
    paragraph: "Dependency Inversion is present: Service depends on IRepo, injected through the constructor (Service.cs:7). Purpose: high-level policy should depend on abstractions." },
  { kind: "violation", ruleId: "downcast", principle: "LSP", severity: "high",
    file: "Service.cs", line: 12, message: "downcast", fix: "lift the member onto the interface",
    paragraph: "In Service.cs (line 12), Service downcasts IRepo to InMemoryRepo. This violates the Liskov Substitution Principle." },
  { kind: "violation", ruleId: "new-in-ctor", principle: "DIP", severity: "high",
    file: "Service.cs", line: 9, message: "new in ctor", fix: "inject an interface",
    paragraph: "In Service.cs (line 9), Service constructs its collaborator with 'new FileLogger(...)'. This violates the Dependency Inversion Principle." },
];

test("modes: filterByMode splits findings by kind, full keeps all", () => {
  eq(A.filterByMode(MODE_FINDINGS, "violations").length, 2, "violations mode keeps the 2 violations");
  ok(A.filterByMode(MODE_FINDINGS, "violations").every((f) => f.kind !== "presence"), "no presence in violations mode");
  eq(A.filterByMode(MODE_FINDINGS, "implementations").length, 1, "implementations mode keeps the 1 presence");
  ok(A.filterByMode(MODE_FINDINGS, "implementations").every((f) => f.kind === "presence"), "only presence in implementations mode");
  eq(A.filterByMode(MODE_FINDINGS, "full").length, 3, "full mode keeps everything");
  /* unknown / missing mode falls back to full (default behaviour preserved) */
  eq(A.filterByMode(MODE_FINDINGS, "bogus").length, 3, "unknown mode behaves like full");
  eq(A.filterByMode(MODE_FINDINGS).length, 3, "missing mode behaves like full");
});

test("modes: violations-only draft has no presence paragraphs", () => {
  const viol = A.filterByMode(MODE_FINDINGS, "violations");
  const draft = A.assembleAnswer(viol, { project: "Svc", mode: "violations" });
  notIncludes(draft, "Dependency Inversion is present", "presence paragraph must not appear in violations mode");
  notIncludes(draft, "is present:", "no presence verdict prose in violations mode");
  includes(draft, "Violation —", "violation paragraphs must appear");
  includes(draft, "Fix: ", "violation fixes must appear");
});

test("modes: implementations-only draft has no violation paragraphs", () => {
  const impl = A.filterByMode(MODE_FINDINGS, "implementations");
  const draft = A.assembleAnswer(impl, { project: "Svc", mode: "implementations" });
  includes(draft, "Dependency Inversion is present", "presence paragraph must appear");
  notIncludes(draft, "Violation —", "no violation paragraph in implementations mode");
  notIncludes(draft, "Fix: ", "no fix lines in implementations mode");
  notIncludes(draft, "downcasts", "no violation language in implementations mode");
});

test("modes: full draft has BOTH presence and violation paragraphs", () => {
  const draft = A.assembleAnswer(MODE_FINDINGS, { project: "Svc", mode: "full" });
  includes(draft, "Dependency Inversion is present", "full mode keeps presence");
  includes(draft, "Violation —", "full mode keeps violations");
  includes(draft, "Fix: ", "full mode keeps fixes");
});

test("modes: 'No clear violation' filler appears per principle with zero violations", () => {
  /* only an LSP violation is selected; SRP/OCP/ISP/DIP have no violation here */
  const onlyLsp = [MODE_FINDINGS[1]];
  const draft = A.assembleAnswer(onlyLsp, { project: "Svc", mode: "violations" });
  includes(draft, "No clear violation of Single Responsibility Principle found", "SRP filler line");
  includes(draft, "No clear violation of Open/Closed Principle found", "OCP filler line");
  includes(draft, "No clear violation of Interface Segregation Principle found", "ISP filler line");
  includes(draft, "No clear violation of Dependency Inversion Principle found", "DIP filler line");
  /* the principle that DOES have a violation gets no filler */
  notIncludes(draft, "No clear violation of Liskov Substitution Principle found", "LSP has a violation, no filler");
  /* all 5 SOLID section headings still present */
  ["(SRP)", "(OCP)", "(LSP)", "(ISP)", "(DIP)"].forEach((tag) => includes(draft, tag, "section " + tag + " present"));
});

test("modes: default (no mode) reproduces old full-answer behaviour", () => {
  const withMode = A.assembleAnswer(MODE_FINDINGS, { project: "Svc", mode: "full" });
  const noMode = A.assembleAnswer(MODE_FINDINGS, { project: "Svc" });
  eq(noMode, withMode, "omitting mode must equal mode:'full'");
});

test("modes: implementations draft on the ReExam fixture is a complete 5-principle 'how implemented' answer", () => {
  /* the spec's Definition of done: ReExam in Implementations mode, Build Draft,
     a complete 5-principle answer with ZERO violation language */
  const { findings } = A.scan(loadFixtures("reexam2025"));
  const impl = A.filterByMode(findings, "implementations");
  const draft = A.assembleAnswer(impl, { project: "FamilyMealPlanner", mode: "implementations" });
  ["(SRP)", "(OCP)", "(LSP)", "(ISP)", "(DIP)"].forEach((tag) =>
    includes(draft, tag, "ReExam implementations draft must cover " + tag));
  notIncludes(draft, "Violation —", "zero violation paragraphs");
  notIncludes(draft, "Fix: ", "zero fix lines");
  notIncludes(draft, "downcast", "no downcast/violation language");
  notIncludes(draft, "violates", "no 'violates' language in implementations mode");
  includes(draft, "is present", "real presence prose for the detected principles");
  /* LSP has no detected presence in the ReExam fixture -> graceful filler, no violation talk */
  includes(draft, "No distinct Liskov Substitution Principle implementation was detected",
    "LSP gets a manual-check filler, keeping the answer complete across all 5 principles");
});

/* ======================================================================
   SPEC 15 — analyzer attribution correctness + context-aware fix text.
   Calibrated against the payment-gateway example Max found defects on.
   ====================================================================== */

/* the spec's calibration fixture, used verbatim: IPaymentGateway (one method
   Charge), an ok StripeGateway, a throwing CashGateway, and an InvoiceService
   with two public fields, a ctor-injected IPaymentGateway, and an UNGUARDED
   'as StripeGateway' downcast that is then dereferenced. */
const PAYMENT_DEMO = `
using System;
namespace Pay
{
    public interface IPaymentGateway
    {
        void Charge(decimal amount);
    }

    public class StripeGateway : IPaymentGateway
    {
        public void Charge(decimal amount) { /* call Stripe */ }
    }

    public class CashGateway : IPaymentGateway
    {
        public void Charge(decimal amount)
        {
            throw new NotImplementedException();   // planted throwing stub
        }
    }

    public class InvoiceService
    {
        public decimal Amount;            // planted public field (ENC)
        public string CustomerEmail;      // planted public field (ENC)

        private readonly IPaymentGateway _gateway;

        public InvoiceService(IPaymentGateway gateway)
        {
            _gateway = gateway;
        }

        public void Pay()
        {
            var stripe = _gateway as StripeGateway;   // planted downcast (DIP-primary)
            stripe.Charge(Amount);                    // unguarded deref -> latent NRE
        }
    }
}`;

function payScan() { return A.scan([{ name: "PaymentDemo.cs", text: PAYMENT_DEMO }]).findings; }

test("spec15: payment-gateway downcast leads with DIP (not LSP)", () => {
  const f = payScan();
  const d = byRule(f, "downcast");
  ok(d.length === 1, "exactly one downcast finding expected, got " + d.length);
  eq(d[0].principle, "DIP", "downcast primary principle must be DIP");
  includes(d[0].paragraph, "Dependency Inversion", "DIP must headline the paragraph");
  includes(d[0].paragraph, "StripeGateway");
  /* LSP must survive as a secondary mention, not the headline */
  includes(d[0].paragraph, "Liskov Substitution");
  ok(d[0].paragraph.indexOf("Dependency Inversion") < d[0].paragraph.indexOf("Liskov Substitution"),
     "DIP must come before the LSP mention");
});

test("spec15: unguarded downcast names a NullReferenceException consequence", () => {
  const f = payScan();
  const d = byRule(f, "downcast")[0];
  includes(d.paragraph, "NullReferenceException",
     "an unguarded, dereferenced 'as' cast must warn about a latent NRE");
});

test("spec15: a NULL-GUARDED downcast does NOT mention NullReferenceException", () => {
  /* the ReExam cast is guarded by 'if (inMemoryRepo == null)' -> no NRE note,
     and the fix text MAY mention deleting the null-check branch */
  const { findings } = A.scan(loadFixtures("reexam2025"));
  const d = byRule(findings, "downcast").find((x) => /InMemoryRecipeRepository/.test(x.excerpt));
  ok(d, "the ReExam downcast must be found");
  eq(d.principle, "DIP", "ReExam downcast must read DIP-primary (matches the official solution)");
  notIncludes(d.paragraph, "NullReferenceException",
     "a null-guarded cast must not claim an NRE consequence");
  includes(d.paragraph, "null-check branch",
     "a guarded cast's fix may reference deleting the null-check branch");
});

test("spec15: an unguarded downcast fix never mentions a null-check branch", () => {
  const f = payScan();
  const d = byRule(f, "downcast")[0];
  notIncludes(d.paragraph, "null-check branch",
     "the payment fixture has no null guard, so the fix must not mention one");
});

test("spec15: DIP presence for InvoiceService carries a reconciliation caveat", () => {
  const f = payScan();
  const dipPres = f.filter((x) => x.kind === "presence" && x.principle === "DIP");
  ok(dipPres.length >= 1, "DIP presence must be detected for the injecting class");
  const withCaveat = dipPres.find((x) => /Caveat/.test(x.paragraph));
  ok(withCaveat, "the DIP presence paragraph must carry a caveat, not assert it is clean");
  includes(withCaveat.paragraph, "InvoiceService", "the caveat must name the offending class");
  includes(withCaveat.paragraph, "broken inside", "the caveat must say DIP is broken inside the class");
});

test("spec15: a control fixture WITHOUT the cast gets NO DIP caveat", () => {
  const clean = `
namespace Pay
{
    public interface IPaymentGateway { void Charge(decimal amount); }
    public class StripeGateway : IPaymentGateway { public void Charge(decimal amount) {} }
    public class InvoiceService
    {
        private readonly IPaymentGateway _gateway;
        public InvoiceService(IPaymentGateway gateway) { _gateway = gateway; }
        public void Pay() { _gateway.Charge(10m); }
    }
}`;
  const f = A.scan([{ name: "Clean.cs", text: clean }]).findings;
  const dipPres = f.filter((x) => x.kind === "presence" && x.principle === "DIP");
  ok(dipPres.length >= 1, "DIP presence still detected on the clean fixture");
  ok(!dipPres.some((x) => /Caveat/.test(x.paragraph)),
     "with no DIP-breaking finding, the presence paragraph must stay unqualified");
});

test("spec15: throw-stub fix on a 1-member interface gives NO split advice", () => {
  const f = payScan();
  const ni = byRule(f, "not-implemented");
  ok(ni.length >= 1, "CashGateway's NotImplementedException stub must fire");
  const cash = ni.find((x) => /CashGateway/.test(x.message)) || ni[0];
  notIncludes(cash.paragraph, "split", "a 1-member interface must not earn 'split' advice");
  notIncludes(cash.paragraph, "Interface Segregation",
     "a single-role interface is not a fat-interface ISP smell");
  includes(cash.paragraph, "implement the contract honestly",
     "the fix must recommend honouring or dropping the contract instead");
});

test("spec15: throw-stub fix on a 4-member interface DOES give split advice", () => {
  const fat = `
namespace Doc
{
    public interface IDocument
    {
        void Open();
        void Close();
        void Print();
        void Fax();
    }
    public class WebDoc : IDocument
    {
        public void Open() {}
        public void Close() {}
        public void Print() {}
        public void Fax() { throw new NotImplementedException(); }
    }
}`;
  const f = A.scan([{ name: "Fat.cs", text: fat }]).findings;
  const ni = byRule(f, "not-implemented");
  ok(ni.length >= 1, "WebDoc.Fax stub must fire");
  const web = ni.find((x) => /WebDoc/.test(x.message)) || ni[0];
  includes(web.paragraph, "split", "a 4-member fat interface must earn 'split it' advice");
  includes(web.paragraph, "Interface Segregation", "the fat-interface case is an ISP smell");
});

test("spec15: throw-stub on a 2-member interface stays below the split threshold", () => {
  /* boundary: 2 members is still a narrow role, not a fat interface */
  const two = `
namespace Doc
{
    public interface IReadWrite { string Read(); void Write(string s); }
    public class ReadOnlyDoc : IReadWrite
    {
        public string Read() => "x";
        public void Write(string s) { throw new NotSupportedException(); }
    }
}`;
  const f = A.scan([{ name: "Two.cs", text: two }]).findings;
  const ni = byRule(f, "not-implemented")[0];
  ok(ni, "the NotSupportedException stub must fire");
  notIncludes(ni.paragraph, "split", "2 members is below the 3+ split threshold");
});

test("spec15: ENC findings on both public fields unchanged (regression guard)", () => {
  const f = payScan();
  const enc = byRule(f, "public-field");
  eq(enc.length, 2, "both public mutable fields must still be flagged");
  enc.forEach((e) => eq(e.principle, "ENC"));
  const names = enc.map((e) => e.message).join(" | ");
  includes(names, "Amount");
  includes(names, "CustomerEmail");
});

test("spec15: assembleAnswer (full) places the downcast under DIP with the qualified presence, no contradiction", () => {
  const f = payScan();
  const draft = A.assembleAnswer(f, { project: "PaymentDemo", mode: "full" });
  const dipStart = draft.indexOf("(DIP)");
  const summary = draft.indexOf("=== Summary ===");
  ok(dipStart >= 0 && summary > dipStart, "DIP section + summary must exist");
  const dipSection = draft.slice(dipStart, summary);
  /* the downcast violation lives in the DIP section now (not LSP) */
  includes(dipSection, "StripeGateway", "the downcast belongs under the DIP section");
  includes(dipSection, "Dependency Inversion is present", "the qualified presence sits in DIP too");
  includes(dipSection, "Caveat", "the DIP presence in-section carries its reconciliation caveat");
  /* the LSP section must NOT carry the downcast as its headline violation */
  const lspStart = draft.indexOf("(LSP)");
  const ispStart = draft.indexOf("(ISP)");
  const lspSection = draft.slice(lspStart, ispStart);
  notIncludes(lspSection, "Downcast of an injected abstraction",
     "the downcast must not headline the LSP section");
});
