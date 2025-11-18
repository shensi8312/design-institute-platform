import React from 'react'
import { Tabs, Badge } from 'antd'
import {
  FileTextOutlined,
  FileDoneOutlined,
  FormOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  FolderOutlined
} from '@ant-design/icons'
import { DocumentType } from '../../pages/ProjectWorkspace'

interface DocumentTabsProps {
  activeType: DocumentType
  onChange: (type: DocumentType) => void
  counts: Record<DocumentType, number>
}

const documentTypeConfig: Record<DocumentType, { label: string; icon: React.ReactNode }> = {
  contract: { label: '合同', icon: <FileTextOutlined /> },
  bidding_doc: { label: '招标文件', icon: <FileDoneOutlined /> },
  our_bid: { label: '投标书', icon: <FormOutlined /> },
  competitor_bid: { label: '竞争对手投标', icon: <TeamOutlined /> },
  evaluation: { label: '评审文件', icon: <CheckCircleOutlined /> },
  other: { label: '其他', icon: <FolderOutlined /> }
}

const DocumentTabs: React.FC<DocumentTabsProps> = ({ activeType, onChange, counts }) => {
  const items = (Object.keys(documentTypeConfig) as DocumentType[]).map(type => ({
    key: type,
    label: (
      <span>
        {documentTypeConfig[type].icon}
        <span style={{ marginLeft: 8 }}>{documentTypeConfig[type].label}</span>
        <Badge
          count={counts[type] || 0}
          style={{ marginLeft: 8, backgroundColor: '#1890ff' }}
        />
      </span>
    )
  }))

  return (
    <Tabs
      activeKey={activeType}
      onChange={(key) => onChange(key as DocumentType)}
      items={items}
      style={{ marginBottom: 16 }}
    />
  )
}

export default DocumentTabs
