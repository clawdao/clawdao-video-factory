import React, { useState, useRef, useEffect } from 'react'
import { Card, Button, Input, Select, Slider, Space, Typography, message, Radio, Switch, Tooltip, Empty, List, Divider } from 'antd'
import { SoundOutlined, PlayCircleOutlined, PauseCircleOutlined, HistoryOutlined, SendOutlined } from '@ant-design/icons'
import { useTaskQueueStore, taskId } from '@/store/slices/taskQueue'
import { useTtsHistoryStore } from '@/store/slices/ttsHistory'
import { videoPipeline } from '@/services/videoPipeline'
import TaskProgress from '../common/TaskProgress'
const { Text, Title } = Typography; const { TextArea } = Input
const COSYVOICE_SPEAKERS = ['中文女', '中文男', '英文女', '英文男', '日语女', '粤语女', '韩语女', '法语女']

const TtsPanel: React.FC = () => {
  const [phase, setPhase] = useState<'configure' | 'history'>('configure')
  const [text, setText] = useState('')
  const [speaker, setSpeaker] = useState('中文女')
  const [speed, setSpeed] = useState(1.0)
  const [seed, setSeed] = useState(0)
  const [crossLingual, setCrossLingual] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const addTask = useTaskQueueStore((s) => s.addTask)
  const updateTask = useTaskQueueStore((s) => s.updateTask)
  const ttsHistory = useTtsHistoryStore()

  useEffect(() => { return () => { audioRef.current?.pause() } }, [])

  const handleSynthesize = async () => {
    if (!text.trim()) { message.warning('请输入需要合成的文本'); return }
    const tid = taskId(); setCurrentTaskId(tid); setIsProcessing(true); setAudioUrl(null)
    addTask({ id: tid, type: 'tts', content: `TTS 合成: ${text.slice(0, 30)}...`, status: 'running', progress: 10 })
    try {
      updateTask(tid, { progress: 30 })
      const { ttsSubmit, ttsQuery, ttsAudioUrl } = await import('@/api/client')
      const sr = await ttsSubmit({ speaker, speed, seed, crossLingual }, text)
      updateTask(tid, { progress: 60 })
      if (sr.jobId) {
        let fp = ''
        for (let i = 0; i < 60; i++) {
          const qr = await ttsQuery(sr.jobId)
          if (qr.status === 'success') { fp = qr.filePath || ''; break }
          if (qr.status === 'fail') throw new Error(qr.msg || 'TTS 合成失败')
          await new Promise((r) => setTimeout(r, 1000))
        }
        const url = ttsAudioUrl(fp); setAudioUrl(url)
        updateTask(tid, { progress: 100, status: 'done', outputFile: fp })
        ttsHistory.addItem({ id: tid, text, filePath: fp, audioUrl: url, speaker, speed, seed, crossLingual, modelName: 'CosyVoice', mode: 'synthesize', status: 'success', createdAt: new Date().toISOString() })
        message.success('语音合成完成')
      }
    } catch (e: any) { message.error(`合成失败: ${e.message}`); updateTask(tid, { status: 'failed', error: e.message }) }
    finally { setIsProcessing(false) }
  }

  const handlePlayPause = () => {
    if (!audioUrl) return
    if (isPlaying) { audioRef.current?.pause(); setIsPlaying(false) }
    else { if (!audioRef.current) { audioRef.current = new Audio(audioUrl); audioRef.current.onended = () => setIsPlaying(false) }; audioRef.current.play(); setIsPlaying(true) }
  }

  const handleApplyToWorkflow = () => { videoPipeline.updateSection('audio', { name: text.slice(0, 20), source: 'tts' }); message.success('已推送到创作工作流') }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Title level={4} style={{ margin: 0 }}><SoundOutlined /> 语音合成 (TTS)</Title>
        <Button size="small" icon={<HistoryOutlined />} onClick={() => setPhase(phase === 'history' ? 'configure' : 'history')}>历史记录</Button>
      </div>
      {phase === 'history' ? (
        <Card size="small" title="合成历史">
          {ttsHistory.items.length === 0 ? <Empty description="暂无历史记录" /> : <List size="small" dataSource={ttsHistory.items} renderItem={(item) => <List.Item actions={[<Button key="use" size="small" type="link" onClick={() => { setText(item.text); setSpeaker(item.speaker); setSpeed(item.speed); setSeed(item.seed); setCrossLingual(item.crossLingual); if (item.audioUrl) setAudioUrl(item.audioUrl); setPhase('configure') }}>使用</Button>]}><List.Item.Meta title={item.text.slice(0, 50)} description={`${item.speaker} · ${new Date(item.createdAt).toLocaleString()}`} /></List.Item>} />}
        </Card>
      ) : (
        <>
          <Card size="small" title="合成配置">
            <Space direction="vertical" style={{ width: '100%' }}>
              <TextArea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="输入需要合成语音的文本..." />
              <div><Text type="secondary">音色</Text><Select value={speaker} onChange={setSpeaker} style={{ width: '100%', marginTop: 4 }} options={COSYVOICE_SPEAKERS.map((s) => ({ value: s, label: s }))} /></div>
              <div><Text type="secondary">语速: {speed.toFixed(1)}x</Text><Slider min={0.5} max={2.0} step={0.1} value={speed} onChange={setSpeed} /></div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ flex: 1 }}><Text type="secondary">随机种子</Text><Input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} style={{ marginTop: 4 }} /></div>
                <div><Text type="secondary">跨语言</Text><div style={{ marginTop: 4 }}><Switch checked={crossLingual} onChange={setCrossLingual} checkedChildren="开" unCheckedChildren="关" /></div></div>
              </div>
              <Button type="primary" icon={<SoundOutlined />} onClick={handleSynthesize} loading={isProcessing} size="large" block>{isProcessing ? '合成中...' : '开始合成'}</Button>
            </Space>
          </Card>
          {currentTaskId && <TaskProgress taskId={currentTaskId} />}
          {audioUrl && <Card size="small" title="合成结果" extra={<Space><Tooltip title={isPlaying ? '暂停' : '播放'}><Button shape="circle" icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />} onClick={handlePlayPause} /></Tooltip><Button size="small" icon={<SendOutlined />} onClick={handleApplyToWorkflow}>推送到工作流</Button></Space>}><audio src={audioUrl} controls style={{ width: '100%' }} /></Card>}
        </>
      )}
    </div>
  )
}
export default TtsPanel
