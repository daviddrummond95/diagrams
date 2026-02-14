# GCP Icons Reference

Use `gcp:<slug>` in the `icon` field. These are official GCP Architecture Icons at the **category level** (not individual service icons).

## All Categories

| Slug | Category |
|------|----------|
| `gcp:agents` | Agents |
| `gcp:ai-machine-learning` | AI & Machine Learning |
| `gcp:bi` | Business Intelligence |
| `gcp:business-intelligence` | Business Intelligence |
| `gcp:collaboration` | Collaboration |
| `gcp:compute` | Compute |
| `gcp:containers` | Containers |
| `gcp:data-analytics` | Data Analytics |
| `gcp:databases` | Databases |
| `gcp:developer-tools` | Developer Tools |
| `gcp:devops` | DevOps |
| `gcp:hybrid-multicloud` | Hybrid & Multi-cloud |
| `gcp:integration-services` | Integration Services |
| `gcp:management-tools` | Management Tools |
| `gcp:maps-geospatial` | Maps & Geospatial |
| `gcp:marketplace` | Marketplace |
| `gcp:media-services` | Media Services |
| `gcp:migration` | Migration |
| `gcp:mixed-reality` | Mixed Reality |
| `gcp:networking` | Networking |
| `gcp:observability` | Observability |
| `gcp:operations` | Operations |
| `gcp:security` | Security |
| `gcp:security-identity` | Security & Identity |
| `gcp:serverless-computing` | Serverless Computing |
| `gcp:storage` | Storage |
| `gcp:web-mobile` | Web & Mobile |
| `gcp:web3` | Web3 |

## Aliases

These short aliases map to their full category names:

| Alias | Maps to |
|-------|---------|
| `gcp:ai` | AI & Machine Learning |
| `gcp:ml` | AI & Machine Learning |
| `gcp:gke` | Containers |
| `gcp:serverless` | Serverless Computing |
| `gcp:monitoring` | Observability |
| `gcp:devtools` | Developer Tools |

## Usage Example

```yaml
nodes:
  - id: frontend
    label: "Frontend"
    icon: "gcp:compute"
  - id: db
    label: "Database"
    icon: "gcp:databases"
  - id: ml
    label: "ML Pipeline"
    icon: "gcp:ai"
  - id: storage
    label: "Storage"
    icon: "gcp:storage"
```

> **Note:** GCP icons represent service categories, not individual services. For specific GCP product logos (e.g., BigQuery, Cloud Run), use Simple Icons with the brand slug instead (e.g., `icon: "googlecloud"`).
