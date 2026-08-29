#!/usr/bin/env python3
"""Composition-family demo renderer.

Computes geometry from the YAML counts in 06-composition.md and writes
demos/composition.html. Not the library. Not a CSS mock.
"""
from __future__ import annotations

import math
import re
import sys
from html import escape as _html_esc
from pathlib import Path


def esc(s) -> str:
    return _html_esc(str(s))

OUT = Path(__file__).resolve().parent / "composition.html"

# Broadsheet tokens (match demos/place.html)
CREAM = "#F4EFE4"
PAPER = "#FBF7EE"
INK = "#2C2A26"
MUTED = "#6B655C"
RULE = "#C9C0B0"
GREEN = "#3F5C47"
GOLD = "#C9A227"
CLAY = "#C45C26"
PARK = "#7A8F4F"
RED = "#9B3A2F"
GRAY = "#6B7280"
FONT = '"Iowan Old Style", "Palatino Linotype", Palatino, "Times New Roman", serif'
SANS = '"Franklin Gothic Medium", "News Gothic", "Helvetica Neue", sans-serif'
# SVG attribute-safe (no nested quotes)
SVG_SANS = "Franklin Gothic Medium, News Gothic, Helvetica Neue, sans-serif"
SVG_SERIF = "Iowan Old Style, Palatino Linotype, Palatino, Times New Roman, serif"

CELL = 22
GAP = 2
STEP = CELL + GAP  # 24 — newspaper-countable; library default stays 12
WAFFLE_R = 6
BEESWARM_R = 6
BEESWARM_MIN_DIST = 13.0

# Connected-dot / scorecard shared scale (nonzero domain 2..152)
CD_X0 = 248.0
CD_W = 620.0
CD_DMIN = 2.0
CD_DMAX = 152.0
CD_R = 6.0


def cd_x(v: float) -> float:
    return CD_X0 + (float(v) - CD_DMIN) / (CD_DMAX - CD_DMIN) * CD_W


# ---------------------------------------------------------------------------
# Unit formatter (chrome locked output)
# ---------------------------------------------------------------------------

def format_value(value, spec="count") -> str:
    """Chrome §7. compact usd: k < 1e6, no k under 1000."""
    if isinstance(spec, dict):
        unit = spec.get("unit", "count")
        compact = spec.get("compact", unit in ("usd", "count"))
        digits = spec.get("digits", 1 if compact else 0)
    else:
        unit = spec or "count"
        compact = unit in ("usd", "count")
        digits = 1 if compact else 0

    if value is None:
        return "n/a"
    try:
        v = float(value)
    except (TypeError, ValueError):
        return str(value)

    sign = "-" if v < 0 else ""
    av = abs(v)

    def compact_num(n: float, letter: str) -> str:
        s = f"{n:.{digits}f}".rstrip("0").rstrip(".")
        return f"{s}{letter}"

    if unit == "usd":
        if not compact:
            return f"{sign}${av:,.0f}"
        if av >= 1e9:
            body = compact_num(av / 1e9, "B")
        elif av >= 1e6:
            body = compact_num(av / 1e6, "M")
        elif av >= 1000:  # k threshold; 469 stays $469
            body = compact_num(av / 1e3, "k")
        else:
            body = compact_num(av, "")
        return f"{sign}${body}"

    if unit == "percent":
        s = f"{av:.{digits}f}".rstrip("0").rstrip(".")
        return f"{sign}{s}%"

    # count
    if compact and av >= 1e9:
        return f"{sign}{compact_num(av / 1e9, 'B')}"
    if compact and av >= 1e6:
        return f"{sign}{compact_num(av / 1e6, 'M')}"
    if compact and av >= 1000:
        return f"{sign}{compact_num(av / 1e3, 'k')}"
    if av == int(av):
        return f"{sign}{int(av)}"
    return f"{sign}{av}"


def tbd_or_count(value: float, unit: str = "count") -> str:
    """Composition convention: 0 TBD on scorecard/connected-dot → n/a."""
    if value == 0:
        return "n/a"
    return format_value(value, unit)


# ---------------------------------------------------------------------------
# SVG helpers
# ---------------------------------------------------------------------------

def svg_wrap(w: float, h: float, title: str, alt: str, body: str, extra_class: str = "") -> str:
    cls = f' class="{extra_class}"' if extra_class else ""
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" '
        f'role="img"{cls} width="{w:.0f}" height="{h:.0f}">\n'
        f"<title>{esc(title)}</title>\n"
        f"<desc>{esc(alt)}</desc>\n"
        f"{body}\n</svg>"
    )


def svg_text(x, y, s, *, size=12, anchor="start", fill=INK, weight="normal", family=None) -> str:
    fam = family
    if fam in (SANS, SVG_SANS):
        fam = SVG_SANS
    elif fam in (FONT, SVG_SERIF):
        fam = SVG_SERIF
    elif fam and ('"' in fam or "'" in fam):
        fam = fam.replace('"', "").replace("'", "")
    ff = f" font-family='{fam}'" if fam else ""
    return (
        f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" text-anchor="{anchor}" '
        f'fill="{fill}" font-weight="{weight}"{ff}>{esc(s)}</text>'
    )


# ---------------------------------------------------------------------------
# Waffle
# ---------------------------------------------------------------------------

PALETTE = [GREEN, CLAY, PARK, GOLD, INK, MUTED]


def waffle_cells(categories: list[dict], columns: int = 10) -> list[dict]:
    """Return list of {col, row, x, y, color, cat_id} — leftover omitted."""
    cells = []
    i = 0
    for ci, cat in enumerate(categories):
        n = int(cat["value"])
        color = cat.get("color") or PALETTE[ci % len(PALETTE)]
        for _ in range(n):
            col = i % columns
            row = i // columns
            cells.append(
                {
                    "col": col,
                    "row": row,
                    "x": col * STEP,
                    "y": row * STEP,
                    "color": color,
                    "cat_id": cat["id"],
                }
            )
            i += 1
    return cells


def render_waffle(spec: dict) -> tuple[str, list[dict]]:
    cols = int(spec.get("columns") or 10)
    cats = spec["categories"]
    cells = waffle_cells(cats, cols)
    n = len(cells)
    rows = (max(c["row"] for c in cells) + 1) if cells else 0
    pad = 4
    w = cols * STEP + pad * 2
    h = rows * STEP + pad * 2
    parts = []
    for c in cells:
        parts.append(
            f'<rect class="cell" x="{c["x"] + pad}" y="{c["y"] + pad}" '
            f'width="{CELL}" height="{CELL}" fill="{c["color"]}" stroke="{INK}" stroke-width="0.4"/>'
        )
    svg = svg_wrap(w, h, spec["title"], spec["alt"], "\n".join(parts), "waffle")
    return svg, cells


