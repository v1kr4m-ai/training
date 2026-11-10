# Architecture

Written from a full read of the code at commit `f16f058` (2026-11-10). Update this file when the structure
changes; do not let it describe code that no longer exists.

## Shape

A single-page React app with no backend. Everything a user enters is kept in the browser's `localStorage`
on that PC. Other PCs are reached only by carrying a JSON file across (backup/restore, LAN Sync packet).

- Stack: React 19, Vite 8, Tailwind 4, TypeScript, `xlsx` (import/export), `recharts` (charts),
  `lucide-react` (icons), `vite-plugin-pwa` (installable, offline cache).
- Entry: `index.html` -> `src/main.tsx` -> `src/App.tsx` -> `src/portal/PortalApp.tsx`.
- Second entry: `src/standalone-training.tsx`, bundled into the single-file `tushil-training-offline.html`.

## Provider tree and routing

```
ShipsProvider            src/portal/ships.tsx      list of ships, active ship
  PortalProvider         src/portal/store.tsx      one ship's database + signed-in user (key = ship id)
    Shell                src/portal/PortalApp.tsx  navigation, hash routing, page switch
```

Routing is by URL hash, handled in `PortalApp.tsx` (`#/home`, `#/departments/<name>`, `#/personnel`, `#/leave`,
`#/training`, `#/settings`, plus `#/daily-orders` and `#/watchbill`, which are reached from Home, not the nav bar).
There is no router library.

## Storage

All keys are defined in `src/portal/registry.ts` unless noted.

| Key | Holds | Written by |
|---|---|---|
| `TUSHIL_PORTAL_SHIPS_V1` | Ship list and active ship | `ships.tsx` |
| `TUSHIL_PORTAL_DB_V1:<shipId>` | Portal database (`Db`) for one ship | `store.tsx` (on every change) |
| `TUSHIL_TRAINING_STATE_V1:<shipId>` | Training state: topics, sessions, blackout dates, settings, year | `TrainingModule.tsx` |
| `TUSHIL_PORTAL_SESSION:<shipId>` (sessionStorage) | Signed-in user id | `store.tsx` |
| `tushil_lan_sync_state_<shipId>` | Count of changes since last sync export | `store.tsx` |
| `nav_position`, `pin_nav_bar`, `show_gunnery_on_home`, `custom_headers` | UI preferences, shared by all ships | `store.tsx` |

There are **two separate stores**: the portal `Db` (React state in `PortalProvider`, saved as one JSON blob)
and the training state (React state inside `TrainingModule`, saved under its own key). Other parts of the app
read the training key directly: `HomePage.tsx`, `DailyOrdersPage.tsx`, `DailyOrdersPublisher.tsx`,
`departmentOps.ts` (also writes), `LanSyncManager.tsx` (also writes).

## Data model

Portal (`src/portal/types.ts`, `Db`, version 1):

- Core: `ship`, `users`, `personnel`, `leaveTypes`, `leaveRequests`, `subDepartments`, `departments`, `lists`,
  `importFields`, `maxLeavePctPerDept`.
- Optional, added later: `notifications`, `availedAdjustments`, `leaveForecasts`, `dailyOrders`,
  `specialParties`, `watchStationBill`, `dutyRosters`.
- `parseDb` (`src/portal/db.ts`) accepts a saved object only if the core arrays exist, fills defaults for the
  core fields, and passes optional fields through unchecked.

Training (`src/types/index.ts`): `Topic`, `ScheduledSession` (date, start time, optional duration, status,
lock, admin override, reschedule history, attendance muster, make-up link), `ScheduleSettings`, `HolidayEntry`,
`ScheduleConflict`.

Departments (`src/data/departments.ts`): `DEPARTMENTS` and `DEPARTMENT_NAMES` are module-level objects that
`applyDepartments()` rewrites in place when the administrator edits the list. `store.tsx` calls it during
render so every module sees the current list.

## Modules

| Module | Main files |
|---|---|
| Home | `portal/pages/HomePage.tsx`, `portal/ShipProfileEditor.tsx`, `portal/stats.ts` |
| Departments | `portal/pages/DepartmentsPage.tsx`, `DepartmentsOrbit.tsx`, `portal/DepartmentsManager.tsx`, `departmentOps.ts` |
| Nominal Roll | `portal/pages/PersonnelPage.tsx`, `portal/personnelImport.ts`, `portal/importFields.ts`, `data/ranks.ts` |
| Leave | `portal/leaveLogic.ts` (rules), `portal/pages/LeavePage.tsx`, `pages/leave/*` (MyLeave, Approvals, Forecast, LeavePathStepper, LeaveSettings) |
| Training | `training/TrainingModule.tsx` (orchestrator), `utils/scheduler.ts` (engine), `components/*` (views and modals) |
| Daily Orders | `portal/pages/DailyOrdersPage.tsx`, `components/DailyOrdersPublisher.tsx` |
| Watch & Station Bill | `portal/pages/WatchAndStationBillManager.tsx` |
| Settings | `portal/pages/SettingsPage.tsx`, `portal/ListsSettings.tsx`, `portal/ImportColumnsEditor.tsx` |
| LAN Sync | `portal/LanSyncManager.tsx` |
| Ships | `portal/ships.tsx`, `ShipSwitcher.tsx`, `registry.ts`, `ship.ts`, `tushilSeed.ts` |
| Login | `portal/Login.tsx`, `portal/auth.ts` |

### Training

- `scheduler.ts`: generates the year's sessions on the configured weekdays (each topic once, after its
  prerequisite, departments in rotation), audits conflicts (holiday, weekend, wrong track, prerequisite order,
  same day / overlapping time), cascades reschedules.
