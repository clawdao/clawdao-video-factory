import React, { useState } from 'react'
import { Card, Button, Select, Checkbox, Space, Typography, message, Input, Empty, Tag } from 'antd'
import { GlobalOutlined, SendOutlined, SettingOutlined, CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons'
import { useTaskQueueStore, taskId } from '@/store/slices/taskQueue'
import { videoPipeline } from '@/services/videoPipeline'
import TaskProgress from '../common/TaskProgress'
import PublishAccountModal from '../common/PublishAccountModal'
import { PLATFORMS } from './constants'
import type { PlatformId } from './constants'
const { Text, Title } = Typography
const DistributionTab: React.FC = () => {
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformId[]>([])
  const [tags, setTags] = useState('')
  const [isPublishing, setIsPublishing] = useState(false)
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [publishLog, setPublishLog] = useState<string[]>([])
  const [accountModalOpen, setAccountModalOpen] = useState(false)
  const addTask = useTaskQueueStore((s) => s.addTask)
  const updateTask = useTaskQueueStore((s) => s.updateTask)
  const handlePublish = async () => {
    if (selectedPlatforms.length === 0) { message.warning('请选择至少一个发布平台'); return }
    const tid = taskId()
    setCurrentTaskId(tid); setIsPublishing(true); setPublishLog([])
    addTask({ id: tid, type: 'publish', content: '发布中...', status: 'running', progress: 10 })
    for (let i = 0; i < selectedPlatforms.length; i++) {
      const p = selectedPlatforms[i]
      updateTask(tid, { content: `发布到 ${PLATFORMS.find((x) => x.id === p)?.name || p}...`, progress: Math.round(10 + (80 / selectedPlatforms.length) * i) })
      setPublishLog((prev) => [...prev, `${p}: 发布中...`])
      await new Promise((r) => setTimeout(r, 2000))
      setPublishLog((prev) => [...prev.slice(0, -1), `${p}: ✓ 发布成功`])
    }
    updateTask(tid, { progress: 100, status: 'done', content: '发布完成' })
    message.success(`已发布到 ${selectedPlatforms.length} 个平台`); setIsPublishing(false)
  }
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Title level={4} style={{ margin: 0 }}><GlobalOutlined /> 自动发布</Title>
        <Button size="small" icon={<SettingOutlined />} onClick={() => setAccountModalOpen(true)}>账号管理</Button>
      </div>
      <Card size="small" title="发布配置">
        <Space direction="vertical" style={{ width: '100%' }}>
          <div><Text type="secondary">选择发布平台</Text><div style={{ marginTop: 8 }}><Checkbox.Group options={PLATFORMS.map((p) => ({ value: p.id, label: p.name }))} value={selectedPlatforms} onChange={(values) => setSelectedPlatforms(values as PlatformId[])} /></div></div>
          <div><Text type="secondary">标签 / 话题</Text><Input placeholder="#超级IP #一键爆款" value={tags} onChange={(e) => setTags(e.target.value)} style={{ marginTop: 4 }} /></div>
          <Button type="primary" icon={<SendOutlined />} onClick={handlePublish} loading={isPublishing} size="large" block disabled={selectedPlatforms.length === 0}>发布到 {selectedPlatforms.length} 个平台</Button>
        </Space>
      </Card>
      {currentTaskId && <TaskProgress taskId={currentTaskId} />}
      {publishLog.length > 0 && <Card size="small" title="发布日志">{publishLog.map((log, idx) => <div key={idx} style={{ fontSize: 12, padding: '2px 0' }}>{log.includes('✓') ? <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} /> : <LoadingOutlined style={{ color: '#1677ff', marginRight: 8 }} />}{log}</div>)}</Card>}
      <PublishAccountModal open={accountModalOpen} onClose={() => setAccountModalOpen(false)} />
    </div>
  )
}
export default DistributionTab
