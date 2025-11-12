/**
 * 已废弃 - OnlyOffice编辑器组件
 * 由于OnlyOffice服务不稳定，已替换为ReactQuill富文本编辑器
 * 保留此文件以防需要回滚
 */

import React from 'react';
import { Alert } from 'antd';

interface DocxEditorProps {
  documentId: string;
  height?: string;
}

const DocxEditor: React.FC<DocxEditorProps> = () => {
  return (
    <div style={{ padding: 24 }}>
      <Alert
        message="编辑器已更新"
        description="OnlyOffice编辑器已被ReactQuill富文本编辑器替代，请使用新的模板编辑器。"
        type="warning"
        showIcon
      />
    </div>
  );
};

export default DocxEditor;
