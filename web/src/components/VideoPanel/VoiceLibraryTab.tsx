import React, { useState, useEffect } from 'react'
import { Card, Button, Space, Typography, Empty, Tag, List, message, Modal, Form, Input, Popconfirm } from 'antd'
import { SoundOutlined, UploadOutlined, PlayCircleOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { voiceLibrary } from '@/services/voiceLibrary'
import { useVoiceLibraryStore } from '@/store/slices/voiceLibrary'
import type { VoiceEntry } from '@/store/slices/voiceLibrary'
import { getWavDurationFromBytes, genId } from '@/services/audioUtils'
const { Text, Title } = Typography
const VoiceLibraryTab: React.FC = () => {
  const { entries, setEntries, addEntry, removeEntry } = useVoiceLibraryStore()
  const [loading, setLoading] = useState(false); const [editingEntry, setEditingEntry] = useState<VoiceEntry | null>(null)
  const [editForm] = Form.useForm(); const [playingId, setPlayingId] = useState<string | null>(null)
  const audioRef = React.useRef<HTMLAudioElement | null>(null)
  useEffect(() => { (async () => { setLoading(true); try { setEntries(await voiceLibrary.list()) } finally { setLoading(false) } })() }, [])
  const handleImport = () => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'audio/*,.wav,.mp3,.m4a'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return
      const buffer = await file.arrayBuffer(); const duration = getWavDurationFromBytes(buffer)
      const entry: VoiceEntry = { id: genId(), name: file.name.replace(/\.[^/.]+$/, ''), source: 'upload', filePath: URL.createObjectURL(file), fileSize: file.size, duration, sampleRate: 44100, format: file.name.split('.').pop() || 'wav', modelName: null, seed: null, crossLingual: false, referenceText: null, associatedText: null, gender: null, language: null, style: null, tags: '导入', parentId: null, version: 1, usageCount: 0, lastUsedAt: null, notes: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      await voiceLibrary.save(entry); addEntry(entry); message.success(`已导入: ${entry.name}`)
    }; input.click()
  }
  const handlePlay = (entry: VoiceEntry) => {
    if (playingId === entry.id) { audioRef.current?.pause(); setPlayingId(null); return }
    if (audioRef.current) audioRef.current.pause()
    const a = new Audio(entry.filePath); a.onended = () => setPlayingId(null); a.play(); audioRef.current = a; setPlayingId(entry.id)
  }
  const handleEditSave = async () => {
    if (!editingEntry) return; const v = editForm.getFieldsValue()
    const updated: VoiceEntry = { ...editingEntry, name: v.name, tags: v.tags, notes: v.notes, associatedText: v.associatedText, updatedAt: new Date().toISOString() }
    await voiceLibrary.update(updated); useVoiceLibraryStore.getState().updateEntry(editingEntry.id, updated); setEditingEntry(null); message.success('已更新')
  }
  const handleDelete = async (entry: VoiceEntry) => { await voiceLibrary.remove(entry.id); removeEntry(entry.id); message.success('已删除') }
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Title level={4} style={{ margin: 0 }}><SoundOutlined /> 语音库</Title>
        <Button icon={<UploadOutlined />} onClick={handleImport}>导入语音</Button>
      </div>
      {entries.length === 0 ? <Empty description="暂无语音条目" /> : (
        <List loading={loading} dataSource={entries} renderItem={(entry) => (
          <List.Item actions={[
            <Button key="play" type="text" icon={<PlayCircleOutlined />} onClick={() => handlePlay(entry)}>{playingId === entry.id ? '暂停' : '试听'}</Button>,
            <Button key="edit" type="text" icon={<EditOutlined />} onClick={() => { setEditingEntry(entry); editForm.setFieldsValue({ name: entry.name, tags: entry.tags, notes: entry.notes, associatedText: entry.associatedText }) }} />,
            <Popconfirm key="del" title="确定删除?" onConfirm={() => handleDelete(entry)}><Button type="text" danger icon={<DeleteOutlined />} /></Popconfirm>,
          ]}>
            <List.Item.Meta title={entry.name} description={<Space><Tag>{entry.source === 'upload' ? '上传' : entry.source === 'clone' ? '克隆' : 'TTS'}</Tag><Text type="secondary">{entry.format.toUpperCase()}</Text>{entry.duration > 0 && <Text type="secondary">{Math.round(entry.duration)}秒</Text>}</Space>} />
          </List.Item>
        )} />
      )}
      <Modal title="编辑语音信息" open={!!editingEntry} onCancel={() => setEditingEntry(null)} onOk={handleEditSave}><Form form={editForm} layout="vertical"><Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="tags" label="标签"><Input placeholder="逗号分隔" /></Form.Item><Form.Item name="associatedText" label="关联文案"><Input.TextArea rows={3} /></Form.Item><Form.Item name="notes" label="备注"><Input.TextArea rows={2} /></Form.Item></Form></Modal>
    </div>
  )
}
export default VoiceLibraryTab
