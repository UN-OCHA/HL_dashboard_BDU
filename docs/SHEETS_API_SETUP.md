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

### Read a tab

```bash
curl -sL -X POST "$URL" -H 'Content-Type: application/json' -d '{
  "token":  "...",
  "action": "read",
  "tab":    "11. Reference links",
  "range":  "A1:C20"
}'
```

`range` is optional — without it you get the whole tab.

### Append rows

```bash
curl -sL -X POST "$URL" -H 'Content-Type: application/json' -d '{
  "token":  "...",
  "action": "append",
  "tab":    "11. Reference links",
  "rows": [
    ["Highlight", "HC Leadership Profile", "https://interagencystandingcommittee.org/"],
    ["Highlight", "Contact hls@un.org",     "mailto:hls@un.org"]
  ]
}'
```

Rows are appended to the bottom of the tab (after the last non-empty
row). All inner arrays must be the same length.

### Update a specific range

```bash
curl -sL -X POST "$URL" -H 'Content-Type: application/json' -d '{
  "token":  "...",
  "action": "update_range",
  "tab":    "11. Reference links",
  "range":  "A3:C5",
  "values": [
    ["Highlight", "HC Leadership Profile", "https://interagencystandingcommittee.org/"],
    ["Highlight", "HC TOR",                "https://interagencystandingcommittee.org/"],
    ["Highlight", "RC Leadership Profile", "https://interagencystandingcommittee.org/"]
  ]
}'
```

Number of rows × cols in `values` must match the dimensions of `range`.

### Clear a range

```bash
curl -sL -X POST "$URL" -H 'Content-Type: application/json' -d '{
  "token":  "...",
  "action": "clear_range",
  "tab":    "11. Reference links",
  "range":  "A3:C30"
}'
```

Clears cell contents only — does not delete rows or change formatting.

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
