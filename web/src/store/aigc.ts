import { create } from 'zustand'
import { persist } from 'zustand/middleware'
export type ActiveFunction = 'asr' | 'tts' | 'voiceClone' | 'talkingHead' | 'autoEdit' | 'distribution' | 'pipeline' | 'assetLibrary' | 'voiceLibrary' | 'taskCenter' | null
export interface AigcState {
  activeFunction: ActiveFunction
  setActiveFunction: (fn: ActiveFunction) => void
}
export const useAigcStore = create<AigcState>()(
  persist(
    (set) => ({
      activeFunction: 'asr',
      setActiveFunction: (fn) => set({ activeFunction: fn }),
    }),
    { name: 'vf-aigc-v1', partialize: (s) => ({ activeFunction: s.activeFunction }) },
  ),
)
