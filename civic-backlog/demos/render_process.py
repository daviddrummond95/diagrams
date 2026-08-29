#!/usr/bin/env python3
"""Process-family demo renderer. Geometry computed from YAML files. Not the library."""
from __future__ import annotations

import math
import re
from pathlib import Path

ROOT = Path("/workspace/diagrams-backlog")
EX = ROOT / "examples"
OUT = ROOT / "demos" / "process.html"

CREAM = "#f6f1e4"
INK = "#1a1a1a"
GREEN = "#3d5a45"
CLAY = "#8a4f2b"
MUTED = "#5c574f"
PAPER = "#fbf7ee"
EMPTY = "#efe8d6"
FONT = "Palatino Linotype, Palatino, Georgia, serif"
SANS = "Franklin Gothic Medium, News Gothic, Helvetica Neue, sans-serif"

FILES = [
    "agenda-states-budget-committee.yaml",
    "outcome-funnel-week.yaml",
    "org-vigo-bodies.yaml",
    "vote-matrix-ray-park.yaml",
    "impact-jail-ordinance.yaml",
    "pipeline-ledger.yaml",
    "hemicycle-ray-park.yaml",
    "heatmap-table-august-deferrals.yaml",
    "network-who-it-touches.yaml",
    "donut-yea-nay-absent.yaml",
]


def parse_yaml(text: str):
    def parse_val(s):
        s = s.strip()
        if s == "":
            return None
        if len(s) >= 2 and s[0] in "\"'" and s[-1] == s[0]:
            return s[1:-1]
        if s.startswith("{") and s.endswith("}"):
            return parse_flow(s)
        if re.fullmatch(r"-?\d+", s):
            return int(s)
        if re.fullmatch(r"-?\d+\.\d+", s):
            return float(s)
        if s in ("true", "false"):
            return s == "true"
        return s

    def parse_flow(s):
        inner = s.strip()[1:-1].strip()
        if not inner:
            return {}
        out, q, buf, parts = {}, None, [], []
        for ch in inner:
            if q:
                buf.append(ch)
                if ch == q:
                    q = None
            elif ch in "\"'":
                q = ch
                buf.append(ch)
            elif ch == ",":
                parts.append("".join(buf))
                buf = []
            else:
                buf.append(ch)
        if buf:
            parts.append("".join(buf))
        for p in parts:
            p = p.strip()
            if not p or ":" not in p:
                continue
            k, v = p.split(":", 1)
            out[k.strip()] = parse_val(v)
        return out

    items = []
    for line in text.splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        ind = len(line) - len(line.lstrip(" "))
        items.append((ind, line.lstrip()))

    def parse_map_cont(start, parent_indent):
        d, i, key_indent = {}, start, None
        while i < len(items):
            ind, s = items[i]
            if ind <= parent_indent or s.startswith("- "):
                break
            if key_indent is None:
                key_indent = ind
            if ind != key_indent:
                break
            if ":" not in s:
                i += 1
                continue
            k, _, v = s.partition(":")
            k, v = k.strip(), v.strip()
            i += 1
            if v:
                d[k] = parse_val(v)
            else:
                child, i = parse_block(i, ind)
                d[k] = child
        return d, i

    def parse_block(start, parent_indent):
        if start >= len(items):
            return None, start
        ind0, s0 = items[start]
        if ind0 <= parent_indent:
            return None, start
        if not s0.startswith("- "):
            return parse_map_cont(start, parent_indent)
        lst, i = [], start
        while i < len(items):
            ind, s = items[i]
            if ind != ind0 or not s.startswith("- "):
                break
            rest = s[2:]
            i += 1
            if rest.startswith("{"):
                lst.append(parse_val(rest))
            elif ":" in rest:
                k, _, v = rest.partition(":")
                node, v = {}, v.strip()
                if v:
                    node[k.strip()] = parse_val(v)
                else:
                    child, i = parse_block(i, ind)
                    node[k.strip()] = child
                extra, i = parse_map_cont(i, ind)
                node.update(extra)
                lst.append(node)
            else:
                lst.append(parse_val(rest))
        return lst, i

    obj, _ = parse_map_cont(0, -1)
    return obj


