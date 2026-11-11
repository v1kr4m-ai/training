# Project status

The handover note between sessions and tools. Keep it short and current: replace old entries, do not append a diary.
Update it before every push.

## Last session

- Date: 2026-11-11
- Tool: Claude Code (Haiku 5.5)
- Branch: `chore/remove-standalone` (from `main`)
- Done: removed the standalone single-file HTML from `main` (source, build script, offline guide, generated HTML, npm script, Home and Training links); sample nominal roll now loads on first start only; docs updated.

## Check results (2026-11-11, on `main`)

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

- `chore/remove-standalone`: standalone single-file HTML removed from `main` (files, build script, guide, links); first-start-only sample roster; docs updated.
- `feat/standalone-training` (separate, not for `main`): the single-file training HTML, now starting empty (no sample data) and with Clear all.

## Next (in order)

1. LAN Sync packet validation (audit finding 3): check ship id and record shape before merging.
2. Housekeeping (audit finding 10): remove the stray files, pick one lockfile, drop unused dependencies, bring `README.md` up to date.
3. Training calendar improvements: week view, today highlight, instructor filter, mandatory-topic flag with compliance per department, recurring sessions, venue clash check.
4. Not built yet: Daily Manpower status and daily in/out, Maintenance Calendar.

## Decisions waiting for the owner

- New ships still start with the sample nominal roll (audit finding 6). Keep or start empty?

## Open question about tools

Not yet verified: whether Google AI Studio picks up commits pushed to GitHub from other tools, or only pushes
its own copy. Test with a one-line change before relying on it. If it only pushes, an AI Studio session started
after work in another tool can overwrite that work.
