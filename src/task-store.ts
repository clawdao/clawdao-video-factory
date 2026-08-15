/**
 * 轻量级任务存储 — 用于 Protocol 任务跟踪
 *
 * 在内存中维护任务记录，支持创建、查询、过滤。
 * 服务重启后记录丢失（任务状态由调用方管理）。
 */

import type { DouyinExtractInput, DouyinExtractOutput } from './types';

/** 任务状态 */
export type TaskStatus = 'running' | 'completed' | 'failed';

/** 任务记录 */
export interface TaskRecord {
  id: string;
  type: string;
  status: TaskStatus;
  progress: number;
  message: string;
  params: Record<string, unknown>;
  result?: unknown;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

/** 任务存储 */
class TaskStore {
  private tasks = new Map<string, TaskRecord>();

  /** 创建任务（可传入 id 复用外部任务标识，如远程 jobId） */
  create(type: string, params: Record<string, unknown> = {}, id?: string): TaskRecord {
    const taskId = id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const task: TaskRecord = {
      id: taskId, type, status: 'running',
      progress: 0, message: '任务已创建',
      params, createdAt: now, updatedAt: now,
    };
    this.tasks.set(taskId, task);
    return task;
  }

  /** 更新任务 */
  update(id: string, partial: Partial<TaskRecord>): TaskRecord | undefined {
    const task = this.tasks.get(id);
    if (!task) return undefined;
    Object.assign(task, partial, { updatedAt: new Date().toISOString() });
    return task;
  }

  /** 标记成功 */
  succeed(id: string, result?: unknown, message = '任务完成'): TaskRecord | undefined {
    return this.update(id, { status: 'completed', progress: 1, message, result });
  }

  /** 标记失败 */
  fail(id: string, error: string): TaskRecord | undefined {
    return this.update(id, { status: 'failed', error, message: '任务失败' });
  }

  /** 获取任务 */
  get(id: string): TaskRecord | undefined {
    return this.tasks.get(id);
  }

  /** 查询任务列表 */
  list(filter?: { type?: string; status?: string }): TaskRecord[] {
    const all = Array.from(this.tasks.values());
    return all.filter((t) => {
      if (filter?.type && t.type !== filter.type) return false;
      if (filter?.status && t.status !== filter.status) return false;
      return true;
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

export const taskStore = new TaskStore();
