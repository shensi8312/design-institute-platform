/**
 * Agent节点组件
 * 自定义的React Flow节点
 */

import React, { memo } from 'react'
import { Handle, Position } from 'reactflow'
import type { NodeProps } from 'reactflow'
import { Badge, Tooltip } from 'antd'

const AgentNode: React.FC<NodeProps> = ({ data, selected }) => {
  const getStatusColor = () => {
    switch (data.status) {
      case 'running':
        return 'processing'
      case 'success':
        return 'success'
      case 'failed':
        return 'error'
      default:
        return 'default'
    }
  }

  return (
    <div 
      style={{
        minWidth: 180,
        background: selected ? '#f0f8ff' : '#fff',
        border: `2px solid ${selected ? '#1890ff' : '#d9d9d9'}`,
        borderRadius: 8,
        boxShadow: selected ? '0 4px 12px rgba(24, 144, 255, 0.15)' : '0 2px 8px rgba(0,0,0,0.1)',
        transition: 'all 0.3s'
      }}
    >
      {/* 输入端口 */}
      {data.agent?.inputs?.map((input: string, index: number) => (
        <Tooltip key={`in-${index}`} title={input} placement="left">
          <Handle
            type="target"
            position={Position.Left}
            id={input}
            style={{
              top: `${30 + index * 20}px`,
              background: '#1890ff',
              width: 8,
              height: 8
            }}
          />
        </Tooltip>
      ))}

      {/* 节点内容 */}
      <div style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>{data.agent?.icon || '🤖'}</span>
            <div>
              <div style={{ fontWeight: 500, fontSize: 14 }}>
                {data.label || 'Agent'}
              </div>
              <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                {data.agent?.category || 'process'}
              </div>
            </div>
          </div>
          {data.status && (
            <Badge status={getStatusColor() as any} />
          )}
        </div>
        
        {data.status === 'running' && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#1890ff' }}>
            处理中...
          </div>
        )}
        
        {data.status === 'failed' && data.error && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#ff4d4f' }}>
            错误: {data.error}
          </div>
        )}
        
        {data.metrics && (
          <div style={{ marginTop: 8, fontSize: 11, color: '#8c8c8c' }}>
            {Object.entries(data.metrics).map(([key, value]) => (
              <div key={key}>
                {key}: {String(value)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 输出端口 */}
      {data.agent?.outputs?.map((output: string, index: number) => (
        <Tooltip key={`out-${index}`} title={output} placement="right">
          <Handle
            type="source"
            position={Position.Right}
            id={output}
            style={{
              top: `${30 + index * 20}px`,
              background: '#52c41a',
              width: 8,
              height: 8
            }}
          />
        </Tooltip>
      ))}
    </div>
  )
}

export default memo(AgentNode)
