import React from 'react';
import { Card, Empty } from 'antd';
import { ExperimentOutlined } from '@ant-design/icons';

const ModelTraining: React.FC = () => {
  return (
    <div style={{ padding: 24 }}>
      <Card 
        title={
          <>
            <ExperimentOutlined /> 模型训练
          </>
        }
      >
        <Empty 
          description="模型训练功能开发中"
          style={{ padding: 60 }}
        />
      </Card>
    </div>
  );
};

export default ModelTraining;