/**
 * 并行节点组件
 */

import React, { memo } from 'react'
import { Handle, Position } from 'reactflow'
import type { NodeProps } from 'reactflow'
import { ForkOutlined } from '@ant-design/icons'

const ParallelNode: React.FC<NodeProps> = ({ data, selected }) => {
  return (
    <div
      style={{
        minWidth: 140,
        background: selected ? '#f0f5ff' : '#fff',
        border: `2px solid ${selected ? '#597ef7' : '#adc6ff'}`,
        borderRadius: 8,
        padding: '12px 16px',
        textAlign: 'center'
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#597ef7' }}
      />
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <ForkOutlined style={{ fontSize: 20, color: '#597ef7' }} />
        <div>
          <div style={{ fontWeight: 500 }}>并行处理</div>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>
            {data.branches || 2} 个分支
          </div>
        </div>
      </div>
      
      {/* 多个输出端口 */}
      {[1, 2, 3].map((i) => (
        <Handle
          key={`out-${i}`}
          type="source"
          position={Position.Right}
          id={`output_${i}`}
          style={{ 
            top: `${25 + i * 25}%`, 
            background: '#597ef7' 
          }}
        />
      ))}
    </div>
  )
}

export default memo(ParallelNode)