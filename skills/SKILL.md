---
name: diagrams
description: Generate architecture diagrams from YAML specs. Use when creating flowcharts, system architecture diagrams, AWS/GCP cloud diagrams, CI/CD pipelines, or any node-and-edge diagram.
user-invocable: true
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# Diagrams CLI

Generate architecture diagrams from declarative YAML specs. Renders to PNG, SVG, or HTML using Satori.

## CLI Usage

```bash
bun run src/cli.ts render <input.yaml> -o <output.png> [options]
bun run src/cli.ts validate <input.yaml>
bun run src/cli.ts themes
```

### CLI Flags

| Flag | Description | Default |
|------|-------------|---------|
| `-o, --output <path>` | Output file path | Auto from input name |
| `-f, --format <fmt>` | `png`, `svg`, `html` | `png` |
| `-t, --theme <name>` | `default`, `dark` | `default` |
| `-w, --width <px>` | Canvas width in pixels | Auto-computed |
| `-s, --scale <n>` | Scale factor (PNG only) | `2` |
| `-d, --direction <dir>` | `TB` (top-bottom), `LR` (left-right) | `TB` |
| `-p, --padding <px>` | Padding around diagram | `40` |

## YAML Spec Format

```yaml
title: "Diagram Title"        # optional
direction: TB                  # TB (top-bottom) or LR (left-right), default: TB
theme: default                 # default or dark, optional

nodes:
  - id: unique_id              # required, unique identifier
    label: "Display Text"      # required
    description: "Details"     # optional, secondary text below label
    shape: rounded             # optional: rectangle | rounded | pill | diamond | circle
    icon: "aws:lambda"         # optional, see Icon Types below
    style:                     # optional overrides
      backgroundColor: "#FFF"
      borderColor: "#E2E8F0"
      textColor: "#1E293B"

edges:
  - from: source_id            # required, node id
    to: target_id              # required, node id
    label: "edge text"         # optional
    style: solid               # optional: solid | dashed | dotted
    color: "#94A3B8"           # optional, hex color

groups:                        # optional, visually group nodes into cards
  - id: group_id              # required, unique
    label: "Group Label"      # optional, header text
    members: [node1, node2]   # required, node IDs in this group
    direction: TB              # optional, layout inside this group (default: inherits top-level)
    style:                     # optional, card color overrides
      backgroundColor: "#F0FDF4"
      borderColor: "#BBF7D0"
      labelColor: "#166534"

rows:                          # optional, explicit grid arrangement of groups
  - [group1, group2, group3]  # row 1
  - [group4]                  # row 2, centered
```

## Groups & Stacking

Group nodes into bordered containers with labels. Each group can have its own internal layout direction, and groups can be arranged in multi-row grids.

```yaml
groups:
  - id: frontend
    label: "Frontend"
    members: [app, cdn]
    direction: LR
    style:
      backgroundColor: "#EFF6FF"
      borderColor: "#BFDBFE"
      labelColor: "#1D4ED8"
  - id: backend
    label: "Backend"
    members: [api, worker]
    direction: TB

rows:
  - [frontend, backend]    # arrange groups in explicit grid
```

Key rules:
- Each node can belong to **at most one** group
- Edges can cross group boundaries
- Ungrouped nodes are laid out alongside groups without a card
- Without `rows`, groups default to single row (LR) or single column (TB)
- Shorter rows are centered

For full reference with color palettes and examples, see [groups.md](groups.md).

## Icon Types

Five icon types are supported. All resolve to embedded images in the output.

| Type | Syntax | Example | Notes |
|------|--------|---------|-------|
| Emoji | `"<emoji>"` | `"🚀"` | Any Unicode emoji |
| Favicon | `"favicon:<domain>"` | `"favicon:github.com"` | Any website's favicon |
| Simple Icons | `"<slug>"` | `"docker"` | 3000+ brand icons from simpleicons.org |
| AWS | `"aws:<slug>"` | `"aws:lambda"` | 320 AWS service icons, see [aws-icons.md](aws-icons.md) |
| GCP | `"gcp:<slug>"` | `"gcp:compute"` | 35 GCP category icons, see [gcp-icons.md](gcp-icons.md) |

