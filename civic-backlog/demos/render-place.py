#!/usr/bin/env python3
"""Demo renderer: place YAML (lon/lat or GeoJSON) -> static HTML/SVG.

Not the diagrams.sh library. Geometry is projected from the spec, not drawn by hand.
"""
from __future__ import annotations

import math
from pathlib import Path

import yaml

ROOT = Path("/workspace/diagrams-backlog")
EXAMPLES = ROOT / "examples"
OUT = ROOT / "demos" / "place.html"

W, H = 960, 640
PAD = 0.12
# Plot inset: keep north/scale in a dedicated bottom band, off the geography
PLOT = (28, 16, 932, 548)  # x0, y0, x1, y1

COLORS = {
    "clay": "#C45C26",
    "ink": "#2C2A26",
    "land": "#F7F3EA",
    "water": "#B7C9C4",
    "city": "#D9D1C3",
    "park": "#7A8F4F",
    "green": "#5B7C6A",
    "sand": "#E6D9B8",
    "street": "#D4CBBA",
    "dark": "#3F3A36",
    "muted": "#6B655C",
}

ZONING_FILL = {
    "R-1": COLORS["sand"],
    "C-2": COLORS["clay"],
    "duplex": COLORS["clay"],
}


def mercator(lon: float, lat: float) -> tuple[float, float]:
    lat = max(min(lat, 85.051128), -85.051128)
    x = math.radians(lon)
    y = math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))
    return x, y


def walk_coords(geom) -> list[list[tuple[float, float]]]:
    """Return rings/lines as lists of (lon, lat)."""
    if not geom:
        return []
    t = geom.get("type")
    c = geom.get("coordinates")
    rings: list[list[tuple[float, float]]] = []
    if t == "Point":
        rings.append([(c[0], c[1])])
    elif t == "LineString":
        rings.append([(p[0], p[1]) for p in c])
    elif t == "MultiLineString":
        for line in c:
            rings.append([(p[0], p[1]) for p in line])
    elif t == "Polygon":
        for ring in c:
            rings.append([(p[0], p[1]) for p in ring])
    elif t == "MultiPolygon":
        for poly in c:
            for ring in poly:
                rings.append([(p[0], p[1]) for p in ring])
    elif t == "GeometryCollection":
        for g in geom.get("geometries", []):
            rings.extend(walk_coords(g))
    return rings


def load_geojson(path: Path) -> list[list[tuple[float, float]]]:
    import json

    data = json.loads(path.read_text())
    rings = []
    if data.get("type") == "FeatureCollection":
        for feat in data.get("features", []):
            rings.extend(walk_coords(feat.get("geometry") or {}))
    elif data.get("type") == "Feature":
        rings.extend(walk_coords(data.get("geometry") or {}))
    else:
        rings.extend(walk_coords(data))
    return rings


