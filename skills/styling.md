# Styling Reference

## Node Shapes

| Shape | Border Radius | Best for |
|-------|--------------|----------|
| `rectangle` | 4px sharp corners | Data stores, databases, external systems |
| `rounded` | 12px (default) | General-purpose nodes |
| `pill` | Fully rounded ends | Start/end points, terminals |
| `diamond` | 45-degree rotation | Decision points, conditionals |
| `circle` | Perfect circle | Events, triggers, status indicators |

## Node Style Overrides

Override individual node colors via the `style` field:

```yaml
nodes:
  - id: error
    label: "Error Handler"
    style:
      backgroundColor: "#FEF2F2"    # Light red background
      borderColor: "#EF4444"         # Red border
      textColor: "#DC2626"           # Dark red text
```

Available properties:
- `backgroundColor` — Node fill color (hex)
- `borderColor` — Node border color (hex)
- `textColor` — Label text color (hex)

### Status Color Patterns

| Status | Border | Text | Background |
|--------|--------|------|------------|
| Success | `#22C55E` | `#16A34A` | `#F0FDF4` |
| Error | `#EF4444` | `#DC2626` | `#FEF2F2` |
| Warning | `#EAB308` | `#CA8A04` | `#FEFCE8` |
| Info | `#3B82F6` | `#2563EB` | `#EFF6FF` |

## Edge Styles

```yaml
edges:
  - from: a
    to: b
    style: dashed        # solid | dashed | dotted
    color: "#EF4444"     # hex color
    label: "on failure"  # optional text
```

| Style | Use for |
|-------|---------|
| `solid` | Primary/default flow |
| `dashed` | Conditional, error, or optional paths |
| `dotted` | Async, background, or secondary flows |

## Themes

### `default` (light)

| Property | Value |
|----------|-------|
| Canvas background | `#FFFFFF` |
| Node background | `#FFFFFF` |
| Node border | `#E2E8F0` |
| Node border width | 1.5px |
| Node text | `#1E293B` |
| Node secondary text | `#64748B` |
| Edge color | `#94A3B8` |
| Edge label color | `#64748B` |
| Rank spacing | 48px |
| Node spacing | 32px |
| Font | Inter |

### `dark`

| Property | Value |
|----------|-------|
| Canvas background | `#0F172A` |
| Node background | `#1E293B` |
| Node border | `#334155` |
| Node border width | 1px |
| Node text | `#F1F5F9` |
| Node secondary text | `#94A3B8` |
| Edge color | `#475569` |
| Edge label color | `#94A3B8` |
| Rank spacing | 64px |
| Node spacing | 32px |
| Font | Inter |

## Group Theme Defaults

### `default` (light)

| Property | Value |
|----------|-------|
| Background | `#F8FAFC` |
| Border | `#E2E8F0` |
| Border width | 1.5px |
| Border radius | 16px |
| Padding | 20px |
| Label font size | 13px |
| Label color | `#475569` |
| Gap between groups | 32px |

### `dark`

| Property | Value |
|----------|-------|
| Background | `#1E293B` |
| Border | `#334155` |
| Border width | 1px |
| Border radius | 16px |
| Padding | 20px |
| Label font size | 13px |
| Label color | `#94A3B8` |
| Gap between groups | 32px |

## Render Options

| Option | CLI Flag | Values | Default |
|--------|----------|--------|---------|
| Format | `-f, --format` | `png`, `svg`, `html` | `png` |
| Width | `-w, --width` | Pixels | Auto-computed |
| Scale | `-s, --scale` | Multiplier (PNG only) | `2` |
| Padding | `-p, --padding` | Pixels | `40` |
| Theme | `-t, --theme` | `default`, `dark` | `default` |
| Direction | `-d, --direction` | `TB`, `LR` | `TB` |
| Output | `-o, --output` | File path | Auto from input |

## Layout

### Direction

- **TB** (Top-to-Bottom) — Best for hierarchies, org charts, vertical flows
- **LR** (Left-to-Right) — Best for pipelines, timelines, horizontal processes

### Spacing

Controlled by theme. Override by providing a custom theme object in YAML:

```yaml
theme:
  name: custom
  canvas:
    background: "#FFFFFF"
  spacing:
    rankSep: 80    # Vertical gap between layers
    nodeSep: 48    # Horizontal gap between siblings
```

## Tips

- Use `description` for context without cluttering labels (e.g., "us-east-1", "t3.micro")
- Use colored borders to encode meaning (status, environment, team)
- Use `dashed` edges for error/fallback paths to visually distinguish them
- For wide diagrams, use `LR` direction; for tall ones, use `TB`
- Use `pill` shape for entry/exit points to visually anchor the flow
- Use `diamond` shape sparingly — only for actual decision/branch points
- Scale factor of `2` (default) produces retina-quality PNGs
