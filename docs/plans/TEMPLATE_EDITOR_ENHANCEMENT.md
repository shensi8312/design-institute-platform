# Word模板编辑器功能增强方案

## 📋 需求分析

### 当前状态
- ✅ 模板管理页面：上传、列表、发布、删除功能完善
- ✅ 模板编辑器：使用OnlyOffice，但仅是单纯的Word编辑器
- ❌ **缺失**：左侧目录大纲、章节跳转、导出功能

### 用户需求
1. **左侧显示目录**：提取Word文档的大纲结构（标题层级）
2. **右侧编辑器**：保持Word原格式，可编辑
3. **目录交互**：点击目录项跳转到对应章节
4. **保存功能**：编辑后自动保存
5. **导出功能**：导出为Word文档

---

## 🏗️ 技术方案

### 架构设计

```
┌─────────────────────────────────────────────────┐
│          TemplateEditor (容器组件)                │
├──────────────────┬──────────────────────────────┤
│  左侧 (25%)      │      右侧 (75%)               │
│                  │                                │
│  ┌────────────┐ │  ┌──────────────────────────┐ │
│  │  目录树    │ │  │   OnlyOffice 编辑器       │ │
│  │            │ │  │                           │ │
│  │  1. 总则   │ │  │   ┌─────────────────┐   │ │
│  │  2. 术语   │ │  │   │ Word 文档内容    │   │ │
│  │  3. 技术   │ │  │   │  (保持原格式)    │   │ │
│  │    3.1...  │◄─┼──┼───► 可编辑          │   │ │
│  │    3.2...  │ │  │   │  自动保存        │   │ │
│  │  4. 质量   │ │  │   └─────────────────┘   │ │
│  └────────────┘ │  └──────────────────────────┘ │
└──────────────────┴──────────────────────────────┘
           ↓ API调用               ↓ OnlyOffice API
    ┌──────────────┐        ┌──────────────────┐
    │  获取目录结构 │        │   文档编辑/保存   │
    └──────────────┘        └──────────────────┘
```

---

## 🔧 实现步骤

### 阶段1：后端 - Word目录提取 ⭐

#### 1.1 安装依赖包

```bash
cd apps/api
npm install mammoth docx --save
```

**包说明**：
- `mammoth`: 将Word文档转换为HTML，提取内容
- `docx`: 解析.docx文件结构，提取样式和格式

#### 1.2 实现Word解析服务

**文件**: `apps/api/src/services/document/WordOutlineExtractor.js`

```javascript
const mammoth = require('mammoth');
const fs = require('fs').promises;

/**
 * Word文档大纲提取器
 * 提取标题层级结构
 */
class WordOutlineExtractor {
  /**
   * 从Word文件提取目录大纲
   * @param {string} filePath - Word文件路径
   * @returns {Promise<Array>} 目录结构数组
   */
  async extractOutline(filePath) {
    try {
      // 读取Word文件
      const buffer = await fs.readFile(filePath);

      // 使用mammoth提取HTML和样式
      const result = await mammoth.convertToHtml(
        { buffer },
        {
          styleMap: [
            // 映射Word标题样式到HTML标签
            "p[style-name='Heading 1'] => h1:fresh",
            "p[style-name='Heading 2'] => h2:fresh",
            "p[style-name='Heading 3'] => h3:fresh",
            "p[style-name='Heading 4'] => h4:fresh",
            "p[style-name='标题 1'] => h1:fresh",
            "p[style-name='标题 2'] => h2:fresh",
            "p[style-name='标题 3'] => h3:fresh",
            "p[style-name='标题 4'] => h4:fresh",
          ]
        }
      );

      // 解析HTML提取标题
      const outline = this._parseHtmlToOutline(result.value);

      return outline;
    } catch (error) {
      console.error('[Word解析] 提取大纲失败:', error);
      throw new Error(`解析Word文件失败: ${error.message}`);
    }
  }

  /**
   * 从HTML提取标题结构
   * @private
   */
  _parseHtmlToOutline(html) {
    const headingRegex = /<h([1-4])[^>]*>(.*?)<\/h\1>/gi;
    const outline = [];
    const stack = [{ level: 0, children: outline }];

    let match;
    let order = 0;

    while ((match = headingRegex.exec(html)) !== null) {
      const level = parseInt(match[1]);
      const title = match[2].replace(/<[^>]+>/g, '').trim(); // 移除HTML标签

      // 跳过空标题
      if (!title) continue;

      const node = {
        id: `heading_${order}`,
        title,
        level,
        order: order++,
        children: []
      };

      // 找到合适的父节点
      while (stack.length > 1 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      // 添加到父节点的children
      stack[stack.length - 1].children.push(node);

      // 当前节点入栈
      stack.push(node);
    }

    return outline;
  }

  /**
   * 生成扁平化的目录列表（用于API返回）
   * @param {Array} outline - 树形目录结构
   * @returns {Array} 扁平化数组
   */
  flattenOutline(outline) {
    const flat = [];

    const traverse = (nodes, depth = 0, parentPath = []) => {
      nodes.forEach((node, index) => {
        const path = [...parentPath, index + 1];
        flat.push({
          ...node,
          depth,
          path: path.join('.'),
          hasChildren: node.children && node.children.length > 0
        });

        if (node.children && node.children.length > 0) {
          traverse(node.children, depth + 1, path);
        }
      });
    };

    traverse(outline);
    return flat;
  }
}

module.exports = new WordOutlineExtractor();
```