def esc(s):
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def wrap(text, width):
    words = str(text).split()
    lines, cur = [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if len(trial) <= width:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines or [""]


def fmt_date(iso):
    if not iso:
        return ""
    y, m, d = iso.split("-")
    months = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()
    return f"{months[int(m) - 1]} {int(d)}"


def hatch_def(pid):
    return (
        f'<defs><pattern id="{pid}" patternUnits="userSpaceOnUse" width="6" height="6">'
        f'<rect width="6" height="6" fill="{PAPER}"/>'
        f'<path d="M0,6 L6,0" stroke="{INK}" stroke-width="1"/></pattern>'
        f'<pattern id="stripes-{pid}" patternUnits="userSpaceOnUse" width="6" height="6">'
        f'<rect width="6" height="6" fill="{PAPER}"/>'
        f'<path d="M0,0 L0,6" stroke="{INK}" stroke-width="1.2"/></pattern></defs>'
    )


def svg_start(w, h, aria, defs=""):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="100%" '
        f'role="img" aria-label="{esc(aria)}">'
        f'<rect width="{w}" height="{h}" fill="{PAPER}"/>{defs}'
    )


def text(x, y, content, *, size=12, fill=INK, anchor="start", weight="normal", family=None, dy=14):
    fam = family or FONT
    lines = content if isinstance(content, list) else [content]
    parts = [
        f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" fill="{fill}" '
        f'text-anchor="{anchor}" font-weight="{weight}" font-family="{fam}">'
    ]
    for i, ln in enumerate(lines):
        if i == 0:
            parts.append(f'<tspan x="{x:.1f}" y="{y:.1f}">{esc(ln)}</tspan>')
        else:
            parts.append(f'<tspan x="{x:.1f}" dy="{dy}">{esc(ln)}</tspan>')
    parts.append("</text>")
    return "".join(parts)


def rect(x, y, w, h, *, fill="none", stroke=INK, sw=1.25, rx=4, opacity=None, dash=None):
    op = "" if opacity is None else f' fill-opacity="{opacity}"'
    ds = "" if not dash else f' stroke-dasharray="{dash}"'
    return (
        f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{rx}" '
        f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{op}{ds}/>'
    )


def legend_items(spec):
    raw = spec.get("legend")
    if isinstance(raw, list):
        return raw
    if isinstance(raw, dict):
        return raw.get("items") or []
    return []


def draw_agenda(spec):
    item = spec["item"]
    steps = item["steps"]
    w, gap, h = 150, 22, 58
    pad_x, pad_y = 28, 70
    vw = pad_x * 2 + len(steps) * w + (len(steps) - 1) * gap
    vh = 180
    pid = "hatch-agenda"
    out = [svg_start(vw, vh, spec["title"], hatch_def(pid))]
    out.append(text(pad_x, 28, item["label"], size=15, weight="bold"))
    out.append(text(pad_x, 46, item["body"], size=11, fill=MUTED, family=SANS))
    last = len(steps) - 1
    for i, st in enumerate(steps):
        x = pad_x + i * (w + gap)  # x = i * (chipW + gap)
        y = pad_y
        fill, tc = (GREEN, CREAM) if i == last else (f"url(#{pid})", INK)
        out.append(rect(x, y, w, h, fill=fill, sw=1.4))
        out.append(text(x + w / 2, y + 24, st.get("label") or st["state"],
                        size=13, fill=tc, anchor="middle", weight="bold"))
        out.append(text(x + w / 2, y + 42, st["state"],
                        size=11, fill=tc if i == last else MUTED, anchor="middle", family=SANS))
        out.append(text(x + w / 2, y + h + 18, fmt_date(st.get("date")),
                        size=11, fill=INK, anchor="middle", family=SANS))
        if i < last:
            ax = x + w + 4
            ay = y + h / 2
            out.append(
                f'<path d="M{ax:.1f},{ay:.1f} L{ax + gap - 8:.1f},{ay:.1f}" '
                f'stroke="{INK}" stroke-width="1.2"/>'
                f'<polygon points="{ax + gap - 8:.1f},{ay - 4:.1f} '
                f'{ax + gap - 2:.1f},{ay:.1f} {ax + gap - 8:.1f},{ay + 4:.1f}" fill="{INK}"/>'
            )
    out.append("</svg>")
    return "".join(out)


FUNNEL_UNIT = 36.0  # width = 36 * value px  (deferred 5 is 5× forwarded 1)


