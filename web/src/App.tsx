import React from 'react'
import { Layout, Typography } from 'antd'
import { VideoCameraOutlined } from '@ant-design/icons'
import VideoPanel from './components/VideoPanel'

const { Header, Content } = Layout
const { Text } = Typography

const App: React.FC = () => {
  return (
    <Layout style={{ height: '100vh', background: '#fff' }}>
      <Header style={{
        background: '#fff',
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        height: 48,
        lineHeight: '48px',
      }}>
        <VideoCameraOutlined style={{ fontSize: 20, marginRight: 8, color: '#1677ff' }} />
        <Text strong style={{ fontSize: 16 }}>视频制作工厂</Text>
        <Text type="secondary" style={{ marginLeft: 12, fontSize: 12 }}>clawdao-video-factory · web 控制台</Text>
      </Header>
      <Content style={{ height: 'calc(100vh - 48px)', overflow: 'hidden' }}>
        <VideoPanel />
      </Content>
    </Layout>
  )
}

export default App
