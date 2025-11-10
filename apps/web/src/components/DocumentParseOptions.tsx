import React from 'react';
import { Form, Select, Switch, Radio, InputNumber, Tooltip } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';

const { Option } = Select;

interface DocumentParseOptionsProps {
  fileType?: string;
}

const DocumentParseOptions: React.FC<DocumentParseOptionsProps> = ({ fileType }) => {
  // 根据文件类型提供不同的解析选项
  const getParseStrategyOptions = () => {
    if (fileType?.includes('ifc') || fileType?.includes('rvt')) {
      return (
        <>
          <Option value="bim_basic">基础解析（提取基本信息）</Option>
          <Option value="bim_detailed">详细解析（含构件信息）</Option>
          <Option value="bim_full">完整解析（含材料和属性）</Option>
        </>
      );
    } else if (fileType?.includes('dwg') || fileType?.includes('dxf')) {
      return (
        <>
          <Option value="cad_basic">基础解析（图层信息）</Option>
          <Option value="cad_ocr">OCR识别（提取文字标注）</Option>
          <Option value="cad_full">完整解析（含图元分析）</Option>
        </>
      );
    } else if (fileType?.includes('pdf')) {
      return (
        <>
          <Option value="pdf_text">文本提取</Option>
          <Option value="pdf_ocr">OCR识别</Option>
          <Option value="pdf_layout">保留布局</Option>
          <Option value="pdf_table">表格提取</Option>
        </>
      );
    } else {
      return (
        <>
          <Option value="auto">自动选择</Option>
          <Option value="text">纯文本</Option>
          <Option value="structured">结构化解析</Option>
        </>
      );
    }
  };

  return (
    <>
      <Form.Item
        name="parse_strategy"
        label={
          <span>
            解析策略&nbsp;
            <Tooltip title="选择适合文档类型的解析策略">
              <QuestionCircleOutlined />
            </Tooltip>
          </span>
        }
        initialValue="auto"
      >
        <Select placeholder="选择解析策略">
          {getParseStrategyOptions()}
        </Select>
      </Form.Item>

      <Form.Item
        name="chunk_strategy"
        label={
          <span>
            切片策略&nbsp;
            <Tooltip title="文档切片方式影响检索精度">
              <QuestionCircleOutlined />
            </Tooltip>
          </span>
        }
        initialValue="auto"
      >
        <Radio.Group>
          <Radio value="auto">自动</Radio>
          <Radio value="paragraph">按段落</Radio>
          <Radio value="page">按页</Radio>
          <Radio value="sentence">按句</Radio>
          <Radio value="custom">自定义</Radio>
        </Radio.Group>
      </Form.Item>

      <Form.Item
        noStyle
        shouldUpdate={(prevValues, currentValues) => 
          prevValues.chunk_strategy !== currentValues.chunk_strategy
        }
      >
        {({ getFieldValue }) =>
          getFieldValue('chunk_strategy') === 'custom' ? (
            <Form.Item
              name="chunk_size"
              label="切片大小"
              initialValue={512}
            >
              <InputNumber min={100} max={2000} step={100} addonAfter="字符" />
            </Form.Item>
          ) : null
        }
      </Form.Item>

      <Form.Item
        name="enable_ocr"
        label={
          <span>
            启用OCR&nbsp;
            <Tooltip title="对扫描文档启用文字识别">
              <QuestionCircleOutlined />
            </Tooltip>
          </span>
        }
        valuePropName="checked"
        initialValue={false}
      >
        <Switch />
      </Form.Item>

      <Form.Item
        name="extract_entities"
        label={
          <span>
            实体提取&nbsp;
            <Tooltip title="自动识别人名、地名、项目名等实体">
              <QuestionCircleOutlined />
            </Tooltip>
          </span>
        }
        valuePropName="checked"
        initialValue={true}
      >
        <Switch />
      </Form.Item>

      <Form.Item
        name="build_graph"
        label={
          <span>
            构建知识图谱&nbsp;
            <Tooltip title="提取实体关系构建知识图谱">
              <QuestionCircleOutlined />
            </Tooltip>
          </span>
        }
        valuePropName="checked"
        initialValue={true}
      >
        <Switch />
      </Form.Item>

      {/* 建筑领域特殊选项 */}
      {(fileType?.includes('ifc') || fileType?.includes('rvt') || fileType?.includes('dwg')) && (
        <>
          <Form.Item
            name="extract_specifications"
            label={
              <span>
                规范检查&nbsp;
                <Tooltip title="检查是否符合建筑规范">
                  <QuestionCircleOutlined />
                </Tooltip>
              </span>
            }
            valuePropName="checked"
            initialValue={false}
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="calculate_quantities"
            label={
              <span>
                工程量计算&nbsp;
                <Tooltip title="自动计算工程量">
                  <QuestionCircleOutlined />
                </Tooltip>
              </span>
            }
            valuePropName="checked"
            initialValue={false}
          >
            <Switch />
          </Form.Item>
        </>
      )}
    </>
  );
};

export default DocumentParseOptions;