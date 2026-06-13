/* ============================================================
   ANALYZER CORE · pure OOP/SOLID heuristic scanner
   UMD module: attaches window.ANALYZER_CORE in the browser and
   module.exports under Node. NO DOM access anywhere in this file.
   Calibrated against the 2025 summer (DocumentManager) and
   re-exam (FamilyMealPlanner) Problem 1 codebases.
   ============================================================ */

(function (global) {
  "use strict";

  /* ================= text preparation ================= */

  /* Replace string/char literals and comments with same-length spaces
     so rules never fire inside literals. Line structure is preserved:
     character offsets and line numbers map 1:1 onto the original text. */
  function stripForScan(text) {
    const src = String(text == null ? "" : text);
    const out = src.split("");
    const n = src.length;
    const blank = (idx) => {
      const c = out[idx];
      if (c !== "\n" && c !== "\r") out[idx] = " ";
    };
    let i = 0;
    while (i < n) {
      const c = src[i], d = src[i + 1];
      /* line comment */
      if (c === "/" && d === "/") {
        while (i < n && src[i] !== "\n") { blank(i); i++; }
        continue;
      }
      /* block comment */
      if (c === "/" && d === "*") {
        blank(i); blank(i + 1); i += 2;
        while (i < n && !(src[i] === "*" && src[i + 1] === "/")) { blank(i); i++; }
        if (i < n) { blank(i); blank(i + 1); i += 2; }
        continue;
      }
      /* string literal: "  @"  $"  $@"  @$"  */
      if (c === '"' || ((c === "@" || c === "$") && (d === '"' || ((d === "@" || d === "$") && src[i + 2] === '"')))) {
        let j = i;
        let verbatim = false;
        while (src[j] === "@" || src[j] === "$") { if (src[j] === "@") verbatim = true; blank(j); j++; }
        blank(j); j++; /* opening quote */
        while (j < n) {
          if (verbatim) {
            if (src[j] === '"' && src[j + 1] === '"') { blank(j); blank(j + 1); j += 2; continue; }
            if (src[j] === '"') { blank(j); j++; break; }
          } else {
            if (src[j] === "\\") { blank(j); if (j + 1 < n) blank(j + 1); j += 2; continue; }
            if (src[j] === '"') { blank(j); j++; break; }
            if (src[j] === "\n") break; /* unterminated — stop at newline */
          }
          blank(j); j++;
        }
        i = j;
        continue;
      }
      /* char literal */
      if (c === "'") {
        let j = i;
        blank(j); j++;
        let steps = 0;
        while (j < n && src[j] !== "'" && src[j] !== "\n" && steps < 12) {
          if (src[j] === "\\") { blank(j); j++; steps++; }
          if (j < n) { blank(j); j++; steps++; }
        }
        if (j < n && src[j] === "'") { blank(j); j++; }
        i = j;
        continue;
      }
      i++;
    }
    return out.join("");
  }

  function lineOfIndex(text, idx) {
    let line = 1;
    const end = Math.min(idx, text.length);
    for (let i = 0; i < end; i++) if (text[i] === "\n") line++;
    return line;
  }

  /* Find the brace span of the next { ... } block after fromIdx.
     Returns null if a ';' arrives first (e.g. bodyless record) or
     no brace exists. Clamps on unbalanced input instead of throwing. */
  function findSpan(stripped, fromIdx) {
    const n = stripped.length;
    let i = fromIdx;
    while (i < n && stripped[i] !== "{" && stripped[i] !== ";") i++;
    if (i >= n || stripped[i] === ";") return null;
    let d = 0;
    for (let j = i; j < n; j++) {
      if (stripped[j] === "{") d++;
      else if (stripped[j] === "}") { d--; if (d === 0) return { open: i, close: j }; }
    }
    return { open: i, close: n - 1 };
  }

  /* Shallow member list of an interface body: depth-0 ';' ends a method
     member, a depth-0 { ... } block ends a property member. */
  function interfaceMembers(body) {
    const members = [];
    let depth = 0, cur = "";
    for (let i = 0; i < body.length; i++) {
      const ch = body[i];
      if (ch === "{") { depth++; continue; }
      if (ch === "}") {
        depth--;
        if (depth === 0) { if (cur.trim()) members.push(cur.trim()); cur = ""; }
        continue;
      }
      if (depth === 0) {
        if (ch === ";") { if (cur.trim()) members.push(cur.trim()); cur = ""; }
        else cur += ch;
      }
    }
    return members;
  }

  /* ================= indexing ================= */

  const TYPE_DECL_RE = /\b(class|interface|record|enum)\s+([A-Za-z_]\w*)/g;

  function buildIndex(files) {
    const index = { classes: {}, interfaces: {}, enums: [] };
    (Array.isArray(files) ? files : []).forEach((f) => {
      if (!f || typeof f.text !== "string") return;
      const stripped = stripForScan(f.text);
      const re = new RegExp(TYPE_DECL_RE.source, "g");
      let m;
      while ((m = re.exec(stripped))) {
        const kind = m[1], name = m[2];
        const line = lineOfIndex(stripped, m.index);
        if (kind === "interface") {
          const span = findSpan(stripped, re.lastIndex);
          const members = span ? interfaceMembers(stripped.slice(span.open + 1, span.close)) : [];
          index.interfaces[name] = { file: f.name, line, members };
        } else if (kind === "enum") {
          index.enums.push({ name, file: f.name, line });
        } else {
          const lineStart = stripped.lastIndexOf("\n", m.index) + 1;
          const isAbstract = /\babstract\b/.test(stripped.slice(lineStart, m.index));
          index.classes[name] = { file: f.name, line, isAbstract };
        }
      }
    });
    return index;
  }

  /* ================= per-file context ================= */

  const CTRL_KEYWORDS = new Set(("if for foreach while switch using lock catch fixed return throw new " +
    "nameof typeof sizeof checked unchecked base this get set init add remove when else do try finally " +
    "unsafe default delegate select from where await yield out ref in is as not and or").split(" "));

  function fileContext(file) {
    const text = String(file.text == null ? "" : file.text);
    const stripped = stripForScan(text);
    const lines = text.split("\n");
    const strippedLines = stripped.split("\n");
    const n = stripped.length;
    const depth = new Array(n + 1);
    let d = 0;
    for (let i = 0; i < n; i++) {
      depth[i] = d;
      if (stripped[i] === "{") d++;
      else if (stripped[i] === "}") d--;
    }
    depth[n] = d;
    const ctx = { name: String(file.name || "file.cs"), text, stripped, lines, strippedLines, depth, classes: [] };
    const re = new RegExp(TYPE_DECL_RE.source, "g");
    let m;
    while ((m = re.exec(stripped))) {
      const span = findSpan(stripped, re.lastIndex);
      if (!span) continue;
      ctx.classes.push({
        kind: m[1], name: m[2], declIdx: m.index,
        line: lineOfIndex(stripped, m.index),
        open: span.open, close: span.close, members: [],
      });
    }
    ctx.classes.forEach((cls) => {
      if (cls.kind === "class" || cls.kind === "record") cls.members = memberSpans(ctx, cls);
    });
    return ctx;
  }

  /* Method + constructor spans declared at member level of a class. */
  function memberSpans(ctx, cls) {
    const res = [];
    const re = /([A-Za-z_]\w*)\s*(?:<[^<>()]*>)?\s*\(([^()]*)\)\s*(?:where\b[^{;]*?)?\s*(\{|=>)/g;
    re.lastIndex = cls.open + 1;
    let m;
    while ((m = re.exec(ctx.stripped))) {
      if (m.index >= cls.close) break;
      const name = m[1];
      if (CTRL_KEYWORDS.has(name)) continue;
      const before = ctx.stripped.slice(Math.max(0, m.index - 8), m.index);
      if (/\.\s*$/.test(before) || /\bnew\s*$/.test(before)) continue;
      if (ctx.depth[m.index] !== ctx.depth[cls.open] + 1) continue;
      const tail = m[3];
      let open, close;
      if (tail === "{") {
        const span = findSpan(ctx.stripped, m.index + m[0].length - 1);
        if (!span) continue;
        open = span.open; close = span.close;
      } else {
        open = m.index + m[0].length - 1;
        close = ctx.stripped.indexOf(";", open);
        if (close < 0 || close > cls.close) close = cls.close;
      }
      res.push({ name, params: m[2], open, close, headIdx: m.index, isCtor: name === cls.name });
    }
    return res;
  }

  function innermostClass(ctx, idx, kinds) {
    let best = null;
    for (let i = 0; i < ctx.classes.length; i++) {
      const c = ctx.classes[i];
      if (idx <= c.open || idx >= c.close) continue;
      if (kinds && kinds.indexOf(c.kind) === -1) continue;
      if (!best || c.open > best.open) best = c;
    }
    return best;
  }

  function excerptAt(ctx, line) {
    return (ctx.lines[line - 1] || "").trim();
  }

  function isPublicMember(ctx, mb) {
    const lineStart = ctx.stripped.lastIndexOf("\n", mb.headIdx) + 1;
    return /\bpublic\b/.test(ctx.stripped.slice(lineStart, mb.headIdx));
  }

  /* ================= principles ================= */

  const PRINCIPLES = {
    SRP: {
      name: "Single Responsibility Principle",
      summary: "A class should have exactly one reason to change — one actor or concern it answers to. When a class mixes domain logic with I/O, persistence or presentation, a change to any one concern forces edits and re-testing of the others. Splitting responsibilities into separate classes keeps changes local, makes each class unit-testable in isolation, and makes the design easy to name and reason about.",
    },
    OCP: {
      name: "Open/Closed Principle",
      summary: "Software entities should be open for extension but closed for modification: new behaviour is added by writing new classes that plug into existing abstractions (a new strategy, a new rule), not by editing code that already works. Type-check chains and hard-coded policy values are the classic symptoms — every new variant then forces a modification of existing, already-tested code.",
    },
    LSP: {
      name: "Liskov Substitution Principle",
      summary: "Any subtype or interface implementation must be usable wherever its base type is expected, without the client knowing or caring which concrete type it got. Downcasts to one specific implementation, NotImplementedException stubs and 'new' member hiding all break substitutability: the client stops working for the abstraction and starts working only for one concrete class.",
    },
    ISP: {
      name: "Interface Segregation Principle",
      summary: "Clients should not be forced to depend on members they do not use. Prefer several small, role-specific interfaces over one fat one: each class then opts into exactly the capabilities it really supports, implementers never need throwing stubs, and clients are coupled only to the narrow role they actually call.",
    },
    DIP: {
      name: "Dependency Inversion Principle",
      summary: "High-level policy modules depend on abstractions, never on concrete low-level classes; the concrete choice is made once, in the composition root (Program/Main or a DI container). Constructor injection of interfaces is DIP applied. Constructing collaborators with 'new' inside a class, or downcasting an injected abstraction back to a concrete type, reintroduces exactly the coupling DIP removes.",
    },
    ENC: {
      name: "Encapsulation",
      summary: "An object's state is private and changes only through methods or properties that can enforce invariants. Public mutable fields let any code put the object into an invalid state, make assignments impossible to validate or observe (no change notification), and freeze the internal representation into the public contract.",
    },
    POLY: {
      name: "Polymorphism",
      summary: "Clients call an abstraction and the runtime dispatches to the right implementation through virtual methods or interface dispatch. Manual runtime type checks and 'new' member hiding defeat it: the compile-time type of the reference, not the runtime type of the object, ends up deciding what runs.",
    },
    INH: {
      name: "Inheritance",
      summary: "A derived class reuses and specialises the state and behaviour of a base class, modelling an is-a relationship. C# allows a single base class (plus any number of interfaces). Used well it factors shared code into a base type and lets subclasses extend it; the related warnings are deep hierarchies, fragile bases, and breaking substitutability (LSP) when a subclass cannot stand in for its base.",
    },
    ABS: {
      name: "Abstraction",
      summary: "Expose WHAT a type does and hide HOW it does it. Interfaces and abstract classes name the operations a family of types must provide, so callers depend on the contract rather than a concrete implementation. Abstraction is the pillar the Dependency Inversion and Open/Closed principles build on: program to an abstraction and you can swap or add implementations without touching the caller.",
    },
  };

  /* ================= rules ================= */

  const BCL_NEW_WHITELIST = new Set(("List Dictionary HashSet SortedSet SortedList SortedDictionary Queue Stack " +
    "LinkedList StringBuilder ObservableCollection ConcurrentDictionary ConcurrentQueue ConcurrentBag Random " +
    "DateTime TimeSpan Guid Object Exception ArgumentException ArgumentNullException ArgumentOutOfRangeException " +
    "InvalidOperationException NotImplementedException NotSupportedException FileNotFoundException Thread Task " +
    "CancellationTokenSource SemaphoreSlim ManualResetEventSlim Stopwatch Timer DispatcherTimer PeriodicTimer " +
    "MemoryStream StreamReader StreamWriter FileStream Regex Uri EventArgs PropertyChangedEventArgs Tuple Lazy " +
    "JsonSerializerOptions").split(" "));

  const RULES = [

    /* ---- DIP (primary) / LSP (secondary): downcast of an injected
           abstraction to a concrete class. Primary principle is DIP because the
           high-level class regains a hard compile-time dependency on a concrete
           low-level type — exactly the coupling the injected interface removed.
           LSP is the secondary effect (the cast punishes every OTHER
           implementation). The finding also detects whether the cast result is
           null-guarded (so the fix text never mentions a branch that isn't
           there) and whether it is dereferenced unguarded (a latent NRE). ---- */
    {
      id: "downcast", principle: "DIP", severity: "high",
      /* spec 19 G3: a downcast is cross-cutting. DIP is primary (it re-couples
         the high-level policy to a concretion), but it also breaks LSP (only
         one concrete type works, every other implementation is punished) and
         OCP (a new implementation cannot be plugged in without editing this
         method). The full-mode draft uses this array to seed a derived,
         principle-framed entry in each listed section so no mandatory RUBRIC
         principle section comes out empty. DIP must stay first. */
      principles: ["DIP", "LSP", "OCP"],
      title: "Downcast of an injected abstraction to a concrete class",
      theory: "Casting a value held as an abstraction back to one specific implementation (with 'as' or a C-style cast) primarily violates the Dependency Inversion Principle: the high-level module had its concrete dependency removed by accepting the interface, and the cast hard-wires it straight back to one low-level class, so the policy again depends on a concretion the composition root was supposed to choose. It is also a Liskov Substitution problem as a secondary effect — because the code then only works for that one concrete type, every other valid implementation of the interface is punished (it takes the error path or fails) — so the abstraction is no longer freely substitutable. The usual root cause is a member that exists only on the concrete class and is missing from the interface.",
      fix: "Move the needed member onto the interface (or introduce a new, focused interface that the concrete class also implements) and call it through the abstraction, so the class depends only on the abstraction again.",
      scan(ctx, index) {
        const items = [];
        const seen = new Set();
        const push = (idx, concrete, operand, castText, result) => {
          if (!index.classes[concrete] || index.interfaces[concrete]) return;
          const line = lineOfIndex(ctx.stripped, idx);
          const key = line + ":" + concrete;
          if (seen.has(key)) return;
          seen.add(key);
          const cls = innermostClass(ctx, idx, ["class", "record"]);
          let iface = null, injected = false;
          if (operand && cls) {
            const declRe = new RegExp("([A-Za-z_][\\w<>]*)\\s+" + operand + "\\b");
            const dm = declRe.exec(ctx.stripped.slice(cls.open, cls.close));
            if (dm && (index.interfaces[dm[1]] || /^I[A-Z]/.test(dm[1]))) iface = dm[1];
            /* injected = the operand is a ctor parameter typed as that interface */
            const ctor = cls.members && cls.members.find((mb) => mb.isCtor);
            if (iface && ctor && new RegExp("\\b" + iface + "\\b").test(ctor.params)) injected = true;
          }
          /* null-guard + dereference analysis on the cast RESULT variable.
             We look at the rest of the enclosing class body after the cast. */
          let guarded = false, deref = false;
          if (result) {
            const scopeEnd = cls ? cls.close : ctx.stripped.length;
            const after = ctx.stripped.slice(idx, scopeEnd);
            const r = result.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            /* if (x == null) / if (x != null) / x?. / is-pattern / x is null */
            guarded = new RegExp("\\b" + r + "\\s*(==|!=)\\s*null").test(after) ||
                      new RegExp("\\bnull\\s*(==|!=)\\s*" + r + "\\b").test(after) ||
                      new RegExp("\\b" + r + "\\s*\\?\\s*\\.").test(after) ||
                      new RegExp("\\b" + r + "\\s+is\\b").test(after);
            deref = new RegExp("\\b" + r + "\\s*\\.\\s*[A-Za-z_]").test(after);
          }
          const clsName = cls ? cls.name : "the consuming class";
          items.push({
            file: ctx.name, line, excerpt: excerptAt(ctx, line),
            cls: clsName, concrete, iface, castText, injected, guarded, deref, result,
            message: clsName + " downcasts " + (iface || "an abstraction") + " to the concrete " + concrete + " ('" + castText + "').",
          });
        };
        let m;
        /* capture an optional 'var x =' / 'Type x =' result target before the cast */
        const asRe = /(?:\b(?:var|[A-Za-z_][\w<>?,. \[\]]*?)\s+([A-Za-z_]\w*)\s*=\s*)?([A-Za-z_]\w*)\s+as\s+([A-Z]\w*)/g;
        while ((m = asRe.exec(ctx.stripped))) push(m.index, m[3], m[2], "as " + m[3], m[1] || null);
        const castRe = /(?:\b(?:var|[A-Za-z_][\w<>?,. \[\]]*?)\s+([A-Za-z_]\w*)\s*=\s*)?\(\s*([A-Z]\w*)\s*\)\s*[A-Za-z_(]/g;
        while ((m = castRe.exec(ctx.stripped))) push(m.index, m[2], null, "(" + m[2] + ") cast", m[1] || null);
        return items;
      },
      paragraph(it) {
        const opening = it.injected
          ? it.cls + " receives " + it.iface + " through its constructor but immediately downcasts it with '" + it.castText + "'"
          : it.iface
            ? it.cls + " holds " + it.iface + " and downcasts it with '" + it.castText + "'"
            : it.cls + " downcasts a value held as an abstraction to the concrete " + it.concrete + " ('" + it.castText + "')";
        let lsp = " It is also a Liskov Substitution problem: the code then works only for " + it.concrete +
          ", so substituting any other implementation of " + (it.iface || "the abstraction") + " breaks it (that implementation takes the error path or fails).";
        let nre = "";
        if (it.deref && !it.guarded) {
          nre = " Because the '" + it.castText + "' result is dereferenced without a null guard, a non-" + it.concrete +
            " implementation makes the cast return null and the next call throws a NullReferenceException at runtime.";
        }
        const fix = it.guarded
          ? " Fix: move the needed member onto " + (it.iface || "the interface") + " (or a new focused interface) and call it through the abstraction, then delete the cast and its null-check branch."
          : " Fix: move the needed member onto " + (it.iface || "the interface") + " (or a new focused interface) and call it through the abstraction, so the cast disappears.";
        return "In " + it.file + " (line " + it.line + "), " + opening +
          ". This violates the Dependency Inversion Principle: the high-level policy regains a hard dependency on the concrete " + it.concrete +
          ", the very coupling the injected " + (it.iface || "abstraction") + " was meant to remove." + lsp + nre + fix;
      },
    },

    /* ---- DIP: new of a project class inside a constructor ---- */
    {
      id: "new-in-ctor", principle: "DIP", severity: "high",
      title: "Concrete dependency constructed inside the class",
      theory: "When a class news up its own collaborator, it hard-wires a compile-time dependency on a concrete low-level class — a Dependency Inversion violation. The dependency can never be substituted, so the class cannot be unit-tested with a fake or mock and cannot be reconfigured without editing its source. DIP says both high- and low-level modules should depend on abstractions, and that the choice of concrete type belongs in the composition root (Program/Main or a DI container), not inside business classes. Creating plain data objects or BCL collections is fine; creating collaborators with behaviour is the smell.",
      fix: "Declare the dependency as an interface, accept it as a constructor parameter, and construct the concrete implementation only in the composition root. The class then depends purely on the abstraction and becomes testable in isolation.",
      scan(ctx, index) {
        const items = [];
        ctx.classes.forEach((cls) => {
          if (cls.kind !== "class" && cls.kind !== "record") return;
          const ctorRanges = cls.members.filter((mb) => mb.isCtor).map((mb) => [mb.open, mb.close]);
          const re = /\bnew\s+([A-Z]\w*)\s*\(/g;
          re.lastIndex = cls.open + 1;
          let m;
          while ((m = re.exec(ctx.stripped))) {
            if (m.index >= cls.close) break;
            const name = m[1];
            if (name === cls.name || BCL_NEW_WHITELIST.has(name)) continue;
            if (!index.classes[name] || index.interfaces[name]) continue;
            const inCtor = ctorRanges.some((r) => m.index > r[0] && m.index < r[1]);
            const isFieldInit = ctx.depth[m.index] === ctx.depth[cls.open] + 1;
            if (!inCtor && !isFieldInit) continue;
            const line = lineOfIndex(ctx.stripped, m.index);
            items.push({
              file: ctx.name, line, excerpt: excerptAt(ctx, line),
              cls: cls.name, concrete: name,
              message: cls.name + " constructs its own dependency with 'new " + name + "(...)' instead of receiving an abstraction.",
            });
          }
        });
        return items;
      },
      paragraph(it) {
        return "In " + it.file + " (line " + it.line + "), " + it.cls + " constructs its collaborator itself with 'new " + it.concrete +
          "(...)' inside the constructor instead of receiving an abstraction. This violates the Dependency Inversion Principle: the high-level class is bound to one concrete implementation, cannot be configured differently, and cannot be unit-tested with a test double in place of " + it.concrete +
          ". Fix: depend on an interface, inject it through the constructor, and let the composition root choose the concrete class.";
      },
    },

    /* ---- LSP/ISP: NotImplemented / NotSupported stubs. The fix text is
           context-selected by the implemented interface's member count: a fat
           interface (3+ members) earns the "split it" advice, but a 1-2 member
           interface should be implemented honestly or not claimed at all —
           splitting a single-method interface is nonsense. ---- */
    {
      id: "not-implemented", principle: "LSP", severity: "high",
      title: "Contract member stubbed with NotImplemented/NotSupportedException",
      theory: "A member that throws NotImplementedException or NotSupportedException breaks the Liskov Substitution Principle: the type claims the contract of its interface or base type but blows up when a client exercises that member, so it is not substitutable. When the implemented interface bundles several roles it is also an Interface Segregation smell — the implementer was forced to take on members it cannot honour. A subtype must honour the whole behavioural contract; an exception-throwing stub honours none of it.",
      fix: "If the operation genuinely cannot be supported, the type should not claim that contract at all — implement the member honestly or stop declaring the interface. When the interface bundles several unrelated roles, split it into smaller role interfaces so each class implements only what it can honour.",
      scan(ctx, index) {
        const items = [];
        const re = /throw\s+new\s+(NotImplementedException|NotSupportedException)\s*\(/g;
        let m;
        while ((m = re.exec(ctx.stripped))) {
          const cls = innermostClass(ctx, m.index, ["class", "record"]);
          const clsName = cls ? cls.name : "A class";
          let member = null;
          if (cls) {
            for (let i = 0; i < cls.members.length; i++) {
              const mb = cls.members[i];
              if (m.index > mb.open && m.index < mb.close) { member = mb.name; break; }
            }
          }
          /* find the interface this class implements (cross-file index) and its
             member count, so the fix template can pick honest-implement vs split */
          let iface = null, ifaceCount = 0;
          if (cls) {
            const head = ctx.stripped.slice(cls.declIdx, cls.open);
            const co = head.indexOf(":");
            if (co !== -1) {
              const bases = head.slice(co + 1).split(",").map((s) => s.trim().replace(/<.*$/, "")).filter(Boolean);
              /* prefer an interface that actually declares this member */
              bases.forEach((b) => {
                const inf = index.interfaces[b];
                if (!inf) return;
                if (!iface) { iface = b; ifaceCount = inf.members.length; }
                if (member && inf.members.some((mm) => new RegExp("\\b" + member + "\\b").test(mm))) {
                  iface = b; ifaceCount = inf.members.length;
                }
              });
            }
          }
          const line = lineOfIndex(ctx.stripped, m.index);
          items.push({
            file: ctx.name, line, excerpt: excerptAt(ctx, line),
            cls: clsName, member, exName: m[1], iface, ifaceCount,
            message: clsName + (member ? "." + member : "") + " throws " + m[1] + " instead of honouring its contract.",
          });
        }
        return items;
      },
      paragraph(it) {
        const head = "In " + it.file + " (line " + it.line + "), " + it.cls + (it.member ? " implements '" + it.member + "'" : " implements a contract member") +
          " by throwing " + it.exName + ". Any client that calls it through the abstraction crashes, so " + it.cls +
          " is not substitutable for its declared contract — a Liskov Substitution violation.";
        /* context-selected fix: split only makes sense for a genuinely fat
           interface (3+ members). A 1-2 member interface is a single role; the
           honest fix is to implement it or stop claiming it. */
        const ifaceLabel = it.iface ? "The interface " + it.iface : "The implemented interface";
        if (it.iface && it.ifaceCount >= 3) {
          return head + " The interface " + it.iface + " bundles " + it.ifaceCount +
            " members across more than one role, so this is also an Interface Segregation smell. Fix: split " + it.iface +
            " into smaller role interfaces and let " + it.cls + " implement only the ones it can honour.";
        }
        const cnt = it.ifaceCount || 1;
        return head + " " + ifaceLabel + (it.iface ? " has only " + cnt + " member" + (cnt === 1 ? "" : "s") + ", so it is already a narrow role — breaking it into smaller interfaces would not help" : "") +
          ". Fix: implement the contract honestly if " + it.cls + " can support it, or stop declaring " + (it.iface || "that interface") + " so it never promises a capability it does not have.";
      },
    },

    /* ---- OCP: branching on runtime types ---- */
    {
      id: "type-check-chain", principle: "OCP", severity: "medium",
      title: "Branching on runtime types (is/GetType chain)",
      theory: "A chain of runtime type checks (if x is A ... else if x is B ...) re-implements polymorphic dispatch by hand and violates the Open/Closed Principle: every new subtype forces another branch to be added to this method, so working, tested code must be modified instead of extended. It also concentrates knowledge of the entire type hierarchy in one client. The object-oriented alternative is to put the varying behaviour on the types themselves — a virtual or abstract method — or behind a strategy interface, so adding a type means adding a class, with no edits to existing code.",
      fix: "Replace the chain with polymorphism: declare a virtual/abstract method (or a strategy interface) that each concrete type implements, and call it once through the abstraction. New types then extend the system without modifying this method.",
      scan(ctx) {
        const items = [];
        ctx.classes.forEach((cls) => {
          if (cls.kind !== "class" && cls.kind !== "record") return;
          cls.members.forEach((mb) => {
            const t = ctx.stripped.slice(mb.open, mb.close + 1);
            const isRe = /\bis\s+([A-Z]\w*)/g;
            const gtRe = /\.GetType\s*\(\s*\)\s*==/g;
            const types = [];
            let firstRel = -1, m;
            while ((m = isRe.exec(t))) { types.push(m[1]); if (firstRel < 0) firstRel = m.index; }
            let gtCount = 0;
            while ((m = gtRe.exec(t))) { gtCount++; if (firstRel < 0 || m.index < firstRel) firstRel = m.index; }
            if (types.length + gtCount < 2) return;
            const line = lineOfIndex(ctx.stripped, mb.open + firstRel);
            const method = mb.isCtor ? cls.name + " constructor" : mb.name;
            items.push({
              file: ctx.name, line, excerpt: excerptAt(ctx, line),
              cls: cls.name, method, types: Array.from(new Set(types)),
              message: cls.name + "." + method + " branches on concrete runtime types (" + (types.length + gtCount) + " checks).",
            });
          });
        });
        return items;
      },
      paragraph(it) {
        const typeList = it.types && it.types.length ? it.types.join(", ") : "several types";
        return "In " + it.file + " (line " + it.line + "), " + it.cls + "." + it.method + " branches on concrete runtime types (" + typeList +
          "). This violates the Open/Closed Principle: supporting a new type means editing this method again, instead of just adding a new class. Behaviour that varies by type belongs on the types themselves — a virtual method or a strategy interface lets polymorphic dispatch replace the whole chain.";
      },
    },

    /* ---- ENC: public mutable field ---- */
    {
      id: "public-field", principle: "ENC", severity: "medium",
      title: "Public mutable field",
      theory: "A public mutable field gives every consumer direct write access to the object's internal state, which breaks encapsulation: the class cannot enforce invariants, validate values, raise change notifications, or change its internal representation without breaking every caller. Properties — typically with private or validating setters — keep the public contract stable while leaving the class in control of its own state, which is the foundation the SOLID principles build on.",
      fix: "Replace the field with a property — typically '{ get; private set; }' or a get-only property — and route mutation through a method that can validate and protect invariants.",
      scan(ctx) {
        const items = [];
        const re = /\bpublic\s+(?!const\b|readonly\b|static\b|event\b|delegate\b|abstract\b|class\b|interface\b|record\b|enum\b|struct\b|operator\b|implicit\b|explicit\b|new\b)([\w<>,?.\[\]]+)\s+([A-Za-z_]\w*)\s*(?:=(?!=|>)[^;{)]*;|;)/g;
        let m;
        while ((m = re.exec(ctx.stripped))) {
          const cls = innermostClass(ctx, m.index, ["class", "record"]);
          if (!cls) continue;
          const line = lineOfIndex(ctx.stripped, m.index);
          items.push({
            file: ctx.name, line, excerpt: excerptAt(ctx, line),
            cls: cls.name, fieldName: m[2],
            message: cls.name + " exposes the public mutable field '" + m[2] + "'.",
          });
        }
        return items;
      },
      paragraph(it) {
        return "In " + it.file + " (line " + it.line + "), " + it.cls + " exposes the public mutable field '" + it.fieldName +
          "'. Any code can assign it directly, so the class cannot protect its invariants, cannot validate assignments, and cannot later add change notification without a breaking change — a textbook encapsulation violation. Fix: make it a property with a private (or validating) setter and expose behaviour, not raw state.";
      },
    },

    /* ---- SRP: console I/O inside a domain class ---- */
    {
      id: "console-in-domain", principle: "SRP", severity: "medium",
      title: "Console I/O inside a domain class",
      theory: "Writing directly to the console from a domain class mixes presentation with business logic — a Single Responsibility violation: the class now changes both when the domain rules change and when the output medium changes (GUI, file, test harness). It also makes the logic hard to unit-test, because asserting on console output is brittle. Output is a separate responsibility that belongs behind an abstraction (an ILogger/INotifier-style interface) whose concrete console implementation is chosen in the composition root.",
      fix: "Inject an output abstraction (e.g. ILogger or INotifier) and call it instead of Console; keep Console.WriteLine only in the dedicated console implementation of that interface and in Program/Main.",
      scan(ctx) {
        if (/^program\.cs$/i.test(ctx.name)) return [];
        const hits = new Map();
        const re = /\bConsole\s*\.\s*(Write|Read)\w*/g;
        let m;
        while ((m = re.exec(ctx.stripped))) {
          const cls = innermostClass(ctx, m.index, ["class", "record"]);
          if (!cls || cls.name === "Program" || /Console/.test(cls.name)) continue;
          const e = hits.get(cls) || { count: 0, firstIdx: m.index };
          e.count++;
          hits.set(cls, e);
        }
        const items = [];
        hits.forEach((e, cls) => {
          const line = lineOfIndex(ctx.stripped, e.firstIdx);
          items.push({
            file: ctx.name, line, excerpt: excerptAt(ctx, line),
            cls: cls.name, count: e.count,
            message: cls.name + " writes directly to the console (" + e.count + " Console call" + (e.count === 1 ? "" : "s") + ") — presentation mixed into domain logic.",
          });
        });
        return items;
      },
      paragraph(it) {
        return "In " + it.file + " (line " + it.line + "), " + it.cls + " writes directly to the console (" + it.count + " Console call" + (it.count === 1 ? "" : "s") +
          "). This mixes presentation into a domain class and violates the Single Responsibility Principle: the class now has two reasons to change — its business rules and its output medium — and its logic cannot be unit-tested without capturing console output. Fix: inject an output abstraction such as an ILogger/INotifier interface and keep Console only in its concrete console implementation.";
      },
    },

    /* ---- ISP: fat interface ---- */
    {
      id: "fat-interface", principle: "ISP", severity: "medium",
      title: "Fat interface (too many members)",
      theory: "An interface with many members almost always bundles several roles. The Interface Segregation Principle says clients should not be forced to depend on members they do not use: every implementer must provide all members (inviting NotImplementedException stubs, which in turn break LSP), and every client is coupled to the whole surface even if it calls a single method. Small role interfaces let classes opt into exactly the capabilities they support.",
      fix: "Split the interface into small, client-specific role interfaces (one capability each) and let classes implement only the roles they genuinely support; clients depend on the narrow role they need.",
      scan(ctx) {
        const items = [];
        ctx.classes.forEach((cls) => {
          if (cls.kind !== "interface") return;
          const members = interfaceMembers(ctx.stripped.slice(cls.open + 1, cls.close));
          if (members.length < 5) return;
          items.push({
            file: ctx.name, line: cls.line, excerpt: excerptAt(ctx, cls.line),
            iface: cls.name, count: members.length,
            message: cls.name + " declares " + members.length + " members — likely several roles bundled into one interface.",
          });
        });
        return items;
      },
      paragraph(it) {
        return "In " + it.file + " (line " + it.line + "), the interface " + it.iface + " declares " + it.count +
          " members. That breadth forces every implementer to provide all of them — including the irrelevant ones — and couples every client to the full surface, violating the Interface Segregation Principle. Fix: split it into small role interfaces (roughly one capability each) so classes implement only what they truly support.";
      },
    },

    /* ---- DIP/testability: public static mutable state ---- */
    {
      id: "static-mutable", principle: "DIP", severity: "info",
      title: "Public static mutable state",
      theory: "Public static mutable fields are global state: every part of the program can read and write them, so behaviour depends on hidden shared data instead of explicit dependencies. That breaks Dependency Inversion in spirit — consumers depend on a concrete global instead of an injected abstraction — destroys unit-test isolation because tests interfere with each other through the shared field, and is unsafe under concurrent access. State should be instance state, owned by an object that is passed to whoever needs it.",
      fix: "Make the state instance-level and inject the owning object where it is needed; if a single shared instance is genuinely required, hide it behind an interface chosen in the composition root.",
      scan(ctx) {
        const items = [];
        const re = /\bpublic\s+static\s+(?!readonly\b|const\b)([\w<>,?.\[\]]+)\s+([A-Za-z_]\w*)\s*(?:=(?!=|>)[^;{)]*;|;)/g;
        let m;
        while ((m = re.exec(ctx.stripped))) {
          const cls = innermostClass(ctx, m.index, ["class", "record"]);
          if (!cls) continue;
          const line = lineOfIndex(ctx.stripped, m.index);
          items.push({
            file: ctx.name, line, excerpt: excerptAt(ctx, line),
            cls: cls.name, fieldName: m[2],
            message: cls.name + " exposes the public static mutable field '" + m[2] + "' — global shared state.",
          });
        }
        return items;
      },
      paragraph(it) {
        return "In " + it.file + " (line " + it.line + "), " + it.cls + " exposes the public static mutable field '" + it.fieldName +
          "'. This is global shared state: any code anywhere can mutate it, dependencies become invisible, unit tests interfere with each other through it, and concurrent access is unsafe. Fix: convert it to instance state injected where needed (behind an abstraction if it must be shared).";
      },
    },

    /* ---- LSP/POLY: member hiding with 'new' ---- */
    {
      id: "member-hiding", principle: "LSP", severity: "medium",
      title: "Member hiding with 'new'",
      theory: "Hiding a base member with the 'new' modifier creates two unrelated members with the same name, where the compile-time type of the reference — not the runtime type of the object — decides which one runs. That silently breaks polymorphism and the Liskov Substitution Principle: code holding a base-class reference calls the base implementation even on a derived instance, so the derived object does not behave as a substitute. Virtual/override keeps a single polymorphic slot dispatched on the runtime type.",
      fix: "Make the base member virtual (or abstract) and use override in the derived class so dispatch follows the runtime type; if the behaviours are genuinely unrelated, give the new member a different name instead.",
      scan(ctx) {
        const items = [];
        const re = /\bpublic\s+new\s+\w+/g;
        let m;
        while ((m = re.exec(ctx.stripped))) {
          const cls = innermostClass(ctx, m.index, ["class", "record"]);
          const line = lineOfIndex(ctx.stripped, m.index);
          items.push({
            file: ctx.name, line, excerpt: excerptAt(ctx, line),
            cls: cls ? cls.name : "A class",
            message: (cls ? cls.name : "A class") + " hides an inherited member with the 'new' modifier — dispatch follows the compile-time type.",
          });
        }
        return items;
      },
      paragraph(it) {
        return "In " + it.file + " (line " + it.line + "), " + it.cls + " hides an inherited member with the 'new' modifier ('" + it.excerpt +
          "'). Which implementation runs now depends on the compile-time type of the reference, so a " + it.cls +
          " accessed through its base type silently uses the base behaviour — a Liskov Substitution violation that defeats polymorphism. Fix: make the base member virtual and override it (or rename the member if it is genuinely a different operation).";
      },
    },

    /* ---- SRP: god class ---- */
    {
      id: "god-class", principle: "SRP", severity: "medium",
      title: "God class (mixes I/O, presentation and domain logic)",
      theory: "A class that does file access, console interaction and domain computation — or one that simply grows past a couple of hundred lines — has many reasons to change, which is the definition of a Single Responsibility violation. Every concern dragged into it couples otherwise-independent changes, makes the class impossible to unit-test in isolation (file system, console and logic all at once) and turns it into a merge and regression hotspot. Cohesion comes from splitting it along its axes of change: persistence, presentation, domain.",
      fix: "Extract each concern into its own class behind an abstraction (e.g. a repository interface for file access, a logger/notifier interface for output) and inject them; the remaining class keeps only the domain logic.",
      scan(ctx) {
        const items = [];
        ctx.classes.forEach((cls) => {
          if (cls.kind !== "class") return;
          const lineCount = lineOfIndex(ctx.stripped, cls.close) - cls.line + 1;
          const body = ctx.stripped.slice(cls.open, cls.close + 1);
          const hasFile = /\b(File|Directory)\s*\./.test(body);
          const hasConsole = /\bConsole\s*\./.test(body);
          let reason = null;
          if (lineCount > 200) {
            reason = "spans " + lineCount + " lines";
          } else if (hasFile && hasConsole) {
            const hasDomainMember = cls.members.some((mb) => {
              if (!isPublicMember(ctx, mb) || mb.isCtor) return false;
              const t = ctx.stripped.slice(mb.open, mb.close + 1);
              return !/\b(File|Directory)\s*\./.test(t) && !/\bConsole\s*\./.test(t);
            });
            if (hasDomainMember) reason = "mixes file access, console output and domain logic in one class";
          }
          if (!reason) return;
          items.push({
            file: ctx.name, line: cls.line, excerpt: excerptAt(ctx, cls.line),
            cls: cls.name, reason,
            message: cls.name + " " + reason + " — too many responsibilities in one class.",
          });
        });
        return items;
      },
      paragraph(it) {
        return "In " + it.file + " (line " + it.line + "), " + it.cls + " " + it.reason +
          ". A class with several reasons to change violates the Single Responsibility Principle: domain changes, storage changes and presentation changes all hit the same code, and none of it can be tested in isolation. Fix: split it along its responsibilities — persistence behind a repository interface, output behind a logger/notifier interface — and inject those into the slimmed-down domain class.";
      },
    },

    /* ---- DIP/OCP: injected dependency stored but never used ---- */
    {
      id: "unused-injected-field", principle: "DIP", severity: "info",
      title: "Injected dependency stored but never used",
      theory: "A dependency that is requested in the constructor, stored in a field and then never called is a design smell on two fronts. It misleads readers and the composition root about what the class actually needs — a Dependency Inversion hygiene problem — and it usually marks an abandoned extension point: the behaviour the abstraction was supposed to drive is instead hard-coded somewhere else, which quietly breaks the Open/Closed Principle because new variants of that behaviour can no longer be plugged in. Either the field should drive the logic, or the parameter should be removed.",
      fix: "Either use the dependency where the corresponding decision is made (e.g. apply the injected rules instead of hard-coding the policy), or remove the constructor parameter and field so the class's true dependencies are explicit.",
      scan(ctx) {
        const items = [];
        ctx.classes.forEach((cls) => {
          if (cls.kind !== "class") return;
          const ctor = cls.members.find((mb) => mb.isCtor);
          if (!ctor) return;
          const params = ctor.params.split(",").map((s) => s.trim()).filter(Boolean)
            .map((s) => { const p = s.split(/\s+/); return p[p.length - 1].replace(/^@/, ""); })
            .filter((p) => /^[A-Za-z_]\w*$/.test(p));
          if (!params.length) return;
          const pset = new Set(params);
          const ctorBody = ctx.stripped.slice(ctor.open, ctor.close + 1);
          /* usage counting runs on the ORIGINAL class text so identifiers
             inside interpolated strings ($"...{Title}...") count as uses */
          const origClass = ctx.text.slice(cls.open, cls.close + 1);
          const strippedClass = ctx.stripped.slice(cls.open, cls.close + 1);
          const asgRe = /(?:this\s*\.\s*)?([A-Za-z_]\w*)\s*=\s*([A-Za-z_]\w*)\s*;/g;
          let m;
          while ((m = asgRe.exec(ctorBody))) {
            const field = m[1], param = m[2];
            if (!pset.has(param) || field === param) continue;
            const uses = (origClass.match(new RegExp("\\b" + field + "\\b", "g")) || []).length;
            if (uses > 2) continue; /* declaration + ctor assignment = 2 → anything more is a real use */
            const declRe = new RegExp("^[^\\n]*\\b" + field + "\\s*;[^\\n]*$", "m");
            const dm = declRe.exec(strippedClass);
            const idx = dm ? cls.open + dm.index + dm[0].indexOf(field) : ctor.open + m.index;
            const line = lineOfIndex(ctx.stripped, idx);
            items.push({
              file: ctx.name, line, excerpt: excerptAt(ctx, line),
              cls: cls.name, fieldName: field, param,
              message: cls.name + " stores constructor parameter '" + param + "' in '" + field + "' but never uses it.",
            });
          }
        });
        return items;
      },
      paragraph(it) {
        return "In " + it.file + " (line " + it.line + "), " + it.cls + " receives '" + it.param + "' through its constructor and stores it in '" + it.fieldName +
          "', but never uses it. The extension point the abstraction was meant to provide is dead: the behaviour it should control is evidently hard-coded elsewhere, undermining the Open/Closed Principle, and the constructor misleads readers about the class's real dependencies. Fix: route the relevant decision through '" + it.fieldName + "' (e.g. evaluate the injected rules) or delete the parameter.";
      },
    },

    /* ---- OCP: policy literals duplicated across classes ---- */
    {
      id: "duplicate-policy", principle: "OCP", severity: "medium",
      title: "Policy literals duplicated across classes",
      theory: "When the same policy literals (e.g. dietary tags or category names) are tested with hard-coded strings in several classes, the policy has no single home: adding or changing a rule means hunting down and editing every duplicate. That violates the Open/Closed Principle — existing, working classes must be modified for each new variant — and erodes Single Responsibility, because classes outside the rule hierarchy quietly re-implement rule logic. The codebase typically already has the right abstraction (a rule/strategy interface); the duplicates bypass it.",
      fix: "Centralize the policy in one place — typically the existing rule/strategy implementations — and make every other class delegate to the injected abstractions instead of re-testing the literals itself.",
      scan(ctx, index, all) {
        /* cross-file rule: runs once, on the first file's pass */
        if (!all || all.indexOf(ctx) !== 0) return [];
        const lits = {}; /* literal -> Map(file|class -> first occurrence info) */
        all.forEach((c) => {
          let pos = 0;
          for (let li = 0; li < c.strippedLines.length; li++) {
            const sl = c.strippedLines[li];
            const lineStart = pos;
            pos += sl.length + 1;
            if (!/\bif\s*\(|&&|\|\||\.Contains\s*\(|\.Where\s*\(|==|!=/.test(sl)) continue;
            const ol = c.lines[li] || "";
            const lre = /"([A-Za-z][A-Za-z ]{2,39})"/g;
            let m;
            while ((m = lre.exec(ol))) {
              const cl = innermostClass(c, lineStart + m.index, ["class", "record"]);
              if (!cl || cl.name === "Program") continue;
              const lit = m[1];
              const key = c.name + "|" + cl.name;
              if (!lits[lit]) lits[lit] = new Map();
              if (!lits[lit].has(key)) {
                lits[lit].set(key, { file: c.name, cls: cl.name, line: li + 1, excerpt: ol.trim() });
              }
            }
          }
        });
        const perClass = new Map(); /* file|class -> {info, literals:Set, others:Set} */
        Object.keys(lits).forEach((lit) => {
          const occ = lits[lit];
          if (occ.size < 2) return;
          occ.forEach((info, key) => {
            const e = perClass.get(key) || { info, literals: new Set(), others: new Set() };
            e.literals.add(lit);
            occ.forEach((oInfo, oKey) => { if (oKey !== key) e.others.add(oInfo.cls); });
            perClass.set(key, e);
          });
        });
        if (!perClass.size) return [];
        let best = null;
        perClass.forEach((e) => { if (!best || e.literals.size > best.literals.size) best = e; });
        const literals = Array.from(best.literals).map((s) => '"' + s + '"').join(", ");
        const others = Array.from(best.others).join(", ");
        return [{
          file: best.info.file, line: best.info.line, excerpt: best.info.excerpt,
          cls: best.info.cls, literals, others,
          message: best.info.cls + " hard-codes policy literal(s) " + literals + " that are also tested in " + others + " — the policy has no single home.",
        }];
      },
      paragraph(it) {
        return "In " + it.file + " (line " + it.line + "), " + it.cls + " hard-codes the policy literal(s) " + it.literals +
          " in its own conditions, duplicating checks that also live in " + it.others +
          ". The policy now has multiple owners: adding or changing a rule requires modifying each of these classes, which violates the Open/Closed Principle and bypasses the rule abstraction the design already provides. Fix: keep each policy in exactly one rule class and have the other classes delegate to the injected rules.";
      },
    },

    /* ---- OCP: switch / switch-expression dispatch over project types ---- */
    {
      id: "pattern-switch-dispatch", principle: "OCP", severity: "medium",
      title: "Switch dispatch over concrete types",
      theory: "A switch (or switch expression) whose arms match on concrete project types — 'case Invoice x:' or 'Report r => ...' — is hand-written polymorphic dispatch and violates the Open/Closed Principle: every new type forces another arm to be added to this switch, so working, tested code must be modified instead of merely extended. It also scatters one type's behaviour away from the type itself into a central client that must know the whole hierarchy. The object-oriented replacement is a virtual/abstract method or a strategy interface, so adding a type means adding a class with no edits here.",
      fix: "Replace the type-matching switch with polymorphism: declare a virtual/abstract method (or a strategy interface) that each concrete type implements, and call it once through the abstraction. New types then plug in as new classes without touching this code.",
      before: "string Describe(IDocument d) => d switch\n{\n    Invoice i => \"Invoice \" + i.Number,\n    Report  r => \"Report \"  + r.Title,\n    _ => \"Unknown\"\n};",
      after: "interface IDocument { string Describe(); }\nclass Invoice : IDocument { public string Describe() => \"Invoice \" + Number; }\nclass Report  : IDocument { public string Describe() => \"Report \"  + Title;  }\n// caller:\nstring Describe(IDocument d) => d.Describe();",
      scan(ctx, index) {
        const items = [];
        const re = /\bswitch\b/g;
        let m;
        while ((m = re.exec(ctx.stripped))) {
          /* arms within the next { ... } (statement switch) or to the
             enclosing block end (switch expression) — scan a bounded window */
          const span = findSpan(ctx.stripped, m.index + 6);
          let lo, hi;
          if (span) { lo = span.open; hi = span.close; }
          else { lo = m.index; hi = Math.min(ctx.stripped.length, m.index + 600); }
          const seg = ctx.stripped.slice(lo, hi + 1);
          const types = new Set();
          /* 'case TypeName ident:'  and  'case TypeName ident when' */
          const caseRe = /\bcase\s+([A-Z]\w*)\s+[A-Za-z_]\w*\s*(?::|when\b)/g;
          let a;
          while ((a = caseRe.exec(seg))) { if (index.classes[a[1]] || index.interfaces[a[1]]) types.add(a[1]); }
          /* switch-expression arm: 'TypeName ident =>'  */
          const armRe = /(?:^|[\s,({])([A-Z]\w*)\s+[A-Za-z_]\w*\s*=>/g;
          while ((a = armRe.exec(seg))) { if (index.classes[a[1]] || index.interfaces[a[1]]) types.add(a[1]); }
          if (types.size < 1) continue;
          const cls = innermostClass(ctx, m.index, ["class", "record"]);
          const line = lineOfIndex(ctx.stripped, m.index);
          const list = Array.from(types);
          items.push({
            file: ctx.name, line, excerpt: excerptAt(ctx, line),
            cls: cls ? cls.name : "A class", types: list, count: list.length,
            severity: list.length >= 2 ? "high" : "medium",
            message: (cls ? cls.name : "A class") + " switches over " + list.length + " concrete project type" +
              (list.length === 1 ? "" : "s") + " (" + list.join(", ") + ") instead of dispatching polymorphically.",
          });
        }
        return items;
      },
      paragraph(it) {
        const tl = it.types.join(", ");
        const sk = [
          "In " + it.file + " (line " + it.line + "), " + it.cls + " uses a switch that matches on the concrete project type" +
            (it.count === 1 ? "" : "s") + " " + tl + ". This is polymorphic dispatch written by hand, which breaks the Open/Closed Principle: every new type means editing this switch instead of adding a class. Move the varying behaviour onto a virtual/abstract method or a strategy interface and call it through the abstraction.",
          "The switch in " + it.file + " (line " + it.line + ") branches on " + tl +
            " — concrete types — to decide behaviour. Open/Closed asks that new variants be added by extension, not by modifying working code; here a new type forces a new arm. Replacing the switch with an overridden method (or strategy) lets the runtime dispatch and removes the need to touch " + it.cls + " again.",
        ];
        return sk[(it._i || 0) % sk.length];
      },
    },

    /* ---- LSP/OCP: a single 'is ProjectType ident' downcast whose ident is used ---- */
    {
      id: "single-is-downcast", principle: "LSP", severity: "medium",
      title: "Type-test downcast with 'is ProjectType ident'",
      theory: "An 'if (x is InMemoryRepository repo)' test narrows a value held as an abstraction to one concrete project type and then uses members that only exist on that type. Like an 'as' cast it breaks the Liskov Substitution Principle — the code works only for that one implementation, every other valid implementation takes the fallback or fails — and it weakens Open/Closed, because supporting another concrete type means adding another type test. The usual cause is a member that lives on the concrete class but is missing from the interface.",
      fix: "Lift the member that is only reachable after the test onto the interface (or a new focused interface the concrete type also implements) and call it through the abstraction; the type test then disappears and the code works for every implementation.",
      before: "void Use(IRecipeFinder finder)\n{\n    if (finder is InMemoryRecipeRepository repo)\n        repo.GetRandomRecipe(list);   // only on the concrete type\n}",
      after: "interface IRecipeFinder { Recipe GetRandom(IEnumerable<Recipe> recipes); }\nvoid Use(IRecipeFinder finder)\n{\n    var recipe = finder.GetRandom(list);   // works for every implementation\n}",
      scan(ctx, index) {
        const items = [];
        const seen = new Set();
        /* capture the optional operand being narrowed (e.g. '_field is X x') so
           the reconciliation pass can tell a narrowing of an INJECTED FIELD from
           one of a plain method parameter */
        const re = /(?:([A-Za-z_]\w*)\s+)?\bis\s+([A-Z]\w*)\s+([A-Za-z_]\w*)\b/g;
        let m;
        while ((m = re.exec(ctx.stripped))) {
          const operand = m[1] && m[1] !== "is" ? m[1] : null;
          const type = m[2], ident = m[3];
          if (!index.classes[type] && !index.interfaces[type]) continue;
          /* require the bound identifier to actually be used as 'ident.' later */
          const cls = innermostClass(ctx, m.index, ["class", "record"]);
          const scopeEnd = cls ? cls.close : ctx.stripped.length;
          const after = ctx.stripped.slice(m.index + m[0].length, scopeEnd);
          const usedRe = new RegExp("\\b" + ident + "\\s*\\.");
          if (!usedRe.test(after)) continue;
          const line = lineOfIndex(ctx.stripped, m.index);
          const key = line + ":" + type + ":" + ident;
          if (seen.has(key)) continue;
          seen.add(key);
          const isIface = !!index.interfaces[type] && !index.classes[type];
          /* injected-field check: the operand is a private field assigned from a
             constructor parameter (the classic '_dep is Concrete x' DIP break) */
          let onInjectedField = false;
          if (operand && cls) {
            const body = ctx.stripped.slice(cls.open, cls.close + 1);
            const isPrivateField = new RegExp("\\bprivate\\b[^\\n;]*\\b" + operand + "\\b\\s*;").test(body);
            const ctor = cls.members && cls.members.find((mb) => mb.isCtor);
            const assignedFromParam = ctor && new RegExp("\\b" + operand + "\\s*=\\s*[A-Za-z_]\\w*\\s*;").test(ctx.stripped.slice(ctor.open, ctor.close + 1));
            onInjectedField = !!(isPrivateField && assignedFromParam);
          }
          items.push({
            file: ctx.name, line, excerpt: excerptAt(ctx, line),
            cls: cls ? cls.name : "A class", type, ident, isIface, onInjectedField,
            message: (cls ? cls.name : "A class") + " narrows an abstraction to " + type +
              " with 'is " + type + " " + ident + "' and then calls members only " + type + " provides.",
          });
        }
        return items;
      },
      paragraph(it) {
        const sk = [
          "In " + it.file + " (line " + it.line + "), " + it.cls + " tests 'is " + it.type + " " + it.ident +
            "' and then uses members that only " + it.type + " provides. That couples the code to one concrete " +
            (it.isIface ? "implementation" : "class") + ", so substituting any other implementation of the abstraction takes the fallback path — a Liskov Substitution violation, and an Open/Closed one since a new type needs another test. Fix: put the needed member on the interface and call it through the abstraction.",
          "The 'is " + it.type + " " + it.ident + "' narrowing in " + it.file + " (line " + it.line +
            ") lets " + it.cls + " reach into one specific type's API. The client claims to accept the abstraction but only works for " + it.type +
            ", breaking substitutability; adding a second implementation would force another branch. Lift that member onto the interface (or a new role interface) so the cast and its branch can be deleted.",
        ];
        return sk[(it._i || 0) % sk.length];
      },
    },

    /* ---- DIP/OCP: ctor param stored in a field that is never read (high) ---- */
    {
      id: "unused-injected-dependency", principle: "DIP", severity: "high",
      title: "Injected dependency never used (dead abstraction)",
      theory: "A collaborator requested through the constructor, stored in a field and then never read is a dead dependency. It misleads the composition root and every reader about what the class really needs, and — more seriously — it marks an abandoned extension point: the behaviour that abstraction was meant to drive is hard-coded somewhere instead, so the class is no longer open for extension through that seam. The classic planted example is a 'List<IRule> _rules' that is injected but never evaluated while the rule logic is duplicated inline elsewhere. Either the field should drive the decision, or the parameter should not be there.",
      fix: "Route the relevant decision through the injected dependency (e.g. evaluate the injected rules with _rules.All(r => r.IsSatisfiedBy(...))) so the abstraction actually governs behaviour; or, if it is genuinely not needed, delete the constructor parameter and field so the class's real dependencies are honest.",
      before: "public MealPlanner(IRecipeFinder finder, List<IDietaryRule> rules)\n{\n    _finder = finder;\n    _rules  = rules;        // stored\n}\n// ... _rules is never read again",
      after: "public MealPlanner(IRecipeFinder finder, List<IDietaryRule> rules)\n{\n    _finder = finder;\n    _rules  = rules;\n}\nbool Allowed(Recipe r, FamilyProfile f) =>\n    _rules.All(rule => rule.IsSatisfiedBy(r, f));   // the seam is used",
      scan(ctx) {
        const items = [];
        ctx.classes.forEach((cls) => {
          if (cls.kind !== "class") return;
          const ctor = cls.members.find((mb) => mb.isCtor);
          if (!ctor) return;
          const params = ctor.params.split(",").map((s) => s.trim()).filter(Boolean)
            .map((s) => { const p = s.split(/\s+/); return p[p.length - 1].replace(/^@/, ""); })
            .filter((p) => /^[A-Za-z_]\w*$/.test(p));
          if (!params.length) return;
          const pset = new Set(params);
          const ctorBody = ctx.stripped.slice(ctor.open, ctor.close + 1);
          const origClass = ctx.text.slice(cls.open, cls.close + 1);
          const strippedClass = ctx.stripped.slice(cls.open, cls.close + 1);
          const asgRe = /(?:this\s*\.\s*)?([A-Za-z_]\w*)\s*=\s*([A-Za-z_]\w*)\s*;/g;
          let m;
          while ((m = asgRe.exec(ctorBody))) {
            const field = m[1], param = m[2];
            if (!pset.has(param) || field === param) continue;
            const uses = (origClass.match(new RegExp("\\b" + field + "\\b", "g")) || []).length;
            if (uses > 2) continue; /* declaration + ctor assignment = 2 → more is a real use */
            /* confirm the field is declared private (a true injected dependency) */
            const declRe = new RegExp("\\bprivate\\b[^\\n;]*\\b" + field + "\\b\\s*;", "");
            if (!declRe.test(strippedClass)) continue;
            /* type of the dependency: split params and find the one named `param` */
            let ptype = null;
            ctor.params.split(",").forEach((seg) => {
              const parts = seg.trim().split(/\s+/);
              if (parts.length >= 2 && parts[parts.length - 1].replace(/^@/, "") === param) {
                ptype = parts.slice(0, -1).join(" ").replace(/^(in|out|ref|params|this)\s+/, "");
              }
            });
            const dmRe = new RegExp("^[^\\n]*\\b" + field + "\\s*;[^\\n]*$", "m");
            const dm = dmRe.exec(strippedClass);
            const idx = dm ? cls.open + dm.index + dm[0].indexOf(field) : ctor.open + m.index;
            const line = lineOfIndex(ctx.stripped, idx);
            items.push({
              file: ctx.name, line, excerpt: excerptAt(ctx, line),
              cls: cls.name, fieldName: field, param, ptype,
              message: cls.name + " injects '" + param + "'" + (ptype ? " (" + ptype + ")" : "") +
                " and stores it in '" + field + "', but never uses it — a dead abstraction.",
            });
          }
        });
        return items;
      },
      paragraph(it) {
        const typed = it.ptype ? " (typed " + it.ptype + ")" : "";
        const sk = [
          "In " + it.file + " (line " + it.line + "), " + it.cls + " takes '" + it.param + "'" + typed +
            " through its constructor and stores it in '" + it.fieldName + "', yet never reads it again. The extension point that dependency was meant to provide is dead — the behaviour it should govern is hard-coded elsewhere, breaking the Open/Closed Principle — and the constructor lies about what the class depends on (a Dependency Inversion hygiene failure). Fix: actually drive the decision through '" + it.fieldName + "' (evaluate the injected rules), or remove the parameter.",
          "The dependency '" + it.fieldName + "' in " + it.cls + " (" + it.file + ", line " + it.line +
            ") is injected" + typed + " and assigned in the constructor but read nowhere afterwards. A stored-and-ignored abstraction is a Dependency Inversion smell and signals an abandoned seam: the policy it was meant to control has been duplicated inline. Either route the logic through it or drop it from the constructor so the class's dependencies are honest.",
        ];
        return sk[(it._i || 0) % sk.length];
      },
    },

    /* ---- OCP/type-safety: weakly typed object collection ---- */
    {
      id: "object-collection", principle: "OCP", severity: "medium",
      title: "Weakly-typed collection of object",
      theory: "A field or property typed as List<object>, object[] or Dictionary<,object> throws away static type information: anything can be put in, and getting useful behaviour back out requires casting or OfType<T> filtering, which is runtime type-dispatch in disguise. That undermines type safety and the Open/Closed Principle — consumers must know every concrete type the collection might hold and branch on it — and it is usually paired with an OfType<T>() call that re-discovers a type the compiler could have guaranteed. A typed collection (or a small interface the elements share) restores both safety and polymorphism.",
      fix: "Type the collection to the common abstraction the elements share — List<IDocument> rather than List<object> — so the compiler enforces membership and consumers call interface members directly instead of filtering with OfType<T> and casting.",
      before: "private readonly List<object> _all = new List<object>();\n// retrieval has to rediscover the type:\nvar docs = _all.OfType<ISummarizable>().ToList();",
      after: "private readonly List<ISummarizable> _all = new List<ISummarizable>();\n// already the right type — no OfType, no cast:\nvar docs = _all.ToList();",
      scan(ctx) {
        const items = [];
        const re = /\b(List|IList|IEnumerable|ICollection|IReadOnlyList|Collection|ObservableCollection)\s*<\s*object\s*>|\bobject\s*\[\s*\]|\bDictionary\s*<[^<>]*,\s*object\s*>/g;
        let m;
        const seen = new Set();
        while ((m = re.exec(ctx.stripped))) {
          const cls = innermostClass(ctx, m.index, ["class", "record"]);
          if (!cls) continue;
          const line = lineOfIndex(ctx.stripped, m.index);
          const key = cls.name + ":" + line;
          if (seen.has(key)) continue;
          seen.add(key);
          const body = ctx.stripped.slice(cls.open, cls.close + 1);
          const ofType = /\.OfType\s*<\s*([A-Za-z_]\w*)\s*>/.exec(body);
          items.push({
            file: ctx.name, line, excerpt: excerptAt(ctx, line),
            cls: cls.name, ofType: ofType ? ofType[1] : null,
            message: cls.name + " holds a weakly-typed collection of 'object'" +
              (ofType ? ", later filtered with OfType<" + ofType[1] + ">()" : "") + " — type safety and polymorphism are lost.",
          });
        }
        return items;
      },
      paragraph(it) {
        const ot = it.ofType ? " and later recovers elements with OfType<" + it.ofType + ">()" : "";
        const sk = [
          "In " + it.file + " (line " + it.line + "), " + it.cls + " stores its elements in a collection of 'object'" + ot +
            ". A bag of object loses every compile-time guarantee: callers must know which concrete types are inside and cast or filter to use them, which is runtime type-dispatch and an Open/Closed weakness. Type the collection to the abstraction the elements share (e.g. List<ISummarizable>) so the compiler enforces membership and consumers call interface members directly.",
          "The 'object' collection in " + it.cls + " (" + it.file + ", line " + it.line + ")" + ot +
            " trades type safety for flexibility it does not need. OfType<T> and casts then stand in for polymorphism, and each new element type ripples into the consumers. Giving the collection the common element interface restores both safety and polymorphic access.",
        ];
        return sk[(it._i || 0) % sk.length];
      },
    },

    /* ---- SRP: file I/O inside a non-persistence domain class ---- */
    {
      id: "file-io-in-domain", principle: "SRP", severity: "medium",
      title: "File I/O inside a domain class",
      theory: "Direct File./Directory./StreamReader/StreamWriter calls inside a class that is not a dedicated persistence type mix storage with domain logic — a Single Responsibility violation. The class then changes both when the business rules change and when the storage format or location changes, cannot be unit-tested without touching the file system, and couples the domain to a specific I/O mechanism. Persistence is its own responsibility and belongs behind a repository/storage abstraction whose concrete file implementation is chosen in the composition root.",
      fix: "Move the file access into a dedicated repository/storage class behind an interface (e.g. IDocumentRepository) and inject it; the domain class then asks the abstraction to load/save and stays free of File/Stream calls, so it can be tested with an in-memory fake.",
      before: "public class InvoiceService\n{\n    public void Save(Invoice inv) =>\n        File.WriteAllText(inv.Number + \".json\", Serialize(inv));   // I/O in domain\n}",
      after: "public interface IInvoiceRepository { void Save(Invoice inv); }\npublic class InvoiceService\n{\n    private readonly IInvoiceRepository _repo;\n    public InvoiceService(IInvoiceRepository repo) => _repo = repo;\n    public void Save(Invoice inv) => _repo.Save(inv);   // delegated\n}",
      scan(ctx) {
        const items = [];
        ctx.classes.forEach((cls) => {
          if (cls.kind !== "class" && cls.kind !== "record") return;
          if (/(Program|Repository|Storage|Persistence|Store|Dao|Db|FileSystem)$/.test(cls.name)) return;
          const body = ctx.stripped.slice(cls.open, cls.close + 1);
          const re = /\b(File|Directory|Path)\s*\.\s*\w+|\bnew\s+(StreamWriter|StreamReader|FileStream)\b/g;
          let m, firstIdx = -1, count = 0;
          const kinds = new Set();
          while ((m = re.exec(body))) { count++; if (firstIdx < 0) firstIdx = m.index; kinds.add((m[1] || m[2])); }
          if (!count) return;
          const line = lineOfIndex(ctx.stripped, cls.open + firstIdx);
          items.push({
            file: ctx.name, line, excerpt: excerptAt(ctx, line),
            cls: cls.name, count, apis: Array.from(kinds).join(", "),
            message: cls.name + " performs file I/O directly (" + Array.from(kinds).join(", ") +
              ") — persistence mixed into a domain class.",
          });
        });
        return items;
      },
      paragraph(it) {
        const sk = [
          "In " + it.file + " (line " + it.line + "), " + it.cls + " calls into the file system directly (" + it.apis +
            "). Storage and domain logic now live in the same class, so it has two reasons to change and cannot be unit-tested without the file system present — a Single Responsibility violation. Fix: move the I/O into a repository/storage class behind an interface and inject it, leaving " + it.cls + " with only its domain logic.",
          it.cls + " in " + it.file + " (line " + it.line + ") reaches for " + it.apis +
            " inside what should be domain code. Persistence is a separate responsibility; folding it in here couples the business rules to a storage mechanism and blocks isolated testing. Extract a repository abstraction, inject it, and let it own the file access.",
        ];
        return sk[(it._i || 0) % sk.length];
      },
    },

    /* ---- ISP/info: marker interface (zero members) ---- */
    {
      id: "marker-interface", principle: "ISP", severity: "info",
      title: "Marker interface (no members)",
      theory: "An interface with no members is a marker: it carries no behaviour and exists only to tag types so code can test 'is IMarker'. That is often a smell — it invites runtime type-tests (breaking Open/Closed) instead of giving the capability an actual method — but it can also be a legitimate, deliberately tiny Interface Segregation talking point, where a role is signalled without forcing any method on implementers. Judge it from how it is used: if consumers only ever 'is'-test it, prefer a real capability method; if it genuinely just labels a role, it is defensible. Worth naming either way in the written answer.",
      fix: "If the marker drives behaviour via 'is IMarker' tests, replace it with an interface that declares the capability method so callers invoke it polymorphically. If it is a pure role label with no behaviour, keep it but say so explicitly and note the trade-off.",
      before: "public interface IDisplayableInfo {}            // marker, no members\n// used only as a tag:\nif (document is IDisplayableInfo displayable) { ... }",
      after: "public interface IDisplayableInfo               // real capability\n{\n    string Display();\n}\n// caller invokes behaviour, no type test:\nConsole.WriteLine(document.Display());",
      scan(ctx) {
        const items = [];
        ctx.classes.forEach((cls) => {
          if (cls.kind !== "interface") return;
          const members = interfaceMembers(ctx.stripped.slice(cls.open + 1, cls.close));
          if (members.length !== 0) return;
          items.push({
            file: ctx.name, line: cls.line, excerpt: excerptAt(ctx, cls.line),
            iface: cls.name,
            message: cls.name + " is a marker interface (no members) — used only to tag types, which invites 'is'-tests over polymorphism.",
          });
        });
        return items;
      },
      paragraph(it) {
        const sk = [
          "In " + it.file + " (line " + it.line + "), " + it.iface + " is a marker interface with no members. It carries no behaviour and exists only to tag types, which usually pulls callers toward 'is " + it.iface +
            "' runtime tests rather than a polymorphic call — an Open/Closed risk. If it really just labels a role it is a defensible Interface Segregation choice, but if anything branches on it, give it the capability method instead.",
          it.iface + " in " + it.file + " (line " + it.line + ") declares no members, so it is a pure marker. Markers can be a clean way to signal a role without forcing methods on implementers, but here it is worth checking whether consumers only 'is'-test it; if so, replacing the marker with an interface that declares the behaviour removes the type tests and restores polymorphism.",
        ];
        return sk[(it._i || 0) % sk.length];
      },
    },
  ];

  /* ================= presence detection =================
     Positive findings (kind:"presence") that feed the written answer's
     "principle is PRESENT" half. Each carries a citation (file:line of the
     strongest evidence) and a ready, rubric-shaped paragraph. */

  const SRP_ROLE_RE = /(Repository|Generator|Notifier|Logger|Rule|Service|Validator|Processor|Manager|Handler|Factory|Builder|Formatter|Parser|Calculator|Provider|Strategy|Finder)$/;

  /* ---- spec 19 G12: structural signals that tell a real (injected/invoked)
     strategy interface from a capability/role marker. Given one interface name,
     scan every class for:
       injected   - the interface name appears in some constructor's parameter
                    list (bare 'IFoo foo' or wrapped 'List<IFoo>'), and that
                    class stores it (a field/param of that type). injectedInto
                    names the first such class.
       invoked    - a stored field typed (or wrapping) the interface is called
                    through, i.e. '_field.Member(' appears in the class body.
       capabilityMarker - 3+ implementors, the interface's members are all pure
                    capability (zero members, or only property getters / boolean
                    CanX-style queries with no behaviour verb), AND it is neither
                    injected nor invoked anywhere. This is the IAquatic shape.
     A field is "of the interface type" when its declared type contains the
     interface name as a whole word (covers IFoo, List<IFoo>, IReadOnlyList<IFoo>). */
  function strategySignals(iface, ctxs, index, impls) {
    const wholeWord = new RegExp("\\b" + iface + "\\b");
    let injected = false, invoked = false, injectedInto = null;
    ctxs.forEach((ctx) => {
      ctx.classes.forEach((cls) => {
        if (cls.kind !== "class" && cls.kind !== "record") return;
        const ctor = cls.members && cls.members.find((mb) => mb.isCtor);
        const body = ctx.stripped.slice(cls.open, cls.close + 1);
        /* injection: ctor parameter whose type mentions the interface */
        if (ctor && wholeWord.test(ctor.params)) {
          if (!injected) { injected = true; injectedInto = cls.name; }
          /* find fields whose declared type mentions the interface, then look
             for an invocation through one of them ('_field.Member(') */
          const fieldRe = /(?:private|protected|internal|public|readonly|static|\s)+([\w<>,?.\[\] ]*?)\s+(_?[A-Za-z_]\w*)\s*;/g;
          let fm;
          while ((fm = fieldRe.exec(body))) {
            if (!wholeWord.test(fm[1])) continue;
            const field = fm[2];
            const callRe = new RegExp("\\b" + field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\.\\s*[A-Za-z_]\\w*\\s*\\(");
            if (callRe.test(body)) { invoked = true; injected = true; if (!injectedInto) injectedInto = cls.name; }
          }
        }
      });
    });
    /* capability/role marker shape: pure-capability members, many implementors,
       no injection/invocation seam */
    let capabilityMarker = false;
    const members = (index.interfaces[iface] && index.interfaces[iface].members) || [];
    const pureCapability = members.every((m) => {
      const s = String(m).trim();
      if (!s) return true;
      /* a property getter ('Type Name { get; }') or a boolean Can/Is/Has/Should
         query is a capability signal; a verb-named method ('Tank Assign(...)')
         is behaviour, so it is NOT pure capability */
      if (/\{\s*get\b/.test(s)) return true;
      if (/\b(bool)\s+(Can|Is|Has|Should)[A-Z]/.test(s)) return true;
      if (/[A-Za-z_]\w*\s*\([^)]*\)/.test(s)) return false; /* a method = behaviour */
      return true;
    });
    if ((impls.length >= 3) && pureCapability && !injected && !invoked) capabilityMarker = true;
    return { injected, invoked, injectedInto, capabilityMarker };
  }

  function detectPresence(ctxs, index) {
    const out = [];
    let pi = 0;
    const push = (o) => out.push(Object.assign({
      kind: "presence", verdict: "present", severity: "presence",
      ruleId: "presence-" + o.principle.toLowerCase() + "-" + (pi++),
      theory: "", fix: "",
    }, o));

    /* collect interfaces and class->implemented-interfaces */
    const ifaceNames = Object.keys(index.interfaces);
    const implsByIface = {}; /* iface -> [class names] */
    const classImplements = {}; /* class -> [iface names] */
    ctxs.forEach((ctx) => {
      ctx.classes.forEach((cls) => {
        if (cls.kind !== "class" && cls.kind !== "record") return;
        const head = ctx.stripped.slice(cls.declIdx, cls.open);
        const co = head.indexOf(":");
        if (co === -1) return;
        const bases = head.slice(co + 1).split(",").map((s) => s.trim().replace(/<.*$/, "")).filter(Boolean);
        bases.forEach((b) => {
          if (index.interfaces[b]) {
            (implsByIface[b] = implsByIface[b] || []).push(cls.name);
            (classImplements[cls.name] = classImplements[cls.name] || []).push(b);
          }
        });
      });
    });

    /* ---- DIP present: ctor params typed as project interfaces stored in fields ---- */
    const dipHits = [];
    ctxs.forEach((ctx) => {
      ctx.classes.forEach((cls) => {
        if (cls.kind !== "class") return;
        const ctor = cls.members.find((mb) => mb.isCtor);
        if (!ctor) return;
        const params = ctor.params.split(",").map((s) => s.trim()).filter(Boolean);
        params.forEach((p) => {
          const t = p.split(/\s+/)[0].replace(/<.*$/, "");
          if (index.interfaces[t]) dipHits.push({ ctx, cls: cls.name, line: cls.line, iface: t });
        });
      });
    });
    if (dipHits.length) {
      const h = dipHits[0];
      const ifaces = Array.from(new Set(dipHits.map((x) => x.iface)));
      const classes = Array.from(new Set(dipHits.map((x) => x.cls)));
      push({
        principle: "DIP", title: "Dependency Inversion is applied (constructor injection)",
        file: h.ctx.name, line: h.line, excerpt: excerptAt(h.ctx, h.line),
        classes: classes.slice(),
        message: classes.join(", ") + " depend on the abstraction(s) " + ifaces.join(", ") + " injected through the constructor.",
        evidence: classes.join(", ") + " receive " + ifaces.join(", ") + " as constructor parameters and store them in fields",
        paragraph: "Dependency Inversion is present: " + classes.join(", ") + " depend on the interface" +
          (ifaces.length === 1 ? "" : "s") + " " + ifaces.join(", ") + ", injected through the constructor rather than constructed internally (" +
          h.ctx.name + ":" + h.line + "). Purpose: high-level policy should depend on abstractions, not concrete low-level classes, with the concrete choice made once in the composition root. Here that lets the collaborators be swapped or faked in tests, and is exactly DIP applied through constructor injection.",
      });
    }

    /* ---- ISP present: several small role interfaces (1-3 members) ---- */
    const smallIfaces = ifaceNames.filter((n) => {
      const m = index.interfaces[n].members.length;
      return m >= 1 && m <= 3;
    });
    if (smallIfaces.length) {
      const ref = index.interfaces[smallIfaces[0]];
      push({
        principle: "ISP", title: "Interface Segregation is applied (small role interfaces)",
        file: ref.file, line: ref.line, excerpt: excerptAt(ctxByName(ctxs, ref.file), ref.line),
        message: smallIfaces.length + " small role interface" + (smallIfaces.length === 1 ? "" : "s") +
          " (" + smallIfaces.join(", ") + "), each declaring only the members a client needs.",
        evidence: "the role interface" + (smallIfaces.length === 1 ? "" : "s") + " " + smallIfaces.join(", ") +
          " each declare only one to three members",
        paragraph: "Interface Segregation is present: the design uses small, role-specific interface" +
          (smallIfaces.length === 1 ? "" : "s") + " — " + smallIfaces.join(", ") +
          " — each with only one to three members (" + ref.file + ":" + ref.line + "). Purpose: clients should not be forced to depend on members they do not use, so fat interfaces are split into focused roles. Here each class implements only the narrow capabilities it genuinely supports, and no implementer is forced into throwing stubs.",
      });
    }

    /* ---- SRP present: multiple small focused classes named for one role ---- */
    const roleClasses = [];
    ctxs.forEach((ctx) => {
      ctx.classes.forEach((cls) => {
        if (cls.kind !== "class") return;
        if (cls.name === "Program") return;
        if (SRP_ROLE_RE.test(cls.name)) roleClasses.push({ ctx, name: cls.name, line: cls.line });
      });
    });
    if (roleClasses.length >= 2) {
      const r = roleClasses[0];
      const names = roleClasses.map((x) => x.name);
      push({
        principle: "SRP", title: "Single Responsibility is applied (focused classes)",
        file: r.ctx.name, line: r.line, excerpt: excerptAt(r.ctx, r.line),
        message: "Responsibilities are split across focused classes: " + names.join(", ") + ", each owning one concern.",
        evidence: "the design splits work across " + names.join(", ") + ", each named for the single role it owns",
        paragraph: "Single Responsibility is present: the work is split across small classes that each encode one role — " +
          names.join(", ") + " (" + r.ctx.name + ":" + r.line + "). Purpose: a class should have exactly one reason to change, so mixing concerns is avoided by giving each concern its own class. Here notification, generation, persistence and rule-evaluation live in separate, individually testable types rather than one god class.",
      });
    }

    /* ---- OCP / Strategy present (spec 19 G12): pick the interface that reads as
       a real strategy, not a capability/role marker. The old heuristic took any
       interface with the most implementors, which let a role marker (e.g.
       IAquatic, 3 unrelated implementors) beat the genuine strategy
       (ITankAssignmentStrategy, constructor-injected and invoked through a
       stored field). We now score each 2+-implementor candidate:
         + it is constructor-injected into some class AND invoked through a
           stored field  (the textbook strategy seam)             strong
         + it is constructor-injected (type appears in a ctor param), even if
           the field is not invoked here (still the seam, e.g. a stored-but-
           unused List<IDietaryRule>)                              moderate
         - it looks like a capability/role marker: 3+ structurally-unrelated
           implementors whose members are pure capability (property getters /
           CanX-style / none) AND it is neither injected nor invoked anywhere   penalty
       Ties (equal score) fall back to the original most-implementors order, so
       single-candidate fixtures (reexam IDietaryRule, summer IProcessable) are
       byte-unchanged. When the best candidate scores no positive signal (no
       injection, no invocation), the finding hedges ("candidate strategy")
       rather than asserting a confidently wrong type. ---- */
    const stratCandidates = Object.keys(implsByIface).filter((i) => implsByIface[i].length >= 2);
    let strategyIface = null, strategyInfo = null;
    if (stratCandidates.length) {
      const scored = stratCandidates.map((iface) => {
        const info = strategySignals(iface, ctxs, index, implsByIface[iface]);
        let score = 0;
        if (info.injected && info.invoked) score += 6;
        else if (info.injected) score += 3;
        else if (info.invoked) score += 2;
        if (info.capabilityMarker) score -= 5;
        return { iface, score, info, impls: implsByIface[iface].length };
      });
      /* equal score => original most-implementors order, so single-candidate
         fixtures (reexam IDietaryRule, summer IProcessable) are byte-unchanged */
      scored.sort((a, b) => (b.score - a.score) || (b.impls - a.impls));
      const best = scored[0];
      strategyIface = best.iface;
      strategyInfo = best.info;
      /* hedge ONLY when the chosen interface is itself marker-shaped (pure
         capability, no injection/invocation seam). A non-marker interface with
         interchangeable behaviour implementations — e.g. IProcessable, whose
         members are real methods — stays a confident Strategy and reproduces
         the original wording byte-for-byte. */
      strategyInfo._confident = !best.info.capabilityMarker;
    }
    if (strategyIface) {
      const ref = index.interfaces[strategyIface];
      const impls = implsByIface[strategyIface];
      const confident = strategyInfo && strategyInfo._confident;
      if (confident) {
        /* original (calibrated) confident wording — unchanged from before G12 */
        push({
          principle: "OCP", title: "Open/Closed via the Strategy pattern", pattern: "Strategy",
          file: ref.file, line: ref.line, excerpt: excerptAt(ctxByName(ctxs, ref.file), ref.line),
          message: strategyIface + " has " + impls.length + " implementations (" + impls.join(", ") +
            ") — new behaviour is added by writing a new class, not by editing existing code.",
          evidence: strategyIface + " is implemented by " + impls.join(", ") + ", interchangeable strategies behind one abstraction",
          paragraph: "Open/Closed is present through the Strategy pattern: the interface " + strategyIface +
            " has " + impls.length + " interchangeable implementations — " + impls.join(", ") + " (" + ref.file + ":" + ref.line +
            "). Purpose: software should be open for extension but closed for modification, so new variants arrive as new classes plugged into an existing abstraction. Here a new variant of the behaviour is added by writing another " +
            strategyIface + " implementation, with no edit to the classes that consume them.",
        });
      } else {
        /* the only candidate is marker-shaped: hedge rather than assert a
           confidently-wrong strategy type (spec 19 G12) */
        push({
          principle: "OCP", title: "Open/Closed via a candidate Strategy pattern", pattern: "Strategy",
          file: ref.file, line: ref.line, excerpt: excerptAt(ctxByName(ctxs, ref.file), ref.line),
          message: strategyIface + " has " + impls.length + " implementations (" + impls.join(", ") +
            ") — candidate strategy: confirm it is invoked through an injected abstraction, not just a capability/role marker.",
          evidence: strategyIface + " is implemented by " + impls.join(", ") + ", but reads more like a capability/role marker than an injected, invoked strategy",
          paragraph: "Open/Closed via a candidate Strategy: the interface " + strategyIface +
            " has " + impls.length + " implementations — " + impls.join(", ") + " (" + ref.file + ":" + ref.line +
            ") — but it is not visibly constructor-injected or invoked through a stored field, so it may be a capability/role marker rather than a true strategy. Purpose: software should be open for extension but closed for modification, with new variants plugged into an existing abstraction. Confirm by hand that a consumer holds this interface and calls it polymorphically before presenting it as the Strategy pattern; if instead it only tags types, point at the genuinely injected-and-invoked interface.",
        });
      }
    }

    /* ---- Repository pattern: *Repository class implementing an interface ---- */
    let repoFound = null;
    ctxs.forEach((ctx) => {
      ctx.classes.forEach((cls) => {
        if (repoFound || cls.kind !== "class") return;
        if (/Repository$/.test(cls.name) && (classImplements[cls.name] || []).length) {
          repoFound = { ctx, name: cls.name, line: cls.line, iface: classImplements[cls.name][0] };
        }
      });
    });
    if (repoFound) {
      push({
        principle: "DIP", title: "Repository pattern (storage behind an interface)", pattern: "Repository",
        file: repoFound.ctx.name, line: repoFound.line, excerpt: excerptAt(repoFound.ctx, repoFound.line),
        message: repoFound.name + " implements " + repoFound.iface + " — data access is hidden behind an abstraction.",
        evidence: repoFound.name + " encapsulates data access behind the " + repoFound.iface + " interface",
        paragraph: "The Repository pattern is present: " + repoFound.name + " implements " + repoFound.iface +
          " (" + repoFound.ctx.name + ":" + repoFound.line + "), hiding data access behind an abstraction. Purpose: separating retrieval/storage from domain logic lets callers depend on the interface, swap the data source, and test against an in-memory fake. Here the consumer holds the " +
          repoFound.iface + " abstraction, supporting Dependency Inversion and Single Responsibility at once.",
      });
    }

    /* ---- Observer: event/delegate declarations or Subscribe/Notify naming ---- */
    let obs = null;
    ctxs.forEach((ctx) => {
      if (obs) return;
      const m = /\b(?:public|protected|internal)\s+event\b/.exec(ctx.stripped) ||
                /\b(?:Subscribe|Unsubscribe|RaiseEvent|OnChanged|NotifyObservers)\b/.exec(ctx.stripped);
      if (m) {
        const cls = innermostClass(ctx, m.index, ["class", "record"]);
        obs = { ctx, line: lineOfIndex(ctx.stripped, m.index), cls: cls ? cls.name : "a class" };
      }
    });
    if (obs) {
      push({
        principle: "OCP", title: "Observer pattern (events / subscriptions)", pattern: "Observer",
        file: obs.ctx.name, line: obs.line, excerpt: excerptAt(obs.ctx, obs.line),
        message: obs.cls + " exposes an event/subscription seam — observers attach without the subject knowing them.",
        evidence: obs.cls + " publishes an event so observers can subscribe without the subject depending on them",
        paragraph: "The Observer pattern is present: " + obs.cls + " exposes an event/subscription seam (" +
          obs.ctx.name + ":" + obs.line + "). Purpose: it lets interested parties react to state changes without the subject holding a compile-time dependency on them, keeping the publisher open to new subscribers. Here notification flows through that seam rather than direct calls into known concrete observers.",
      });
    }

    /* ---- Encapsulation present: private fields + public properties dominate ---- */
    let priv = 0, props = 0, encRef = null;
    ctxs.forEach((ctx) => {
      const p1 = (ctx.stripped.match(/\bprivate\s+(?:readonly\s+)?[\w<>,?.\[\] ]+\s+_?\w+\s*;/g) || []).length;
      const p2 = (ctx.stripped.match(/\bpublic\s+[\w<>,?.\[\] ]+\s+\w+\s*\{\s*get\b/g) || []).length;
      priv += p1; props += p2;
      if (!encRef && (p1 || p2)) {
        const mm = /\bpublic\s+[\w<>,?.\[\] ]+\s+\w+\s*\{\s*get\b/.exec(ctx.stripped) ||
                   /\bprivate\s+(?:readonly\s+)?[\w<>,?.\[\] ]+\s+_?\w+\s*;/.exec(ctx.stripped);
        if (mm) encRef = { ctx, line: lineOfIndex(ctx.stripped, mm.index) };
      }
    });
    if (encRef && props >= 2 && props >= priv) {
      push({
        principle: "ENC", title: "Encapsulation is applied (private state, property access)",
        file: encRef.ctx.name, line: encRef.line, excerpt: excerptAt(encRef.ctx, encRef.line),
        message: "State is kept private and exposed through properties (" + props + " properties, " + priv +
          " private fields) — invariants stay under the class's control.",
        evidence: "fields are private and state is exposed through properties (often with private setters)",
        paragraph: "Encapsulation is present: the model classes keep their fields private and expose state through properties, frequently with private or get-only setters (" +
          encRef.ctx.name + ":" + encRef.line + "). Purpose: an object should control its own state so it can enforce invariants, validate assignments and change its representation without breaking callers. Here external code reads through properties and cannot put an object into an invalid state by writing a raw field.",
      });
    }

    /* ---- Inheritance present: a class derives from a base CLASS, resolved across
       files via the index (so a Derived in one file extending a Base in another is
       still detected — this is the cross-file half of the scan). ---- */
    const inhPairs = [];
    ctxs.forEach((ctx) => {
      ctx.classes.forEach((cls) => {
        if (cls.kind !== "class" && cls.kind !== "record") return;
        const head = ctx.stripped.slice(cls.declIdx, cls.open);
        const co = head.indexOf(":");
        if (co === -1) return;
        head.slice(co + 1).split(",").map((s) => s.trim().replace(/<.*$/, "")).filter(Boolean).forEach((b) => {
          if (index.classes[b]) inhPairs.push({ ctx, derived: cls.name, base: b, line: cls.line, baseFile: index.classes[b].file });
        });
      });
    });
    if (inhPairs.length) {
      const h = inhPairs[0];
      const txt = inhPairs.slice(0, 4).map((p) => p.derived + " : " + p.base).join(", ") + (inhPairs.length > 4 ? ", …" : "");
      const crossFile = inhPairs.some((p) => p.baseFile && p.baseFile !== p.ctx.name);
      push({
        principle: "INH", title: "Inheritance is used (base / derived classes)",
        file: h.ctx.name, line: h.line, excerpt: excerptAt(h.ctx, h.line),
        classes: Array.from(new Set(inhPairs.map((p) => p.derived))),
        message: txt + " — a derived class extends a base class" + (crossFile ? ", defined in another file" : "") + ".",
        evidence: txt,
        paragraph: "Inheritance is present: " + txt + ". A derived class reuses and specialises the members of its base class" +
          (crossFile ? "; here the base class lives in a different file, so the relationship spans multiple files of the project" : "") +
          " (" + h.ctx.name + ":" + h.line + "). Purpose: factor shared state and behaviour into a base type and extend or specialise it in subclasses — an is-a relationship, with a single base class allowed per type in C#.",
      });
    }

    /* ---- Abstraction present: abstract classes and/or interfaces define contracts ---- */
    const abstractCls = Object.keys(index.classes).filter((n) => index.classes[n].isAbstract);
    if (abstractCls.length || ifaceNames.length) {
      let aFile, aLine, lead;
      if (abstractCls.length) {
        const info = index.classes[abstractCls[0]];
        aFile = info.file; aLine = info.line; lead = "abstract class " + abstractCls.slice(0, 3).join(", ");
      } else {
        const info = index.interfaces[ifaceNames[0]];
        aFile = info.file; aLine = info.line; lead = "interface " + ifaceNames.slice(0, 3).join(", ");
      }
      const actx = ctxByName(ctxs, aFile);
      const both = abstractCls.length && ifaceNames.length;
      const extra = both ? " plus " + ifaceNames.length + " interface" + (ifaceNames.length === 1 ? "" : "s") : "";
      push({
        principle: "ABS", title: "Abstraction is used (interfaces / abstract classes)",
        file: aFile, line: aLine, excerpt: actx ? excerptAt(actx, aLine) : "",
        message: lead + extra + " expose WHAT a type does while hiding HOW.",
        evidence: lead + extra,
        paragraph: "Abstraction is present: " + lead + extra + " (" + aFile + ":" + aLine +
          "). An abstract type names the operations a family of types must provide and leaves the implementation to concrete subclasses/implementers, so callers depend on the contract rather than a concrete class. This is the OOP abstraction pillar and the foundation the Dependency Inversion and Open/Closed principles build on.",
      });
    }

    /* ---- Polymorphism present: virtual/override dispatch, else interface dispatch ---- */
    let polyHit = null;
    ctxs.forEach((ctx) => {
      if (polyHit) return;
      const mm = /\boverride\b/.exec(ctx.stripped);
      if (mm) polyHit = { ctx, line: lineOfIndex(ctx.stripped, mm.index), how: "a subclass overrides a base method" };
    });
    if (!polyHit) {
      const implName = Object.keys(classImplements)[0];
      if (implName) {
        let found = null;
        ctxs.forEach((ctx) => {
          if (found) return;
          const c = ctx.classes.find((x) => x.name === implName);
          if (c) found = { ctx, line: c.line };
        });
        if (found) polyHit = { ctx: found.ctx, line: found.line, how: implName + " is consumed through the interface " + classImplements[implName].join("/") + " it implements" };
      }
    }
    if (polyHit) {
      push({
        principle: "POLY", title: "Polymorphism is used (override / interface dispatch)",
        file: polyHit.ctx.name, line: polyHit.line, excerpt: excerptAt(polyHit.ctx, polyHit.line),
        message: "Runtime dispatch: " + polyHit.how + ", so the object's runtime type decides which implementation runs.",
        evidence: polyHit.how,
        paragraph: "Polymorphism is present: " + polyHit.how + " (" + polyHit.ctx.name + ":" + polyHit.line +
          "). Purpose: a caller holds a base-type or interface reference and the runtime dispatches to the concrete implementation, so new types plug in without changing the calling code. This virtual/interface dispatch is the mechanism behind the Strategy and Observer patterns and behind the Open/Closed principle.",
      });
    }

    /* ---- Singleton pattern (spec 18 §A.1): a class with a private constructor
       AND a static Instance accessor (or a Lazy<Self> field) returning the type.
       Names the variant (lazy vs eager). A plain static helper class — all
       statics, no private instance ctor exposing a single shared instance — must
       NOT trip this, so we require BOTH the private ctor and the self-typed
       singleton accessor. ---- */
    let singleton = null;
    ctxs.forEach((ctx) => {
      ctx.classes.forEach((cls) => {
        if (singleton || cls.kind !== "class") return;
        const body = ctx.stripped.slice(cls.open, cls.close + 1);
        /* a private (or protected) parameterless-or-any constructor for this type */
        const privCtorRe = new RegExp("\\b(?:private|protected)\\s+" + cls.name + "\\s*\\(");
        if (!privCtorRe.test(body)) return;
        /* a Lazy<ThisType> field => lazy variant */
        const lazyRe = new RegExp("\\bLazy\\s*<\\s*" + cls.name + "\\s*>");
        /* a static member typed as / returning this type (Instance/Current) =>
           eager (or property-backed) variant */
        const staticSelfRe = new RegExp("\\bstatic\\b[^;{}\\n]*\\b" + cls.name + "\\b[^;{}\\n]*\\b(Instance|Current|Default)\\b");
        const instanceNamedRe = new RegExp("\\bstatic\\b[^;{}\\n]*\\b(Instance|Current|Default)\\b");
        const isLazy = lazyRe.test(body);
        const hasStaticSelf = staticSelfRe.test(body) || (instanceNamedRe.test(body) && new RegExp("\\bnew\\s+" + cls.name + "\\s*\\(").test(body));
        if (!isLazy && !hasStaticSelf) return;
        const variant = isLazy ? "lazy" : "eager";
        const mm = isLazy ? lazyRe.exec(body) : (staticSelfRe.exec(body) || instanceNamedRe.exec(body));
        const line = lineOfIndex(ctx.stripped, cls.open + (mm ? mm.index : 0));
        singleton = { ctx, cls: cls.name, line, variant };
      });
    });
    if (singleton) {
      const v = singleton.variant;
      push({
        principle: "SRP", title: "Singleton pattern (single shared instance)", pattern: "Singleton",
        file: singleton.ctx.name, line: singleton.line, excerpt: excerptAt(singleton.ctx, singleton.line),
        message: singleton.cls + " is a " + v + " Singleton: a private constructor plus a static accessor hands out one shared instance.",
        evidence: singleton.cls + " has a private constructor and a static accessor that returns the single shared instance (" + v + " initialisation)",
        paragraph: "The Singleton pattern is present (" + v + " variant): " + singleton.cls +
          " has a private constructor so no other code can construct it, and exposes one shared instance through a static accessor (" +
          singleton.ctx.name + ":" + singleton.line + "). Purpose: it guarantees exactly one instance of a type for the whole program and gives a single global point of access to it. " +
          (v === "lazy"
            ? "Here the instance is created lazily through a Lazy<" + singleton.cls + "> field, so it is built once, on first use, and is thread-safe by default."
            : "Here the instance is held in a static field/property, created once and reused everywhere.") +
          " Worth noting in the answer: a Singleton is global shared state, so it trades testability and explicit dependencies for that single-instance guarantee.",
      });
    }

    /* ---- Command pattern (spec 18 §A.2): a class that IMPLEMENTS commands —
       [RelayCommand] methods, or members typed ICommand/IRelayCommand/
       RelayCommand/AsyncRelayCommand. A class that merely BINDS to someone
       else's command from AXAML is not implementing the pattern, so we require
       an actual command declaration in the C# (an attribute or a typed member),
       never an AXAML binding. ---- */
    let command = null;
    ctxs.forEach((ctx) => {
      ctx.classes.forEach((cls) => {
        if (command || (cls.kind !== "class" && cls.kind !== "record")) return;
        const body = ctx.stripped.slice(cls.open, cls.close + 1);
        /* [RelayCommand] attribute on a method => the toolkit generates the ICommand */
        const attrRe = /\[\s*RelayCommand\b/;
        /* a member declared as one of the command types (field, property or param):
           'ICommand Foo', 'IRelayCommand Bar', 'RelayCommand Baz', 'AsyncRelayCommand Qux' */
        const memberRe = /\b(ICommand|IRelayCommand(?:<[^<>]*>)?|RelayCommand(?:<[^<>]*>)?|AsyncRelayCommand(?:<[^<>]*>)?)\s+[A-Za-z_]\w*/;
        const hasAttr = attrRe.test(body);
        const hasMember = memberRe.test(body);
        if (!hasAttr && !hasMember) return;
        const mm = hasAttr ? attrRe.exec(body) : memberRe.exec(body);
        const line = lineOfIndex(ctx.stripped, cls.open + mm.index);
        command = { ctx, cls: cls.name, line, viaAttr: hasAttr };
      });
    });
    if (command) {
      push({
        principle: "OCP", title: "Command pattern (action encapsulated as an object)", pattern: "Command",
        file: command.ctx.name, line: command.line, excerpt: excerptAt(command.ctx, command.line),
        message: command.cls + " implements the Command pattern" +
          (command.viaAttr ? " via a [RelayCommand] method" : " via an ICommand/RelayCommand member") +
          ": an action the UI can bind to and invoke.",
        evidence: command.cls + (command.viaAttr ? " uses [RelayCommand] so the toolkit generates an ICommand the View binds to" : " exposes an ICommand/RelayCommand member the View binds to"),
        paragraph: "The Command pattern is present: " + command.cls + " encapsulates an action as an object" +
          (command.viaAttr
            ? " using CommunityToolkit.Mvvm's [RelayCommand], which generates an ICommand property the View binds to ("
            : " by exposing an ICommand/RelayCommand member the View binds to (") +
          command.ctx.name + ":" + command.line + "). Purpose: the Command pattern turns a request into a first-class object, with its own execute (and optional can-execute) logic, so the caller (here the button/menu in the View) is decoupled from what actually runs. The View binds to the command and invokes it without knowing the method behind it, which is exactly how MVVM keeps the View free of logic.",
      });
    }

    return out;
  }

  function ctxByName(ctxs, name) {
    for (let i = 0; i < ctxs.length; i++) if (ctxs[i].name === name) return ctxs[i];
    return ctxs[0] || { lines: [] };
  }

  /* ================= scanning ================= */

  function scan(files) {
    const list = (Array.isArray(files) ? files : []).filter((f) => f && typeof f.text === "string");
    const index = buildIndex(list);
    const ctxs = list.map(fileContext);
    const findings = [];
    const ruleCount = {}; /* ruleId -> running count, so alternate skeletons differ per finding */
    /* a field flagged by the strong unused-injected-dependency rule should not
       also be reported by the legacy info-level unused-injected-field rule.
       Pre-pass so the suppression works regardless of rule order. */
    const strongUnused = new Set();
    const strongRule = RULES.find((r) => r.id === "unused-injected-dependency");
    if (strongRule) {
      ctxs.forEach((ctx) => {
        let items = [];
        try { items = strongRule.scan(ctx, index, ctxs) || []; } catch (e) { items = []; }
        items.forEach((it) => strongUnused.add((it.file || ctx.name) + "|" + it.cls + "|" + it.fieldName));
      });
    }
    ctxs.forEach((ctx) => {
      RULES.forEach((rule) => {
        let items;
        try { items = rule.scan(ctx, index, ctxs) || []; }
        catch (e) { items = []; } /* a crashing rule is skipped, never fatal */
        items.forEach((it) => {
          if (rule.id === "unused-injected-field" &&
              strongUnused.has((it.file || ctx.name) + "|" + it.cls + "|" + it.fieldName)) {
            return; /* already covered by the high-severity rule */
          }
          it._i = (ruleCount[rule.id] || 0); /* 0-based index of this finding within its rule */
          ruleCount[rule.id] = it._i + 1;
          let paragraph = it.message || "";
          try { if (typeof rule.paragraph === "function") paragraph = rule.paragraph(it); } catch (e) {}
          findings.push({
            ruleId: rule.id,
            kind: "violation",
            principle: it.principle || rule.principle,
            /* spec 19 G3: cross-cutting findings carry every principle they
               break (primary first). assembleAnswer full mode seeds a derived,
               principle-framed entry in each listed section so no mandatory
               RUBRIC principle comes out empty. Absent => single-principle. */
            principles: (it.principles || rule.principles || null),
            severity: it.severity || rule.severity,
            file: it.file || ctx.name,
            line: it.line || 1,
            excerpt: it.excerpt || "",
            message: it.message || rule.title,
            cls: it.cls || "",          /* enclosing class, for per-class reconciliation */
            /* does this finding re-couple an INJECTED abstraction to a concretion
               inside the class? (downcast of injected field, new-of-concrete in
               ctor, or is-narrowing of an injected field) — drives defect-2 */
            dipInjectionBreak:
              (rule.id === "downcast" && it.injected) ||
              (rule.id === "new-in-ctor") ||
              (rule.id === "single-is-downcast" && it.onInjectedField) || false,
            theory: rule.theory || "",
            fix: rule.fix || "",
            before: rule.before || "",
            after: rule.after || "",
            paragraph,
          });
        });
      });
    });
    /* presence findings (positive evidence the answer's presence-half needs) */
    let presence = [];
    try { presence = detectPresence(ctxs, index); } catch (e) { presence = []; }
    presence.forEach((p) => findings.push(p));

    /* ---- defect 2: presence/violation reconciliation pass ----
       A class can legitimately inject abstractions through its constructor (DIP
       present) AND break DIP inside a member (downcast / new-of-concrete /
       single-is narrowing on the injected field). Left alone, the presence
       paragraph would claim DIP is clean while a violation says otherwise — a
       contradiction graders punish. Here we qualify the DIP presence paragraph
       with a caveat that names the offending member and points at the violation,
       instead of asserting the class is clean. Grouped per class so a fixture
       WITHOUT the cast keeps an unqualified presence paragraph. */
    try { reconcileDipPresence(findings); } catch (e) {}

    findings.sort((a, b) => (a.file === b.file ? a.line - b.line : (a.file < b.file ? -1 : 1)));
    return { findings, index };
  }

  function reconcileDipPresence(findings) {
    /* map class name -> the DIP-injection breaks found inside it. We only count
       findings that actually re-couple an injected abstraction (downcast of the
       injected field, new-of-concrete in the ctor, is-narrowing of the injected
       field) — NOT, say, an is-narrowing of an ordinary method parameter, which
       is an LSP/OCP point but does not contradict the DIP-present claim. */
    const breaks = {};
    findings.forEach((f, i) => {
      if (f.kind === "violation" && f.dipInjectionBreak && f.cls) {
        (breaks[f.cls] = breaks[f.cls] || []).push({ f, n: i });
      }
    });
    findings.forEach((p) => {
      if (p.kind !== "presence" || p.principle !== "DIP" || !Array.isArray(p.classes)) return;
      /* which of the injecting classes also broke DIP inside a member? */
      const hits = [];
      p.classes.forEach((c) => { if (breaks[c]) breaks[c].forEach((b) => hits.push({ cls: c, b: b.f })); });
      if (!hits.length) return;
      const h = hits[0];
      /* word the hint WITHOUT the tokens the violations/implementations modes
         filter on ("downcast", "violates", "Violation", "Fix:") so a presence-
         only draft stays clean while still flagging the contradiction */
      const memberHint = h.b.ruleId === "downcast" ? "a concrete-type cast of the injected abstraction"
        : h.b.ruleId === "new-in-ctor" ? "a 'new' of a concrete collaborator"
        : "a narrowing type-test on the injected field";
      const where = h.b.file + ":" + h.b.line;
      /* strip a trailing period from the existing presence prose, then append
         the caveat so the same paragraph carries both halves honestly */
      p.paragraph = String(p.paragraph || "").replace(/\s*$/, "") +
        " Caveat: DIP is followed at the constructor of " + h.cls + " but broken inside it by " + memberHint +
        " (see the flagged finding at " + where + ") — the dependency is injected, then re-coupled to a concrete type, so this presence is real but qualified, not clean.";
      p.qualified = true;
    });
  }

  /* ================= answer assembly ================= */

  function joinAnd(parts) {
    if (parts.length <= 1) return parts.join("");
    return parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1];
  }

  /* the 5 SOLID principles in rubric order, then the OO pillars */
  const RUBRIC_ORDER = ["SRP", "OCP", "LSP", "ISP", "DIP"];
  const PILLAR_ORDER = ["ENC", "INH", "ABS", "POLY"];

  /* one-line "general purpose" sentence per principle, for sections that have a
     finding (presence or violation) but where we still want the purpose stated */
  const PURPOSE = {
    SRP: "Purpose: a class should have exactly one reason to change, so domain, persistence and presentation concerns are kept in separate, individually testable types.",
    OCP: "Purpose: software should be open for extension but closed for modification — new behaviour arrives as new classes plugged into an existing abstraction, not as edits to working code.",
    LSP: "Purpose: any implementation must be usable wherever its abstraction is expected, so a client never needs to know or test which concrete type it actually received.",
    ISP: "Purpose: clients should not depend on members they do not use, so fat interfaces are split into small role interfaces each class can fully honour.",
    DIP: "Purpose: high-level policy should depend on abstractions, with the concrete choice made once in the composition root and injected, never constructed inside business classes.",
    ENC: "Purpose: an object owns its state and exposes behaviour, keeping fields private so it can enforce its invariants and change representation without breaking callers.",
    POLY: "Purpose: clients call an abstraction and the runtime dispatches to the right implementation, replacing manual type checks with virtual/interface dispatch.",
    INH: "Purpose: factor shared state and behaviour into a base class and let subclasses extend or specialise it, modelling an is-a relationship without duplicating code.",
    ABS: "Purpose: expose what a type does through an interface or abstract class while hiding how, so callers depend on the contract and implementations can be swapped or added freely.",
  };

  /* spec 19 G3: frame a cross-cutting finding for a SECONDARY principle it also
     breaks. Returns the sentence the derived entry uses under that principle's
     section, so an LSP/OCP section is never left empty when a downcast (primary
     DIP) points at it. The wording is principle-specific and deliberately does
     NOT reuse the rule's own title, so the primary finding still headlines its
     own (DIP) section while the secondary sections carry a clearly-derived
     consequence entry. `f` is the finding; `p` the secondary principle. */
  function crossRefSentence(f, p) {
    const where = f.file + ":" + (f.line || 1);
    const concrete = f.message && /to the concrete (\w+)/.exec(f.message);
    const cname = concrete ? concrete[1] : null;
    if (f.ruleId === "downcast") {
      if (p === "LSP") {
        return "Liskov Substitution is broken as a consequence of the downcast at " + where +
          ": once the code casts the abstraction to one concrete type" + (cname ? " (" + cname + ")" : "") +
          ", it works only for that implementation, so substituting any other valid implementation of the interface makes it take the error path or fail. The abstraction is no longer freely substitutable.";
      }
      if (p === "OCP") {
        return "Open/Closed is also affected by the downcast at " + where +
          ": because the needed member lives only on the concrete type and is reached through the cast, a new implementation of the interface cannot be plugged in without editing this method to add another cast/branch. Lifting the member onto the interface restores extension-by-new-class.";
      }
    }
    /* generic fallback for any other cross-cutting finding */
    return pName(p) + " is also implicated by the finding at " + where + " (" + (f.message || f.ruleId) +
      "); see the primary write-up under " + pName(f.principle) + " for the detail and fix.";
  }
  /* module-local pName so crossRefSentence can name a principle outside assembleAnswer */
  function pName(p) { return PRINCIPLES[p] ? PRINCIPLES[p].name : p; }

  /* the explicit draft modes the UI offers. "full" is the default and reproduces
     the original presence-then-violations August-rubric draft (spec 08). "june"
     (spec 18) assembles the June P1 paper's 1.1-1.5 structure instead; for the
     findings list / coverage / select-all it behaves like full (it draws on every
     finding), only the DRAFT assembly differs. */
  const MODES = ["full", "violations", "implementations", "june"];
  function normalizeMode(mode) { return MODES.indexOf(mode) !== -1 ? mode : "full"; }

  /* filter a findings list down to the kinds a given mode renders. The UI uses
     the same predicate for the findings list, the coverage strip and select-all,
     so the draft and the on-screen findings always agree. June draws on
     everything, so it filters like full. */
  function filterByMode(findings, mode) {
    const m = normalizeMode(mode);
    const list = Array.isArray(findings) ? findings : [];
    if (m === "violations") return list.filter((f) => f && f.kind !== "presence");
    if (m === "implementations") return list.filter((f) => f && f.kind === "presence");
    return list.slice();
  }

  function assembleAnswer(findings, opts) {
    opts = opts || {};
    const mode = normalizeMode(opts.mode);
    /* June P1 rubric is a wholly different draft shape (1.1-1.5), assembled by
       its own builder; the August-style modes below are untouched. */
    if (mode === "june") return assembleJuneRubric(findings, opts);
    const project = opts.project || "the provided code";
    const list = Array.isArray(findings) ? findings.slice() : [];
    const ruleById = {};
    RULES.forEach((r) => { ruleById[r.id] = r; });
    const pName = (p) => (PRINCIPLES[p] ? PRINCIPLES[p].name : p);
    const out = [];
    out.push("OOP/SOLID analysis — " + project);
    out.push("");

    if (!list.length) {
      if (mode === "violations") {
        out.push("Reviewing " + project + " for SOLID violations, nothing was ticked to write up yet. Confirm the violation findings on the left — each names a file:line, the principle it breaks and a fix — then rebuild this draft. Principles with no confirmed violation will get a one-line note so every principle is still addressed.");
      } else if (mode === "implementations") {
        out.push("Reviewing how " + project + " implements the SOLID principles, nothing was ticked to write up yet. Confirm the presence findings on the left — each names where a principle is applied and the evidence for it — then rebuild this draft to get a per-principle 'how it is implemented' answer.");
      } else {
        out.push("Reviewing " + project + " against the SOLID principles and the core OO pillars (encapsulation, polymorphism), nothing was selected to write up. Tick the presence findings and the confirmed violations on the left, then rebuild this draft so each principle gets a presence verdict and, where relevant, a violation with its fix.");
      }
      return out.join("\n");
    }

    const isPresence = (f) => f.kind === "presence";
    const present = list.filter(isPresence);
    const violations = list.filter((f) => !isPresence(f));

    /* ---- intro line, tailored to the mode ---- */
    if (mode === "violations") {
      out.push("Reviewing " + project + " for SOLID violations, principle by principle. " +
        violations.length + " confirmed issue" + (violations.length === 1 ? "" : "s") + " " +
        (violations.length === 1 ? "is" : "are") + " written up below, each with its file:line, the evidence, the principle it breaks, the consequence, and a concrete fix; principles with no confirmed violation get a one-line note so the whole rubric is still covered.");
    } else if (mode === "implementations") {
      out.push("Reviewing how " + project + " implements each SOLID principle. For every principle below: whether it is applied and where, the evidence in the code, the principle's general purpose, and how that purpose is served here. " +
        present.length + " principle" + (present.length === 1 ? " is" : "s are") + " clearly applied in the code.");
    } else {
      out.push("Analysing " + project + " principle by principle. For each SOLID principle below: whether it is present and where, then any violation with a concrete fix. " +
        present.length + " principle" + (present.length === 1 ? " is" : "s are") + " applied well in the code; " +
        violations.length + " issue" + (violations.length === 1 ? "" : "s") + " need" + (violations.length === 1 ? "s" : "") + " correction.");
    }
    out.push("");

    /* spec 19 G3: cross-cutting violations whose `principles` array names `p` as
       a SECONDARY (non-primary) principle. These seed a derived entry in p's
       section so a mandatory RUBRIC principle is never left empty when, e.g.,
       a downcast (primary DIP) also breaks LSP and OCP. Only the secondary
       principles get a derived entry; the primary keeps its full write-up. */
    const crossRefsFor = (p) => violations.filter((f) =>
      Array.isArray(f.principles) && f.principle !== p && f.principles.indexOf(p) !== -1);

    const section = (p, heading) => {
      const pres = list.filter((f) => f.principle === p && isPresence(f));
      const viol = list.filter((f) => f.principle === p && !isPresence(f));

      /* ---- Violations mode: violation paragraphs only, filler when none ---- */
      if (mode === "violations") {
        out.push("=== " + heading + " ===");
        if (viol.length) {
          viol.forEach((f) => {
            const title = (ruleById[f.ruleId] && ruleById[f.ruleId].title) || f.message || f.ruleId;
            out.push("Violation — " + title + " (" + f.file + ":" + f.line + "):");
            out.push(f.paragraph || f.message || "");
            if (f.fix) out.push("Fix: " + f.fix);
            out.push("");
          });
        } else {
          out.push("No clear violation of " + pName(p) + " found; state its purpose and check manually.");
          if (PURPOSE[p]) out.push(PURPOSE[p]);
          out.push("");
        }
        return;
      }

      /* ---- Implementations mode: presence paragraphs only, filler when none ---- */
      if (mode === "implementations") {
        out.push("=== " + heading + " ===");
        if (pres.length) {
          pres.forEach((f) => {
            out.push(f.paragraph || f.message || "");
            out.push("");
          });
        } else {
          out.push("No distinct " + pName(p) + " implementation was detected automatically; check the code by hand for where it is applied. " + (PURPOSE[p] || ""));
          out.push("");
        }
        return;
      }

      /* ---- Full mode: presence then violations (original behaviour),
             then any cross-cutting consequence entry (spec 19 G3) ---- */
      const xrefs = crossRefsFor(p);
      if (!pres.length && !viol.length && !xrefs.length) return;
      out.push("=== " + heading + " ===");
      pres.forEach((f) => {
        out.push(f.paragraph || f.message || "");
        out.push("");
      });
      viol.forEach((f) => {
        const title = (ruleById[f.ruleId] && ruleById[f.ruleId].title) || f.message || f.ruleId;
        out.push("Violation — " + title + " (" + f.file + ":" + f.line + "):");
        out.push(f.paragraph || f.message || "");
        if (f.fix) out.push("Fix: " + f.fix);
        out.push("");
      });
      /* derived cross-cutting consequence entries: a finding whose primary
         principle is elsewhere but that also breaks p. Framed for p, pointing
         back at the primary write-up. Deduped per primary file:line. */
      const seenXref = new Set();
      xrefs.forEach((f) => {
        const key = f.ruleId + ":" + f.file + ":" + f.line;
        if (seenXref.has(key)) return;
        seenXref.add(key);
        const primaryName = pName(f.principle);
        /* heading deliberately does NOT reuse the rule's own title (so the
           primary principle still owns the headline; this is a derived
           consequence, framed for p and pointing back at the primary). */
        out.push("Cross-cutting consequence (primary write-up under " + primaryName + ", " + f.file + ":" + f.line + "):");
        out.push(crossRefSentence(f, p));
        out.push("");
      });
      /* neither a presence paragraph nor a violation paragraph carried the
         general purpose? add the one-liner so the rubric's "purpose" box is met */
      if (!pres.length && PURPOSE[p]) { out.push(PURPOSE[p]); out.push(""); }
    };

    RUBRIC_ORDER.forEach((p) => section(p, pName(p) + " (" + p + ")"));
    /* OO pillars: in violations mode only when an actual violation hits them
       (no "no violation" filler for the pillars); in implementations/full mode
       when there is presence to show. The 5 SOLID principles always appear. */
    if (mode === "violations") {
      PILLAR_ORDER.filter((p) => violations.some((f) => f.principle === p))
        .forEach((p) => section(p, pName(p)));
    } else {
      PILLAR_ORDER.filter((p) => list.some((f) => f.principle === p))
        .forEach((p) => section(p, pName(p)));
    }

    /* ---- Summary, tailored to the mode ---- */
    out.push("=== Summary ===");
    if (mode === "violations") {
      const vPrins = Array.from(new Set(violations.map((f) => pName(f.principle))));
      out.push("In total, " + project + " has " + violations.length + " confirmed violation" +
        (violations.length === 1 ? "" : "s") +
        (vPrins.length ? ", concentrated on " + joinAnd(vPrins) : "") +
        ". Fixing them keeps the high-level logic dependent only on abstractions, lets new behaviour be added as new classes rather than edits to working code, and keeps every implementation safely substitutable for its interface — which is what the SOLID principles exist to protect.");
    } else if (mode === "implementations") {
      const pPrins = Array.from(new Set(present.map((f) => pName(f.principle))));
      out.push("Overall, " + project + (pPrins.length ? " applies " + joinAnd(pPrins) + " deliberately" : " is written to follow the SOLID principles") +
        ": high-level policy depends on injected abstractions, behaviour varies through interchangeable implementations behind those abstractions, and state stays encapsulated behind properties. That is what lets the code be extended with new classes and tested against fakes rather than rewritten.");
    } else {
      out.push("Overall, " + project + " gets the core abstractions right — " +
        (present.length ? "it applies " + joinAnd(Array.from(new Set(present.map((f) => f.principle))).map(pName)) + " — " : "") +
        "while the remaining issues concentrate on " + joinAnd(Array.from(new Set(violations.map((f) => pName(f.principle)))).length ? Array.from(new Set(violations.map((f) => pName(f.principle)))) : ["minor hygiene"]) +
        ". Addressing them keeps the high-level logic dependent only on abstractions, lets new behaviour be added as new classes rather than edits to working code, and keeps every implementation safely substitutable for its interface — exactly what the SOLID principles exist to protect.");
    }
    return out.join("\n");
  }

  /* ================= June P1 rubric assembly (spec 18) =================
     The June 2025 paper scores P1 as five parts:
       1.1 what the code models (2)        1.2 purpose of the interfaces (2)
       1.3 the four OOP pillars (8)        1.4 two SOLID principles (4)
       1.5 one design pattern (4)
     This builder emits exactly those headings, in order, drawing on the scan's
     findings PLUS (when given) the structural index so it can speak about
     orchestration and inheritance the findings alone do not carry. Where the
     scan genuinely cannot know something it emits a bracketed [fill in: ...]
     cue rather than inventing. */

  const JUNE_HEADINGS = [
    "1.1 General analysis",
    "1.2 Interfaces",
    "1.3 OOP principles",
    "1.4 SOLID principles",
    "1.5 Design pattern",
  ];

  /* derive the structural facts 1.1-1.3 need from the pasted files. Returns the
     class/interface index, an implements map, the most likely orchestrator and
     a short list of the action verbs the public methods suggest. Degrades to a
     thin object when no files are available (the draft then leans on findings). */
  function juneStructure(files) {
    const list = (Array.isArray(files) ? files : []).filter((f) => f && typeof f.text === "string");
    if (!list.length) return null;
    const index = buildIndex(list);
    const ctxs = list.map(fileContext);
    const classNames = Object.keys(index.classes).filter((n) => n !== "Program");
    const ifaceNames = Object.keys(index.interfaces);
    const implementsMap = {}; /* class -> [iface] */
    const ifaceImpls = {};    /* iface -> [class] */
    const callCounts = {};    /* class -> outgoing '.' call count (orchestration proxy) */
    const verbs = new Set();
    const VERB_RE = /^(Process|Register|Generate|Retrieve|Validate|Summari[sz]e|Add|Remove|Create|Build|Find|Get|Load|Save|Run|Execute|Handle|Notify|Send|Calculate|Plan|Mark|Distribute|Print|Update|Apply)/;
    ctxs.forEach((ctx) => {
      ctx.classes.forEach((cls) => {
        if (cls.kind !== "class" && cls.kind !== "record") return;
        const head = ctx.stripped.slice(cls.declIdx, cls.open);
        const co = head.indexOf(":");
        if (co !== -1) {
          head.slice(co + 1).split(",").map((s) => s.trim().replace(/<.*$/, "")).filter(Boolean).forEach((b) => {
            if (index.interfaces[b]) {
              (implementsMap[cls.name] = implementsMap[cls.name] || []).push(b);
              (ifaceImpls[b] = ifaceImpls[b] || []).push(cls.name);
            }
          });
        }
        const body = ctx.stripped.slice(cls.open, cls.close + 1);
        callCounts[cls.name] = (callCounts[cls.name] || 0) + (body.match(/\)\s*\.\s*[A-Za-z_]/g) || []).length + (body.match(/\b_[A-Za-z]\w*\s*\.\s*[A-Za-z_]/g) || []).length;
        (cls.members || []).forEach((mb) => {
          if (mb.isCtor) return;
          const vm = VERB_RE.exec(mb.name);
          if (vm) verbs.add(vm[1].replace(/ise$/, "ize"));
        });
      });
    });
    /* orchestrator: a workflow/manager/service-named class wins; otherwise the
       class with the most outgoing calls (it drives the others) */
    const ORCH_RE = /(WorkflowManager|Workflow|Manager|Coordinator|Controller|Service|Planner|Orchestrator|Engine)$/;
    let orchestrator = classNames.filter((n) => ORCH_RE.test(n))
      .sort((a, b) => (callCounts[b] || 0) - (callCounts[a] || 0))[0] || null;
    if (!orchestrator && classNames.length) {
      orchestrator = classNames.slice().sort((a, b) => (callCounts[b] || 0) - (callCounts[a] || 0))[0];
    }
    return { index, classNames, ifaceNames, implementsMap, ifaceImpls, orchestrator, verbs: Array.from(verbs) };
  }

  function assembleJuneRubric(findings, opts) {
    opts = opts || {};
    const project = opts.project || "the provided code";
    const list = Array.isArray(findings) ? findings.slice() : [];
    const present = list.filter((f) => f.kind === "presence");
    const violations = list.filter((f) => f.kind !== "presence");
    const struct = juneStructure(opts.files) || (opts.index ? { index: opts.index } : null);
    const pName = (p) => (PRINCIPLES[p] ? PRINCIPLES[p].name : p);
    const out = [];
    out.push("Problem 1: OOP/SOLID analysis of " + project + " (June P1 rubric)");
    out.push("");

    /* ---------- 1.1 General analysis ---------- */
    out.push("=== " + JUNE_HEADINGS[0] + " ===");
    if (struct && struct.classNames) {
      const types = struct.classNames.slice();
      const ifaces = struct.ifaceNames || [];
      let p11 = "The code defines " + (types.length ? types.length + " classes (" + types.slice(0, 8).join(", ") + ")" : "a small set of classes") +
        (ifaces.length ? " and " + ifaces.length + " interface" + (ifaces.length === 1 ? "" : "s") + " (" + ifaces.join(", ") + ")" : "") + ". ";
      if (struct.orchestrator) {
        p11 += struct.orchestrator + " orchestrates the workflow: it holds the other collaborators and drives them, so it reads as the entry point into the domain. ";
      } else {
        p11 += "[fill in: name the class that orchestrates the workflow and what it coordinates]. ";
      }
      if (struct.verbs && struct.verbs.length) {
        p11 += "The public methods (" + struct.verbs.slice(0, 6).join(", ") + ") suggest the system " +
          "[fill in: one sentence on what it models, e.g. it takes in items, checks/validates them, processes them and produces summaries].";
      } else {
        p11 += "[fill in: from the method names, say in one sentence what the system models and does].";
      }
      out.push(p11);
    } else {
      out.push("[fill in: list the top-level types, name the class that orchestrates the workflow, and say in one sentence what the system models. Paste the files and re-scan for an auto-filled draft].");
    }
    out.push("");

    /* ---------- 1.2 Interfaces ---------- */
    out.push("=== " + JUNE_HEADINGS[1] + " ===");
    if (struct && struct.ifaceNames && struct.ifaceNames.length) {
      const idx = struct.index;
      const capability = struct.ifaceNames.filter((n) => idx.interfaces[n].members.length > 0);
      const markers = struct.ifaceNames.filter((n) => idx.interfaces[n].members.length === 0);
      let p12 = "The interfaces are small capability contracts that say what a class can DO, not what it is. ";
      if (capability.length) {
        p12 += "The capability interfaces are " + joinAnd(capability) + ", and each declares only the one to few members a client of that role needs. ";
        const exampleClass = Object.keys(struct.implementsMap)[0];
        if (exampleClass) {
          p12 += exampleClass + " implements " + joinAnd(struct.implementsMap[exampleClass]) +
            ", opting into exactly the roles it supports, while a class that lacks a capability simply does not implement that interface. ";
        }
      }
      if (markers.length) {
        p12 += joinAnd(markers) + " " + (markers.length === 1 ? "is a marker interface" : "are marker interfaces") +
          " (no members) used only to tag types. ";
      }
      p12 += "This is Interface Segregation in action: by splitting capabilities into separate role interfaces, no class is forced to depend on or implement members it cannot honour, and each consumer (processor, manager) depends only on the narrow role it actually calls.";
      out.push(p12);
    } else {
      out.push("[fill in: name the interfaces, say which classes implement which, and explain that small capability interfaces let each class opt into only the roles it supports (Interface Segregation)].");
    }
    out.push("");

    /* ---------- 1.3 OOP principles (4 pillars) ---------- */
    out.push("=== " + JUNE_HEADINGS[2] + " ===");
    const presByPrin = (p) => present.filter((f) => f.principle === p);
    /* Encapsulation */
    const enc = presByPrin("ENC")[0];
    if (enc) {
      out.push("Encapsulation: present. " + enc.message + " (" + enc.file + ":" + enc.line + "). " + PURPOSE.ENC);
    } else {
      out.push("Encapsulation: [fill in: point to private fields / properties with private setters; purpose: the object controls its own state and stays valid]. " + PURPOSE.ENC);
    }
    /* Inheritance: the spec's calibration point, state interface-only honestly */
    let inheritanceLine;
    if (struct && struct.classNames) {
      const classToClass = juneClassInheritance(opts.files, struct.index);
      if (classToClass.length) {
        inheritanceLine = "Inheritance: present as class-to-class inheritance, " + joinAnd(classToClass.map((x) => x.derived + " : " + x.base)) +
          ". Purpose: a shared base lets derived types reuse and specialise behaviour through an is-a relationship.";
      } else {
        inheritanceLine = "Inheritance: the only inheritance here is interface implementation, so there is NO class-to-class inheritance. " +
          (Object.keys(struct.implementsMap).length ? "Every class realises interfaces (e.g. " + Object.keys(struct.implementsMap).slice(0, 3).map((c) => c + " : " + struct.implementsMap[c].join(", ")).join("; ") + ") rather than deriving from a base class. " : "") +
          "Stating that honestly is what scores the point: a shared interface type still lets the concrete types be stored and handled together, while behaviour reuse is achieved by composition, not a class hierarchy.";
      }
    } else {
      inheritanceLine = "Inheritance: [fill in, and check honestly whether it is class-to-class inheritance or only interface implementation; if every class merely implements interfaces, say plainly there is NO class-to-class inheritance, which is the honest answer the rubric rewards].";
    }
    out.push(inheritanceLine);
    /* Abstraction */
    const absPres = presByPrin("ISP")[0] || presByPrin("DIP")[0];
    if (struct && struct.ifaceNames && struct.ifaceNames.length) {
      out.push("Abstraction: present. The consumers depend on the interfaces (" + joinAnd(struct.ifaceNames.slice(0, 4)) +
        ") rather than the concrete classes behind them, so high-level logic is written once against the contracts. Purpose: hide implementation behind a role so callers are decoupled from the concrete type, which is the foundation DIP and OCP build on here.");
    } else if (absPres) {
      out.push("Abstraction: present. " + absPres.message + " Purpose: callers depend on roles/contracts, not concrete classes.");
    } else {
      out.push("Abstraction: [fill in: name the interfaces/abstract types the high-level classes depend on; purpose: decouple callers from concrete implementations].");
    }
    /* Polymorphism */
    const poly = presByPrin("POLY")[0];
    const ocpStrat = present.find((f) => f.pattern === "Strategy") || presByPrin("OCP")[0];
    if (poly) {
      out.push("Polymorphism: present. " + poly.message + " " + PURPOSE.POLY);
    } else if (ocpStrat || (struct && struct.ifaceImpls && Object.values(struct.ifaceImpls).some((a) => a.length >= 2))) {
      const polyIface = struct && struct.ifaceImpls ? Object.keys(struct.ifaceImpls).filter((i) => struct.ifaceImpls[i].length >= 2)[0] : null;
      out.push("Polymorphism: present. Code that holds an abstraction" + (polyIface ? " (e.g. " + polyIface + ", implemented by " + joinAnd(struct.ifaceImpls[polyIface]) + ")" : "") +
        " calls its members and the runtime dispatches to the concrete type, with ToString()/interface overrides resolved at run time. " + PURPOSE.POLY);
    } else {
      out.push("Polymorphism: [fill in: where a loop or call over an abstraction dispatches to different concrete types at run time; purpose: one piece of code handles many types]. " + PURPOSE.POLY);
    }
    out.push("");

    /* ---------- 1.4 SOLID: the two principles the code most clearly APPLIES ----------
       The June paper asks which TWO SOLID principles are applied, so we score by
       how strongly a principle is PRESENT, not by raw finding count: each presence
       finding is strong evidence, each violation of the same principle subtracts
       (a principle the code also breaks is a weaker 'applied' pick). Ties break in
       the model answer's canonical order — ISP first (many small interfaces), then
       DIP (constructor injection), matching the DocumentManager solution. */
    out.push("=== " + JUNE_HEADINGS[3] + " ===");
    const SOLID = ["SRP", "OCP", "LSP", "ISP", "DIP"];
    const TIE_ORDER = ["ISP", "DIP", "OCP", "SRP", "LSP"];
    const presCount = {}, violCount = {};
    SOLID.forEach((p) => { presCount[p] = 0; violCount[p] = 0; });
    list.forEach((f) => {
      if (presCount[f.principle] == null) return;
      if (f.kind === "presence") presCount[f.principle]++; else violCount[f.principle]++;
    });
    const quality = (p) => presCount[p] * 3 - violCount[p];
    /* candidates are principles with at least one presence finding (genuinely
       applied); if fewer than two, fall back to any principle with evidence */
    let candidates = SOLID.filter((p) => presCount[p] > 0);
    if (candidates.length < 2) candidates = SOLID.filter((p) => presCount[p] > 0 || violCount[p] > 0);
    const picks = candidates.sort((a, b) => {
      const d = quality(b) - quality(a);
      if (d !== 0) return d;
      return TIE_ORDER.indexOf(a) - TIE_ORDER.indexOf(b);
    }).slice(0, 2);
    if (picks.length) {
      picks.forEach((p) => {
        const pres = presByPrin(p)[0];
        const benefit = pres ? juneBenefit(pres.paragraph) : "[fill in: the specific place this principle is applied in " + project + " and the benefit it brings here]";
        out.push(pName(p) + " (" + p + "): " + PURPOSE[p] + " Specifically here: " + benefit);
      });
      if (picks.length === 1) {
        out.push("[fill in: a second SOLID principle the code clearly shows; pick the next strongest by evidence, e.g. SRP if classes are single-purpose].");
      }
    } else {
      out.push("[fill in: pick the two SOLID principles the code most clearly applies (typically ISP when there are several small interfaces and DIP when dependencies are constructor-injected), and give each a general purpose plus the specific benefit here].");
    }
    out.push("");

    /* ---------- 1.5 Design pattern: the single strongest, runner-up in a clause ---------- */
    out.push("=== " + JUNE_HEADINGS[4] + " ===");
    const patterns = present.filter((f) => f.pattern);
    /* rank patterns: a named, code-anchored one beats a generic interface-strategy.
       Strategy/Repository/Singleton/Command/Observer all carry a paragraph. */
    const patternRank = { Singleton: 5, Command: 5, Observer: 4, Repository: 4, Strategy: 3 };
    patterns.sort((a, b) => (patternRank[b.pattern] || 1) - (patternRank[a.pattern] || 1));
    if (patterns.length) {
      const top = patterns[0];
      let p15 = top.paragraph;
      const runner = patterns.find((f) => f.pattern !== top.pattern);
      if (runner) {
        /* keep the runner message verbatim (don't lower-case an identifier like
           IDietaryRule into iDietaryRule); strip any leading verdict lead-in */
        p15 += " (A second pattern is also defensible: " + runner.pattern + ", as seen where " + stripLead(runner.message) + ")";
      }
      out.push(p15);
    } else {
      out.push("[fill in: name the one design pattern you can point at in the code (Strategy when an interface has interchangeable implementations injected, Facade when one class hides a subsystem, Repository when data access sits behind an interface), and describe its role here].");
    }
    out.push("");

    /* ---------- closing note: violations as improvement leads ---------- */
    if (violations.length) {
      const vPrins = Array.from(new Set(violations.map((f) => pName(f.principle))));
      out.push("Note for the write-up: the scan also flagged " + violations.length + " possible weakness" +
        (violations.length === 1 ? "" : "es") + " (" + joinAnd(vPrins) + "). The June rubric rewards an honest reading, so mention the clearest one or two as 'where the design could be improved' rather than padding. See the Violations mode for the detail and fixes.");
    }
    /* June house style: no em dashes. Some spliced presence paragraphs (shared
       with the August draft, which keeps them) carry an em dash; normalise them
       to a comma here so only the June output is affected, never the August one. */
    return out.join("\n").replace(/\s*—\s*/g, ", ");
  }

  /* detect genuine class-to-class inheritance (a class whose base list names
     another CLASS, not an interface). Used by 1.3 to decide whether to state
     'no class-to-class inheritance'. */
  function juneClassInheritance(files, index) {
    const list = (Array.isArray(files) ? files : []).filter((f) => f && typeof f.text === "string");
    if (!list.length || !index) return [];
    const ctxs = list.map(fileContext);
    const res = [];
    ctxs.forEach((ctx) => {
      ctx.classes.forEach((cls) => {
        if (cls.kind !== "class") return;
        const head = ctx.stripped.slice(cls.declIdx, cls.open);
        const co = head.indexOf(":");
        if (co === -1) return;
        head.slice(co + 1).split(",").map((s) => s.trim().replace(/<.*$/, "")).filter(Boolean).forEach((b) => {
          if (index.classes[b] && !index.interfaces[b] && b !== cls.name) res.push({ derived: cls.name, base: b });
        });
      });
    });
    return res;
  }

  /* the specific-benefit half of a presence paragraph: the text AFTER its own
     'Purpose: ...' sentence (the 'Here ...' part), so 1.4 can pair our general
     PURPOSE line with the code-specific benefit without repeating 'Purpose:'. */
  function juneBenefit(paragraph) {
    const s = String(paragraph || "");
    const pi = s.indexOf("Purpose:");
    if (pi === -1) return lowerFirst(stripLead(s));
    /* skip past the purpose sentence (ends at the first '. ' after 'Purpose:') */
    const after = s.slice(pi + 8);
    const dot = after.indexOf(". ");
    let tail = dot === -1 ? "" : after.slice(dot + 2).trim();
    /* the benefit sentence usually opens with 'Here ...'; drop it so the splice
       after 'Specifically here:' does not read 'Specifically here: here ...' */
    tail = tail.replace(/^Here\b[,:]?\s*/i, "");
    return tail ? lowerFirst(tail) : lowerFirst(stripLead(s));
  }

  /* lower-case the first character of a sentence (for splicing a paragraph mid-line) */
  function lowerFirst(s) { s = String(s || ""); return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; }
  /* strip a leading 'X is present: ' / 'The Y pattern is present: ' lead-in so the
     paragraph can be spliced after a custom phrase without repeating the verdict */
  function stripLead(s) {
    return String(s || "").replace(/^[^:]{0,80}?\bis present[^:]{0,40}:\s*/i, "").replace(/^The\s+[A-Za-z ]+pattern is present[^:]*:\s*/i, "");
  }

  /* ================= templates bank =================
     Fill-in-the-blank paragraph cards for the written answer. Blanks are
     shown as ___ ; the UI offers an Insert button that appends the text into
     the Draft. group is used for headings; each card has id, title, text. */
  const TEMPLATES = [
    /* --- 5 SOLID principles, present + violated variants --- */
    { id: "srp-present", group: "SOLID — present", principle: "SRP",
      title: "SRP present",
      text: "Single Responsibility is present: ___ (e.g. NotifierClass, GeneratorClass) each have one clear responsibility, so a change to ___ touches only ___. Purpose: a class should have one reason to change; here concerns are split into focused, individually testable classes." },
    { id: "srp-violated", group: "SOLID — violated", principle: "SRP",
      title: "SRP violated",
      text: "Single Responsibility is violated in ___ (___:___): it mixes ___ (e.g. domain logic) with ___ (e.g. console output / file I/O), so it has more than one reason to change and cannot be tested in isolation. Fix: extract ___ behind an abstraction (e.g. ___ interface) and inject it." },
    { id: "ocp-present", group: "SOLID — present", principle: "OCP",
      title: "OCP present",
      text: "Open/Closed is present: the interface ___ has implementations ___ and ___, so a new variant is added as a new class without editing existing code. Purpose: software should be open for extension but closed for modification — new behaviour plugs into an existing abstraction." },
    { id: "ocp-violated", group: "SOLID — violated", principle: "OCP",
      title: "OCP violated",
      text: "Open/Closed is violated in ___ (___:___): it branches on concrete types with ___ (e.g. is/switch chain), so every new type forces an edit here. Fix: move the varying behaviour onto a virtual/abstract method or a strategy interface and dispatch polymorphically." },
    { id: "lsp-present", group: "SOLID — present", principle: "LSP",
      title: "LSP present",
      text: "Liskov Substitution is respected: every implementation of ___ (e.g. ___, ___) honours the full contract, so clients holding the abstraction work for any of them. Purpose: a subtype must be usable wherever its base type is expected, without the client knowing the concrete type." },
    { id: "lsp-violated", group: "SOLID — violated", principle: "LSP",
      title: "LSP violated",
      text: "Liskov Substitution is violated in ___ (___:___): it downcasts the abstraction ___ to the concrete ___ (with '___'), so it only works for that one implementation. Fix: lift the needed member onto the interface and call it through the abstraction; delete the cast." },
    { id: "isp-present", group: "SOLID — present", principle: "ISP",
      title: "ISP present",
      text: "Interface Segregation is present: ___, ___ and ___ are small role interfaces with one to three members each, so a class implements only the capabilities it really supports. Purpose: clients should not depend on members they do not use." },
    { id: "isp-violated", group: "SOLID — violated", principle: "ISP",
      title: "ISP violated",
      text: "Interface Segregation is violated by ___ (___:___): it bundles ___ members across several roles, forcing implementers to provide methods they cannot honour (often with NotImplementedException stubs). Fix: split it into small role interfaces, one capability each." },
    { id: "dip-present", group: "SOLID — present", principle: "DIP",
      title: "DIP present",
      text: "Dependency Inversion is present: ___ depends on the abstraction ___, injected through its constructor and chosen in ___ (the composition root / Program). Purpose: high-level policy should depend on abstractions, not concrete low-level classes, which also makes the class testable with a fake." },
    { id: "dip-violated", group: "SOLID — violated", principle: "DIP",
      title: "DIP violated",
      text: "Dependency Inversion is violated in ___ (___:___): it constructs its collaborator with 'new ___(...)' / downcasts an injected abstraction, binding the high-level class to a concrete type. Fix: depend on an interface, inject it, and let the composition root choose the implementation." },
    /* --- 4 OOP pillars --- */
    { id: "enc", group: "OOP pillars", principle: "ENC",
      title: "Encapsulation",
      text: "Encapsulation: ___ keeps its fields private and exposes state through properties (e.g. ___ { get; private set; }), so it controls its own invariants and external code cannot put it in an invalid state. A public mutable field would break this by allowing unchecked direct writes." },
    { id: "inheritance", group: "OOP pillars", principle: "POLY",
      title: "Inheritance",
      text: "Inheritance: ___ derives from ___ to reuse and specialise behaviour, modelling an 'is-a' relationship. It is used here for ___; where behaviour merely varies, interface implementation (composition) is preferred over deep inheritance." },
    { id: "polymorphism", group: "OOP pillars", principle: "POLY",
      title: "Polymorphism",
      text: "Polymorphism: clients call ___ on the abstraction ___ and the runtime dispatches to the concrete type (___, ___). This replaces manual type checks; the compile-time type of the reference no longer decides what runs, the runtime type does." },
    { id: "abstraction", group: "OOP pillars", principle: "ISP",
      title: "Abstraction",
      text: "Abstraction: the interfaces ___ (e.g. ___) expose only what callers need and hide the implementation behind them, so consumers depend on the role, not the concrete class. This is the foundation DIP and OCP build on in this codebase." },
    /* --- MVVM roles --- */
    { id: "mvvm", group: "Patterns", principle: "SRP",
      title: "MVVM roles",
      text: "MVVM separates three roles: the Model holds data and domain logic (___), the View is the XAML/UI (___) and contains no logic, and the ViewModel (___) exposes bindable properties and commands and mediates between them. The View binds to the ViewModel; with CommunityToolkit.Mvvm, [ObservableProperty] and [RelayCommand] generate the INotifyPropertyChanged plumbing and ICommand wiring." },
    /* --- pattern blurbs --- */
    { id: "strategy", group: "Patterns", principle: "OCP",
      title: "Strategy",
      text: "Strategy: the behaviour ___ is captured behind the interface ___, with interchangeable implementations ___ selected/injected at runtime. It supports Open/Closed — a new strategy is a new class — and keeps the consumer free of conditional logic." },
    { id: "di", group: "Patterns", principle: "DIP",
      title: "Dependency Injection",
      text: "Dependency Injection: ___ receives its collaborators (___) as constructor parameters typed as interfaces, rather than creating them. The concrete instances are wired up in ___ (Program/Main). This is DIP in practice and makes the class unit-testable with test doubles." },
    { id: "repository", group: "Patterns", principle: "DIP",
      title: "Repository",
      text: "Repository: ___ implements ___ and hides data access (___) behind that interface, so callers depend on the abstraction and the data source can be swapped or faked. It separates persistence from domain logic (SRP) and supports DIP." },
    { id: "facade", group: "Patterns", principle: "SRP",
      title: "Facade",
      text: "Facade: ___ provides a single simplified entry point over the more complex subsystem ___, so callers use one coherent API instead of orchestrating the parts themselves. It reduces coupling between the client and the subsystem's internals." },
    { id: "observer", group: "Patterns", principle: "OCP",
      title: "Observer",
      text: "Observer: ___ publishes an event / notification (___) that observers subscribe to, so the subject notifies interested parties without depending on their concrete types. New observers can be added without changing the subject — supporting Open/Closed." },
    { id: "marker", group: "Patterns", principle: "ISP",
      title: "Marker interface",
      text: "Marker interface: ___ declares no members and exists only to tag types so code can test 'is ___'. It can be a deliberate, minimal ISP role label, but if consumers only type-test it, a real capability method is usually better than the marker plus an 'is' check." },
  ];

  /* ================= export ================= */

  const CORE = { RULES, PRINCIPLES, TEMPLATES, MODES, scan, buildIndex, assembleAnswer, assembleJuneRubric, filterByMode, stripForScan, detectPresence };
  global.ANALYZER_CORE = CORE;
  if (typeof module !== "undefined" && module.exports) module.exports = CORE;
})(typeof window !== "undefined" ? window : globalThis);
