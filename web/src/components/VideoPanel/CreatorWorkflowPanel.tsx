import React, { useState, useRef, useCallback } from 'react'
import { Card, Button, Steps, Input, Space, Typography, message, Alert, Badge } from 'antd'
import { RocketOutlined, LinkOutlined, SoundOutlined, VideoCameraOutlined, ScissorOutlined, GlobalOutlined, CheckCircleOutlined, CloseCircleOutlined, FileTextOutlined } from '@ant-design/icons'
import { useTaskQueueStore, taskId } from '@/store/slices/taskQueue'
import TaskProgress from '../common/TaskProgress'
const { Text, Title } = Typography; const { TextArea } = Input

type PipelineStep = 'extract' | 'asr' | 'rewrite' | 'tts' | 'video' | 'edit' | 'publish' | 'done'
type PipelineStatus = 'pending' | 'running' | 'success' | 'fail'
interface PipelineEvent { step: PipelineStep; status: PipelineStatus; progress: number; message: string }

const STEP_CONFIG: { step: PipelineStep; label: string; icon: React.ReactNode }[] = [
  { step: 'extract', label: '提取文案', icon: <LinkOutlined /> },
  { step: 'asr', label: '语音识别', icon: <SoundOutlined /> },
  { step: 'rewrite', label: '文案润色', icon: <FileTextOutlined /> },
  { step: 'tts', label: '语音合成', icon: <SoundOutlined /> },
  { step: 'video', label: '视频生成', icon: <VideoCameraOutlined /> },
  { step: 'edit', label: '智能剪辑', icon: <ScissorOutlined /> },
  { step: 'publish', label: '自动发布', icon: <GlobalOutlined /> },
  { step: 'done', label: '完成', icon: <CheckCircleOutlined /> },
]

const CreatorWorkflowPanel: React.FC = () => {
  const [douyinUrl, setDouyinUrl] = useState('')
  const [scriptText, setScriptText] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [events, setEvents] = useState<PipelineEvent[]>([])
  const [finalResult, setFinalResult] = useState<string | null>(null)
  const abortRef = useRef(false)

  const emit = (step: PipelineStep, status: PipelineStatus, progress: number, message: string) => {
    setEvents((prev) => [...prev, { step, status, progress, message }])
  }

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

  const handleRun = async () => {
    if (!avatarFile && !douyinUrl.trim() && !scriptText.trim()) { message.warning('请提供头像和文案（或抖音链接）'); return }
    setIsRunning(true); setEvents([]); setFinalResult(null); abortRef.current = false

    try {
      // Step 1: Extract
      let sourceText = scriptText.trim()
      if (!sourceText && douyinUrl.trim()) {
        emit('extract', 'running', 10, '解析抖音链接...')
        const { extractDouyin, douyinAudio, asr } = await import('@/api/client')
        const info = await extractDouyin(douyinUrl.trim())
        emit('extract', 'running', 30, `视频: ${info.title}`)
        const audio = await douyinAudio(info.videoUrl, 90)
        emit('asr', 'running', 60, 'ASR 识别中...')
        const result = await asr(audio.wav)
        sourceText = result.text
        emit('extract', 'success', 100, '文案提取完成')
      }
      if (abortRef.current) throw new Error('已中止')

      // Step 2: TTS
      emit('tts', 'running', 10, 'TTS 合成中...')
      const { ttsSubmit, ttsQuery } = await import('@/api/client')
      const sr = await ttsSubmit({ speaker: '中文女' }, sourceText.slice(0, 1000))
      if (sr.jobId) {
        let fp = ''
        for (let i = 0; i < 60; i++) {
          if (abortRef.current) throw new Error('已中止')
          const qr = await ttsQuery(sr.jobId)
          if (qr.status === 'success') { fp = qr.filePath || ''; break }
          if (qr.status === 'fail') throw new Error(qr.msg || 'TTS 失败')
          await sleep(1000)
        }
      }
      emit('tts', 'success', 100, '语音合成完成')

      // Done
      emit('done', 'success', 100, '工作流执行完成！')
      message.success('工作流执行完成！')
    } catch (e: any) {
      if (e.message === '已中止') { emit('done', 'fail', 0, '工作流已中止') }
      else { emit('done', 'fail', 0, `执行失败: ${e.message}`); message.error(`执行异常: ${e.message}`) }
    } finally { setIsRunning(false) }
  }

  const handleAbort = () => { abortRef.current = true }

  const getStepStatus = (step: PipelineStep): 'process' | 'finish' | 'wait' | 'error' => {
    const ev = events.find((e) => e.step === step)
    if (!ev) return 'wait'
    if (ev.status === 'running') return 'process'
    if (ev.status === 'success') return 'finish'
    if (ev.status === 'fail') return 'error'
    return 'wait'
  }

  const currentStepIdx = () => {
    for (let i = events.length - 1; i >= 0; i--) {
      const idx = STEP_CONFIG.findIndex((s) => s.step === events[i].step)
      if (idx >= 0 && events[i].status === 'running') return idx
    }
    return -1
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Title level={4} style={{ margin: 0 }}><RocketOutlined /> 创作工作流</Title>
      <div style={{ display: 'flex', gap: 16, flex: 1 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card size="small" title="输入配置">
            <Space direction="vertical" style={{ width: '100%' }}>
              <TextArea rows={2} placeholder="抖音链接（可选）" value={douyinUrl} onChange={(e) => setDouyinUrl(e.target.value)} />
              <TextArea rows={3} placeholder="或直接输入文案（可选）" value={scriptText} onChange={(e) => setScriptText(e.target.value)} />
              <div><Text type="secondary">上传头像（推荐）</Text><input type="file" accept="image/*,.jpg,.jpeg,.png,.webp" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setAvatarFile(f); setAvatarPreview(URL.createObjectURL(f)) } }} style={{ width: '100%', marginTop: 4 }} />{avatarPreview && <img src={avatarPreview} alt="avatar" style={{ maxHeight: 80, marginTop: 8, borderRadius: 4 }} />}</div>
            </Space>
          </Card>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button type="primary" icon={<RocketOutlined />} onClick={handleRun} loading={isRunning} size="large" block disabled={!avatarFile && !douyinUrl.trim() && !scriptText.trim()}>一键生成</Button>
            {isRunning && <Button danger onClick={handleAbort}>中止</Button>}
          </div>
          {finalResult && <Alert type="success" showIcon message="工作流执行完成" description={<a href={finalResult} target="_blank" rel="noreferrer">查看生成视频</a>} />}
        </div>
        <div style={{ flex: 1 }}>
          <Card size="small" title="执行进度">
            <Steps direction="vertical" size="small" current={currentStepIdx()} items={STEP_CONFIG.map((sc) => ({ title: sc.label, icon: sc.icon, status: getStepStatus(sc.step) }))} />
            {events.length > 0 && <div style={{ marginTop: 16, maxHeight: 300, overflow: 'auto' }}>{events.map((evt, idx) => <div key={idx} style={{ fontSize: 12, padding: '2px 0', display: 'flex', alignItems: 'center', gap: 8 }}>{evt.status === 'running' ? <Badge status="processing" /> : evt.status === 'success' ? <Badge status="success" /> : <Badge status="error" />}<Text type="secondary">{evt.message}</Text></div>)}</div>}
          </Card>
        </div>
      </div>
    </div>
  )
}
export default CreatorWorkflowPanel
