import { create } from 'zustand'
import { persist } from 'zustand/middleware'
export interface TtsHistoryItem {
  id: string; text: string; filePath?: string; audioUrl?: string
  speaker: string; speed: number; seed: number; crossLingual: boolean
  modelName: string; mode: 'synthesize' | 'clone'
  status: 'success' | 'fail'; duration?: number; createdAt: string
}
interface TtsHistoryState { items: TtsHistoryItem[]; addItem: (item: TtsHistoryItem) => void; removeItem: (id: string) => void; clearAll: () => void }
export const useTtsHistoryStore = create<TtsHistoryState>()(
  persist(
    (set) => ({ items: [], addItem: (item) => set((s) => ({ items: [item, ...s.items] })), removeItem: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })), clearAll: () => set({ items: [] }) }),
    { name: 'vf-tts-history-v1' },
  ),
)
