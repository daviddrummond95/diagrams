#!/usr/bin/env node
/**
 * Time-family demo renderer. Geometry from YAML via parseISODate + xOf.
 * Not the diagrams.sh library. Cream broadsheet HTML.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const EXAMPLES = join(ROOT, "examples");
const OUT = join(__dirname, "time.html");

const INK = "#1A1A1A";
const CREAM = "#F6F1E8";
const PAPER = "#fbf7ee";
const BLUE = "#1e3a5f";
const AMBER = "#b8860b";
const RULE = "#cfc6b0";
const MUTED = "#5c5346";
const FONT = "Georgia, 'Iowan Old Style', Palatino, serif";
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const FILES = [
  "ledger-timeline-wheel-tax.yaml",
  "ledger-timeline-n12th.yaml",
  "ledger-gantt-zoning.yaml",
  "ledger-weekstrip.yaml",
  "ledger-entity-timeline-susies.yaml",
  "ledger-entity-project-holly.yaml",
  "ledger-calendar-heatmap-august.yaml",
  "ledger-sparkline-911.yaml",
];

/** YYYY-MM-DD → UTC midnight; YYYY-MM → first of month. */
export function parseISODate(value, field = "date") {
  if (typeof value !== "string") {
    throw new Error(`unparseable ${field}: ${value}`);
  }
  const m = value.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?(?:T(\d{2}):(\d{2}))?$/);
  if (!m) throw new Error(`unparseable ${field}: ${value}`);
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = m[3] ? Number(m[3]) : 1;
  const hh = m[4] ? Number(m[4]) : 0;
  const mm = m[5] ? Number(m[5]) : 0;
  return Date.UTC(y, mo, d, hh, mm, 0, 0);
}

/** xOf(t, t0, t1, x0, x1) = x0 + (t-t0)/(t1-t0)*(x1-x0). Never index*step. */
export function xOf(t, t0, t1, x0, x1) {
  if (t1 === t0) return (x0 + x1) / 2;
  return x0 + ((t - t0) / (t1 - t0)) * (x1 - x0);
}

const computedX = {}; // ISO date -> pixel x (timelines)
const extraComments = [];

