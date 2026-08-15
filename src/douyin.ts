/**
 * 抖音解析模块
 * 零 npm 依赖，使用 Bun / Node built-in 模块
 */

import { spawnSync } from 'child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, copyFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { DouyinExtractInput, DouyinExtractOutput, DouyinAudioInput, DouyinAudioOutput } from './types';
import { findFfmpeg } from './ffmpeg';

const DY_URL_RE = /https?:\/\/(?:v\.)?douyin\.com\/[A-Za-z0-9_-]+\/?/i;
const DY_IES_RE = /https?:\/\/www\.iesdouyin\.com\/[^\s]+/i;

function cleanDouyinUrl(raw: string): string {
  const m = raw.match(DY_URL_RE) || raw.match(DY_IES_RE);
  return (m ? m[0] : raw).replace(/\/$/, '');
}

function decodeUnicode(str: string): string {
  return str.replace(/\\u[\dA-Fa-f]{4}/g, (m) => String.fromCharCode(parseInt(m.slice(2), 16)));
}

/**
 * 抖音分享短链 → 真实 mp4 URL
 */
export async function douyinExtract(input: DouyinExtractInput): Promise<DouyinExtractOutput | null> {
  const cleaned = cleanDouyinUrl(input.shareUrl);
  const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15';

  const resp = await fetch(cleaned, {
    headers: { 'User-Agent': ua, 'Accept-Language': 'zh-CN,zh;q=0.9' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!resp.ok) return null;

  const html = await resp.text();

  // 从页面中提取 play_addr URL
  const playMatch = html.match(/play_addr[^}]*"url_list":\s*\[\s*"([^"]+)"/);
  if (!playMatch) return null;

  const escaped = playMatch[1]
    .replace(/\\u002F/g, '/')
    .replace(/\\u003F/g, '?')
    .replace(/\\u0026/g, '&')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');

  const videoId = (escaped.match(/video_id=([^&]+)/)?.[1]) || '';
  const titleMatch = html.match(/"desc"\s*:\s*"([^"]{1,200})"/);
  const title = titleMatch ? decodeUnicode(titleMatch[1]) : '';
  const authorMatch = html.match(/"nickname"\s*:\s*"([^"]{1,80})"/);
  const author = authorMatch ? decodeUnicode(authorMatch[1]) : '';
  const coverMatch = html.match(/(https?:[^"\\]+?\.(?:jpe?g|png))[^"\\]*/i);
  const cover = coverMatch ? coverMatch[1].replace(/\\u002F/g, '/') : '';

  return { videoUrl: escaped, videoId, title, author, cover };
}

/**
 * 真实 mp4 → 16k mono WAV 切片
 */
export async function douyinAudio(input: DouyinAudioInput): Promise<DouyinAudioOutput> {
  const ffmpegBin = findFfmpeg();
  if (!ffmpegBin) throw new Error('ffmpeg 未找到');

  const maxSec = Math.max(10, Math.min(600, input.maxSec || 120));
  const tmp = mkdtempSync(join(tmpdir(), 'vf-asr-'));
  const videoPath = join(tmp, 'in.mp4');
  const wavFull = join(tmp, 'full.wav');
  const wavOut = join(tmp, 'out.wav');

  // 下载视频
  const dlResp = await fetch(input.videoUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(600_000),
  });
  if (!dlResp.ok) throw new Error(`video download failed: ${dlResp.status}`);
  const dlBuf = Buffer.from(await dlResp.arrayBuffer());
  if (dlBuf.length < 100) throw new Error('video download too small');
  writeFileSync(videoPath, dlBuf);

  // 提取音频为 WAV
  let r = spawnSync(ffmpegBin, ['-y', '-i', videoPath, '-vn', '-ac', '1', '-ar', '16000', '-f', 'wav', wavFull], {
    stdio: 'ignore', timeout: 300_000,
  });
  if (r.status !== 0 || !existsSync(wavFull)) throw new Error('ffmpeg extract failed');

  // 获取时长
  const probe = spawnSync(ffmpegBin, ['-i', wavFull], { encoding: 'utf8', timeout: 30_000 });
  let totalDur = 0;
  const m = (probe.stderr || '').match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
  if (m) totalDur = parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3]);

  // 切片
  let sliced = false;
  let slicedDur = totalDur;
  if (totalDur > maxSec) {
    r = spawnSync(ffmpegBin, ['-y', '-i', wavFull, '-t', String(maxSec), '-ac', '1', '-ar', '16000', '-f', 'wav', wavOut], {
      stdio: 'ignore', timeout: 60_000,
    });
    sliced = true;
    slicedDur = maxSec;
  } else {
    copyFileSync(wavFull, wavOut);
  }
  if (!existsSync(wavOut)) throw new Error('ffmpeg slice failed');

  const buf = readFileSync(wavOut);
  try { spawnSync('rm', ['-rf', [tmp]]); } catch { /* ignore */ }

  return {
    wav: buf.toString('base64'),
    size: buf.length,
    totalDurationSec: Math.round(totalDur * 100) / 100,
    slicedDurationSec: Math.round(slicedDur * 100) / 100,
    sliced,
    maxSec,
  };
}
