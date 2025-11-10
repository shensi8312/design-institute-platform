import React, { useState } from 'react';
import {
  Upload,
  Button,
  Card,
  Steps,
  message,
  Row,
  Col,
  List,
  Tag,
  Progress,
  Image
} from 'antd';
import {
  InboxOutlined,
  DiffOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import axios from '../utils/axios';

const { Dragger } = Upload;

interface Difference {
  id: number;
  category: string;
  location: { x: number; y: number; width: number; height: number };
  description: string;
  detail: string;
  severity: 'low' | 'medium' | 'high';
}

const DrawingComparison: React.FC = () => {
  const [v1File, setV1File] = useState<UploadFile | null>(null);
  const [v2File, setV2File] = useState<UploadFile | null>(null);
  const [comparing, setComparing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [differences, setDifferences] = useState<Difference[]>([]);
  const [annotatedImageUrl, setAnnotatedImageUrl] = useState('');

  // 文件上传配置
  const uploadProps = {
    maxCount: 1,
    accept: '.pdf,.png,.jpg,.jpeg',
    beforeUpload: (file: File) => {
      const isValidType = ['application/pdf', 'image/png', 'image/jpeg'].includes(file.type);
      if (!isValidType) {
        message.error('只支持 PDF、PNG、JPG 格式！');
        return false;
      }
      const isValidSize = file.size / 1024 / 1024 < 50;
      if (!isValidSize) {
        message.error('文件必须小于 50MB！');
        return false;
      }
      return false; // 阻止自动上传
    }
  };

  // 开始比对
  const handleCompare = async () => {
    if (!v1File || !v2File) {
      message.warning('请上传V1和V2两个文件');
      return;
    }

    setComparing(true);
    setProgress(0);
    setCurrentStep('上传文件中...');

    try {
      // 创建FormData - 使用 originFileObj 获取原始 File 对象
      const formData = new FormData();
      formData.append('v1File', v1File.originFileObj as File);
      formData.append('v2File', v2File.originFileObj as File);

      // 调用后端API
      const response = await axios.post('/api/drawing-comparison/compare', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        const { taskId } = response.data.data;

        // 轮询任务状态
        pollTaskStatus(taskId);
      } else {
        throw new Error(response.data.message);
      }
    } catch (error: any) {
      message.error(`比对失败: ${error.message}`);
      setComparing(false);
    }
  };

  // 轮询任务状态（临时方案，后续改为WebSocket）
  const pollTaskStatus = (taskId: string) => {
    const timer = setInterval(async () => {
      try {
        const response = await axios.get(`/api/drawing-comparison/status/${taskId}`);

        if (response.data.success) {
          const { status, progress: p, currentStep: step } = response.data.data;
          setProgress(p);
          setCurrentStep(step || '');

          if (status === 'completed') {
            clearInterval(timer);
            fetchResult(taskId);
          } else if (status === 'failed') {
            clearInterval(timer);
            message.error(response.data.data.message || '比对失败');
            setComparing(false);
          }
        }
      } catch (error) {
        console.error('获取状态失败:', error);
      }
    }, 2000);
  };

  // 获取结果
  const fetchResult = async (taskId: string) => {
    try {
      const response = await axios.get(`/api/drawing-comparison/result/${taskId}`);

      if (response.data.success) {
        setDifferences(response.data.data.differences);
        setAnnotatedImageUrl(response.data.data.annotatedImageUrl);
        message.success(`比对完成！发现 ${response.data.data.summary.totalDifferences} 处差异`);
      }
    } catch (error: any) {
      message.error(`获取结果失败: ${error.message}`);
    } finally {
      setComparing(false);
    }
  };

  // 严重程度颜色
  const getSeverityColor = (severity: string) => {
    const colors = {
      low: 'green',
      medium: 'orange',
      high: 'red'
    };
    return colors[severity as keyof typeof colors] || 'default';
  };

  // 类别颜色
  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      '尺寸变更': 'red',
      '标注修改': 'orange',
      '新增元素': 'green',
      '删除元素': 'blue',
      '形状变化': 'purple',
      '视觉差异': 'default'
    };
    return colors[category] || 'default';
  };

  return (
    <div style={{ padding: '24px' }}>
      <h2>图纸比对</h2>

      <Row gutter={24}>
        {/* 左侧：操作区 */}
        <Col span={6}>
          <Card title="文件上传" size="small">
            <div style={{ marginBottom: 16 }}>
              <p style={{ marginBottom: 8, fontWeight: 'bold' }}>旧版本 V1.0</p>
              <Dragger
                {...uploadProps}
                onChange={({ fileList }) => setV1File(fileList[0])}
                fileList={v1File ? [v1File] : []}
              >
                <p className="ant-upload-drag-icon">
                  <InboxOutlined />
                </p>
                <p className="ant-upload-text">点击或拖拽上传</p>
                <p className="ant-upload-hint">支持 PDF/PNG/JPG，最大 50MB</p>
              </Dragger>
            </div>

            <div style={{ marginBottom: 16 }}>
              <p style={{ marginBottom: 8, fontWeight: 'bold' }}>新版本 V2.0</p>
              <Dragger
                {...uploadProps}
                onChange={({ fileList }) => setV2File(fileList[0])}
                fileList={v2File ? [v2File] : []}
              >
                <p className="ant-upload-drag-icon">
                  <InboxOutlined />
                </p>
                <p className="ant-upload-text">点击或拖拽上传</p>
                <p className="ant-upload-hint">支持 PDF/PNG/JPG，最大 50MB</p>
              </Dragger>
            </div>

            <Button
              type="primary"
              icon={<DiffOutlined />}
              block
              size="large"
              onClick={handleCompare}
              disabled={!v1File || !v2File || comparing}
              loading={comparing}
            >
              开始比对
            </Button>
          </Card>

          {comparing && (
            <Card title="处理进度" size="small" style={{ marginTop: 16 }}>
              <Progress percent={progress} status="active" />
              <p style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                {currentStep}
              </p>
              <Steps
                direction="vertical"
                size="small"
                current={Math.floor(progress / 25)}
                items={[
                  { title: '上传文件' },
                  { title: '图像处理' },
                  { title: 'AI分析中' },
                  { title: '生成结果' }
                ]}
              />
            </Card>
          )}
        </Col>

        {/* 中间：画布区 */}
        <Col span={12}>
          <Card
            title="比对结果"
            size="small"
            extra={
              annotatedImageUrl && (
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => window.open(annotatedImageUrl)}
                >
                  导出报告
                </Button>
              )
            }
          >
            {annotatedImageUrl ? (
              <div style={{ textAlign: 'center' }}>
                <Image
                  src={annotatedImageUrl}
                  alt="标注图"
                  style={{ maxWidth: '100%', height: 'auto' }}
                  preview={{
                    mask: '点击预览大图'
                  }}
                />
              </div>
            ) : (
              <div
                style={{
                  height: 500,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#f5f5f5',
                  borderRadius: 4
                }}
              >
                <div style={{ textAlign: 'center', color: '#999' }}>
                  <DiffOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                  <p>上传文件并点击"开始比对"查看结果</p>
                </div>
              </div>
            )}
          </Card>
        </Col>

        {/* 右侧：差异列表 */}
        <Col span={6}>
          <Card
            title={`发现 ${differences.length} 处差异`}
            size="small"
          >
            {differences.length > 0 ? (
              <List
                dataSource={differences}
                renderItem={(item) => (
                  <List.Item style={{ padding: '8px 0' }}>
                    <Card size="small" style={{ width: '100%' }}>
                      <div style={{ marginBottom: 8 }}>
                        <Tag color="blue">#{item.id}</Tag>
                        <Tag color={getCategoryColor(item.category)}>
                          {item.category}
                        </Tag>
                        <Tag color={getSeverityColor(item.severity)}>
                          {item.severity === 'low' && '细微'}
                          {item.severity === 'medium' && '中等'}
                          {item.severity === 'high' && '重大'}
                        </Tag>
                      </div>
                      <p style={{ fontWeight: 'bold', marginBottom: 4, fontSize: 13 }}>
                        {item.description}
                      </p>
                      {item.detail && (
                        <p style={{ fontSize: 12, color: '#666', margin: 0 }}>
                          {item.detail}
                        </p>
                      )}
                    </Card>
                  </List.Item>
                )}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                <p>暂无差异数据</p>
                <p style={{ fontSize: 12 }}>完成比对后将在此显示</p>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DrawingComparison;
