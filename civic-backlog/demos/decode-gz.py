#!/usr/bin/env python3
"""Decode civic-backlog/demos/*.gz.b64 into the real demo files, then delete the payloads."""
import base64, gzip
from pathlib import Path
root = Path(__file__).resolve().parent
for p in sorted(root.glob("*.gz.b64")):
    name = p.name[: -len(".gz.b64")]
    out = root / name
    out.write_bytes(gzip.decompress(base64.b64decode(p.read_text())))
    p.unlink()
    print("wrote", out.name, out.stat().st_size)
