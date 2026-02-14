# Groups & Stacking Reference

Groups visually cluster nodes into labeled, bordered containers. Each group can have its own internal layout direction, and groups can be arranged in an explicit multi-row grid.

## YAML Spec

```yaml
title: "System Architecture"
direction: LR              # how groups are arranged relative to each other

nodes:                      # nodes defined at top level as usual
  - id: gateway
    label: "API Gateway"
  - id: auth
    label: "Auth Service"
  - id: users
    label: "User Service"
  - id: postgres
    label: "PostgreSQL"
  - id: redis
    label: "Redis"

groups:
  - id: services            # required, unique group identifier
    label: "Core Services"  # optional, displayed as header text
    members: [auth, users]  # required, list of node IDs in this group
    direction: TB           # optional, layout direction WITHIN this group (default: inherits top-level)
    style:                  # optional, color overrides
      backgroundColor: "#F0FDF4"
      borderColor: "#BBF7D0"
      labelColor: "#166534"
  - id: data
    label: "Data Layer"
    members: [postgres, redis]
    direction: LR

# Optional: explicit grid arrangement of groups
rows:
  - [services, data]        # row 1: two groups side by side
  - [monitoring]            # row 2: one group, centered

edges:                      # edges connect nodes, can cross group boundaries
  - from: gateway
    to: auth
  - from: auth
    to: postgres
```

## Group Fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique identifier for the group |
| `label` | No | Header text displayed at top of group card |
| `members` | Yes | Array of node IDs belonging to this group |
| `direction` | No | `TB` or `LR` — layout direction inside the group. Defaults to top-level `direction` |
| `style` | No | Color overrides (see below) |

## Group Style Overrides

```yaml
style:
  backgroundColor: "#F0F9FF"   # Card background fill
  borderColor: "#BAE6FD"       # Card border color
  labelColor: "#0369A1"        # Label text color
```

All three are optional. Defaults come from the theme:

| Property | Default (light) | Default (dark) |
|----------|----------------|----------------|
| `backgroundColor` | `#F8FAFC` | `#1E293B` |
| `borderColor` | `#E2E8F0` | `#334155` |
| `labelColor` | `#475569` | `#94A3B8` |

## Grid Layout with `rows`

By default, groups are arranged in a single row (LR) or single column (TB) following the top-level `direction`. Use `rows` for explicit multi-row/column grid placement:

```yaml
direction: LR

rows:
  - [frontend, backend, database]   # row 1: three groups
  - [monitoring, logging]           # row 2: two groups, centered
```

- Shorter rows are centered horizontally
- Groups not mentioned in `rows` are appended in an extra row
- Spacing between groups is controlled by the theme (`group.gap`, default 32px)

## Color Palettes for Groups

Suggested color sets that work well together:

| Name | Background | Border | Label |
|------|------------|--------|-------|
| Blue | `#EFF6FF` | `#BFDBFE` | `#1D4ED8` |
| Sky | `#F0F9FF` | `#BAE6FD` | `#0369A1` |
| Green | `#ECFDF5` | `#A7F3D0` | `#047857` |
| Emerald | `#F0FDF4` | `#BBF7D0` | `#166534` |
| Orange | `#FFF7ED` | `#FED7AA` | `#9A3412` |
| Amber | `#FEF3C7` | `#FDE68A` | `#92400E` |
| Purple | `#F5F3FF` | `#DDD6FE` | `#6D28D9` |
| Rose | `#FFF1F2` | `#FECDD3` | `#BE123C` |

## Ungrouped Nodes

Nodes not assigned to any group are laid out normally alongside the groups. They are not enclosed in a card.

## Cross-Group Edges

Edges can connect nodes in different groups. The edge routing uses position-based port selection — it picks left/right or top/bottom ports depending on the relative positions of the connected nodes.

## Rules

- Each node can belong to **at most one** group
- Group IDs must be unique
- Members must reference valid node IDs
- Groups with zero members are invalid
- `rows` entries must reference valid group IDs

## Backward Compatibility

Specs without `groups` behave exactly as before — no visual or behavioral changes.

## Complete Example

```yaml
title: "Microservices"
direction: LR

nodes:
  - id: gateway
    label: "API Gateway"
    icon: "🌐"
  - id: lb
    label: "Load Balancer"
    icon: "⚖️"
  - id: auth
    label: "Auth Service"
    icon: "🔐"
  - id: users
    label: "User Service"
    icon: "👤"
  - id: orders
    label: "Order Service"
    icon: "📦"
  - id: postgres
    label: "PostgreSQL"
    icon: "postgresql"
  - id: redis
    label: "Redis"
    icon: "redis"
  - id: prometheus
    label: "Prometheus"
    icon: "prometheus"
  - id: grafana
    label: "Grafana"
    icon: "grafana"

groups:
  - id: ingress
    label: "Ingress"
    members: [gateway, lb]
    direction: TB
    style:
      backgroundColor: "#F0F9FF"
      borderColor: "#BAE6FD"
      labelColor: "#0369A1"
  - id: services
    label: "Core Services"
    members: [auth, users, orders]
    direction: TB
    style:
      backgroundColor: "#F0FDF4"
      borderColor: "#BBF7D0"
      labelColor: "#166534"
  - id: data
    label: "Data Layer"
    members: [postgres, redis]
    direction: TB
    style:
      backgroundColor: "#FFF7ED"
      borderColor: "#FED7AA"
      labelColor: "#9A3412"
  - id: observability
    label: "Observability"
    members: [prometheus, grafana]
    direction: LR

rows:
  - [ingress, services, data]
  - [observability]

edges:
  - from: gateway
    to: lb
  - from: lb
    to: auth
  - from: lb
    to: users
  - from: lb
    to: orders
  - from: auth
    to: postgres
  - from: users
    to: postgres
  - from: orders
    to: postgres
  - from: auth
    to: redis
  - from: prometheus
    to: auth
    label: "scrape"
    style: dashed
  - from: prometheus
    to: grafana
```
