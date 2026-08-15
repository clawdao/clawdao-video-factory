/**
 * LongCat 数字人视频 — 远程 API 客户端
 * 零 npm 依赖，fetch 实现
 *
 * 端点契约：docs/plans/v1/02-longcat-remote-deploy.md 第 1 节
 * （与 clawdao-model-longcat 硬约定，不得更改）
 *
 * 配置（环境变量 / ClawDao configKeys 注入）：
 *   LONGCAT_BASE_URL  远程服务地址，如 http://<gpu-host>:8000
 *   LONGCAT_API_TOKEN 远程鉴权 token（绝不写入日志）
 *   LONGCAT_MOCK=1    本地 mock 模式：submit 返回假 jobId，query 3 秒后 success
 *                     并指向本地示例 mp4，开发联调不依赖远程服务
 */
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';
import { randomUUID } from 'crypto';
import { findFfmpeg } from './ffmpeg';

// ——— 类型（与契约第 1 节逐字对应） ——— //

export interface LongcatSubmitInput {
  image: string;               // 头像图片 base64 或 dataURL（必填）
  prompt: string;              // 场景描述文本（必填）
  audioWavBase64?: string;     // WAV 音频 base64（可空）
  resolution?: string;         // 默认 480P
}

export type LongcatJobStatus = 'running' | 'success' | 'fail';

export interface LongcatQueryData {
  status: LongcatJobStatus;
  progress?: number;           // 0~100
  message?: string;
  filePath?: string;           // success 时返回，仅文件名
  msg?: string;                // fail 时的错误信息
}

/** 透传用原始响应（状态码 + 包膜原样） */
export interface LongcatRawResponse {
  httpStatus: number;
  body: any;
}

export class LongcatError extends Error {
  httpStatus: number;
  body?: unknown;
  constructor(message: string, httpStatus = 502, body?: unknown) {
    super(message);
    this.name = 'LongcatError';
    this.httpStatus = httpStatus;
    this.body = body;
  }
}

// ——— 配置与缓存目录 ——— //

export function longcatIsMock(): boolean {
  return process.env.LONGCAT_MOCK === '1';
}

/** mp4 本地缓存目录：CLAWDAO_DATA_DIR/longcat-videos（缺省 ./.clawdao/data/longcat-videos） */
export function longcatCacheDir(): string {
  const base = process.env.CLAWDAO_DATA_DIR || join(process.cwd(), '.clawdao/data');
  const dir = join(base, 'longcat-videos');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

/** 仅允许纯文件名，拒绝目录穿越 */
export function isSafeVideoFileName(name: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(name) && !name.includes('..');
}

// ——— 远程请求（Authorization 注入，token 不输出） ——— //

async function remoteFetch(path: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const base = (process.env.LONGCAT_BASE_URL || '').replace(/\/+$/, '');
  if (!base) throw new LongcatError('LONGCAT_BASE_URL 未配置（或启用 LONGCAT_MOCK=1）', 502);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = { ...((init.headers as Record<string, string>) || {}) };
    const token = process.env.LONGCAT_API_TOKEN;
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return await fetch(`${base}${path}`, { ...init, headers, signal: ctrl.signal });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new LongcatError('longcat 远程请求超时', 504);
    throw new LongcatError(`longcat 远程不可达: ${e?.message || e}`, 502);
  } finally {
    clearTimeout(timer);
  }
}

async function remoteJSON(path: string, payload: unknown, timeoutMs = 30_000): Promise<LongcatRawResponse> {
  const res = await remoteFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload ?? {}),
  }, timeoutMs);
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { msg: `远程响应非 JSON（HTTP ${res.status}）` }; }
  return { httpStatus: res.status, body };
}

// ——— MOCK 模式（LONGCAT_MOCK=1） ——— //

const MOCK_DELAY_MS = 3_000;
const mockJobs = new Map<string, number>(); // jobId -> createdAt(ms)

/** 用 ffmpeg lazily 生成一条可播放的示例 mp4（testsrc + sine，约 2s） */
function ensureMockVideo(fileName: string): void {
  const out = join(longcatCacheDir(), fileName);
  if (existsSync(out)) return;
  const ffmpeg = findFfmpeg();
  if (!ffmpeg) {
    console.warn('[longcat-mock] ffmpeg 不可用，无法生成示例 mp4');
    return;
  }
  const r = spawnSync(ffmpeg, [
    '-f', 'lavfi', '-i', 'testsrc=duration=2:size=640x360:rate=24',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest',
    '-y', out,
  ], { encoding: 'utf8', timeout: 60_000 });
  if (r.status !== 0) {
    console.warn('[longcat-mock] 示例 mp4 生成失败:', (r.stderr || '').slice(-200));
  }
}

