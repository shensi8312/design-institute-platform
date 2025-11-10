import React, { useState, useEffect } from 'react'
import { Card, Button, message } from 'antd'

const KnowledgeGraphViz: React.FC = () => {
  const [loading, setLoading] = useState(false)

  return (
    <div style={{ padding: 24 }}>
      <Card title="知识图谱可视化">
        <p>知识图谱3D可视化功能</p>
        <p>需要安装: npm install react-force-graph-3d three</p>
        <Button type="primary" onClick={() => message.info('功能开发中')}>
          加载图谱
        </Button>
      </Card>
    </div>
  )
}

export default KnowledgeGraphViz
