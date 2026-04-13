import { describe, it, expect, vi } from 'vitest';
import { main } from '../src/index.js';

describe('@openhealth/cli smoke', () => {
  it('--version writes version string and exits 0', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const code = main(['--version']);
    expect(code).toBe(0);
    expect(spy).toHaveBeenCalledWith(expect.stringMatching(/^openhealth \d+\.\d+\.\d+/));
    spy.mockRestore();
  });

  it('no args exits 1 with not-implemented message on stderr', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const code = main([]);
    expect(code).toBe(1);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('not implemented'));
    spy.mockRestore();
  });
});
