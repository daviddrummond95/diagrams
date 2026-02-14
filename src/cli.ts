#!/usr/bin/env bun
import { Command } from 'commander';
import { readFile, writeFile } from 'fs/promises';
import { basename, extname, resolve } from 'path';
import { parseSpec } from './parse.js';
import { validate } from './validate.js';
import { renderDiagram } from './render/index.js';
import type { OutputFormat, Direction } from './types.js';

const program = new Command();

program
  .name('diagrams')
  .description('Generate beautiful flow diagrams from declarative specs')
  .version('0.1.0');

program
  .command('render')
  .description('Render a diagram from a YAML or JSON spec file')
  .argument('<input>', 'Input file path (.yaml, .yml, .json) or "-" for stdin')
  .option('-o, --output <path>', 'Output file path')
  .option('-f, --format <format>', 'Output format: png, svg, html', 'png')
  .option('-t, --theme <theme>', 'Theme: default, dark', 'default')
  .option('-w, --width <number>', 'Canvas width in pixels')
  .option('-s, --scale <number>', 'Scale factor for PNG output', '2')
  .option('-d, --direction <dir>', 'Flow direction: TB, LR')
  .option('-p, --padding <number>', 'Padding around diagram in pixels', '40')
  .action(async (input: string, opts: Record<string, string>) => {
    try {
      // Read input
      let content: string;
      if (input === '-') {
        const chunks: Buffer[] = [];
        for await (const chunk of Bun.stdin.stream()) {
          chunks.push(Buffer.from(chunk));
        }
        content = Buffer.concat(chunks).toString('utf-8');
      } else {
        content = await readFile(resolve(input), 'utf-8');
      }

      // Parse
      const spec = parseSpec(content);

      // Override direction if specified
      if (opts.direction) {
        spec.direction = opts.direction as Direction;
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
        scale: parseFloat(opts.scale),
        padding: parseInt(opts.padding),
      });

      // Determine output path
      let outputPath = opts.output;
      if (!outputPath) {
        const base = input === '-' ? 'diagram' : basename(input, extname(input));
        const ext = format === 'png' ? '.png' : format === 'svg' ? '.svg' : '.html';
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
        const chunks: Buffer[] = [];
        for await (const chunk of Bun.stdin.stream()) {
          chunks.push(Buffer.from(chunk));
        }
        content = Buffer.concat(chunks).toString('utf-8');
      } else {
        content = await readFile(resolve(input), 'utf-8');
      }

      const spec = parseSpec(content);
      const errors = validate(spec);

      if (errors.length === 0) {
        console.log('Valid diagram spec ✓');
        console.log(`  ${spec.nodes.length} nodes, ${spec.edges.length} edges`);
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
    console.log('Available themes:');
    console.log('  default  Clean modern light theme');
    console.log('  dark     Dark mode theme');
  });

program.parse();