#### 1.3 更新TemplateService

**文件**: `apps/api/src/services/document/TemplateService.js`

在 `_parseTemplateFile` 方法中调用新的提取器：

```javascript
const WordOutlineExtractor = require('./WordOutlineExtractor');

async _parseTemplateFile(filePath, templateType) {
  try {
    // 提取Word文档目录结构
    const outline = await WordOutlineExtractor.extractOutline(filePath);
    const flatOutline = WordOutlineExtractor.flattenOutline(outline);

    return {
      sectionStructure: outline,      // 树形结构
      flatSections: flatOutline,      // 扁平结构
      variables: [],
      config: {}
    };
  } catch (error) {
    console.error('[模板解析] 失败:', error);
    // 返回空结构，不影响模板创建
    return {
      sectionStructure: [],
      flatSections: [],
      variables: [],
      config: {}
    };
  }
}
```

#### 1.4 添加API端点

**文件**: `apps/api/src/routes/unifiedDocument.js`

添加获取模板目录的API：

```javascript
/**
 * 获取模板的目录结构
 * GET /api/unified-document/templates/:id/outline
 */
router.get('/templates/:id/outline', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const template = await knex('document_templates')
      .where({ id })
      .first();

    if (!template) {
      return res.status(404).json({
        success: false,
        message: '模板不存在'
      });
    }

    // 从config中读取解析好的目录结构
    const config = JSON.parse(template.config || '{}');

    res.json({
      success: true,
      data: {
        outline: config.sectionStructure || [],
        flatOutline: config.flatSections || []
      }
    });
  } catch (error) {
    console.error('[模板管理] 获取目录失败:', error);
    res.status(500).json({
      success: false,
      message: '获取模板目录失败',
      error: error.message
    });
  }
});
```

---

### 阶段2：前端 - 左右分栏编辑器 ⭐⭐

#### 2.1 创建目录树组件

**文件**: `apps/web/src/components/TemplateOutlineTree.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { Tree, Input, Space, Spin } from 'antd';
import { SearchOutlined, FolderOutlined, FileTextOutlined } from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import axios from '../utils/axios';

interface OutlineNode {
  id: string;
  title: string;
  level: number;
  order: number;
  children?: OutlineNode[];
}

interface Props {
  templateId: string;
  onSelectNode?: (node: OutlineNode) => void;
}

const TemplateOutlineTree: React.FC<Props> = ({ templateId, onSelectNode }) => {
  const [outline, setOutline] = useState<OutlineNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchValue, setSearchValue] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  useEffect(() => {
    loadOutline();
  }, [templateId]);

  const loadOutline = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `/api/unified-document/templates/${templateId}/outline`
      );

      if (response.data.success) {
        setOutline(response.data.data.outline);
        // 默认展开第一层
        const firstLevelKeys = response.data.data.outline.map((n: OutlineNode) => n.id);
        setExpandedKeys(firstLevelKeys);
      }
    } catch (error: any) {
      console.error('加载目录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 转换为Antd Tree所需的数据格式
  const convertToTreeData = (nodes: OutlineNode[]): DataNode[] => {
    return nodes.map((node) => ({
      key: node.id,
      title: (
        <span style={{ fontSize: 14 }}>
          {node.title}
        </span>
      ),
      icon: node.children?.length ? <FolderOutlined /> : <FileTextOutlined />,
      children: node.children ? convertToTreeData(node.children) : undefined,
    }));
  };

  // 过滤搜索
  const filterTree = (nodes: OutlineNode[], searchTerm: string): OutlineNode[] => {
    return nodes.filter((node) => {
      const matchTitle = node.title.toLowerCase().includes(searchTerm.toLowerCase());
      const matchChildren = node.children
        ? filterTree(node.children, searchTerm).length > 0
        : false;
      return matchTitle || matchChildren;
    }).map((node) => ({
      ...node,
      children: node.children ? filterTree(node.children, searchTerm) : undefined,
    }));
  };

  const displayOutline = searchValue
    ? filterTree(outline, searchValue)
    : outline;

  const treeData = convertToTreeData(displayOutline);

  const handleSelect = (selectedKeys: React.Key[], info: any) => {
    if (selectedKeys.length > 0 && onSelectNode) {
      // 找到选中的节点
      const findNode = (nodes: OutlineNode[], key: string): OutlineNode | null => {
        for (const node of nodes) {
          if (node.id === key) return node;
          if (node.children) {
            const found = findNode(node.children, key);
            if (found) return found;
          }
        }
        return null;
      };

      const selectedNode = findNode(outline, selectedKeys[0] as string);
      if (selectedNode) {
        onSelectNode(selectedNode);
      }
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <Spin tip="加载目录中..." />
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
        <Input
          placeholder="搜索目录..."
          prefix={<SearchOutlined />}
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          allowClear
        />
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
        {treeData.length > 0 ? (
          <Tree
            showIcon
            defaultExpandAll
            expandedKeys={expandedKeys}
            onExpand={(keys) => setExpandedKeys(keys as string[])}
            treeData={treeData}
            onSelect={handleSelect}
            style={{ background: 'transparent' }}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: '#999' }}>
            {searchValue ? '未找到匹配的目录项' : '暂无目录结构'}
          </div>
        )}
      </div>
    </div>
  );
};

export default TemplateOutlineTree;
```

