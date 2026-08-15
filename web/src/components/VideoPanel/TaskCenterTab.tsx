import React from 'react'
import { Card, List, Tag, Button, Space, Typography, Empty, Progress } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined, ClearOutlined, HistoryOutlined, DeleteOutlined } from '@ant-design/icons'
import { useTaskQueueStore } from '@/store/slices/taskQueue'
import type { TaskItem } from '@/store/slices/taskQueue'
const { Text, Title } = Typography
const TYPE_LABELS: Record<string, string> = {
  asr: '语音识别', tts: '语音合成', videoGen: '视频生成',
  autoEdit: '自动剪辑', publish: '自动发布', pipeline: '创作工作流',
}
const TaskCenterTab: React.FC = () => {
  const { items, clearDone, clearAll } = useTaskQueueStore()
  const active = items.filter((t) => t.status === 'pending' || t.status === 'running')
  const done = items.filter((t) => t.status === 'done' || t.status === 'failed' || t.status === 'cancelled')
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Title level={4} style={{ margin: 0 }}><HistoryOutlined /> 任务中心</Title>
        <Space>
          <Button size="small" onClick={clearDone}><ClearOutlined /> 清理已完成</Button>
          <Button size="small" danger onClick={clearAll}><DeleteOutlined /> 清空全部</Button>
        </Space>
      </div>
      {active.length > 0 && (
        <Card size="small" title={`运行中 (${active.length})`}>
          <List size="small" dataSource={active} renderItem={(task: TaskItem) => (
            <List.Item>
              <List.Item.Meta
                avatar={<LoadingOutlined style={{ fontSize: 18, color: '#1677ff' }} />}
                title={<Space><Tag>{TYPE_LABELS[task.type] || task.type}{task.content}</Tag></Space>}
                description={<div><Progress percent={task.progress} size="small" showInfo={false} style={{ margin: '4px 0' }} /><Text type="secondary" style={{ fontSize: 11 }}>{task.progress}%</Text></div>}
              />
            </List.Item>
          )} />
        </Card>
      )}
      <Card size="small" title={`已完成 (${done.length})`} style={{ flex: 1, overflow: 'auto' }}>
        {done.length === 0 ? <Empty description="暂无已完成任务" /> : (
          <List size="small" dataSource={done} renderItem={(task: TaskItem) => (
            <List.Item>
              <List.Item.Meta
                avatar={task.status === 'done' ? <CheckCircleOutlined style={{ fontSize: 18, color: '#52c41a' }} /> : <CloseCircleOutlined style={{ fontSize: 18, color: '#ff4d4f' }} />}
                title={<Space><Tag>{TYPE_LABELS[task.type] || task.type}{task.content}</Tag><Tag color={task.status === 'done' ? 'success' : 'error'}>{task.status === 'done' ? '成功' : '失败'}</Tag></Space>}
                description={task.error && <Text type="danger" style={{ fontSize: 11 }}>{task.error}</Text>}
              />
            </List.Item>
          )} />
        )}
      </Card>
    </div>
  )
}
export default TaskCenterTab
