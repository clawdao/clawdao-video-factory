import type { VoiceEntry } from '../store/slices/voiceLibrary'
const STORAGE_KEY = 'vf-voice-entries-v1'
function loadAll(): VoiceEntry[] { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] } }
function saveAll(entries: VoiceEntry[]): void { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)) } catch (e) { console.warn('[VoiceLib] persist failed:', e) } }
export const voiceLibrary = {
  async save(record: VoiceEntry): Promise<void> { const e = loadAll(); const i = e.findIndex((x) => x.id === record.id); if (i >= 0) e[i] = record; else e.unshift(record); saveAll(e) },
  async update(record: VoiceEntry): Promise<void> { const e = loadAll(); const i = e.findIndex((x) => x.id === record.id); if (i >= 0) { e[i] = record; saveAll(e) } },
  async get(id: string): Promise<VoiceEntry | null> { return loadAll().find((e) => e.id === id) ?? null },
  async list(): Promise<VoiceEntry[]> { return loadAll().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()) },
  async remove(id: string): Promise<void> { saveAll(loadAll().filter((e) => e.id !== id)) },
  async search(query: string): Promise<VoiceEntry[]> { const q = query.toLowerCase(); return loadAll().filter((e) => e.name.toLowerCase().includes(q) || (e.tags && e.tags.toLowerCase().includes(q)) || (e.associatedText && e.associatedText.toLowerCase().includes(q))) },
  async listBySource(source: VoiceEntry['source']): Promise<VoiceEntry[]> { return loadAll().filter((e) => e.source === source).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()) },
}