function round2(n) {
  return Math.round(n * 100) / 100;
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrap(text, width) {
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines = [];
  let cur = words[0];
  for (const w of words.slice(1)) {
    const trial = `${cur} ${w}`;
    if (trial.length <= width) cur = trial;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  lines.push(cur);
  return lines;
}

function fmtMD(ms) {
  const d = new Date(ms);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

function fmtISO(ms) {
  const d = new Date(ms);
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}-${m}-${day}`;
}

function formatValue(value, unit) {
  const u = typeof unit === "string" ? unit : unit?.unit;
  if (u !== "usd") return String(value);
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1e6) {
    const n = abs / 1e6;
    const s = n >= 10 ? n.toFixed(0) : String(+n.toFixed(1));
    return `${sign}$${s}M`;
  }
  if (abs >= 1000) {
    const n = abs / 1000;
    const s = n >= 10 ? n.toFixed(0) : String(+n.toFixed(1));
    return `${sign}$${s}k`;
  }
  return `${sign}$${abs}`;
}

function text(x, y, s, { size = 12, anchor = "start", fill = INK, weight = "normal", italic = false } = {}) {
  return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${size}" text-anchor="${anchor}" fill="${fill}" font-weight="${weight}" font-style="${italic ? "italic" : "normal"}">${esc(s)}</text>`;
}

function svgDoc(w, h, aria, body, comments = []) {
  const cmt = comments.map((c) => `<!-- ${c} -->`).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.round(w)} ${Math.round(h)}" role="img" aria-label="${esc(aria)}" font-family="${FONT}">
${cmt}
${body}
</svg>`;
}

function addDays(ms, n) {
  return ms + n * 86400000;
}

function monthTicks(t0, t1) {
  const a = new Date(t0);
  let y = a.getUTCFullYear();
  let m = a.getUTCMonth();
  const ticks = [];
  // include t0
  ticks.push(t0);
  m += 1;
  if (m > 11) {
    m = 0;
    y += 1;
  }
  while (true) {
    const t = Date.UTC(y, m, 1);
    if (t >= t1) break;
    if (t > t0) ticks.push(t);
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  ticks.push(t1);
  return ticks;
}

// Shared px/day so 28d vs 7d is ~4× in pixel space (not same chart width).
let timelineScale = null;

function ensureTimelineScale(specs) {
  if (timelineScale) return timelineScale;
  const timelines = specs.filter((s) => s.type === "timeline" && s.from && s.to);
  let best = null;
  let bestSpan = -1;
  for (const s of timelines) {
    const t0 = parseISODate(s.from, "from");
    const t1 = parseISODate(s.to, "to");
    const span = t1 - t0;
    if (span > bestSpan) {
      bestSpan = span;
      best = { t0, t1 };
    }
  }
  const x0 = 72;
  const x1 = 812; // 740px axis on the longest domain
  timelineScale = {
    pxPerMs: (x1 - x0) / bestSpan,
    x0,
    refX1: x1,
  };
  return timelineScale;
}

function axisFor(spec) {
  const t0 = parseISODate(spec.from, "from");
  const t1 = parseISODate(spec.to, "to");
  const scale = ensureTimelineScale([spec]);
  const x0 = scale.x0;
  const x1 = x0 + (t1 - t0) * scale.pxPerMs;
  return { t0, t1, x0, x1 };
}

function renderTimeline(spec, { brokenThumb = false } = {}) {
  const { t0, t1, x0, x1 } = axisFor(spec);
  const events = [...spec.events].sort(
    (a, b) => parseISODate(a.date, "events.date") - parseISODate(b.date, "events.date"),
  );
  const placed = events.map((ev, i) => {
    const t = parseISODate(ev.date, `events[${i}].date`);
    const x = xOf(t, t0, t1, x0, x1);
    computedX[ev.date] = round2(x);
    extraComments.push(`x ${ev.date} = ${round2(x)} (${spec.title})`);
    return { ...ev, t, x };
  });

  const cardW = 150;
  const W = 880;
  const H = 300;
  const axisY = 216;
  const minConnector = 16;
  const cards = placed.map((ev) => {
    const titleLines = wrap(ev.label, 16);
    const bodyLines = ev.body ? wrap(ev.body, 22) : [];
    const cardH = 10 + titleLines.length * 15 + bodyLines.length * 13 + 14 + 8;
    return { ev, titleLines, bodyLines, cardH };
  });

  // Side-by-side unless |x1-x2| < cardW+12, then stagger Y (first higher, second lower).
  const cardY = cards.map(() => 22);
  for (let i = 1; i < placed.length; i++) {
    if (Math.abs(placed[i].x - placed[i - 1].x) < cardW + 12) {
      cardY[i - 1] = 20;
      cardY[i] = 20 + cards[i - 1].cardH + 10;
    }
  }
  for (let i = 0; i < cards.length; i++) {
    const bottom = cardY[i] + cards[i].cardH;
    if (bottom + minConnector > axisY) {
      cardY[i] = axisY - minConnector - cards[i].cardH;
    }
  }

  const parts = [];
  parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="${PAPER}"/>`);
  parts.push(`<line x1="${x0.toFixed(1)}" y1="${axisY}" x2="${x1.toFixed(1)}" y2="${axisY}" stroke="${INK}" stroke-width="1.4"/>`);

  for (const tick of monthTicks(t0, t1)) {
    const x = xOf(tick, t0, t1, x0, x1);
    parts.push(`<line x1="${x.toFixed(1)}" y1="${axisY - 6}" x2="${x.toFixed(1)}" y2="${axisY + 6}" stroke="${INK}" stroke-width="1"/>`);
    parts.push(text(x, axisY + 20, fmtMD(tick), { size: 11, anchor: "middle", fill: MUTED }));
  }

  cards.forEach((card, i) => {
    const ev = card.ev;
    const cx = ev.x;
    let cardX = cx - cardW / 2;
    cardX = Math.max(8, Math.min(W - cardW - 8, cardX));
    const cy = cardY[i];
    const cardH = card.cardH;
    parts.push(
      `<rect x="${cardX.toFixed(1)}" y="${cy.toFixed(1)}" width="${cardW}" height="${cardH}" rx="2" fill="${CREAM}" stroke="${INK}" stroke-width="1.1"/>`,
    );
    let ty = cy + 18;
    for (const ln of card.titleLines) {
      parts.push(text(cardX + 10, ty, ln, { size: 12, weight: "bold" }));
      ty += 15;
    }
    for (const ln of card.bodyLines) {
      parts.push(text(cardX + 10, ty, ln, { size: 10, fill: BLUE }));
      ty += 13;
    }
    parts.push(text(cardX + 10, ty + 2, fmtMD(ev.t), { size: 10, fill: MUTED }));
    const stubY = cy + cardH;
    parts.push(`<line x1="${cx.toFixed(1)}" y1="${stubY.toFixed(1)}" x2="${cx.toFixed(1)}" y2="${axisY}" stroke="${INK}" stroke-width="1"/>`);
    parts.push(`<circle cx="${cx.toFixed(1)}" cy="${axisY}" r="7" fill="${BLUE}" stroke="${INK}" stroke-width="1.1"/>`);
    parts.push(`<!-- x ${ev.date} = ${round2(cx)} -->`);
  });

  if (placed.length >= 2) {
    const gap = Math.abs(placed[1].x - placed[0].x);
    extraComments.push(`gap ${placed[0].date}→${placed[1].date} = ${round2(gap)}px`);
    parts.push(text(x0, H - 14, `axis ${spec.from} – ${spec.to} · gap ${round2(gap)}px (date-true)`, { size: 10, fill: MUTED }));
  }

  const comments = placed.map((ev) => `x ${ev.date} = ${round2(ev.x)}`);
  const main = svgDoc(W, H, spec.title, parts.join("\n"), comments);

  if (!brokenThumb) return main;

  // Optional thumbnail: even card slots (the bug). Not the main chart.
  const n = placed.length;
  const slot = 210;
  const tw = 8 + n * slot;
  const th = 100;
  const ty = 62;
  const tp = [`<rect x="0" y="0" width="${tw}" height="${th}" fill="${PAPER}"/>`];
  tp.push(`<line x1="24" y1="${ty}" x2="${tw - 24}" y2="${ty}" stroke="${RULE}" stroke-width="1.2"/>`);
  placed.forEach((ev, i) => {
    const x = 24 + i * slot + 90; // equal card slots — NEVER used on the main chart
    tp.push(`<rect x="${(x - 80).toFixed(1)}" y="12" width="160" height="36" rx="2" fill="${CREAM}" stroke="${RULE}" stroke-width="1"/>`);
    tp.push(text(x, 34, ev.label, { size: 10, anchor: "middle", fill: MUTED }));
    tp.push(`<circle cx="${x.toFixed(1)}" cy="${ty}" r="6" fill="${RULE}" stroke="${INK}" stroke-width="1"/>`);
    tp.push(`<line x1="${x.toFixed(1)}" y1="48" x2="${x.toFixed(1)}" y2="${ty}" stroke="${RULE}" stroke-width="1"/>`);
  });
  tp.push(text(tw / 2, th - 12, "broken even-spacing (equal card slots)", { size: 10, anchor: "middle", fill: MUTED, italic: true }));
  const thumb = svgDoc(tw, th, "broken even-spacing", tp.join("\n"), ["even card slots — not the main chart"]);
  return { main, thumb };
}

