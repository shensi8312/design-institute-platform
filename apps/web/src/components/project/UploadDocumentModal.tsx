import React, { useState } from 'react'
import { Modal, Form, Input, Select, Upload, message } from 'antd'
import { InboxOutlined } from '@ant-design/icons'
import type { UploadProps } from 'antd'
import axios from '../../utils/axios'
import type { DocumentType } from '../../types/document'

interface UploadDocumentModalProps {
  visible: boolean
  projectId: string
  documentType: DocumentType
  onCancel: () => void
  onSuccess: () => void
}

const { Dragger } = Upload
const { Option } = Select

const UploadDocumentModal: React.FC<UploadDocumentModalProps> = ({
  visible,
  projectId,
  documentType,
  onCancel,
  onSuccess
}) => {
  const [form] = Form.useForm()
  const [uploading, setUploading] = useState(false)
  const [fileList, setFileList] = useState<any[]>([])

  const handleUpload = async () => {
    try {
      const values = await form.validateFields()

      if (fileList.length === 0) {
        message.error('请选择要上传的文件')
        return
      }

      setUploading(true)

      const formData = new FormData()
      formData.append('file', fileList[0].originFileObj)
      formData.append('title', values.title)
      formData.append('document_type', documentType)
      if (values.document_subtype) {
        formData.append('document_subtype', values.document_subtype)
      }
      if (values.responsible_department) {
        formData.append('responsible_department', values.responsible_department)
      }

      const response = await axios.post(
        `/api/projects/${projectId}/documents/upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      )

      if (response.data.success) {
        message.success('文档上传成功')
        form.resetFields()
        setFileList([])
        onSuccess()
      } else {
        message.error(response.data.message || '上传失败')
      }
    } catch (error: any) {
      console.error('上传文档失败:', error)
      message.error(error.response?.data?.message || '上传文档失败')
    } finally {
      setUploading(false)
    }
  }

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    fileList: fileList,
    beforeUpload: (file) => {
      const isValidType = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar)$/i.test(file.name)
      if (!isValidType) {
        message.error('只支持 PDF、Word、Excel、PPT、ZIP、RAR 格式文件')
        return Upload.LIST_IGNORE
      }
      const isLt50M = file.size / 1024 / 1024 < 50
      if (!isLt50M) {
        message.error('文件大小不能超过 50MB')
        return Upload.LIST_IGNORE
      }
      // 🔧 修复：正确保存文件对象，包含 originFileObj
      setFileList([{
        uid: file.uid,
        name: file.name,
        status: 'done',
        originFileObj: file
      }])
      return false  // 阻止自动上传，由手动上传
    },
    onRemove: () => {
      setFileList([])
    }
  }

  const handleCancel = () => {
    form.resetFields()
    setFileList([])
    onCancel()
  }

  const documentSubtypeOptions = {
    contract: [
      { value: 'draft', label: '初稿' },
      { value: 'final', label: '终稿' },
      { value: 'amendment', label: '补充协议' }
    ],
    bidding_doc: [
      { value: 'tech', label: '技术标' },
      { value: 'commercial', label: '商务标' }
    ],
    our_bid: [
      { value: 'tech', label: '技术标' },
      { value: 'commercial', label: '商务标' }
    ],
    competitor_bid: [],
    evaluation: [],
    other: []
  }

  return (
    <Modal
      title="上传文档"
      open={visible}
      onOk={handleUpload}
      onCancel={handleCancel}
      confirmLoading={uploading}
      okText="上传"
      cancelText="取消"
      width={600}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          document_type: documentType
        }}
      >
        <Form.Item
          name="title"
          label="文档标题"
          rules={[{ required: true, message: '请输入文档标题' }]}
        >
          <Input placeholder="请输入文档标题" />
        </Form.Item>

        {documentSubtypeOptions[documentType].length > 0 && (
          <Form.Item
            name="document_subtype"
            label="文档子类型"
          >
            <Select placeholder="请选择文档子类型" allowClear>
              {documentSubtypeOptions[documentType].map(option => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
        )}

        <Form.Item
          name="responsible_department"
          label="负责部门"
        >
          <Input placeholder="请输入负责部门" />
        </Form.Item>

        <Form.Item
          label="选择文件"
          required
        >
          <Dragger {...uploadProps}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
            <p className="ant-upload-hint">
              支持 PDF、Word、Excel、PPT、ZIP、RAR 格式，文件大小不超过 50MB
            </p>
          </Dragger>
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default UploadDocumentModal
