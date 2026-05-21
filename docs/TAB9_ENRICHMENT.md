# Tab 9 enrichment — manual review needed

The `9. Leaders (roster)` tab was bulk-enriched on **2026-05-21** from
`data/HC trends report 2025.xlsx` (Luiza Fernandes export) via
`scripts/enrich_tab9_from_xlsx.py`, and a new `grade` column was added
the same day to support cross-filtering by UN grade (ASG / D2 / D1).

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
- `grade` — `ASG`, `D2`, or `D1` (see next section)

## Grade column (new — added 2026-05-21)

A new `grade` column (column L) was added to support the Page 3
cross-filtering work. Eleven leaders were pre-classified from
`position` using deterministic rules:

| `position` value | Derived `grade` | Pre-filled |
|---|---|---|
| DSRSG/RC/HC | ASG | ✓ (7 leaders) |
| DSC/RC/HC | D2 | ✓ (2 leaders) |
| Deputy HC | D1 | ✓ (2 leaders) |
| RC/HC (alone) | ambiguous — could be ASG or D2 | left empty |
| RC/HC a.i. | ambiguous | left empty |
| RC/HC OiC | excluded from charts (per PPT footnote) | left empty |

### Sixteen leaders need a `grade` decision

Per the existing pre-aggregated charts (Tabs 5 and 6), the cohort
splits **14 ASG · 11 D2 · 2 D1**. Eleven are pre-filled by the rules
above (7 ASG · 2 D2 · 2 D1). The remaining ones to classify are the
sixteen `RC/HC` / `RC/HC a.i.` leaders — please fill `ASG` or `D2`
for each:

| Country | Name |
|---|---|
| Cameroon | Issa Sanogo |
| Chad | François Batalingaya |
| Colombia | Mireia Villar Forner |
| Eritrea | Nahla Valji |
| Mali | Hanaa Singer |
| Mozambique | Catherine Sozi |
| Myanmar | Gwyn Lewis (a.i.) |
| Niger | Mama Keita |
| Nigeria | Mohamed Fall |
| Pakistan | Mohamed Yahya |
| Sudan | Denise Brown |
| Syrian Arab Republic | Nathalie Fustier (a.i.) |
| Ukraine | Matthias Schmale |
| Venezuela | Gianluca Rampolla del Tindaro |
| Yemen | Julien Harneis |
| Zimbabwe | Edward Kallon |

When filled, the counts should land at **7 ASG + 9 D2** across the
sixteen (so the cohort totals match Tab 5 / Tab 6 exactly).

OiC leaders (Maurice Azonnankpo, Aboubacar Kampo) can be left empty —
they're excluded from the analytical cohort per the PPT footnote.

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
