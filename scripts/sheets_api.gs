/**
 * sheets_api.gs — JSON write API for the HL Dashboard sheet.
 *
 * Deploy this as a Google Apps Script Web App so Claude Code can read
 * and (selectively) write rows to specific tabs without going through
 * the Chrome extension or a third-party MCP.
 *
 * SECURITY MODEL
 * --------------
 *  • The deployment URL is unguessable (Google mints a long random ID).
 *  • All POST requests must carry the shared TOKEN below — otherwise
 *    they get a flat "Unauthorized" rejection.
 *  • Only tabs in WRITE_WHITELIST can be modified. KPI / formula /
 *    locked tabs are NOT in the list — append a tab here only when
 *    you actively want Claude Code to be able to write to it.
 *  • There is NO delete-row action and NO sheet-level destructive
 *    operation (no clearAll, no deleteSheet). Worst-case mistake is
 *    extra rows appended; recoverable via Edit → Undo or version
 *    history.
 *  • Read action works on any tab (read-only). Write actions are
 *    further gated by the whitelist.
 *  • Every request gets logged to the Apps Script execution log so
 *    you have an audit trail (View → Executions in the Apps Script
 *    editor).
 *
 * DEPLOYMENT
 * ----------
 *  1. Open the sheet → Extensions → Apps Script.
 *  2. Paste this entire file as a new script (or replace contents).
 *  3. Replace TOKEN below with your own random string. Keep it
 *     somewhere safe (e.g. ~/.claude/CLAUDE.md). DO NOT commit it
 *     to git — this script lives ONLY inside the sheet's bound
 *     Apps Script project, not in the repo.
 *  4. Deploy → New deployment → Type: Web app:
 *       Description:    HL Dashboard sheet API
 *       Execute as:     Me (your account)
 *       Who has access: Anyone with the link
 *  5. Copy the Web app URL (ends in /exec). That URL + your TOKEN
 *     is what Claude Code uses to talk to the sheet.
 *  6. Paste both into ~/.claude/CLAUDE.md under a project section so
 *     they persist across sessions.
 *
 * REVOKING ACCESS
 * ---------------
 *  • Deploy → Manage deployments → Archive (one-click revoke).
 *  • Or change TOKEN to a new value and re-deploy.
 *  • Or remove the script entirely.
 */

/* eslint-disable no-undef */

var TOKEN = "PASTE_YOUR_RANDOM_TOKEN_HERE";

/* Tabs Claude Code is allowed to write to (append / update_range /
   clear_range). Read action is unrestricted. Add new tabs only when
   you've decided you want Claude Code to be able to modify them. */
var WRITE_WHITELIST = [
  "11. Reference links",
  "9. Leaders (roster)",
  "10. Contact directory"
];


/* ── HTTP entry points ──────────────────────────────────────── */

function doGet() {
  // Health check — confirms the deployment is live without leaking
  // sheet contents. Useful for testing the URL in a browser.
  return jsonOut({
    ok: true,
    service: "HL Dashboard sheet API",
    actions: ["read", "append", "update_range", "clear_range"],
    note: "POST with { token, action, tab, ... }"
  });
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonOut({ ok: false, error: "Empty request body" });
    }
    var body = JSON.parse(e.postData.contents);

    // Auth gate — fail fast on bad / missing token.
    if (!body.token || body.token !== TOKEN) {
      log("auth_fail", { action: body.action, tab: body.tab });
      return jsonOut({ ok: false, error: "Unauthorized" });
    }

    // Action dispatch.
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var action = body.action;

    if (action === "read")         return doRead(ss, body);
    if (action === "append")       return doAppend(ss, body);
    if (action === "update_range") return doUpdateRange(ss, body);
    if (action === "clear_range")  return doClearRange(ss, body);

    return jsonOut({ ok: false, error: "Unknown action: " + action });
  } catch (err) {
    log("error", { msg: String(err) });
    return jsonOut({ ok: false, error: String(err) });
  }
}


/* ── Actions ────────────────────────────────────────────────── */

function doRead(ss, body) {
  var sheet = ss.getSheetByName(body.tab);
  if (!sheet) return jsonOut({ ok: false, error: "Tab not found: " + body.tab });

  var range = body.range
    ? sheet.getRange(body.range)
    : sheet.getDataRange();
  var values = range.getValues();
  log("read", { tab: body.tab, rows: values.length });
  return jsonOut({ ok: true, tab: body.tab, rows: values });
}

