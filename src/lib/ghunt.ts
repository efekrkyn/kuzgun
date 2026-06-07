/**
 * ═══════════════════════════════════════════════════════════════
 *  KUZGU — Google account OSINT (GHunt)
 *
 *  Resolves a Google account from an email: Gaia ID, profile names,
 *  emails, profile photos, in-app reachability, and Maps review stats.
 *
 *  Runs `scripts/ghunt_email.py` (a thin runner that calls GHunt's
 *  lower-level APIs directly and serializes with GHunt's encoder —
 *  this avoids two bugs in GHunt 2.3.4's own `--json` export, without
 *  editing the pip-installed package).
 *
 *  Requires GHunt installed AND authenticated once via `ghunt login`
 *  (creds at ~/.malfrats/ghunt/creds.m). Reports clearly when not.
 * ═══════════════════════════════════════════════════════════════
 */

import { execFile } from 'node:child_process';
import { readFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = join(process.cwd(), 'scripts', 'ghunt_email.py');
const PYTHON = process.env.PYTHON_BIN || 'python3';

export interface GhuntResult {
  email: string;
  data: unknown;
  elapsedMs: number;
}

export class GhuntError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function run(args: string[]): Promise<void> {
  return new Promise((resolve) => {
    execFile(PYTHON, [SCRIPT, ...args], { timeout: 80_000, maxBuffer: 8 * 1024 * 1024, env: process.env }, () => resolve());
  });
}

export async function huntGoogle(email: string): Promise<GhuntResult> {
  const t0 = Date.now();
  const outFile = join(tmpdir(), `kuzgu-ghunt-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);

  await run([email, outFile]);

  let raw: string | null = null;
  try {
    raw = await readFile(outFile, 'utf8');
  } catch {
    raw = null;
  } finally {
    unlink(outFile).catch(() => {});
  }

  if (!raw) {
    throw new GhuntError(502, 'GHunt produced no output (is it installed & is python3 on PATH?).');
  }

  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new GhuntError(502, 'Failed to parse GHunt output.');
  }

  if (data && data.error) {
    if (data.error === 'not_authenticated') {
      throw new GhuntError(401, 'GHunt is not authenticated. Run `ghunt login` once.');
    }
    if (data.error === 'not_found') {
      throw new GhuntError(404, 'No public Google account found for this email.');
    }
    throw new GhuntError(502, `GHunt error: ${data.error}`);
  }

  return { email, data, elapsedMs: Date.now() - t0 };
}
