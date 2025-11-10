import React, { useState } from 'react';
import {
  Card,
  Form,
  Input,
  Select,
  DatePicker,
  Button,
  Space,
  Collapse,
  Tag,
  Slider,
  Row,
  Col,
  Checkbox
} from 'antd';
import {
  SearchOutlined,
  ClearOutlined,
  ThunderboltOutlined,
  ApartmentOutlined,
  FileSearchOutlined
} from '@ant-design/icons';

const { Panel } = Collapse;
const { RangePicker } = DatePicker;
const { Option } = Select;
const { CheckableTag } = Tag;

interface AdvancedSearchPanelProps {
  onSearch: (params: any) => void;
  onReset?: () => void;
}

const AdvancedSearchPanel: React.FC<AdvancedSearchPanelProps> = ({ onSearch, onReset }) => {
  const [form] = Form.useForm();
  const [searchMode, setSearchMode] = useState<'vector' | 'keyword' | 'hybrid'>('hybrid');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // 建筑领域常用标签
  const commonTags = [
    '施工图', '方案设计', '初步设计', '结构计算',
    '建筑规范', '消防设计', '给排水', '暖通空调',
    '电气设计', '幕墙设计', '景观设计', '室内设计',
    '工程量清单', '招标文件', '技术标准', 'BIM模型'
  ];

  // 文档类型
  const documentTypes = [
    { value: 'drawing', label: '图纸' },
    { value: 'specification', label: '规范' },
    { value: 'calculation', label: '计算书' },
    { value: 'report', label: '报告' },
    { value: 'contract', label: '合同' },
    { value: 'bim', label: 'BIM模型' },
    { value: 'photo', label: '现场照片' },
    { value: 'meeting', label: '会议纪要' }
  ];

  // 专业分类
  const disciplines = [
    { value: 'architecture', label: '建筑' },
    { value: 'structure', label: '结构' },
    { value: 'mep', label: '机电' },
    { value: 'hvac', label: '暖通' },
    { value: 'electrical', label: '电气' },
    { value: 'plumbing', label: '给排水' },
    { value: 'landscape', label: '景观' },
    { value: 'interior', label: '室内' }
  ];

  const handleSearch = () => {
    form.validateFields().then(values => {
      onSearch({
        ...values,
        searchMode,
        tags: selectedTags
      });
    });
  };

  const handleReset = () => {
    form.resetFields();
    setSelectedTags([]);
    setSearchMode('hybrid');
    onReset?.();
  };

  const handleTagChange = (tag: string, checked: boolean) => {
    const nextSelectedTags = checked
      ? [...selectedTags, tag]
      : selectedTags.filter(t => t !== tag);
    setSelectedTags(nextSelectedTags);
  };

  return (
    <Card>
      <Form form={form} layout="vertical">
        {/* 搜索模式选择 */}
        <Form.Item label="搜索模式">
          <Select
            value={searchMode}
            onChange={setSearchMode}
            style={{ width: '100%' }}
          >
            <Option value="hybrid">
              <Space>
                <ThunderboltOutlined />
                智能搜索（向量+关键词）
              </Space>
            </Option>
            <Option value="vector">
              <Space>
                <ApartmentOutlined />
                语义搜索（向量检索）
              </Space>
            </Option>
            <Option value="keyword">
              <Space>
                <FileSearchOutlined />
                关键词搜索（全文检索）
              </Space>
            </Option>
          </Select>
        </Form.Item>

        {/* 主搜索框 */}
        <Form.Item
          name="query"
          label="搜索内容"
          rules={[{ required: true, message: '请输入搜索内容' }]}
        >
          <Input.TextArea
            rows={3}
            placeholder="输入搜索内容，支持自然语言描述。例如：查找关于高层建筑消防设计的规范要求"
          />
        </Form.Item>

        <Collapse defaultActiveKey={['filters']}>
          <Panel header="高级筛选" key="filters">
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="documentTypes" label="文档类型">
                  <Select mode="multiple" placeholder="选择文档类型">
                    {documentTypes.map(type => (
                      <Option key={type.value} value={type.value}>
                        {type.label}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="disciplines" label="专业分类">
                  <Select mode="multiple" placeholder="选择专业">
                    {disciplines.map(d => (
                      <Option key={d.value} value={d.value}>
                        {d.label}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="project" label="项目名称">
                  <Input placeholder="输入项目名称" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="dateRange" label="时间范围">
                  <RangePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            {/* 相似度阈值（仅在向量搜索时显示） */}
            {(searchMode === 'vector' || searchMode === 'hybrid') && (
              <Form.Item name="similarity" label="相似度阈值" initialValue={0.7}>
                <Slider
                  min={0}
                  max={1}
                  step={0.1}
                  marks={{
                    0: '0',
                    0.5: '0.5',
                    1: '1'
                  }}
                />
              </Form.Item>
            )}

            {/* 标签选择 */}
            <Form.Item label="快速标签">
              <Space size={[0, 8]} wrap>
                {commonTags.map(tag => (
                  <CheckableTag
                    key={tag}
                    checked={selectedTags.indexOf(tag) > -1}
                    onChange={checked => handleTagChange(tag, checked)}
                  >
                    {tag}
                  </CheckableTag>
                ))}
              </Space>
            </Form.Item>

            {/* 搜索选项 */}
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="includeAttachments" valuePropName="checked">
                  <Checkbox>包含附件</Checkbox>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="includeComments" valuePropName="checked">
                  <Checkbox>包含批注</Checkbox>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="onlyMyDocs" valuePropName="checked">
                  <Checkbox>仅我的文档</Checkbox>
                </Form.Item>
              </Col>
            </Row>
          </Panel>

          <Panel header="建筑专业搜索" key="architectural">
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="buildingType" label="建筑类型">
                  <Select placeholder="选择建筑类型">
                    <Option value="residential">住宅</Option>
                    <Option value="commercial">商业</Option>
                    <Option value="office">办公</Option>
                    <Option value="industrial">工业</Option>
                    <Option value="educational">教育</Option>
                    <Option value="medical">医疗</Option>
                    <Option value="cultural">文化</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="designPhase" label="设计阶段">
                  <Select placeholder="选择设计阶段">
                    <Option value="concept">概念设计</Option>
                    <Option value="schematic">方案设计</Option>
                    <Option value="preliminary">初步设计</Option>
                    <Option value="construction">施工图设计</Option>
                    <Option value="completion">竣工图</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="buildingHeight" label="建筑高度">
                  <Select placeholder="选择高度范围">
                    <Option value="low">多层（≤24m）</Option>
                    <Option value="high">高层（24-100m）</Option>
                    <Option value="super">超高层（&gt;100m）</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="specifications" label="相关规范">
                  <Input placeholder="例如：GB50016-2014" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="material" label="主要材料">
                  <Select mode="tags" placeholder="输入材料名称">
                    <Option value="concrete">混凝土</Option>
                    <Option value="steel">钢结构</Option>
                    <Option value="wood">木结构</Option>
                    <Option value="glass">玻璃幕墙</Option>
                    <Option value="stone">石材</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          </Panel>
        </Collapse>

        {/* 操作按钮 */}
        <Form.Item style={{ marginTop: 16 }}>
          <Space>
            <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
              搜索
            </Button>
            <Button icon={<ClearOutlined />} onClick={handleReset}>
              重置
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default AdvancedSearchPanel;
