# Sheets API — Apps Script web app

A small JSON write API bound to the HL Dashboard Google Sheet so Claude
Code (or any other client) can read and selectively write specific tabs
without going through the Chrome extension or a third-party MCP.

The script lives at [`scripts/sheets_api.gs`](../scripts/sheets_api.gs).

## When to use this

- Adding rows to the **Reference links** tab from a session.
- Updating leader / contact metadata in bulk.
- Programmatic edits where copy-paste would be slow or error-prone.

## When NOT to use it

- Routine monthly updates by Valijon — those still happen by hand in
  the sheet UI.
- Anything destructive (the API has no delete-row action by design).

## Setup — one-time

1. Open the master sheet → **Extensions → Apps Script**.
2. Make a new script file (or paste over the existing) with the
   contents of [`scripts/sheets_api.gs`](../scripts/sheets_api.gs).
3. **Replace `TOKEN`** at the top of the script with a long random
   string. Generate one with:
   ```bash
   openssl rand -hex 24
   ```
4. **Deploy → New deployment → Web app:**
   - Description: `HL Dashboard sheet API`
   - Execute as: **Me** (your Google account)
   - Who has access: **Anyone with the link**
   - Click **Deploy**.
5. Copy the **Web app URL** (ends in `/exec`).
6. Stash both the URL and the TOKEN in `~/.claude/CLAUDE.md` under a
   project section so Claude Code picks them up across sessions:
   ```markdown
   ## HL Dashboard sheet API

   - URL:    https://script.google.com/macros/s/.../exec
   - Token:  <your TOKEN>
   - Writable tabs: 11. Reference links · 9. Leaders (roster) · 10. Contact directory
   ```
   `~/.claude/CLAUDE.md` is your private global config — never gets
   committed anywhere.

## Calling it

All requests are POST + JSON. Token always required.

### Use the bundled Python helper (recommended)

```bash
export HL_SHEET_URL="https://script.google.com/macros/s/.../exec"
export HL_SHEET_TOKEN="<your shared secret>"

python3 scripts/sheet_call.py read         "11. Reference links"
python3 scripts/sheet_call.py read         "1. Text & KPIs" "A1:B5"
python3 scripts/sheet_call.py append       "11. Reference links" rows.json
python3 scripts/sheet_call.py update_range "11. Reference links" "A3:C5" values.json
python3 scripts/sheet_call.py clear_range  "11. Reference links" "A3:C30"
```

`rows.json` / `values.json` are JSON arrays of arrays:
`[["Highlight","HC Leadership Profile","https://..."], ...]`

### ⚠ Why not curl?

curl trips over Apps Script's 302 redirect to
`script.googleusercontent.com`: the redirect handler drops the POST
body and you end up at a Google Docs 404 page (HTML "Pagina niet
gevonden"). Python's `urllib.request` follows the chain correctly,
so we ship the Python helper above. If you absolutely need curl,
the workaround is to make the request twice — once to capture the
redirect URL, then re-POST to that URL with the body. Easier to use
the Python helper.

### Raw payload shapes

#### Read a tab
```json
{
  "token":  "...",
  "action": "read",
  "tab":    "11. Reference links",
  "range":  "A1:C20"   // optional — whole tab if omitted
}
```

#### Append rows
```json
{
  "token":  "...",
  "action": "append",
  "tab":    "11. Reference links",
  "rows": [
    ["Highlight", "HC Leadership Profile", "https://interagencystandingcommittee.org/"],
    ["Highlight", "Contact hls@un.org",     "mailto:hls@un.org"]
  ]
}
```
Rows are appended after the last non-empty row. All inner arrays
must be the same length.

#### Update a specific range
```json
{
  "token":  "...",
  "action": "update_range",
  "tab":    "11. Reference links",
  "range":  "A3:C5",
  "values": [["…","…","…"], ["…","…","…"], ["…","…","…"]]
}
```
`values` dimensions must match `range`.

#### Clear a range
```json
{
  "token":  "...",
  "action": "clear_range",
  "tab":    "11. Reference links",
  "range":  "A3:C30"
}
```
Clears cell contents only — doesn't delete rows or change formatting.

## One-shot: seed the Reference links tab

If the `11. Reference links` tab doesn't exist yet (fresh sheet, or
someone deleted it), don't call `append` — it'll fail with "Tab not
found". Instead, run the bundled `initReferenceLinksTab()` function
from the Apps Script editor:

1. Open the script (Extensions → Apps Script in the sheet).
2. In the toolbar, **function selector → `initReferenceLinksTab`**.
3. Click **Run**.
4. The tab is created, banner + header rows added, and 13 default
   reference rows (Highlight + Guidance + Voices + Talent
   initiatives) are seeded.

Idempotent — running it twice just re-writes the same rows.

## Security model

| Layer | Effect |
|---|---|
| Long random URL (Google-minted) | URL itself is unguessable |
| Shared TOKEN | Wrong / missing token → flat `Unauthorized` |
| `WRITE_WHITELIST` in script | Write actions only on listed tabs |
| No delete-row / delete-tab actions | Worst-case mistake = stray rows |
| `Logger.log` audit trail | View → Executions in Apps Script |
| Bound to one sheet | Cannot reach any other Drive content |

## Revoking access

Any one of these instantly disables the API:

- **Apps Script editor → Deploy → Manage deployments → Archive.**
- Change `TOKEN` in the script and re-deploy.
- Delete the script file.
- Remove the deployment (Manage deployments → Delete).

## Troubleshooting

- `Empty request body` → make sure you POST with `Content-Type:
  application/json` and a non-empty body.
- `Unauthorized` → token in body doesn't match the script.
- `Tab not found` → check the exact tab name (with the leading number
  + dot, e.g. `11. Reference links`).
- `Tab not in WRITE_WHITELIST` → add the tab to the whitelist in the
  script and re-deploy.
- HTTP 200 but empty response → look at the Apps Script execution log
  for the actual error.
