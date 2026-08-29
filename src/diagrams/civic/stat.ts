import type { StatDiagramSpec, SatoriElement } from '../../types.js';
import type { CivicDiagramResult, CivicRenderContext } from './shared.js';
import { buildCivicFrame } from './shared.js';

export function buildStatDiagram(
  spec: StatDiagramSpec,
  context: CivicRenderContext,
): CivicDiagramResult {
  const spacer: SatoriElement = {
    type: 'div',
    props: { style: { display: 'flex', width: context.width - context.padding * 2, height: 1 }, children: '' },
  };
  return buildCivicFrame(spec, spacer, 1, context);
}
