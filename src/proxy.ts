/**
 * HTTP 代理模块
 * 零 npm 依赖，使用 Bun / Node built-in 模块
 */

import type { ProxyFetchInput, ProxyFetchOutput, ProxyFetchBinaryOutput } from './types';

/**
 * 通用 HTTP 代理 — 返回 UTF-8 文本
 */
export async function proxyFetch(input: ProxyFetchInput): Promise<ProxyFetchOutput> {
  try {
    const resp = await fetch(input.url, {
      headers: input.headers || {},
      signal: AbortSignal.timeout(input.timeoutMs || 60_000),
    });
    return {
      status: resp.status,
      contentType: resp.headers.get('content-type') || 'application/octet-stream',
      body: await resp.text(),
    };
  } catch (e: any) {
    return { status: 500, contentType: 'text/plain', body: String(e?.message || e) };
  }
}

/**
 * 通用 HTTP 代理 — 返回 base64 二进制
 */
export async function proxyFetchBinary(input: ProxyFetchInput): Promise<ProxyFetchBinaryOutput> {
  try {
    const resp = await fetch(input.url, {
      headers: input.headers || {},
      signal: AbortSignal.timeout(input.timeoutMs || 60_000),
    });
    const buf = Buffer.from(await resp.arrayBuffer());
    return {
      status: resp.status,
      contentType: resp.headers.get('content-type') || 'application/octet-stream',
      body: buf.toString('base64'),
    };
  } catch (e: any) {
    return { status: 500, contentType: 'text/plain', body: Buffer.from(String(e?.message || e)).toString('base64') };
  }
}
