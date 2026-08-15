import React, { useEffect, useState } from 'react';
import { Button, Card, Statistic, Row, Col, Tag, Empty } from 'antd';
import { GlobalOutlined, CheckCircleOutlined } from '@ant-design/icons';
import PublishAccountModal, { StoredCredential } from './PublishAccountModal';

const STORAGE_KEY = 'vf-publish-accounts-v1';

function loadCredentials(): StoredCredential[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}

const PublishAccountTab: React.FC = () => {
  const [credentials, setCredentials] = useState<StoredCredential[]>([]);
  const [showModal, setShowModal] = useState(false);

  const refresh = () => {
    setCredentials(loadCredentials());
  };

  useEffect(() => {
    refresh();
  }, []);

  const validCount = credentials.filter((c) => c.cookie || c.token).length;

  return (
    <div style={{ padding: 24 }}>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>
              <GlobalOutlined style={{ color: '#1677ff', marginRight: 8 }} />
              发布账号
            </h3>
            <p style={{ color: '#666', marginTop: 8, marginBottom: 0, fontSize: 13 }}>
              统一管理自动发布使用的平台 Token、Cookie 和 AccessKey。这里保存的账号会被「自动发布」复用。
            </p>
          </div>
          <Button type="primary" onClick={() => setShowModal(true)}>
            管理发布账号
          </Button>
        </div>

        <Row gutter={16}>
          <Col span={12}>
            <Card size="small">
              <Statistic title="已配置账号" value={credentials.length} />
            </Card>
          </Col>
          <Col span={12}>
            <Card size="small">
              <Statistic title="有效账号" value={validCount} prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />} />
            </Card>
          </Col>
        </Row>
      </Card>

      <Card title="账号列表">
        {credentials.length === 0 ? (
          <Empty description="暂无发布账号，请点击「管理发布账号」添加。" />
        ) : (
          credentials.map((credential) => (
            <div key={credential.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 12px', marginBottom: 8,
              border: '1px solid #f0f0f0', borderRadius: 6,
            }}>
              <div>
                <span style={{ fontWeight: 500, marginRight: 8 }}>{credential.accountName}</span>
                <Tag>{credential.platform}</Tag>
                <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                  添加于 {new Date(credential.createdAt).toLocaleString()}
                </div>
              </div>
              <Tag color={credential.cookie || credential.token ? 'success' : 'default'}>
                {credential.cookie || credential.token ? '有效' : '未配置'}
              </Tag>
            </div>
          ))
        )}
      </Card>

      <PublishAccountModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSelect={() => { refresh(); }}
      />
    </div>
  );
};

export default PublishAccountTab;
