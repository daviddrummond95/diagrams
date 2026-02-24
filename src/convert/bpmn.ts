import { XMLParser } from 'fast-xml-parser';
import type { DiagramSpec, DiagramNode, DiagramEdge, DiagramGroup } from '../types.js';

// ── BPMN element → icon defaults ─────────────────────────────────────────

const ICON_DEFAULTS: Record<string, string> = {
  // Events
  startEvent:                'geist:play-fill',
  endEvent:                  'geist:stop-fill',
  intermediateThrowEvent:    'geist:arrow-up-right',
  intermediateCatchEvent:    'geist:arrow-down-right',
  boundaryEvent:             'geist:warning',

  // Event sub-types (applied when inner definition is detected)
  'event:timer':             'geist:clock',
  'event:message':           'geist:envelope',
  'event:signal':            'geist:bell',
  'event:error':             'geist:warning-fill',
  'event:escalation':        'geist:arrow-up',
  'event:compensation':      'geist:arrow-left',
  'event:conditional':       'geist:filter',
  'event:terminate':         'geist:stop-circle',

  // Tasks
  task:                      'geist:check-square',
  userTask:                  'geist:user',
  serviceTask:               'geist:settings-gear',
  scriptTask:                'geist:terminal',
  sendTask:                  'geist:email',
  receiveTask:               'geist:inbox',
  manualTask:                'geist:cursor-click',
  businessRuleTask:          'geist:clipboard',

  // Sub-processes & activities
  subProcess:                'geist:layers',
  callActivity:              'geist:external',
  transaction:               'geist:refresh-clockwise',

  // Gateways
  exclusiveGateway:          'geist:git-branch',
  parallelGateway:           'geist:plus',
  inclusiveGateway:          'geist:loader-circle',
  eventBasedGateway:         'geist:grid-square',
  complexGateway:            'geist:grid-masonry',

  // Data
  dataObjectReference:       'geist:file-text',
  dataStoreReference:        'geist:database',
};

// ── Shape mapping ────────────────────────────────────────────────────────

type BpmnCategory = 'event' | 'task' | 'gateway' | 'data' | 'subprocess';

const CATEGORY: Record<string, BpmnCategory> = {
  startEvent: 'event',
  endEvent: 'event',
  intermediateThrowEvent: 'event',
  intermediateCatchEvent: 'event',
  boundaryEvent: 'event',
  task: 'task',
  userTask: 'task',
  serviceTask: 'task',
  scriptTask: 'task',
  sendTask: 'task',
  receiveTask: 'task',
  manualTask: 'task',
  businessRuleTask: 'task',
  subProcess: 'subprocess',
  callActivity: 'task',
  transaction: 'subprocess',
  exclusiveGateway: 'gateway',
  parallelGateway: 'gateway',
  inclusiveGateway: 'gateway',
  eventBasedGateway: 'gateway',
  complexGateway: 'gateway',
  dataObjectReference: 'data',
  dataStoreReference: 'data',
};

const SHAPE_MAP: Record<BpmnCategory, DiagramNode['shape']> = {
  event: 'circle',
  task: 'rounded',
  gateway: 'diamond',
  data: 'rectangle',
  subprocess: 'rounded',
};

// ── Style defaults by category ──────────────────────────────────────────