function ganttRowLabel(task) {
  if (task.id === "zoning") return "Zoning rewrite (~18 mo, open)";
  if (task.id === "sewer-build") return "Sewer construction (open)";
  if (task.id === "sewer-rates-final") return "Rate ordinance (expected)";
  return task.label;
}

function renderGantt(spec) {
  const tasks = spec.tasks;
  const fyStartMonth = spec.fyStartMonth ?? 1;
  const t0 = spec.from
    ? parseISODate(spec.from, "from")
    : parseISODate("2026-01-01", "from");
  const t1 = spec.to
    ? parseISODate(spec.to, "to")
    : parseISODate("2026-10-01", "to");
  const W = 900;
  const labelW = 228;
  const x0 = 240;
  const x1 = 872;
  const headerH = 58;
  const rowH = 44;
  const padTop = 16;
  const H = padTop + headerH + tasks.length * rowH + 24;
  const parts = [];
  parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="${PAPER}"/>`);
  parts.push(`<defs>
  <linearGradient id="openFade" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="${BLUE}" stop-opacity="0.92"/>
    <stop offset="70%" stop-color="${BLUE}" stop-opacity="0.45"/>
    <stop offset="100%" stop-color="${BLUE}" stop-opacity="0"/>
  </linearGradient>
</defs>`);

  // One year label at left of plot; FY is a single dashed tick labeled "FY" (not a second 2026).
  const year = new Date(t0).getUTCFullYear();
  parts.push(text(x0, padTop + 14, String(year), { size: 13, weight: "bold" }));
  const fyXs = [];
  const yStart = new Date(t0).getUTCFullYear() - 1;
  const yEnd = new Date(t1).getUTCFullYear() + 1;
  for (let y = yStart; y <= yEnd; y++) {
    const fyDate = Date.UTC(y, fyStartMonth - 1, 1);
    if (fyDate < t0 - 86400000 || fyDate > t1 + 86400000) continue;
    const fyX = xOf(fyDate, t0, t1, x0, x1);
    fyXs.push(fyX);
    parts.push(`<line x1="${fyX.toFixed(1)}" y1="${padTop + 20}" x2="${fyX.toFixed(1)}" y2="${H - 16}" stroke="${AMBER}" stroke-width="1.1" stroke-dasharray="3 3"/>`);
    parts.push(text(fyX + 8, padTop + 30, "FY", { size: 10, fill: AMBER, weight: "bold" }));
    parts.push(`<!-- FY${y} tick x = ${round2(fyX)} at ${fmtISO(fyDate)} -->`);
  }

  let lastLabelX = -Infinity;
  for (let y = yStart; y <= yEnd; y++) {
    for (let m = 0; m < 12; m++) {
      const mt = Date.UTC(y, m, 1);
      if (mt < t0 || mt > t1) continue;
      const x = xOf(mt, t0, t1, x0, x1);
      const onFY = fyXs.some((fx) => Math.abs(fx - x) < 0.6);
      if (!onFY) {
        parts.push(`<line x1="${x.toFixed(1)}" y1="${padTop + 34}" x2="${x.toFixed(1)}" y2="${H - 16}" stroke="${RULE}" stroke-width="0.6"/>`);
      }
      if (x - lastLabelX < 40) continue;
      const lab = MONTHS[m];
      if (x + 4 + estW(lab, 10) > W - 8) {
        parts.push(text(Math.min(x, W - 8), padTop + 46, lab, { size: 10, fill: MUTED, anchor: "end" }));
      } else {
        parts.push(text(x + 4, padTop + 46, lab, { size: 10, fill: MUTED }));
      }
      lastLabelX = x;
    }
  }
  parts.push(`<line x1="${x0}" y1="${padTop + headerH}" x2="${x1}" y2="${padTop + headerH}" stroke="${INK}" stroke-width="1"/>`);

  tasks.forEach((task, i) => {
    const y = padTop + headerH + i * rowH + 8;
    const mid = y + 12;
    const start = parseISODate(task.start, `tasks[${i}].start`);
    const sx = xOf(start, t0, t1, x0, x1);
    extraComments.push(`gantt ${task.id} start x = ${round2(sx)}`);
    const labelLines = wrap(ganttRowLabel(task), 30);
    const l0 = mid + 4 - ((labelLines.length - 1) * 6);
    labelLines.forEach((ln, li) => {
      parts.push(text(8, l0 + li * 13, ln, { size: 11 }));
    });
    const kind = task.kind || "range";
    if (kind === "milestone") {
      const r = 8;
      const fill = /expected/i.test(task.label) ? AMBER : INK;
      parts.push(`<polygon points="${sx.toFixed(1)},${mid - r} ${sx + r},${mid} ${sx.toFixed(1)},${mid + r} ${sx - r},${mid}" fill="${fill}" stroke="${INK}" stroke-width="1"/>`);
      // Gold fill already marks expected; gutter label carries the word.
      parts.push(`<!-- milestone ${task.id} ${task.start} x=${round2(sx)} -->`);
    } else if (task.open) {
      const fadeStart = sx;
      const w = x1 - fadeStart;
      parts.push(`<rect x="${fadeStart.toFixed(1)}" y="${mid - 8}" width="${w.toFixed(1)}" height="16" fill="url(#openFade)" />`);
      parts.push(`<rect x="${fadeStart.toFixed(1)}" y="${mid - 8}" width="4" height="16" fill="${BLUE}" />`);
      parts.push(`<!-- open range ${task.id} start ${task.start} x=${round2(sx)} fade to axis end; no invented end date -->`);
    } else {
      const end = parseISODate(task.end, `tasks[${i}].end`);
      const ex = xOf(end, t0, t1, x0, x1);
      parts.push(`<rect x="${sx.toFixed(1)}" y="${mid - 8}" width="${Math.max(4, ex - sx).toFixed(1)}" height="16" fill="${BLUE}" stroke="${INK}" stroke-width="0.8"/>`);
    }
  });

  return svgDoc(W, H, spec.title, parts.join("\n"), [
    `gantt width ${W} domain ${spec.from}–${spec.to}`,
    "open ranges fade; no 2027-11-01",
  ]);
}

function renderWeekstrip(spec) {
  const t0 = parseISODate(spec.from, "from");
  const t1 = parseISODate(spec.to, "to");
  const W = 900;
  const H = 200;
  const x0 = 48;
  const x1 = 860;
  const base = 152;
  const maxCount = Math.max(...spec.marks.map((m) => m.count || 1));
  const peakDates = new Set(["2026-07-09", "2026-08-04", "2026-08-12"]);
  const parts = [`<rect x="0" y="0" width="${W}" height="${H}" fill="${PAPER}"/>`];
  parts.push(`<line x1="${x0}" y1="${base}" x2="${x1}" y2="${base}" stroke="${INK}" stroke-width="1.3"/>`);

  for (const tick of monthTicks(t0, t1)) {
    const x = xOf(tick, t0, t1, x0, x1);
    parts.push(`<line x1="${x.toFixed(1)}" y1="${base}" x2="${x.toFixed(1)}" y2="${base + 6}" stroke="${INK}" stroke-width="1"/>`);
    parts.push(text(x, base + 20, fmtMD(tick), { size: 10, anchor: "middle", fill: MUTED }));
  }

  const clusterA = spec.marks.find((m) => m.date === "2026-08-04");
  const clusterB = spec.marks.find((m) => m.date === "2026-08-25");
  if (clusterA && clusterB) {
    const xA = xOf(parseISODate(clusterA.date, "marks.date"), t0, t1, x0, x1);
    const xB = xOf(parseISODate(clusterB.date, "marks.date"), t0, t1, x0, x1);
    const by = 16;
    parts.push(`<line x1="${xA.toFixed(1)}" y1="${by}" x2="${xB.toFixed(1)}" y2="${by}" stroke="${RULE}" stroke-width="1"/>`);
    parts.push(`<line x1="${xA.toFixed(1)}" y1="${by - 4}" x2="${xA.toFixed(1)}" y2="${by + 4}" stroke="${RULE}" stroke-width="1"/>`);
    parts.push(`<line x1="${xB.toFixed(1)}" y1="${by - 4}" x2="${xB.toFixed(1)}" y2="${by + 4}" stroke="${RULE}" stroke-width="1"/>`);
    parts.push(text((xA + xB) / 2, by - 6, "Aug 4–25", { size: 10, anchor: "middle", fill: MUTED }));
  }

  for (const mark of spec.marks) {
    const t = parseISODate(mark.date, "marks.date");
    const x = xOf(t, t0, t1, x0, x1);
    const c = mark.count || 1;
    const h = (c / maxCount) * 100;
    const pct = ((x - x0) / (x1 - x0)) * 100;
    parts.push(`<rect x="${(x - 1.75).toFixed(1)}" y="${(base - h).toFixed(1)}" width="3.5" height="${h.toFixed(1)}" fill="${BLUE}" />`);
    if (peakDates.has(mark.date)) {
      parts.push(text(x, base - h - 12, String(c), { size: 11, anchor: "middle", fill: INK, weight: "bold" }));
    }
    if (mark.date === "2026-08-04") {
      extraComments.push(`weekstrip 2026-08-04 x=${round2(x)} (${round2(pct)}% of strip)`);
      parts.push(`<!-- August cluster start 2026-08-04 x=${round2(x)} = ${round2(pct)}% of strip -->`);
    }
  }

  return svgDoc(W, H, spec.title, parts.join("\n"), [
    `weekstrip ${spec.from}–${spec.to} size=count`,
  ]);
}

function renderEntity(spec) {
  const events = spec.events.map((ev, i) => ({
    ...ev,
    t: parseISODate(ev.date, `events[${i}].date`),
  }));
  events.sort((a, b) => a.t - b.t);
  const minT = events[0].t;
  const maxT = events[events.length - 1].t;
  const t0 = addDays(minT, -3);
  const t1 = addDays(maxT, -3) === t0 ? addDays(maxT, 4) : addDays(maxT, 4);
  const W = 880;
  const laneH = 64;
  const header = 40;
  const H = header + spec.lanes.length * laneH + 36;
  const x0 = 168;
  const x1 = 820;
  const parts = [`<rect x="0" y="0" width="${W}" height="${H}" fill="${PAPER}"/>`];
  parts.push(`<line x1="${x0}" y1="${H - 28}" x2="${x1}" y2="${H - 28}" stroke="${INK}" stroke-width="1.2"/>`);
  for (const tick of monthTicks(t0, t1)) {
    const x = xOf(tick, t0, t1, x0, x1);
    parts.push(`<line x1="${x.toFixed(1)}" y1="${H - 32}" x2="${x.toFixed(1)}" y2="${H - 24}" stroke="${INK}" stroke-width="1"/>`);
    parts.push(text(x, H - 10, fmtMD(tick), { size: 10, anchor: "middle", fill: MUTED }));
  }

  spec.lanes.forEach((lane, i) => {
    const y = header + i * laneH;
    parts.push(text(12, y + 28, lane.label, { size: 12, weight: "bold", fill: BLUE }));
    parts.push(`<line x1="${x0}" y1="${y + 28}" x2="${x1}" y2="${y + 28}" stroke="${RULE}" stroke-width="0.8"/>`);
    for (const ev of events.filter((e) => e.lane === lane.id)) {
      const x = xOf(ev.t, t0, t1, x0, x1);
      extraComments.push(`entity ${ev.date} ${lane.id} x=${round2(x)}`);
      const ask = /no vote|ask/i.test(ev.label);
      if (ask) {
        parts.push(`<circle cx="${x.toFixed(1)}" cy="${y + 28}" r="8" fill="${PAPER}" stroke="${AMBER}" stroke-width="2"/>`);
      } else {
        parts.push(`<circle cx="${x.toFixed(1)}" cy="${y + 28}" r="8" fill="${BLUE}" stroke="${INK}" stroke-width="1.1"/>`);
      }
      let label = ev.label || "";
      const formatted = ev.amount != null ? formatValue(ev.amount, spec.unit) : "";
      const alreadyHasAmt = !formatted ||
        label.includes(formatted) ||
        label.includes(String(ev.amount)) ||
        (typeof ev.amount === "number" && label.includes(ev.amount.toLocaleString("en-US"))) ||
        /\$[\d,.]+k?\b/i.test(label);
      if (formatted && !alreadyHasAmt) label = `${label} ${formatted}`;
      const approxW = label.length * 6.2;
      const overflow = x + 12 + approxW > x1;
      if (overflow) {
        parts.push(text(x - 12, y + 18, label, { size: 11, anchor: "end" }));
        parts.push(text(x - 12, y + 46, fmtMD(ev.t), { size: 10, fill: MUTED, anchor: "end" }));
      } else {
        parts.push(text(x + 12, y + 18, label, { size: 11 }));
        parts.push(text(x + 12, y + 46, fmtMD(ev.t), { size: 10, fill: MUTED }));
      }
      parts.push(`<!-- x ${ev.date} ${lane.id} = ${round2(x)} -->`);
    }
  });

  return svgDoc(W, H, spec.title, parts.join("\n"));
}

function lerpHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
  const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${[r, g, bl].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

function heatColor(v, vmax) {
  if (v <= 0) return PAPER;
  const t = Math.min(1, v / vmax);
  // Single sequential family, light → dark navy. No gold/olive mid.
  return lerpHex("#c5d0dc", BLUE, Math.pow(t, 0.8));
}


function estW(s, size = 12) {
  return String(s ?? "").length * size * 0.54;
}

function isDark(hex) {
  const h = String(hex ?? "").replace("#", "");
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return false;
  const n = parseInt(h, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b < 145;
}

function renderHeatmap(spec) {
  const t0 = parseISODate(spec.from, "from");
  const t1 = parseISODate(spec.to, "to");
  const weekStart = spec.weekStart === "mon" ? 1 : 0;
  const byDate = new Map();
  for (const c of spec.cells) {
    byDate.set(c.date, c);
  }
  const vmax = Math.max(1, ...spec.cells.map((c) => c.value));
  const cell = 76;
  const left = 48;
  const top = 40;
  const cols = 7;
  const startDow = new Date(t0).getUTCDay();
  const lead = (startDow - weekStart + 7) % 7;
  const gridStart = addDays(t0, -lead);
  const days = [];
  for (let t = gridStart; t <= t1; t = addDays(t, 1)) days.push(t);
  while (days.length % 7) days.push(addDays(days[days.length - 1], 1));
  const rows = days.length / 7;
  const W = 620;
  const calloutH = 26;
  const legendH = 40;
  const H = top + rows * cell + calloutH + legendH + 16;
  const parts = [`<rect x="0" y="0" width="${W}" height="${H}" fill="${PAPER}"/>`];
  const labels = weekStart === 1
    ? ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]
    : ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  labels.forEach((d, i) => {
    parts.push(text(left + i * cell + cell / 2, 24, d, { size: 12, anchor: "middle", fill: MUTED }));
  });

  let specialBox = null;
  days.forEach((t, i) => {
    const col = i % 7;
    const row = Math.floor(i / 7);
    const x = left + col * cell;
    const y = top + row * cell;
    const iso = fmtISO(t);
    const inRange = t >= t0 && t <= t1;
    const cellSpec = byDate.get(iso);
    const v = inRange ? (cellSpec?.value ?? 0) : null;
    const fill = v == null ? CREAM : heatColor(v, vmax);
    const inner = cell - 4;
    const special = iso === "2026-08-12";
    const stroke = special ? AMBER : INK;
    const sw = special ? 1.6 : 0.7;
    parts.push(`<rect x="${x}" y="${y}" width="${inner}" height="${inner}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`);
    if (inRange) {
      const fg = isDark(fill) ? CREAM : INK;
      parts.push(text(x + 7, y + 18, String(new Date(t).getUTCDate()), { size: 13, fill: fg, weight: "bold" }));
      if (v > 0) {
        parts.push(text(x + inner - 7, y + inner - 10, String(v), { size: 12, anchor: "end", fill: fg }));
      }
      if (special) specialBox = { x, y, inner };
    }
  });
  const gridBottom = top + rows * cell;
  if (specialBox) {
    const cx = specialBox.x + specialBox.inner / 2;
    parts.push(`<line x1="${cx.toFixed(1)}" y1="${(specialBox.y + specialBox.inner).toFixed(1)}" x2="${cx.toFixed(1)}" y2="${(gridBottom + 2).toFixed(1)}" stroke="${AMBER}" stroke-width="1"/>`);
  }
  parts.push(text(left, gridBottom + 18, "Aug 12 · 5pm special (inferred)", { size: 12, fill: BLUE, weight: "bold" }));
  const lgY = gridBottom + calloutH + 8;
  const lgW = 280;
  parts.push(`<defs>
  <linearGradient id="heatLeg" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="${PAPER}"/>
    <stop offset="40%" stop-color="#c5d0dc"/>
    <stop offset="100%" stop-color="${BLUE}"/>
  </linearGradient>
</defs>`);
  parts.push(`<rect x="${left}" y="${lgY}" width="${lgW}" height="10" fill="url(#heatLeg)" stroke="${INK}" stroke-width="0.5"/>`);
  parts.push(text(left, lgY + 24, "0", { size: 11, fill: MUTED }));
  parts.push(text(left + lgW, lgY + 24, String(vmax), { size: 11, anchor: "end", fill: MUTED }));
  parts.push(text(left + lgW / 2, lgY + 24, "highlights / day", { size: 11, anchor: "middle", fill: MUTED }));
  return svgDoc(W, H, spec.title, parts.join("\n"));
}

