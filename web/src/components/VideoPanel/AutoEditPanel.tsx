import React, { useState } from 'react'
import { Card, Button, Select, Switch, Slider, Space, Typography, message, Input, Empty } from 'antd'
import { ScissorOutlined, SendOutlined } from '@ant-design/icons'
import { useTaskQueueStore, taskId } from '@/store/slices/taskQueue'
import { videoPipeline } from '@/services/videoPipeline'
import TaskProgress from '../common/TaskProgress'
const { Text, Title } = Typography
const SUBTITLE_TEMPLATES = [
  { key: 'default', label: '默认白字黑底' }, { key: 'karaoke', label: '卡拉OK金色' },
  { key: 'minimal', label: '极简灰' }, { key: 'highlight', label: '高亮关键词' },
]

const AutoEditPanel: React.FC = () => {
  const [subtitleTemplate, setSubtitleTemplate] = useState('default')
  const [title, setTitle] = useState(''); const [subtitle, setSubtitle] = useState('')
  const [bgmEnabled, setBgmEnabled] = useState(false); const [bgmVolume, setBgmVolume] = useState(0.3)
  const [sceneMix, setSceneMix] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [editedVideoUrl, setEditedVideoUrl] = useState<string | null>(null)
  const addTask = useTaskQueueStore((s) => s.addTask); const updateTask = useTaskQueueStore((s) => s.updateTask)

  const handleStartEdit = async () => {
    const tid = taskId(); setCurrentTaskId(tid); setIsEditing(true)
    addTask({ id: tid, type: 'autoEdit', content: '开始自动剪辑...', status: 'running', progress: 10 })
    try {
      const { editorSubmit, editorJobWait, editorOutputUrl } = await import('@/api/client')
      updateTask(tid, { progress: 30, content: '提交剪辑任务...' })
      const result = await editorSubmit({ video: '', title, subtitle, subtitleTemplate, bgMusic: bgmEnabled ? { enabled: true, volume: bgmVolume } : undefined, sceneMix: sceneMix ? { enabled: true } : undefined })
      updateTask(tid, { progress: 60, content: '渲染中...' }); const job = await editorJobWait(result.jobId)
      if (job.status === 'success') { const url = editorOutputUrl(job.output_url || ''); setEditedVideoUrl(url); updateTask(tid, { progress: 100, status: 'done', outputUrl: url }); message.success('剪辑完成！') }
      else throw new Error(job.error || '剪辑失败')
    } catch (e: any) { updateTask(tid, { status: 'failed', error: e.message }); message.error(`剪辑失败: ${e.message}`) }
    finally { setIsEditing(false) }
  }

  const handleApplyToWorkflow = () => { if (!editedVideoUrl) return; videoPipeline.updateSection('autoEdit', { videoPath: editedVideoUrl, title }); message.success('已推送到创作工作流') }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Title level={4} style={{ margin: 0 }}><ScissorOutlined /> 自动剪辑</Title>
      <div style={{ display: 'flex', gap: 16, flex: 1 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card size="small" title="字幕"><Space direction="vertical" style={{ width: '100%' }}><Input placeholder="主标题" value={title} onChange={(e) => setTitle(e.target.value)} /><Input placeholder="副标题/字幕" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} /><div><Text type="secondary">字幕模板</Text><Select value={subtitleTemplate} onChange={setSubtitleTemplate} style={{ width: '100%', marginTop: 4 }} options={SUBTITLE_TEMPLATES.map((t) => ({ value: t.key, label: t.label }))} /></div></Space></Card>
          <Card size="small" title="背景音乐"><Space direction="vertical" style={{ width: '100%' }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Switch checked={bgmEnabled} onChange={setBgmEnabled} /><Text>启用 BGM</Text></div>{bgmEnabled && <><input type="file" accept="audio/*,.mp3,.wav,.m4a" style={{ width: '100%' }} /><div><Text type="secondary">BGM 音量: {Math.round(bgmVolume * 100)}%</Text><Slider min={0} max={1} step={0.05} value={bgmVolume} onChange={setBgmVolume} /></div></>}</Space></Card>
          <Card size="small" title="实景混剪"><Space direction="vertical" style={{ width: '100%' }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Switch checked={sceneMix} onChange={setSceneMix} /><Text>启用混剪</Text></div>{sceneMix && <input type="file" accept="image/*,video/*" multiple style={{ width: '100%', marginTop: 8 }} />}</Space></Card>
          <Button type="primary" icon={<ScissorOutlined />} onClick={handleStartEdit} loading={isEditing} size="large" block>开始剪辑</Button>
          {currentTaskId && <TaskProgress taskId={currentTaskId} />}
        </div>
        <div style={{ flex: 1 }}>
          <Card size="small" title="预览" extra={editedVideoUrl && <Button size="small" icon={<SendOutlined />} onClick={handleApplyToWorkflow}>推送到工作流</Button>}>
            {editedVideoUrl ? <video src={editedVideoUrl} controls style={{ width: '100%', borderRadius: 8 }} /> : <Empty description="剪辑完成后将在此处预览" />}
          </Card>
        </div>
      </div>
    </div>
  )
}
export default AutoEditPanel
