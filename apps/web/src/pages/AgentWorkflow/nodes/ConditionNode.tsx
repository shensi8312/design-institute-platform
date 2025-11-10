/**
 * 条件节点组件
 */

import React, { memo } from 'react'
import { Handle, Position } from 'reactflow'
import type { NodeProps } from 'reactflow'
import { BranchesOutlined } from '@ant-design/icons'

const ConditionNode: React.FC<NodeProps> = ({ data, selected }) => {
  return (
    <div
      style={{
        minWidth: 140,
        background: selected ? '#fff4e6' : '#fff',
        border: `2px solid ${selected ? '#fa8c16' : '#ffd591'}`,
        borderRadius: 8,
        padding: '12px 16px',
        textAlign: 'center'
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#fa8c16' }}
      />
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <BranchesOutlined style={{ fontSize: 20, color: '#fa8c16' }} />
        <div>
          <div style={{ fontWeight: 500 }}>条件判断</div>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>
            {data.condition || 'if/else'}
          </div>
        </div>
      </div>
      
      <Handle
        type="source"
        position={Position.Right}
        id="true"
        style={{ top: '30%', background: '#52c41a' }}
      />
      <div style={{ position: 'absolute', right: -30, top: '25%', fontSize: 11, color: '#52c41a' }}>
        True
      </div>
      
      <Handle
        type="source"
        position={Position.Right}
        id="false"
        style={{ top: '70%', background: '#ff4d4f' }}
      />
      <div style={{ position: 'absolute', right: -30, top: '65%', fontSize: 11, color: '#ff4d4f' }}>
        False
      </div>
    </div>
  )
}

export default memo(ConditionNode)