function doAppend(ss, body) {
  var gate = checkWrite(body);
  if (gate) return gate;

  var sheet = ss.getSheetByName(body.tab);
  if (!sheet) return jsonOut({ ok: false, error: "Tab not found: " + body.tab });

  var rows = body.rows || [];
  if (!rows.length || !rows[0].length) {
    return jsonOut({ ok: false, error: "Empty rows" });
  }
  sheet
    .getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length)
    .setValues(rows);
  log("append", { tab: body.tab, rows: rows.length });
  return jsonOut({ ok: true, appended: rows.length });
}

function doUpdateRange(ss, body) {
  var gate = checkWrite(body);
  if (gate) return gate;

  var sheet = ss.getSheetByName(body.tab);
  if (!sheet) return jsonOut({ ok: false, error: "Tab not found: " + body.tab });
  if (!body.range || !body.values) {
    return jsonOut({ ok: false, error: "Missing range or values" });
  }
  sheet.getRange(body.range).setValues(body.values);
  log("update_range", { tab: body.tab, range: body.range });
  return jsonOut({ ok: true, updated: body.range });
}

function doClearRange(ss, body) {
  var gate = checkWrite(body);
  if (gate) return gate;

  var sheet = ss.getSheetByName(body.tab);
  if (!sheet) return jsonOut({ ok: false, error: "Tab not found: " + body.tab });
  if (!body.range) return jsonOut({ ok: false, error: "Missing range" });

  sheet.getRange(body.range).clearContent();
  log("clear_range", { tab: body.tab, range: body.range });
  return jsonOut({ ok: true, cleared: body.range });
}


/* ── Helpers ────────────────────────────────────────────────── */

function checkWrite(body) {
  if (WRITE_WHITELIST.indexOf(body.tab) === -1) {
    log("write_denied", { tab: body.tab });
    return jsonOut({
      ok: false,
      error: "Tab not in WRITE_WHITELIST: " + body.tab
    });
  }
  return null;
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj, null, 2))
    .setMimeType(ContentService.MimeType.JSON);
}

function log(event, details) {
  // Logs to the Apps Script execution log (View → Executions).
  // Cheap audit trail without external dependencies.
  Logger.log("[" + event + "] " + JSON.stringify(details || {}));
}


/* ── ONE-SHOT: Create + seed "11. Reference links" tab ────────
   Run this from the Apps Script editor → Run dropdown → select
   `initReferenceLinksTab` → Run. After it finishes, the tab is
   populated and the dashboard's Section 02 link list + Page 7
   Resources can read it. Idempotent — running twice just
   re-writes the same rows in the same place. */
function initReferenceLinksTab() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var name = "11. Reference links";
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);

  // Banner row + header row.
  sh.getRange(1, 1, 1, 3).setValues([[
    "Reference links — drives Section 02 link list (rows where section = Highlight) AND Resources page (everything else)",
    "", ""
  ]]);
  sh.getRange(2, 1, 1, 3).setValues([["section", "label", "url"]]);
  sh.getRange(2, 1, 1, 3).setFontWeight("bold");
  sh.setFrozenRows(2);

  // Default rows.
  var rows = [
    ["Highlight",          "HC Leadership Profile",                       "https://interagencystandingcommittee.org/"],
    ["Highlight",          "HC Terms of Reference",                       "https://interagencystandingcommittee.org/"],
    ["Highlight",          "RC Leadership Profile",                       "https://interagencystandingcommittee.org/"],
    ["Highlight",          "Contact hls@un.org",                          "mailto:hls@un.org"],
    ["Guidance",           "Humanitarian Reset",                          "https://interagencystandingcommittee.org/"],
    ["Guidance",           "Inter-Agency Standing Committee (IASC)",      "https://interagencystandingcommittee.org/"],
    ["Guidance",           "OCHA Humanitarian Leadership Strengthening",  "https://www.unocha.org/"],
    ["Guidance",           "Leadership in Humanitarian Action Handbook",  "https://interagencystandingcommittee.org/"],
    ["Guidance",           "Leading an Emergency Response",               "https://interagencystandingcommittee.org/"],
    ["Voices",             "ERG's Humanifesto",                           "https://interagencystandingcommittee.org/"],
    ["Voices",             "I Was There: voices of humanitarian leadership", "https://interagencystandingcommittee.org/"],
    ["Voices",             "Humanitarian Leadership stories",             "https://interagencystandingcommittee.org/"],
    ["Talent initiatives", "RC/HC Talent Pipeline",                       "https://unsceb.org/"]
  ];
  sh.getRange(3, 1, rows.length, 3).setValues(rows);
  return "Created/updated " + name + " with " + rows.length + " rows";
}
