import React, { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { Highlight } from '@tiptap/extension-highlight'
import { TextAlign } from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { Image } from '@tiptap/extension-image'
import { Spin, Alert } from 'antd'
import './TiptapDocumentViewer.css'

interface TiptapDocumentViewerProps {
  content: string
  loading?: boolean
  error?: string | null
}

const TiptapDocumentViewer: React.FC<TiptapDocumentViewerProps> = ({
  content,
  loading = false,
  error = null
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Highlight,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TextStyle,
      Color,
      Image,
    ],
    content: content,
    editable: false, // 只读模式
    editorProps: {
      attributes: {
        class: 'tiptap-viewer',
      },
    },
  })

  useEffect(() => {
    if (editor && content) {
      editor.commands.setContent(content)
    }
  }, [editor, content])

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" tip="加载文档中..." />
      </div>
    )
  }

  if (error) {
    return (
      <Alert
        type="error"
        message="文档加载失败"
        description={error}
        showIcon
      />
    )
  }

  return (
    <div className="tiptap-document-viewer">
      <EditorContent editor={editor} />
    </div>
  )
}

export default TiptapDocumentViewer
