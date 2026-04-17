#!/usr/bin/env python3
"""build_world_map.py — Prepares assets/world-map.svg from OCHA's
"Times" base map (world_OCHA_times_oct_2023.svg), which already ships
with correct OCHA boundaries (dashed for disputed, admin-level
hierarchy, etc.).

The source file exports 248 country-shape polygons with anonymous IDs.
This script walks the country labels (embedded in the SVG as `<text>`
elements), matches each label to the polygon whose bounding box
contains the label's anchor, and writes `id="{ISO3}"` onto that
polygon. The dashboard's data-join then paints any subset of them from
the Google Sheet.

Runtime code is agnostic — it just queries `svg.querySelector("#ISO3")`.

Input:  data/map/world_OCHA_times_oct_2023.svg  (one-off provided by BDU)
Output: HL_dashboard_BDU/assets/world-map.svg
"""
from __future__ import annotations

import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


SRC_DEFAULT = Path("../data/map/world_OCHA_times_oct_2023.svg")
OUT_DEFAULT = Path("assets/world-map.svg")

SVG_NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG_NS)


# Country-name → ISO3, covering everything that might appear on a world
# map. Keys are normalised (lowercase, alphanumeric-only).
NAME_TO_ISO3 = {
    "afghanistan": "AFG", "burkinafaso": "BFA", "cameroon": "CMR",
    "centralafricanrepublic": "CAF", "chad": "TCD", "colombia": "COL",
    "democraticrepublicofthecongo": "COD", "drofthecongo": "COD",
    "drcongo": "COD", "drc": "COD", "democraticrepofthecongo": "COD",
    "eritrea": "ERI", "ethiopia": "ETH", "haiti": "HTI",
    "iraq": "IRQ", "lebanon": "LBN", "mali": "MLI",
    "mozambique": "MOZ", "myanmar": "MMR", "niger": "NER",
    "nigeria": "NGA", "occupiedpalestinianterritory": "PSE",
    "opt": "PSE", "palestine": "PSE", "stateofpalestine": "PSE",
    "pakistan": "PAK", "somalia": "SOM", "southsudan": "SSD",
    "sudan": "SDN",
    # The Times map labels Palestine as "West Bank" + "Gaza Strip".
    # Either maps to ISO3 PSE — the match that wins is whichever label
    # lies inside the Palestinian polygon.
    "westbank": "PSE", "gazastrip": "PSE",
    "syrianarabrepublic": "SYR", "syria": "SYR",
    "ukraine": "UKR",
    "venezuela": "VEN", "venezuelabolivarianrepublicof": "VEN",
    "yemen": "YEM", "zimbabwe": "ZWE",
    # Common extras for completeness (may or may not appear on the map)
    "algeria": "DZA", "angola": "AGO", "argentina": "ARG",
    "australia": "AUS", "bangladesh": "BGD", "brazil": "BRA",
    "canada": "CAN", "china": "CHN", "egypt": "EGY",
    "france": "FRA", "germany": "DEU", "ghana": "GHA",
    "india": "IND", "indonesia": "IDN", "iran": "IRN",
    "israel": "ISR", "italy": "ITA", "japan": "JPN",
    "jordan": "JOR", "kazakhstan": "KAZ", "kenya": "KEN",
    "liberia": "LBR", "libya": "LBY", "madagascar": "MDG",
    "mexico": "MEX", "morocco": "MAR", "namibia": "NAM",
    "nepal": "NPL", "peru": "PER", "philippines": "PHL",
    "russia": "RUS", "russianfederation": "RUS",
    "saudiarabia": "SAU", "senegal": "SEN", "southafrica": "ZAF",
    "spain": "ESP", "tanzania": "TZA", "unitedrepoftanzania": "TZA",
    "thailand": "THA", "tunisia": "TUN", "turkey": "TUR",
    "türkiye": "TUR", "uganda": "UGA",
    "unitedkingdom": "GBR", "uk": "GBR",
    "unitedstatesofamerica": "USA", "unitedstates": "USA", "usa": "USA",
    "zambia": "ZMB",
}


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def ns(tag: str) -> str:
    return tag.split("}", 1)[1] if "}" in tag else tag


