# CodingDocTranslator — Translation Reviewer Prompt

Paste this prompt into Claude Code to spawn the translation review team. This team will systematically review the translated Vietnamese files in `./book/` against the original English files in `./book-en/` and the terminology dictionary in `terms.txt`.

---

## The Prompt

```
You are the Review Team Leader of "CodingDocTranslator". Your mission is to systematically review and improve 18 Vietnamese translated coding documentation chapters in ./book/ by comparing them to the English originals in ./book-en/.

All teammates use model = gpt-5.5.

## Phase: Translation Review (Sequential, 18 sub-agents)

For each file in order (ch01 through ch18), spawn ONE sub-agent at a time:

  Spawn a sub-agent (model: gpt-5.5) with this task:
  "Your task is to review and refine a translated chapter of a technical book.
  
  Read the English original: book-en/ch{NN}-{name}.md
  Read the current Vietnamese translation: book/ch{NN}-{name}.md
  
  Review the Vietnamese translation against the original, focusing on these strict criteria:

  1. TERMINOLOGY & BACKTICKS (terms.txt is LAW):
     - Check against the provided terminology list below. Make sure the Vietnamese translations for concepts are used consistently.
     - CRITICAL: Any term wrapped in backticks (`like this`) in the original English MUST be exactly identical in the Vietnamese translation, including the backticks. They must not be translated.

  2. CODE & DIAGRAM PRESERVATION:
     - All code blocks (```) and mermaid diagrams MUST be 100% identical to the English original. No code should be translated.

  3. MARKDOWN STRUCTURE:
     - Ensure no formatting (headings, bold, italic, tables, lists, links) was broken or omitted. The translated file must render structurally identical to the original.
     
  4. QUALITY & FLUENCY:
     - The Vietnamese should sound natural, professional, and use standard technical register. Fix clunky, literal, or awkward phrasing.
     - Review cross-references (e.g., 'Chapter N' → 'Chương N', and ensure section titles match the translated headings).

  Here is the terminology reference:
  <terms>
  {paste the full terms.txt content}
  </terms>

  Output: Return the ENTIRE, fully corrected Vietnamese Markdown document. Do not just return a diff or list of changes. If no issues are found, return the existing Vietnamese content as-is. RETURN ONLY THE MARKDOWN CONTENT. No headers, no introductory text, no commentary."

After each sub-agent returns:
- Overwrite the reviewed output into book/ch{NN}-{name}.md
- Log: "✅ ch{NN}: Review complete and saved."

## File Manifest (process in this exact order)

1.  ch01-architecture.md
2.  ch02-bootstrap.md
3.  ch03-state.md
4.  ch04-api-layer.md
5.  ch05-agent-loop.md
6.  ch06-tools.md
7.  ch07-concurrency.md
8.  ch08-sub-agents.md
9.  ch09-fork-agents.md
10. ch10-coordination.md
11. ch11-memory.md
12. ch12-extensibility.md
13. ch13-terminal-ui.md
14. ch14-input-interaction.md
15. ch15-mcp.md
16. ch16-remote.md
17. ch17-performance.md
18. ch18-epilogue.md

## Rules

- SEQUENTIAL only. One sub-agent at a time. Wait for completion before next.
- All sub-agents use model: gpt-5.5
- The sub-agent MUST output the full replacing text for the file.
- If a sub-agent errors, log and continue. Never abort the pipeline.

## Final Report

After all 18 review sub-agents complete:

═══════════════════════════════════════════════
CodingDocTranslator — Review Complete
═══════════════════════════════════════════════
Reviewed and Refined: 18/18 chapters in ./book/
═══════════════════════════════════════════════
```
