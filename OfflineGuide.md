# TUSHIL — Complete Offline & PWA Operations Guide (`OfflineGuide.md`)

This guide explains how to download, share, and operate the **Training Module** and all core **INS Tushil** shipboard modules in a **100% offline environment** (at sea or on air-gapped harbour networks) without internet connectivity.

---

## 1. Where Is the Training Module & How to Download the Single-File Offline HTML Right Now

### A. Navigating to the Training Module in the App
1. **From the Home Page:**
   - Click **Training** in the top navigation bar (or hover over the left/top edge arrow to reveal the bulging module icons and click the **Graduation Cap (`Training`)** icon), **OR**
   - Scroll down on the Home Page to the **"Weekly Training Schedule & Activity Outlook"** card and click **Open Training Planner**.

### B. Downloading `tushil-training-offline.html` to Share Immediately
You can download the standalone single-file HTML in three ways:
1. **Direct One-Click Button on the Home Page:**
   - In the **Weekly Training Schedule & Activity Outlook** section on the Home Page, click the green **"Download Offline Training (.HTML)"** button.
2. **Direct One-Click Button Inside the Training Module:**
   - At the top of the **Training** page (in the **Offline & Sync Status Bar** and in the top-right toolbar), click **"Download Offline Training (.HTML)"**.
   - Your browser will immediately save `tushil-training-offline.html` (`~2.8 MB`) to your `Downloads` folder.
3. **From the Project Folder (Local Windows / GitHub Workspace):**
   - The generated file is located directly at:
     - `/tushil-training-offline.html` (in the root project directory)
     - `/public/tushil-training-offline.html`
   - To rebuild it after code changes, run:
     ```bash
     npm run build:offline-training
     ```

---

## 2. Running the Single-File Training Module (`tushil-training-offline.html`) Offline

The `tushil-training-offline.html` file contains the **entire Training Module**—React, Tailwind CSS, Recharts analytics, Lucide icons, and Excel/CSV/ICS export engines—bundled inline into a single `.html` file.

### Step-by-Step Usage on Any Offline PC
1. **Copy & Share:** Copy `tushil-training-offline.html` onto a USB thumb drive, shared LAN folder, or email attachment and transfer it to any Windows, Linux, or macOS computer.
2. **Double-Click to Launch (`file://`):**
   - Double-click `tushil-training-offline.html` to open it directly in **Microsoft Edge**, **Google Chrome**, or **Mozilla Firefox**.
   - **No Node.js, no local web server, and no internet connection are required.**
3. **Included Features in the Single HTML File:**
   - **Dashboard & Annual Training Matrix Planner**
   - **Repeat Session Scheduler** (Daily, Weekly, Bi-Weekly departmental/ship-wide scheduling)
   - **Global Search & Filter Bar** (by Topic, Department, and Date Range)
   - **Quarterly Analytics & Training Hours Dashboard** (Recharts bar/line charts)
   - **Attendance Muster, Absentees & Make-Up Training Tracker**
   - **Daily Orders Training Publisher**
   - **Reschedule, Conflict Audit & Admin Override Controls**
   - **Calendar & Schedule Exports** (CSV, Excel `.xlsx`, iCalendar `.ics`, Printable Bulletin PDF, and SVG Image)
   - **Standalone Top Utility Bar:** Switch ships (`INS Tushil`, etc.), toggle between **Admin / Planner Mode** and **Crew Read-Only Mode**, and use **Backup JSON** / **Restore JSON**.

---

## 3. Installing & Running the Full Portal as an Offline Progressive Web App (PWA)

To run **all core modules** (**Home**, **Departments**, **Executive · Gunnery & Routine Office**, **Watch & Station Bill**, **Daily Orders**, **Nominal Roll**, **Leave & Multi-Person Forecast**, **Training**, and **Settings**) offline:

### Step 1: Install the PWA While Connected to Your Local Server or Host
1. Open the TUSHIL portal in **Google Chrome** or **Microsoft Edge**.
2. Click the **"Install App"** button in the top bar (or click the **Install icon** on the right side of the browser's address bar).
3. Confirm by clicking **Install**.
4. The browser's **Service Worker (`sw.js`)** automatically pre-caches all application bundles, stylesheets, icons, and curriculum assets locally on the machine.

### Step 2: Launch & Operate Without Network Connectivity
1. Once installed, launch **TUSHIL** directly from your **Windows Desktop shortcut**, **Start Menu**, or `chrome://apps` — even when Wi-Fi and Ethernet are completely disconnected.
2. When offline, the portal displays an **"Offline Mode — Local Storage Active"** indicator in the bottom-right corner confirming that all reads and writes are safely stored in your browser's local database (`localStorage`).

---

## 4. Using the Unsaved Local Changes Indicator & Data Synchronisation

Because offline changes are stored inside the local browser until exported or synced across terminals:

### A. Visual Unsaved Local Changes Indicator (Training Module)
- Whenever you add, reschedule, override, delete, or import training sessions, the **Training Status Indicator** at the top of the Training Module switches to an **Amber Warning State**:
  > **`Unsaved Local Changes (N edits since last backup) — Export or Sync before closing browser`**
- If you attempt to close or refresh the browser tab while unbacked-up changes exist, the browser will also prompt you before closing.
- Click **"Save Backup (.JSON)"** right inside the status bar (or export to CSV/JSON) to save a portable copy of your updated training plan. Once exported, the indicator turns **Emerald Green (`All Changes Backed Up`)** with the timestamp of your last backup.

### B. Multi-PC Offline Sync (Harbour / Sea Mode)
To synchronize data across multiple offline shipboard PCs (e.g., **Gunnery Office**, **EXO Cabin**, **Bridge**, and **Departmental Offices**):
1. Click the **Radio / LAN Sync icon** in the top bar (or open **Multi-PC LAN & Thumb-Drive Sync**).
2. **Export Master Ship Bundle (`.json`):** Exports the Nominal Roll, Leave Records, Watch & Station Bill, Daily Orders, and Training Matrix into one signed JSON bundle onto a USB thumb drive.
3. **Import & Merge on Target PC:** Plug the USB drive into the target PC, open the sync modal (or click **Restore JSON** in the Training Module), and select the `.json` file to synchronize all records offline.
