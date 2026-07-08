# InstaDocs — Demo Video Storyboard (≈4:00)

> UiPath · Hackweek 2026. Modeled on the WebPilot demo house style.
> Each act has a matching animated B-roll slide in `demo/brolls/` (open in Chrome/Edge,
> screen-record full-screen). **VO** = voice-over. **A-roll** = screen capture of the real
> InstaDocs VS Code extension. **B-roll** = the animated HTML slide.

Palette: bg `#050A14`, UiPath orange `#FA4616`, cyan `#06B6D4`, green `#10B981`, amber `#F59E0B`.
Fonts: Outfit (UI), Poppins (hero lines), Fira Code (code/labels). White UiPath wordmark in
every header/footer. Eyebrow: `UIPATH · INSTADOCS`. Footer tagline: `Automation → Documentation`.

---

## Act 0 — Cold open + problem (0:00–0:30)  ·  `brolls/01_act0_cold-open_instadocs.html`

**VO:**
"Every automation ships with a promise it rarely keeps: documentation. A Solution Design
Document — written by hand. Process diagrams — redrawn for every release. Test cases — typed
out, one by one. Then the deadline hits… and the document drifts out of sync with the very
automation it's supposed to describe. What if the documentation just… wrote itself — straight
from the code?"

**A-roll:** None — full B-roll.

**B-roll:** Card-stack montage: three slate cards fade up — "Solution Design Document — by hand"
(cyan pill), "Diagrams redrawn every release" (amber), "Test cases, one by one" (amber) — each
with a slow-pulsing orange clock glyph and a cost chip (≈ hrs / ×N releases). Cut to a split
"doc-drift" motif: a Fira-Code **XAML** panel on the left whose activities re-highlight as the
code "changes," a Word **SDD** page on the right where a cursor copies steps by hand; a counter
climbs "sections written 1…12," an elapsed clock ticks toward hours, and a red **OUT OF SYNC**
stamp slams on when the code moves. Hard cut to black — eyebrow `UIPATH · INSTADOCS`, then in
Poppins: **"Point at the code."** with a blinking orange caret.

---

## Act 1 — Meet the tool: Connect (0:30–1:00)  ·  `brolls/02_act1_connect_instadocs.html`

**VO:**
"This is InstaDocs. It lives inside the UiPath ecosystem — so setup is one screen. Validate your
UiPath settings: analysis runs on UiPath's own LLM Gateway, with a built-in heuristic fallback
so a diagram never stalls. Signed in. Gateway green. Project open. That's the whole setup."

**A-roll:** The InstaDocs welcome page — the readiness checklist (Signed in / LLM Gateway /
Project open) turning green; the resolved gateway endpoint + model chip.

**B-roll:** A slate card where three emerald readiness pills snap in — "Signed in ✓",
"UiPath LLM Gateway ✓", "Project open ✓". A cyan connective line animates a travelling pulse
from a **UiPath** node to an **InstaDocs** document node. A mono endpoint chip reads the gateway
URL · `Sonnet 4.5`.

---

## Act 2 — Compose: point it at a project (1:00–1:30)  ·  `brolls/03_act2_compose_instadocs.html`

**VO:**
"Now the project. Drop in a local folder — or paste a Git URL. Pick where the documents should
land. No template to fill. No sections to scaffold. No diagram to draw. One screen — then
generate."

**A-roll:** The Generate panel — the Source toggle (Local folder / Git repository), a Git URL
typed live, the output folder chosen.

**B-roll:** Numbered orange step-chips slide in one per line — "1 · Source — folder or Git URL",
"2 · Gateway — Sonnet 4.5", "3 · Output — pick a folder" — a Git URL types in with a caret,
ending on a blinking orange caret and a "Generate" affordance.

---

## Act 3 — Run: diagrams from the code (HERO, 1:30–2:35)  ·  `brolls/04_act3_run_instadocs.html`

