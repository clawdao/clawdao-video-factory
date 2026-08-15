import React from 'react'
import { Button, Tooltip } from 'antd'
import { SendOutlined } from '@ant-design/icons'
interface ApplyToOneClickButtonProps { onClick: () => void; label?: string; disabled?: boolean }
const ApplyToOneClickButton: React.FC<ApplyToOneClickButtonProps> = ({ onClick, label = '应用到工作流', disabled = false }) => (
  <Tooltip title="将当前内容推送到创作工作流进行完整处理">
    <Button type="default" size="small" icon={<SendOutlined />} onClick={onClick} disabled={disabled}>{label}</Button>
  </Tooltip>
)
export default ApplyToOneClickButton