#### 2.2 改造TemplateEditor组件

**文件**: `apps/web/src/pages/TemplateEditor.tsx`

```typescript
import React, { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout, Card, Button, Space, Tag, Tooltip, message } from 'antd';
import {
  ArrowLeftOutlined,
  FileTextOutlined,
  DownloadOutlined,
  SaveOutlined,
  ExpandOutlined,
  CompressOutlined
} from '@ant-design/icons';
import DocxEditor from '../components/DocxEditor';
import TemplateOutlineTree from '../components/TemplateOutlineTree';

const { Sider, Content } = Layout;

const TemplateEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const editorRef = useRef<any>(null);

  if (!id) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p>模板ID缺失</p>
      </div>
    );
  }

  // 处理目录节点选择 - 跳转到对应章节
  const handleNodeSelect = (node: any) => {
    // TODO: 实现跳转到Word文档对应位置
    // OnlyOffice API: editor.jumpTo(bookmark)
    message.info(`跳转到: ${node.title}`);
  };

  // 导出Word文档
  const handleExport = () => {
    // TODO: 调用OnlyOffice API导出文档
    message.info('正在导出...');
  };

  // 保存文档
  const handleSave = () => {
    // OnlyOffice会自动保存
    message.success('文档已自动保存');
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 顶部工具栏 */}
      <Card
        style={{ borderRadius: 0, borderBottom: '1px solid #f0f0f0' }}
        bodyStyle={{ padding: '12px 24px' }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Space size="large">
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/templates')}
            >
              返回列表
            </Button>
            <div>
              <Space>
                <FileTextOutlined style={{ fontSize: 18, color: '#1890ff' }} />
                <span style={{ fontSize: 16, fontWeight: 500 }}>
                  Word模板编辑器
                </span>
                <Tag color="green">自动保存</Tag>
              </Space>
            </div>
          </Space>

          <Space>
            <Tooltip title={collapsed ? "显示目录" : "隐藏目录"}>
              <Button
                icon={collapsed ? <ExpandOutlined /> : <CompressOutlined />}
                onClick={() => setCollapsed(!collapsed)}
              />
            </Tooltip>
            <Button icon={<SaveOutlined />} onClick={handleSave}>
              保存
            </Button>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleExport}
            >
              导出
            </Button>
          </Space>
        </div>
      </Card>

      {/* 主体区域 - 左右分栏 */}
      <Layout style={{ flex: 1, background: '#f0f2f5' }}>
        {/* 左侧目录树 */}
        <Sider
          width={320}
          collapsed={collapsed}
          collapsedWidth={0}
          trigger={null}
          style={{
            background: '#fff',
            borderRight: '1px solid #f0f0f0',
            overflow: 'hidden'
          }}
        >
          <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              padding: '16px',
              borderBottom: '1px solid #f0f0f0',
              background: '#fafafa',
              fontWeight: 500
            }}>
              文档目录
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              <TemplateOutlineTree
                templateId={id}
                onSelectNode={handleNodeSelect}
              />
            </div>
          </div>
        </Sider>

        {/* 右侧编辑器 */}
        <Content style={{ padding: 16, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            background: '#fff',
            borderRadius: 4,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            overflow: 'hidden'
          }}>
            <DocxEditor
              ref={editorRef}
              documentId={id}
              height="100%"
            />
          </div>
        </Content>
      </Layout>
    </div>
  );
};

export default TemplateEditor;
```

