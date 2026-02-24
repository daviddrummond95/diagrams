#!/usr/bin/env node
import { Command } from 'commander';
import { readFile, writeFile } from 'fs/promises';
import { basename, extname, resolve } from 'path';
import { parseSpec } from './parse.js';
import { validate } from './validate.js';
import { renderDiagram } from './render/index.js';
import type { OutputFormat, Direction, DiagramSpec } from './types.js';
import { themes } from './themes/index.js';
import { convertBpmn } from './convert/bpmn.js';
import YAML from 'yaml';

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    process.stdin.on('error', reject);
  });
}

const program = new Command();

program
  .name('diagrams')
  .description('Generate beautiful diagrams from declarative specs (flow, gantt, timeline, quadrant)')
  .version('0.1.0');

program
  .command('render')
  .description('Render a diagram from a YAML or JSON spec file')
  .argument('<input>', 'Input file path (.yaml, .yml, .json) or "-" for stdin')
  .option('-o, --output <path>', 'Output file path')
  .option('-f, --format <format>', 'Output format: png, svg, html, pptx', 'png')
  .option('-t, --theme <theme>', 'Theme name (run "diagrams themes" to list)', 'default')
  .option('-w, --width <number>', 'Canvas width in pixels')
  .option('-s, --scale <number>', 'Scale factor for PNG output', '2')
  .option('-d, --direction <dir>', 'Flow direction: TB, LR')
  .option('-p, --padding <number>', 'Padding around diagram in pixels', '40')
  .option('--no-background', 'Transparent background (no canvas color)')
  .option('--no-title', 'Suppress diagram title')
  .action(async (input: string, opts: Record<string, any>) => {
    try {
      // Read input
      let content: string;
      if (input === '-') {
        content = await readStdin();
      } else {
        content = await readFile(resolve(input), 'utf-8');
      }

      // Parse
      const spec = parseSpec(content);

      // Override direction if specified (only for flow/timeline)
      if (opts.direction && ('direction' in spec)) {
        (spec as DiagramSpec).direction = opts.direction as Direction;
      }

      // Override theme if specified
      if (opts.theme) {
        spec.theme = opts.theme;
      }

      // Validate
      const errors = validate(spec);
      if (errors.length > 0) {
        console.error('Validation errors:');
        errors.forEach(e => console.error(`  - ${e}`));
        process.exit(1);
      }

      const format = opts.format as OutputFormat;
      const result = await renderDiagram(spec, {
        format,
        width: opts.width ? parseInt(opts.width) : undefined,
        scale: parseFloat(opts.scale as string),
        padding: parseInt(opts.padding as string),
        background: opts.background === false ? 'transparent' : undefined,
        showTitle: opts.title !== false ? undefined : false,
      });

      // Determine output path
      let outputPath = opts.output;
      if (!outputPath) {
        const base = input === '-' ? 'diagram' : basename(input, extname(input));
        const extMap: Record<string, string> = { png: '.png', svg: '.svg', html: '.html', pptx: '.pptx' };
        const ext = extMap[format] ?? '.png';
        outputPath = base + ext;
      }

      if (typeof result === 'string') {
        await writeFile(outputPath, result, 'utf-8');
      } else {
        await writeFile(outputPath, result);
      }

      console.log(`Rendered ${format.toUpperCase()} → ${outputPath}`);
    } catch (err: unknown) {
      console.error(`Error: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate a diagram spec without rendering')
  .argument('<input>', 'Input file path or "-" for stdin')
  .action(async (input: string) => {
    try {
      let content: string;
      if (input === '-') {
        content = await readStdin();
      } else {
        content = await readFile(resolve(input), 'utf-8');
      }

      const spec = parseSpec(content);
      const errors = validate(spec);

      if (errors.length === 0) {
        const type = spec.type ?? 'flow';
        console.log(`Valid ${type} diagram spec ✓`);
        if (type === 'flow') {
          const flowSpec = spec as DiagramSpec;
          console.log(`  ${flowSpec.nodes.length} nodes, ${flowSpec.edges.length} edges`);
        } else if (type === 'gantt') {
          console.log(`  ${(spec as any).tasks.length} tasks`);
        } else if (type === 'timeline') {
          console.log(`  ${(spec as any).events.length} events`);
        } else if (type === 'quadrant') {
          console.log(`  ${(spec as any).items.length} items`);
        }
      } else {
        console.error('Validation errors:');
        errors.forEach(e => console.error(`  - ${e}`));
        process.exit(1);
      }
    } catch (err: unknown) {
      console.error(`Error: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  });

program
  .command('themes')
  .description('List available themes')
  .action(() => {
    const descriptions: Record<string, string> = {
      'default':              'Clean modern light theme',
      'dark':                 'Dark mode with navy background',
      'ocean':                'Deep blue tones',
      'sunset':               'Warm orange palette',
      'forest':               'Fresh green palette',
      'lavender':             'Soft purple tones',
      'rose':                 'Pink and crimson palette',
      'corporate':            'Clean professional with slate grays',
      'midnight':             'Ultra-dark slate background',
      'nord':                 'Arctic color palette',
      'solarized-light':      'Solarized light color scheme',
      'solarized-dark':       'Solarized dark color scheme',
      'neon':                 'Black with bright green accents',
      'cyberpunk':            'Purple, magenta, and cyan neon',
      'dracula':              'Dark purple Dracula palette',
      'monokai':              'Dark editor-inspired palette',
      'monochrome':           'Minimal grayscale',
      'blueprint':            'Blue on blue technical drawing',
      'ink':                  'Hand-drawn ink on parchment',
      'pastel':               'Soft warm pastels',
      'high-contrast':        'Black and white (dark)',
      'high-contrast-light':  'Black and white (light)',
    };

    console.log('Available themes:\n');
    const maxLen = Math.max(...Object.keys(descriptions).map(k => k.length));
    for (const [name, desc] of Object.entries(descriptions)) {
      console.log(`  ${name.padEnd(maxLen + 2)}${desc}`);
    }
    console.log(`\nUsage: diagrams render spec.yaml --theme <name>`);
  });

program
  .command('convert')
  .description('Convert a BPMN file to a diagrams YAML spec')
  .argument('<input>', 'Input BPMN file path (.bpmn, .xml) or "-" for stdin')
  .option('-o, --output <path>', 'Output file path (default: stdout)')
  .option('-d, --direction <dir>', 'Flow direction: TB, LR', 'LR')
  .option('-r, --render', 'Render immediately after converting (outputs PNG)')
  .option('-f, --format <format>', 'Output format when using --render: png, svg, html, pptx', 'png')
  .option('-t, --theme <theme>', 'Theme name for rendering', 'default')
  .action(async (input: string, opts: Record<string, any>) => {
    try {
      // Read input
      let content: string;
      if (input === '-') {
        content = await readStdin();
      } else {
        content = await readFile(resolve(input), 'utf-8');
      }

      // Convert BPMN → DiagramSpec
      const spec = convertBpmn(content, {
        direction: opts.direction as 'TB' | 'LR',
      });

      // Validate
      const errors = validate(spec);
      if (errors.length > 0) {
        console.error('Conversion produced validation warnings:');
        errors.forEach(e => console.error(`  - ${e}`));
      }

      const yamlStr = YAML.stringify(spec, { lineWidth: 0 });

      if (opts.render) {
        // Render directly
        spec.theme = opts.theme;
        const format = opts.format as OutputFormat;
        const result = await renderDiagram(spec, { format, scale: 2, padding: 40 });
        const base = input === '-' ? 'diagram' : basename(input, extname(input));
        const extMap: Record<string, string> = { png: '.png', svg: '.svg', html: '.html', pptx: '.pptx' };
        const outputPath = opts.output ?? (base + extMap[format]);
        if (typeof result === 'string') {
          await writeFile(outputPath, result, 'utf-8');
        } else {
          await writeFile(outputPath, result);
        }
        console.log(`Converted & rendered ${format.toUpperCase()} → ${outputPath}`);
      } else if (opts.output) {
        await writeFile(opts.output, yamlStr, 'utf-8');
        console.log(`Converted BPMN → ${opts.output}`);
        console.log(`  ${spec.nodes.length} nodes, ${spec.edges.length} edges` +
          (spec.groups?.length ? `, ${spec.groups.length} groups` : ''));
      } else {
        // stdout
        process.stdout.write(yamlStr);
      }
    } catch (err: unknown) {
      console.error(`Error: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  });

program.parse();
