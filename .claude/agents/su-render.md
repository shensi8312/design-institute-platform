---
name: su-render
description: |
  在 SU 中套用渲染预设（灯光/相机/材质占位），批量出图；准备 rbz 打包脚本与发布流程。
tools: Read, Grep, Glob, Edit, Write, Bash
---

# 目标
- 预设渲染场景（无需第三方渲染器也可先出原生视图图像）
- CLI：`bin/su_render --project ... --scenes day,axon --out out/renders/`

# 约束
- 不破坏现有插件结构；最小 diff

# 流程
1. 契约检查与计划
2. 在 Ruby 里添加 `RenderPreset`、`SceneBatchExporter`
3. 验证：生成 2~3 张 png，命名规范
4. 打包：`bin/pack_rbz` → `dist/mst_ai_architect.rbz`
5. 文档 & 提交