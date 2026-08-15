import { useTaskQueueStore } from '../store/slices/taskQueue'
import type { TaskItem, TaskStatus } from '../store/slices/taskQueue'
export interface TaskProgressState { status: TaskStatus | null; progress: number | undefined; error: string | undefined; task: TaskItem | undefined; isActive: boolean; isDone: boolean; isFailed: boolean }
export function useTaskProgress(taskId: string | undefined | null): TaskProgressState {
  const getById = useTaskQueueStore((s) => s.getById)
  const task = taskId ? getById(taskId) : undefined
  if (!task) return { status: null, progress: undefined, error: undefined, task: undefined, isActive: false, isDone: false, isFailed: false }
  return { status: task.status, progress: task.progress, error: task.error, task, isActive: task.status === 'pending' || task.status === 'running', isDone: task.status === 'done', isFailed: task.status === 'failed' }
}
