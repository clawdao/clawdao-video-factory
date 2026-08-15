/**
 * HTTP server 模式 — 零 npm 依赖，使用 Bun / Node built-in 模块
 *
 * 提供 REST API 端点，兼容 clawdao toolbox sidecar 的 /api/toolbox/* 路径
 * 
 * v1.1 — 增加 ClawDao Project Protocol 支持：
 *   /api/v1/capabilities — 能力声明（读取 .clawdao/project.json）
 *   /api/v1/tasks        — 任务提交与查询
 *   /api/v1/config       — 配置读取与注入
 */

import type { Server } from 'http';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { douyinExtract, douyinAudio } from './douyin';
import { ytDlpDownload } from './yt-dlp';
import { ffmpegConvert, ffmpegProbe, findFfmpeg } from './ffmpeg';
import { proxyFetch, proxyFetchBinary } from './proxy';
import { findYtDlp } from './yt-dlp';
import { taskStore } from './task-store';
import {
  longcatSubmit, longcatQuery, longcatFetchFile, longcatHealth,
  longcatSubmitRaw, longcatQueryRaw, isSafeVideoFileName,
} from './longcat';
import type { HealthCheckResult, VideoFactoryConfig } from './types';

const DEFAULT_PORT = 18792;

// ——— 读取 Project Manifest ———
const MANIFEST_PATH = process.cwd() + '/.clawdao/project.json';
let PROJECT_MANIFEST: Record<string, any> = { protocol: { actions: {}, configKeys: [] } };
try {
  if (existsSync(MANIFEST_PATH)) {
    PROJECT_MANIFEST = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
  }
} catch (e) {
  console.warn('[video-factory] failed to read manifest:', e);
}

// ——— Task 分发 —— 封装现有服务为统一 task 接口 ———
async function dispatchTask(taskType: string, params: Record<string, unknown>): Promise<any> {
  switch (taskType) {
    case 'douyin-extract':
      return await douyinExtract({ shareUrl: String(params.shareUrl || '') });
    case 'douyin-audio':
      return await douyinAudio({
        videoUrl: String(params.videoUrl || ''),
        maxSec: params.maxSec ? Number(params.maxSec) : undefined,
      });
    case 'yt-dlp-download':
      return await ytDlpDownload(params as any);
    case 'ffmpeg-convert':
      return await ffmpegConvert(params as any);
    case 'ffmpeg-probe':
      return await ffmpegProbe({ url: String(params.url || '') });
    case 'proxy-fetch':
      return await proxyFetch({ url: String(params.url || '') });
    case 'longcat-video': {
      // ClawDao Protocol 任务通道：submit → 轮询 → 缓存 mp4（分钟级，后台执行）
      const { jobId } = await longcatSubmit({
        image: String(params.image || ''),
        prompt: String(params.prompt || ''),
        audioWavBase64: params.audioWavBase64 ? String(params.audioWavBase64) : undefined,
        resolution: params.resolution ? String(params.resolution) : undefined,
      });
      const deadline = Date.now() + 20 * 60_000;
      while (Date.now() < deadline) {
        const q = await longcatQuery(jobId);
        if (q.status === 'success') {
          const localPath = q.filePath ? await longcatFetchFile(q.filePath) : '';
          return { jobId, filePath: localPath };
        }
        if (q.status === 'fail') throw new Error(q.msg || 'longcat 远程任务失败');
        await new Promise((r) => setTimeout(r, 5_000));
      }
      throw new Error('longcat 任务超时（20 分钟）');
    }
    default:
      throw new Error(`unknown task type: ${taskType}`);
  }
}

/** 将远程 query 结果同步到 task-store（ClawDao Task Center 可见）；success 时后台缓存 mp4 */
function syncLongcatTask(jobId: string, r: { httpStatus: number; body: any }): void {
  if (!jobId || r.httpStatus !== 200) return;
  const job = r.body?.data;
  if (!job?.status) return;
  const existing = taskStore.get(jobId);
  if (existing?.status === 'completed' || existing?.status === 'failed') return;
  const task = existing || taskStore.create('longcat-video', {}, jobId);
  if (job.status === 'running') {
    taskStore.update(task.id, {
      progress: Math.max(0, Math.min(1, (Number(job.progress) || 0) / 100)),
      message: job.message || '推理中',
    });
    return;
  }
  if (job.status === 'fail') {
    taskStore.fail(task.id, job.msg || 'longcat 远程任务失败');
    return;
  }
  // success：后台缓存 mp4，filePath 改写为本地缓存路径
  const filePath = job.data?.filePath ? String(job.data.filePath) : '';
  if (!filePath) {
    taskStore.succeed(task.id, {});
    return;
  }
  taskStore.update(task.id, { progress: 1, message: '下载视频中...' });
  longcatFetchFile(filePath)
    .then((localPath) => taskStore.succeed(task.id, { filePath: localPath }))
    .catch((e: any) => taskStore.fail(task.id, `视频下载失败: ${e?.message || e}`));
}