function renderSparkline(spec) {
  const values = spec.values;
  if (!values || values.length < 2) throw new Error("sparkline needs >= 2 values");
  const dates = spec.dates;
  const W = 280;
  const H = 72;
  const x0 = 16;
  const x1 = spec.showEndValue ? 200 : 260;
  const y0 = 48;
  const y1 = 16;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const ys = values.map((v) => (max === min ? (y0 + y1) / 2 : y0 + ((v - min) / (max - min)) * (y1 - y0)));
  const xs = values.map((_, i) => {
    if (dates && dates.length === values.length) {
      const t = parseISODate(dates[i], "dates");
      const tMin = parseISODate(dates[0], "dates");
      const tMax = parseISODate(dates[dates.length - 1], "dates");
      return xOf(t, tMin, tMax, x0, x1);
    }
    // ordinal: even index is OK only when dates are omitted
    if (values.length === 1) return (x0 + x1) / 2;
    return xOf(i, 0, values.length - 1, x0, x1);
  });
  extraComments.push(`sparkline ordinal x=${xs.map(round2).join(",")} values=${values.join(",")}`);
  const pts = xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const area = `${x0.toFixed(1)},${y0} ${pts} ${x1.toFixed(1)},${y0}`;
  const stroke = spec.stroke || BLUE;
  const parts = [`<rect x="0" y="0" width="${W}" height="${H}" fill="${PAPER}"/>`];
  if (spec.fill) {
    parts.push(`<polygon points="${area}" fill="${stroke}" fill-opacity="0.18" />`);
  }
  parts.push(`<polyline points="${pts}" fill="none" stroke="${stroke}" stroke-width="2"/>`);
  xs.forEach((x, i) => {
    parts.push(`<circle cx="${x.toFixed(1)}" cy="${ys[i].toFixed(1)}" r="3.5" fill="${stroke}" />`);
  });
  parts.push(text(x0, H - 8, "ordinal (no dates)", { size: 10, fill: MUTED, italic: true }));
  if (spec.showEndValue) {
    parts.push(text(x1 + 10, ys[ys.length - 1] + 4, formatValue(values[values.length - 1], spec.unit), { size: 12, weight: "bold", fill: BLUE }));
  }
  parts.push(`<!-- sparkline ordinal two-point 911; no fake months; TIF $46494 not plotted -->`);
  return svgDoc(W, H, spec.title || "sparkline", parts.join("\n"));
}

