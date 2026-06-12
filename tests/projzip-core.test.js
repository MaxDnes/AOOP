"use strict";
const { test, eq, ok, includes, notIncludes, xmlBalanced } = require("./t.js");
const Z = require("../data/projzip-core.js");

/* ---------- helpers ---------- */

const hex32 = (n) => ("00000000" + (n >>> 0).toString(16)).slice(-8);

/* read a little-endian u16/u32 out of a Uint8Array */
function u16(buf, off) { return buf[off] | (buf[off + 1] << 8); }
function u32(buf, off) {
  return (buf[off] | (buf[off + 1] << 8) | (buf[off + 2] << 16) | (buf[off + 3] << 24)) >>> 0;
}
/* find every offset of a 4-byte signature in the buffer */
function findSig(buf, sig) {
  const out = [];
  for (let i = 0; i + 4 <= buf.length; i++) {
    if (u32(buf, i) === sig) out.push(i);
  }
  return out;
}
const LOCAL_SIG = 0x04034b50;   // PK\x03\x04
const CENTRAL_SIG = 0x02014b50; // PK\x01\x02
const EOCD_SIG = 0x06054b50;    // PK\x05\x06

/* entries -> map {path: text}, decoding the STORE payloads back out of the zip,
   so a test can assert the bytes actually round-trip. */