def draw_funnel(spec):
    stages = spec["stages"]
    items = spec.get("items") or []
    by_state = {}
    for it in items:
        by_state.setdefault(it["state"], []).append(it["label"])
    bh, gap = 46, 12
    label_w = 110
    pad_y = 24
    max_v = max(st["value"] for st in stages)
    vw = 820
    table_y = pad_y + len(stages) * (bh + gap) + 8
    vh = table_y + 22 + 16 * (len(items) + 1)
    pid = "hatch-funnel"
    fills = {
        "forwarded": GREEN,
        "deferred": CLAY,
        "recessed": f"url(#{pid})",
        "withdrawn": "none",
    }
    out = [svg_start(vw, vh, spec["title"], hatch_def(pid))]
    cx = label_w + 20 + (FUNNEL_UNIT * max_v) / 2
    for i, st in enumerate(stages):
        val = st["value"]
        width = FUNNEL_UNIT * val
        y = pad_y + i * (bh + gap)
        x = cx - width / 2
        fill = fills.get(st["state"], GREEN)
        tc = CREAM if st["state"] in ("forwarded", "deferred") else INK
        out.append(rect(x, y, width, bh, fill=fill, sw=1.4))
        out.append(text(label_w - 8, y + 28, st["label"], size=13, anchor="end", weight="bold"))
        out.append(text(x + width / 2, y + 29, str(val), size=16, fill=tc, anchor="middle", weight="bold"))
    out.append(text(28, table_y, "Items", size=12, weight="bold", family=SANS))
    for j, it in enumerate(items):
        y = table_y + 18 + j * 16
        out.append(text(28, y, it["label"], size=11, family=SANS))
        out.append(text(vw - 28, y, it["state"], size=11, anchor="end", fill=MUTED, family=SANS))
    out.append("</svg>")
    return "".join(out)


def draw_org(spec):
    nodes = {n["id"]: n for n in spec["nodes"]}
    bw, bh = 260, 50
    vw, vh = 960, 420
    pos = {
        "city-council": (40, 24),
        "county-council": (350, 24),
        "commissioners": (660, 24),
        "bpw": (40, 130),
        "redevelopment": (40, 200),
        "budget-committee": (350, 130),
        "apc": (195, 300),
        "bza": (660, 300),
    }
    pid = "hatch-org"
    out = [svg_start(vw, vh, spec["title"], hatch_def(pid))]

    def top_of(nid):
        x, y = pos[nid]
        return x + bw / 2, y

    def bot_of(nid):
        x, y = pos[nid]
        return x + bw / 2, y + bh

    # Vertical reports-to: parent-bottom to child-top. No "reports-to" labels.
    verticals = [
        ("city-council", "bpw"),
        ("city-council", "redevelopment"),
        ("county-council", "budget-committee"),
    ]
    for parent, child in verticals:
        if parent not in pos or child not in pos:
            continue
        bx, by = bot_of(parent)
        tx, ty = top_of(child)
        if parent == "city-council" and child == "redevelopment":
            gx = pos[parent][0] - 12
            out.append(
                f'<path d="M{bx:.1f},{by:.1f} H{gx:.1f} V{ty:.1f} H{tx:.1f}" '
                f'fill="none" stroke="{INK}" stroke-width="1.2"/>'
            )
        else:
            out.append(
                f'<line x1="{bx:.1f}" y1="{by:.1f}" x2="{tx:.1f}" y2="{ty:.1f}" '
                f'stroke="{INK}" stroke-width="1.2"/>'
            )

    # APC recommends-to: orthogonal dashed paths in the column GAPS, never through boxes.
    if "apc" in pos and "city-council" in pos and "county-council" in pos:
        apx, apy = pos["apc"]
        cix, ciy = pos["city-council"]
        cox, coy = pos["county-council"]
        # City–county gap (~x=325): APC top -> gap -> city right-bottom.
        gap_l = cix + bw + (cox - (cix + bw)) / 2  # 325
        out.append(
            f'<path d="M{gap_l:.1f},{apy:.1f} V {ciy + bh:.1f} H {cix + bw:.1f}" '
            f'fill="none" stroke="{INK}" stroke-width="1.15" stroke-dasharray="5 4"/>'
        )
        # County–commissioners gap (~x=635): APC right -> gap -> county right-bottom.
        comx = pos["commissioners"][0]
        gap_r = cox + bw + (comx - (cox + bw)) / 2  # 635
        out.append(
            f'<path d="M{apx + bw:.1f},{apy:.1f} H {gap_r:.1f} V {coy + bh:.1f} H {cox + bw:.1f}" '
            f'fill="none" stroke="{INK}" stroke-width="1.15" stroke-dasharray="5 4"/>'
        )
        out.append(text(apx + bw / 2, apy + bh + 16, "recommends to both councils",
                        size=10, fill=MUTED, family=SANS, anchor="middle"))

    for nid, node in nodes.items():
        if nid not in pos:
            continue
        x, y = pos[nid]
        covered = node.get("coverage") == "covered"
        fill = GREEN if covered else "none"
        tc = CREAM if covered else INK
        sw = 1.5 if covered else 1.7
        out.append(rect(x, y, bw, bh, fill=fill, sw=sw))
        lines = wrap(node["label"], 26)
        ty = y + (20 if len(lines) == 1 else 14)
        out.append(text(x + bw / 2, ty, lines, size=12, fill=tc, anchor="middle", weight="bold", dy=13))
        out.append(text(x + bw / 2, y + bh - 7, node.get("kind") or "",
                        size=9, fill=tc if covered else MUTED, anchor="middle", family=SANS))
    out.append("</svg>")
    return "".join(out)


