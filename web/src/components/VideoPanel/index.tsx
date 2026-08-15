import React from 'react'
import { Layout, Menu, Typography } from 'antd'
import { AudioOutlined, SoundOutlined, VideoCameraOutlined, ScissorOutlined, GlobalOutlined, FolderOutlined, RocketOutlined, HistoryOutlined, DatabaseOutlined } from '@ant-design/icons'
import { useAigcStore, type ActiveFunction } from '@/store/aigc'
import AsrPanel from './AsrPanel'
import TtsPanel from './TtsPanel'
import TalkingHeadStudio from './TalkingHeadStudio'
import AutoEditPanel from './AutoEditPanel'
import DistributionTab from './DistributionTab'
import AssetLibraryTab from './AssetLibraryTab'
import VoiceLibraryTab from './VoiceLibraryTab'
import CreatorWorkflowPanel from './CreatorWorkflowPanel'
import TaskCenterTab from './TaskCenterTab'
const { Sider, Content } = Layout; const { Text } = Typography
const MENU_ITEMS: { key: ActiveFunction; icon: React.ReactNode; label: string }[] = [
  { key: 'pipeline', icon: <RocketOutlined />, label: '创作工作流' },
  { key: 'asr', icon: <AudioOutlined />, label: '语音识别' },
  { key: 'tts', icon: <SoundOutlined />, label: '语音合成' },
  { key: 'talkingHead', icon: <VideoCameraOutlined />, label: '视频生成' },
  { key: 'autoEdit', icon: <ScissorOutlined />, label: '自动剪辑' },
  { key: 'distribution', icon: <GlobalOutlined />, label: '自动发布' },
  { key: 'voiceLibrary', icon: <DatabaseOutlined />, label: '语音库' },
  { key: 'assetLibrary', icon: <FolderOutlined />, label: '资料库' },
  { key: 'taskCenter', icon: <HistoryOutlined />, label: '任务中心' },
]
const menuItems = MENU_ITEMS.map((item) => ({ key: item.key, icon: item.icon, label: <span style={{ fontSize: 13 }}>{item.label}</span> }))
const VideoPanel: React.FC = () => {
  const activeFunction = useAigcStore((s) => s.activeFunction)
  const setActiveFunction = useAigcStore((s) => s.setActiveFunction)
  return (
    <Layout style={{ height: "100%", background: "transparent" }}>
      <Sider width={140} style={{ background: "transparent", borderRight: "1px solid #f0f0f0", overflow: "auto" }}>
        <div style={{ padding: "12px 8px" }}><Text strong style={{ fontSize: 12, color: "#888", paddingLeft: 8 }}>工具</Text></div>
        <Menu mode="inline" selectedKeys={[activeFunction || ""]} onClick={({ key }) => setActiveFunction(key as ActiveFunction)} items={menuItems as any} style={{ background: "transparent", borderInlineEnd: "none" }} />
      </Sider>
      <Content style={{ padding: 16, overflow: "auto" }}>
        {activeFunction === 'asr' && <AsrPanel />}
        {activeFunction === 'tts' && <TtsPanel />}
        {activeFunction === 'talkingHead' && <TalkingHeadStudio />}
        {activeFunction === 'autoEdit' && <AutoEditPanel />}
        {activeFunction === 'distribution' && <DistributionTab />}
        {activeFunction === 'pipeline' && <CreatorWorkflowPanel />}
        {activeFunction === 'assetLibrary' && <AssetLibraryTab />}
        {activeFunction === 'voiceLibrary' && <VoiceLibraryTab />}
        {activeFunction === 'taskCenter' && <TaskCenterTab />}
      </Content>
    </Layout>
  )
}
export default VideoPanel