function mockSubmitRaw(payload: any): LongcatRawResponse {
  if (!payload?.image || !payload?.prompt) {
    return { httpStatus: 400, body: { msg: 'image 与 prompt 必填' } };
  }
  const jobId = randomUUID();
  mockJobs.set(jobId, Date.now());
  return { httpStatus: 200, body: { data: { jobId } } };
}

function mockQueryRaw(jobId: string): LongcatRawResponse {
  const t0 = mockJobs.get(jobId);
  if (t0 == null) return { httpStatus: 404, body: { msg: 'jobId 不存在' } };
  const elapsed = Date.now() - t0;
  if (elapsed < MOCK_DELAY_MS) {
    const progress = Math.max(1, Math.min(99, Math.round((elapsed / MOCK_DELAY_MS) * 100)));
    return {
      httpStatus: 200,
      body: { data: { status: 'running', progress, message: progress < 30 ? '排队中...' : '推理中...' } },
    };
  }
  const fileName = `mock-${jobId}.mp4`;
  ensureMockVideo(fileName);
  return {
    httpStatus: 200,
    body: { data: { status: 'success', progress: 100, message: '完成', data: { filePath: fileName } } },
  };
}

// ——— 公开 API ——— //

/** submit 透传：原样返回远程 { httpStatus, body }（契约 1.1） */
export async function longcatSubmitRaw(input: LongcatSubmitInput): Promise<LongcatRawResponse> {
  const payload = { resolution: '480P', ...input };
  if (longcatIsMock()) return mockSubmitRaw(payload);
  return remoteJSON('/api/video/submit', payload);
}

/** query 透传：原样返回远程 { httpStatus, body }（契约 1.2） */
export async function longcatQueryRaw(jobId: string): Promise<LongcatRawResponse> {
  if (longcatIsMock()) return mockQueryRaw(jobId);
  return remoteJSON('/api/video/query', { jobId });
}

/** submit 便捷封装：成功返回 jobId，失败抛 LongcatError */
export async function longcatSubmit(input: LongcatSubmitInput): Promise<{ jobId: string }> {
  const r = await longcatSubmitRaw(input);
  const jobId = r.body?.data?.jobId;
  if (r.httpStatus !== 200 || !jobId) {
    throw new LongcatError(r.body?.msg || `submit 失败（HTTP ${r.httpStatus}）`, r.httpStatus, r.body);
  }
  return { jobId: String(jobId) };
}

/** query 便捷封装：展开 data 包膜，失败抛 LongcatError */
export async function longcatQuery(jobId: string): Promise<LongcatQueryData> {
  const r = await longcatQueryRaw(jobId);
  const job = r.body?.data;
  if (r.httpStatus !== 200 || !job) {
    throw new LongcatError(r.body?.msg || `query 失败（HTTP ${r.httpStatus}）`, r.httpStatus, r.body);
  }
  return {
    status: job.status,
    progress: job.progress,
    message: job.message,
    filePath: job.data?.filePath,
    msg: job.msg,
  };
}

/**
 * 下载 mp4 并缓存到本地（契约 1.3）。
 * 命中本地缓存直接返回路径；未命中透传远程并缓存。返回本地文件路径。
 */
export async function longcatFetchFile(fileName: string): Promise<string> {
  if (!isSafeVideoFileName(fileName)) throw new LongcatError('非法文件名', 400);
  const localPath = join(longcatCacheDir(), fileName);
  if (existsSync(localPath)) return localPath;
  if (longcatIsMock()) {
    if (fileName.startsWith('mock-')) {
      ensureMockVideo(fileName);
      if (existsSync(localPath)) return localPath;
    }
    throw new LongcatError('文件不存在', 404);
  }
  const res = await remoteFetch(`/api/video/file?file=${encodeURIComponent(fileName)}`, { method: 'GET' }, 300_000);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let body: any = null;
    try { body = text ? JSON.parse(text) : null; } catch { /* ignore */ }
    throw new LongcatError(body?.msg || `文件下载失败（HTTP ${res.status}）`, res.status, body);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(localPath, buf);
  return localPath;
}

/** 远程可达性检查（契约 1.4）；mock 模式恒为 true */
export async function longcatHealth(): Promise<boolean> {
  if (longcatIsMock()) return true;
  try {
    const res = await remoteFetch('/api/health', { method: 'GET' }, 3_000);
    if (!res.ok) return false;
    const body: any = await res.json().catch(() => null);
    return body?.status === 'ok';
  } catch {
    return false;
  }
}
