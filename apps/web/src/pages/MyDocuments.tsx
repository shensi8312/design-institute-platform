import { Card, Typography } from 'antd'

const MyDocuments: React.FC = () => (
  <Card>
    <Typography.Title level={4}>我的文档</Typography.Title>
    <Typography.Paragraph type="secondary">
      我的文档模块尚未接入后端服务。
    </Typography.Paragraph>
  </Card>
)

export default MyDocuments
