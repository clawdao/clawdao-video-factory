/**
 * yt-dlp 下载模块
 * 零 npm 依赖，使用 Bun / Node built-in 模块
 */

import { spawnSync } from 'child_process';
import { readFileSync, readdirSync, mkdirSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { YtDlpDownloadInput, YtDlpDownloadOutput } from './types';

export function findYtDlp(): string | null {
  const candidates = ['/opt/homebrew/bin/yt-dlp', '/usr/local/bin/yt-dlp', '/usr/bin/yt-dlp'];
  for (const p of candidates) {
    try { if (existsSync(p)) return p; } catch { /* ignore */ }
  }
  const r = spawnSync('which', ['yt-dlp'], { encoding: 'utf8' });
  return r.stdout?.trim() || null;
}

/**
 * yt-dlp 下载视频
 */
export async function ytDlpDownload(input: YtDlpDownloadInput): Promise<YtDlpDownloadOutput> {
  const ytDlp = findYtDlp();
  if (!ytDlp) {
    return { ok: false, error_code: 'YT_DLP_MISSING', error_message: 'yt-dlp 未找到。请运行 `brew install yt-dlp`。' };
  }

  const maxHeight = input.maxHeight || 1080;
  const outDir = input.outDir || join(tmpdir(), `vf-ytdlp-${Date.now()}`);
  try { mkdirSync(outDir, { recursive: true }); } catch { /* ignore */ }

  const cmdArgs = [
    input.url,
    '--no-playlist',
    '--no-warnings',
    '--no-progress',
    '--retries', '2',
    '--fragment-retries', '2',
    '-S', `res:${maxHeight}`,
    '--merge-output-format', 'mp4',
    '--write-info-json',
    '--write-thumbnail',
    '-o', `${outDir}/%(title).150B.%(ext)s`,
    '-P', outDir,
  ];
  if (input.cookies) cmdArgs.push('--cookies', input.cookies);

  const r = spawnSync(ytDlp, cmdArgs, { encoding: 'utf8', timeout: 600_000 });
  if (r.status !== 0) {
    const code = (() => {
      const s = (r.stderr || '').toLowerCase();
      if (s.includes('http error 412') || s.includes('fresh cookies') || s.includes('sign in')) return 'NEEDS_AUTH';
      if (s.includes('forbidden')) return 'BLOCKED';
      if (s.includes('unsupported url')) return 'UNSUPPORTED';
      if (s.includes('network') || s.includes('timed out') || s.includes('connection')) return 'NETWORK';
      return 'YT_DLP_FAILED';
    })();
    return { ok: false, error_code: code, error_message: (r.stderr || '').split('\n').slice(-3).join(' | ') };
  }

  const dirEntries = readdirSync(outDir);
  const videoFile = dirEntries.find((f: string) => /\.(mp4|mkv|webm)$/i.test(f));
  if (!videoFile) {
    return { ok: false, error_code: 'NO_VIDEO_FILE', error_message: 'yt-dlp 退出 0 但找不到视频文件' };
  }

  const videoPath = join(outDir, videoFile);
  let title: string | undefined;
  let duration: number | undefined;
  let platform: string | undefined;
  const infoFile = dirEntries.find((f: string) => f.endsWith('.info.json'));
  if (infoFile) {
    try {
      const info = JSON.parse(readFileSync(join(outDir, infoFile), 'utf8'));
      title = info.title;
      duration = info.duration;
      platform = info.extractor;
    } catch { /* ignore */ }
  }

  const thumbFile = dirEntries.find((f: string) => /\.(jpe?g|webp|png)$/i.test(f));
  return {
    ok: true,
    path: videoPath,
    title,
    duration,
    platform,
    thumbnail: thumbFile ? join(outDir, thumbFile) : undefined,
    error_code: null,
    error_message: null,
  };
}