def simplify(ring: list[tuple[float, float]], max_pts: int = 400) -> list[tuple[float, float]]:
    if len(ring) <= max_pts:
        return ring
    step = max(1, len(ring) // max_pts)
    out = ring[::step]
    if out[-1] != ring[-1]:
        out.append(ring[-1])
    return out


class Projector:
    def __init__(self, points: list[tuple[float, float]], width=W, height=H, pad=PAD):
        xs, ys = [], []
        for lon, lat in points:
            x, y = mercator(lon, lat)
            xs.append(x)
            ys.append(y)
        minx, maxx = min(xs), max(xs)
        miny, maxy = min(ys), max(ys)
        dx = maxx - minx or 1e-9
        dy = maxy - miny or 1e-9
        # keep aspect in mercator
        minx -= dx * pad
        maxx += dx * pad
        miny -= dy * pad
        maxy += dy * pad
        dx = maxx - minx
        dy = maxy - miny
        # letterbox to svg aspect
        svg_aspect = (PLOT[2] - PLOT[0]) / (PLOT[3] - PLOT[1])
        data_aspect = dx / dy
        if data_aspect > svg_aspect:
            extra = dx / svg_aspect - dy
            miny -= extra / 2
            maxy += extra / 2
            dy = maxy - miny
        else:
            extra = dy * svg_aspect - dx
            minx -= extra / 2
            maxx += extra / 2
            dx = maxx - minx
        self.minx, self.maxx, self.miny, self.maxy = minx, maxx, miny, maxy
        self.dx, self.dy = dx, dy
        self.width, self.height = width, height
        self.x0, self.y0, self.x1, self.y1 = PLOT

    def xy(self, lon: float, lat: float) -> tuple[float, float]:
        x, y = mercator(lon, lat)
        sx = self.x0 + (x - self.minx) / self.dx * (self.x1 - self.x0)
        sy = self.y0 + (self.maxy - y) / self.dy * (self.y1 - self.y0)
        return round(sx, 2), round(sy, 2)

    def polyline(self, pts: list[tuple[float, float]]) -> str:
        return " ".join(f"{self.xy(lon, lat)[0]},{self.xy(lon, lat)[1]}" for lon, lat in pts)

    def path_from_rings(self, rings: list[list[tuple[float, float]]]) -> str:
        parts = []
        for ring in rings:
            ring = simplify(ring)
            if not ring:
                continue
            x0, y0 = self.xy(*ring[0])
            d = [f"M {x0} {y0}"]
            for lon, lat in ring[1:]:
                x, y = self.xy(lon, lat)
                d.append(f"L {x} {y}")
            d.append("Z")
            parts.append(" ".join(d))
        return " ".join(parts)


def collect_points(spec: dict, base: Path) -> list[tuple[float, float]]:
    pts: list[tuple[float, float]] = []

    def add_lonlat(obj):
        if not obj:
            return
        if "lon" in obj and "lat" in obj:
            pts.append((float(obj["lon"]), float(obj["lat"])))
        if "center" in obj:
            add_lonlat(obj["center"])
        for ring in obj.get("ring") or obj.get("path") or obj.get("extent") or []:
            add_lonlat(ring)

    def add_geo(ref):
        if not ref:
            return
        p = (base / ref).resolve()
        if p.exists():
            for ring in load_geojson(p):
                pts.extend(ring[:: max(1, len(ring) // 80)])

    add_lonlat(spec.get("basemap"))
    for pin in spec.get("pins") or spec.get("points") or spec.get("stops") or []:
        add_lonlat(pin)
    region = spec.get("region") or spec.get("corridor") or {}
    add_lonlat(region)
    add_geo(region.get("geojson"))
    for ctx in spec.get("context") or []:
        add_lonlat(ctx)
        add_geo(ctx.get("geojson"))
    for feat in spec.get("features") or spec.get("parcels") or []:
        add_lonlat(feat)
        add_geo(feat.get("geojson"))
    for panel in (spec.get("before"), spec.get("after")):
        if not panel:
            continue
        for feat in panel.get("parcels") or []:
            add_lonlat(feat)
            add_geo(feat.get("geojson"))
    for p in spec.get("extent") or []:
        add_lonlat(p)
    return pts


def esc(s: str) -> str:
    return (
        str(s)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def legend_items(spec: dict) -> list:
    """CivicBase Legend = true | false | LegendItem[] | LegendSpec."""
    legend = spec.get("legend")
    if legend is False or legend is None:
        return []
    if legend is True:
        return []
    if isinstance(legend, list):
        return legend
    if isinstance(legend, dict):
        return legend.get("items") or []
    return []


def legend_html(spec: dict) -> str:
    items = legend_items(spec)
    if not items:
        return ""
    bits = ['<div class="legend">']
    for it in items:
        color = it.get("color") or COLORS["clay"]
        bits.append(
            f'<div class="item"><span class="swatch" style="background:{esc(color)}"></span>{esc(it.get("label",""))}</div>'
        )
    bits.append("</div>")
    return "\n".join(bits)


def source_html(spec: dict) -> str:
    src = spec.get("source")
    if not src:
        return ""
    entries = src if isinstance(src, list) else [src]
    parts = []
    for e in entries:
        label = e.get("label") or ""
        href = e.get("href")
        if href:
            parts.append(f'<a href="{esc(href)}">{esc(label)}</a>')
        else:
            parts.append(esc(label))
    return '<p class="source">Source: ' + " · ".join(parts) + "</p>"


def svg_open(aria: str) -> str:
    return (
        f'<svg class="map" viewBox="0 0 {W} {H}" role="img" '
        f'aria-label="{esc(aria)}">'
        f'<rect width="{W}" height="{H}" fill="{COLORS["land"]}"/>'
    )


def north_scale(proj: Projector, lat: float = 39.47) -> str:
    """North arrow + a scale bar that matches the current zoom, in the bottom band."""
    clon = (math.degrees(proj.minx) + math.degrees(proj.maxx)) / 2
    clat = 2 * math.degrees(math.atan(math.exp((proj.miny + proj.maxy) / 2)) - math.pi / 4)
    plot_w = proj.x1 - proj.x0
    lon_span = abs(math.degrees(proj.maxx) - math.degrees(proj.minx))
    m_per_px = (lon_span * 111320 * math.cos(math.radians(clat))) / max(plot_w, 1)
    candidates = [
        (50, "50 m"),
        (100, "100 m"),
        (200, "200 m"),
        (402, "0.25 mile"),
        (805, "0.5 mile"),
        (1609, "1 mile"),
        (3218, "2 miles"),
        (8047, "5 miles"),
    ]
    fit = [(m, lab, m / m_per_px) for m, lab in candidates]
    in_range = [c for c in fit if 48 <= c[2] <= 150]
    if in_range:
        meters, label, bar = min(in_range, key=lambda c: abs(c[2] - 90))
    else:
        meters, label, bar = min(fit, key=lambda c: abs(c[2] - 90))
        bar = max(48, min(150, bar))
    y = H - 56
    tw = max(28, len(label) * 5.2)
    return (
        f'<line x1="20" y1="{H-72}" x2="{W-20}" y2="{H-72}" stroke="#D4CBBA" stroke-width="1"/>'
        f'<g transform="translate(28,{y})">'
        '<polygon points="8,0 14,20 8,14 2,20" fill="#2C2A26"/>'
        '<text class="axis-label" x="3" y="34">N</text>'
        f'<line x1="32" y1="16" x2="{32+bar:.0f}" y2="16" stroke="#2C2A26" stroke-width="2"/>'
        f'<line x1="32" y1="10" x2="32" y2="22" stroke="#2C2A26"/>'
        f'<line x1="{32+bar:.0f}" y1="10" x2="{32+bar:.0f}" y2="22" stroke="#2C2A26"/>'
        f'<text class="axis-label" x="{32+bar/2-tw/2:.0f}" y="10">{label}</text>'
        "</g>"
    )


def numbered_dots(positions: list[tuple[float, float]], min_d: float = 44) -> list[tuple[float, float, int]]:
    """True pin stays put. Number badges repel until they are min_d apart."""
    xs = [[float(x), float(y)] for x, y in positions]
    for _ in range(50):
        moved = False
        for i in range(len(xs)):
            for j in range(i + 1, len(xs)):
                dx = xs[j][0] - xs[i][0]
                dy = xs[j][1] - xs[i][1]
                dist = math.hypot(dx, dy) or 0.01
                if dist < min_d:
                    push = (min_d - dist) / 2 + 0.6
                    ux, uy = dx / dist, dy / dist
                    xs[i][0] -= ux * push
                    xs[i][1] -= uy * push
                    xs[j][0] += ux * push
                    xs[j][1] += uy * push
                    moved = True
        if not moved:
            break
    # keep badges inside the plot
    x0, y0, x1, y1 = PLOT
    out = []
    for i, (x, y) in enumerate(xs, 1):
        x = min(max(x, x0 + 14), x1 - 14)
        y = min(max(y, y0 + 14), y1 - 14)
        out.append((x, y, i))
    return out


def draw_locator(spec: dict, base: Path) -> str:
    pins = spec.get("pins") or []
    pts = collect_points(spec, base)
    proj = Projector(pts, pad=0.14)
    parts = [svg_open(spec.get("title") or "locator-map")]
    # No city polygon on the locator: including it shrinks the pin spread.
    # Pins are the geography; the key names them.
    xy = [proj.xy(float(p["lon"]), float(p["lat"])) for p in pins]
    badges = numbered_dots(xy, min_d=52)
    for (x, y), (bx, by, n) in zip(xy, badges):
        offset = math.hypot(bx - x, by - y) > 8
        # Tiny true-position mark so adjacent lots (6/7, downtown) stay honest.
        parts.append(
            f'<circle cx="{x}" cy="{y}" r="4.2" fill="{COLORS["clay"]}" '
            f'stroke="{COLORS["ink"]}" stroke-width="1"/>'
        )
        if offset:
            parts.append(
                f'<line x1="{x}" y1="{y}" x2="{bx}" y2="{by}" stroke="{COLORS["ink"]}" stroke-width="0.9"/>'
            )
        parts.append(
            f'<circle cx="{bx}" cy="{by}" r="11" fill="{COLORS["clay"]}" '
            f'stroke="#FBF7EE" stroke-width="1.6"/>'
        )
        parts.append(
            f'<text class="pin-num" x="{bx}" y="{by + 4.5}" text-anchor="middle">{n}</text>'
        )
    parts.append(north_scale(proj))
    parts.append("</svg>")
    # Key lives in HTML, not on the map — downtown labels will not stack.
    items = []
    for i, pin in enumerate(pins, 1):
        note = f' <span class="k-note">{esc(pin["note"])}</span>' if pin.get("note") else ""
        items.append(f"<li><span class=\"n\">{i}</span> {esc(pin['label'])}{note}</li>")
    key = '<ol class="pin-key">' + "".join(items) + "</ol>"
    return '<div class="map-with-key">' + "".join(parts) + key + "</div>"


def draw_region(spec: dict, base: Path) -> str:
    pts = collect_points(spec, base)
    proj = Projector(pts)
    parts = [svg_open(spec.get("title") or "region-map")]
    region = spec["region"]
    rings = []
    if region.get("geojson"):
        rings = load_geojson((base / region["geojson"]).resolve())
    elif region.get("ring"):
        rings = [[(float(p["lon"]), float(p["lat"])) for p in region["ring"]]]
        rings[0].append(rings[0][0])
    d = proj.path_from_rings(rings)
    parts.append(
        f'<path d="{d}" fill="{COLORS["clay"]}" fill-opacity="0.32" '
        f'stroke="{COLORS["clay"]}" stroke-width="2"/>'
    )
    for ctx in spec.get("context") or []:
        cr = []
        if ctx.get("geojson"):
            cr = load_geojson((base / ctx["geojson"]).resolve())
        elif ctx.get("ring"):
            cr = [[(float(p["lon"]), float(p["lat"])) for p in ctx["ring"]]]
        cd = proj.path_from_rings(cr)
        parts.append(
            f'<path d="{cd}" fill="{COLORS["city"]}" fill-opacity="0.85" '
            f'stroke="{COLORS["ink"]}" stroke-width="1.1"/>'
        )
    # Name lives in the HTML title + legend, not a plate on the polygon.
    parts.append(north_scale(proj))
    parts.append("</svg>")
    return "".join(parts)


def draw_choropleth(spec: dict, base: Path) -> str:
    pts = collect_points(spec, base)
    proj = Projector(pts)
    parts = [svg_open(spec.get("title") or "choropleth")]
    fills = {"county": COLORS["clay"], "city": COLORS["green"]}
    # draw county first so city sits on top
    order = sorted(spec.get("features") or [], key=lambda f: 0 if f.get("value") == "county" else 1)
    for feat in order:
        rings = []
        if feat.get("geojson"):
            rings = load_geojson((base / feat["geojson"]).resolve())
        elif feat.get("ring"):
            rings = [[(float(p["lon"]), float(p["lat"])) for p in feat["ring"]]]
        d = proj.path_from_rings(rings)
        fill = fills.get(str(feat.get("value")), COLORS["city"])
        parts.append(
            f'<path d="{d}" fill="{fill}" fill-opacity="0.72" '
            f'stroke="{COLORS["ink"]}" stroke-width="1"/>'
        )
    parts.append(north_scale(proj))
    parts.append("</svg>")
    return "".join(parts)


def draw_corridor(spec: dict, base: Path) -> str:
    pts = collect_points(spec, base)
    # pad extra so a short road isn't a single line across the page
    proj = Projector(pts, pad=0.35)
    parts = [svg_open(spec.get("title") or "corridor")]
    city = EXAMPLES / "geometries" / "terre-haute-city.geojson"
    if city.exists():
        d = proj.path_from_rings(load_geojson(city))
        parts.append(
            f'<path d="{d}" fill="{COLORS["city"]}" fill-opacity="0.4" '
            f'stroke="#C9C0B0" stroke-width="0.8"/>'
        )
    cor = spec["corridor"]
    path = [(float(p["lon"]), float(p["lat"])) for p in cor.get("path") or []]
    poly = proj.polyline(path)
    parts.append(
        f'<polyline points="{poly}" fill="none" stroke="{COLORS["clay"]}" '
        f'stroke-width="6" stroke-linecap="round"/>'
    )
    stops = spec.get("stops") or []
    for i, stop in enumerate(stops):
        x, y = proj.xy(float(stop["lon"]), float(stop["lat"]))
        parts.append(
            f'<circle cx="{x}" cy="{y}" r="5.5" fill="{COLORS["ink"]}"/>'
        )
        # Alternate labels left/right so Park and Hasselburger never stack.
        if i % 2 == 0:
            parts.append(
                f'<text class="pin-label" x="{x + 12}" y="{y + 4}">{esc(stop["label"])}</text>'
            )
        else:
            parts.append(
                f'<text class="pin-label" x="{x - 12}" y="{y + 4}" text-anchor="end">{esc(stop["label"])}</text>'
            )
    parts.append(north_scale(proj))
    parts.append("</svg>")
    return "".join(parts)


def draw_symbol(spec: dict, base: Path) -> str:
    pts = collect_points(spec, base)
    proj = Projector(pts)
    parts = [svg_open(spec.get("title") or "symbol-map")]
    city = EXAMPLES / "geometries" / "terre-haute-city.geojson"
    if city.exists():
        d = proj.path_from_rings(load_geojson(city))
        parts.append(
            f'<path d="{d}" fill="{COLORS["city"]}" fill-opacity="0.35" '
            f'stroke="#C9C0B0" stroke-width="0.8"/>'
        )
    kind_color = {
        "camera": COLORS["dark"],
        "park": COLORS["park"],
        "museum": COLORS["green"],
        "school": COLORS["green"],
    }
    points = spec.get("points") or []
    xy = []
    for pt in points:
        x, y = proj.xy(float(pt["lon"]), float(pt["lat"]))
        count = float(pt.get("count") or 1)
        r = max(10, 8 * math.sqrt(count))
        fill = kind_color.get(pt.get("kind"), COLORS["clay"])
        parts.append(
            f'<circle cx="{x}" cy="{y}" r="{r:.1f}" fill="{fill}" fill-opacity="0.88" '
            f'stroke="{COLORS["ink"]}" stroke-width="1.1"/>'
        )
        xy.append((x, y, r, pt))
    badges = numbered_dots([(x, y) for x, y, _, _ in xy], min_d=48)
    for (x, y, r, pt), (bx, by, n) in zip(xy, badges):
        if abs(bx - x) > 1 or abs(by - y) > 1:
            parts.append(
                f'<line x1="{x}" y1="{y}" x2="{bx}" y2="{by}" stroke="{COLORS["ink"]}" stroke-width="0.8"/>'
            )
        parts.append(
            f'<circle cx="{bx}" cy="{by}" r="9" fill="{COLORS["ink"]}" stroke="#FBF7EE" stroke-width="1.2"/>'
        )
        parts.append(
            f'<text class="pin-num" x="{bx}" y="{by + 4}" text-anchor="middle">{n}</text>'
        )
    parts.append(north_scale(proj))
    parts.append("</svg>")
    items = []
    for i, pt in enumerate(points, 1):
        note = f' <span class="k-note">{esc(pt["note"])}</span>' if pt.get("note") else ""
        items.append(f"<li><span class=\"n\">{i}</span> {esc(pt['label'])}{note}</li>")
    key = '<ol class="pin-key">' + "".join(items) + "</ol>"
    return '<div class="map-with-key">' + "".join(parts) + key + "</div>"


def parcel_points(parcels: list) -> list[tuple[float, float]]:
    pts = []
    for feat in parcels:
        for p in feat.get("ring") or []:
            pts.append((float(p["lon"]), float(p["lat"])))
    return pts


def draw_zoning_panel(spec_or_panel: dict, parcels: list, base: Path, pts: list, title: str) -> str:
    # Zoom to the lot, not the city. A 40 m parcel in a city extent is a postage stamp.
    proj = Projector(pts, pad=0.55)
    parts = [svg_open(title)]
    for feat in parcels:
        ring = [(float(p["lon"]), float(p["lat"])) for p in feat.get("ring") or []]
        if ring:
            ring = ring + [ring[0]]
        poly = " ".join(f"{proj.xy(*p)[0]},{proj.xy(*p)[1]}" for p in ring)
        code = str(feat.get("code") or "")
        fill = ZONING_FILL.get(code, COLORS["sand"])
        parts.append(
            f'<polygon points="{poly}" fill="{fill}" stroke="{COLORS["ink"]}" stroke-width="2"/>'
        )
        if ring:
            sl = ring[:-1] or ring
            lon = sum(p[0] for p in sl) / len(sl)
            lat = sum(p[1] for p in sl) / len(sl)
            x, y = proj.xy(lon, lat)
            ink = "#FBF7EE" if code == "C-2" else "#2C2A26"
            parts.append(
                f'<text x="{x}" y="{y + 6}" text-anchor="middle" '
                f'style="font-family:Franklin Gothic Medium,sans-serif;font-size:20px;font-weight:700;fill:{ink}">'
                f'{esc(code)}</text>'
            )
    parts.append(north_scale(proj))
    parts.append("</svg>")
    return "".join(parts)


def draw_zoning(spec: dict, base: Path) -> str:
    parcels = spec.get("parcels") or []
    pts = parcel_points(parcels) or collect_points(spec, base)
    return draw_zoning_panel(spec, parcels, base, pts, spec.get("title") or "zoning")


def draw_before_after(spec: dict, base: Path) -> str:
    before_p = spec["before"]["parcels"]
    after_p = spec["after"]["parcels"]
    pts = parcel_points(before_p) + parcel_points(after_p)
    before = draw_zoning_panel(spec, before_p, base, pts, spec["before"]["label"])
    after = draw_zoning_panel(spec, after_p, base, pts, spec["after"]["label"])
    return (
        '<div class="row">'
        f'<div class="panel"><p class="panel-label">{esc(spec["before"]["label"])}</p>'
        f'<div class="frame">{before}</div></div>'
        f'<div class="panel"><p class="panel-label">{esc(spec["after"]["label"])}</p>'
        f'<div class="frame">{after}</div></div>'
        "</div>"
    )


DRAW = {
    "locator-map": draw_locator,
    "region-map": draw_region,
    "choropleth": draw_choropleth,
    "corridor": draw_corridor,
    "symbol-map": draw_symbol,
    "zoning-map": draw_zoning,
    "before-after-map": draw_before_after,
}

ORDER = [
    "ledger-locator-rezonings.yaml",
    "ledger-region-otter-creek.yaml",
    "ledger-choropleth-wheel-tax.yaml",
    "ledger-corridor-clinton-road.yaml",
    "ledger-symbol-map.yaml",
    "ledger-zoning-2215-garfield.yaml",
    "ledger-before-after-2215-garfield.yaml",
    "ledger-region-13th.yaml",
    "ledger-region-isu-lots.yaml",
]

CSS = """
  :root {
    --cream: #F4EFE4; --paper: #FBF7EE; --ink: #2C2A26; --muted: #6B655C;
    --rule: #C9C0B0; --green: #3F5C47; --gold: #C9A227;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--cream); color: var(--ink); }
  body { font-family: "Iowan Old Style", Palatino, "Times New Roman", serif; line-height: 1.45; }
  .mast { max-width: 1100px; margin: 0 auto; padding: 36px 28px 20px; border-bottom: 3px solid var(--ink); }
  .kicker { font-family: "Franklin Gothic Medium", "Helvetica Neue", sans-serif; font-size: 11px;
    letter-spacing: 0.22em; text-transform: uppercase; color: var(--green); margin: 0 0 8px; }
  h1 { font-size: 42px; font-weight: 700; letter-spacing: -0.02em; margin: 0 0 6px; line-height: 1.05; }
  .deck { font-size: 18px; color: var(--muted); margin: 0; max-width: 46em; }
  .meta { font-family: "Franklin Gothic Medium", "Helvetica Neue", sans-serif; font-size: 11px;
    letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted); margin-top: 14px; }
  main { max-width: 1100px; margin: 0 auto; padding: 12px 28px 80px; }
  section.figure { padding: 36px 0 28px; border-bottom: 1px solid var(--rule); }
  .type { font-family: "Franklin Gothic Medium", "Helvetica Neue", sans-serif; font-size: 11px;
    letter-spacing: 0.2em; text-transform: uppercase; color: var(--gold); margin: 0 0 8px; }
  h2 { font-size: 26px; margin: 0 0 14px; font-weight: 700; letter-spacing: -0.015em; }
  .frame { background: var(--paper); border: 1px solid var(--rule); padding: 12px 12px 8px; }
  svg.map { display: block; width: 100%; height: auto; background: #F7F3EA; min-height: 420px; }
  .map-with-key { display: flex; gap: 22px; align-items: flex-start; }
  .map-with-key svg.map { flex: 1 1 auto; min-width: 0; }
  .pin-key { flex: 0 0 260px; margin: 4px 0 0; padding: 0; list-style: none; font-size: 14px; line-height: 1.35; }
  .pin-key li { display: flex; gap: 10px; margin: 0 0 10px; align-items: flex-start; }
  .pin-key .n { flex: 0 0 22px; height: 22px; border-radius: 50%; background: #C45C26; color: #FBF7EE;
    font-family: "Franklin Gothic Medium", sans-serif; font-size: 12px; font-weight: 700;
    display: inline-flex; align-items: center; justify-content: center; }
  .k-note { display: block; color: var(--muted); font-size: 12px; }
  .pin-num { font-family: "Franklin Gothic Medium", sans-serif; font-size: 12px; font-weight: 700; fill: #FBF7EE; }
  .row { display: flex; gap: 12px; flex-wrap: wrap; }
  .row .panel { flex: 1 1 320px; }
  .panel-label { font-family: "Franklin Gothic Medium", "Helvetica Neue", sans-serif; font-size: 11px;
    letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); margin: 0 0 8px; }
  .legend { display: flex; flex-wrap: wrap; gap: 14px 22px; padding: 10px 2px 4px;
    font-family: "Franklin Gothic Medium", "Helvetica Neue", sans-serif; font-size: 12px; }
  .legend .item { display: flex; align-items: center; gap: 8px; }
  .swatch { width: 14px; height: 14px; border: 1px solid var(--ink); display: inline-block; flex: 0 0 14px; }
  .caption { font-size: 16px; margin: 12px 0 4px; max-width: 46em; }
  .source { font-family: "Franklin Gothic Medium", "Helvetica Neue", sans-serif; font-size: 12px; color: var(--muted); margin: 0; }
  .source a { color: var(--green); text-decoration: none; border-bottom: 1px solid var(--green); }
  .note { font-size: 13px; color: var(--muted); margin: 8px 0 0; }
  .pin-label { font-family: "Franklin Gothic Medium", "News Gothic", sans-serif; font-size: 11px; fill: #2C2A26; }
  .axis-label { font-family: "Franklin Gothic Medium", "News Gothic", sans-serif; font-size: 10px; fill: #6B655C; }
  footer.colophon { max-width: 980px; margin: 0 auto; padding: 24px 28px 48px; font-size: 13px; color: var(--muted); }
"""


def figure(spec: dict, svg: str, yaml_name: str) -> str:
    t = spec.get("type", "")
    wrapped = svg if spec.get("type") == "before-after-map" else f'<div class="frame">{svg}{legend_html(spec)}</div>'
    extra = ""
    if spec.get("type") == "before-after-map":
        extra = legend_html(spec)
    return f"""
    <section class="figure" id="{esc(t)}-{esc(yaml_name).replace('.yaml','')}">
      <p class="type">{esc(t)}</p>
      <h2>{esc(spec.get("title") or t)}</h2>
      {wrapped}
      {extra}
      <p class="caption">{esc(spec.get("caption") or "")}</p>
      {source_html(spec)}
      <p class="note">Rendered from <code>{esc(yaml_name)}</code> · Web Mercator · WGS84 lon/lat</p>
    </section>
    """


def main() -> None:
    sections = []
    for name in ORDER:
        path = EXAMPLES / name
        spec = yaml.safe_load(path.read_text())
        drawer = DRAW[spec["type"]]
        svg = drawer(spec, EXAMPLES)
        sections.append(figure(spec, svg, name))
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Place family — rendered from YAML</title>
<style>{CSS}</style>
</head>
<body>
  <header class="mast">
    <p class="kicker">diagrams.sh · Place family · rendered</p>
    <h1>The Vigo Ledger</h1>
    <p class="deck">Pin positions, district outlines, and before/after panels are projected from the YAML (WGS84 lon/lat and Census GeoJSON). Not a hand-placed mock. Not the diagrams.sh library.</p>
    <p class="meta">Vol. I No. 1 · Terre Haute / Vigo County · Web Mercator · source links live</p>
  </header>
  <main>
    {''.join(sections)}
  </main>
  <footer class="colophon">
    Demo renderer: <code>place-viz/render/render_place.py</code>.
    Geometry: Nominatim house matches + Census TIGERweb (Otter Creek GEOID 1816757294, Terre Haute 1875428, Vigo 18167).
    Mason Lodge is 2215 Garfield, not 908 S 7th. East Side school has no site, so it is omitted.
  </footer>
</body>
</html>
"""
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(html)
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
