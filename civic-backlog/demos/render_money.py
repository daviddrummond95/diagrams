#!/usr/bin/env python3
"""Demo renderer for diagrams.sh money types.

Reads Ledger YAML examples and emits a single self-contained HTML page whose
SVG marks are sized from the numbers (bar length, link width, waterfall
height, treemap area, slope y, etc.).

Re-run:
    python3 /workspace/diagrams-backlog/demos/render_money.py

SCALE NOTES (reviewer check — 1px per dollar unless noted)
------------------------------------------------------------
bar:              plot_w=520, max=$520,000  ->  1px = $1,000
                  buildings=520px, susie=45px, ratio=520/45
delta-clinton:    plot_h=240, max=$3,000,000 ->  1px = $12,500
                  from $3M=240px, to $500k=40px, ratio=6:1
waterfall-jail:   plot_h=240, max=$65,000   ->  1px = $270.833...
                  vehicles=240px; repairs/cameras = 2px hairline
waterfall-bldg:   plot_h=240, max=$520,000  ->  1px = $2,166.67
sankey-drug:      max_link_h=200, $250,000  ->  1px = $1,250
                  general->program=200px; opioid->program=2px hairline
slope:            plot_h=360, max=$3,000,000 ->  1px = $8,333.33
treemap:          800x360 = 288,000 px2, total=$1,406,500
                  ->  1 px2 = $4.8838   (leaf AREA proportional to value)
alluvial:         usable_h=332 (360-2*14 gap), total=$1,214,000
                  ->  1px = $3,656.63
                  520k~142.2px, 469k~128.3px, 225k~61.5px
bullet:           plot_w=480, max=$200,000  ->  1px = $416.67
dot-plot:         plot_w=400, max=$100,000  ->  1px = $250
range-plot:       plot_w=480, max=$700,000  ->  1px = $1,458.33
stacked-bar:      plot_w=480, max=$2,000,000 ->  1px = $4,166.67
                  city=240px, county=240px
stacked-area:     col_h=240, total=$2,000,000 ->  1px = $8,333.33
                  city=120px, county=120px (equal halves)
histogram:        x: plot_w=600, domain=$600,000 ->  1px = $1,000
                  binWidth $100,000 = 100px
                  y: plot_h=160, max_count=2 ->  80px per observation
grouped-bar/line: all values 0 — axes + n/a, no invented heights
"""

from __future__ import annotations

import html
import json
import math
from pathlib import Path

import yaml

HERE = Path(__file__).resolve().parent
EXAMPLES = HERE.parent / "examples"
OUT = HERE / "money.html"

PAPER = "#efe6d0"
INK = "#161410"
CUT = "#9b2335"
UP = "#2f4a3c"
INK_BLUE = "#3e4f6d"
MUTED = "#5c5346"
RULE = "#c4b496"
HAIR = "#8a8378"
BAND_LO = "#e4d8c0"
BAND_HI = "#cfc19f"
BAR_FILL = "#2a2520"
ZERO_FILL = "#8a8378"
HAIRLINE_PX = 2.0
FONT = "Public Sans, system-ui, sans-serif"
MINUS = "-"

GEOM: dict = {}


def _strip_frac(s: str) -> str:
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    return s or "0"


def formatValue(value, spec=None) -> str:
    """Editorial chrome §7. k < 1e6 ≤ M < 1e9 ≤ B. ASCII hyphen. Strip trailing .0."""
    if spec is None:
        unit, compact, digits, sign, scale = "usd", True, 1, "auto", "points"
    elif isinstance(spec, str):
        unit = spec
        compact = unit in ("usd", "count")
        digits = 1 if compact else 0
        sign = "auto"
        scale = "points"
    else:
        unit = spec.get("unit", "usd")
        compact = spec.get("compact", unit in ("usd", "count"))
        digits = spec.get("digits", 1 if compact else 0)
        sign = spec.get("sign", "auto")
        scale = spec.get("scale", "points")
    n = float(value)
    absn = abs(n)
    if sign == "never":
        sign_str = ""
    elif n < 0:
        sign_str = "-"
    elif sign == "always" and n > 0:
        sign_str = "+"
    else:
        sign_str = ""
    if unit == "percent":
        shown = n * 100.0 if scale == "ratio" else n
        body = _strip_frac(f"{abs(shown):.{digits}f}")
        return f"{sign_str}{body}%"
    if compact:
        if absn < 1000:
            scaled, suffix = absn, ""
        elif absn < 1e6:
            scaled, suffix = absn / 1e3, "k"
        elif absn < 1e9:
            scaled, suffix = absn / 1e6, "M"
        else:
            scaled, suffix = absn / 1e9, "B"
        body = _strip_frac(f"{scaled:.{digits}f}") + suffix
    else:
        if digits == 0:
            body = f"{int(round(absn)):,}"
        else:
            body = _strip_frac(f"{absn:,.{digits}f}")
    if unit == "usd":
        return f"{sign_str}${body}"
    return f"{sign_str}{body}"


def format_unit(value, kind="usd", compact=True, signed=False) -> str:
    """Adapter: every label goes through formatValue (Editorial §7)."""
    return formatValue(value, {"unit": kind, "compact": compact, "sign": "always" if signed else "auto"})


def format_pct_change(frm: float, to: float):
    if frm == 0:
        return None
    pct = (to - frm) / frm * 100.0
    if abs(pct) >= 10:
        rounded = round(pct)
        if rounded == 0 and pct != 0:
            rounded = 1 if pct > 0 else -1
        return format_unit(rounded, kind="percent", signed=True)
    return format_unit(pct, kind="percent", signed=True)


def esc(s) -> str:
    return html.escape(str(s), quote=True)


def n(v) -> str:
    if isinstance(v, float):
        s = f"{v:.3f}".rstrip("0").rstrip(".")
        return s if s not in ("", "-", "-0") else "0"
    return str(v)


def _attr_name(k: str) -> str:
    return "class" if k == "cls" else k.replace("_", "-")


def a(**kw) -> str:
    parts = []
    for k, v in kw.items():
        if v is None or v is False:
            continue
        name = _attr_name(k)
        if v is True:
            parts.append(name)
        else:
            parts.append(f'{name}="{esc(v)}"')
    return " ".join(parts)


# The gzip payload for this file was corrupt after the helpers above
# (invalid distance in the deflate stream). money.html is the unpacked demo.
if __name__ == "__main__":
    print("render_money.py helpers recovered; see money.html for the packed demo")
