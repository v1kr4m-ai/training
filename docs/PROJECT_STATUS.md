# Project status

The handover note between sessions and tools. Keep it short and current: replace old entries, do not append a diary.
Update it before every push.

## Last session

- Date: 2026-11-10
- Tool: Claude Code
- Branch: `docs/agent-setup`
- Done: pulled AI Studio commit `f16f058` into the local copy; read the whole codebase; wrote `AGENTS.md`,
  `CLAUDE.md`, `docs/ARCHITECTURE.md` (with audit findings) and this file. No application code changed.

## Check results (2026-11-10, at `f16f058`)

| Check | Result |
|---|---|
| `npm run lint` | pass |
| `topicImport.ts` | pass |
| `personnelImport.ts` | pass |
| `registry.check.ts` | pass |
| `leave.check.ts` | pass (fixed on `fix/failing-checks`) |
| `scheduler.check.ts` | pass (fixed on `fix/failing-checks`) |

## Built

- Home, Departments (editable), Nominal Roll (import with column mapping), Settings.
- Leave: balances, apply, approval chain (Sailor: DO -> HOD -> EXO -> Gunnery notice; Officer: HOD -> CO),
  notifications, department forecast.
- Training: scheduler, matrix, calendar, conflicts and admin override, reschedule, status flags, attendance
  muster and make-up sessions, quarterly analytics, exports (Excel / PDF / PNG / CSV / .ics), monthly bulletin.
- Daily Orders (publish, notice board), Watch & Station Bill with special parties and duty roster.
- LAN Sync packets, PWA install, single-file offline training HTML.

## In progress

Nothing half-done in code.

## Next (in order)

1. Merge `fix/failing-checks` after review. Changes: leave approval is now strict (only the stage's approver decides; Administrator keeps its override); two stale check expectations updated.
2. Audit finding 2: take approval rights from the user's role only, not from designation text.
3. Audit findings 3 and 4: validate LAN Sync packets (ship id, record shape) and stop writing training
   sessions around the Training page's state.
4. Housekeeping (audit finding 11): remove the stray files, pick one lockfile, drop unused dependencies,
   bring `README.md` up to date.
5. Training calendar improvements the owner asked about: week view, today highlight, instructor filter,
   mandatory-topic flag with compliance per department, recurring sessions, venue clash check.
6. Not built yet: Daily Manpower status and daily in/out, Maintenance Calendar.

## Decisions waiting for the owner

- Which copy of `tushil-training-offline.html` to keep in git (suggested: `public/` only).
- Whether a new ship should start with an empty Nominal Roll (audit finding 6).
- Whether the standalone training HTML should require a login (audit finding 5).
- Confirm `public/data/nominal_roll.json` is invented sample data (the repository is public).

## Open question about tools

Not yet verified: whether Google AI Studio picks up commits pushed to GitHub from other tools, or only pushes
its own copy. Test with a one-line change before relying on it. If it only pushes, an AI Studio session started
after work in another tool can overwrite that work.
