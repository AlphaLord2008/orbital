# WA-5: Firefox content-process crash under axe (PR #10)

**Symptom.** In CI, Firefox E2E failed at `journeys.spec.ts` (axe on Analyze) with `Page crashed`, on 0e74d71 and 05e12ec. Chromium and WebKit passed.

**Method.** Local Firefox is unavailable (the browser download is blocked), so the crash was bisected in Firefox CI on the throwaway branch `diag/wa5-firefox-axe`. That branch is not merged; its commits and runs hold the raw logs (runs 46102308192 … 46105141652). Each attempt ran in a fresh page.

| Round | Question | Result |
|---|---|---|
| 2 | Signature | The content process **exited on signal 11** (native crash), not a JS error. The same flow passed once and an Explore control crashed, so the page is not the cause. |
| 3 | Method | AxeBuilder, legacy mode and plain `axe.run` all crash on the app page (18/24). The static methodology page never crashed (0/8), and the app without axe never crashed (0/8). |
| 4–5 | Timing, URL writes, tracing | Delay (0–3 s), `history.replaceState` and `--trace=off` do not change it. |
| 6 | Pre-existing? | **main's build (5009b37, before WA-5) crashes at the same rate.** Excluding the Explore scenario card (`.hud-left`) gave 0 crashes in both builds. |
| 7–9 | Where in the card | Excluding any one child does not help. Only rules that compute roles and names crash (aria-allowed-attr, aria-conditional-attr, aria-prohibited-attr, label-content-name-mismatch, landmark-unique, nested-interactive). On the card, they crash only for the `<section>` itself. |
| 10 | Which property | Section with `aria-labelledby`: **3/3 crash**. With it removed, or replaced by `aria-label` with the same text: **3/3 pass**. `display` changes: still crash. |

**Fix.** App regions take their accessible name from `aria-label` holding the visible heading's exact text, instead of `aria-labelledby`. The dialogs and the phone tab panel use the same naming. Accessible names are unchanged, and the accessibility scan and its coverage are unchanged.

**Limits.**
- The direct evidence is for the Explore card `<section>`.
- The Analyze panels, dialogs and tab panel use the same pattern and received the same change. Whether each one alone crashed was not measured.
- The underlying defect is in Firefox (Playwright build 1.65.1); this is a workaround.
- The methodology page keeps `aria-labelledby`: in round 3 it never crashed (0/8).
