/**
 * FFmpeg 转码 / 探针模块
 * 零 npm 依赖，使用 Bun / Node built-in 模块
 */

import { spawnSync } from 'child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { FfmpegConvertInput, FfmpegConvertOutput, FfmpegProbeInput, FfmpegProbeOutput } from './types';

// ——— ffmpeg 路径探测 ——— //
export function findFfmpeg(): string | null {
  const candidates = [
    '/opt/homebrew/bin/ffmpeg',
    '/usr/local/bin/ffmpeg',
    '/usr/bin/ffmpeg',
  ];
  for (const p of candidates) {
    try { if (existsSync(p)) return p; } catch { /* ignore */ }
  }
  const r = spawnSync('which', ['ffmpeg'], { encoding: 'utf8' });
  return r.stdout?.trim() || null;
}

/**
 * FFmpeg 转码
 * 支持通过 args 传递命令行参数，可选 inputBase64 传入输入数据
 */
export async function ffmpegConvert(input: FfmpegConvertInput): Promise<FfmpegConvertOutput> {
  const ffmpegBin = findFfmpeg();
  if (!ffmpegBin) return { ok: false, error: 'ffmpeg 未找到' };

  const tmp = mkdtempSync(join(tmpdir(), 'vf-ffmpeg-'));
  const inputPath = input.inputBase64 ? join(tmp, 'in.bin') : null;
  const outputPath = join(tmp, input.outputName || 'out');

  try {
    const finalArgs = [...input.args];
    if (inputPath) {
      writeFileSync(inputPath, Buffer.from(input.inputBase64, 'base64'));
      finalArgs.unshift('-i', inputPath);
    }
    finalArgs.push('-y', outputPath);

    const r = spawnSync(ffmpegBin, finalArgs, { encoding: 'utf8', timeout: 600_000 });
    if (r.status !== 0) {
      return { ok: false, error: (r.stderr || '').slice(-500) };
    }

    const out = readFileSync(outputPath);
    return { ok: true, outputBase64: out.toString('base64'), size: out.length };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  } finally {
    try { spawnSync('rm', ['-rf', tmp]); } catch { /* ignore */ }
  }
}

/**
 * FFmpeg 探针 — 下载远程文件并用 ffmpeg -i 获取元信息
 */
export async function ffmpegProbe(input: FfmpegProbeInput): Promise<FfmpegProbeOutput> {
  const ffmpegBin = findFfmpeg();
  if (!ffmpegBin) return { stderr: 'ffmpeg 未找到' };

  const tmp = mkdtempSync(join(tmpdir(), 'vf-probe-'));
  const localPath = join(tmp, 'probe.bin');

  try {
    // 下载远程文件
    const resp = await fetch(input.url);
    if (!resp.ok) return { stderr: `download failed: ${resp.status}` };
    const buf = Buffer.from(await resp.arrayBuffer());
    writeFileSync(localPath, buf);

    const r = spawnSync(ffmpegBin, ['-i', localPath], { encoding: 'utf8', timeout: 30_000 });
    return { stderr: r.stderr || '' };
  } catch (e: any) {
    return { stderr: String(e?.message || e) };
  } finally {
    try { spawnSync('rm', ['-rf', tmp]); } catch { /* ignore */ }
  }
}
