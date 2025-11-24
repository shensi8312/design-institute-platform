/**
 * 纯前端的 Word (docx) 预览组件
 * 当 OnlyOffice 不可用时，用于保留 Word 样式并给用户兜底体验
 */

import React, { useEffect, useRef, useState } from 'react';
import { Alert, Spin, Button } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { renderAsync } from 'docx-preview';

interface DocxPreviewProps {
  fileUrl: string;
  height?: string;
  fileName?: string;
}

const DocxPreview: React.FC<DocxPreviewProps> = ({ fileUrl, height = '100%' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;

    const loadDocx = async () => {
      if (!fileUrl) {
        setError('未找到可预览的 Word 文件');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(fileUrl);
        if (!response.ok) {
          throw new Error(`加载文档失败: ${response.status}`);
        }
        const buffer = await response.arrayBuffer();

        if (canceled || !containerRef.current) {
          return;
        }

        // 验证文件是否为空
        if (buffer.byteLength === 0) {
          throw new Error('文档文件为空');
        }

        // 清空之前的渲染内容
        containerRef.current.innerHTML = '';

        await renderAsync(buffer, containerRef.current, undefined, {
          className: 'docx-preview',
          inWrapper: true,
          ignoreHeight: false,
          experimental: true
        });
      } catch (err: any) {
        console.error('❌ Word 预览失败:', err);

        // 更详细的错误信息
        let errorMessage = '无法渲染 Word 文档';
        if (err.message.includes('body')) {
          errorMessage = 'Word 文档格式不受支持或文件已损坏。建议下载后使用 Microsoft Word 或 WPS 打开。';
        } else if (err.message.includes('404')) {
          errorMessage = '文档文件不存在';
        } else if (err.message.includes('403')) {
          errorMessage = '没有权限访问该文档';
        } else {
          errorMessage = err.message || errorMessage;
        }

        setError(errorMessage);
      } finally {
        if (!canceled) {
          setLoading(false);
        }
      }
    };

    loadDocx();

    return () => {
      canceled = true;
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [fileUrl]);

  return (
    <div style={{ height, width: '100%', position: 'relative' }}>
      {loading && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255, 255, 255, 0.9)',
          zIndex: 10
        }}>
          <Spin size="large" tip="正在渲染 Word 文档..." />
        </div>
      )}

      {error && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message="Word 预览失败"
          description={error}
        />
      )}

      <div
        ref={containerRef}
        style={{
          height: '100%',
          overflow: 'auto',
          background: '#f5f5f5',
          padding: '24px 0'
        }}
      />
    </div>
  );
};

export default DocxPreview;
