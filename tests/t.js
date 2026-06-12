"use strict";
let passed = 0, failed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed++; }
  catch (e) { failed++; failures.push({ name, msg: e.message }); }
}
function eq(actual, expected, msg) {
  if (actual !== expected) throw new Error((msg || "eq") + ": expected " + JSON.stringify(expected) + ", got " + JSON.stringify(actual));
}
function ok(cond, msg) { if (!cond) throw new Error(msg || "expected truthy"); }
function includes(haystack, needle, msg) {
  if (typeof haystack !== "string" || haystack.indexOf(needle) === -1)
    throw new Error((msg || "includes") + ": missing " + JSON.stringify(needle));
}
function notIncludes(haystack, needle, msg) {
  if (typeof haystack === "string" && haystack.indexOf(needle) !== -1)
    throw new Error((msg || "notIncludes") + ": found forbidden " + JSON.stringify(needle));
}
/* XML well-formedness: every <Tag ...> has a matching </Tag> or is self-closing */
function xmlBalanced(xml) {
  const stack = [];
  const re = /<(\/?)([A-Za-z][\w.:]*)((?:"[^"]*"|[^"<>])*?)(\/?)>/g;
  let m;
  while ((m = re.exec(xml))) {
    const close = m[1], tag = m[2], self = m[4];
    if (self) continue;
    if (close) {
      const top = stack.pop();
      if (top !== tag) throw new Error("xmlBalanced: expected </" + top + ">, got </" + tag + ">");
    } else stack.push(tag);
  }
  if (stack.length) throw new Error("xmlBalanced: unclosed " + stack.join(", "));
}
function summary() {
  failures.forEach((f) => console.error("FAIL  " + f.name + "\n      " + f.msg));
  console.log((failed ? "FAILED " : "ok ") + passed + " passed, " + failed + " failed");
  if (failed) process.exit(1);
}
module.exports = { test, eq, ok, includes, notIncludes, xmlBalanced, summary };
