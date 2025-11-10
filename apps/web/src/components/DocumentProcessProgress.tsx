import React, { useEffect, useState, useRef } from 'react';
import { Progress, Steps, Card, Tag, Space, Typography, List, Badge } from 'antd';
import {
  LoadingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';

const { Step } = Steps;
const { Text } = Typography;

interface ProcessStep {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: any;
  error?: string;
}

interface ProcessInfo {
  processId: string;
  documentId: string;
  documentName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  steps: {
    recognition: ProcessStep;
    vectorization: ProcessStep;
    graphExtraction: ProcessStep;
  };
  results?: {
    textExtracted: boolean;
    textLength: number;
    vectorized: boolean;
    entitiesExtracted: number;
    relationsExtracted: number;
  };
  timestamp?: string;
  duration?: number;
}

interface DocumentProcessProgressProps {
  documentId?: string;
  onComplete?: (results: any) => void;
  userId: string;
}

const DocumentProcessProgress: React.FC<DocumentProcessProgressProps> = ({
  documentId,
  onComplete,
  userId
}) => {
  const [processes, setProcesses] = useState<Map<string, ProcessInfo>>(new Map());
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // 建立WebSocket连接
    const ws = new WebSocket(`ws://${window.location.host}/ws/document-process?userId=${userId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket连接已建立');
      setConnected(true);
      
      // 如果有documentId，订阅该文档
      if (documentId) {
        ws.send(JSON.stringify({
          type: 'subscribe',
          documentId
        }));
      }
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleWebSocketMessage(message);
    };

    ws.onerror = (error) => {
      console.error('WebSocket错误:', error);
      setConnected(false);
    };

    ws.onclose = () => {
      console.log('WebSocket连接已关闭');
      setConnected(false);
    };

    // 清理函数
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [documentId, userId]);

  const handleWebSocketMessage = (message: any) => {
    switch (message.type) {
      case 'process:start':
        {
          const newProcess: ProcessInfo = {
            processId: message.processId,
            documentId: message.documentId,
            documentName: message.documentName,
            status: 'processing',
            steps: {
              recognition: { status: 'pending' },
              vectorization: { status: 'pending' },
              graphExtraction: { status: 'pending' }
            },
            timestamp: message.timestamp
          };
          
          setProcesses(prev => {
            const updated = new Map(prev);
            updated.set(message.processId, newProcess);
            return updated;
          });
        }
        break;

      case 'step:start':
        updateProcessStep(message.processId, message.step, 'processing');
        break;

      case 'step:complete':
        updateProcessStep(message.processId, message.step, 'completed', message.result);
        break;

      case 'process:complete':
        {
          setProcesses(prev => {
            const updated = new Map(prev);
            const process = updated.get(message.processId);
            if (process) {
              process.status = 'completed';
              process.results = message.results;
              process.duration = message.duration;
              updated.set(message.processId, process);
              
              // 触发完成回调
              if (onComplete) {
                onComplete(message.results);
              }
            }
            return updated;
          });
        }
        break;

      case 'process:error':
        {
          setProcesses(prev => {
            const updated = new Map(prev);
            const process = updated.get(message.processId);
            if (process) {
              process.status = 'failed';
              updated.set(message.processId, process);
            }
            return updated;
          });
        }
        break;
    }
  };

  const updateProcessStep = (
    processId: string, 
    step: string, 
    status: ProcessStep['status'], 
    result?: any
  ) => {
    setProcesses(prev => {
      const updated = new Map(prev);
      const process = updated.get(processId);
      if (process && process.steps[step as keyof typeof process.steps]) {
        process.steps[step as keyof typeof process.steps] = { status, result };
        updated.set(processId, process);
      }
      return updated;
    });
  };

  const getStepStatus = (step: ProcessStep) => {
    switch (step.status) {
      case 'completed':
        return 'finish';
      case 'processing':
        return 'process';
      case 'failed':
        return 'error';
      default:
        return 'wait';
    }
  };

  const getStepIcon = (step: ProcessStep) => {
    switch (step.status) {
      case 'completed':
        return <CheckCircleOutlined />;
      case 'processing':
        return <LoadingOutlined />;
      case 'failed':
        return <CloseCircleOutlined />;
      default:
        return <ClockCircleOutlined />;
    }
  };

  const calculateProgress = (process: ProcessInfo) => {
    let completed = 0;
    const total = 3;
    
    if (process.steps.recognition.status === 'completed') completed++;
    if (process.steps.vectorization.status === 'completed') completed++;
    if (process.steps.graphExtraction.status === 'completed') completed++;
    
    return Math.round((completed / total) * 100);
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}分${remainingSeconds}秒`;
    }
    return `${seconds}秒`;
  };

  const activeProcesses = Array.from(processes.values()).filter(
    p => p.status === 'processing'
  );

  const recentProcesses = Array.from(processes.values())
    .filter(p => p.status === 'completed' || p.status === 'failed')
    .slice(-5);

  return (
    <div>
      {/* 连接状态 */}
      <div style={{ marginBottom: 16 }}>
        <Badge 
          status={connected ? 'success' : 'error'} 
          text={connected ? '实时处理服务已连接' : '实时处理服务未连接'} 
        />
      </div>

      {/* 当前处理中的文档 */}
      {activeProcesses.length > 0 && (
        <Card title="正在处理" style={{ marginBottom: 16 }}>
          {activeProcesses.map(process => (
            <div key={process.processId} style={{ marginBottom: 24 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <FileTextOutlined /> <Text strong>{process.documentName}</Text>
                  <Progress 
                    percent={calculateProgress(process)} 
                    status="active"
                    style={{ marginTop: 8 }}
                  />
                </div>
                
                <Steps size="small" current={-1}>
                  <Step 
                    title="文档识别" 
                    status={getStepStatus(process.steps.recognition)}
                    icon={getStepIcon(process.steps.recognition)}
                    description={
                      process.steps.recognition.result?.textLength 
                        ? `提取 ${process.steps.recognition.result.textLength} 字符`
                        : undefined
                    }
                  />
                  <Step 
                    title="向量化" 
                    status={getStepStatus(process.steps.vectorization)}
                    icon={getStepIcon(process.steps.vectorization)}
                    description={
                      process.steps.vectorization.result?.vectorCount
                        ? `生成 ${process.steps.vectorization.result.vectorCount} 个向量`
                        : undefined
                    }
                  />
                  <Step 
                    title="知识图谱" 
                    status={getStepStatus(process.steps.graphExtraction)}
                    icon={getStepIcon(process.steps.graphExtraction)}
                    description={
                      process.steps.graphExtraction.result?.entityCount
                        ? `提取 ${process.steps.graphExtraction.result.entityCount} 个实体`
                        : undefined
                    }
                  />
                </Steps>
              </Space>
            </div>
          ))}
        </Card>
      )}

      {/* 最近完成的处理 */}
      {recentProcesses.length > 0 && (
        <Card title="处理历史" size="small">
          <List
            size="small"
            dataSource={recentProcesses}
            renderItem={process => (
              <List.Item>
                <Space>
                  {process.status === 'completed' ? (
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  ) : (
                    <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                  )}
                  <Text>{process.documentName}</Text>
                  {process.results && (
                    <Space size="small">
                      <Tag color="blue">
                        {process.results.textLength} 字符
                      </Tag>
                      <Tag color="green">
                        {process.results.entitiesExtracted} 实体
                      </Tag>
                      <Tag color="purple">
                        {process.results.relationsExtracted} 关系
                      </Tag>
                    </Space>
                  )}
                  {process.duration && (
                    <Text type="secondary">
                      耗时: {formatDuration(process.duration)}
                    </Text>
                  )}
                </Space>
              </List.Item>
            )}
          />
        </Card>
      )}
    </div>
  );
};

export default DocumentProcessProgress;
