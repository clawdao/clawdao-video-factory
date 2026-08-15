import React from 'react'
import { Progress, Typography, Space } from 'antd'
import { LoadingOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { useTaskProgress } from '../../hooks/useTaskProgress'
const { Text } = Typography
interface TaskProgressProps { taskId: string; className?: string; onComplete?: () => void; onError?: (error: string) => void }
const TaskProgress: React.FC<TaskProgressProps> = ({ taskId, className = '', onComplete, onError }) => {
  const { status, progress, error, isActive, isDone, isFailed } = useTaskProgress(taskId)
  React.useEffect(() => { if (isDone) onComplete?.() }, [isDone])
  React.useEffect(() => { if (isFailed && error) onError?.(error) }, [isFailed, error])
  if (!status) return null
  const pv = progress ?? 0
  const statusIcon: React.ReactNode = isActive ? <LoadingOutlined style={{ color: '#1677ff' }} /> : isDone ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : isFailed ? <CloseCircleOutlined style={{ color: '#ff4d4f' }} /> : <ClockCircleOutlined style={{ color: '#faad14' }} />
  const sc = isActive ? 'active' : isDone ? 'success' : isFailed ? 'exception' : 'active'
  return (
    <div className={className} style={{ marginTop: 8 }}>
      <Space align="center" style={{ marginBottom: 4 }}>{statusIcon}<Text type="secondary" style={{ fontSize: 12 }}>{status === 'pending' ? '排队中...' : status === 'running' ? `执行中 ${pv}%` : status === 'done' ? '已完成' : status === 'failed' ? '失败' : status}</Text></Space>
      <Progress percent={isDone ? 100 : isFailed ? 100 : pv} status={sc} size="small" showInfo={false} />
      {error && <Text type="danger" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>{error}</Text>}
    </div>
  )
}
export default TaskProgress