### Finding Simple Icons slugs

Simple Icons covers 3000+ brands (docker, react, typescript, postgresql, redis, nginx, kubernetes, etc.). Slugs are lowercase brand names. Check [simpleicons.org](https://simpleicons.org) for the full list.

## Node Shapes

| Shape | Use for |
|-------|---------|
| `rounded` | General-purpose (default) |
| `rectangle` | Data stores, databases |
| `pill` | Start/end states, terminals |
| `diamond` | Decision points, conditionals |
| `circle` | Events, triggers |

## Edge Styles

| Style | Use for |
|-------|---------|
| `solid` | Primary flows (default) |
| `dashed` | Conditional/optional paths |
| `dotted` | Async or secondary flows |

## Complete Example

```yaml
title: "CI/CD Pipeline"
direction: LR
theme: default

nodes:
  - id: repo
    label: "GitHub Repo"
    icon: "favicon:github.com"
  - id: build
    label: "Build"
    icon: "🔨"
    description: "Compile & bundle"
  - id: test
    label: "Run Tests"
    icon: "🧪"
  - id: check
    label: "Tests Pass?"
    shape: diamond
  - id: fail
    label: "Fix & Retry"
    style:
      borderColor: "#EF4444"
      textColor: "#DC2626"
  - id: push
    label: "Push Image"
    icon: "docker"
  - id: deploy
    label: "Deploy"
    icon: "aws:ecs"
    shape: pill
    description: "ECS Fargate"

edges:
  - from: repo
    to: build
  - from: build
    to: test
  - from: test
    to: check
  - from: check
    to: fail
    label: "fail"
    style: dashed
    color: "#EF4444"
  - from: fail
    to: build
    style: dashed
  - from: check
    to: push
    label: "pass"
  - from: push
    to: deploy
```

## Grouped Example

```yaml
title: "ML Pipeline"
direction: LR

nodes:
  - id: raw
    label: "Raw Data"
    icon: "🗄️"
  - id: clean
    label: "Cleaning"
    icon: "🧹"
  - id: train
    label: "Training"
    icon: "🧠"
  - id: eval
    label: "Evaluation"
    icon: "📊"
  - id: api
    label: "Serving API"
    icon: "🚀"
  - id: monitor
    label: "Monitoring"
    icon: "📈"

groups:
  - id: ingest
    label: "Data Ingestion"
    members: [raw, clean]
    direction: LR
    style:
      backgroundColor: "#EFF6FF"
      borderColor: "#BFDBFE"
      labelColor: "#1D4ED8"
  - id: training
    label: "Training"
    members: [train, eval]
    direction: TB
    style:
      backgroundColor: "#FEF3C7"
      borderColor: "#FDE68A"
      labelColor: "#92400E"
  - id: prod
    label: "Production"
    members: [api, monitor]
    direction: TB
    style:
      backgroundColor: "#ECFDF5"
      borderColor: "#A7F3D0"
      labelColor: "#047857"

edges:
  - from: raw
    to: clean
  - from: clean
    to: train
  - from: train
    to: eval
  - from: eval
    to: api
    label: "promote"
  - from: api
    to: monitor
  - from: monitor
    to: train
    style: dashed
    label: "retrain"
```

## Styling Tips

- Use colored borders for status: green (`#22C55E`) = success, red (`#EF4444`) = error, yellow (`#EAB308`) = warning
- Use `description` to add context without cluttering labels
- Use `dashed` edges for conditional/error paths, `dotted` for async
- `LR` direction works best for pipelines; `TB` for hierarchies

For full styling reference, see [styling.md](styling.md).