def text_of(text_el: ET.Element) -> str:
    """Concatenate a <text>'s direct text and all its <tspan> children."""
    parts = []
    if text_el.text:
        parts.append(text_el.text)
    for sub in text_el.iter():
        if ns(sub.tag) == "tspan" and sub.text:
            parts.append(sub.text)
    return "".join(parts).strip()


def _parse_translate(tstr: str | None) -> tuple[float, float]:
    """Extract (tx, ty) from `transform="translate(x y)"` or `translate(x,y)`."""
    if not tstr:
        return 0.0, 0.0
    m = re.search(r"translate\s*\(\s*(-?\d+(?:\.\d+)?)[ ,]+(-?\d+(?:\.\d+)?)", tstr)
    if not m:
        # Single-arg translate(x) means ty=0
        m = re.search(r"translate\s*\(\s*(-?\d+(?:\.\d+)?)\s*\)", tstr)
        return (float(m.group(1)), 0.0) if m else (0.0, 0.0)
    return float(m.group(1)), float(m.group(2))


def label_anchor(text_el: ET.Element) -> tuple[float | None, float | None]:
    """Compute the rendered anchor of a <text> element.

    Illustrator exports routinely position labels via
    `transform="translate(x y)"` rather than x/y attributes. We sum
    translate offsets + the first explicit x,y we find to land close to
    the baseline of the first glyph.
    """
    tx, ty = _parse_translate(text_el.get("transform"))

    def _first_coord(v: str | None):
        if not v:
            return None
        m = re.search(r"-?\d+(?:\.\d+)?", v)
        return float(m.group()) if m else None

    x = _first_coord(text_el.get("x"))
    y = _first_coord(text_el.get("y"))
    for sub in text_el.iter():
        if x is not None and y is not None:
            break
        if ns(sub.tag) == "tspan":
            if x is None:
                x = _first_coord(sub.get("x"))
            if y is None:
                y = _first_coord(sub.get("y"))
    # Default local x/y to 0 when missing (they're usually set on tspans).
    if x is None: x = 0.0
    if y is None: y = 0.0
    return x + tx, y + ty


def parse_points(d: str | None, pts: str | None) -> list[tuple[float, float]]:
    """Extract the vertex list of a <path d> or <polygon points>."""
    if pts:
        toks = [float(n) for n in re.findall(r"-?\d+(?:\.\d+)?", pts)]
        return list(zip(toks[0::2], toks[1::2]))
    if d:
        toks = [float(n) for n in re.findall(r"-?\d+(?:\.\d+)?", d)]
        return list(zip(toks[0::2], toks[1::2]))
    return []


def bbox(pts: list[tuple[float, float]]) -> tuple[float, float, float, float] | None:
    if not pts:
        return None
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return (min(xs), min(ys), max(xs), max(ys))


def contains(box, x, y) -> bool:
    return box[0] <= x <= box[2] and box[1] <= y <= box[3]


def centroid(box) -> tuple[float, float]:
    return ((box[0] + box[2]) / 2, (box[1] + box[3]) / 2)


