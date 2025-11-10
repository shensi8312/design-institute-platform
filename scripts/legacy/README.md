# Legacy Scripts

该目录存放暂时保留的旧脚本：

- `start_sd_api.sh`：历史启动脚本，后续可迁移到正式的 Docker/K8s 流程。
- `restart_and_test.sh`：旧测试批处理脚本，建议改用 `scripts/test/` 下的新版流程。

如需重新启用，请评估是否应迁至正式脚本目录或替换为 Makefile/CI 任务。
