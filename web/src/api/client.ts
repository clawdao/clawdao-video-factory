/**
 * API client for clawdao-video-factory frontend
 */
async function postJSON<T = any>(url: string, body: any, timeoutMs = 600_000): Promise<T> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
    const text = await r.text()
    let data: any = text
    try { data = text ? JSON.parse(text) : {} } catch {}
    if (!r.ok) throw Object.assign(new Error(data?.error || `HTTP ${r.status}`), { status: r.status, data })
    return data as T
  } finally {
    clearTimeout(t)
  }
}

// ——— Douyin (from video-factory backend) ——— //
export type DouyinInfo = { videoUrl: string; videoId: string; title: string; author: string; cover: string }
export async function extractDouyin(shareUrl: string): Promise<DouyinInfo> {
  return postJSON<DouyinInfo>('/api/douyin/extract', { shareUrl })
}
export type DouyinAudio = { wav: string; size: number; totalDurationSec: number; slicedDurationSec: number; sliced: boolean; maxSec: number }
export async function douyinAudio(videoUrl: string, maxSec = 90): Promise<DouyinAudio> {
  return postJSON<DouyinAudio>('/api/douyin/audio', { videoUrl, maxSec })
}

// ——— ASR ——— //
export async function asr(wavBase64: string): Promise<{ text: string; duration: number; model: string }> {
  return postJSON('/api/asr', { wav: wavBase64 }, 600_000)
}

// ——— LLM (OpenAI-compatible) ——— //
export type ChatMsg = { role: 'system' | 'user' | 'assistant'; content: string }
export async function llm(prefs: { baseUrl: string; apiKey: string; model: string; temperature?: number; maxTokens?: number }, messages: ChatMsg[]): Promise<string> {
  const r = await postJSON<any>('/api/llm', {
    baseUrl: prefs.baseUrl, apiKey: prefs.apiKey, model: prefs.model,
    messages, temperature: prefs.temperature ?? 0.7, max_tokens: prefs.maxTokens ?? 2048,
    stream: false,
  })
  return r?.choices?.[0]?.message?.content ?? ''
}

// ——— TTS ——— //
export async function ttsSubmit(prefs: { speaker?: string; speed?: number; seed?: number; crossLingual?: boolean }, text: string): Promise<{ jobId: string; filePath?: string }> {
  const r = await postJSON<any>('/api/tts/submit', { text, speaker: prefs.speaker, speed: prefs.speed, seed: prefs.seed })
  return { jobId: r?.data?.jobId ?? '', filePath: r?.data?.filePath }
}
export async function ttsQuery(jobId: string): Promise<{ status: 'running' | 'success' | 'fail'; filePath?: string; msg?: string }> {
  const r = await postJSON<any>('/api/tts/query', { jobId })
  const job = r?.data
  if (!job) return { status: 'fail', msg: r?.msg || 'no job' }
  return { status: job.status, filePath: job.data?.filePath, msg: job.msg }
}
export function ttsAudioUrl(filePath: string): string {
  const name = filePath.split(/[\\/]/).pop() || filePath
  return `/api/tts/audio?file=${encodeURIComponent(name)}`
}

// ——— Video (Seedance 2.0) ——— //
export async function videoSubmitImage(prefs: { baseUrl: string; apiKey: string; modelId?: string }, imageDataUrl: string, prompt: string, audioWavBase64?: string): Promise<{ video: { url: string }; seed?: number }> {
  return postJSON('/api/video/submit', { baseUrl: prefs.baseUrl, apiKey: prefs.apiKey, image: imageDataUrl, prompt, audioWavBase64 }, 600_000)
}

// ——— Editor ——— //
export type EditorJob = { status: string; jobId: string; output_url?: string; progress?: number; error?: string }
export type EditorRequestPayload = { video: string; title?: string; subtitle?: string; subtitleTemplate?: string; bgMusic?: { enabled: boolean; volume?: number }; sceneMix?: { enabled: boolean; materials?: string[] } }
export async function editorSubmit(req: EditorRequestPayload): Promise<{ jobId: string; status: string }> {
  return postJSON('/api/editor/jobs', req, 600_000)
}
export async function editorJobWait(jid: string, intervalMs = 700, maxMs = 300_000): Promise<EditorJob> {
  const t0 = Date.now()
  while (Date.now() - t0 < maxMs) {
    const r = await fetch(`/api/editor/jobs/${encodeURIComponent(jid)}`)
    if (r.ok) {
      const j: EditorJob = await r.json()
      if (j.status === 'success' || j.status === 'fail') return j
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error('editor job wait timeout')
}
export function editorOutputUrl(path: string): string {
  return path.startsWith('/api/editor') ? path : `/api/editor/output/${path}`
}
export async function editorSubmitCover(req: { video: string; title?: string; subtitle?: string; subtitleTemplate?: string }): Promise<string> {
  const r = await postJSON('/api/editor/cover', req, 600_000)
  return r.jobId
}

// ——— Health ——— //
export async function factoryHealth(): Promise<{ ok: boolean; ffmpeg: string; ffprobe: string }> {
  return postJSON('/api/health', {})
}
