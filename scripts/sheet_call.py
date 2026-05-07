#!/usr/bin/env python3
"""
sheet_call.py — tiny CLI helper that calls the HL Dashboard sheet API.

The API is a Google Apps Script web app deployed inside the master sheet
(see scripts/sheets_api.gs and docs/SHEETS_API_SETUP.md). This client
reads URL + TOKEN from environment variables so credentials never live
in code or git.

Usage
-----
    export HL_SHEET_URL="https://script.google.com/macros/s/.../exec"
    export HL_SHEET_TOKEN="<your shared secret>"

    # Read a whole tab (or a specific A1 range)
    python3 scripts/sheet_call.py read   "11. Reference links"
    python3 scripts/sheet_call.py read   "1. Text & KPIs" "A1:B5"

    # Append rows from a JSON file (array of arrays)
    python3 scripts/sheet_call.py append "11. Reference links" rows.json

    # Update a specific range from a JSON file (array of arrays)
    python3 scripts/sheet_call.py update_range "11. Reference links" "A3:C5" values.json

    # Clear cell contents in a range (does not delete rows)
    python3 scripts/sheet_call.py clear_range "11. Reference links" "A3:C30"

Why Python and not curl
-----------------------
Apps Script web apps respond to POST with a 302 redirect to
script.googleusercontent.com. curl follows the redirect but Apps Script
expects the final hop to be retrieved with a stored body context, and
curl's redirect handling drops the POST body — you end up at a Google
Docs 404 page. urllib in Python handles the chain correctly out of the
box, so we ship Python here.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request


def call(action: str, tab: str, **kwargs):
    """POST a JSON body to the sheet API and return the parsed response."""
    url = os.environ["HL_SHEET_URL"]
    token = os.environ["HL_SHEET_TOKEN"]
    body = {"token": token, "action": action, "tab": tab, **kwargs}
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return {"ok": False, "http_status": e.code, "body": e.read().decode("utf-8", errors="replace")}


def main(argv: list[str]) -> int:
    if len(argv) < 3:
        print(__doc__.strip(), file=sys.stderr)
        return 2

    action, tab = argv[1], argv[2]
    extra: dict = {}

    if action == "read" and len(argv) >= 4:
        extra["range"] = argv[3]
    elif action == "append" and len(argv) >= 4:
        extra["rows"] = json.load(open(argv[3]))
    elif action == "update_range" and len(argv) >= 5:
        extra["range"] = argv[3]
        extra["values"] = json.load(open(argv[4]))
    elif action == "clear_range" and len(argv) >= 4:
        extra["range"] = argv[3]
    elif action not in {"read", "append", "update_range", "clear_range"}:
        print(f"Unknown action: {action}", file=sys.stderr)
        return 2

    result = call(action, tab, **extra)
    print(json.dumps(result, indent=2))
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
