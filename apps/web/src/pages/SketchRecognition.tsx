import React, { useState } from 'react';
import { Card, Upload, Button, Space, message, Steps, Image, Spin, Result } from 'antd';
import { UploadOutlined, ScanOutlined, ApiOutlined, CodeSandboxOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';

const { Step } = Steps;

const SketchRecognition: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<UploadFile | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleUpload = (file: any) => {
    setUploadedFile(file);
    message.success('草图上传成功');
    setCurrentStep(1);
    return false; // Prevent auto upload
  };

  const processSketch = async () => {
    setProcessing(true);
    setCurrentStep(2);
    
    // Simulate processing
    setTimeout(() => {
      setResult({
        recognition: {
          lines: 10,
          shapes: 5,
          text: 2
        },
        extraction: {
          walls: 10,
          doors: 2,
          windows: 3,
          rooms: 4
        },
        model3D: {
          vertices: 240,
          faces: 180
        },
        skpFile: '/tmp/model_generated.skp'
      });
      setProcessing(false);
      setCurrentStep(3);
    }, 3000);
  };

  return (
    <div style={{ padding: 24 }}>
      <Card 
        title={
          <Space>
            <ScanOutlined style={{ fontSize: 24, color: '#1890ff' }} />
            <span>草图识别与3D建模</span>
          </Space>
        }
      >
        <Steps current={currentStep} style={{ marginBottom: 32 }}>
          <Step title="上传草图" icon={<UploadOutlined />} />
          <Step title="图像识别" icon={<ScanOutlined />} />
          <Step title="3D转换" icon={<ApiOutlined />} />
          <Step title="生成模型" icon={<CodeSandboxOutlined />} />
        </Steps>

        {currentStep === 0 && (
          <Upload.Dragger
            accept="image/*"
            beforeUpload={handleUpload}
            showUploadList={false}
          >
            <p className="ant-upload-drag-icon">
              <UploadOutlined style={{ fontSize: 48, color: '#1890ff' }} />
            </p>
            <p className="ant-upload-text">点击或拖拽上传建筑草图</p>
            <p className="ant-upload-hint">支持 JPG, PNG, PDF 格式</p>
          </Upload.Dragger>
        )}

        {currentStep === 1 && uploadedFile && (
          <div style={{ textAlign: 'center' }}>
            <Image
              width={400}
              src={uploadedFile.thumbUrl || uploadedFile.url}
              placeholder={<Spin />}
            />
            <div style={{ marginTop: 24 }}>
              <Button type="primary" size="large" onClick={processSketch}>
                开始识别处理
              </Button>
            </div>
          </div>
        )}

        {currentStep === 2 && processing && (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Spin size="large" />
            <p style={{ marginTop: 24 }}>正在处理...</p>
            <p>OCR文字识别 → YOLO目标检测 → 线条提取 → 3D建模</p>
          </div>
        )}

        {currentStep === 3 && result && (
          <Result
            status="success"
            title="处理完成！"
            subTitle={`已生成3D模型: ${result.skpFile}`}
            extra={[
              <Button type="primary" key="download">
                下载 SKP 文件
              </Button>,
              <Button key="view">查看3D预览</Button>,
            ]}
          >
            <div style={{ background: '#f0f0f0', padding: 16, borderRadius: 8 }}>
              <h4>处理结果统计：</h4>
              <Space direction="vertical">
                <span>识别: {result.recognition.lines} 条线, {result.recognition.shapes} 个形状</span>
                <span>提取: {result.extraction.walls} 面墙, {result.extraction.doors} 个门, {result.extraction.windows} 个窗</span>
                <span>3D模型: {result.model3D.vertices} 个顶点, {result.model3D.faces} 个面</span>
              </Space>
            </div>
          </Result>
        )}
      </Card>
    </div>
  );
};

export default SketchRecognition;