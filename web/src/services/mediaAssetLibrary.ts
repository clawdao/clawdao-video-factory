export type MediaAssetKind = 'avatarImage' | 'avatarVideo' | 'audio' | 'video' | 'cover' | 'bgm'
export type MediaAssetSource = 'upload' | 'generated' | 'url'
export interface MediaAssetEntry { id: string; kind: MediaAssetKind; name: string; path: string; source: MediaAssetSource; tags: string[]; createdAt: string; updatedAt: string }
const STORAGE_KEY = 'vf-media-assets-v1'
function loadAll(): MediaAssetEntry[] { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] } }
function saveAll(entries: MediaAssetEntry[]): void { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)) } catch (e) { console.warn('[MediaLib] persist failed:', e) } }
export const mediaAssetLibrary = {
  async list(): Promise<MediaAssetEntry[]> { return loadAll().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()) },
  async listByKind(kind: MediaAssetKind): Promise<MediaAssetEntry[]> { return loadAll().filter((e) => e.kind === kind).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()) },
  async save(entry: MediaAssetEntry): Promise<void> { const e = loadAll(); const i = e.findIndex((x) => x.id === entry.id); if (i >= 0) e[i] = entry; else e.unshift(entry); saveAll(e) },
  async saveMany(entries: MediaAssetEntry[]): Promise<void> { const existing = loadAll(); for (const entry of entries) { const i = existing.findIndex((x) => x.id === entry.id); if (i >= 0) existing[i] = entry; else existing.unshift(entry) } saveAll(existing) },
  async remove(id: string): Promise<void> { saveAll(loadAll().filter((e) => e.id !== id)) },
  async search(query: string): Promise<MediaAssetEntry[]> { const q = query.toLowerCase(); return loadAll().filter((e) => e.name.toLowerCase().includes(q) || e.tags.some((t) => t.toLowerCase().includes(q))) },
}
