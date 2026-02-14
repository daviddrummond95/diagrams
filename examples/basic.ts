import { diagram } from '../src/index.js';
import { writeFile } from 'fs/promises';

const png = await diagram(
  {
    nodes: [
      { id: 'input', label: 'User Input', shape: 'rounded' },
      { id: 'validate', label: 'Validate' },
      { id: 'process', label: 'Process Data' },
      { id: 'respond', label: 'Send Response', shape: 'pill' },
    ],
    edges: [
      { from: 'input', to: 'validate' },
      { from: 'validate', to: 'process' },
      { from: 'process', to: 'respond' },
    ],
    direction: 'TB',
  },
  { format: 'png', scale: 2 },
);

await writeFile('basic-flow.png', png);
console.log('Written: basic-flow.png');