def draw_vote_matrix(spec):
    members = spec["members"]
    items = spec["items"]
    cells = {(c["member"], c["item"]): c["vote"] for c in spec.get("cells") or []}
    item = items[0]
    left, seat_w, cell_w, row_h = 250, 110, 110, 38
    header_h, pad = 96, 28
    square = 26
    vw = pad + left + seat_w + len(items) * cell_w + 48
    vh = pad + header_h + len(members) * row_h + 36
    pid = "hatch-vote"
    rule = "#c9c0b0"
    out = [svg_start(vw, vh, spec["title"], hatch_def(pid))]
    out.append(text(pad, 22, spec.get("body") or "", size=12, fill=MUTED, family=SANS))
    out.append(text(pad, 40, spec.get("date") or "", size=11, fill=MUTED, family=SANS))
    out.append(text(pad, 60, item["label"], size=13, weight="bold"))
    col_x = pad + left + seat_w
    out.append(text(col_x + cell_w / 2, header_h - 12, "Vote", size=10, fill=MUTED, anchor="middle", family=SANS))
    out.append(text(pad, header_h - 12, "Member", size=10, fill=MUTED, family=SANS))
    out.append(text(pad + left, header_h - 12, "Seat", size=10, fill=MUTED, family=SANS))
    mover, seconder = item.get("mover"), item.get("seconder")
    for i, mem in enumerate(members):
        y = header_h + i * row_h
        stripe = EMPTY if i % 2 == 0 else PAPER
        out.append(rect(pad - 6, y, left + seat_w + cell_w + 16, row_h, fill=stripe, stroke="none", rx=0))
        mark = ""
        if mem["id"] == mover:
            mark = "  M"
        elif mem["id"] == seconder:
            mark = "  S"
        out.append(text(pad, y + 25, mem["label"] + mark, size=13,
                        weight="bold" if mark else "normal"))
        out.append(text(pad + left, y + 25, mem.get("seat") or "", size=12, fill=MUTED, family=SANS))
        vote = cells.get((mem["id"], item["id"]))
        x = col_x + (cell_w - square) / 2
        sy = y + (row_h - square) / 2
        if vote == "yea":
            out.append(rect(x, sy, square, square, fill=GREEN, sw=1.2, rx=2))
            out.append(text(x + square / 2, sy + 18, "Y", size=13, fill=CREAM,
                            anchor="middle", weight="bold", family=SANS))
        elif vote == "nay":
            out.append(rect(x, sy, square, square, fill=f"url(#{pid})", sw=1.2, rx=2))
            out.append(text(x + square / 2, sy + 18, "N", size=13,
                            anchor="middle", weight="bold", family=SANS))
        else:
            out.append(rect(x, sy, square, square, fill=EMPTY, stroke=rule, sw=1.0, rx=2))
    tally = item.get("result") or ""
    out.append(text(pad, vh - 18, tally, size=13, weight="bold"))
    out.append("</svg>")
    return "".join(out)


def draw_impact(spec):
    item = spec["item"]
    touches = spec["touches"]
    pid = "hatch-impact"
    vw, vh = 820, 260
    out = [svg_start(vw, vh, spec["title"], hatch_def(pid))]
    hx, hy, hw, hh = 28, 70, 250, 120
    out.append(rect(hx, hy, hw, hh, fill=CLAY, sw=1.5, rx=8))
    out.append(text(hx + hw / 2, hy + 32, wrap(item["label"], 22),
                    size=14, fill=CREAM, anchor="middle", weight="bold", dy=16))
    out.append(text(hx + hw / 2, hy + 78, item.get("body") or "", size=11, fill=CREAM, anchor="middle", family=SANS))
    out.append(text(hx + hw / 2, hy + 98, item.get("action") or "", size=11, fill=CREAM, anchor="middle", family=SANS))
    n = len(touches)
    hubx, huby = hx + hw, hy + hh / 2
    R = 280
    for i, t in enumerate(touches):
        ang = 0.0 if n == 1 else -0.45 + i * (0.90 / (n - 1))
        cx = hubx + 40 + R * math.cos(ang) * 0.55
        cy = huby + R * math.sin(ang)
        tw, th = 350, 78
        x = cx - 20
        y = cy - th / 2
        kind = t.get("kind")
        fill = GREEN if kind == "taxpayers" else f"url(#{pid})"
        tc = CREAM if kind == "taxpayers" else INK
        out.append(
            f'<path d="M{hubx:.1f},{huby:.1f} C{(hubx + x) / 2:.1f},{huby:.1f} '
            f'{(hubx + x) / 2:.1f},{cy:.1f} {x:.1f},{cy:.1f}" fill="none" '
            f'stroke="{INK}" stroke-width="1.3"/>'
        )
        out.append(rect(x, y, tw, th, fill=fill, sw=1.5, rx=8))
        out.append(text(x + 16, y + 28, wrap(t["label"], 38), size=13, fill=tc, weight="bold", dy=15))
        out.append(text(x + 16, y + th - 12, kind or "", size=10,
                        fill=tc if kind == "taxpayers" else MUTED, family=SANS))
    out.append("</svg>")
    return "".join(out)


