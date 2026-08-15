export type PlatformId = string
export interface VideoPipelineSegment { start: number; end: number; text: string }
export interface VideoPipelineState {
  source?: { type: 'localFile' | 'url'; path?: string; url?: string; name?: string; contentType?: string }
  transcript?: { text: string; segments?: VideoPipelineSegment[]; source?: 'asr' | 'url' | 'user' }
  script?: { text: string; source?: 'asr' | 'llm' | 'user' | 'skill' }
  audio?: { path?: string; voiceEntryId?: string; name?: string; source?: 'upload' | 'tts' | 'clone' | 'library' }
  avatar?: { path?: string; assetId?: string; name?: string; source?: 'image' | 'videoTemplate' | 'upload' | 'preset' }
  autoEdit?: { title?: string; description?: string; tags?: string[]; coverPath?: string; videoPath?: string }
  publish?: { platforms?: PlatformId[]; scheduleAt?: string }
  workflowRunId?: string; updatedAt?: string
}
type Listener = (state: VideoPipelineState) => void
const STORAGE_KEY = 'vf-pipeline-v1'
let state: VideoPipelineState = {}
let hydrated = false
const listeners = new Set<Listener>()
function loadState(): VideoPipelineState { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } catch { return {} } }
function saveState(s: VideoPipelineState): void { try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...s, updatedAt: new Date().toISOString() })) } catch (e) { console.warn('[VP] persist failed:', e) } }
function notify(): void { for (const l of listeners) l(state) }
export const videoPipeline = {
  getState(): VideoPipelineState { if (!hydrated) { state = loadState(); hydrated = true } return { ...state } },
  update(patch: Partial<VideoPipelineState>): void { state = { ...state, ...patch, updatedAt: new Date().toISOString() }; saveState(state); notify() },
  clear(): void { state = {}; saveState(state); notify() },
  subscribe(listener: Listener): () => void { listeners.add(listener); return () => listeners.delete(listener) },
  updateSection<K extends keyof VideoPipelineState>(key: K, patch: Partial<NonNullable<VideoPipelineState[K]>>): void {
    state = { ...state, [key]: { ...((state[key] || {}) as any), ...patch }, updatedAt: new Date().toISOString() }; saveState(state); notify()
  },
}
