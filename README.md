# Ship Administration Portal

Offline portal for a ship, built as modules: **Home, Departments, Nominal Roll, Leave, Training**. No backend and no network
calls; data lives in the browser (`localStorage`) on one PC, with JSON backup and restore.

## Ships

The portal is a template: only the ship's data changes. Each ship has its own workspace (profile, personnel, leave, logins, training).
Use the ship name at the top of the sidebar to switch ships or **Add a ship**. A new ship starts empty and can copy the settings
(leave types, sections, manpower warning level) from the current one; people, leave history and logins are never copied.
Each ship has its own administrator, created on that ship's first sign-in. INS Tushil is the first ship, with a starting profile
from public information (edit it under Home > Edit ship profile). Remove a ship under Edit ship profile (typed confirmation).

## Modules (this release)

- **Home**: the ship's outlook. Banner photo, key facts, specifications and timeline/news (all editable by the administrator),
  plus live figures: personnel present / on leave, departments, next training.

- **Departments**: Executive, Engineering, Electrical, Logistics, Medical, Miscellaneous, shown as a 3D carousel orbiting the
  "Departments" orb (arrows, left/right keys, or click a side slide). Each slide shows live members / present / on leave; open one for its
  sections (administrator can add, rename, remove) and Nominal Roll.
- **Nominal Roll**: add, edit, deactivate, or import a pasted table (rows with problems are rejected with the reason).
  Administrator creates logins and roles here and takes a full-data backup.
- **Leave**: balances per leave type (stacked bars: taken / approved / pending), apply form, approval chain, forecast and status.
  Chain: personnel -> Head of Department (own department) -> Commanding Officer. A HoD's leave goes to the CO; the CO's to the
  Administrator. Nobody approves their own. Forecast shows monthly person-days, department split, who is on leave today, and warns when more
  than a set share of a department is away. Leave types and yearly days are editable under Leave > Settings
  (the starting 60 / 30 are placeholders to set from current regulations).
- **Training**: the annual training scheduler (see below). Ordinary personnel get read-only calendar access.

Not built yet: daily manpower in/out, Daily Order, Maintenance Calendar.

Backups are per ship (Nominal Roll > Backup all data). Photos are stored in the browser, compressed to under 450 KB.

## Login and data safety

First start asks for an administrator account. Roles: Administrator, Commanding Officer, Head of Department, Personnel.
Passwords are stored as PBKDF2 hashes, but with no server the data and code are in the same browser, so this controls the
screens; it does not protect against someone who can open the PC's browser data. Take regular backups (Nominal Roll > Backup all data).
The portal must be opened at `http://localhost` (or https): browsers block password hashing on plain http over a network address.

## Run

```
npm install
npm run dev      # http://localhost:3000
npm run build
```

## Training module

1. **Import Topics** (dashboard or Training Matrix tab). Upload a CSV/Excel file or paste a table. Once it has a header and data, a
   "Match the columns" panel lets you pick which column fills each field (or a fixed value for every row). Required columns: title,
   department. Optional: id, section, speaker, prerequisite (a topic id or exact title), venue, description.
   **Sheet columns…** renames columns, switches optional ones off or makes them compulsory, so one blank sheet can go to every
   department (Settings > Lists & sheets has the same controls). Departments are edited under Departments > Manage departments;
   renaming one updates the Nominal Roll, its sections and its topics. Rows with an unknown department or prerequisite are rejected with a message.
2. **Schedule** button (header): choose which weekdays are training days, what each takes (Ship-Wide topics,
   Departmental topics, Either, or No training), and the start time (duration in minutes is optional). Defaults: Mon/Thu ship-wide, Tue/Wed/Fri
   departmental, a 13:45 start. Applying rebuilds the schedule; locked and Completed sessions keep their date and time.
   Sessions are then placed automatically on those days: each topic once, only after its prerequisite, departments in
   fair-share rotation. Slots with no eligible topic stay empty; nothing is invented. Topics that cannot be placed are
   counted on the dashboard and via **Schedule N unscheduled** in the matrix.
   Any single session's date and start/end time can be changed in the Training Matrix (this pins it).
3. **Holidays** start from the Government of India 2026 gazetted list (`src/data/holidays.ts`). Moon-dependent dates are
   flagged and can be corrected in the Blackout manager. Weekends are skipped unless you enable them in Schedule settings.
4. Edit, lock, shift or cascade sessions in the Training Matrix; conflicts (holiday, weekend, wrong track for the weekday,
   prerequisite order, duplicate date) are audited live. Locked and Completed sessions survive re-scheduling.
5. Export CSV, `.ics` or print; back up / restore everything as JSON.

## Checks

```
npm run lint                                                   # type check
node --experimental-strip-types src/utils/topicImport.ts       # importer self-check
node --experimental-strip-types src/utils/scheduler.check.ts   # scheduler self-check
node --experimental-strip-types src/portal/leave.check.ts       # leave rules, routing, hashing
node --experimental-strip-types src/portal/personnelImport.ts   # personnel importer
```

The schedule year is set with the Year box in the header (default 2026). 2026 has the full gazetted holiday list; other years start with only the fixed-date holidays and Good Friday, so add that year's Holi, Eid, Diwali etc. in the Holidays manager.


### Training sessions: times, status, override, export

- A session has a **start time** and an optional **duration** (minutes, from the topic sheet's Duration column, the Schedule default, or typed per session). The end time is shown only when a duration exists.
- Session dates can only be today or later.
- The administrator can flag a session **Completed** or **Skipped**, and **Reschedule** it to a later date with a reason (status Rescheduled, old date kept).
- A date/time change that creates a warning (same day, same time, holiday, prerequisite, wrong track) is held back; the administrator can **Override and schedule**. The warnings stay visible with an "Admin override" mark.
- **Export...** (Training header): date range, month or quarter, as Excel, PDF or PNG; PDF and PNG as a calendar or a table.