def resolve_legend(spec: dict) -> list[dict]:
    """legend: true → auto from categories; array → items; LegendSpec.items."""
    legend = spec.get("legend")
    cats = spec.get("categories") or []
    if legend is False:
        return []
    items: list[dict] = []
    if legend is True or legend is None:
        for i, cat in enumerate(cats):
            items.append(
                {
                    "label": ("~ " if cat.get("approximate") else "") + cat["label"],
                    "color": cat.get("color") or PALETTE[i % len(PALETTE)],
                }
            )
        return items
    if isinstance(legend, list):
        raw = legend
    elif isinstance(legend, dict):
        raw = legend.get("items") or []
    else:
        raw = []
    color_by_label = {c["label"]: c.get("color") for c in cats}
    for i, it in enumerate(raw):
        label = it.get("label", "")
        color = it.get("color")
        if not color:
            # match category by stem
            color = PALETTE[i % len(PALETTE)]
            for c in cats:
                if c["label"].lower() in label.lower() or label.lower() in c["label"].lower():
                    color = c.get("color") or PALETTE[cats.index(c) % len(PALETTE)]
                    break
        items.append({"label": label, "color": color})
    return items


def legend_html(items: list[dict]) -> str:
    if not items:
        return ""
    bits = ['<div class="legend" data-legend>']
    for it in items:
        color = it.get("color") or INK
        bits.append(
            f'<div class="item"><span class="swatch" style="background:{esc(color)}"></span> '
            f'{esc(it["label"])}</div>'
        )
    bits.append("</div>")
    return "\n".join(bits)


def data_table_html(spec: dict, visually_hidden: bool = True) -> str:
    dt = spec.get("dataTable") or {}
    cols = dt.get("columns") or []
    records = dt.get("records") or []
    unit = spec.get("unit") or "count"
    cls = ' class="visually-hidden"' if visually_hidden else ' class="fallback-table"'
    thead = "".join(f"<th>{esc(c)}</th>" for c in cols)
    body_rows = []
    for rec in records:
        tds = []
        for i, val in enumerate(rec):
            if isinstance(val, (int, float)) and not isinstance(val, bool):
                tds.append(f"<td>{esc(format_value(val, unit))}</td>")
            else:
                tds.append(f"<td>{esc(val)}</td>")
        body_rows.append("<tr>" + "".join(tds) + "</tr>")
    cap = esc(dt.get("summary") or spec.get("title") or "Data table")
    return (
        f"<table{cls}><caption>{cap}</caption>"
        f"<thead><tr>{thead}</tr></thead>"
        f"<tbody>{''.join(body_rows)}</tbody></table>"
    )


def source_html(spec: dict) -> str:
    src = spec.get("source")
    if not src:
        return ""
    if isinstance(src, list):
        parts = []
        for s in src:
            label = esc(s.get("label") or "")
            href = s.get("href")
            if href:
                parts.append(f'<a href="{esc(href)}">{label}</a>')
            else:
                parts.append(label)
        return f'<p class="source">Source: {" · ".join(parts)}</p>'
    label = esc(src.get("label") or "")
    href = src.get("href")
    if href:
        return f'<p class="source">Source: <a href="{esc(href)}">{label}</a></p>'
    return f'<p class="source">Source: {label}</p>'


def figure(
    type_name: str,
    spec: dict,
    graphic: str,
    *,
    legend_items=None,
    footnote: str | None = None,
    extra: str = "",
    section_id: str | None = None,
    section_class: str = "figure",
) -> str:
    sid = section_id or type_name
    legend = ""
    if legend_items is None:
        legend_items = resolve_legend(spec) if spec.get("legend") not in (None, False) else []
    if legend_items:
        legend = legend_html(legend_items)
    fn = ""
    if footnote:
        fn = f'<p class="footnote">{footnote}</p>'
    dt = ""
    if spec.get("dataTable"):
        dt = data_table_html(spec, visually_hidden=True)
    return f"""<section class="{section_class}" id="{esc(sid)}" data-type="{esc(type_name)}">
  <p class="type">{esc(type_name)}</p>
  <h2>{esc(spec.get("title") or type_name)}</h2>
  <div class="frame">
    {graphic}
    {legend}
  </div>
  <p class="caption">{esc(spec.get("caption") or "")}</p>
  {source_html(spec)}
  {fn}
  {extra}
  {dt}
</section>"""


# ---------------------------------------------------------------------------
# Isotype stand-in marks (pack owned by EP; files can wait)
# ---------------------------------------------------------------------------

CIVIC_DIR = Path("/workspace/diagrams-backlog/icons/civic")

# Locked isotype units — never waffle-square these.
LOCKED_ISOTYPE = {
    "civic:bed",
    "civic:camera",
    "civic:demolition",
    "civic:lot",
    "civic:parcel",
}

def _file_glyph(slug: str, color: str) -> str | None:
    """Inline EP file if present: icons/civic/<slug>.svg (no civic- prefix)."""
    name = slug.split(":", 1)[-1]
    fp = CIVIC_DIR / f"{name}.svg"
    if not fp.is_file():
        return None
    raw = fp.read_text(encoding="utf-8")
    # take inner markup; scale into 12x12
    inner = raw
    if "<svg" in inner:
        inner = inner[inner.find(">") + 1 :]
        inner = inner.rsplit("</svg>", 1)[0]
    return f'<g class="civic-file" fill="{color}">{inner}</g>'


def icon_mark(slug: str, color: str) -> str:
    """Unit mark for a locked civic: slug. File if present, else path stand-in.
    Never a waffle square for LOCKED_ISOTYPE."""
    filed = _file_glyph(slug, color)
    if filed:
        return filed
    if slug == "civic:housing":
        d = "M1.5 6.2 L6 1.8 L10.5 6.2 V10.5 H7.4 V7.4 H4.6 V10.5 H1.5 Z"
        return f'<path d="{d}" fill="{color}" stroke="{INK}" stroke-width="0.6"/>'
    if slug == "civic:bed":
        d = "M1.2 8.2 H10.8 V10.2 H1.2 Z M1.2 4.6 H3.6 V8.2 H1.2 Z M3.6 6.2 H10.8 V8.2 H3.6 Z"
        return f'<path d="{d}" fill="{color}" stroke="{INK}" stroke-width="0.55"/>'
    if slug == "civic:camera":
        return (
            f'<rect x="1.4" y="3.6" width="9.2" height="6.2" rx="1" fill="{color}" stroke="{INK}" stroke-width="0.55"/>'
            f'<circle cx="6" cy="6.7" r="1.8" fill="{PAPER}" stroke="{INK}" stroke-width="0.55"/>'
        )
    if slug == "civic:body-camera":
        return (
            f'<rect x="2.2" y="2.8" width="7.6" height="6.8" rx="1.2" fill="{color}" stroke="{INK}" stroke-width="0.55"/>'
            f'<circle cx="6" cy="6.2" r="1.6" fill="{PAPER}" stroke="{INK}" stroke-width="0.55"/>'
        )
    if slug == "civic:demolition":
        return (
            f'<path d="M1.8 6.4 L6 2.2 L10.2 6.4 V10.2 H1.8 Z" fill="{color}" stroke="{INK}" stroke-width="0.55"/>'
            f'<line x1="2.2" y1="2.4" x2="10" y2="10" stroke="{RED}" stroke-width="1.1"/>'
        )
    if slug == "civic:lot":
        # vacant lot: open plat, not a house
        return (
            f'<rect x="1.4" y="1.4" width="9.2" height="9.2" fill="none" stroke="{color}" stroke-width="1.1"/>'
            f'<circle cx="1.4" cy="1.4" r="0.9" fill="{INK}"/>'
            f'<circle cx="10.6" cy="1.4" r="0.9" fill="{INK}"/>'
            f'<circle cx="1.4" cy="10.6" r="0.9" fill="{INK}"/>'
            f'<circle cx="10.6" cy="10.6" r="0.9" fill="{INK}"/>'
        )
    if slug == "civic:parcel":
        # map parcel: filled plat with a tick, not a house, not a vacant lot
        return (
            f'<rect x="1.6" y="1.6" width="8.8" height="8.8" fill="{color}" stroke="{INK}" stroke-width="0.55"/>'
            f'<line x1="1.6" y1="6" x2="10.4" y2="6" stroke="{INK}" stroke-width="0.5"/>'
            f'<line x1="6" y1="1.6" x2="6" y2="10.4" stroke="{INK}" stroke-width="0.5"/>'
        )
    if slug in LOCKED_ISOTYPE:
        raise RuntimeError(f"locked isotype slug {slug} must not waffle-square")
    # waffle-square fallback only for unknown slugs
    return f'<rect x="1" y="1" width="10" height="10" fill="{color}" stroke="{INK}" stroke-width="0.5"/>'