- Tabs (`ActiveTab`): Dashboard, Quarterly, Departments, Admin (matrix), Public (calendar), Analytics, Muster.
- Imports: `utils/topicImport.ts`, `utils/readTableFile.ts`, `utils/columnMap.ts`, `components/ColumnMapper.tsx`.
- Exports: `utils/exporters.ts` (CSV, .ics), `utils/calendarExport.ts` (Excel, PDF, PNG), `utils/monthlyBulletinPdf.ts`.
- A date/time change that creates a new conflict is held back; the administrator may override.
- On first load with no topics, it fetches `public/data/training_curriculum.json`.

### Leave

Approval chain in `leaveLogic.ts` (`firstStatus`, `canDecide`, `getApprovalStepResult`):

- Sailor: Department Officer -> Head of Department -> Executive Officer -> approved, Gunnery Office notified.
- Officer: Head of Department -> Commanding Officer.
- HOD / EXO: Commanding Officer. CO: Administrator.
- Nobody decides their own request. The Administrator may act at any stage.

### Login and roles

Roles: `ADMIN`, `CO`, `EXO`, `HOD`, `USER`. Passwords are PBKDF2-SHA256 hashes (150,000 iterations, per-user
salt) in the same `Db` blob. This controls which screens appear; it is not protection against someone who can
open the browser's stored data. Training: `canEdit` for every role except `USER`, `isAdmin` for `ADMIN`.

## Offline delivery

1. **PWA**: `vite.config.ts` configures the service worker to cache the built app. Install from Chrome/Edge.
2. **Single-file training HTML**: `scripts/build-offline-training.mjs` builds the CSS with Vite, bundles
   `src/standalone-training.tsx` with esbuild, and writes one self-contained HTML to both the repo root and
   `public/` (the copy in `public/` is what the in-app download button serves). Opened from `file://`, it has
   its own storage, separate from the portal's.
3. **Dev server**: `Tushil.bat` runs Vite on port 3000.

## Moving data between PCs

- Backup / restore: whole `Db` as JSON (Nominal Roll page); training state as JSON (Training page).
- LAN Sync packet (`LanSyncManager.tsx`): personnel, leave requests, leave forecasts, watch bill, special
  parties and training sessions, for one department or the whole ship. Import merges by id. User accounts are
  not included, so each PC has its own logins.

## Audit findings (2026-11-10), most important first

1. **Public repository with personnel-shaped data.** `public/data/nominal_roll.json` (18 people) is committed
   to a public GitHub repo. It appears to be sample data; it must stay that way. See `AGENTS.md` rule 1.
2. **Approval rights from free text.** `canDecide` and `firstStatus` also grant CO / EXO / HOD treatment when a
   person's `designation` text contains "commanding officer", "executive officer", "head of department" or
   "exo". Anyone who can edit the Nominal Roll can therefore give approval rights by typing a designation.
   Rights should come from the user's role only.
3. **LAN Sync import trusts the file.** No check that the packet's `shipId` matches the open ship, no check of
   record shape, incoming records overwrite existing ones field by field, and a leave request is replaced when
   the incoming history is at least as long (not newer). `OfflineGuide.md` calls the bundle "signed"; nothing
   is signed.
4. **LAN Sync writes training sessions straight to `localStorage`.** If the Training page is open at that
   moment, its in-memory state overwrites the merged sessions on its next save.
5. **Standalone training HTML has no login.** It offers an "Admin / Planner" toggle to anyone, its backup
   exports every `localStorage` key (including user password hashes if a portal database exists there), and
   its restore writes any key from the file.
6. **New ships are not empty.** `store.tsx` loads `public/data/nominal_roll.json` whenever a ship's personnel
   list is empty, so a newly added ship is seeded with the sample people. The README says a new ship starts empty.
7. **Two self-checks fail** (see `PROJECT_STATUS.md`): `leave.check.ts` still expects the old approval chain;
   `scheduler.check.ts` "same start without an end overlaps" fails and needs investigating before trusting
   overlap detection for sessions with no duration.
8. **Storage ceiling.** Browsers allow roughly 5 MB of `localStorage` per origin. The `Db` blob holds
   photos (up to 450 KB each), notifications and daily orders that only grow. A failed save is logged to the
   console only; the user is not told.
9. **Split state.** The training state is read and written from five places outside `TrainingModule`. Moving
   it behind one shared accessor (or into the store) would remove finding 4 and the stale-read risk on Home
   and Daily Orders.
10. **Generated file in git, twice.** Each rebuild commits two identical 3 MB copies of
    `tushil-training-offline.html`. Keeping only the `public/` copy halves that.
11. **Housekeeping.** Stray tracked files: `src/portal/PortalApp.tsx` with a trailing backtick in its name,
    `src/components/TopicIngestionModal.tsx.bak`, `codex_ori.ps1`. Two lockfiles (`package-lock.json`,
    `bun.lock`). Dependencies with no import in `src/` or `scripts/`: `express`, `dotenv`, `@google/genai`,
    `d3`, `@types/d3`, `motion`, `react-is` (confirm `react-is` is not a `recharts` peer requirement before
    removing). `package.json` name is still `react-example`. `.env.example` describes a Gemini API key the app
    does not use. `README.md` lists Daily Order as not built.
12. **Large files.** `Forecast.tsx` (1,545 lines), `WatchAndStationBillManager.tsx` (1,215),
    `DailyOrdersPage.tsx` (1,150), `TrainingModule.tsx` (1,142). Agents that rewrite whole files are most
    likely to cause damage here; split them when next working in them.
