# AGENTS.md

Instructions for every AI agent working on this repository (Claude Code, Google AI Studio, Antigravity, others).
Read this file and `docs/PROJECT_STATUS.md` before changing anything.

## What this project is

Ship Administration Portal for an Indian Navy ship (first ship: INS Tushil). Offline, single-PC, no backend.
React 19, Vite, Tailwind 4, TypeScript. All data lives in the browser's `localStorage`.
Modules: Home, Departments, Nominal Roll, Leave, Training, Daily Orders, Watch & Station Bill, Settings, LAN Sync.

Details: `docs/ARCHITECTURE.md`. Current state and next steps: `docs/PROJECT_STATUS.md`.

## How the owner works

The owner uses three tools **one at a time**, never together: Claude Code, Google AI Studio, Antigravity.
They are fallbacks for each other: when one runs out of usage, work continues in another.
So every session must leave the repository in a state the next tool can pick up cold.

## Session protocol (all tools)

Start of session:

1. Get the latest code from GitHub `main` (`git pull --ff-only`). AI Studio pushes straight to `main`.
2. Read `docs/PROJECT_STATUS.md`. Continue from "In progress" / "Next" unless the owner says otherwise.

End of session, or as soon as usage is running low:

1. Update `docs/PROJECT_STATUS.md`: what was done, what is half-done (with file names), what is next.
2. Run the checks listed below and record any failure in the status file.
3. Commit and push. Work that is not on GitHub does not exist for the next tool.

Do not wait until the last message to push. A session that dies mid-edit strands the work.

## Hard rules

1. **The GitHub repository is public.** Never commit real personnel data, real personal numbers, real duty
   rosters, passwords, or anything else sensitive. `public/data/*.json` must contain invented sample data only.
2. **No network calls at runtime.** The portal must work air-gapped. No CDN links, no remote fonts, no APIs.
   The only `fetch` calls allowed are for the app's own files under `public/`.
3. **Keep generated files out of git.** Build output (`dist/`) is ignored; do not commit it.
4. **Keep changes scoped.** Edit only the files the task needs. Do not regenerate or reformat whole files,
   and do not rename, move or delete files outside the task.
5. **Saved data must keep loading.** Users have data in `localStorage`. New fields on `Db`
   (`src/portal/types.ts`) and on training types (`src/types/index.ts`) must be optional or given a default in
   `parseDb` (`src/portal/db.ts`). Do not rename storage keys (`src/portal/registry.ts`).
6. **Read and write portal data through the store** (`usePortal()` in `src/portal/store.tsx`), not directly
   through `localStorage`. Existing direct reads of the training state are a known weakness, not a pattern to copy.
7. **Never force-push. Never rewrite `main` history.**

## Naval terms used in the UI (do not change back)

- "Nominal Roll", not personnel roll or person on roll.
- "Section", not sub-department (the code field is still `subDepartment`).
- "Personal Number", not service number (the code field is still `serviceNo`).
- Departments, sections, ranks and import column names are editable by the administrator; do not hard-code them.

## Commands

```
npm install
npm run dev                       # http://localhost:3000
npm run build
npm run lint                      # type check (tsc --noEmit)
```

Self-checks (no test framework; each prints "ok" or "FAIL ..."):

```
node --experimental-strip-types src/utils/topicImport.ts
node --experimental-strip-types src/utils/scheduler.check.ts
node --experimental-strip-types src/portal/leave.check.ts
node --experimental-strip-types src/portal/personnelImport.ts
node --experimental-strip-types src/portal/registry.check.ts
```

When logic in `scheduler.ts`, `leaveLogic.ts`, the importers or `registry.ts` changes, update its check in the
same change. For UI changes, open the page in a browser and use the feature before calling it done.

## Which model for which work

The aim is to spend the strongest model only where it changes the outcome.

Claude Code:

| Work | Model |
|---|---|
| Architecture, security review, design of a new module, review of a large change | Fable (while available), otherwise Opus |
| Hard multi-file work, bugs that cross modules | Opus |
| Routine features, forms, components, checks, documentation (most work) | Sonnet |
| File search, renames, mechanical edits | Haiku |

Antigravity: Opus for hard work and reviews, Sonnet for routine work, Gemini Pro when the Claude allowance
there is used up, Gemini Flash for browser testing and mechanical edits.

Google AI Studio: Gemini only. Give it bounded tasks that name the files to touch.

Ways to save usage in any tool:

- Do not re-analyse the whole repository. Read `docs/ARCHITECTURE.md` first and open only the files the task needs.
- Plan with a strong model, write the plan into `docs/`, then implement with a cheaper one.
- Start a fresh conversation for an unrelated task.

## Branches

- AI Studio commits directly to `main`.
- Claude Code and Antigravity: small changes may go to `main`; anything larger goes on a task branch
  (`feat/...`, `fix/...`, `docs/...`), merged into `main` and pushed before the session ends so the next
  tool sees it. Do not leave unmerged branches as the only copy of finished work.