STARTER = {
    "civic:courthouse",
    "civic:sheriff",
    "civic:roads",
    "civic:fire",
    "civic:school",
    "civic:housing",
}


def render_isotype(spec: dict) -> tuple[str, int, str]:
    cats = spec["categories"]
    default_icon = spec.get("icon") or "civic:parcel"
    scale = (spec.get("scale") or {}).get("unitsPerIcon") or 1
    columns = 10
    marks = []
    i = 0
    used_slug = default_icon
    for ci, cat in enumerate(cats):
        slug = cat.get("icon") or default_icon
        used_slug = slug
        color = cat.get("color") or PALETTE[ci % len(PALETTE)]
        n_icons = math.ceil(cat["value"] / scale)
        for _ in range(n_icons):
            col = i % columns
            row = i // columns
            x = col * STEP
            y = row * STEP
            marks.append((x, y, slug, color))
            i += 1
    n = len(marks)
    rows = (max(m[1] for m in marks) // STEP + 1) if marks else 0
    pad = 4
    w = columns * STEP + pad * 2
    h = rows * STEP + pad * 2
    parts = []
    for x, y, slug, color in marks:
        inner = icon_mark(slug, color)
        sc = CELL / 12.0
        parts.append(
            f'<g class="unit" data-icon="{esc(slug)}" '
            f'transform="translate({x + pad},{y + pad}) scale({sc:.4f})">{inner}</g>'
        )
    svg = svg_wrap(w, h, spec["title"], spec["alt"], "\n".join(parts), "isotype")
    return svg, n, used_slug


# ---------------------------------------------------------------------------
# Small multiples — grid only; inner delta is Money so do not draw a delta
# ---------------------------------------------------------------------------

def render_small_multiples(spec: dict) -> str:
    panels = spec["panels"]
    columns = int(spec.get("columns") or min(len(panels), 3))
    n = len(panels)
    rows = math.ceil(n / columns)
    # Fill the 980px column: five panels, readable type, no empty right gutter.
    pw, ph, gap = 168.0, 128.0, 14.0
    pad = 10.0
    w = pad * 2 + columns * pw + (columns - 1) * gap
    h = pad * 2 + rows * ph + (rows - 1) * gap + 8
    parts = []
    for i, p in enumerate(panels):
        col = i % columns
        row = i // columns
        x = pad + col * (pw + gap)
        y = pad + row * (ph + gap)
        parts.append(
            f'<g class="panel" data-panel="{esc(p["id"])}">'
            f'<rect x="{x:.1f}" y="{y:.1f}" width="{pw:.1f}" height="{ph:.1f}" '
            f'fill="{PAPER}" stroke="{INK}" stroke-width="1.1"/>'
            f'{svg_text(x + pw / 2, y + 40, p["label"], size=14, anchor="middle", weight="bold")}'
            f'{svg_text(x + pw / 2, y + 72, "Held", size=16, anchor="middle", fill=CLAY)}'
            f'{svg_text(x + pw / 2, y + 100, "n/a", size=13, anchor="middle", fill=MUTED)}'
            f"</g>"
        )
    return svg_wrap(w, h, spec["title"], spec["alt"], "\n".join(parts), "small-multiples")


# ---------------------------------------------------------------------------
# Scorecard
# ---------------------------------------------------------------------------

def scorecard_status(row: dict) -> str:
    promised = row["promised"]["value"]
    delivered = row["delivered"]["value"]
    kept = row.get("kept")
    if promised == 0:
        return "unknown"
    if delivered >= promised:
        return "met"
    if delivered < promised and kept:
        return "kept-short"
    return "clawed-back"


def chi_two_dot_svg() -> str:
    """Tiny two-dot on CHI using the same scale as connected-dot."""
    x1, x2 = cd_x(130), cd_x(54)
    # compress into a 120-wide inset that preserves length ratio
    # Use the SAME x values but shifted so they fit a small cell: we keep
    # the actual |x54-x130| by using a mini viewBox of the shared domain.
    # The user asked: same scale as connected-dot. So use the real cd_x
    # coordinates in a cropped svg showing just the CHI span.
    y = 10
    xmin = min(x1, x2) - 10
    xmax = max(x1, x2) + 10
    w = xmax - xmin
    h = 20
    length = abs(x2 - x1)
    return (
        f'<svg class="inline-dot" viewBox="{xmin:.2f} 0 {w:.2f} {h}" width="{w:.0f}" height="{h}" '
        f'role="img">'
        f"<title>CHI 130 to 54</title>"
        f'<line class="connector" x1="{x1:.2f}" y1="{y}" x2="{x2:.2f}" y2="{y}" '
        f'stroke="{RED}" stroke-width="2"/>'
        f'<circle cx="{x1:.2f}" cy="{y}" r="4" fill="{PAPER}" stroke="{RED}" stroke-width="1.4"/>'
        f'<circle cx="{x2:.2f}" cy="{y}" r="4" fill="{RED}" stroke="{INK}" stroke-width="0.8"/>'
        f"</svg>"
    )


def render_scorecard_table(spec: dict) -> str:
    rows_html = []
    for row in spec["rows"]:
        status = scorecard_status(row)
        promised_v = row["promised"]["value"]
        delivered_v = row["delivered"]["value"]
        promised_s = tbd_or_count(promised_v)
        delivered_s = format_value(delivered_v, "count")
        err = row.get("reportedError")
        if err:
            delivered_s = (
                f'{delivered_s} <s class="struck">{esc(format_value(err, "count"))}</s>'
            )
        if promised_v == 0:
            gap_s = "—"
        else:
            gap = delivered_v - promised_v
            gap_s = esc(format_value(gap, "count"))
        rows_html.append(
            f'<tr data-row="{esc(row["id"])}">'
            f"<td>{esc(row['label'])}</td>"
            f"<td>{promised_s}</td>"
            f"<td>{delivered_s}</td>"
            f"<td>{gap_s}</td>"
            f'<td><span class="status {esc(status)}">{esc(status)}</span></td>'
            f"</tr>"
        )
    return (
        '<table class="scorecard">'
        "<thead><tr><th>Entity</th><th>Promised</th><th>Delivered</th><th>Gap</th><th>Status</th></tr></thead>"
        f"<tbody>{''.join(rows_html)}</tbody></table>"
    )


# ---------------------------------------------------------------------------
# Beeswarm — real packing
# ---------------------------------------------------------------------------

def pack_beeswarm(items: list[dict], x_of, r=BEESWARM_R, min_dist=BEESWARM_MIN_DIST, step=0.5):
    placed = []  # (item, x, y)
    for it in items:
        x = float(x_of(it["value"]))
        offset = 0.0
        sign = 1
        y = 0.0
        while True:
            y = sign * offset
            ok = all(math.hypot(x - px, y - py) >= min_dist for _, px, py in placed)
            if ok:
                break
            if sign == 1:
                sign = -1
            else:
                sign = 1
                offset += step
        placed.append((it, x, y))
    return placed


BEESWARM_PAD_X = 56.0
BEESWARM_PLOT_W = 840.0
BEESWARM_YMID = 168.0
BEESWARM_H = 320.0
BEESWARM_DMIN = 0.0
BEESWARM_DMAX = 520000.0  # buildings is the max


def beeswarm_x(v: float) -> float:
    return BEESWARM_PAD_X + (float(v) - BEESWARM_DMIN) / (BEESWARM_DMAX - BEESWARM_DMIN) * BEESWARM_PLOT_W


def render_beeswarm(spec: dict) -> tuple[str, list[tuple]]:
    items = spec["items"]
    packed = pack_beeswarm(items, beeswarm_x)
    w = BEESWARM_PAD_X * 2 + BEESWARM_PLOT_W
    h = BEESWARM_H
    axis_y = BEESWARM_YMID + 84
    parts = []
    # axis
    x0 = beeswarm_x(0)
    x1 = beeswarm_x(BEESWARM_DMAX)
    parts.append(
        f'<line x1="{x0:.1f}" y1="{axis_y:.1f}" x2="{x1:.1f}" y2="{axis_y:.1f}" '
        f'stroke="{INK}" stroke-width="1.1"/>'
    )
    # skip $520k tick — it kisses $500k on a linear scale
    ticks = [0, 100000, 250000, 500000]
    for t in ticks:
        tx = beeswarm_x(t)
        parts.append(
            f'<line x1="{tx:.1f}" y1="{axis_y:.1f}" x2="{tx:.1f}" y2="{axis_y + 5:.1f}" '
            f'stroke="{INK}" stroke-width="1"/>'
        )
        parts.append(svg_text(tx, axis_y + 20, format_value(t, "usd"), size=11, anchor="middle", fill=MUTED, family=SANS))

    samples = []
    for it, x, y in packed:
        cy = BEESWARM_YMID + y
        highlight_ids = {"clothing", "seized"}
        fill = CLAY if it["id"] in highlight_ids else GREEN
        parts.append(
            f'<circle class="bee" data-id="{esc(it["id"])}" data-label="{esc(it["label"])}" '
            f'cx="{x:.2f}" cy="{cy:.2f}" r="{BEESWARM_R}" fill="{fill}" stroke="{INK}" stroke-width="0.9"/>'
        )
        samples.append((it["label"], x, cy))

    # annotations as real <a>, labels OFF the dots, with short leaders
    for ann in spec.get("annotations") or []:
        ax = beeswarm_x(ann["at"]["x"])
        nearest = min(packed, key=lambda p: abs(p[1] - ax))
        cy = BEESWARM_YMID + nearest[2]
        href = ann.get("href") or ""
        text = ann.get("text") or ""
        atx = float(ann["at"]["x"])
        if atx < 50000:
            # clothing: crushed left — label to the RIGHT of the dot
            tx, ty, anchor = ax + 18, cy - 72, "start"
            x2, y2 = tx + 2, ty + 3
        else:
            # seized: sit LEFT of the $502k/$520k cluster
            tx, ty, anchor = ax - 16, cy - 72, "end"
            x2, y2 = tx - 2, ty + 3
        parts.append(
            f'<line x1="{ax:.1f}" y1="{cy - BEESWARM_R - 2:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" '
            f'stroke="{INK}" stroke-width="0.8"/>'
        )
        text_el = svg_text(tx, ty, text, size=13, anchor=anchor, fill=GREEN, family=SVG_SANS)
        if href:
            # svg_text has no underline; wrap and add decoration
            text_el = text_el.replace("<text ", '<text text-decoration="underline" ', 1)
            parts.append(f'<a href="{esc(href)}">{text_el}</a>')
        else:
            parts.append(text_el)

    svg = svg_wrap(w, h, spec["title"], spec["alt"], "\n".join(parts), "beeswarm")
    return svg, packed, samples


# ---------------------------------------------------------------------------
# Connected-dot
# ---------------------------------------------------------------------------

def render_connected_dot(spec: dict) -> tuple[str, dict]:
    rows = spec["rows"]
    row_h = 66.0
    pad_t = 36.0
    pad_b = 56.0
    w = CD_X0 + CD_W + 48
    h = pad_t + len(rows) * row_h + pad_b
    parts = []
    # axis at bottom
    axis_y = pad_t + len(rows) * row_h + 8
    parts.append(
        f'<line x1="{cd_x(CD_DMIN):.1f}" y1="{axis_y:.1f}" x2="{cd_x(CD_DMAX):.1f}" y2="{axis_y:.1f}" '
        f'stroke="{INK}" stroke-width="1"/>'
    )
    # drop 54 — it kisses 62; CHI row already labels 54
    for tick in (2, 62, 130, 152):
        tx = cd_x(tick)
        parts.append(
            f'<line x1="{tx:.1f}" y1="{axis_y:.1f}" x2="{tx:.1f}" y2="{axis_y + 4:.1f}" stroke="{INK}"/>'
        )
        parts.append(svg_text(tx, axis_y + 18, format_value(tick, "count"), size=12, anchor="middle", fill=MUTED, family=SANS))

    metrics = {}
    for i, row in enumerate(rows):
        y = pad_t + i * row_h + 16
        rid = row["id"]
        fv = row["from"]["value"]
        tv = row["to"]["value"]
        parts.append(f'<g class="cd-row" id="cd-{esc(rid)}" data-row="{esc(rid)}">')
        parts.append(svg_text(12, y + 4, row["label"], size=14, fill=INK))
        if fv == 0:
            # TBD: no connector, only to-dot + n/a
            tx = cd_x(tv)
            parts.append(
                f'<circle class="to" cx="{tx:.2f}" cy="{y:.1f}" r="{CD_R}" fill="{GREEN}" '
                f'stroke="{INK}" stroke-width="0.9"/>'
            )
            parts.append(svg_text(tx, y - 18, format_value(tv, "count"), size=13, anchor="middle", fill=INK, family=SANS))
            # TBD lives under the entity name, not next to the dot (avoids kissing the axis tick)
            parts.append(svg_text(12, y + 20, "promised n/a", size=11, fill=MUTED, family=SANS))
            metrics[rid] = {"connectors": 0, "length": 0.0}
        else:
            x1, x2 = cd_x(fv), cd_x(tv)
            length = abs(x2 - x1)
            color = row.get("color") or (RED if tv < fv else PARK)
            parts.append(
                f'<line class="connector" x1="{x1}" y1="{y:.1f}" x2="{x2}" y2="{y:.1f}" '
                f'stroke="{color}" stroke-width="2.2"/>'
            )
            parts.append(
                f'<circle class="from" cx="{x1:.4f}" cy="{y:.1f}" r="{CD_R}" fill="{PAPER}" '
                f'stroke="{color}" stroke-width="1.5"/>'
            )
            parts.append(
                f'<circle class="to" cx="{x2:.4f}" cy="{y:.1f}" r="{CD_R}" fill="{color}" '
                f'stroke="{INK}" stroke-width="0.8"/>'
            )
            parts.append(svg_text(x1, y - 18, format_value(fv, "count"), size=13, anchor="middle", fill=MUTED, family=SANS))
            parts.append(svg_text(x2, y - 18, format_value(tv, "count"), size=13, anchor="middle", fill=INK, family=SANS))
            metrics[rid] = {"connectors": 1, "length": length, "x1": x1, "x2": x2}
        parts.append("</g>")

    svg = svg_wrap(w, h, spec["title"], spec["alt"], "\n".join(parts), "connected-dot")
    return svg, metrics


# ---------------------------------------------------------------------------
# Data-table type (HTML), category-mix table, per-body table
# ---------------------------------------------------------------------------

def render_data_table_type(spec: dict) -> str:
    cols = spec["columns"]
    rows = list(spec["rows"])
    sort = spec.get("sort") or {}
    col_id = sort.get("column")
    direction = sort.get("direction") or "asc"
    if col_id:
        rows.sort(key=lambda r: r.get(col_id) or 0, reverse=(direction == "desc"))
    # bar domain
    bar_col = next((c for c in cols if c.get("encode") == "bar"), None)
    max_v = 1.0
    if bar_col:
        vals = [r[bar_col["id"]] for r in rows if isinstance(r.get(bar_col["id"]), (int, float))]
        max_v = max(vals) if vals else 1.0
    thead = "".join(f"<th>{esc(c['label'])}</th>" for c in cols)
    body = []
    for r in rows:
        tds = []
        for c in cols:
            val = r.get(c["id"])
            encode = c.get("encode") or "text"
            unit = c.get("unit") or spec.get("unit") or "count"
            if encode == "bar" and isinstance(val, (int, float)):
                bw = (val / max_v) * 120.0
                label = format_value(val, unit)
                tds.append(
                    f'<td class="bar-cell"><span class="num">{esc(label)}</span>'
                    f'<svg class="cell-bar" width="120" height="10" aria-hidden="true">'
                    f'<rect width="{bw:.2f}" height="10" fill="{GREEN}"/>'
                    f"</svg></td>"
                )
            elif isinstance(val, (int, float)) and c.get("unit"):
                tds.append(f"<td>{esc(format_value(val, unit))}</td>")
            else:
                tds.append(f"<td>{esc(val)}</td>")
        body.append("<tr>" + "".join(tds) + "</tr>")
    note = ""
    if bar_col:
        note = '<p class="note">Bar in the amount cell is a cell encoding. Money owns bar.</p>'
    return (
        f'<table class="data-table"><thead><tr>{thead}</tr></thead>'
        f"<tbody>{''.join(body)}</tbody></table>{note}"
    )


def render_held_table() -> str:
    depts = ["Sheriff", "JJC", "Weights & measures", "Tower", "Salaries"]
    rows = "".join(f"<tr><td>{esc(d)}</td><td>Held</td></tr>" for d in depts)
    return (
        '<table class="data-table">'
        "<thead><tr><th>Department</th><th>Status</th></tr></thead>"
        f"<tbody>{rows}</tbody></table>"
    )


def render_category_mix_table() -> str:
    # Real month × kind counts. NO stacked-bar SVG.
    header = ["Month", "MONEY", "RULES", "PROPERTY", "DEFERRAL", "FRICTION", "n"]
    data = [
        ("2026-03", 1, 2, 2, 2, 1, 8),
        ("2026-04", 3, 1, 2, 1, 1, 8),
        ("2026-05", 1, 1, 1, 0, 1, 4),
        ("2026-06", 1, 1, 1, 1, 1, 5),
        ("2026-07", 6, 0, 1, 1, 2, 10),
        ("2026-08", 26, 2, 6, 9, 0, 43),
    ]
    thead = "".join(f"<th>{esc(h)}</th>" for h in header)
    body = []
    for row in data:
        body.append("<tr>" + "".join(f"<td>{esc(c)}</td>" for c in row) + "</tr>")
    note = (
        '<p class="note">Money stacked-bar. Alias category-mix. '
        "FLAGGED is overlay 23/78, not a stack.</p>"
    )
    return (
        f'<table class="data-table mix"><thead><tr>{thead}</tr></thead>'
        f"<tbody>{''.join(body)}</tbody></table>{note}"
    )


def render_per_body_table() -> str:
    rows = [
        ("City Council", 43),
        ("budget committee", 16),
        ("Commissioners", 10),
        ("County Council", 8),
        ("BZA", 1),
    ]
    body = "".join(
        f"<tr><td>{esc(l)}</td><td>{esc(format_value(v, 'count'))}</td></tr>" for l, v in rows
    )
    note = '<p class="note">Money bar. Alias per-body-count.</p>'
    return (
        '<table class="data-table">'
        "<thead><tr><th>Body</th><th>Highlights</th></tr></thead>"
        f"<tbody>{body}</tbody></table>{note}"
    )


# ---------------------------------------------------------------------------
# Specs (YAML counts from 06-composition.md)
# ---------------------------------------------------------------------------

WAFFLE_PARCELS = {
    "type": "waffle",
    "title": "Unbilled conservancy parcels",
    "mode": "n",
    "unit": "count",
    "caption": "A years-old billing glitch let about 84 conservancy parcels skip the tax; no back taxes will be collected.",
    "source": {
        "label": "County commissioners, Aug 4",
        "href": "https://vigoledger.org/h/2026-08-04-vigo-county-commissioners-conservancy-tax-correction",
    },
    "legend": True,
    "alt": "Grid of 84 cells, one per unbilled conservancy parcel.",
    "dataTable": {"columns": ["Category", "Count"], "records": [["Unbilled", 84]]},
    "categories": [{"id": "unbilled", "label": "Unbilled", "value": 84, "approximate": True, "color": GREEN}],
}

WAFFLE_BEDS = {
    "type": "waffle",
    "title": "Shelter beds asked at the fairgrounds",
    "mode": "n",
    "unit": "count",
    "caption": "A trustee asked council to approve 100 homeless shelter beds at the fairgrounds with no city money, and got no response on the record.",
    "source": {
        "label": "City council, Jun 4",
        "href": "https://vigoledger.org/h/2026-06-04-terre-haute-city-council-homeless-shelter-fairgrounds-proposal",
    },
    "legend": True,
    "alt": "10 by 10 grid of 100 shelter beds.",
    "dataTable": {"columns": ["Category", "Count"], "records": [["Shelter beds", 100]]},
    "categories": [{"id": "beds", "label": "Shelter beds", "value": 100, "color": CLAY}],
}

WAFFLE_DEMOS = {
    "type": "waffle",
    "title": "Houses taken down this spring",
    "mode": "n",
    "columns": 5,
    "unit": "count",
    "caption": "The city planned about ten more demolitions in May, on top of five already finished in April.",
    "source": {
        "label": "City council, May 7",
        "href": "https://vigoledger.org/h/2026-05-07-terre-haute-city-council-blight-demolitions",
    },
    "legend": [
        {"label": "May (about)", "color": CLAY},
        {"label": "April (completed)", "color": MUTED},
    ],
    "alt": "About 10 May demolitions and 5 completed in April.",
    "dataTable": {
        "columns": ["Category", "Count"],
        "records": [["May (about)", 10], ["April (completed)", 5]],
    },
    "categories": [
        {"id": "may", "label": "May", "value": 10, "approximate": True, "color": CLAY},
        {"id": "april", "label": "April completed", "value": 5, "color": MUTED},
    ],
}

WAFFLE_CAMERAS = {
    "type": "waffle",
    "title": "Flock cameras already in place",
    "mode": "n",
    "unit": "count",
    "caption": "Thirty Flock license-plate cameras have been in place since 2024.",
    "source": {
        "label": "City council, Jun 11",
        "href": "https://vigoledger.org/h/2026-06-11-terre-haute-city-council-flock-camera-privacy-policy",
    },
    "legend": True,
    "alt": "Grid of 30 cells, one per Flock camera.",
    "dataTable": {"columns": ["Category", "Count"], "records": [["Cameras", 30]]},
    "categories": [{"id": "cameras", "label": "Cameras", "value": 30, "color": INK}],
}

WAFFLE_LOTS = {
    "type": "waffle",
    "title": "Former ISU lots",
    "mode": "n",
    "unit": "count",
    "caption": "The city moved on 74 former ISU lots from 3rd–13th to Locust, $4,000 purchase plus $6,500 infrastructure incentive each.",
    "source": {
        "label": "City council, Mar 5",
        "href": "https://vigoledger.org/h/2026-03-05-terre-haute-city-council-isu-parcels-redevelopment",
    },
    "legend": True,
    "alt": "Grid of 74 cells, one per former ISU lot.",
    "dataTable": {"columns": ["Category", "Count"], "records": [["Former ISU lots", 74]]},
    "categories": [{"id": "lots", "label": "Former ISU lots", "value": 74, "color": PARK}],
}

ISO_BEDS = {
    "type": "isotype",
    "title": "100 shelter beds",
    "unit": "count",
    "caption": "A trustee told council 100 people need beds at the fairgrounds before the city can enforce its camping rules.",
    "source": {
        "label": "City council, Jun 4",
        "href": "https://vigoledger.org/h/2026-06-04-terre-haute-city-council-homeless-shelter-fairgrounds-proposal",
    },
    "legend": True,
    "alt": "One hundred bed icons, one per shelter bed asked.",
    "icon": "civic:bed",
    "categories": [{"id": "beds", "label": "Shelter beds", "value": 100, "icon": "civic:bed", "color": CLAY}],
}

ISO_PARCELS = {
    "type": "isotype",
    "title": "84 unbilled parcels",
    "unit": "count",
    "caption": "A years-old billing glitch let about 84 conservancy parcels skip the tax; no back taxes will be collected.",
    "source": {
        "label": "County commissioners, Aug 4",
        "href": "https://vigoledger.org/h/2026-08-04-vigo-county-commissioners-conservancy-tax-correction",
    },
    "legend": True,
    "alt": "Eighty-four parcel icons, one per unbilled conservancy parcel.",
    "icon": "civic:parcel",
    "categories": [
        {"id": "parcels", "label": "Unbilled parcels", "value": 84, "approximate": True, "icon": "civic:parcel", "color": GREEN}
    ],
}

ISO_LOTS = {
    "type": "isotype",
    "title": "74 former ISU lots",
    "unit": "count",
    "caption": "The city moved on 74 former ISU lots from 3rd–13th to Locust.",
    "source": {
        "label": "City council, Mar 5",
        "href": "https://vigoledger.org/h/2026-03-05-terre-haute-city-council-isu-parcels-redevelopment",
    },
    "legend": True,
    "alt": "Seventy-four lot icons, one per former ISU lot.",
    "icon": "civic:lot",
    "categories": [
        {"id": "lots", "label": "Former ISU lots", "value": 74, "icon": "civic:lot", "color": PARK}
    ],
}

ISO_CAMERAS = {
    "type": "isotype",
    "title": "30 Flock cameras",
    "unit": "count",
    "caption": "Thirty Flock license-plate cameras have been in place since 2024.",
    "source": {
        "label": "City council, Jun 11",
        "href": "https://vigoledger.org/h/2026-06-11-terre-haute-city-council-flock-camera-privacy-policy",
    },
    "legend": True,
    "alt": "Thirty camera icons, one per Flock camera.",
    "icon": "civic:camera",
    "categories": [{"id": "cameras", "label": "Cameras", "value": 30, "icon": "civic:camera", "color": INK}],
}

ISO_DEMOLITION = {
    "type": "isotype",
    "title": "About 10 demolitions",
    "unit": "count",
    "caption": "The city planned about ten more demolitions in May.",
    "source": {
        "label": "City council, May 7",
        "href": "https://vigoledger.org/h/2026-05-07-terre-haute-city-council-blight-demolitions",
    },
    "legend": True,
    "alt": "About ten demolition icons.",
    "icon": "civic:demolition",
    "categories": [
        {"id": "may", "label": "May", "value": 10, "approximate": True, "icon": "civic:demolition", "color": CLAY}
    ],
}

SMALL_MULT = {
    "type": "small-multiples",
    "title": "Budget lines held",
    "panelType": "delta",
    "columns": 5,
    "shareScale": True,
    "unit": "usd",
    "caption": "The budget committee held the sheriff, Juvenile Justice Center, weights and measures, tower, and salary lines; dollar amounts were not read into this week's record.",
    "source": {
        "label": "Budget committee, Aug 12–13",
        "href": "https://vigoledger.org/h/2026-08-13-vigo-county-budget-committee-recess-salaries-deferred",
    },
    "alt": "Five panels, one per held budget line. Amounts not yet in the notes.",
    "panels": [
        {"id": "sheriff", "label": "Sheriff", "spec": {"from": {"value": 0}, "to": {"value": 0}}},
        {"id": "jjc", "label": "JJC", "spec": {"from": {"value": 0}, "to": {"value": 0}}},
        {"id": "weights", "label": "Weights & measures", "spec": {"from": {"value": 0}, "to": {"value": 0}}},
        {"id": "tower", "label": "Tower", "spec": {"from": {"value": 0}, "to": {"value": 0}}},
        {"id": "salaries", "label": "Salaries", "spec": {"from": {"value": 0}, "to": {"value": 0}}},
    ],
}

SCORECARD = {
    "type": "scorecard",
    "title": "Abatements: promised vs delivered",
    "unit": "count",
    "caption": "Council kept CHI Overhead Doors' tax break even though hiring landed at 54 of 130 promised jobs, and kept Govina's after a W-2 counting error.",
    "source": {
        "label": "City council, Jul 9",
        "href": "https://vigoledger.org/h/2026-07-09-terre-haute-city-council-chi-overhead-doors-abatement",
    },
    "alt": "Three abatement rows: CHI 54 of 130 jobs, Govina 62 after a 152 W-2 miscount, Miller-Parrott 2 employees observed.",
    "rows": [
        {
            "id": "chi",
            "label": "CHI Overhead Doors",
            "promised": {"label": "New workers promised", "value": 130},
            "delivered": {"label": "Reported", "value": 54},
            "kept": True,
            "note": "jobs missed; investment $10.7M vs $9M promised",
        },
        {
            "id": "govina",
            "label": "Govina Inc.",
            "promised": {"label": "Original promise (not stated)", "value": 0},
            "delivered": {"label": "Actual average", "value": 62},
            "reportedError": 152,
            "kept": True,
            "note": "counting error (W-2s vs snapshot)",
        },
        {
            "id": "miller-parrott",
            "label": "Miller-Parrott Lofts",
            "promised": {"label": "Promised jobs (not stated)", "value": 0},
            "delivered": {"label": "Employees observed", "value": 2},
            "kept": True,
            "note": "found in substantial compliance",
        },
    ],
}

BEESWARM = {
    "type": "beeswarm",
    "title": "Asks on one axis",
    "unit": "usd",
    "axis": "x",
    "caption": "A $4,500 clothing allowance for three part-time security officers sits on the same scale as a $502,000 seized-asset ask.",
    "source": {
        "label": "County council, Aug 4",
        "href": "https://vigoledger.org/h/2026-08-04-vigo-county-council-sunshine-building-security-clothing-allowance",
    },
    "alt": "Dots on a dollar axis from $4,500 clothing allowance to $502,000 seized-asset ask, with this week's other published appropriations.",
    "annotations": [
        {
            "kind": "callout",
            "text": "$4,500 clothing allowance",
            "at": {"x": 4500},
            "href": "https://vigoledger.org/h/2026-08-04-vigo-county-council-sunshine-building-security-clothing-allowance",
        },
        {
            "kind": "peak",
            "text": "seized-asset ask",
            "at": {"x": 502000},
            "href": "https://vigoledger.org/h/2026-08-04-vigo-county-council-sunshine-prosecutor-seized-assets-appropriation",
        },
    ],
    "items": [
        {"id": "clothing", "label": "Clothing allowance", "value": 4500},
        {"id": "warming", "label": "Warming center", "value": 47500},
        {"id": "susie", "label": "Susie's Place", "value": 45000},
        {"id": "plow", "label": "Plow", "value": 100000},
        {"id": "rescue", "label": "Rescue truck", "value": 225000},
        {"id": "traffic", "label": "Traffic study", "value": 469000},
        {"id": "buildings", "label": "Building emergencies", "value": 520000},
        {"id": "seized", "label": "Seized-asset ask", "value": 502000},
    ],
}

CONNECTED = {
    "type": "connected-dot",
    "title": "Jobs promised vs reported",
    "unit": "count",
    "caption": "CHI Overhead Doors reported 54 of 130 promised jobs; Govina's 152 was a W-2 count, the actual average is 62.",
    "source": {
        "label": "City council, Jul 9",
        "href": "https://vigoledger.org/h/2026-07-09-terre-haute-city-council-chi-overhead-doors-abatement",
    },
    "alt": "Three rows: CHI 130 to 54, Govina 152 W-2s to 62 average, Miller-Parrott promised jobs not stated to 2 observed.",
    "rows": [
        {"id": "chi", "label": "CHI Overhead Doors", "from": {"label": "Promised", "value": 130}, "to": {"label": "Reported", "value": 54}},
        {
            "id": "govina",
            "label": "Govina Inc.",
            "from": {"label": "CF-1 (every W-2)", "value": 152},
            "to": {"label": "Actual average", "value": 62},
            "color": "#6B7280",
        },
        {
            "id": "miller-parrott",
            "label": "Miller-Parrott Lofts",
            "from": {"label": "Promised (not stated)", "value": 0},
            "to": {"label": "Observed", "value": 2},
        },
    ],
}

DATA_TABLE = {
    "type": "data-table",
    "title": "This week's appropriations",
    "unit": "usd",
    "caption": "Building-maintenance emergencies are the largest add in this edition, at $520,000.",
    "source": {"label": "Vol. I No. 1, week of Aug 28", "href": "https://vigoledger.org/"},
    "alt": "Appropriations: buildings $520,000, traffic study $469,000, rescue truck $225,000, plow $100,000, warming center $47,500, Susie's Place $45,000.",
    "sort": {"column": "amount", "direction": "desc"},
    "columns": [
        {"id": "item", "label": "Item", "encode": "text"},
        {"id": "body", "label": "Body", "encode": "text"},
        {"id": "amount", "label": "Amount", "unit": "usd", "encode": "bar"},
    ],
    "rows": [
        {"item": "Building emergencies", "body": "Budget committee", "amount": 520000},
        {"item": "Traffic study", "body": "Commissioners", "amount": 469000},
        {"item": "Rescue truck", "body": "City Council", "amount": 225000},
        {"item": "Plow", "body": "City Council", "amount": 100000},
        {"item": "Warming center", "body": "City Council", "amount": 47500},
        {"item": "Susie's Place", "body": "City Council", "amount": 45000},
    ],
}

HELD_TABLE = {
    "type": "data-table",
    "title": "Budget lines held",
    "caption": "Five department lines the budget committee held. Status is text; no mini-bar.",
    "source": {
        "label": "Budget committee, Aug 12–13",
        "href": "https://vigoledger.org/h/2026-08-13-vigo-county-budget-committee-recess-salaries-deferred",
    },
    "alt": "Five held department rows, status Held.",
}

CATEGORY_MIX = {
    "type": "stacked-bar",
    "title": "Highlights by kind, Mar–Aug",
    "unit": "count",
    "caption": "August carried 43 of this edition's 78 highlights; 26 of those 43 are MONEY. 23 of 78 are flagged unverified — that badge is not a sixth stack.",
    "source": {"label": "Vol. I No. 1 edition index", "href": "https://vigoledger.org/"},
    "legend": [
        {"label": "MONEY"},
        {"label": "RULES"},
        {"label": "PROPERTY"},
        {"label": "DEFERRAL"},
        {"label": "FRICTION"},
    ],
    "alt": "Table of highlight counts by month and kind, March through August 2026.",
}

PER_BODY = {
    "type": "bar",
    "title": "Highlights by body",
    "unit": "count",
    "caption": "City Council accounts for 43 of this edition's 78 highlights; the Board of Zoning Appeals accounts for one.",
    "source": {"label": "Vol. I No. 1 edition index", "href": "https://vigoledger.org/"},
    "alt": "Highlights: City Council 43, budget committee 16, Commissioners 10, County Council 8, BZA 1.",
}



CSS = r"""

  :root {
    --cream: #F4EFE4;
    --paper: #FBF7EE;
    --ink: #2C2A26;
    --muted: #6B655C;
    --rule: #C9C0B0;
    --green: #3F5C47;
    --gold: #C9A227;
    --clay: #C45C26;
    --park: #7A8F4F;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--cream); color: var(--ink); }
  body {
    font-family: "Iowan Old Style", "Palatino Linotype", Palatino, "Times New Roman", serif;
    line-height: 1.45;
  }
  .mast {
    max-width: 980px;
    margin: 0 auto;
    padding: 36px 28px 20px;
    border-bottom: 3px solid var(--ink);
  }
  .kicker {
    font-family: "Franklin Gothic Medium", "News Gothic", "Helvetica Neue", sans-serif;
    font-size: 11px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--green);
    margin: 0 0 8px;
  }
  h1 {
    font-size: 42px;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin: 0 0 6px;
    line-height: 1.05;
  }
  .deck {
    font-size: 18px;
    color: var(--muted);
    margin: 0;
    max-width: 42em;
  }
  .meta {
    font-family: "Franklin Gothic Medium", "News Gothic", "Helvetica Neue", sans-serif;
    font-size: 11px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--muted);
    margin-top: 14px;
  }
  main { max-width: 980px; margin: 0 auto; padding: 12px 28px 80px; }
  section.figure {
    padding: 36px 0 28px;
    border-bottom: 1px solid var(--rule);
  }
  .type {
    font-family: "Franklin Gothic Medium", "News Gothic", "Helvetica Neue", sans-serif;
    font-size: 11px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--gold);
    margin: 0 0 8px;
  }
  h2 {
    font-size: 26px;
    margin: 0 0 14px;
    font-weight: 700;
    letter-spacing: -0.015em;
  }
  .frame {
    background: var(--paper);
    border: 1px solid var(--rule);
    padding: 16px 18px 12px;
    overflow-x: auto;
    width: fit-content;
    max-width: 100%;
  }
  [data-type="small-multiples"] .frame,
  [data-type="scorecard"] .frame,
  [data-type="beeswarm"] .frame,
  [data-type="connected-dot"] .frame,
  [data-type="data-table"] .frame {
    width: 100%;
  }
  [data-type="small-multiples"] svg {
    width: 100%;
  }
  svg { display: block; max-width: 100%; height: auto; background: #F7F3EA; }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 14px 22px;
    padding: 12px 2px 4px;
    font-family: "Franklin Gothic Medium", "News Gothic", "Helvetica Neue", sans-serif;
    font-size: 13px;
    color: var(--ink);
  }
  [data-type="waffle"] .legend,
  [data-type="isotype"] .legend {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  .legend .item { display: flex; align-items: center; gap: 8px; }
  .swatch {
    width: 14px; height: 14px; border: 1px solid var(--ink);
    display: inline-block; flex: 0 0 14px;
  }
  .caption {
    font-size: 16px;
    margin: 12px 0 4px;
    max-width: 46em;
  }
  .source {
    font-family: "Franklin Gothic Medium", "News Gothic", "Helvetica Neue", sans-serif;
    font-size: 12px;
    color: var(--muted);
    margin: 0;
  }
  .source a { color: var(--green); text-decoration: none; border-bottom: 1px solid var(--green); }
  .source a:hover { background: #E7EFE8; }
  .footnote, .note, figcaption {
    font-size: 13px;
    color: var(--muted);
    margin: 8px 0 0;
  }
  figcaption { font-style: italic; }
  .visually-hidden {
    position: absolute !important;
    width: 1px; height: 1px;
    padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0,0,0,0);
    white-space: nowrap; border: 0;
  }
  table.scorecard, table.data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 15px;
    background: var(--paper);
  }
  table.scorecard th, table.data-table th,
  table.scorecard td, table.data-table td {
    text-align: left;
    padding: 12px 14px;
    border-bottom: 1px solid var(--rule);
    vertical-align: middle;
  }
  table.scorecard th, table.data-table th {
    font-family: "Franklin Gothic Medium", "News Gothic", "Helvetica Neue", sans-serif;
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .status {
    font-family: "Franklin Gothic Medium", "News Gothic", "Helvetica Neue", sans-serif;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 2px 8px;
    border: 1px solid var(--ink);
  }
  .status.kept-short { background: #F3D7C8; color: var(--clay); }
  .status.unknown { background: var(--cream); color: var(--muted); }
  .status.met { background: #D5DEC0; color: var(--green); }
  s.struck { color: var(--muted); margin-left: 0.75em; padding-left: 0.15em; }
  table.scorecard td:nth-child(2),
  table.scorecard td:nth-child(3),
  table.scorecard td:nth-child(4) {
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .bar-cell { white-space: nowrap; }
  .bar-cell .num { display: inline-block; min-width: 4.5em; margin-right: 8px; }
  svg.cell-bar { display: inline-block; vertical-align: middle; background: transparent; }
  svg.inline-dot { display: inline-block; vertical-align: middle; margin-left: 8px; background: transparent; }
  footer.colophon {
    max-width: 980px;
    margin: 0 auto;
    padding: 24px 28px 48px;
    font-size: 13px;
    color: var(--muted);
  }

"""


def page(sections: list[str]) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Composition family — The Vigo Ledger</title>
<style>
{CSS}
</style>
</head>
<body>
  <header class="mast">
    <p class="kicker">diagrams.sh · Composition family preview</p>
    <h1>The Vigo Ledger</h1>
    <p class="deck">Part-to-whole, roster, and distribution. SVG geometry from YAML counts. CivicBase chrome. Not a library renderer.</p>
    <p class="meta">Vol. I No. 1 · Terre Haute / Vigo County · week of Aug 28, 2026</p>
  </header>
  <main>
    {''.join(sections)}
  </main>
  <footer class="colophon">
    Demo renderer <code>demos/render_composition.py</code>. Specs in
    <code>06-composition.md</code>. Chrome locked in <code>00-editorial-chrome.md</code>.
    Isotype paths are stand-ins; pack owned by Editorial Primitives.
  </footer>
</body>
</html>
"""


def main() -> None:
    sections: list[str] = []

    for spec, sid in (
        (WAFFLE_PARCELS, "waffle-parcels"),
        (WAFFLE_BEDS, "waffle-beds"),
        (WAFFLE_DEMOS, "waffle-demolitions"),
        (WAFFLE_CAMERAS, "waffle-cameras"),
        (WAFFLE_LOTS, "waffle-lots"),
    ):
        svg, _ = render_waffle(spec)
        sections.append(figure("waffle", spec, svg, section_id=sid, section_class="figure waffle"))

    for spec, sid in (
        (ISO_BEDS, "isotype-beds"),
        (ISO_PARCELS, "isotype-parcels"),
        (ISO_CAMERAS, "isotype-cameras"),
        (ISO_DEMOLITION, "isotype-demolition"),
        (ISO_LOTS, "isotype-lots"),
    ):
        svg, *_ = render_isotype(spec)
        sections.append(figure("isotype", spec, svg, section_id=sid, section_class="figure isotype"))

    sections.append(figure("small-multiples", SMALL_MULT, render_small_multiples(SMALL_MULT), section_id="small-multiples"))
    sections.append(figure("scorecard", SCORECARD, render_scorecard_table(SCORECARD), section_id="scorecard"))
    bees_svg, *_ = render_beeswarm(BEESWARM)
    sections.append(figure("beeswarm", BEESWARM, bees_svg, section_id="beeswarm"))
    cd_svg, *_ = render_connected_dot(CONNECTED)
    sections.append(figure("connected-dot", CONNECTED, cd_svg, section_id="connected-dot"))
    sections.append(figure("data-table", DATA_TABLE, render_data_table_type(DATA_TABLE), section_id="data-table"))
    sections.append(
        figure("data-table", HELD_TABLE, render_held_table(), section_id="data-table-held")
    )
    sections.append(
        figure(
            "stacked-bar",
            CATEGORY_MIX,
            render_category_mix_table(),
            section_id="category-mix",
            section_class="figure category-mix",
        )
    )
    sections.append(
        figure(
            "bar",
            PER_BODY,
            render_per_body_table(),
            section_id="per-body-count",
            section_class="figure per-body-count",
        )
    )

    html_out = page(sections)
    OUT.write_text(html_out)
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
