# Results: Mini Checkout

**Date:** 2026-11-25 · **Environment:** Windows 11, Node 24.13.1, @playwright/test 1.65.1, Chromium

## Summary

| Area | Result |
|---|---|
| Automated browser tests | **9 / 9 passed** (3 required checks + 5 edge-case regressions + 1 phone-width check) |
| Manual: empty cart (MT-01) | **Pass**: order blocked, clear message, name kept |
| Manual: rapid double-click (MT-02) | **Pass**: exactly one order and one confirmation |
| Defects found | **2, both fixed and retested:** D-01 (Low, cosmetic), D-02 (High, order total hidden on phones) |
| Tests proven able to fail | Yes. Guard removed → `Expected: 1, Received: 2`. D-01 fix removed → `Expected: "", Received: "349.50"`. D-02 rule restored → `Expected visible, Received hidden` |

## Automated run

```
Running 9 tests using 6 workers
  ok  checkout.spec.js   › 1. successful checkout shows one confirmation with a reference
  ok  checkout.spec.js   › 2. blank name blocks checkout, explains why and keeps the cart
  ok  checkout.spec.js   › 3. changing quantity updates line totals and the exact order total
  ok  edge-cases.spec.js › empty cart blocks checkout and keeps the typed name
  ok  edge-cases.spec.js › empty cart and blank name together show both messages
  ok  edge-cases.spec.js › rapid double-click on Place order creates exactly one order
  ok  edge-cases.spec.js › two submits fired in the same instant still create one order
  ok  edge-cases.spec.js › starting a new order returns to a clean, usable checkout
  ok  mobile.spec.js     › phone width: order total visible, correct, no sideways scrolling
  9 passed
```

## Defects

| ID | Severity | Summary | Status |
|---|---|---|---|
| D-01 | Low | A fast double-click on **Place order** created one order (correct), but the second press highlighted a word on the confirmation | Fixed + regression test |
| D-02 | High | At phone width (375 px) the **order total amount was hidden**, and the cart overflowed the screen by 6 px. Cause: a CSS rule hiding the price column also hit the total cell in the footer | Fixed + regression test |

Full write-ups (steps, expected vs. actual, cause, fix) are in [TEST_PLAN.md §5](TEST_PLAN.md#5-defects).

## Evidence

| File | What it shows |
|---|---|
| `evidence/test-run-output.txt` | Full console output of the final test run |
| `results-html-report/index.html` | Playwright HTML report (open in a browser) |
| `evidence/manual-MT01-empty-cart.jpg` | Manual empty-cart test: blocked with message, name kept |
| `evidence/manual-MT02-double-click-before-fix.jpg` | D-01 before the fix: one confirmation, stray highlighted text |
| `evidence/manual-MT02-double-click-after-fix.jpg` | D-01 after the fix: one confirmation, no highlight |
| `evidence/D-02-phone-width-before-fix.png` | D-02 before the fix: "Order total" with no amount |
| `evidence/phone-width-order-total.png` | D-02 after the fix: total ₹1,548.50 visible, everything fits |
| `evidence/empty-cart-blocked.png` | Screenshot taken by the automated empty-cart test |
| `evidence/double-click-one-confirmation.png` | Screenshot taken by the automated double-click test |

## Not covered

Firefox and Safari were not tested (Chromium only, at desktop and 375 px phone size).
