/**
 * ═══════════════════════════════════════════════════════════════
 *  KUZGU — Web page archiver (SingleFile)
 *
 *  Captures a full web page (HTML + inlined CSS/images/fonts) into a
 *  single self-contained .html file for evidence preservation, using
 *  gildas-lormeau/SingleFile's CLI driving the system Chrome.
 *
 *  Archives are saved under public/archives/ so they're viewable in
 *  the browser at /archives/<file>. SSRF-guarded by the caller.
 * ═══════════════════════════════════════════════════════════════
 */

import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

function resolveSingleFile(): string {
  const candidates = [
    process.env.SINGLEFILE_PATH,
    join(homedir(), '.nvm', 'versions', 'node', `v${process.versions.node}`, 'bin', 'single-file'),
    '/usr/local/bin/single-file',
    '/opt/homebrew/bin/single-file',
  ].filter(Boolean) as string[];
  for (const c of candidates) if (existsSync(c)) return c;
  return 'single-file';
}

function resolveChrome(): string {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/opt/homebrew/bin/chromium',
  ].filter(Boolean) as string[];
  for (const c of candidates) if (existsSync(c)) return c;
  return '';
}

export interface ArchiveResult {
  url: string;
  file: string;        // absolute path on disk
  publicPath: string;  // browser-accessible path
  bytes: number;
  elapsedMs: number;
}

export class ArchiveError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function slug(host: string): string {
  return host.replace(/[^a-z0-9.-]/gi, '_').slice(0, 60);
}

function run(bin: string, args: string[]): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    execFile(bin, args, { timeout: 90_000, maxBuffer: 4 * 1024 * 1024, env: process.env }, (err, _stdout, stderr) => {
      const code = err ? ((err as NodeJS.ErrnoException).code as unknown as number) ?? 1 : 0;
      resolve({ code: typeof code === 'number' ? code : 1, stderr: stderr || '' });
    });
  });
}

export async function archiveUrl(target: string): Promise<ArchiveResult> {
  const t0 = Date.now();
  const u = new URL(target.includes('://') ? target : `https://${target}`);

  const chrome = resolveChrome();
  if (!chrome) throw new ArchiveError(503, 'No Chrome/Chromium found. Set CHROME_PATH.');

  const dir = join(process.cwd(), 'public', 'archives');
  await mkdir(dir, { recursive: true });
  const fileName = `${slug(u.hostname)}-${Date.now()}.html`;
  const outPath = join(dir, fileName);

  const bin = resolveSingleFile();
  await run(bin, [
    u.href,
    outPath,
    '--browser-executable-path', chrome,
    '--browser-headless', 'true',
    '--browser-load-max-time', '45000',
  ]);

  let bytes = 0;
  try {
    bytes = (await stat(outPath)).size;
  } catch {
    throw new ArchiveError(502, 'SingleFile produced no archive (is single-file-cli installed?).');
  }
  if (bytes === 0) throw new ArchiveError(502, 'Archive is empty — the page may have blocked capture.');

  return {
    url: u.href,
    file: outPath,
    publicPath: `/archives/${fileName}`,
    bytes,
    elapsedMs: Date.now() - t0,
  };
}
