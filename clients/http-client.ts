/**
 * clawdao-video-factory HTTP 客户端
 *
 * 供前端/Node 应用通过 HTTP 调用视频工厂功能。
 *
 * 用法:
 *   import { createHttpClient } from '@clawdao/video-factory/clients/http-client';
 *   const client = createHttpClient('http://localhost:18792');
 *   const info = await client.douyinExtract({ shareUrl: '...' });
 */

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

export interface VideoFactoryClient {
  douyinExtract(input: DouyinExtractInput): Promise<DouyinExtractOutput | null>;
  douyinAudio(input: DouyinAudioInput): Promise<DouyinAudioOutput>;
  ytDlpDownload(input: YtDlpDownloadInput): Promise<YtDlpDownloadOutput>;
  ffmpegConvert(input: FfmpegConvertInput): Promise<FfmpegConvertOutput>;
  ffmpegProbe(input: FfmpegProbeInput): Promise<FfmpegProbeOutput>;
  proxyFetch(input: ProxyFetchInput): Promise<ProxyFetchOutput>;
  proxyFetchBinary(input: ProxyFetchBinaryInput): Promise<ProxyFetchBinaryOutput>;
  health(): Promise<HealthCheckResult>;
}

export function createHttpClient(baseUrl: string): VideoFactoryClient {
  async function post<T>(path: string, body: unknown): Promise<T> {
    const resp = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return resp.json();
  }

  return {
    douyinExtract: (input) => post('/api/douyin/extract', input),
    douyinAudio: (input) => post('/api/douyin/audio', input),
    ytDlpDownload: (input) => post('/api/yt-dlp/download', input),
    ffmpegConvert: (input) => post('/api/ffmpeg/convert', input),
    ffmpegProbe: (input) => post('/api/ffmpeg/probe', input),
    proxyFetch: (input) => post('/api/proxy/fetch', input),
    proxyFetchBinary: (input) => post('/api/proxy/fetch-binary', input),
    health: () => fetch(`${baseUrl}/api/health`).then((r) => r.json()),
  };
}