const STYLE_MAP: Record<BpmnCategory, DiagramNode['style']> = {
  event: { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' },
  task: undefined,
  gateway: { backgroundColor: '#FEF9C3', borderColor: '#FDE047' },
  data: { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' },
  subprocess: { backgroundColor: '#EFF6FF', borderColor: '#93C5FD' },
};

// Override for specific event types
const END_EVENT_STYLE: DiagramNode['style'] = { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' };

// ── XML helpers ──────────────────────────────────────────────────────────

function ensureArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function attr(el: any, name: string): string | undefined {
  return el?.[`@_${name}`] ?? el?.[name] ?? undefined;
}

function detectEventSubType(eventEl: any): string | undefined {
  const defs = [
    'timerEventDefinition', 'messageEventDefinition', 'signalEventDefinition',
    'errorEventDefinition', 'escalationEventDefinition', 'compensateEventDefinition',
    'conditionalEventDefinition', 'terminateEventDefinition',
  ];
  for (const def of defs) {
    if (eventEl[def] !== undefined || eventEl[`bpmn:${def}`] !== undefined) {
      return def.replace('EventDefinition', '').replace(/^(bpmn:)/, '');
    }
  }
  return undefined;
}

// ── Main converter ──────────────────────────────────────────────────────

export interface BpmnConvertOptions {
  direction?: 'TB' | 'LR';
}

export function convertBpmn(xml: string, options: BpmnConvertOptions = {}): DiagramSpec {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
  });
  const doc = parser.parse(xml);

  // Find the definitions root (handles bpmn:definitions or definitions)
  const definitions = doc.definitions ?? doc['bpmn:definitions'] ?? doc;

  // Collect all processes (could be collaboration with multiple)
  const processes = ensureArray(definitions.process ?? definitions['bpmn:process']);
  if (processes.length === 0) {
    throw new Error('No BPMN process found in the file');
  }

  // Detect participants / collaboration for groups
  const collaboration = definitions.collaboration ?? definitions['bpmn:collaboration'];
  const participants = collaboration ? ensureArray(collaboration.participant ?? collaboration['bpmn:participant']) : [];
  const participantMap = new Map<string, string>(); // processRef → participant name
  for (const p of participants) {
    const ref = attr(p, 'processRef');
    const name = attr(p, 'name');
    if (ref) participantMap.set(ref, name ?? ref);
  }

  const nodes: DiagramNode[] = [];
  const edges: DiagramEdge[] = [];
  const groups: DiagramGroup[] = [];
  const nodeIds = new Set<string>();

  // Element types to extract
  const elementTypes = Object.keys(CATEGORY);

  for (const process of processes) {
    const processId = attr(process, 'id') ?? 'process';
    const processMembers: string[] = [];

    // Extract all BPMN elements
    for (const elType of elementTypes) {
      const elements = ensureArray(process[elType] ?? process[`bpmn:${elType}`]);

      for (const el of elements) {
        const id = attr(el, 'id');
        if (!id || nodeIds.has(id)) continue;
        nodeIds.add(id);

        const name = attr(el, 'name');
        const category = CATEGORY[elType]!;

        // Determine icon — check event sub-type first
        let icon = ICON_DEFAULTS[elType] ?? '';
        if (category === 'event') {
          const subType = detectEventSubType(el);
          if (subType && ICON_DEFAULTS[`event:${subType}`]) {
            icon = ICON_DEFAULTS[`event:${subType}`]!;
          }
        }

        // Build style
        let style = STYLE_MAP[category];
        if (elType === 'endEvent') style = END_EVENT_STYLE;

        const node: DiagramNode = {
          id,
          label: name || formatLabel(elType, id),
          shape: SHAPE_MAP[category],
          icon,
        };
        if (style) node.style = style;

        nodes.push(node);
        processMembers.push(id);

        // Handle sub-process children (recurse into nested elements)
        if (elType === 'subProcess' || elType === 'transaction') {
          const subMembers = extractSubProcessNodes(el, nodes, edges, nodeIds);
          if (subMembers.length > 0) {
            groups.push({
              id: `group_${id}`,
              label: name || id,
              members: subMembers,
              style: { backgroundColor: '#EFF6FF', borderColor: '#93C5FD', labelColor: '#1E40AF' },
            });
          }
        }
      }
    }

    // Extract sequence flows
    const flows = ensureArray(process.sequenceFlow ?? process['bpmn:sequenceFlow']);
    for (const flow of flows) {
      const from = attr(flow, 'sourceRef');
      const to = attr(flow, 'targetRef');
      if (!from || !to) continue;
      if (!nodeIds.has(from) || !nodeIds.has(to)) continue;

      const edge: DiagramEdge = { from, to };
      const name = attr(flow, 'name');
      if (name) edge.label = name;
      edges.push(edge);
    }

    // Extract message flows from collaboration
    if (collaboration) {
      const msgFlows = ensureArray(collaboration.messageFlow ?? collaboration['bpmn:messageFlow']);
      for (const flow of msgFlows) {
        const from = attr(flow, 'sourceRef');
        const to = attr(flow, 'targetRef');
        if (!from || !to) continue;
        if (!nodeIds.has(from) || !nodeIds.has(to)) continue;

        const edge: DiagramEdge = { from, to, style: 'dashed' };
        const name = attr(flow, 'name');
        if (name) edge.label = name;
        edges.push(edge);
      }
    }

    // Create pool/lane groups
    if (participantMap.has(processId) && processMembers.length > 0) {
      groups.push({
        id: `pool_${processId}`,
        label: participantMap.get(processId),
        members: processMembers,
        style: { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0', labelColor: '#475569' },
      });
    }

    // Extract lane sets
    const laneSets = ensureArray(process.laneSet ?? process['bpmn:laneSet']);
    for (const laneSet of laneSets) {
      const lanes = ensureArray(laneSet.lane ?? laneSet['bpmn:lane']);
      for (const lane of lanes) {
        const laneId = attr(lane, 'id') ?? 'lane';
        const laneName = attr(lane, 'name');
        const refs = ensureArray(lane.flowNodeRef ?? lane['bpmn:flowNodeRef']);
        const members = refs.map((r: any) => typeof r === 'string' ? r : r['#text'] ?? String(r)).filter((m: string) => nodeIds.has(m));
        if (members.length > 0) {
          groups.push({
            id: laneId,
            label: laneName ?? laneId,
            members,
            style: { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0', labelColor: '#475569' },
          });
        }
      }
    }
  }

  // Build spec
  const spec: DiagramSpec = {
    type: 'flow',
    title: attr(definitions, 'name') || extractTitle(processes),
    direction: options.direction ?? 'LR',
    nodes,
    edges,
  };
  if (groups.length > 0) spec.groups = groups;

  return spec;
}

// ── Sub-process extraction ──────────────────────────────────────────────

function extractSubProcessNodes(
  subProcess: any,
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  nodeIds: Set<string>,
): string[] {
  const elementTypes = Object.keys(CATEGORY);
  const members: string[] = [];

  for (const elType of elementTypes) {
    const elements = ensureArray(subProcess[elType] ?? subProcess[`bpmn:${elType}`]);
    for (const el of elements) {
      const id = attr(el, 'id');
      if (!id || nodeIds.has(id)) continue;
      nodeIds.add(id);

      const name = attr(el, 'name');
      const category = CATEGORY[elType]!;

      let icon = ICON_DEFAULTS[elType] ?? '';
      if (category === 'event') {
        const subType = detectEventSubType(el);
        if (subType && ICON_DEFAULTS[`event:${subType}`]) {
          icon = ICON_DEFAULTS[`event:${subType}`]!;
        }
      }

      let style = STYLE_MAP[category];
      if (elType === 'endEvent') style = END_EVENT_STYLE;

      const node: DiagramNode = {
        id,
        label: name || formatLabel(elType, id),
        shape: SHAPE_MAP[category],
        icon,
      };
      if (style) node.style = style;
      nodes.push(node);
      members.push(id);
    }
  }

  // Sequence flows within the sub-process
  const flows = ensureArray(subProcess.sequenceFlow ?? subProcess['bpmn:sequenceFlow']);
  for (const flow of flows) {
    const from = attr(flow, 'sourceRef');
    const to = attr(flow, 'targetRef');
    if (!from || !to) continue;
    if (!nodeIds.has(from) || !nodeIds.has(to)) continue;
    const edge: DiagramEdge = { from, to };
    const name = attr(flow, 'name');
    if (name) edge.label = name;
    edges.push(edge);
  }

  return members;
}

// ── Formatting helpers ──────────────────────────────────────────────────

function formatLabel(elType: string, id: string): string {
  // Turn camelCase element type into readable label
  const readable = elType.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim();
  return readable;
}

function extractTitle(processes: any[]): string | undefined {
  if (processes.length === 1) {
    const name = attr(processes[0], 'name');
    if (name) return name;
  }
  return undefined;
}
