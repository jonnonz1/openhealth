#!/usr/bin/env bun
import { VERSION } from '@openhealth/core';

/**
 * CLI entry point. Wiring up against @openhealth/core happens in step 11 of the plan.
 */
export function main(argv: readonly string[]): number {
  if (argv.includes('--version') || argv.includes('-v')) {
    process.stdout.write(`openhealth ${VERSION}\n`);
    return 0;
  }

  process.stderr.write('openhealth: not implemented yet — see specs/001-initial-plan.md §11\n');
  return 1;
}

const isEntry = import.meta.url === `file://${process.argv[1]}`;
if (isEntry) {
  process.exit(main(process.argv.slice(2)));
}
