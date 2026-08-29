#!/usr/bin/env python3
"""Stitch civic-backlog/demos/*.gz.b64.NN chunks, decode to real demo files, delete payloads."""
import base64, gzip
from collections import defaultdict
from pathlib import Path
root = Path(__file__).resolve().parent

groups = defaultdict(list)
for p in root.glob("*.gz.b64.*"):
    base, idx = p.name.rsplit(".", 1)
    if idx.isdigit():
        groups[base].append((int(idx), p))
for base, items in groups.items():
    text = "".join(p.read_text() for _, p in sorted(items))
    (root / base).write_text(text)
    for _, p in items:
        p.unlink()
    print("stitched", base, len(text))

for p in sorted(root.glob("*.gz.b64")):
    name = p.name[: -len(".gz.b64")]
    out = root / name
    out.write_bytes(gzip.decompress(base64.b64decode(p.read_text())))
    p.unlink()
    print("wrote", out.name, out.stat().st_size)
