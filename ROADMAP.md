# Roadmap: August 2026 – January 2027

> Progress is tracked in [#26](https://github.com/agent-clis/diagrams/issues/26), which links a detailed issue for every work item below.

A proposed 6-month plan for `@agent-clis/diagrams`. The project is at v0.2.0 with a solid core: YAML → PNG/SVG/HTML/PPTX rendering via Satori, a custom layered layout engine, 20 themes, AWS/GCP/Geist/simple-icons icon packs, gantt/timeline/quadrant diagram types, BPMN import, and a bundled agent skill. The plan below hardens that core first, then expands diagram types and interop, and lands a stable v1.0 in month six.

## Month 1 (August) — Foundations & trust

Goal: make the project safe to build on and easy to adopt.

- **README + docs.** The repo and npm page currently have no README. Add one with a rendered example gallery, install instructions, YAML spec reference, and SDK usage. Promote the content in `skills/*.md` into user-facing docs.
- **Visual regression tests.** Only `parse.test.ts` exists today. Add golden-image (SVG snapshot) tests over the existing `test/fixtures` so layout and render changes are caught. Add layout unit tests (rank/order/position) and CI runs on Linux + macOS.
- **Error experience.** Friendly, positional error messages for invalid YAML specs (unknown node id in an edge, bad shape/icon names, cycles where unsupported), with `validate` exit codes suitable for CI.
- **Azure icon pack.** AWS and GCP are covered; Azure is the obvious gap for architecture diagrams.

## Month 2 (September) — Layout engine v2

Goal: diagrams that look right without manual tweaking — the core differentiator.

- Orthogonal edge routing with proper obstacle avoidance and port assignment (edges leaving from sensible sides of nodes).
- Edge-label placement that avoids overlapping nodes and other labels.
- Nested groups (groups within groups) and edges to/from group boundaries.
- Self-loops, multi-edges between the same pair, and better crossing minimization on dense graphs.
- A deterministic-layout guarantee (same spec → same output) documented and tested.

## Month 3 (October) — New diagram types

Goal: cover the diagrams engineers actually put in design docs.

- **Sequence diagrams** — the most-requested type for system design docs.
- **C4 model support** (context/container/component) as a first-class spec flavor layered on the existing nodes/groups model.
- **State machine / ER diagrams** — pick one based on user demand; both reuse the node-edge core.
- Each new type ships with themes, PPTX export, fixtures, and skill documentation, matching the gantt/timeline/quadrant pattern.

## Month 4 (November) — Interop

Goal: meet users where their existing diagrams live.

- **Mermaid import** (`diagrams convert mermaid`) for flowchart and sequence syntax — the largest existing corpus of text-based diagrams.
- **Graphviz DOT import** for architecture graphs.
- **Excalidraw / draw.io export** so generated diagrams can be hand-edited afterward.
- Harden BPMN conversion (more element coverage, better lane handling) based on real-world files.

## Month 5 (December) — Agent & developer experience

Goal: lean into the `agent-clis` mission — make this the default way agents produce diagrams.

- **MCP server** exposing render/validate/convert as tools, so any MCP client can generate diagrams without shelling out.
- **Watch mode + live preview** (`diagrams watch spec.yaml`) serving auto-reloading HTML for fast iteration.
- **Web playground** — a static site with the renderer compiled to WASM/JS for try-before-install and shareable links.
- Publish the JSON Schema for the YAML spec so editors get autocomplete and validation, and agents get a machine-readable contract.

## Month 6 (January) — v1.0

Goal: stability commitment and polish.

- Freeze and document the YAML spec and SDK API; add a `version:` field to specs with a migration policy for future changes.
- Performance pass for large graphs (500+ nodes): layout profiling, render memoization, benchmark suite in CI.
- Distribution: Homebrew tap and GitHub Action (`agent-clis/diagrams-action`) alongside the existing npm package and compiled binaries.
- Accessibility: SVG `<title>`/`aria-label` output, color-contrast audit across all 20 themes.
- Launch: example gallery site, announcement post, and a triaged public issue backlog.

## Cross-cutting through all six months

- Keep the bundled skill (`skills/SKILL.md`) in sync with every new feature — agents are a primary user.
- Ship small and often: minor release at least monthly; changelog per release.
- Track adoption (npm downloads, GitHub stars/issues) monthly to reprioritize months 3–4, which are the most demand-driven.
