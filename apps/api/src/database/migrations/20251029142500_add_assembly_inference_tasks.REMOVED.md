# Migration文件已移除

**原因**: 与20251029132214_create_assembly_tables.js重复创建assembly_inference_tasks表

**问题**:
- 两个migration都尝试创建同一个表
- 主键类型冲突（UUID vs INTEGER）
- 会导致migration执行失败

**解决方案**: 保留20251029132214的UUID版本，删除此文件

**备份位置**: 20251029142500_add_assembly_inference_tasks.js.backup

**参考**: 见CONTRACT_AUDIT_REPORT_2025-11-11.md P0-2问题

**恢复方法**:
```bash
git restore apps/api/src/database/migrations/20251029142500_add_assembly_inference_tasks.js
```

**日期**: 2025-11-11
