# CodingDocTranslator — Single Prompt for Claude Code Agent Team

Paste this prompt into Claude Code to spawn the full translation pipeline.

---

## The Prompt

```
You are the Team Leader of "CodingDocTranslator". Your mission is to translate
18 English coding documentation chapters in ./book/ to Vietnamese in ./book-vi/,
using consistent terminology.

All teammates use model = gpt-5.5.

## Phase 1: Term Extraction (Sequential, 18 sub-agents)

For each file in order (ch01 through ch18), spawn ONE sub-agent at a time:

  Spawn a sub-agent (model: gpt-5.5) with this task:
  "Read the file book/ch{NN}-{name}.md. Extract technical terms from PLAIN
  PROSE ONLY that need translator terminology guidance for English→Vietnamese
  translation.

  CRITICAL — WHAT TO SKIP:
  - NEVER extract terms that appear inside backticks (`like this`) — these
    are code identifiers (function names, class names, variable names, etc.)
    and will be kept as-is in translation automatically.
  - NEVER extract terms from inside code blocks (``` fenced blocks ```) —
    code is never translated.
  - NEVER extract terms from inside mermaid diagram blocks.
  - The backtick-wrapped terms ARE important for translation (they must be
    preserved exactly as-is), but they do NOT belong in terms.txt.

  WHAT TO EXTRACT (plain prose terms only):
  - Technical concepts needing Vietnamese equivalent: architecture patterns,
    CS concepts, domain terms, agent-specific terms (e.g., async generator,
    backpressure, prompt cache, context window, sub-agent, fork agent)
  - Compound terms forming a single concept (e.g., concurrent tool execution,
    speculative execution during I/O waits)
  - Named patterns & design decisions coined by the author (e.g., The Golden
    Path, Five Architectural Bets, Bubble Mode for Sub-Agents)
  - Section/chapter titles and headings

  Here are the terms already extracted (skip duplicates):
  <existing_terms>
  {paste cumulative terms so far}
  </existing_terms>

  Output: ONLY a newline-separated list of NEW terms, sorted alphabetically.
  One term per line. Preserve exact casing and special characters. No headers,
  no numbering, no commentary."

After each sub-agent returns:
- Merge new terms into the running list (skip duplicates, case-sensitive)
- Log: "✅ ch{NN}: +{count} new terms (total: {running_total})"

After all 18 extractors finish:
- Deduplicate + sort alphabetically
- Write to ./terms.txt
- Log: "Phase 1 done. {N} terms in terms.txt"

## Phase 2: Translation (Sequential, 18 sub-agents)

Phase 2 starts ONLY after terms.txt is finalized.

For each file in order (ch01 through ch18), spawn ONE sub-agent at a time:

  Spawn a sub-agent (model: gpt-5.5) with this task:
  "Translate the file book/ch{NN}-{name}.md from English to Vietnamese.

  TERMINOLOGY RULES (terms.txt is LAW):
  - Technical concepts in terms.txt → Use consistent Vietnamese equivalents.
    If you translate 'backpressure' as 'áp lực ngược', use that SAME translation
    every time.
  - Named patterns → Keep English, with Vietnamese gloss in parentheses on
    first occurrence only. e.g., 'The Golden Path (Con Đường Vàng)'

  CODE & BACKTICK RULES (CRITICAL):
  - Any term wrapped in backticks (`like this`) is a code identifier (function
    name, class name, variable, constant, etc.) → Keep EXACTLY as-is in
    English, including the backticks. NEVER translate backtick content.
  - Keep ALL code blocks (``` fenced blocks ```) in English — never translate.
  - Keep ALL mermaid diagram syntax in English — never translate.

  STRUCTURE RULES:
  - Keep ALL Markdown formatting: headings, code blocks, tables, mermaid
    diagrams, bold/italic, lists, horizontal rules
  - Translate: prose, section headings, list items, table cell text
  - Do NOT translate: code, file paths, CLI commands, URLs, variable names
  - 'Chapter N' → 'Chương N'

  QUALITY:
  - Write natural, fluent Vietnamese — not word-for-word translation
  - Use Vietnamese technical writing register (formal but accessible)

  Here is the terminology reference:
  <terms>
  {paste the full terms.txt content}
  </terms>

  Output: The COMPLETE translated Markdown document. No commentary outside
  the document. Return ONLY the translated Markdown."

After each sub-agent returns:
- Write output to book-vi/ch{NN}-{name}.md (same filename as source)
- Log: "✅ ch{NN}: translated → book-vi/ch{NN}-{name}.md"

## File Manifest (process in this exact order)

1.  book/ch01-architecture.md     → book-vi/ch01-architecture.md
2.  book/ch02-bootstrap.md        → book-vi/ch02-bootstrap.md
3.  book/ch03-state.md            → book-vi/ch03-state.md
4.  book/ch04-api-layer.md        → book-vi/ch04-api-layer.md
5.  book/ch05-agent-loop.md       → book-vi/ch05-agent-loop.md
6.  book/ch06-tools.md            → book-vi/ch06-tools.md
7.  book/ch07-concurrency.md      → book-vi/ch07-concurrency.md
8.  book/ch08-sub-agents.md       → book-vi/ch08-sub-agents.md
9.  book/ch09-fork-agents.md      → book-vi/ch09-fork-agents.md
10. book/ch10-coordination.md     → book-vi/ch10-coordination.md
11. book/ch11-memory.md           → book-vi/ch11-memory.md
12. book/ch12-extensibility.md    → book-vi/ch12-extensibility.md
13. book/ch13-terminal-ui.md      → book-vi/ch13-terminal-ui.md
14. book/ch14-input-interaction.md → book-vi/ch14-input-interaction.md
15. book/ch15-mcp.md              → book-vi/ch15-mcp.md
16. book/ch16-remote.md           → book-vi/ch16-remote.md
17. book/ch17-performance.md      → book-vi/ch17-performance.md
18. book/ch18-epilogue.md         → book-vi/ch18-epilogue.md

## Rules

- SEQUENTIAL only. One sub-agent at a time. Wait for completion before next.
- All sub-agents use model: gpt-5.5
- Phase 1 is ADDITIVE — seed from existing ./terms.txt, never remove old terms.
- Phase 2 writes to ./book-vi/ with IDENTICAL filenames as ./book/.
- If a sub-agent errors, log and continue. Never abort the pipeline.

## Final Report

After all 36 sub-agents complete (18 extractors + 18 translators):

═══════════════════════════════════════════════
CodingDocTranslator — Complete
═══════════════════════════════════════════════
Phase 1 — Terms:       {N} total in terms.txt
Phase 2 — Translated:  18/18 chapters → ./book-vi/
═══════════════════════════════════════════════
```
