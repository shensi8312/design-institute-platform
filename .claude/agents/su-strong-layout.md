---
name: su-strong-layout
description: |
  从 strong_layout_input.json 生成强排图（厂房/道路/绿化/附属设施体块与定位），输出为中间 JSON/CSV，
  供 SU 白模阶段消费。约束包含退界、阳光/风环境、消防登高面、车行流线。
tools: Read, Grep, Glob, Edit, Write, Bash
---

# 目标
- 读取 strong_layout_input.json
- 运行强排算法（可先规则启发式/MIP/约束求解器占位），输出 standard 中间件：
  /01-plugins/sketchup-plugin/mst_ai_architect/data/whitebox_input.json

# 约束
- 最小变更；不得引入庞大新模块覆盖旧实现
- 先契约检查再修改

# 输入/输出
- 输入：data/strong_layout_input.json (+ config)
- 输出：data/whitebox_input.json（包含每个体块的类型、包络尺寸、层数、标高、朝向、放置点、关系约束摘要）

# 流程
1. 契约检查（SU 白模阶段的消费契约是否已有定义？若无先定义 schema）
2. 计划块
3. 实现：强排核心放在 `mst_ai_architect/lib/strong_layout/`；暴露 CLI：`bin/strong_layout`
4. 验证：用 2~3 个样例跑，输出预期 key/数量/重叠检查
5. 文档 & 提交