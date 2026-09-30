import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Railway may start the pre-deploy command without a shell. Then "a && b" hands "&&" and b to the first
// step as extra arguments, the first step still succeeds, and the second one silently never runs.
const railwayJson = fileURLToPath(new URL('../../railway.json', import.meta.url));
const backendDir = fileURLToPath(new URL('..', import.meta.url));

describe("Railway's pre-deploy command", () => {
  it('runs the migrations and then the sample-data step, even without a shell', () => {
    const { deploy } = JSON.parse(readFileSync(railwayJson, 'utf8'));
    const [command, ...args] = deploy.preDeployCommand.split(' ');

    const result = spawnSync(command, args, {
      cwd: backendDir,
      encoding: 'utf8',
      env: { ...process.env, PREVIEW_MODE: 'false', npm_config_update_notifier: 'false' },
    });
    const output = result.stdout + result.stderr;

    expect(result.status).toBe(0);
    expect(output).toContain('No pending migrations to apply.');
    expect(output).toContain('This is not the preview site, so no sample data is loaded.');
  }, 60_000);
});
