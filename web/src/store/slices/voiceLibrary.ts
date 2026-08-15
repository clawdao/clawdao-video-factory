import { create } from 'zustand'
import { persist } from 'zustand/middleware'
export type VoiceEntrySource = 'clone' | 'upload' | 'tts'
export interface VoiceEntry {
  id: string; name: string; source: VoiceEntrySource; filePath: string
  fileSize: number; duration: number; sampleRate: number; format: string
  modelName: string | null; seed: number | null; crossLingual: boolean
  referenceText: string | null; associatedText: string | null
  gender: string | null; language: string | null; style: string | null
  tags: string | null; parentId: string | null; version: number
  usageCount: number; lastUsedAt: string | null; notes: string | null
  createdAt: string; updatedAt: string
}
interface VoiceLibraryState {
  entries: VoiceEntry[]; loading: boolean; error: string | null
  searchQuery: string; sourceFilter: VoiceEntrySource | null
  setEntries: (entries: VoiceEntry[]) => void
  addEntry: (entry: VoiceEntry) => void
  updateEntry: (id: string, patch: Partial<VoiceEntry>) => void
  removeEntry: (id: string) => void
  setLoading: (loading: boolean) => void; setError: (error: string | null) => void
  setSearchQuery: (q: string) => void; setSourceFilter: (f: VoiceEntrySource | null) => void
}
export const useVoiceLibraryStore = create<VoiceLibraryState>()(
  persist(
    (set) => ({
      entries: [], loading: false, error: null, searchQuery: '', sourceFilter: null,
      setEntries: (entries) => set({ entries }),
      addEntry: (entry) => set((s) => ({ entries: [entry, ...s.entries] })),
      updateEntry: (id, patch) => set((s) => ({ entries: s.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),
      removeEntry: (id) => set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),
      setLoading: (loading) => set({ loading }), setError: (error) => set({ error }),
      setSearchQuery: (searchQuery) => set({ searchQuery }), setSourceFilter: (sourceFilter) => set({ sourceFilter }),
    }),
    { name: 'vf-voice-library-v1', partialize: (s) => ({ entries: s.entries }) },
  ),
)
