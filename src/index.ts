#!/usr/bin/env bun
/**
 * clawdao-video-factory — 口播短视频制作工厂
 *
 * 三种使用模式：
 *   1. HTTP server:  bun run src/index.ts --port 18792
 *   2. CLI:           bun run src/index.ts douyin/extract --shareUrl="..."
 *   3. Embedded:      import { createFactory } from 'clawdao-video-factory'
 *
 * 📦 零 npm 依赖，仅使用 Bun / Node built-in 模块
 */

import { startServer } from './http-server';
import { douyinExtract, douyinAudio } from './douyin';
import { ytDlpDownload } from './yt-dlp';
import { ffmpegConvert, ffmpegProbe, findFfmpeg } from './ffmpeg';
import { proxyFetch, proxyFetchBinary } from './proxy';
import { findYtDlp } from './yt-dlp';
import type { VideoFactoryConfig } from './types';

export { startServer, createVideoFactoryServer } from './http-server';
export { douyinExtract, douyinAudio } from './douyin';
export { ytDlpDownload, findYtDlp } from './yt-dlp';
export { ffmpegConvert, ffmpegProbe, findFfmpeg } from './ffmpeg';
export { proxyFetch, proxyFetchBinary } from './proxy';
export {
  longcatSubmit, longcatQuery, longcatFetchFile, longcatHealth, longcatIsMock,
} from './longcat';
export type {
  VideoFactoryConfig, VideoFactoryMode,
  DouyinExtractInput, DouyinExtractOutput,
  DouyinAudioInput, DouyinAudioOutput,
  YtDlpDownloadInput, YtDlpDownloadOutput,
  FfmpegConvertInput, FfmpegConvertOutput,
  FfmpegProbeInput, FfmpegProbeOutput,
  ProxyFetchInput, ProxyFetchOutput,
  ProxyFetchBinaryInput, ProxyFetchBinaryOutput,
  HealthCheckResult,
  PipelineVideoProvider,
} from './types';
export type {
  LongcatSubmitInput, LongcatQueryData, LongcatJobStatus, LongcatRawResponse,
} from './longcat';

/**
 * 创建视频工厂实例（嵌入式模式）
 */
export function createFactory(config?: VideoFactoryConfig) {
  return {
    douyinExtract: (shareUrl: string) => douyinExtract({ shareUrl }),
    douyinAudio: (videoUrl: string, maxSec?: number) => douyinAudio({ videoUrl, maxSec }),
    ytDlpDownload: (input: { url: string; outDir?: string; maxHeight?: number }) => ytDlpDownload(input),
    ffmpegConvert,
    ffmpegProbe,
    proxyFetch,
    proxyFetchBinary,
    health: () => ({
      ffmpeg: !!findFfmpeg(),
      ytDlp: !!findYtDlp(),
    }),
  };
}

// ——— CLI 入口 ——— //
const args = process.argv.slice(2);

// 检查是否要启动 HTTP server
const portIndex = args.indexOf('--port');
const useServer = portIndex >= 0;

if (useServer) {
  const port = portIndex + 1 < args.length ? parseInt(args[portIndex + 1], 10) : 18792;
  startServer(isNaN(port) ? 18792 : port);
} else if (args.length === 0) {
  // 无参数时默认启动 HTTP server
  startServer(18792);
} else {
  // CLI 模式：bun run src/index.ts <endpoint> [options]
  console.error('[video-factory] CLI mode not yet implemented. Use --port for HTTP server mode.');
  console.error('  bun run src/index.ts --port 18792');
  process.exit(1);
}
