---
name: su-parametric
description: |
  参数化建模（体块长宽高/层高/退台/开洞/模数/立面分缝），提供参数面板与命令行入口。
tools: Read, Grep, Glob, Edit, Write, Bash
---

# 目标
- 提供 `ParametricBox`/`FacadePattern` 等 Ruby 类；支持增量更新已有组件
- CLI：`bin/su_parametric --select BLDG_A --set height=36,floors=6,grid=8`

# 约束/流程
- 同上（契约检查/计划/最小 diff/验证/文档）