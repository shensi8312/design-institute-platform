/**
 * OnlyOffice文档编辑器组件 - 使用iframe隔离避免RequireJS冲突
 */

import React, { useEffect, useRef, useState } from 'react';
import { Spin } from 'antd';

interface DocxEditorProps {
  documentId: string;
  height?: string;
}

const DocxEditor: React.FC<DocxEditorProps> = ({
  documentId,
  height = '100vh'
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token') || '';
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

    const iframeUrl = `/onlyoffice-editor.html?documentId=${encodeURIComponent(documentId)}&apiUrl=${encodeURIComponent(apiUrl)}&token=${encodeURIComponent(token)}`;

    console.log('🔧 DocxEditor iframe URL:', iframeUrl);

    if (iframeRef.current) {
      iframeRef.current.src = iframeUrl;
    }

    const timeout = setTimeout(() => {
      if (loading) {
        console.log('⏱️ 加载超时，移除加载提示');
        setLoading(false);
      }
    }, 15000);

    return () => clearTimeout(timeout);
  }, [documentId]);

  return (
    <div style={{ position: 'relative', height, width: '100%' }}>
      {loading && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          zIndex: 1000
        }}>
          <Spin size="large" tip="加载OnlyOffice编辑器..." />
        </div>
      )}
      <iframe
        ref={iframeRef}
        style={{
          width: '100%',
          height: '100%',
          border: 'none'
        }}
        title="OnlyOffice编辑器"
        onLoad={() => {
          console.log('✅ iframe加载完成');
          setLoading(false);
        }}
      />
    </div>
  );
};

export default DocxEditor;
