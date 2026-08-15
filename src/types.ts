/**
 * clawdao-video-factory — 共享类型定义
 *
 * 📦 零 npm 依赖，仅依赖 Bun / Node built-in 模块
 */

/** 运行模式 */
export type VideoFactoryMode = 'http-server' | 'cli' | 'embedded';

/** 全局配置 */
export interface VideoFactoryConfig {
  ffmpegPath?: string;
  ytDlpPath?: string;
  tempDir?: string;
  /** 实际监听端口（由 startServer 注入，用于 health 报告一致端口） */
  port?: number;
}

// ——— 抖音 ——— //
export interface DouyinExtractInput {
  shareUrl: string;
}
export interface DouyinExtractOutput {
  videoUrl: string;
  videoId: string;
  title: string;
  author: string;
  cover: string;
}

export interface DouyinAudioInput {
  videoUrl: string;
  maxSec?: number;
}
export interface DouyinAudioOutput {
  wav: string;            // base64 encoded
  size: number;
  totalDurationSec: number;
  slicedDurationSec: number;
  sliced: boolean;
  maxSec: number;
}

// ——— yt-dlp ——— //
export interface YtDlpDownloadInput {
  url: string;
  outDir?: string;
  maxHeight?: number;
  cookies?: string;
}
export interface YtDlpDownloadOutput {
  ok: boolean;
  path?: string;
  title?: string;
  duration?: number;
  platform?: string;
  thumbnail?: string;
  error_code?: string | null;
  error_message?: string | null;
}

// ——— FFmpeg ——— //
export interface FfmpegConvertInput {
  args: string[];
  inputBase64?: string;
  outputName?: string;
}
export interface FfmpegConvertOutput {
  ok: boolean;
  outputBase64?: string;
  size?: number;
  error?: string;
}

export interface FfmpegProbeInput {
  url: string;
}
export interface FfmpegProbeOutput {
  stderr: string;
}

// ——— HTTP 代理 ——— //
export interface ProxyFetchInput {
  url: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
}
export interface ProxyFetchOutput {
  status: number;
  contentType: string;
  body: string;
}

export interface ProxyFetchBinaryInput {
  url: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
}
export interface ProxyFetchBinaryOutput {
  status: number;
  contentType: string;
  body: string;   // base64
}

// ——— 健康检查 ——— //
export interface HealthCheckResult {
  ok: boolean;
  port: number;
  ffmpeg: boolean;
  ytDlp: boolean;
  longcat?: boolean;
}

// ——— v1.1 管线（预留扩展点） ——— //
/**
 * 视频生成 provider — PipelineConfig.video.provider 预留扩展点。
 * 'longcat' 由 src/longcat.ts 提供远程接入；管线编排随 v1.1 实施落地，
 * 本次不改动 v1.1 引擎（见 docs/plans/v1/02-longcat-remote-deploy.md C5）。
 */
export type PipelineVideoProvider = 'seedance' | 'hailuo' | 'longcat';
