# Google Sheet setup — HL Dashboard

A step-by-step guide aimed at **Valijon** (non-developer) for getting
the live sheet talking to the dashboard.

Sheet URL:
**https://docs.google.com/spreadsheets/d/1wiNvKjtiwoX2UNBJuNX472cLWKExlQ-vxXAOiLFH484/edit**

---

## 1. Open the sheet to "Anyone with the link"

**Why:** the dashboard reads the sheet as a guest. Without this step it
cannot see any data and falls back to the frozen starter CSVs in the
code.

1. Open the sheet.
2. Click the **Share** button (top-right, green/blue).
3. Under **General access**, change "Restricted" → **"Anyone with the
   link"**.
4. Keep the role as **Viewer** (default). No one who doesn't have the
   URL will find the sheet.
5. Click **Done**.

> You do **not** need "Publish to web". The dashboard uses Google's
> `gviz` CSV endpoint which works with any publicly-viewable sheet.

---

## 2. Run the setup script (creates 10 tabs, colour-coded, with starter data)

1. With the sheet open, click **Extensions → Apps Script**.
2. If a "Code.gs" file opens with empty content, delete whatever is
   there.
3. Copy the entire contents of `scripts/setup_sheet.gs` (from this repo)
   and paste it into the Apps Script editor.
4. Click the **save** icon (or `⌘S`).
5. Above the code area, choose the function **`setup`** from the
   dropdown.
6. Click **▶ Run**.
7. The first time, Google will ask you to authorise the script to edit
   your spreadsheet — accept.
8. When it finishes (usually under 30 seconds) you'll see a toast in
   the spreadsheet: *"HL Dashboard sheet set up."*

**What the script does:**

- Creates 10 tabs, each one corresponding to a section of the dashboard.
- Writes a coloured description banner at the top of every tab (row 1)
  explaining in plain English what that tab controls.
- Fills each tab with **starter data** taken from the February 2026 PPT
  snapshot — so the dashboard renders immediately.
- Freezes the banner + header rows so you always see them while
  scrolling.
- Colour-codes the tabs so you can tell at a glance which part of the
  dashboard you're editing:

| Colour | Group | What it controls |
|---|---|---|
| 🔵 Blue | Text | Dashboard title, KPI numbers, overview and commentary paragraphs |
| 🟢 Teal | Map | (reserved — map is currently a static SVG) |
| 🟠 Orange | Chart | The 4 charts on page 3 (roles donut, agency bar, country-by-grade, grade-and-gender) |
| 🟡 Gold | Trend | The 2 long-term trend charts on page 4 |
| 🟣 Purple | People | Leaders list + contact directory |

Running `setup()` a second time is **safe** — it only updates the
banner, header, and tab colours. It will never overwrite data you've
already added. To reset a specific tab, delete it from the sheet and
run `setup()` again.

---

## 3. Verify the dashboard is reading the sheet

1. Open the dashboard (locally or on GitHub Pages).
2. Click the **⟳ Refresh data** button in the top bar.
3. Make a small change in the sheet (e.g. change `snapshot_month` in
   tab 1 to `March 2026`) and save.
4. On the dashboard, click **⟳ Refresh data** again. You should see the
   change reflected immediately in the header.

If something doesn't show up:

- Open the browser's DevTools console (F12 → Console). Any
  `[SheetsLoader]` warnings tell you which tab failed to load.
- The dashboard **falls back** to the starter CSVs in
  `data/initial/` whenever a tab is unreachable — so the page will
  never look broken even if the sheet is temporarily offline.

---

## 4. How to edit — day-to-day

- **Text, KPIs, commentary:** tab **1. Text & KPIs**. Edit the `value`
  column only. Markdown is supported: `**bold**`, `[link](url)`, and
  a blank line = new paragraph.
- **Charts:** edit numbers directly in the corresponding chart tabs
  (3–8). Headers are row 2; data starts row 3.
- **Leaders / contacts:** add or remove rows in tabs 9 & 10. The Page 5
  table numbers are auto-generated.

Changes propagate to the dashboard within ~2 minutes (browser cache).
Click **⟳ Refresh data** to force an immediate reload.

---

## Troubleshooting

| Problem | Likely cause | Fix |
|---|---|---|
| Dashboard shows "21 leaders" instead of the current count | Sheet not shared yet | Step 1 — change access to "Anyone with the link" |
| One chart has empty data | Tab renamed or deleted | Keep the numbered prefix: `3. Leadership roles (donut)` etc. See `app/config.js` for the exact titles |
| Overview text looks like plain HTML | Accidental `<` / `>` in the cell | Edit the cell, escape angle brackets with a space |
| Changes don't appear | Browser cache | Hit ⟳ Refresh data, or hard-reload (⌘Shift R / Ctrl-Shift-R) |