**VO:**
"Hit generate. InstaDocs opens the project and reads it — no config, no guesswork. It detects the
platform, parses every workflow into one model, and calls the LLM Gateway to write the narrative.
But here's the part that matters. The diagrams aren't templates. InstaDocs reads the actual XAML
— the real state machine, its states, its transitions, the exact guard conditions — and draws the
process design from the code itself. Initialization, Get Transaction, Process, End. Real steps.
Real branches. And if AI planning needs support, a deterministic extractor steps in. Nothing
stalls — and every diagram traces back to the source."

**A-roll:** The Generate panel progress log streaming ("Opening repository… Detecting platform…
Parsing workflow logic… Analyzing solution design… Writing documents…"), then the code-derived
REFramework state-machine diagram rendering in the doc.

**B-roll (two cut-ins):**
1. Pipeline loop — `REPO → DETECT → PARSE → ANALYZE (LLM Gateway) → EXPORT` as rounded nodes on
   an orange cycle, one glowing per beat, with a small cyan "heuristic fallback" node hanging off
   ANALYZE.
2. A "from code" card — a Fira-Code `<StateMachine> <State DisplayName="Process Transaction">`
   snippet, an orange arrow, and a mini 4-lane state-chart glyph, capped with a green
   **from code** pill; an atom-ring spinner in the corner while it works.

---

## Act 4 — Every platform, auto-detected (2:35–3:00)  ·  `brolls/05_act4_platforms_instadocs.html`

**VO:**
"And it isn't just UiPath. Point InstaDocs at Power Automate, Blue Prism, or Automation Anywhere
— it recognizes the platform by signature, picks the right parser, and produces the same
structured document set. One tool, every automation. And it knows RPA from agentic — a Solution
Design Document for a workflow, an Agentic Design Document for an AI agent — automatically."

**A-roll:** The detect stage picking the platform with a confidence percentage.

**B-roll:** Four platform badges — UiPath, Power Automate, Blue Prism, Automation Anywhere — with
detection segments filling; a green "detected ✓" pill snaps onto the matched one; a small
SDD ⟋ ADD fork resolves underneath.

---

## Act 5 — Export: native UiPath docs (3:00–3:35)  ·  `brolls/06_act5_export_instadocs.html`

**VO:**
"When it finishes, you don't get a draft — you get the deliverables. A branded Solution Design
Document in Word, with the architecture and the code-derived diagrams embedded. A Test Case
workbook in Excel. Everything filled from the real source — and the fields only a human can
answer, left honestly marked 'To be provided by SME.' Never invented. Open it in Word and
continue from a finished foundation."

**A-roll:** The result card with saved paths; opening the `.docx` to show embedded diagrams +
tables.

**B-roll:** Three export cards fan out like dealt cards — **SDD .DOCX** (orange), **TEST CASES
.XLSX** (green), **ADD .DOCX** (cyan) — then a Word glyph card slides in beneath; a small
"To be provided by SME" tag flags a human-only field.

---

## Act 6 — Benefits + close (3:35–4:00)  ·  `brolls/07_act6_close_instadocs.html`

**VO:**
"Hours of hand-writing — down to minutes. Documentation that stays true to the automation,
because it's generated from it. Branded Word and Excel, diagrams and all — every platform,
inside the UiPath ecosystem. Stop writing documentation by hand. Point at the code. InstaDocs."

**A-roll:** None — full B-roll close.

**B-roll:** Three stat cards fade up — "HOURS → MINUTES" (orange), "CODE IN, DOCS OUT" (cyan),
"EVERY PLATFORM, ONE TOOL" (green) — then the title lockup: eyebrow `UIPATH · HACKWEEK 2026`,
"InstaDocs" with an orange atom-ring spinning behind it. Hold 3s, fade.

---

### Capture notes
- Record each B-roll full-screen at 1920×1080; the timelines are tuned to the badge time code.
- Refresh the page to restart an act's animation from the top.
- A-roll screens: `packages/vscode-ext/src/welcome.ts` (welcome), `panel.ts` (generate),
  real generated docs in `Desktop/CodeReviewFixes` (e.g. `ACMECodingAgentTest-SDD.docx`,
  `APIAutomation-SDD.docx`) for the embedded code-derived diagrams.
