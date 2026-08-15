import React, { useState, useEffect } from 'react'
import { Card, Tabs, Button, Space, Typography, Empty, Tag, message, Image } from 'antd'
import { FolderOutlined, UploadOutlined, PictureOutlined, VideoCameraOutlined, SoundOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons'
import { mediaAssetLibrary, type MediaAssetEntry, type MediaAssetKind } from '@/services/mediaAssetLibrary'
const { Text, Title } = Typography
const CATS: { key: MediaAssetKind | 'voice'; label: string; icon: React.ReactNode; accept: string }[] = [
  { key: 'voice', label: '声音素材', icon: <SoundOutlined />, accept: '' },
  { key: 'avatarImage', label: '形象图片', icon: <PictureOutlined />, accept: '.png,.jpg,.jpeg,.webp' },
  { key: 'avatarVideo', label: '形象视频', icon: <VideoCameraOutlined />, accept: '.mp4,.mov,.mkv,.webm' },
  { key: 'audio', label: '音频文件', icon: <SoundOutlined />, accept: '.mp3,.wav,.m4a,.aac,.flac,.ogg' },
  { key: 'video', label: '成品视频', icon: <VideoCameraOutlined />, accept: '.mp4,.mov,.mkv,.webm' },
  { key: 'bgm', label: '背景音乐', icon: <SoundOutlined />, accept: '.mp3,.wav,.m4a' },
]
const AssetLibraryTab: React.FC = () => {
  const [assets, setAssets] = useState<MediaAssetEntry[]>([]); const [activeCategory, setActiveCategory] = useState<string>('voice')
  const refreshAssets = async () => { setAssets(await mediaAssetLibrary.list()) }
  useEffect(() => { refreshAssets() }, [])
  const handleImport = () => {
    const input = document.createElement('input'); input.type = 'file'; input.multiple = true
    const cat = CATS.find((c) => c.key === activeCategory); if (cat?.accept) input.accept = cat.accept
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files; if (!files) return
      const now = new Date().toISOString()
      const entries: MediaAssetEntry[] = Array.from(files).map((f) => ({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, kind: (activeCategory === 'voice' ? 'audio' : activeCategory) as MediaAssetKind, name: f.name, path: URL.createObjectURL(f), source: 'upload' as const, tags: ['上传'], createdAt: now, updatedAt: now }))
      await mediaAssetLibrary.saveMany(entries); message.success(`已导入 ${entries.length} 个素材`); refreshAssets()
    }; input.click()
  }
  const visibleAssets = assets.filter((a) => activeCategory === 'voice' ? (a.kind === 'audio' || a.kind === 'bgm') : a.kind === activeCategory)
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Title level={4} style={{ margin: 0 }}><FolderOutlined /> 资料库</Title>
        {activeCategory !== 'voice' && <Button icon={<UploadOutlined />} onClick={handleImport}>导入素材</Button>}
      </div>
      <Tabs activeKey={activeCategory} onChange={setActiveCategory} items={CATS.map((c) => ({ key: c.key, label: <span>{c.icon} {c.label}</span> }))} />
      {visibleAssets.length === 0 ? <Empty description={<span>暂无素材<Button type="link" onClick={handleImport}>导入素材</Button></span>} /> : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {visibleAssets.map((asset) => (
            <Card key={asset.id} size="small" hoverable actions={[<EyeOutlined key="preview" onClick={() => window.open(asset.path)} />, <DeleteOutlined key="delete" onClick={async () => { await mediaAssetLibrary.remove(asset.id); message.success('已删除'); refreshAssets() }} />]}>
              <Card.Meta title={<Text ellipsis>{asset.name}</Text>} description={<div><Tag color="blue">{asset.source === 'upload' ? '上传' : '生成'}</Tag><Text type="secondary" style={{ fontSize: 11 }}>{new Date(asset.createdAt).toLocaleDateString()}</Text></div>} />
              {asset.kind === 'avatarImage' && <div style={{ marginTop: 8 }}><Image src={asset.path} style={{ maxHeight: 100 }} preview={false} /></div>}
              {(asset.kind === 'video' || asset.kind === 'avatarVideo') && <video src={asset.path} style={{ width: '100%', maxHeight: 100, marginTop: 8 }} preload="metadata" controls />}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
export default AssetLibraryTab