def draw_pipeline(spec):
    stages = spec["stages"]
    edges = spec.get("edges") or []
    ids = [s["id"] for s in stages]
    idx = {s["id"]: i for i, s in enumerate(stages)}
    back = {(e["from"], e["to"]) for e in edges
            if e["from"] in idx and e["to"] in idx and idx[e["to"]] < idx[e["from"]]}
    rank = {i: 0 for i in ids}
    changed = True
    while changed:
        changed = False
        for e in edges:
            if (e["from"], e["to"]) in back:
                continue
            if e["from"] not in rank or e["to"] not in rank:
                continue
            nr = rank[e["from"]] + 1
            if nr > rank[e["to"]]:
                rank[e["to"]] = nr
                changed = True
    w, gap, h = 96, 18, 70
    pad_x, pad_y = 20, 36
    max_r = max(rank.values()) if rank else 0
    vw = pad_x * 2 + (max_r + 1) * w + max_r * gap
    vh = 200
    pid = "hatch-pipe"
    marker = (
        f'<defs><marker id="arr-pipe" markerWidth="8" markerHeight="8" refX="7" refY="3" '
        f'orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="{INK}"/></marker></defs>'
    )
    out = [svg_start(vw, vh, spec["title"], hatch_def(pid) + marker)]
    boxes = {}
    for st in stages:
        x = pad_x + rank[st["id"]] * (w + gap)  # x = rank * (w+gap)
        y = pad_y
        boxes[st["id"]] = (x, y, w, h)
        human = st.get("gate") == "human"
        fill = f"url(#{pid})" if human else GREEN
        tc = INK if human else CREAM
        sw = 3.2 if human else 1.25
        out.append(rect(x, y, w, h, fill=fill, sw=sw, rx=6))
        out.append(text(x + w / 2, y + 28, wrap(st["label"], 12),
                        size=11, fill=tc, anchor="middle", weight="bold", dy=13))
        out.append(text(x + w / 2, y + h - 10, st.get("gate") or "",
                        size=9, fill=tc, anchor="middle", family=SANS))
    for e in edges:
        a, b = e["from"], e["to"]
        if a not in boxes or b not in boxes:
            continue
        ax, ay, aw, ah = boxes[a]
        bx, by, bw, bh = boxes[b]
        if (a, b) in back:
            x1, y1 = ax + aw / 2, ay + ah
            x2, y2 = bx + bw / 2, by + ah
            out.append(
                f'<path d="M{x1:.1f},{y1:.1f} C{x1:.1f},{y1 + 48:.1f} {x2:.1f},{y2 + 48:.1f} '
                f'{x2:.1f},{y2:.1f}" fill="none" stroke="{INK}" stroke-width="1.3" '
                f'stroke-dasharray="6 4"/>'
            )
        else:
            x1, y1 = ax + aw, ay + ah / 2
            x2, y2 = bx, by + bh / 2
            out.append(
                f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" '
                f'stroke="{INK}" stroke-width="1.2" marker-end="url(#arr-pipe)"/>'
            )
    out.append("</svg>")
    return "".join(out)


