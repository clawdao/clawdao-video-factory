import React, { useState } from 'react'
import { Card, Button, Input, Tabs, Space, Typography, message, Divider } from 'antd'
import { AudioOutlined, LinkOutlined, FileTextOutlined, ThunderboltOutlined, SendOutlined, ClearOutlined, SoundOutlined } from '@ant-design/icons'
import type { AigcState } from '@/store/aigc'
import { useTaskQueueStore, taskId } from '@/store/slices/taskQueue'
import { videoPipeline } from '@/services/videoPipeline'
import TaskProgress from '../common/TaskProgress'
const { Text, Title } = Typography; const { TextArea } = Input

const AsrPanel: React.FC = () => {
  const prefs = { llm: { baseUrl: '', apiKey: '', model: 'deepseek-chat', temperature: 0.7, maxTokens: 2048 } }
  const [inputMode, setInputMode] = useState<'url' | 'upload'>('url')
  const [douyinUrl, setDouyinUrl] = useState('')
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [sourceText, setSourceText] = useState('')
  const [polishedText, setPolishedText] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [phase, setPhase] = useState<'configure' | 'result'>('configure')
  const addTask = useTaskQueueStore((s) => s.addTask)
  const updateTask = useTaskQueueStore((s) => s.updateTask)

  const handleExtractDouyin = async () => {
    if (!douyinUrl.trim()) { message.warning('请输入抖音分享链接'); return }
    const tid = taskId(); setCurrentTaskId(tid); setIsProcessing(true)
    addTask({ id: tid, type: 'asr', content: '解析抖音链接...', status: 'running', progress: 10 })
    try {
      const { asr, extractDouyin, douyinAudio } = await import('@/api/client')
      updateTask(tid, { content: '解析抖音视频...', progress: 20 })
      const info = await extractDouyin(douyinUrl.trim())
      updateTask(tid, { content: `识别中: ${info.title}`, progress: 40 })
      const audio = await douyinAudio(info.videoUrl, 90)
      updateTask(tid, { progress: 80 })
      const result = await asr(audio.wav)
      setSourceText(result.text); updateTask(tid, { content: '识别完成', progress: 100, status: 'done' }); setPhase('result')
    } catch (e: any) { message.error(`识别失败: ${e.message}`); updateTask(tid, { status: 'failed', error: e.message }) }
    finally { setIsProcessing(false) }
  }

  const handleFileAsr = async () => {
    if (!audioFile) { message.warning('请选择音频文件'); return }
    const tid = taskId(); setCurrentTaskId(tid); setIsProcessing(true)
    addTask({ id: tid, type: 'asr', content: `处理音频: ${audioFile.name}`, status: 'running', progress: 10 })
    try {
      const reader = new FileReader()
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => { const r = reader.result as string; resolve(r.split(',')[1]) }; reader.onerror = reject; reader.readAsDataURL(audioFile)
      })
      updateTask(tid, { progress: 50 }); const { asr } = await import('@/api/client'); const result = await asr(base64)
      setSourceText(result.text); updateTask(tid, { content: '识别完成', progress: 100, status: 'done' }); setPhase('result')
    } catch (e: any) { message.error(`识别失败: ${e.message}`); updateTask(tid, { status: 'failed', error: e.message }) }
    finally { setIsProcessing(false) }
  }

  const handlePolish = async () => {
    if (!sourceText.trim()) return
    const tid = taskId(); setCurrentTaskId(tid)
    addTask({ id: tid, type: 'asr', content: 'LLM 润色中...', status: 'running', progress: 10 })
    try {
      const { llm } = await import('@/api/client')
      const result = await llm(prefs.llm, [{ role: 'system', content: '你是文案优化专家。请将以下视频口播文案优化为爆款风格'}, { role: 'user', content: sourceText }])
      setPolishedText(result); updateTask(tid, { content: '润色完成', progress: 100, status: 'done' })
    } catch (e: any) { message.error(`润色失败: ${e.message}`); updateTask(tid, { status: 'failed', error: e.message }) }
  }

  const handleApplyToWorkflow = () => { videoPipeline.updateSection('transcript', { text: polishedText || sourceText, source: 'asr' }); message.success('已推送到创作工作流') }
  const handleClear = () => { setSourceText(''); setPolishedText(''); setPhase('configure') }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Title level={4} style={{ margin: 0 }}><AudioOutlined /> 语音识别 (ASR)</Title>
      {phase === 'configure' && (
        <Card size="small" title="输入来源" style={{ flexShrink: 0 }}>
          <Tabs activeKey={inputMode} onChange={(k) => setInputMode(k as 'url' | 'upload')} items={[
            { key: 'url', label: <span><LinkOutlined /> 抖音链接</span>, children: <Space direction="vertical" style={{ width: '100%' }}><Input placeholder="粘贴抖音分享链接..." value={douyinUrl} onChange={(e) => setDouyinUrl(e.target.value)} /><Button type="primary" icon={<SoundOutlined />} onClick={handleExtractDouyin} loading={isProcessing}>提取并识别</Button></Space> },
            { key: 'upload', label: <span><FileTextOutlined /> 上传音频</span>, children: <Space direction="vertical" style={{ width: '100%' }}><input type="file" accept="audio/*,.wav,.mp3,.m4a" onChange={(e) => { const f = e.target.files?.[0]; if (f) setAudioFile(f) }} style={{ width: '100%' }} />{audioFile && <Text type="secondary">{audioFile.name}</Text>}<Button type="primary" icon={<SoundOutlined />} onClick={handleFileAsr} loading={isProcessing} disabled={!audioFile}>识别上传音频</Button></Space> },
          ]} />
          {currentTaskId && <TaskProgress taskId={currentTaskId} />}
        </Card>
      )}
      {phase === 'result' && (
        <>
          <Card size="small" title="识别结果" extra={<Space><Button size="small" icon={<ThunderboltOutlined />} onClick={handlePolish}>润色文案</Button><Button size="small" icon={<SendOutlined />} onClick={handleApplyToWorkflow}>推送到工作流</Button><Button size="small" icon={<ClearOutlined />} onClick={handleClear}>清空</Button></Space>}>
            <TextArea rows={4} value={sourceText} onChange={(e) => setSourceText(e.target.value)} placeholder="识别文本..." />
            {polishedText && <><Divider /><Text strong><ThunderboltOutlined /> 润色后文案</Text><TextArea rows={4} value={polishedText} readOnly style={{ marginTop: 8 }} /></>}
          </Card>
          {currentTaskId && <TaskProgress taskId={currentTaskId} />}
        </>
      )}
    </div>
  )
}
export default AsrPanel
