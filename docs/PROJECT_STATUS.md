# Project status

The handover note between sessions and tools. Keep it short and current: replace old entries, do not append a diary.
Update it before every push.

## Last session

- Date: 2026-11-11
- Tool: Claude Code (Haiku 5.5)
- Branch: `main`
- Done: pulled AI Studio commit `93e117d`; deleted merged branches `fix/failing-checks` (GitHub and local) and `docs/agent-setup` (local). Local `main`, `origin/main` and GitHub are all at `93e117d`. No application code changed.

## Check results (2026-11-10, at `0b548d7` on `main`)

| Check | Result |
|---|---|
| `npm run lint` | pass |
| `topicImport.ts` | pass |
| `personnelImport.ts` | pass |
| `registry.check.ts` | pass |
| `leave.check.ts` | pass |
| `scheduler.check.ts` | pass |

## Built

- Home, Departments (editable), Nominal Roll (import with column mapping), Settings.
- Leave: balances, apply, approval chain (Sailor: DO -> HOD -> EXO -> Gunnery notice; Officer: HOD -> CO),
  notifications, department forecast.
- Training: scheduler, matrix, calendar, conflicts and admin override, reschedule, status flags, attendance
  muster and make-up sessions, quarterly analytics, exports (Excel / PDF / PNG / CSV / .ics), monthly bulletin.
- Daily Orders (publish, notice board), Watch & Station Bill with special parties and duty roster.
- LAN Sync packets, PWA install, single-file offline training HTML.

## In progress

- `feat/training-topics` (from `main`): training data accessor (`fix/training-data-safety`), Topics tab (add, edit, delete, clear all). Sample curriculum loads on first start only, so Clear all stays cleared after a reload.
- `feat/standalone-training` (separate, not for `main`): single-file training HTML. Stays on its own branch by owner decision.

## Next (in order)

1. Owner: decide about AI Studio's standalone files already on `main` (`src/standalone-training.tsx`, `scripts/build-offline-training.mjs`, `OfflineGuide.md`, the `build:offline-training` script, the root and `public/` HTML). Owner wants standalone off `main`.
2. LAN Sync packet validation (audit finding 3): check ship id and record shape before merging.
3. Same first-start-only fix for the Nominal Roll sample: `store.tsx` reloads `nominal_roll.json` whenever the roster is empty, so clearing people brings the sample back.
4. Housekeeping (audit finding 11): remove the stray files, pick one lockfile, drop unused dependencies, bring `README.md` up to date.
5. Training calendar improvements: week view, today highlight, instructor filter, mandatory-topic flag with compliance per department, recurring sessions, venue clash check.
6. Not built yet: Daily Manpower status and daily in/out, Maintenance Calendar.

## Decisions waiting for the owner

- Which copy of `tushil-training-offline.html` to keep in git (suggested: `public/` only).
- Whether a new ship should start with an empty Nominal Roll (audit finding 6).
- Confirm `public/data/nominal_roll.json` is invented sample data (the repository is public).

## Open question about tools

Not yet verified: whether Google AI Studio picks up commits pushed to GitHub from other tools, or only pushes
its own copy. Test with a one-line change before relying on it. If it only pushes, an AI Studio session started
after work in another tool can overwrite that work.
