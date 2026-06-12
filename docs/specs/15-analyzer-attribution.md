# Spec 15: Analyzer attribution correctness + context-aware fix text

Read docs/specs/00-master-plan.md first. Ownership: data/analyzer-core.js,
data/analyzer.js, tests/analyzer-core.test.js, tests/analyzer-ui.test.js.
Motivated by real defects Max found testing the analyzer on a payment-gateway
example (the exact code is embedded in the Tests section below; use it as a
calibration fixture). Graders WILL punish miscategorized principles, so this
spec outranks cosmetics.

## Defects observed (2026-06-12, all must be fixed)
1. Downcast of an injected abstraction (`_gateway as StripeGateway`) was filed
   under LSP. Correct primary principle is DIP (depending on a concretion);
   the rule's principle tag, theory text, and answer paragraph must lead with
   DIP. LSP may remain a secondary mention ONLY with an explanation of when it
   applies (the cast punishes other implementations), not as the headline.
2. Contradiction between presence and violations: the same class got
   "DIP present: depends on abstractions via constructor injection" AND a
   downcast violation. Presence findings must reconcile: when a class with
   ctor-injected abstractions ALSO has a DIP-violating finding (downcast,
   new-of-concrete, single-is on the injected field), the presence paragraph
   must carry a caveat ("DIP is followed at the constructor but broken inside
   <member>, see violation N") instead of asserting it is clean. Implement as
   a post-scan reconciliation pass over findings grouped per class.
3. Generic fix text that does not match the code: the LSP throw-stub fix said
   "split the fat interface into smaller role interfaces" for a SINGLE-method
   interface. Fix text must be context-selected: if the implemented interface
   has 1-2 members, recommend implementing the contract honestly or not
   claiming the interface; only recommend splitting when the interface
   actually has 3+ members (the engine knows interface member counts from its
   cross-file index; thread that into the fix-template choice).
4. Fix text referenced "delete the cast and its null-check branch" when no
   null-check branch exists. Detect whether the cast result is null-guarded
   (if (x != null), x?., is-pattern with braces) and emit the matching
   wording; never mention constructs that are not in the code.
5. Missing runtime-consequence note: an unguarded `as` cast whose result is
   dereferenced is a latent NullReferenceException; add that as part of the
   downcast finding's consequence sentence (it strengthens the written
   answer) when no null guard is detected.

## Tests (use this fixture verbatim as a new calibration test)
A single file PaymentDemo.cs containing: IPaymentGateway (one method
Charge), StripeGateway ok, CashGateway throwing NotImplementedException,
InvoiceService with public decimal Amount and public string CustomerEmail
fields, ctor-injected IPaymentGateway stored in a field, and Pay() doing
`var stripe = _gateway as StripeGateway; stripe.Charge(Amount);`.
Assert:
- downcast finding's primary principle is DIP (not LSP).
- downcast finding mentions NullReferenceException (no null guard present).
- DIP presence finding for InvoiceService contains a caveat referencing the
  violation (and in a control fixture without the cast, no caveat).
- throw-stub fix for CashGateway does NOT contain "split" / fat-interface
  advice (1-member interface); a second fixture with a 4-member interface
  DOES get the split advice.
- ENC findings on both public fields unchanged (regression guard).
- assembleAnswer in full mode places the downcast under the DIP section and
  the qualified presence sentence in the same section without contradiction.

## Definition of done
Own tests green incl. the new calibration fixtures; full suite green; the
2025 exam fixtures still produce their known findings (no regressions; the
ReExam `as InMemoryRecipeRepository` downcast must now read as DIP-primary,
which matches how the official solution discusses it).

## Return (final message, raw JSON)
{"done": bool, "defects_fixed": [1,2,3,4,5], "tests": "X passed",
 "manual_checks": [..], "skipped": [..], "notes": ".."}
