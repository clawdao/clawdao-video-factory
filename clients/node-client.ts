/**
 * clawdao-video-factory Node 客户端
 *
 * 直接通过子进程调用 video-factory CLI（无 HTTP 开销）。
 * 适用于 Node/Bun 服务端直接调用。
 *
 * 用法:
 *   import { createNodeClient } from '@clawdao/video-factory/clients/node-client';
 *   const client = createNodeClient();
 *   const info = await client.douyinExtract({ shareUrl: '...' });
 */

import { spawnSync } from 'child_process';
import { resolve } from 'path';
import type {
  DouyinExtractInput, DouyinExtractOutput,
  DouyinAudioInput, DouyinAudioOutput,
  YtDlpDownloadInput, YtDlpDownloadOutput,
  FfmpegConvertInput, FfmpegConvertOutput,
  FfmpegProbeInput, FfmpegProbeOutput,
  ProxyFetchInput, ProxyFetchOutput,
  ProxyFetchBinaryInput, ProxyFetchBinaryOutput,
  HealthCheckResult,
} from '../src/types';

export interface VideoFactoryNodeClient {
  douyinExtract(input: DouyinExtractInput): Promise<DouyinExtractOutput | null>;
  douyinAudio(input: DouyinAudioInput): Promise<DouyinAudioOutput>;
  ytDlpDownload(input: YtDlpDownloadInput): Promise<YtDlpDownloadOutput>;
  ffmpegConvert(input: FfmpegConvertInput): Promise<FfmpegConvertOutput>;
  ffmpegProbe(input: FfmpegProbeInput): Promise<FfmpegProbeOutput>;
  proxyFetch(input: ProxyFetchInput): Promise<ProxyFetchOutput>;
  proxyFetchBinary(input: ProxyFetchBinaryInput): Promise<ProxyFetchBinaryOutput>;
  health(): Promise<HealthCheckResult>;
}

export function createNodeClient(options?: { factoryDir?: string }): VideoFactoryNodeClient {
  const factoryDir = options?.factoryDir || resolve(import.meta.dirname || __dirname, '..');
  const entryPoint = resolve(factoryDir, 'src/index.ts');

  function runViaCli<T>(endpoint: string, input: unknown): T {
    const result = spawnSync('bun', ['run', entryPoint, endpoint, '--json', JSON.stringify(input)], {
      encoding: 'utf8',
      timeout: 600_000,
    });
    if (result.status !== 0) throw new Error(result.stderr || 'CLI failed');
    return JSON.parse(result.stdout);
  }

  return {
    douyinExtract: (input) => Promise.resolve(runViaCli('douyin/extract', input)),
    douyinAudio: (input) => Promise.resolve(runViaCli('douyin/audio', input)),
    ytDlpDownload: (input) => Promise.resolve(runViaCli('yt-dlp/download', input)),
    ffmpegConvert: (input) => Promise.resolve(runViaCli('ffmpeg/convert', input)),
    ffmpegProbe: (input) => Promise.resolve(runViaCli('ffmpeg/probe', input)),
    proxyFetch: (input) => Promise.resolve(runViaCli('proxy/fetch', input)),
    proxyFetchBinary: (input) => Promise.resolve(runViaCli('proxy/fetch-binary', input)),
    health: () => Promise.resolve(runViaCli('health', {})),
  };
}
