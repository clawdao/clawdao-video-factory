import React, { useState } from 'react'
import { Card, Button, Input, Select, Space, Typography, message, Radio, Alert, Empty, Image } from 'antd'
import { VideoCameraOutlined, UserOutlined, SendOutlined, ClearOutlined } from '@ant-design/icons'
import type { AigcState } from '@/store/aigc'
import { useTaskQueueStore, taskId } from '@/store/slices/taskQueue'
import { videoPipeline } from '@/services/videoPipeline'
import TaskProgress from '../common/TaskProgress'
const { Text, Title } = Typography; const { TextArea } = Input

const TalkingHeadStudio: React.FC = () => {
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null)
  const [prompt, setPrompt] = useState('一个正在说话的半身人物，自然表情，背景虚化')
  const [genStatus, setGenStatus] = useState<'idle' | 'generating' | 'done' | 'error'>('idle')
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const addTask = useTaskQueueStore((s) => s.addTask)
  const updateTask = useTaskQueueStore((s) => s.updateTask)
  const pipelineAudio = videoPipeline.getState().audio

  const handleGenerate = async () => {
    if (!avatarFile) { message.warning('请上传头像图片'); return }
    const tid = taskId(); setCurrentTaskId(tid); setGenStatus('generating'); setVideoUrl(null); setError(null)
    addTask({ id: tid, type: 'videoGen', content: '视频生成中...', status: 'running', progress: 10 })
    try {
      const avatarDataUrl = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result as string); r.onerror = reject; r.readAsDataURL(avatarFile) })
      updateTask(tid, { progress: 30 }); const { videoSubmitImage } = await import('@/api/client')
      let audioWavBase64: string | undefined
      if (pipelineAudio?.path) { try { const resp = await fetch(pipelineAudio.path); if (resp.ok) { const b = await resp.blob(); audioWavBase64 = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve((r.result as string).split(',')[1]); r.onerror = reject; r.readAsDataURL(b) }) } } catch {} }
      updateTask(tid, { progress: 60, content: '调用视频生成...' })
      const result = await videoSubmitImage({ baseUrl: '', apiKey: '' }, avatarDataUrl, prompt, audioWavBase64)
      updateTask(tid, { progress: 90 }); setVideoUrl(result.video.url); setGenStatus('done')
      updateTask(tid, { progress: 100, status: 'done', outputUrl: result.video.url }); message.success('视频生成完成！')
    } catch (e: any) { setError(e.message); setGenStatus('error'); updateTask(tid, { status: 'failed', error: e.message }); message.error(`生成失败: ${e.message}`) }
  }

  const handleApplyToWorkflow = () => { if (!videoUrl) return; videoPipeline.updateSection('avatar', { name: avatarFile?.name || '上传形象', source: 'upload' }); message.success('已推送到创作工作流') }
  const handleClear = () => { setAvatarFile(null); setAvatarPreviewUrl(null); setVideoUrl(null); setError(null); setGenStatus('idle'); setCurrentTaskId(null) }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Title level={4} style={{ margin: 0 }}><VideoCameraOutlined /> 视频生成 (数字人口播)</Title>
      <div style={{ display: 'flex', gap: 16, flex: 1 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card size="small" title="形象设置">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text type="secondary">上传头像图片</Text>
                <input type="file" accept="image/*,.jpg,.jpeg,.png,.webp" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setAvatarFile(f); setAvatarPreviewUrl(URL.createObjectURL(f)) } }} style={{ width: '100%', marginTop: 4 }} />
                {avatarPreviewUrl && <Image src={avatarPreviewUrl} alt="avatar" style={{ maxHeight: 160, borderRadius: 8, marginTop: 8 }} preview={{ mask: '预览' }} />}
              </div>
            </Space>
          </Card>
          <Card size="small" title="视频参数">
            <Space direction="vertical" style={{ width: '100%' }}>
              <TextArea rows={2} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="视频场景描述..." />
              {pipelineAudio && <Alert type="info" showIcon message={`有音频关联: ${pipelineAudio.name || '音频'}`} style={{ fontSize: 12 }} />}
              <Button type="primary" icon={<VideoCameraOutlined />} onClick={handleGenerate} loading={genStatus === 'generating'} size="large" block>{genStatus === 'generating' ? '生成中...' : '生成视频'}</Button>
            </Space>
          </Card>
          {currentTaskId && <TaskProgress taskId={currentTaskId} />}
        </div>
        <div style={{ flex: 1 }}>
          <Card size="small" title="预览" extra={videoUrl && <Space><Button size="small" icon={<SendOutlined />} onClick={handleApplyToWorkflow}>推送到工作流</Button><Button size="small" icon={<ClearOutlined />} onClick={handleClear}>清空</Button></Space>}>
            {videoUrl ? <video src={videoUrl} controls style={{ width: '100%', borderRadius: 8 }} autoPlay muted /> : error ? <Alert type="error" message={error} /> : <Empty description="视频将在此处预览" />}
          </Card>
        </div>
      </div>
    </div>
  )
}
export default TalkingHeadStudio
