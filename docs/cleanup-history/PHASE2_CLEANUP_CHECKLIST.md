# 🟡 阶段2清理确认清单

**说明**：以下文件需要你确认是否删除。请仔细检查每个文件，确定是临时测试还是实际功能所需。

---

## 📁 类别1：API根目录测试文件（33个）

这些test_*.js文件都在 `apps/api/` 根目录，应该移到 `apps/api/tests/` 或删除。

### 🔍 建议操作：**删除临时测试，保留重要测试并移到tests/目录**

```bash
apps/api/test_analyzer_step1.js              # 步骤分析器测试
apps/api/test_assembly_integration.js        # 装配集成测试
apps/api/test_assembly_learning.js           # 装配学习测试
apps/api/test_assembly_with_existing_pid.js  # PID装配测试
apps/api/test_chat_history.js                # 聊天历史测试
apps/api/test_compare_methods.js             # 方法对比测试
apps/api/test_config.js                      # 配置测试
apps/api/test_debug.js                       # 调试测试
apps/api/test_document_classifier.js         # 文档分类器测试
apps/api/test_domain_config.js               # 域配置测试
apps/api/test_domain_upload.js               # 域上传测试
apps/api/test_extraction_system.js           # 提取系统测试
apps/api/test_intelligent_analyzer.js        # 智能分析器测试
apps/api/test_llm_simple.js                  # LLM简单测试
apps/api/test_menu_api.js                    # 菜单API测试
apps/api/test_minio_read.js                  # MinIO读取测试
apps/api/test_ocr_single_pdf.js              # OCR单PDF测试
apps/api/test_opencv_pid_recognition.js      # OpenCV PID识别测试
apps/api/test_pid_47_parts.js                # PID 47部件测试
apps/api/test_pid_auto_assembly.js           # PID自动装配测试
apps/api/test_pid_to_assembly_mvp.js         # PID转装配MVP测试
apps/api/test_pid_to_assembly_real.js        # PID转装配真实测试
apps/api/test_pid_to_real_assembly.js        # PID转真实装配测试
apps/api/test_queue_system.js                # 队列系统测试
apps/api/test_qwenvl_pdf.js                  # QwenVL PDF测试
apps/api/test_qwenvl_pid.js                  # QwenVL PID测试
apps/api/test_real_pid_assembly.js           # 真实PID装配测试
apps/api/test_reprocess_docs.js              # 文档重处理测试
apps/api/test_reprocess_pdfs.js              # PDF重处理测试
apps/api/test_rule_generator.js              # 规则生成器测试
apps/api/test_step_assembly.js               # STEP装配测试
apps/api/test_step_loader.js                 # STEP加载器测试
apps/api/test_step_upload.js                 # STEP上传测试
```

### ✅ 你的选择：

- [ ] **全部删除** - 这些都是临时测试文件
- [ ] **选择性保留** - 告诉我保留哪些（请列出文件名）
- [ ] **移动到tests/目录** - 保留所有但移到正规位置

---

## 📁 类别2：API根目录工具脚本（11个）

这些脚本应该移到 `scripts/` 目录或 `apps/api/scripts/` 目录。

```bash
apps/api/batch_upload_standards.js      # 批量上传标准 - 7KB (可能在用)
apps/api/batch_upload_test.js           # 批量上传测试 - 3KB (测试文件，可删除)
apps/api/check_matrices.js              # 检查矩阵 - 251字节 (小脚本，可删除)
apps/api/cleanup_all_pdfs.js            # 清理所有PDF - 1.5KB (工具脚本)
apps/api/create_csi_template_file.js    # 创建CSI模板 - 2.7KB (工具脚本)
apps/api/export_assembly.js             # 导出装配 - 3.5KB (工具脚本)
apps/api/export_latest.js               # 导出最新 - 224字节 (小脚本)
apps/api/extract_step_colors_simple.js  # 提取STEP颜色 - 3KB (工具脚本)
apps/api/fix_parts_catalog.js           # 修复部件目录 - 1.7KB (修复脚本，可能已完成)
apps/api/link_step_models.js            # 链接STEP模型 - 1.3KB (工具脚本)
apps/api/verify_ocr_quality.js          # 验证OCR质量 - 未知 (验证脚本)
```

### ✅ 你的选择：

- [ ] **全部删除** - 这些脚本已经不用了
- [ ] **移动到scripts/api-tools/** - 保留工具脚本但移到统一位置
- [ ] **选择性删除** - 告诉我删除哪些（比如test/fix类的）

---

## 📁 类别3：API根目录Python文件（3个）

这些Python脚本应该移到 `scripts/python-tools/` 或删除。

```bash
apps/api/batch_convert_step_to_stl.py   # 批量转换STEP到STL
apps/api/extract_step_colors.py         # 提取STEP颜色
apps/api/parse_assembly_step.py         # 解析装配STEP
```

### ✅ 你的选择：

- [ ] **全部删除** - 这些Python脚本不应该在Node.js API目录
- [ ] **移动到scripts/python-tools/** - 保留但移到合适位置
- [ ] **保留** - 这些脚本正在使用中

---

## 📁 类别4：重复前端页面（7个）

这些前端页面存在重复版本，应该只保留最完整的版本。

```bash
# DataAnnotation系列 - 3个版本
apps/web/src/pages/DataAnnotation.tsx           # 328字节，空框架
apps/web/src/pages/DataAnnotationFixed.tsx      # 353字节，内测版空框架
apps/web/src/pages/DataAnnotationSimple.tsx     # 2.4KB，有实际内容 ✅ 保留这个

# LearningDashboard系列 - 2个版本
apps/web/src/pages/LearningDashboard.tsx        # 313字节，空框架
apps/web/src/pages/LearningDashboardFixed.tsx   # 344字节，Fixed版空框架
# 建议：都删除，或只保留一个完整实现

# Test测试页面 - 2个
apps/web/src/pages/Test.tsx                      # 359字节，测试页面
apps/web/src/pages/TestPermission.tsx            # 4.3KB，权限测试页面

# 前端测试文件
apps/web/test-knowledge-page.js                  # 测试文件，应移到tests/
```

### ✅ 你的选择：

- [ ] **删除空框架** - 删除DataAnnotation.tsx和DataAnnotationFixed.tsx，保留Simple版
- [ ] **删除测试页面** - 删除Test.tsx和TestPermission.tsx
- [ ] **删除LearningDashboard空页面** - 两个都删除
- [ ] **移动test文件** - 移动test-knowledge-page.js到tests/

---

## 📁 类别5：前端测试/截图目录

```bash
apps/web/test-screenshots/       # 测试截图目录，可能不需要
apps/web/menu-screenshots/       # 菜单截图，可移到docs/
```

### ✅ 你的选择：

- [ ] **删除test-screenshots/** - 测试截图不需要提交
- [ ] **移动menu-screenshots/** - 移到docs/screenshots/
- [ ] **保留** - 这些截图有用

---

## 📊 预计清理统计

| 类别 | 文件数 | 建议操作 |
|-----|--------|---------|
| API测试文件 | 33 | 全部删除或移到tests/ |
| API工具脚本 | 11 | 移到scripts/或删除 |
| API Python文件 | 3 | 移到scripts/或删除 |
| 前端重复页面 | 7 | 删除空框架和测试页 |
| 前端测试文件 | 1 | 移到tests/ |
| **总计** | **55** | 待你确认 |

---

## 💡 我的建议

### 🔴 建议删除（临时测试和空框架）：

**API测试文件（全部33个）**：
```bash
# 所有test_*.js都是临时测试，建议全部删除
apps/api/test_*.js (33个文件)

# 如果有重要测试，应该重新用Jest框架写到tests/目录
```

**API工具脚本（部分）**：
```bash
batch_upload_test.js          # 测试文件
check_matrices.js             # 小脚本
fix_parts_catalog.js          # 修复脚本（可能已完成）
```

**前端重复页面**：
```bash
# 删除空框架，保留有内容的版本
apps/web/src/pages/DataAnnotation.tsx
apps/web/src/pages/DataAnnotationFixed.tsx
apps/web/src/pages/LearningDashboard.tsx
apps/web/src/pages/LearningDashboardFixed.tsx
apps/web/src/pages/Test.tsx
apps/web/src/pages/TestPermission.tsx
```

### 🟡 建议移动到scripts/api-tools/：
```bash
# 实用工具脚本
batch_upload_standards.js
cleanup_all_pdfs.js
create_csi_template_file.js
export_assembly.js
export_latest.js
extract_step_colors_simple.js
link_step_models.js
verify_ocr_quality.js
```

### 🟠 建议移动到scripts/python-tools/：
```bash
# Python工具
batch_convert_step_to_stl.py
extract_step_colors.py
parse_assembly_step.py
```

### 🟢 建议移动到合适位置：
```bash
# 前端测试文件
apps/web/test-knowledge-page.js → apps/web/tests/ (如果需要)
```

---

## ❓ 请告诉我你的决定

请回复以下格式：

1. **测试文件(33个)**:
   - [ ] 全部删除
   - [ ] 保留这些: [列出文件名]

2. **工具脚本(11个)**:
   - [ ] 全部删除
   - [ ] 移动到scripts/
   - [ ] 保留这些: [列出文件名]

3. **Python文件(3个)**:
   - [ ] 全部删除
   - [ ] 移动到scripts/
   - [ ] 保留

或者直接告诉我："**按你的建议执行**"，我就按照上面的建议操作。

---

## 🚀 下一步

确认后，我将：
1. 执行删除操作
2. 移动需要保留的文件到合适位置
3. 提交变更到git
4. 生成阶段2清理报告