function setCors(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function sendJSON(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  setCors(res);
  res.end(JSON.stringify(data));
}

function readJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function parseQuery(url: string): Record<string, string> {
  const idx = url.indexOf('?');
  if (idx < 0) return {};
  const params: Record<string, string> = {};
  for (const part of url.slice(idx + 1).split('&')) {
    const [k, v] = part.split('=');
    params[decodeURIComponent(k)] = decodeURIComponent(v || '');
  }
  return params;
}

/**
 * 创建 HTTP server
 */
export function createVideoFactoryServer(config?: VideoFactoryConfig): Server {
  const port = config?.port || Number(process.env.VF_PORT) || DEFAULT_PORT;

  const server = createServer(async (req, res) => {
    setCors(res);

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    const url = req.url || '';
    if (!url.startsWith('/api/')) {
      sendJSON(res, 404, { error: 'unknown endpoint' });
      return;
    }

    try {
      const body = ['POST', 'PUT'].includes(req.method || '')
        ? await readJsonBody(req)
        : {};

      // ——— Protocol: 能力声明 ———
      if (url === '/api/v1/capabilities' && req.method === 'GET') {
        return sendJSON(res, 200, {
          actions: PROJECT_MANIFEST.protocol?.actions || {},
          version: PROJECT_MANIFEST.version || '1.0.0',
        });
      }

      // ——— Protocol: 任务提交 ———
      if (url === '/api/v1/tasks' && req.method === 'POST') {
        const taskType = body?.type;
        if (!taskType) return sendJSON(res, 400, { error: 'type required' });
        const task = taskStore.create(taskType, body?.params || {});
        dispatchTask(taskType, body?.params || {})
          .then((result) => taskStore.succeed(task.id, result))
          .catch((err: Error) => taskStore.fail(task.id, err.message));
        return sendJSON(res, 202, { taskId: task.id, status: 'running' });
      }

      // ——— Protocol: 任务查询 ———
      if (url === '/api/v1/tasks' && req.method === 'GET') {
        const query = parseQuery(url);
        const filter = {
          type: query.type || undefined,
          status: query.status || undefined,
        };
        return sendJSON(res, 200, { tasks: taskStore.list(filter) });
      }

      // ——— Protocol: 配置读取 ———
      if (url === '/api/v1/config' && req.method === 'GET') {
        const configKeys: string[] = PROJECT_MANIFEST.protocol?.configKeys || [];
        const config: Record<string, string | undefined> = {};
        for (const key of configKeys) config[key] = process.env[key];
        return sendJSON(res, 200, config);
      }

      // ——— Protocol: 配置注入 ———
      if (url === '/api/v1/config' && req.method === 'PUT') {
        const configKeys: string[] = PROJECT_MANIFEST.protocol?.configKeys || [];
        for (const key of Object.keys(body || {})) {
          if (configKeys.includes(key)) process.env[key] = String(body[key]);
        }
        return sendJSON(res, 200, { ok: true });
      }

      // ——— 抖音 ———
      if (url === '/api/douyin/extract' && req.method === 'POST') {
        if (!/douyin\.com|iesdouyin\.com/i.test(body?.shareUrl || '')) {
          return sendJSON(res, 400, { error: 'invalid douyin url' });
        }
        const info = await douyinExtract({ shareUrl: body.shareUrl });
        if (!info) return sendJSON(res, 502, { error: 'douyin extract failed' });
        return sendJSON(res, 200, info);
      }

      if (url === '/api/douyin/audio' && req.method === 'POST') {
        if (!body?.videoUrl) return sendJSON(res, 400, { error: 'videoUrl required' });
        try {
          const out = await douyinAudio({ videoUrl: body.videoUrl, maxSec: body.maxSec });
          return sendJSON(res, 200, out);
        } catch (e: any) {
          return sendJSON(res, 500, { error: String(e?.message || e) });
        }
      }

      // ——— yt-dlp ———
      if (url === '/api/yt-dlp/download' && req.method === 'POST') {
        const result = await ytDlpDownload(body || {});
        return sendJSON(res, result.ok ? 200 : 500, result);
      }

      // ——— 代理 ———
      if (url === '/api/proxy/fetch' && req.method === 'POST') {
        if (!body?.url) return sendJSON(res, 400, { error: 'url required' });
        const result = await proxyFetch(body);
        return sendJSON(res, result.status >= 400 ? result.status : 200, result);
      }

      if (url === '/api/proxy/fetch-binary' && req.method === 'POST') {
        if (!body?.url) return sendJSON(res, 400, { error: 'url required' });
        const result = await proxyFetchBinary(body);
        return sendJSON(res, result.status >= 400 ? result.status : 200, result);
      }

      // ——— ffmpeg ———
      if (url === '/api/ffmpeg/convert' && req.method === 'POST') {
        const result = await ffmpegConvert(body || {});
        return sendJSON(res, result.ok ? 200 : 500, result);
      }

      if (url === '/api/ffmpeg/probe' && req.method === 'POST') {
        if (!body?.url) return sendJSON(res, 400, { error: 'url required' });
        const result = await ffmpegProbe(body);
        return sendJSON(res, 200, result);
      }

      // ——— LongCat 数字人视频（透传远程契约，见 docs/plans/v1/02 第 1 节） ———
      if (url === '/api/video/submit' && req.method === 'POST') {
        try {
          const r = await longcatSubmitRaw({
            image: String(body?.image || ''),
            prompt: String(body?.prompt || ''),
            audioWavBase64: body?.audioWavBase64 ? String(body.audioWavBase64) : undefined,
            resolution: body?.resolution ? String(body.resolution) : undefined,
          });
          const jobId = r.body?.data?.jobId;
          if (r.httpStatus === 200 && jobId) {
            // 复用远程 jobId 作为任务 id；params 不落 base64 大字段
            taskStore.create('longcat-video', {
              prompt: typeof body?.prompt === 'string' ? body.prompt.slice(0, 100) : '',
              resolution: body?.resolution || '480P',
              hasAudio: !!body?.audioWavBase64,
            }, String(jobId));
          }
          return sendJSON(res, r.httpStatus, r.body);
        } catch (e: any) {
          return sendJSON(res, e?.httpStatus || 502, e?.body || { msg: String(e?.message || e) });
        }
      }

      if (url === '/api/video/query' && req.method === 'POST') {
        const jobId = String(body?.jobId || '');
        if (!jobId) return sendJSON(res, 400, { msg: 'jobId required' });
        try {
          const r = await longcatQueryRaw(jobId);
          syncLongcatTask(jobId, r);
          return sendJSON(res, r.httpStatus, r.body);
        } catch (e: any) {
          return sendJSON(res, e?.httpStatus || 502, e?.body || { msg: String(e?.message || e) });
        }
      }

      if (url.startsWith('/api/video/file') && req.method === 'GET') {
        const file = parseQuery(url).file || '';
        if (!isSafeVideoFileName(file)) return sendJSON(res, 400, { error: 'invalid file name' });
        try {
          // 命中本地缓存直接返回；未命中透传远程并缓存
          const localPath = await longcatFetchFile(file);
          const buf = readFileSync(localPath);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'video/mp4');
          res.setHeader('Content-Length', statSync(localPath).size);
          setCors(res);
          return res.end(buf);
        } catch (e: any) {
          const status = e?.httpStatus === 404 ? 404 : (e?.httpStatus || 502);
          return sendJSON(res, status, { error: String(e?.message || e) });
        }
      }

      // ——— 兼容旧路径（/api/toolbox/* 别名） ———
      if (url.startsWith('/api/toolbox/')) {
        const standardPath = url.replace('/api/toolbox', '/api');
        req.url = standardPath;
        server.emit('request', req, res);
        return;
      }

      // ——— 健康检查（增强版） ———
      if (url === '/api/health') {
        const health = {
          status: 'ok',
          version: PROJECT_MANIFEST.version || '1.0.0',
          port,
          uptime: process.uptime(),
          capabilities: Object.keys(PROJECT_MANIFEST.protocol?.actions || {}).length,
          runningTasks: taskStore.list({ status: 'running' }).length,
          ffmpeg: !!findFfmpeg(),
          ytDlp: !!findYtDlp(),
          longcat: await longcatHealth(),
        };
        return sendJSON(res, 200, health);
      }

      return sendJSON(res, 404, { error: 'unknown endpoint' });
    } catch (e: any) {
      return sendJSON(res, 500, { error: String(e?.message || e) });
    }
  });

  return server;
}

/**
 * 启动 HTTP server
 */
export function startServer(port = DEFAULT_PORT): Server {
  const server = createVideoFactoryServer({ port });
  server.listen(port, '127.0.0.1', () => {
    console.log(`[video-factory] listening on http://127.0.0.1:${port}`);
  });
  return server;
}