def draw_hemicycle(spec):
    seats = spec["seats"]
    n = len(seats)
    cx, cy, r, sr = 400, 200, 150, 17
    vw, vh = 800, 400
    out = [svg_start(vw, vh, spec["title"])]
    # Inner rail, well inside the seats so the stroke never bisects the end chairs.
    rail_r = r - sr - 10
    out.append(
        f'<path d="M{cx - rail_r:.1f},{cy:.1f} A{rail_r:.1f},{rail_r:.1f} 0 0 1 '
        f'{cx + rail_r:.1f},{cy:.1f}" fill="none" stroke="{EMPTY}" stroke-width="8"/>'
    )
    floor_y = cy + sr + 10
    out.append(
        f'<line x1="{cx - r + sr:.1f}" y1="{floor_y:.1f}" x2="{cx + r - sr:.1f}" y2="{floor_y:.1f}" '
        f'stroke="{INK}" stroke-width="1.15"/>'
    )
    item = spec.get("item") or {}
    out.append(text(cx, floor_y + 28, item.get("label") or "", size=12, anchor="middle", weight="bold"))
    summ = spec.get("summary") or {}
    tally = f"{summ.get('present', 7)} present, {summ.get('absent', 2)} absent · passed unanimously"
    out.append(text(cx, floor_y + 48, tally, size=13, fill=INK, anchor="middle", weight="bold", family=SANS))
    for i, seat in enumerate(seats):
        ang = math.pi - i * math.pi / max(n - 1, 1)
        x = cx + r * math.cos(ang)
        y = cy - r * math.sin(ang)
        vote = seat.get("vote")
        if vote == "yea":
            fill, sw = GREEN, 1.2
        else:
            fill, sw = PAPER, 1.6
        out.append(
            f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{sr}" fill="{fill}" '
            f'stroke="{INK}" stroke-width="{sw}"/>'
        )
        label = seat.get("label")
        if not label:
            continue
        cos_a = math.cos(ang)
        r_label = r + sr + 26
        lx = cx + r_label * math.cos(ang)
        ly = cy - r_label * math.sin(ang)
        if cos_a < -0.25:
            anchor = "end"
        elif cos_a > 0.25:
            anchor = "start"
        else:
            anchor = "middle"
        ly = max(16, ly)
        last = label.split()[-1]
        out.append(text(lx, ly, last, size=12, anchor=anchor, weight="bold"))
    out.append("</svg>")
    return "".join(out)


def draw_heatmap(spec):
    rows, cols = spec["rows"], spec["columns"]
    lookup = {(c["row"], c["column"]): c for c in spec.get("cells") or []}
    scale = spec.get("scale") or {}
    smax = scale.get("max") or 1
    rlab, cw, ch, gap = 168, 130, 38, 6
    pad_x, pad_y = 16, 44
    vw = pad_x + rlab + len(cols) * (cw + gap) + 20
    vh = pad_y + len(rows) * (ch + gap) + 16
    out = [svg_start(vw, vh, spec["title"])]
    for ci, col in enumerate(cols):
        x = pad_x + rlab + ci * (cw + gap) + cw / 2
        out.append(text(x, 28, col["label"], size=12, anchor="middle", weight="bold", family=SANS))
    for ri, row in enumerate(rows):
        y = pad_y + ri * (ch + gap)
        out.append(text(pad_x + rlab - 10, y + ch / 2 + 4, row["label"], size=12, anchor="end"))
        for ci, col in enumerate(cols):
            x = pad_x + rlab + ci * (cw + gap)
            cell = lookup.get((row["id"], col["id"]))
            if cell is None:
                out.append(rect(x, y, cw, ch, fill=EMPTY, sw=1.0, rx=3))
            else:
                op = (cell["value"] / smax) if smax else 1
                out.append(rect(x, y, cw, ch, fill=GREEN, opacity=op, sw=1.2, rx=3))
                out.append(text(x + cw / 2, y + ch / 2 + 4, str(cell["value"]), size=13, fill=CREAM,
                                anchor="middle", weight="bold"))
    out.append("</svg>")
    return "".join(out)


