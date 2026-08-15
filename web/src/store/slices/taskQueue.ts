import { create } from 'zustand'
export type TaskStatus = 'pending' | 'running' | 'done' | 'failed' | 'cancelled'
export interface TaskItem {
  id: string
  type: 'asr' | 'tts' | 'videoGen' | 'autoEdit' | 'publish' | 'pipeline'
  content: string
  status: TaskStatus
  progress: number
  error?: string
  outputUrl?: string
  outputFile?: string
  createdAt: string
  startedAt?: string
  endedAt?: string
  meta?: Record<string, unknown>
}
interface TaskQueueState {
  items: TaskItem[]
  addTask: (task: Omit<TaskItem, 'createdAt'>) => void
  updateTask: (id: string, patch: Partial<TaskItem>) => void
  removeTask: (id: string) => void
  clearDone: () => void
  clearAll: () => void
  activeItems: () => TaskItem[]
  getById: (id: string) => TaskItem | undefined
}
export const useTaskQueueStore = create<TaskQueueState>((set, get) => ({
  items: [],
  addTask: (task) => set((s) => ({ items: [{ ...task, createdAt: new Date().toISOString() }, ...s.items] })),
  updateTask: (id, patch) => set((s) => ({ items: s.items.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
  removeTask: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
  clearDone: () => set((s) => ({ items: s.items.filter((t) => t.status === 'running' || t.status === 'pending') })),
  clearAll: () => set({ items: [] }),
  activeItems: () => get().items.filter((t) => t.status === 'pending' || t.status === 'running'),
  getById: (id) => get().items.find((t) => t.id === id),
}))
export function taskId(): string { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }
