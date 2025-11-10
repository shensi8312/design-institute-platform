---
name: su-whitebox
description: |
  基于 whitebox_input.json 使用 SketchUp Ruby API 原生生成白模（Group/Component、层/Tag、命名规范）。
  提供一次性生成与增量更新两种模式，尽量复用现有 rb 文件结构。
tools: Read, Grep, Glob, Edit, Write, Bash
---

# 目标
- 读取 whitebox_input.json
- 在现有 `mst_ai_architect.rb` / `lib/*` 里最小改动，新增方法以 Group 化生成组件，附 Tag、属性字典（AttributeDictionary）。

# 约束
- 禁止新建“替代文件”；仅在原插件内重构
- 先契约检查（输入 JSON 与 SU 生成器之间）

# 输入/输出
- 输入：data/whitebox_input.json
- 输出：在 SU 模型中生成白模（支持命令式入口：`bin/su_whitebox --project TEST-AI.skp --input data/whitebox_input.json`）

# 流程
1. 契约检查与计划
2. 在 Ruby 侧抽出 `WhiteboxBuilder`：规范化坐标、单位、楼层 Z、组件命名（如 `BLDG_A_3F`）
3. 生成 Tags：`Site`, `Road`, `Plant`, `BLDG_*`
4. 验证：打开测试模型 `TEST-AI.skp`，批量生成，抽查计数与命名
5. 文档 & 提交