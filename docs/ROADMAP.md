# HL Dashboard — Roadmap & parked items

Stuff that's been discussed but not yet built. Ordered loosely by
priority. Each item lists where work would land (frontend / engine /
data model / UI / spec) so a future pass can scope it without
re-deriving everything from the conversation history.

---

## 1. Additive filters within a category  *(v3.2 candidate)*

**Today.** Each filter chip group is single-select. Picking `Grade · D2`
then `Grade · D1` swaps the value (D2 → D1) — you can't see both grades
at once. Same for Gender / Origin / Role / Agency.

**Want.** Multi-select within a category. Example: `Grade · D2 + D1`
shows leaders at *either* grade (logical OR within category).
Across categories the AND-combine semantics stay.

So the full filter would read as:

```
(grade ∈ {D2, D1}) AND (weog = Non-WEOG)
```

Picking `D2`, then `D1`, would add to the set. Clicking `D2` again
removes it. "Clear all" empties everything as today.

**Where the work lands**

| Layer | Change |
|---|---|
| `app/aggregate.js` | `matchesFilter()` clauses: when value is an array, pass if leader matches any element (OR). String values still pass (back-compat). |
| `app/render/filter-bar.js` | State model `filter[key]` becomes `string[]` instead of `string`. Dropdown menu items need checkbox affordance (selected vs not). `selectOption()` becomes toggle-into-set. The chip's display string becomes e.g. `Grade · D2, D1`. |
| `app/render/charts.js` | Click-to-filter on chart segments adds/removes from the array instead of swap-set. |
| URL hash | Encode arrays as comma-separated values: `#grade=D2,D1`. `readUrlFilter()` parses. URL stays human-readable. |
| Active-filter summary | Each selected value renders as its own `[D2 ×] [D1 ×]` pill instead of one combined chip — clearer affordance for removing individual values. |

**Open questions before building**

- Should the chip dropdown also offer a "Select all" / "Reset this category" link at the top?
- Should the chip itself show a count when many values are picked (e.g. `Grade · 2 selected`)? Probably yes when ≥ 3 to avoid the chip getting long.
- Touch / mobile: the dropdown stays open after a pick (so multi-pick is one drawer session)? Need an explicit "Done" tap-out or click-outside dismiss.

**Risk to call out:** combinatorial interactions can yield 0-leader filters quickly. The empty-state UX from v3.1 already handles this gracefully (`No leaders match` per chart) but worth re-testing once arrays compose.

---

## 2. Page 4 trend chart — click-to-highlight  *(Valijon request #5, parked)*

**Want.** Click a region label (or column segment) on Fig 4.2 → that
region's line stays full opacity, the others dim to ~30 %. Click again
to clear. Pure visual selection, **not connected to Page 3 filters**.

**Why parked.** Different mental model from the cohort cross-filter
work — see v2-feedback discussion. Smaller, self-contained job. Easy
to slot in any time without disturbing the Page-3 filter pipeline.

**Where the work lands**

| Layer | Change |
|---|---|
| `app/charts/chart-stacked-col.js` | Add a `highlightedKey` opt and per-segment click handler. When set, all non-matching segments + leader lines get `opacity: 0.3`. |
| `app/render/charts.js` | Local state for the trends charts (separate from `window.__HL_FILTER__`). Click handler toggles `highlightedKey`. |
| CSS | Trend-specific opacity transition (~200 ms) so the dim feels intentional. |

No filter-state changes, no aggregation engine changes, no URL state
(this is per-chart visual selection, not a cohort lens).

---

## 3. "Highlighted subset" framing on the origin chart  *(parked aesthetic improvement)*

**Today.** When you click "RC/HC" on the roles donut, the donut
collapses to one full-circle slice (16 leaders, 100 %). To swap or
clear from there, you need the chip × or the chip dropdown.

**Want (option).** The donut keeps all 4 slices visible but dims the
non-matching ones to ~30 % opacity. Clicking another slice swaps the
selection in place. Same for hbars.

**Why parked.** The "filter narrows" semantic is what Valijon's email
described, and the chip × is right there to clear. Re-rendering the
ORIGIN chart with the unfiltered cohort while filtering the OTHER three
adds complexity and a subtle inconsistency (origin chart shows full
cohort, neighbours show filtered). Worth doing only if user testing
flags the current behavior as confusing.

**Where the work would land**

| Layer | Change |
|---|---|
| `app/render/charts.js` | When the active filter's key matches a chart's dimension, pass UNFILTERED data + a `highlight` hint. Other charts use the filtered cohort as today. |
| Chart modules | Accept a `highlight` option that dims non-matching segments. |

---

## 4. Tab 9 enrichment — Valijon's remaining ask

See [`TAB9_ENRICHMENT.md`](TAB9_ENRICHMENT.md). Until done, filtered
Page-3 numbers are slightly partial.

Not a code task — pure data fill-in.

---

## 5. Sheet refresh of the existing pre-aggregated tabs

Once Valijon completes the Tab 9 enrichment, the pre-aggregated tabs
(`3. Leadership roles (donut)`, `4. Agency of origin (bar)`,
`5. Country of origin by grade`, `6. Grade and gender`) should be
re-checked against the engine's no-filter output. Anywhere they
disagree by more than rounding, either:

- the engine has a bug (unlikely — has been sanity-checked), or
- Valijon's curated numbers need updating in the master sheet.

A small script `scripts/sanity_aggregate.py` could automate this — run
the engine logic in Python against the same Tab 9 data and diff against
the four pre-aggregated tabs. Then Valijon updates whichever cells the
diff flags.

Probably do this once after Valijon's done, then occasionally as data
refreshes.

---

## 6. Possible v4 directions  *(brainstorming only)*

Things that aren't on anyone's spec yet but might be worth considering
later:

- **Comparison mode** — pin a snapshot view and overlay it against
  current. Lets the user see "what changed this month" without
  scrolling between releases.
- **Per-country drill-in** — click a country on the map → see that
  country's leader card + history.
- **Time-series of cohort composition** — extend the Page-4 trend
  pattern to other dimensions (e.g. % female by year, or % from
  non-WEOG by year).
- **Dashboard-as-data-product** — expose the engine's output as a
  small JSON API so other OCHA products can consume the cohort
  numbers without re-implementing the aggregation.

None of these are committed. List exists so we don't lose the threads.
