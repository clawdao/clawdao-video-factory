import React, { useState, useEffect } from 'react'
import { Modal, Form, Input, Select, Button, message, List, Tag, Empty, Popconfirm } from 'antd'
import { PlusOutlined, DeleteOutlined, KeyOutlined } from '@ant-design/icons'
export interface StoredCredential { id: string; platform: string; accountName: string; cookie?: string; token?: string; createdAt: string }
interface PAMProps { open: boolean; onClose: () => void; onSelect?: (credential: StoredCredential) => void }
const PLATFORMS = [{ id: 'douyin', name: '抖音' }, { id: 'kuaishou', name: '快手' }, { id: 'xiaohongshu', name: '小红书' }, { id: 'bilibili', name: 'B站' }, { id: 'shipinhao', name: '视频号' }]
const STORAGE_KEY = 'vf-publish-accounts-v1'
function loadC(): StoredCredential[] { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] } }
function saveC(c: StoredCredential[]): void { localStorage.setItem(STORAGE_KEY, JSON.stringify(c)) }
const PublishAccountModal: React.FC<PAMProps> = ({ open, onClose, onSelect }) => {
  const [creds, setCreds] = useState<StoredCredential[]>([]); const [form] = Form.useForm(); const [adding, setAdding] = useState(false)
  useEffect(() => { if (open) setCreds(loadC()) }, [open])
  const handleAdd = () => { form.validateFields().then((v) => { const nc: StoredCredential = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, platform: v.platform, accountName: v.accountName, cookie: v.cookie, token: v.token, createdAt: new Date().toISOString() }; const u = [nc, ...creds]; setCreds(u); saveC(u); form.resetFields(); setAdding(false); message.success('账号添加成功') }) }
  const handleDelete = (id: string) => { const u = creds.filter((c) => c.id !== id); setCreds(u); saveC(u); message.success('账号已删除') }
  return (
    <Modal title="发布账号管理" open={open} onCancel={onClose} footer={null} width={520}>
      {adding ? (
        <Form form={form} layout="vertical" style={{ marginBottom: 16 }}>
          <Form.Item name="platform" label="平台" rules={[{ required: true }]}><Select>{PLATFORMS.map((p) => <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>)}</Select></Form.Item>
          <Form.Item name="accountName" label="账号名称" rules={[{ required: true }]}><Input placeholder="如：抖音·官方账号" /></Form.Item>
          <Form.Item name="cookie" label="Cookie"><Input.TextArea rows={2} placeholder="登录后的 Cookie（可选）" /></Form.Item>
          <Form.Item name="token" label="Token"><Input.TextArea rows={2} placeholder="API Token（可选）" /></Form.Item>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}><Button onClick={() => setAdding(false)}>取消</Button><Button type="primary" onClick={handleAdd}>保存</Button></div>
        </Form>
      ) : <Button type="dashed" icon={<PlusOutlined />} onClick={() => setAdding(true)} style={{ width: '100%', marginBottom: 16 }}>添加账号</Button>}
      {creds.length === 0 ? <Empty description="暂无发布账号" /> : <List dataSource={creds} renderItem={(item) => <List.Item actions={[<Popconfirm title="确定删除？" onConfirm={() => handleDelete(item.id)} key="delete"><Button type="text" danger icon={<DeleteOutlined />} /></Popconfirm>]}><List.Item.Meta avatar={<KeyOutlined style={{ fontSize: 20, color: '#1677ff' }} />} title={<span>{item.accountName}<Tag style={{ marginLeft: 8 }}>{PLATFORMS.find((p) => p.id === item.platform)?.name || item.platform}</Tag></span>} description={`添加于 ${new Date(item.createdAt).toLocaleString()}`} /></List.Item>} />}
    </Modal>
  )
}
export default PublishAccountModal
