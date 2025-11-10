import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Spin, message } from 'antd';
import axios from '../utils/axios';
import ThreeModelViewer from '../components/ThreeModelViewer';

const DocumentPreview: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [fileUrl, setFileUrl] = useState('');
  const [fileType, setFileType] = useState('');

  useEffect(() => {
    // 禁用右键菜单
    const disableRightClick = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    // 禁用复制
    const disableCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      return false;
    };

    // 禁用选择文本
    const disableSelect = (e: Event) => {
      e.preventDefault();
      return false;
    };

    // 禁用快捷键 (Ctrl+C, Ctrl+A, Ctrl+S, Ctrl+P等)
    const disableShortcuts = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (['c', 'a', 's', 'p', 'u'].includes(key)) {
          e.preventDefault();
          return false;
        }
      }
      // 禁用F12开发者工具
      if (e.key === 'F12') {
        e.preventDefault();
        return false;
      }
    };

    // 添加事件监听
    document.addEventListener('contextmenu', disableRightClick);
    document.addEventListener('copy', disableCopy);
    document.addEventListener('selectstart', disableSelect);
    document.addEventListener('keydown', disableShortcuts);

    // 获取文档信息
    fetchDocument();

    // 清理事件监听
    return () => {
      document.removeEventListener('contextmenu', disableRightClick);
      document.removeEventListener('copy', disableCopy);
      document.removeEventListener('selectstart', disableSelect);
      document.removeEventListener('keydown', disableShortcuts);
    };
  }, [id]);

  const fetchDocument = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/knowledge/documents/${id}/preview`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const blob = response.data;
      const url = URL.createObjectURL(blob);
      setFileUrl(url);

      // 从响应头获取文件类型
      const contentType = response.headers['content-type'] || '';
      setFileType(contentType);

      setLoading(false);
    } catch (error: any) {
      message.error('加载文档失败');
      setLoading(false);
    }
  };

  const renderPreview = () => {
    if (!fileUrl) return null;

    // 3D模型文件 (STL, OBJ, STEP)
    const model3DFormats = ['stl', 'obj', 'step', 'stp'];
    const fileExtension = fileUrl.split('.').pop()?.toLowerCase() || '';

    if (model3DFormats.includes(fileExtension)) {
      return (
        <div style={{ width: '100%', height: '100vh', background: '#f0f0f0' }}>
          <ThreeModelViewer
            modelUrl={fileUrl}
            modelFormat={fileExtension}
            onError={(err) => {
              console.error('3D模型加载错误:', err);
              message.error('3D模型加载失败');
            }}
          />
        </div>
      );
    }

    // PDF文件使用embed标签
    if (fileType.includes('pdf')) {
      return (
        <embed
          src={fileUrl}
          type="application/pdf"
          style={{
            width: '100%',
            height: '100vh',
            border: 'none'
          }}
        />
      );
    }

    // 图片文件
    if (fileType.startsWith('image/')) {
      return (
        <div
          style={{
            width: '100%',
            height: '100vh',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#f0f0f0',
            userSelect: 'none'
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <img
            src={fileUrl}
            alt="预览"
            style={{
              maxWidth: '90%',
              maxHeight: '90%',
              userSelect: 'none',
              pointerEvents: 'none'
            }}
            draggable={false}
          />
        </div>
      );
    }

    // 文本文件 (.txt)
    if (fileType.includes('text/plain')) {
      return (
        <div
          style={{
            width: '100%',
            height: '100vh',
            padding: '40px',
            backgroundColor: '#fff',
            overflow: 'auto'
          }}
        >
          <iframe
            src={fileUrl}
            style={{
              width: '100%',
              height: '100%',
              border: 'none'
            }}
            sandbox="allow-same-origin"
          />
        </div>
      );
    }

    // PPT文件 - 使用kkFileView在线预览
    if (
      fileType.includes('powerpoint') ||
      fileType.includes('ms-powerpoint') ||
      fileType.includes('.presentation') ||
      fileType.includes('application/vnd.ms-powerpoint') ||
      fileType.includes('application/vnd.openxmlformats-officedocument.presentationml.presentation')
    ) {
      // kkFileView预览服务地址
      const previewUrl = `/api/knowledge/documents/${id}/office-preview`;

      return (
        <iframe
          src={previewUrl}
          style={{
            width: '100%',
            height: '100vh',
            border: 'none'
          }}
          title="PowerPoint Viewer"
        />
      );
    }

    // 其他Office文件 - 使用后端预览服务
    if (
      fileType.includes('word') ||
      fileType.includes('excel') ||
      fileType.includes('officedocument') ||
      fileType.includes('ms-word') ||
      fileType.includes('ms-excel') ||
      fileType.includes('.sheet') ||
      fileType.includes('.document')
    ) {
      // 使用后端代理的预览服务
      const previewUrl = `/api/knowledge/documents/${id}/office-preview`;

      return (
        <iframe
          src={previewUrl}
          style={{
            width: '100%',
            height: '100vh',
            border: 'none'
          }}
          title="Office Document Viewer"
        />
      );
    }

    // 其他文件类型
    return (
      <div
        style={{
          width: '100%',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#f0f0f0'
        }}
      >
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <h2 style={{ marginBottom: '20px', color: '#666' }}>
            正在加载Office文档预览...
          </h2>
          <p style={{ color: '#999', marginBottom: '30px' }}>
            支持的预览格式: PDF、图片、TXT文本、Office文档(Word/Excel/PPT)
          </p>
          <p style={{ color: '#999', marginTop: '10px', fontSize: '12px' }}>
            文件类型: {fileType}
          </p>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div
        style={{
          width: '100%',
          height: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100vh',
        overflow: 'hidden',
        userSelect: 'none'
      }}
    >
      {/* 水印层 - 防止截图 */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: 'none',
          zIndex: 9999,
          background: `
            repeating-linear-gradient(
              45deg,
              transparent,
              transparent 200px,
              rgba(0, 0, 0, 0.02) 200px,
              rgba(0, 0, 0, 0.02) 400px
            )
          `
        }}
      />

      {/* 内容区 */}
      {renderPreview()}

      {/* CSS禁用选择和复制 */}
      <style>{`
        * {
          user-select: none !important;
          -webkit-user-select: none !important;
          -moz-user-select: none !important;
          -ms-user-select: none !important;
        }
      `}</style>
    </div>
  );
};

export default DocumentPreview;