def build(src: Path, out: Path) -> int:
    if not src.exists():
        sys.stderr.write(f"ERROR: source SVG not found at {src}\n")
        return 2
    print(f"Reading {src}…")
    tree = ET.parse(src)
    root = tree.getroot()

    # ── Pass 1: find every country <text> and its anchor position ──
    labels: list[tuple[str, float, float]] = []
    for el in root.iter():
        if ns(el.tag) != "text":
            continue
        label = text_of(el).strip()
        if not label:
            continue
        iso = NAME_TO_ISO3.get(norm(label))
        if not iso:
            continue
        x, y = label_anchor(el)
        if x is None or y is None:
            continue
        labels.append((iso, x, y))

    print(f"  matched {len(labels)} labels to ISO3 codes "
          f"({len({l[0] for l in labels})} distinct countries)")
    if not labels:
        sys.stderr.write("ERROR: no labels recognised — check NAME_TO_ISO3.\n")
        return 3

    # ── Pass 2: collect every country-shape polygon/path with bbox ──
    shapes: list[tuple[ET.Element, tuple[float, float, float, float]]] = []
    for el in root.iter():
        tag = ns(el.tag)
        if tag not in ("path", "polygon"):
            continue
        pts = parse_points(el.get("d"), el.get("points"))
        if len(pts) < 3:
            continue
        box = bbox(pts)
        if not box:
            continue
        # Skip obviously non-country features — lines too thin to enclose
        # a label, decorative marks, or the whole-world clip rect.
        w = box[2] - box[0]
        h = box[3] - box[1]
        if w < 1 or h < 1:
            continue
        if w > 800 and h > 400:  # viewport-sized rect
            continue
        shapes.append((el, box))

    print(f"  {len(shapes)} candidate country shapes")

    # ── Pass 3: for each label, find the best enclosing shape ──
    # Prefer the SMALLEST shape whose bbox contains the label anchor —
    # large shapes are usually ocean / continental background rectangles
    # that enclose everything. We also bail out on shapes that are so
    # large they look continental rather than country-sized.
    assigned_by_iso: dict[str, ET.Element] = {}
    used_shapes: set[int] = set()

    for iso, lx, ly in labels:
        best = None
        best_area = float("inf")
        for el, box in shapes:
            if id(el) in used_shapes:
                continue
            if not contains(box, lx, ly):
                continue
            w = box[2] - box[0]
            h = box[3] - box[1]
            area = w * h
            # Skip giant "background" polygons — bigger than a continent's
            # typical extent in this 842×595 projection.
            if w > 300 or h > 250:
                continue
            if area < best_area:
                best_area = area
                best = el
        if best is not None and iso not in assigned_by_iso:
            assigned_by_iso[iso] = best
            used_shapes.add(id(best))
            best.set("id", iso)

    # ── Pass 4: fallback — for any label whose anchor didn't land
    # inside a shape (island nations, tight borders), pick the nearest
    # unused shape by centroid distance. ──
    for iso, lx, ly in labels:
        if iso in assigned_by_iso:
            continue
        best = None
        best_d = float("inf")
        for el, box in shapes:
            if id(el) in used_shapes:
                continue
            cx, cy = centroid(box)
            d = (cx - lx) ** 2 + (cy - ly) ** 2
            if d < best_d:
                best_d = d
                best = el
        if best is not None:
            assigned_by_iso[iso] = best
            used_shapes.add(id(best))
            best.set("id", iso)

    print(f"  assigned {len(assigned_by_iso)} ISO3 ids")
    missing = sorted({l[0] for l in labels} - assigned_by_iso.keys())
    if missing:
        print(f"  WARN: could not place: {missing}")

    out.parent.mkdir(parents=True, exist_ok=True)
    tree.write(out, encoding="utf-8", xml_declaration=True)
    print(f"Wrote {out} ({out.stat().st_size:,} B)")
    return 0


def main() -> int:
    import argparse
    ap = argparse.ArgumentParser(description=__doc__)
    here = Path(__file__).resolve().parent.parent
    ap.add_argument("--src", default=str(here / SRC_DEFAULT),
                    help="Path to the OCHA Times base SVG")
    ap.add_argument("--out", default=str(here / OUT_DEFAULT),
                    help="Path to the generated world-map.svg")
    args = ap.parse_args()
    return build(Path(args.src), Path(args.out))


if __name__ == "__main__":
    sys.exit(main())