def draw_network(spec):
    nodes = spec["nodes"]
    edges = spec.get("edges") or []
    vw, vh = 760, 360
    pid = "hatch-net"
    out = [svg_start(vw, vh, spec["title"], hatch_def(pid))]
    rr = 32
    pos = {
        "garfield": (380, 155),
        "mason": (160, 70),
        "sacred-heart": (600, 70),
        "city-council": (380, 280),
    }
    for e in edges:
        a, b = e.get("from"), e.get("to")
        if a not in pos or b not in pos:
            continue
        x1, y1 = pos[a]
        x2, y2 = pos[b]
        dx, dy = x2 - x1, y2 - y1
        length = math.hypot(dx, dy) or 1.0
        ux, uy = dx / length, dy / length
        gap = rr + 2
        x1e, y1e = x1 + ux * gap, y1 + uy * gap
        x2e, y2e = x2 - ux * gap, y2 - uy * gap
        out.append(
            f'<line x1="{x1e:.1f}" y1="{y1e:.1f}" x2="{x2e:.1f}" y2="{y2e:.1f}" '
            f'stroke="{INK}" stroke-width="1.3"/>'
        )
        dx, dy = x2 - x1, y2 - y1
        length = math.hypot(dx, dy) or 1.0
        px, py = -dy / length, dx / length
        off = 28 if abs(dx) < 8 else 18
        mx = (x1 + x2) / 2 + off * px
        my = (y1 + y2) / 2 + off * py
        rel = e.get("rel") or ""
        if rel:
            out.append(text(mx, my, rel, size=10, fill=MUTED, anchor="middle", family=SANS))
    kind_fill = {
        "developer": GREEN,
        "neighborhood": f"url(#{pid})",
        "place": PAPER,
        "body": f"url(#stripes-{pid})",
    }
    for n in nodes:
        if n["id"] not in pos:
            continue
        x, y = pos[n["id"]]
        fill = kind_fill.get(n.get("kind"), PAPER)
        sw = 1.7 if n.get("kind") == "place" else 1.3
        out.append(
            f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{rr}" fill="{fill}" '
            f'stroke="{INK}" stroke-width="{sw}"/>'
        )
        if n["id"] == "garfield":
            out.append(text(x + rr + 10, y + 4, n["label"], size=12, fill=INK,
                            anchor="start", weight="bold"))
        else:
            out.append(text(x, y + rr + 28, wrap(n["label"], 18), size=12, fill=INK,
                            anchor="middle", weight="bold", dy=14))
    out.append("</svg>")
    return "".join(out)


def donut_arc(cx, cy, r_out, r_in, a0, a1):
    def pt(r, a):
        return cx + r * math.cos(a), cy + r * math.sin(a)

    large = 1 if (a1 - a0) > math.pi else 0
    x0, y0 = pt(r_out, a0)
    x1, y1 = pt(r_out, a1)
    x2, y2 = pt(r_in, a1)
    x3, y3 = pt(r_in, a0)
    return (
        f"M {x0:.2f},{y0:.2f} "
        f"A {r_out:.2f},{r_out:.2f} 0 {large} 1 {x1:.2f},{y1:.2f} "
        f"L {x2:.2f},{y2:.2f} "
        f"A {r_in:.2f},{r_in:.2f} 0 {large} 0 {x3:.2f},{y3:.2f} Z"
    )


def draw_donut(spec):
    slices = spec["slices"]
    total = sum(s["value"] for s in slices) or 1
    cx, cy, r_out, r_in = 300, 175, 128, 74
    vw, vh = 620, 350
    out = [svg_start(vw, vh, spec["title"])]
    theta = -math.pi / 2
    for sl in slices:
        sweep = sl["value"] / total * 2 * math.pi
        d = donut_arc(cx, cy, r_out, r_in, theta, theta + sweep)
        sid = (sl.get("id") or sl.get("label") or "").lower()
        if sid == "present":
            fill, sw = GREEN, 1.2
        else:
            fill, sw = PAPER, 1.6
        out.append(f'<path d="{d}" fill="{fill}" stroke="{INK}" stroke-width="{sw}"/>')
        mid = theta + sweep / 2
        lx = cx + (r_out + 28) * math.cos(mid)
        ly = cy + (r_out + 28) * math.sin(mid)
        out.append(text(lx, ly, f"{sl['label']} {sl['value']}", size=12, anchor="middle", weight="bold"))
        theta += sweep
    center = (spec.get("center") or {}).get("label") or ""
    out.append(text(cx, cy + 5, center, size=13, anchor="middle", weight="bold"))
    out.append("</svg>")
    return "".join(out)


DRAW = {
    "agenda-states": draw_agenda,
    "outcome-funnel": draw_funnel,
    "org": draw_org,
    "vote-matrix": draw_vote_matrix,
    "impact": draw_impact,
    "pipeline": draw_pipeline,
    "hemicycle": draw_hemicycle,
    "heatmap-table": draw_heatmap,
    "network": draw_network,
    "donut": draw_donut,
}