function readZip(buf) {
  const eocd = findSig(buf, EOCD_SIG);
  ok(eocd.length === 1, "exactly one EOCD");
  const e = eocd[0];
  const total = u16(buf, e + 10);
  const centralOff = u32(buf, e + 16);
  const files = {};
  let p = centralOff;
  for (let i = 0; i < total; i++) {
    ok(u32(buf, p) === CENTRAL_SIG, "central sig at entry " + i);
    const nameLen = u16(buf, p + 28);
    const extraLen = u16(buf, p + 30);
    const commentLen = u16(buf, p + 32);
    const localOff = u32(buf, p + 42);
    const name = utf8Decode(buf.subarray(p + 46, p + 46 + nameLen));
    // jump to the local header to read the data
    ok(u32(buf, localOff) === LOCAL_SIG, "local sig for " + name);
    const lNameLen = u16(buf, localOff + 26);
    const lExtraLen = u16(buf, localOff + 28);
    const size = u32(buf, localOff + 22);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    files[name] = utf8Decode(buf.subarray(dataStart, dataStart + size));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return { files, total, centralOff };
}

/* minimal UTF-8 decoder (Node Buffer if present, else manual) */
function utf8Decode(bytes) {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("utf8");
  let s = "", i = 0;
  while (i < bytes.length) {
    let c = bytes[i++];
    if (c < 0x80) s += String.fromCharCode(c);
    else if (c < 0xE0) s += String.fromCharCode(((c & 0x1F) << 6) | (bytes[i++] & 0x3F));
    else if (c < 0xF0) s += String.fromCharCode(((c & 0x0F) << 12) | ((bytes[i++] & 0x3F) << 6) | (bytes[i++] & 0x3F));
    else {
      const cp = ((c & 0x07) << 18) | ((bytes[i++] & 0x3F) << 12) | ((bytes[i++] & 0x3F) << 6) | (bytes[i++] & 0x3F);
      const u = cp - 0x10000;
      s += String.fromCharCode(0xD800 + (u >> 10), 0xDC00 + (u & 0x3FF));
    }
  }
  return s;
}

function findEntry(entries, path) {
  return entries.find((e) => e.path === path);
}

/* ============================================================
 * CRC-32 known vectors
 * ============================================================ */
test("crc32 of empty string is 0x00000000", () => {
  eq(hex32(Z.crc32(Z.utf8Bytes(""))), "00000000");
});
test('crc32 of "abc" is 0x352441c2', () => {
  eq(hex32(Z.crc32(Z.utf8Bytes("abc"))), "352441c2");
});
test('crc32 of "123456789" is 0xcbf43926 (canonical check value)', () => {
  eq(hex32(Z.crc32(Z.utf8Bytes("123456789"))), "cbf43926");
});
test("crc32 of the pangram is 0x414fa339", () => {
  eq(hex32(Z.crc32(Z.utf8Bytes("The quick brown fox jumps over the lazy dog"))), "414fa339");
});
test("crc32 of a longer multi-line utf-8 string is stable + nonzero", () => {
  const s = "héllo wörld → ☕\nsecond line with emoji 😀 and áccénts";
  const c = Z.crc32(Z.utf8Bytes(s));
  ok((c >>> 0) !== 0, "nonzero crc");
  // recompute to prove determinism
  eq(Z.crc32(Z.utf8Bytes(s)), c, "deterministic");
});

/* ============================================================
 * UTF-8 encoding edge cases (multibyte + surrogate pairs)
 * ============================================================ */
test("utf8Bytes encodes ascii one byte each", () => {
  eq(Z.utf8Bytes("abc").length, 3);
});
test("utf8Bytes encodes BMP + astral chars to correct byte counts", () => {
  eq(Z.utf8Bytes("é").length, 2, "2-byte");
  eq(Z.utf8Bytes("→").length, 3, "3-byte");
  eq(Z.utf8Bytes("😀").length, 4, "4-byte surrogate pair");
});

/* ============================================================
 * ZIP structure bytes
 * ============================================================ */
test("makeZip throws on empty input", () => {
  let threw = false;
  try { Z.makeZip([]); } catch (e) { threw = true; }
  ok(threw, "expected throw on empty entries");
});

test("zip has one local header per entry, matching central + EOCD counts", () => {
  const entries = [
    { path: "a.txt", text: "alpha" },
    { path: "dir/b.txt", text: "bravo bravo" },
    { path: "dir/sub/c.json", text: "{\"k\":1}" },
  ];
  const buf = Z.makeZip(entries);
  ok(buf instanceof Uint8Array, "returns Uint8Array");
  const locals = findSig(buf, LOCAL_SIG);
  const centrals = findSig(buf, CENTRAL_SIG);
  const eocds = findSig(buf, EOCD_SIG);
  eq(locals.length, 3, "3 local headers");
  eq(centrals.length, 3, "3 central headers");
  eq(eocds.length, 1, "1 EOCD");
  // EOCD entry counts
  const e = eocds[0];
  eq(u16(buf, e + 8), 3, "EOCD entries on disk");
  eq(u16(buf, e + 10), 3, "EOCD total entries");
});

test("EOCD central-dir offset + size point at the real central directory", () => {
  const entries = [
    { path: "one.txt", text: "1" },
    { path: "two.txt", text: "22" },
  ];
  const buf = Z.makeZip(entries);
  const e = findSig(buf, EOCD_SIG)[0];
  const centralSize = u32(buf, e + 12);
  const centralOff = u32(buf, e + 16);
  // first central header must sit exactly at centralOff
  eq(u32(buf, centralOff), CENTRAL_SIG, "central dir starts at declared offset");
  // central dir + its size must end exactly where the EOCD begins
  eq(centralOff + centralSize, e, "central size consistent with EOCD position");
});

test("local headers use STORE (method 0) and the UTF-8 flag bit", () => {
  const buf = Z.makeZip([{ path: "x.txt", text: "hi" }]);
  const off = findSig(buf, LOCAL_SIG)[0];
  eq(u16(buf, off + 8), 0, "compression method STORE");
  eq(u16(buf, off + 6) & 0x0800, 0x0800, "UTF-8 general purpose flag set");
});

test("stored CRC + sizes in the local header match the payload", () => {
  const text = "the quick brown fox";
  const buf = Z.makeZip([{ path: "f.txt", text }]);
  const off = findSig(buf, LOCAL_SIG)[0];
  const storedCrc = u32(buf, off + 14);
  const compSize = u32(buf, off + 18);
  const uncompSize = u32(buf, off + 22);
  const expectBytes = Z.utf8Bytes(text);
  eq(storedCrc, Z.crc32(expectBytes), "crc matches");
  eq(compSize, expectBytes.length, "compressed size == byte length (STORE)");
  eq(uncompSize, expectBytes.length, "uncompressed size == byte length");
});

test("payloads round-trip: extracting the zip yields the original text", () => {
  const entries = [
    { path: "Program.cs", text: "Console.WriteLine(\"hi\");\n" },
    { path: "data/spaceships.json", text: "[ { \"Name\": \"Rocinante\" } ]" },
    { path: "unicode.txt", text: "café → 😀" },
  ];
  const buf = Z.makeZip(entries);
  const { files, total } = readZip(buf);
  eq(total, 3, "round-trip count");
  eq(files["Program.cs"], "Console.WriteLine(\"hi\");\n");
  eq(files["data/spaceships.json"], "[ { \"Name\": \"Rocinante\" } ]");
  eq(files["unicode.txt"], "café → 😀");
});

test("backslash paths are normalized to forward slashes", () => {
  const buf = Z.makeZip([{ path: "Views\\MainWindow.axaml", text: "<Window/>" }]);
  const { files } = readZip(buf);
  ok(Object.keys(files).indexOf("Views/MainWindow.axaml") !== -1, "forward-slash path");
});

/* ============================================================
 * makeZipBlobUrl is guarded for Node (no Blob)
 * ============================================================ */
test("makeZipBlobUrl throws gracefully when Blob is unavailable (Node)", () => {
  if (typeof Blob !== "undefined") return; // skip in a browser-like runtime
  let threw = false;
  try { Z.makeZipBlobUrl([{ path: "a", text: "b" }]); } catch (e) { threw = true; }
  ok(threw, "expected a clear throw, not a crash");
});

/* ============================================================
 * sanitizeName + rewriteNamespace
 * ============================================================ */
test("sanitizeName turns junk into a legal namespace", () => {
  eq(Z.sanitizeName("My App!"), "My_App");
  eq(Z.sanitizeName("123Start"), "_123Start", "must not start with a digit");
  eq(Z.sanitizeName("  weird///name  "), "weird_name");
  eq(Z.sanitizeName(""), "ExamProject", "empty -> fallback");
  eq(Z.sanitizeName("", "Fallback"), "Fallback");
});

test("rewriteNamespace rewrites the ExamApp root token only", () => {
  const src = 'namespace ExamApp.ViewModels;\nusing ExamApp.Views;\nx:Class="ExamApp.App"';
  const out = Z.rewriteNamespace(src, "RectangleUI");
  includes(out, "namespace RectangleUI.ViewModels;");
  includes(out, "using RectangleUI.Views;");
  includes(out, 'x:Class="RectangleUI.App"');
  notIncludes(out, "ExamApp", "no leftover ExamApp token");
});

/* ============================================================
 * avaloniaProject scaffold
 * ============================================================ */
test("avaloniaProject emits the full Starter-Kit file set", () => {
  const entries = Z.avaloniaProject("RectangleUI", {});
  const paths = entries.map((e) => e.path);
  ["RectangleUI.csproj", "Program.cs", "App.axaml", "App.axaml.cs", "ViewLocator.cs",
   "ViewModels/ViewModelBase.cs", "ViewModels/MainWindowViewModel.cs",
   "Views/MainWindow.axaml", "Views/MainWindow.axaml.cs"].forEach((p) => {
    ok(paths.indexOf(p) !== -1, "missing " + p);
  });
});

test("avaloniaProject csproj carries the exact Avalonia + MVVM versions", () => {
  const entries = Z.avaloniaProject("DemoApp", {});
  const csproj = findEntry(entries, "DemoApp.csproj").text;
  includes(csproj, '<PackageReference Include="Avalonia" Version="11.2.1" />');
  includes(csproj, '<PackageReference Include="Avalonia.Desktop" Version="11.2.1" />');
  includes(csproj, '<PackageReference Include="Avalonia.Themes.Fluent" Version="11.2.1" />');
  includes(csproj, '<PackageReference Include="Avalonia.Fonts.Inter" Version="11.2.1" />');
  includes(csproj, '<PackageReference Include="CommunityToolkit.Mvvm" Version="8.2.1" />');
  includes(csproj, "<TargetFramework>net9.0</TargetFramework>");
  includes(csproj, "<OutputType>WinExe</OutputType>");
  // standalone app: must NOT carry the Tests InternalsVisibleTo from the Starter Kit
  notIncludes(csproj, "InternalsVisibleTo");
  xmlBalanced(csproj);
});

test("avaloniaProject rewrites designer ExamApp.* namespaces to the project name", () => {
  // simulate what the designer emits
  const axaml =
    '<Window xmlns="https://github.com/avaloniaui"\n' +
    '        xmlns:vm="using:ExamApp.ViewModels"\n' +
    '        x:Class="ExamApp.Views.MainWindow"\n' +
    '        x:DataType="vm:MainWindowViewModel">\n' +
    '    <Design.DataContext><vm:MainWindowViewModel/></Design.DataContext>\n' +
    '    <TextBlock Text="hi"/>\n' +
    '</Window>\n';
  const viewModel =
    "using CommunityToolkit.Mvvm.ComponentModel;\n" +
    "namespace ExamApp.ViewModels;\n" +
    "public partial class MainWindowViewModel : ViewModelBase { }\n";
  const entries = Z.avaloniaProject("RectangleUI", { axaml, viewModel });
  const mw = findEntry(entries, "Views/MainWindow.axaml").text;
  const vm = findEntry(entries, "ViewModels/MainWindowViewModel.cs").text;
  includes(mw, 'xmlns:vm="using:RectangleUI.ViewModels"');
  includes(mw, 'x:Class="RectangleUI.Views.MainWindow"');
  notIncludes(mw, "ExamApp");
  includes(vm, "namespace RectangleUI.ViewModels;");
  notIncludes(vm, "ExamApp");
  // App + Program must agree on the rewritten root namespace
  includes(findEntry(entries, "Program.cs").text, "namespace RectangleUI;");
  includes(findEntry(entries, "App.axaml.cs").text, "using RectangleUI.ViewModels;");
  includes(findEntry(entries, "App.axaml").text, 'x:Class="RectangleUI.App"');
});

test("avaloniaProject does not double-wrap a complete Window behind a comment banner", () => {
  // a complete Window preceded by an XML comment must be detected as complete
  const commented =
    "<!-- generated by the Async Composer -->\n" +
    '<Window xmlns="https://github.com/avaloniaui"\n' +
    '        x:Class="ExamApp.Views.MainWindow">\n' +
    '    <TextBlock Text="hi"/>\n' +
    "</Window>\n";
  const entries = Z.avaloniaProject("CommentApp", { axaml: commented });
  const mw = findEntry(entries, "Views/MainWindow.axaml").text;
  eq(mw.split("<Window").length - 1, 1, "exactly one Window root, no nested wrap");
  // a genuine fragment (no Window root) must still be wrapped
  const frag = Z.avaloniaProject("FragApp", { axaml: '<TextBlock Text="hi"/>' });
  const fragMw = findEntry(frag, "Views/MainWindow.axaml").text;
  eq(fragMw.split("<Window").length - 1, 1, "fragment gets exactly one Window shell");
  includes(fragMw, 'Text="hi"');
});

test("avaloniaProject sanitizes a messy window title into a legal name", () => {
  const entries = Z.avaloniaProject("Family Meal Planner!", {});
  ok(findEntry(entries, "Family_Meal_Planner.csproj"), "csproj uses sanitized name");
  includes(findEntry(entries, "Program.cs").text, "namespace Family_Meal_Planner;");
});

test("avaloniaProject writes each model file under Models/ with rewritten namespace", () => {
  const entries = Z.avaloniaProject("RectangleUI", {
    models: [{
      name: "RectItem",
      text: "namespace ExamApp.ViewModels;\npublic partial class RectItem { }\n"
    }]
  });
  const model = findEntry(entries, "Models/RectItem.cs");
  ok(model, "Models/RectItem.cs exists");
  includes(model.text, "namespace RectangleUI.ViewModels;");
  notIncludes(model.text, "ExamApp");
});

test("avaloniaProject MainWindow.axaml.cs holds only InitializeComponent", () => {
  const entries = Z.avaloniaProject("DemoApp", {});
  const cb = findEntry(entries, "Views/MainWindow.axaml.cs").text;
  includes(cb, "InitializeComponent();");
  includes(cb, "namespace DemoApp.Views;");
  // no logic leaked into code-behind
  notIncludes(cb, "RelayCommand");
});

/* ============================================================
 * xunitProject scaffold (plain + headless)
 * ============================================================ */
test("xunitProject (plain) csproj carries exact test versions, no headless pkgs", () => {
  const entries = Z.xunitProject("ExamApp.Tests", {
    sourceFiles: [{ name: "MainWindowViewModel", text: "public class MainWindowViewModel {}" }],
    testFiles: [{ name: "ViewModelTests", text: "public class ViewModelTests {}" }],
    headless: false
  });
  const csproj = findEntry(entries, "ExamApp.Tests.csproj").text;
  includes(csproj, '<PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.14.1" />');
  includes(csproj, '<PackageReference Include="xunit" Version="2.9.3" />');
  includes(csproj, '<PackageReference Include="xunit.runner.visualstudio" Version="3.1.4" />');
  includes(csproj, '<PackageReference Include="coverlet.collector" Version="6.0.4" />');
  notIncludes(csproj, "Avalonia.Headless.XUnit");
  notIncludes(csproj, "ProjectReference"); // standalone: source is copied in
  includes(csproj, '<Using Include="Xunit" />');
  xmlBalanced(csproj);
});

test("xunitProject (headless) adds Avalonia.Headless.XUnit + TestAppBuilder", () => {
  const entries = Z.xunitProject("ExamApp.Tests", {
    sourceFiles: [{ name: "MainWindowViewModel", text: "x" }],
    testFiles: [{ name: "UiTests", text: "y" }],
    headless: true
  });
  const csproj = findEntry(entries, "ExamApp.Tests.csproj").text;
  includes(csproj, '<PackageReference Include="Avalonia.Headless.XUnit" Version="11.2.1" />');
  includes(csproj, '<PackageReference Include="Avalonia" Version="11.2.1" />');
  xmlBalanced(csproj);
  const tab = findEntry(entries, "TestAppBuilder.cs");
  ok(tab, "TestAppBuilder.cs present when headless");
  includes(tab.text, "AvaloniaTestApplication(typeof(TestAppBuilder))");
  includes(tab.text, "UseHeadless");
});

test("xunitProject copies sources under Source/ and tests under Tests/", () => {
  const entries = Z.xunitProject("ExamApp.Tests", {
    sourceFiles: [{ name: "Counter", text: "public class Counter {}" }],
    testFiles: [{ name: "CounterTests", text: "public class CounterTests {}" }],
    headless: false
  });
  ok(findEntry(entries, "Source/Counter.cs"), "Source/Counter.cs");
  ok(findEntry(entries, "Tests/CounterTests.cs"), "Tests/CounterTests.cs");
});

test("xunitProject (plain) has no TestAppBuilder", () => {
  const entries = Z.xunitProject("ExamApp.Tests", {
    sourceFiles: [{ name: "A", text: "class A{}" }],
    testFiles: [{ name: "T", text: "class T{}" }],
    headless: false
  });
  ok(!findEntry(entries, "TestAppBuilder.cs"), "no headless builder for plain mode");
});

/* ============================================================
 * consoleProject scaffold
 * ============================================================ */
test("consoleProject emits net9.0 Exe csproj with ImplicitUsings + Nullable", () => {
  const entries = Z.consoleProject("QueryConsole", {
    programCs: "Console.WriteLine(\"hi\");",
    dataFiles: [{ path: "data.json", text: "[]" }]
  });
  const csproj = findEntry(entries, "QueryConsole.csproj").text;
  includes(csproj, "<OutputType>Exe</OutputType>");
  includes(csproj, "<TargetFramework>net9.0</TargetFramework>");
  includes(csproj, "<ImplicitUsings>enable</ImplicitUsings>");
  includes(csproj, "<Nullable>enable</Nullable>");
  xmlBalanced(csproj);
});

test("consoleProject wires each data file with CopyToOutputDirectory PreserveNewest", () => {
  const entries = Z.consoleProject("QueryConsole", {
    programCs: "// p",
    dataFiles: [{ path: "spaceships.json", text: "[]" }]
  });
  const csproj = findEntry(entries, "QueryConsole.csproj").text;
  includes(csproj, '<None Update="spaceships.json">');
  includes(csproj, "<CopyToOutputDirectory>PreserveNewest</CopyToOutputDirectory>");
  ok(findEntry(entries, "spaceships.json"), "data file present in the project root");
  ok(findEntry(entries, "Program.cs"), "Program.cs present");
});

test("consoleProject without data files omits the data ItemGroup", () => {
  const entries = Z.consoleProject("AsyncConsole", { programCs: "// p" });
  const csproj = findEntry(entries, "AsyncConsole.csproj").text;
  notIncludes(csproj, "CopyToOutputDirectory");
  xmlBalanced(csproj);
});

/* ============================================================
 * every scaffold csproj is xmlBalanced (defensive sweep)
 * ============================================================ */
test("all scaffold csproj/axaml files are XML-balanced", () => {
  const all = []
    .concat(Z.avaloniaProject("DemoApp", {}))
    .concat(Z.xunitProject("DemoApp.Tests", { headless: true, sourceFiles: [], testFiles: [] }))
    .concat(Z.consoleProject("DemoConsole", { programCs: "//", dataFiles: [{ path: "d.json", text: "[]" }] }));
  all.filter((e) => /\.(csproj|axaml)$/.test(e.path)).forEach((e) => {
    xmlBalanced(e.text);
  });
});

/* ============================================================
 * an end-to-end zip of a real scaffold round-trips intact
 * ============================================================ */
test("zipping an avalonia scaffold round-trips all entries by path", () => {
  const entries = Z.avaloniaProject("RectangleUI", {});
  const buf = Z.makeZip(entries);
  const { files } = readZip(buf);
  entries.forEach((e) => {
    ok(Object.prototype.hasOwnProperty.call(files, e.path), "round-trip path " + e.path);
    eq(files[e.path], e.text, "round-trip content " + e.path);
  });
});