---

### 阶段3：OnlyOffice集成 ⭐⭐⭐

#### 3.1 实现章节跳转

需要在DocxEditor组件中暴露跳转方法：

**文件**: `apps/web/src/components/DocxEditor.tsx`

```typescript
// 在DocxEditor组件中添加方法

useImperativeHandle(ref, () => ({
  // 跳转到指定书签/标题
  jumpToHeading: (headingText: string) => {
    if (editorInstance) {
      // OnlyOffice API: 搜索并跳转
      editorInstance.asc_findText(headingText, true, false);
    }
  },

  // 导出文档
  downloadDocument: () => {
    if (editorInstance) {
      editorInstance.downloadAs('docx', 'template.docx');
    }
  }
}));
```

#### 3.2 更新TemplateEditor使用ref

```typescript
const handleNodeSelect = (node: any) => {
  if (editorRef.current) {
    editorRef.current.jumpToHeading(node.title);
  }
};

const handleExport = () => {
  if (editorRef.current) {
    editorRef.current.downloadDocument();
  }
};
```

---

## 📝 API接口清单

### 1. 获取模板目录结构
```
GET /api/unified-document/templates/:id/outline

Response:
{
  "success": true,
  "data": {
    "outline": [
      {
        "id": "heading_0",
        "title": "1. 总则",
        "level": 1,
        "order": 0,
        "children": [
          {
            "id": "heading_1",
            "title": "1.1 适用范围",
            "level": 2,
            "order": 1,
            "children": []
          }
        ]
      }
    ],
    "flatOutline": [...]
  }
}
```

---

## 🧪 测试计划

### 单元测试
1. `WordOutlineExtractor.test.js` - 测试Word解析功能
2. `TemplateOutlineTree.test.tsx` - 测试目录树组件

### 集成测试
1. 上传包含多级标题的Word文档
2. 验证目录提取正确性
3. 测试目录点击跳转
4. 测试编辑和保存功能
5. 测试导出功能

### 测试用例
```
测试文档结构：
1. 总则
  1.1 编制依据
  1.2 适用范围
2. 术语和定义
  2.1 基本术语
  2.2 专业术语
3. 技术要求
  3.1 材料要求
  3.2 施工要求
    3.2.1 准备工作
    3.2.2 施工流程
4. 质量标准
```

---

## 📦 依赖包

### 后端
```json
{
  "mammoth": "^1.7.2",
  "docx": "^8.5.0"
}
```

### 前端
无需新增依赖（使用Antd现有组件）

---

## 🚀 部署步骤

1. **安装后端依赖**
```bash
cd apps/api
npm install mammoth docx
```

2. **重启后端服务**
```bash
npm run dev
```

3. **前端无需额外操作**（已有依赖足够）

4. **测试新功能**
   - 上传一个包含标题的Word文档
   - 进入模板编辑页面
   - 验证左侧显示目录树
   - 点击目录项测试跳转

---

## 🎯 预期效果

### 用户体验
1. **直观的目录导航** - 类似Word的导航窗格
2. **快速定位章节** - 点击即可跳转
3. **保持原格式** - OnlyOffice完美保留Word格式
4. **自动保存** - 编辑实时同步
5. **便捷导出** - 一键导出为Word

### 技术优势
1. **准确的目录提取** - 基于Word标题样式
2. **层级结构清晰** - 树形展示
3. **搜索功能** - 快速查找目录项
4. **响应式布局** - 可折叠侧边栏

---

## 💡 后续优化

1. **书签功能** - 用户自定义书签
2. **历史版本** - 查看和恢复历史版本
3. **协同编辑** - 多人同时编辑
4. **批注功能** - 添加评论和批注
5. **模板变量高亮** - 标记可替换变量

---

## ⚠️ 注意事项

1. **Word格式兼容性** - 确保支持标题样式识别
2. **大文件处理** - 优化大型文档的加载速度
3. **OnlyOffice配置** - 需要正确配置OnlyOffice服务器
4. **权限控制** - 确保只有授权用户可以编辑

---

## 📞 问题排查

### 问题1：目录无法显示
- 检查Word文档是否使用了标准标题样式
- 查看后端日志确认解析是否成功
- 验证API返回数据格式

### 问题2：跳转不工作
- 确认OnlyOffice API版本兼容
- 检查标题文本匹配是否准确
- 查看浏览器控制台错误信息

### 问题3：导出失败
- 验证OnlyOffice服务器配置
- 检查网络连接状态
- 查看服务器端错误日志