function legendHTML(spec) {
  const raw = spec.legend;
  if (raw == null || raw === false) return "";
  let items = [];
  if (Array.isArray(raw)) items = raw;
  else if (raw.items) items = raw.items;
  if (!items.length) return "";
  const lis = items.map((it) => {
    const color = it.color || BLUE;
    const symbol = it.symbol || "swatch";
    let sw = `<span class="sw" style="background:${esc(color)}"></span>`;
    if (symbol === "diamond") sw = `<span class="sw diamond" style="background:${esc(color)}"></span>`;
    if (symbol === "open-dot") sw = `<span class="sw open" style="border-color:${esc(color)}"></span>`;
    if (symbol === "bar") sw = `<span class="sw bar" style="background:${esc(color)}"></span>`;
    return `<li>${sw} ${esc(it.label)}</li>`;
  });
  return `<ul class="legend">${lis.join("")}</ul>`;
}

function sourceHTML(source) {
  const arr = Array.isArray(source) ? source : source ? [source] : [];
  if (!arr.length) return "";
  const bits = arr.map((s) =>
    s.href
      ? `<a href="${esc(s.href)}">${esc(s.label)}</a>`
      : esc(s.label),
  );
  return `<p class="source">Source: ${bits.join(" · ")}</p>`;
}