CSS = """
:root { --cream: #f6f1e4; --ink: #1a1a1a; --muted: #5c574f; --green: #3d5a45; --rule: #c9c0b0; --paper: #fbf7ee; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: var(--cream); color: var(--ink); }
body { font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif; line-height: 1.45; }
header.mast { max-width: 960px; margin: 0 auto; padding: 36px 28px 20px; border-bottom: 3px solid var(--ink); }
.kicker { font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--green); margin: 0 0 8px; }
.intro { font-size: 18px; margin: 0; max-width: 46em; }
main { max-width: 960px; margin: 0 auto; padding: 8px 28px 72px; }
section.figure { padding: 32px 0 24px; border-bottom: 1px solid var(--rule); }
h2 { font-size: 24px; margin: 0 0 14px; letter-spacing: -0.015em; }
svg { display: block; width: 100%; height: auto; background: var(--paper); border: 1px solid var(--rule); }
p.caption { font-size: 16px; margin: 12px 0 4px; max-width: 46em; }
p.source { font-family: "Franklin Gothic Medium", "News Gothic", "Helvetica Neue", sans-serif; font-size: 12px; color: var(--muted); margin: 0 0 10px; }
p.source a { color: var(--green); }
div.legend { font-family: "Franklin Gothic Medium", "News Gothic", "Helvetica Neue", sans-serif; font-size: 12px; }
div.legend .leg { display: inline-flex; align-items: center; gap: 8px; margin: 0 16px 6px 0; }
.swatch { width: 14px; height: 14px; border: 1px solid var(--ink); display: inline-block; }
.swatch.solid { background: var(--green); }
.swatch.hatch { background: repeating-linear-gradient(-45deg, var(--ink), var(--ink) 1px, var(--cream) 1px, var(--cream) 5px); }
.swatch.empty { background: var(--cream); }
.swatch.stripes { background: repeating-linear-gradient(90deg, var(--ink), var(--ink) 1px, var(--cream) 1px, var(--cream) 5px); }
footer { max-width: 960px; margin: 0 auto; padding: 12px 28px 48px; font-size: 12px; color: var(--muted); }
"""

INTRO = (
    "Process family render · The Vigo Ledger · Vol. I No. 1. Geometry from YAML. "
    "Vote graphics are descriptive — the Ledger does not score officials."
)


def figure_html(spec, svg):
    title = esc(spec.get("title") or spec["type"])
    cap = esc(spec.get("caption") or "")
    src = spec.get("source") or {}
    href = esc(src.get("href") or "#")
    slabel = esc(src.get("label") or href)
    legs = []
    for it in legend_items(spec):
        sw = it.get("swatch") or it.get("pattern") or "empty"
        legs.append(f'<span class="leg"><i class="swatch {esc(sw)}"></i> {esc(it.get("label") or "")}</span>')
    sid = esc(spec["type"])
    return (
        f'<section class="figure" id="{sid}">\n'
        f"  <h2>{title}</h2>\n"
        f"  {svg}\n"
        f'  <p class="caption">{cap}</p>\n'
        f'  <p class="source">Source: <a href="{href}">{slabel}</a></p>\n'
        f'  <div class="legend">{"".join(legs)}</div>\n'
        f"</section>\n"
    )


def main():
    specs = []
    for name in FILES:
        spec = parse_yaml((EX / name).read_text())
        specs.append(spec)

    funnel = next(s for s in specs if s["type"] == "outcome-funnel")
    assert [st["value"] for st in funnel["stages"]] == [1, 5, 1, 1]
    donut = next(s for s in specs if s["type"] == "donut")
    assert [st["value"] for st in donut["slices"]] == [7, 2]
    heat = next(s for s in specs if s["type"] == "heatmap-table")
    assert heat["cells"][0]["value"] == 4
    hemi = next(s for s in specs if s["type"] == "hemicycle")
    assert sum(1 for s in hemi["seats"] if s.get("vote") == "yea") == 7
    assert sum(1 for s in hemi["seats"] if s.get("vote") == "absent") == 2
    vote = next(s for s in specs if s["type"] == "vote-matrix")
    assert len(vote["members"]) == 9
    assert {(c["member"], c["vote"]) for c in vote["cells"]} == {("loudermilk", "yea"), ("hinton", "yea")}

    parts = [
        "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n"
        '<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        "<title>Process family render · The Vigo Ledger · Vol. I No. 1</title>\n"
        f"<style>{CSS}</style>\n</head>\n<body>\n"
        '<header class="mast">'
        '<p class="kicker">The Vigo Ledger · Vol. I No. 1 · week of Aug 28, 2026</p>'
        f'<p class="intro">{esc(INTRO)}</p></header>\n<main>\n'
    ]
    for spec in specs:
        drawer = DRAW[spec["type"]]
        parts.append(figure_html(spec, drawer(spec)))
    parts.append(
        "</main>\n<footer>The Vigo Ledger · Vol. I No. 1 · diagrams-backlog/demos/process.html</footer>\n"
        "</body>\n</html>\n"
    )
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("".join(parts), encoding="utf-8")
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
