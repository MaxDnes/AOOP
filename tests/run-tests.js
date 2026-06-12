"use strict";
const fs = require("fs"), path = require("path");
const dir = __dirname;

/* Each tests/*.test.js is written to pass standalone (master plan: every
   data/*.js stays Node-loadable, and several tests rely on a fresh
   require("../data/<x>.js") to re-run a module's side effects, e.g. resetting
   global.PROJZIP after a `delete`). When the whole suite runs in one process the
   module cache is shared, so a data module required by an earlier file is a cache
   hit for a later file and its side-effect assignment never re-runs. Clearing the
   data/ module cache BETWEEN test files restores the in-isolation behaviour each
   file was written against, without touching the t.js accumulator (so counts and
   the single shared summary stay correct). */
function clearDataCache() {
  for (const key of Object.keys(require.cache)) {
    const norm = key.split(path.sep).join("/");
    if (norm.indexOf("/data/") !== -1) delete require.cache[key];
  }
}

fs.readdirSync(dir).filter((f) => f.endsWith(".test.js")).sort()
  .forEach((f) => { clearDataCache(); require(path.join(dir, f)); });
require("./t.js").summary();
