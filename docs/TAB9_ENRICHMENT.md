# Tab 9 enrichment — manual review needed

The `9. Leaders (roster)` tab was bulk-enriched on **2026-05-21** from
`data/HC trends report 2025.xlsx` (Luiza Fernandes export) via
`scripts/enrich_tab9_from_xlsx.py`.

## What was filled

For each of the 29 leaders in Tab 9, the script wrote into columns
`hat3 · gender · nationality · weog · agency · eod · eoa` by matching
the leader's name against the xlsx through three tiers:

1. exact string match
2. accents / parens / hyphens / case normalised
3. first-word + last-word match (catches middle-name drift)

Sources: 61 current-in-post rows in the xlsx, plus 373 historical
assignments.

## Result

- **23 leaders** fully enriched
- **6 leaders** could not be matched — Tab 9 contains them but the
  xlsx does not. These rows are left empty in the new columns and
  need manual entry by Valijon.

## Leaders needing manual entry

These names do not appear in the xlsx under any spelling variant
the script tried. They are most likely recent appointments not yet
captured in Luiza's Salesforce export.

| Row | Name | Country (per Tab 9) |
|----:|:--|:--|
| 4 | Maurice Azonnankpo | Burkina Faso |
| 11 | Aboubacar Kampo | Ethiopia |
| 15 | Hanaa Singer | Mali |
| 17 | Gwyn Lewis | Myanmar |
| 25 | Nathalie Fustier | Syrian Arab Republic |
| 31 | Rosaria Bruno | Sudan Crisis (Tawila) |

For each, please fill in directly in the master sheet:

- `hat3` — usually `HC`, `DHC`, `SHC`, `RHC`, or `DRHC`
- `gender` — `Female` or `Male`
- `nationality` — country of citizenship (free text — see other rows for format)
- `weog` — `WEOG` or `Non-WEOG`
- `agency` — agency of origin (full name — see other rows for format,
  e.g. `OCHA`, `UNICEF`, `World Food Programme`, `United Nations Development Programme - UNDP`)
- `eod` — entrance on duty (YYYY-MM-DD)
- `eoa` — end of assignment (leave empty for current leaders)

## Re-running the enrichment

When Luiza publishes a new xlsx (typically monthly), re-run:

```bash
export HL_SHEET_URL="…/exec"           # from ~/.claude/CLAUDE.md
export HL_SHEET_TOKEN="…"
/tmp/hl-xlsx-venv/bin/python3 scripts/enrich_tab9_from_xlsx.py \
    --xlsx "../data/HC trends report 2025.xlsx" \
    --dry-run    # always dry-run first; verify the report before pushing
```

The script writes ONLY to columns 5–11 (E–K) — it never touches
columns 1–4 (country / duty_station / name / position), which
Valijon maintains by hand. Existing manually-filled cells will be
overwritten if the xlsx now has matching data, so review the dry-run
report before pushing.