function altHTML(spec) {
  const bits = [];
  if (spec.alt) {
    bits.push(`<p class="visually-hidden">${esc(spec.alt)}</p>`);
  }
  const dt = spec.dataTable;
  if (dt?.columns && dt?.records) {
    const head = dt.columns.map((c) => `<th>${esc(c)}</th>`).join("");
    const body = dt.records
      .map((row) => `<tr>${row.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
      .join("");
    bits.push(`<table class="visually-hidden"><caption>${esc(dt.summary || spec.title || "")}</caption><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`);
  }
  return bits.join("\n");
}

function footnoteHTML(spec) {
  return spec.footnote ? `<p class="footnote">${esc(spec.footnote)}</p>` : "";
}

function figureHTML(spec, svg, extra = "") {
  return `<section class="fig" data-type="${esc(spec.type)}">
  <p class="type">${esc(spec.type)}</p>
  <h2>${esc(spec.title || spec.type)}</h2>
  ${spec.caption ? `<p class="caption">${esc(spec.caption)}</p>` : ""}
  ${svg}
  ${extra}
  ${legendHTML(spec)}
  ${sourceHTML(spec.source)}
  ${footnoteHTML(spec)}
  ${altHTML(spec)}
</section>`;
}

const CSS = `
:root { --cream:${CREAM}; --ink:${INK}; --blue:${BLUE}; --amber:${AMBER}; --rule:${RULE}; --paper:${PAPER}; }
* { box-sizing: border-box; }
body { margin:0; background:var(--cream); color:var(--ink);
  font-family: Georgia, "Iowan Old Style", Palatino, "Palatino Linotype", serif;
  line-height:1.45; }
.sheet { max-width: 940px; margin: 0 auto; padding: 28px 32px 72px; }
.kicker { font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--blue); margin: 0; }
h1 { font-size: 28px; font-weight: 700; margin: 6px 0 10px; border-bottom: 2px solid var(--ink); padding-bottom: 10px; }
.lede { font-size: 15px; margin: 0 0 32px; max-width: 62ch; }
section.fig { margin: 0 0 40px; padding: 0 0 28px; border-bottom: 1px solid var(--rule); }
.type { font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--amber); margin: 0 0 6px; }
section.fig h2 { font-size: 20px; margin: 0 0 6px; font-weight: 700; }
.caption { font-size: 14px; margin: 0 0 12px; max-width: 62ch; }
svg { display:block; width:100%; height:auto; background: var(--paper); border: 1px solid var(--rule); }
.thumb { max-width: 420px; margin-top: 12px; }
.thumb-label { font-size: 11px; color: #5c5346; font-style: italic; margin: 8px 0 0; }
.source { font-size: 12px; margin: 10px 0 0; }
.source a { color: var(--blue); text-decoration: underline; text-underline-offset: 2px; }
.footnote { font-size: 11px; color: #5c5346; margin: 4px 0 0; }
.legend { list-style:none; padding:0; margin:8px 0 0; font-size:12px; }
.legend li { display:inline-flex; align-items:center; gap:6px; margin: 0 16px 6px 0; }
.sw { width:12px; height:12px; border:1px solid var(--ink); display:inline-block; }
.sw.bar { width:18px; height:8px; }
.sw.open { background: transparent; border-radius: 50%; border-width: 2px; }
.sw.diamond { transform: rotate(45deg); width:10px; height:10px; }
.visually-hidden {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}
`;


function renderSharedComparison(wheel, n12) {
  const W = 900, H = 300;
  const x0 = 64, x1 = 860;
  const dates = [];
  for (const spec of [wheel, n12]) {
    for (const ev of spec.events) dates.push(parseISODate(ev.date, "date"));
  }
  const t0 = Math.min(...dates);
  const t1 = Math.max(...dates);
  const pad = (t1 - t0) * 0.1;
  const T0 = t0 - pad, T1 = t1 + pad;
  const rows = [
    { spec: n12, y: 92, color: "#3F5C47", name: "N 12th rezoning" },
    { spec: wheel, y: 168, color: "#9B3A2F", name: "Wheel tax" },
  ];
  const parts = [`<rect x="0" y="0" width="${W}" height="${H}" fill="${PAPER}"/>`];
  parts.push(text(x0, 22, "Same day-scale — both stories on one xOf axis", { size: 14, weight: "bold" }));
  parts.push(text(x0, 40, "7 days must render 4× tighter than 28 days. Dots at true dates, not even steps.", { size: 11, fill: MUTED }));
  const axisY = 248;
  parts.push(`<line x1="${x0}" y1="${axisY}" x2="${x1}" y2="${axisY}" stroke="${INK}" stroke-width="1.4"/>`);
  for (const tick of monthTicks(T0, T1)) {
    const x = xOf(tick, T0, T1, x0, x1);
    parts.push(`<line x1="${x.toFixed(1)}" y1="${axisY}" x2="${x.toFixed(1)}" y2="${axisY + 6}" stroke="${INK}" stroke-width="1"/>`);
    parts.push(text(x, axisY + 20, fmtMD(tick), { size: 10, anchor: "middle", fill: MUTED }));
  }
  const coords = {};
  for (const row of rows) {
    parts.push(text(8, row.y - 22, row.name.toUpperCase(), { size: 10, fill: MUTED }));
    const evs = row.spec.events.map((e) => {
      const t = parseISODate(e.date, "date");
      const x = xOf(t, T0, T1, x0, x1);
      coords[e.date] = x;
      return { ...e, t, x };
    }).sort((a, b) => a.x - b.x);
    if (evs.length >= 2) {
      parts.push(`<line x1="${evs[0].x.toFixed(1)}" y1="${row.y}" x2="${evs[evs.length - 1].x.toFixed(1)}" y2="${row.y}" stroke="${row.color}" stroke-width="3"/>`);
      const mid = (evs[0].x + evs[evs.length - 1].x) / 2;
      const days = Math.round((evs[evs.length - 1].t - evs[0].t) / 86400000);
      const px = evs[evs.length - 1].x - evs[0].x;
      parts.push(text(mid, row.y - 26, `${days} days = ${px.toFixed(1)} px`, { size: 11, anchor: "middle", fill: row.color }));
    }
    const close = evs.length >= 2 && (evs[evs.length - 1].x - evs[0].x) < 90;
    for (const e of evs) {
      parts.push(`<circle cx="${e.x.toFixed(1)}" cy="${row.y}" r="7" fill="${row.color}" stroke="${PAPER}" stroke-width="2"/>`);
      parts.push(text(e.x, row.y + 18, fmtMD(e.t), { size: 10, anchor: "middle" }));
      parts.push(`<!-- shared xOf ${e.date} = ${round2(e.x)} -->`);
    }
    if (close) {
      const left = evs[0];
      const right = evs[evs.length - 1];
      const lLines = wrap(left.label, 12);
      const rLines = wrap(right.label, 12);
      lLines.forEach((ln, j) => {
        parts.push(text(left.x - 14, row.y - 6 + j * 12, ln, { size: 10, anchor: "end", fill: MUTED }));
      });
      parts.push(`<line x1="${(left.x - 11).toFixed(1)}" y1="${row.y}" x2="${(left.x - 4).toFixed(1)}" y2="${row.y}" stroke="${MUTED}" stroke-width="1"/>`);
      rLines.forEach((ln, j) => {
        parts.push(text(right.x + 14, row.y - 6 + j * 12, ln, { size: 10, anchor: "start", fill: MUTED }));
      });
      parts.push(`<line x1="${(right.x + 4).toFixed(1)}" y1="${row.y}" x2="${(right.x + 11).toFixed(1)}" y2="${row.y}" stroke="${MUTED}" stroke-width="1"/>`);
    } else {
      for (const e of evs) {
        const lines = wrap(e.label, 16);
        lines.forEach((ln, j) => {
          parts.push(text(e.x, row.y + 32 + j * 12, ln, { size: 10, anchor: "middle", fill: MUTED }));
        });
      }
    }
  }
  const gap7 = coords["2026-04-09"] - coords["2026-04-02"];
  const gap28 = coords["2026-07-09"] - coords["2026-06-11"];
  extraComments.push(`shared-scale Apr2=${round2(coords["2026-04-02"])} Apr9=${round2(coords["2026-04-09"])} Jun11=${round2(coords["2026-06-11"])} Jul9=${round2(coords["2026-07-09"])} ratio=${round2(gap28 / gap7)}`);
  parts.push(text(x0, H - 12, `ratio 28d/7d = ${(gap28 / gap7).toFixed(3)}×  ·  geometry is (date − t0)/(t1 − t0)`, { size: 11 }));
  return svgDoc(W, H, "Shared day-scale: 7 days vs 28 days", parts.join("\n"));
}

function main() {
  mkdirSync(__dirname, { recursive: true });
  const specs = FILES.map((name) => {
    const path = join(EXAMPLES, name);
    const spec = parseYaml(readFileSync(path, "utf8"));
    spec._file = name;
    return spec;
  });
  ensureTimelineScale(specs);

  const sections = [];
  const wheelSpec = specs.find((sp) => sp._file.includes("wheel-tax"));
  const n12Spec = specs.find((sp) => sp._file.includes("n12th"));
  if (wheelSpec && n12Spec) {
    const sharedSvg = renderSharedComparison(wheelSpec, n12Spec);
    sections.push(`<section class="fig" data-type="timeline">
  <p class="type">timeline · shared day-scale (the fix)</p>
  <h2>Seven days versus twenty-eight</h2>
  <p class="caption">N 12th (Apr 2 → Apr 9) is 7 days. Wheel tax (Jun 11 → Jul 9) is 28 days. On one xOf axis the shorter gap is 4× tighter. Even steps cannot do this.</p>
  ${sharedSvg}
  <p class="source">Sources:
    <a href="https://www.vigoledger.org/h/2026-04-02-terre-haute-city-council-north-12th-street-rezoning-held">Apr 2 held</a> ·
    <a href="https://www.vigoledger.org/h/2026-04-09-terre-haute-city-council-north-12th-street-rezoning">Apr 9 passed</a> ·
    <a href="https://www.vigoledger.org/h/2026-06-11-terre-haute-city-council-wheel-tax-tabled">Jun 11 held</a> ·
    <a href="https://www.vigoledger.org/h/2026-07-09-terre-haute-city-council-wheel-tax-adopted">Jul 9 adopted</a>
  </p>
</section>`);
  }
  for (const spec of specs) {
    if (spec.type === "timeline") {
      const broken = spec._file.includes("wheel-tax");
      const out = renderTimeline(spec, { brokenThumb: broken });
      if (typeof out === "string") {
        sections.push(figureHTML(spec, out));
      } else {
        const extra = `<p class="thumb-label">Not the chart — broken even-spacing thumbnail (equal card slots):</p>
  <div class="thumb">${out.thumb}</div>`;
        sections.push(figureHTML(spec, out.main, extra));
      }
    } else if (spec.type === "gantt") {
      sections.push(figureHTML(spec, renderGantt(spec)));
    } else if (spec.type === "weekstrip") {
      sections.push(figureHTML(spec, renderWeekstrip(spec)));
    } else if (spec.type === "entity-timeline") {
      sections.push(figureHTML(spec, renderEntity(spec)));
    } else if (spec.type === "calendar-heatmap") {
      sections.push(figureHTML(spec, renderHeatmap(spec)));
    } else if (spec.type === "sparkline") {
      sections.push(figureHTML(spec, renderSparkline(spec)));
    } else {
      throw new Error(`unknown type ${spec.type} in ${spec._file}`);
    }
  }

  const xJun11 = computedX["2026-06-11"];
  const xJul9 = computedX["2026-07-09"];
  const xApr2 = computedX["2026-04-02"];
  const xApr9 = computedX["2026-04-09"];
  const gapW = round2(Math.abs(xJul9 - xJun11));
  const gapN = round2(Math.abs(xApr9 - xApr2));
  const ratio = round2(gapW / gapN);

  const xComment = `computed pixel x via parseISODate + xOf (UTC midnight; not localeCompare; not index*step)
  2026-06-11: ${xJun11}
  2026-07-09: ${xJul9}
  2026-04-02: ${xApr2}
  2026-04-09: ${xApr9}
  wheel 28d gap: ${gapW}px
  n12th 7d gap: ${gapN}px
  ratio: ${ratio} (~4×)
  ${extraComments.join("\n  ")}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Time family render · The Vigo Ledger · Vol. I No. 1</title>
<style>${CSS}</style>
</head>
<body>
<div class="sheet">
<!--
${xComment}
-->
<p class="kicker">The Vigo Ledger · Vol. I No. 1 · week of Aug 28, 2026</p>
<h1>Time, on a real date axis</h1>
<p class="lede">Geometry from parseISODate + xOf (the spec fix). Not diagrams.sh 0.2.0 even-spacing. The 28-day wheel-tax gap is ~4× the 7-day N 12th gap in pixel space. Open gantt ranges fade; no invented November 2027.</p>
${sections.join("\n")}
</div>
</body>
</html>
`;
  writeFileSync(OUT, html, "utf8");
  console.log(`wrote ${OUT} (${html.length} bytes)`);
  console.log(`x 2026-06-11 = ${xJun11}`);
  console.log(`x 2026-07-09 = ${xJul9}`);
  console.log(`x 2026-04-02 = ${xApr2}`);
  console.log(`x 2026-04-09 = ${xApr9}`);
  console.log(`gap ratio 28d/7d = ${ratio}`);
}

main();
