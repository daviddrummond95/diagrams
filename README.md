# @agent-clis/diagrams

Declarative YAML/JSON diagrams for SVG, PNG, HTML, and PowerPoint output.

## Library and CLI

```ts
import { diagram, parseSpec } from '@agent-clis/diagrams';

const spec = parseSpec(source);
const svg = await diagram(spec, { format: 'svg', width: 760 });
```

```sh
diagrams render diagram.yaml --format svg --output diagram.svg
```

AWS and GCP icons are optional and no longer download during package install.
Run `diagrams setup-icons` when those CLI-only assets are needed.

## Hosted SVG

Servers should use the SVG-only entrypoint. It does not import the HTML, PNG,
or PowerPoint output paths:

```ts
import {
  HostedSvgValidationError,
  renderHostedSvg,
} from '@agent-clis/diagrams/server';

try {
  const result = await renderHostedSvg(untrustedSpec, {
    width: 760,
    padding: 28,
  });

  // result.svg           -> response body
  // result.contentHash   -> ETag/cache key
  // result.width/height  -> intrinsic image dimensions
} catch (error) {
  if (error instanceof HostedSvgValidationError) {
    console.error(error.errors);
  }
}
```

Hosted rendering defaults are intentionally strict:

- `alt` and `dataTable` are required.
- Specs, collections, strings, dimensions, and SVG output are bounded.
- Filesystem GeoJSON references are rejected; provide inline GeoJSON objects.
- Emoji, favicon, AWS, and GCP icon resolution is rejected. Civic, Geist, and
  named Simple Icons remain available without outbound requests.
- Generated links accept HTTP, HTTPS, mailto, and relative URLs only.
- Rendering never mutates the caller's spec.

Authentication, HTTP caching headers, rate/concurrency limiting, and process
deadlines belong to the hosting service. `contentHash` includes the canonical
spec, render options, and hosted renderer contract version.
