# 🚀 MST-AI平台 - 服务器部署指南

## 📋 服务器架构

```
┌─────────────────────────────────────────────────────────┐
│  数据库服务器 (10.10.19.4)                             │
│  ├─ PostgreSQL (5432)                                   │
│  ├─ Redis (6379)                                        │
│  ├─ Neo4j (7687/7474)                                   │
│  ├─ Milvus (19530)                                      │
│  ├─ MinIO (9000/9001)                                   │
│  └─ Elasticsearch (9200)                                │
└─────────────────────────────────────────────────────────┘
                          ↕ 网络连接
┌─────────────────────────────────────────────────────────┐
│  应用服务器 (10.10.19.3)                                │
│  ├─ MST-AI前端 (8080)        ← 你的新平台              │
│  ├─ MST-AI API (3000)        ← 你的新平台              │
│  ├─ 文档识别服务 (8086)      ← 你的新平台              │
│  ├─ 向量服务 (8085)          ← 你的新平台              │
│  ├─ ChatChat前端 (8501)      ← 已有                    │
│  └─ ChatChat后端 (7861)      ← 已有                    │
└─────────────────────────────────────────────────────────┘
```

## 🔐 服务器信息

### 数据库服务器
- **IP**: 10.10.19.4
- **用户**: aiuser
- **密码**: asd123465QWE
- **已安装服务**: PostgreSQL, Redis, Neo4j, Milvus, MinIO, Elasticsearch

### 应用服务器
- **IP**: 10.10.19.3
- **用户**: aiuser
- **密码**: asd123465QWE
- **已有应用**: ChatChat (前端:8501, 后端:7861)
- **新部署端口**: 8080 (前端), 3000 (API)

---

## 🎯 快速部署步骤

### 步骤1: 本地打包 (在你的Mac上)

```bash
cd /Users/shenguoli/Documents/projects/design-institute-platform

# 运行打包脚本
./package.sh
```

生成文件: `release.tar.gz` (约200-300MB)

---

### 步骤2: 上传到应用服务器

```bash
# 上传压缩包到应用服务器
scp release.tar.gz aiuser@10.10.19.3:/tmp/

# 输入密码: asd123465QWE
```

---

### 步骤3: 配置数据库服务器防火墙 (重要!)

**在数据库服务器上执行** (10.10.19.4):

```bash
# SSH登录数据库服务器
ssh aiuser@10.10.19.4
# 密码: asd123465QWE

# 允许应用服务器访问数据库
sudo ufw allow from 10.10.19.3 to any port 5432  # PostgreSQL
sudo ufw allow from 10.10.19.3 to any port 6379  # Redis
sudo ufw allow from 10.10.19.3 to any port 7687  # Neo4j
sudo ufw allow from 10.10.19.3 to any port 19530 # Milvus
sudo ufw allow from 10.10.19.3 to any port 9000  # MinIO
sudo ufw allow from 10.10.19.3 to any port 9200  # Elasticsearch

# 查看规则
sudo ufw status
```

**配置PostgreSQL允许远程连接**:

```bash
# 编辑PostgreSQL配置
sudo vi /etc/postgresql/*/main/postgresql.conf

# 修改以下行 (去掉注释并修改):
listen_addresses = '*'

# 编辑pg_hba.conf
sudo vi /etc/postgresql/*/main/pg_hba.conf

# 添加以下行 (允许应用服务器访问):
host    all             all             10.10.19.3/32           md5

# 重启PostgreSQL
sudo systemctl restart postgresql
```

**配置Redis允许远程连接**:

```bash
# 编辑Redis配置
sudo vi /etc/redis/redis.conf

# 修改以下行:
bind 0.0.0.0
protected-mode yes
requirepass 你的Redis密码

# 重启Redis
sudo systemctl restart redis
```

**配置Neo4j允许远程连接**:

```bash
# 编辑Neo4j配置
sudo vi /etc/neo4j/neo4j.conf

# 修改以下行:
dbms.default_listen_address=0.0.0.0

# 重启Neo4j
sudo systemctl restart neo4j
```

---

### 步骤4: 在数据库服务器上创建数据库

**在数据库服务器上** (10.10.19.4):

```bash
# 切换到postgres用户
sudo -u postgres psql

# 创建数据库
CREATE DATABASE design_platform;

# 创建用户 (可选，或使用postgres用户)
CREATE USER mst_user WITH PASSWORD '你的密码';
GRANT ALL PRIVILEGES ON DATABASE design_platform TO mst_user;

# 退出
\q
```

---

### 步骤5: 部署到应用服务器

**SSH登录应用服务器** (10.10.19.3):

```bash
ssh aiuser@10.10.19.3
# 密码: asd123465QWE

# 解压部署包
cd /tmp
tar -xzf release.tar.gz -C ~/

# 进入部署目录
cd ~/release

# 运行部署脚本
sudo ./deploy-to-server.sh
```

部署脚本会自动:
1. ✅ 安装Node.js、Python、PM2、Nginx
2. ✅ 测试数据库服务器连接
3. ✅ 创建目录结构
4. ✅ 部署代码
5. ✅ 提示配置环境变量
6. ✅ 安装依赖
7. ✅ 初始化数据库
8. ✅ 配置Nginx
9. ✅ 启动服务

---

### 步骤6: 配置数据库密码

部署脚本会提示你编辑环境变量文件:

```bash
sudo vi /opt/mst-platform/current/.env
```

**必须配置的关键项**:

```bash
# PostgreSQL (数据库服务器 10.10.19.4)
DB_HOST=10.10.19.4
DB_PORT=5432
DB_PASSWORD=你的PostgreSQL密码

# Redis
REDIS_HOST=10.10.19.4
REDIS_PORT=6379
REDIS_PASSWORD=你的Redis密码

# Neo4j
NEO4J_URI=bolt://10.10.19.4:7687
NEO4J_PASSWORD=你的Neo4j密码

# MinIO
MINIO_ENDPOINT=10.10.19.4
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

# JWT密钥 (生成一个32位随机字符串)
JWT_SECRET=$(openssl rand -base64 32)
```

保存后重启服务:

```bash
pm2 restart all
```

---

## 🔍 验证部署

### 1. 检查服务状态

```bash
# 查看PM2进程
pm2 list

# 应该看到:
# ┌─────┬──────────────┬─────────┬─────────┐
# │ id  │ name         │ status  │ cpu     │
# ├─────┼──────────────┼─────────┼─────────┤
# │ 0   │ mst-api      │ online  │ 0%      │
# │ 1   │ mst-document │ online  │ 0%      │
# │ 2   │ mst-vector   │ online  │ 0%      │
# └─────┴──────────────┴─────────┴─────────┘
```

### 2. 测试API

```bash
# 在应用服务器上测试
curl http://localhost:3000/health
# 应返回: {"status":"ok"}

# 测试数据库连接
curl http://localhost:3000/api/health/db
```

### 3. 访问前端

在浏览器中打开:
```
http://10.10.19.3:8080
```

---

## 🌐 端口分配表

### 数据库服务器 (10.10.19.4)
| 服务 | 端口 | 说明 |
|-----|------|------|
| PostgreSQL | 5432 | 主数据库 |
| Redis | 6379 | 缓存/队列 |
| Neo4j HTTP | 7474 | 图数据库Web界面 |
| Neo4j Bolt | 7687 | 图数据库连接 |
| Milvus | 19530 | 向量数据库 |
| MinIO API | 9000 | 对象存储API |
| MinIO Console | 9001 | MinIO控制台 |
| Elasticsearch | 9200 | 全文搜索 |

### 应用服务器 (10.10.19.3)
| 服务 | 端口 | 说明 | 状态 |
|-----|------|------|------|
| MST前端 | 8080 | 你的平台前端 | 新部署 |
| MST API | 3000 | 你的平台API | 新部署 |
| 文档识别 | 8086 | Python服务 | 新部署 |
| 向量服务 | 8085 | Python服务 | 新部署 |
| ChatChat前端 | 8501 | 现有服务 | 保留 |
| ChatChat后端 | 7861 | 现有服务 | 保留 |

---

## 🛠 常用管理命令

### PM2进程管理

```bash
# 查看所有进程
pm2 list

# 查看实时日志
pm2 logs

# 查看特定服务日志
pm2 logs mst-api
pm2 logs mst-document

# 重启服务
pm2 restart mst-api
pm2 restart all

# 停止服务
pm2 stop mst-api
pm2 stop all

# 查看资源监控
pm2 monit

# 查看详细信息
pm2 show mst-api
```

### Nginx管理

```bash
# 测试配置
sudo nginx -t

# 重启Nginx
sudo systemctl restart nginx

# 查看状态
sudo systemctl status nginx

# 查看错误日志
sudo tail -f /var/log/nginx/mst-platform-error.log

# 查看访问日志
sudo tail -f /var/log/nginx/mst-platform-access.log
```

### 数据库管理

```bash
# 连接PostgreSQL (从应用服务器)
psql -h 10.10.19.4 -p 5432 -U postgres -d design_platform

# 连接Redis
redis-cli -h 10.10.19.4 -p 6379 -a 你的密码

# 访问Neo4j浏览器
http://10.10.19.4:7474
```

---

## ❓ 故障排查

### 问题1: 无法连接数据库服务器

**症状**: API启动失败，提示数据库连接超时

**解决方案**:

```bash
# 1. 在应用服务器测试连接
nc -zv 10.10.19.4 5432

# 2. 检查数据库服务器防火墙
ssh aiuser@10.10.19.4
sudo ufw status

# 3. 检查PostgreSQL监听地址
sudo netstat -tlnp | grep 5432

# 4. 检查PostgreSQL日志
sudo tail -f /var/log/postgresql/postgresql-*-main.log
```

### 问题2: API启动后立即退出

**解决方案**:

```bash
# 查看错误日志
pm2 logs mst-api --err

# 检查环境变量
cat /opt/mst-platform/current/.env | grep DB_

# 手动测试启动
cd /opt/mst-platform/current/apps/api
node src/app.js
```

### 问题3: 前端页面无法访问

**解决方案**:

```bash
# 检查Nginx状态
sudo systemctl status nginx

# 检查端口占用
sudo netstat -tlnp | grep 8080

# 测试本地访问
curl http://localhost:8080

# 检查防火墙
sudo ufw status
sudo ufw allow 8080
```

### 问题4: 端口冲突

如果8080端口被占用,修改Nginx配置:

```bash
# 编辑配置
sudo vi /etc/nginx/sites-available/mst-platform

# 修改端口 (例如改为8082)
listen 8082;

# 重启Nginx
sudo systemctl restart nginx
```

---

## 🔄 更新部署

当有新版本时:

```bash
# 1. 本地打包新版本
./package.sh

# 2. 上传到服务器
scp release.tar.gz aiuser@10.10.19.3:/tmp/

# 3. SSH登录应用服务器
ssh aiuser@10.10.19.3

# 4. 备份当前版本
cd /opt/mst-platform
sudo tar -czf backups/backup-$(date +%Y%m%d-%H%M%S).tar.gz current/

# 5. 解压新版本
sudo tar -xzf /tmp/release.tar.gz -C current/

# 6. 重启服务
pm2 restart all

# 7. 查看状态
pm2 list
```

---

## 📊 监控与维护

### 定期检查

```bash
# 查看磁盘使用
df -h

# 查看内存使用
free -h

# 查看进程资源
pm2 monit

# 查看数据库大小
psql -h 10.10.19.4 -U postgres -d design_platform -c "SELECT pg_size_pretty(pg_database_size('design_platform'));"
```

### 日志清理

```bash
# 清理PM2日志
pm2 flush

# 清理Nginx日志 (保留7天)
sudo find /var/log/nginx/ -name "*.log" -mtime +7 -delete
```

### 备份脚本

创建 `/home/aiuser/backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d)

# 备份代码
tar -czf ${BACKUP_DIR}/code-${DATE}.tar.gz /opt/mst-platform/current

# 备份数据库 (在数据库服务器上执行)
ssh aiuser@10.10.19.4 "PGPASSWORD=密码 pg_dump -h localhost -U postgres design_platform" > ${BACKUP_DIR}/db-${DATE}.sql

# 删除30天前的备份
find ${BACKUP_DIR} -name "*.tar.gz" -mtime +30 -delete
find ${BACKUP_DIR} -name "*.sql" -mtime +30 -delete
```

添加定时任务:

```bash
crontab -e

# 添加: 每天凌晨2点备份
0 2 * * * /home/aiuser/backup.sh
```

---

## 🔐 安全建议

1. ✅ **修改所有默认密码**
2. ✅ **配置防火墙规则** (只允许必要的IP访问)
3. ✅ **定期更新系统**: `sudo apt update && sudo apt upgrade`
4. ✅ **启用fail2ban**: `sudo apt install fail2ban`
5. ✅ **配置SSL证书** (如果使用域名)
6. ✅ **定期备份数据库**
7. ✅ **监控日志异常访问**

---

## 📞 技术支持

### 日志位置
- PM2日志: `~/.pm2/logs/`
- Nginx日志: `/var/log/nginx/`
- 应用日志: `/var/log/mst-platform/`

### 配置文件位置
- 应用配置: `/opt/mst-platform/current/.env`
- Nginx配置: `/etc/nginx/sites-available/mst-platform`
- PM2配置: `~/.pm2/`

---

**部署完成后，你的平台将运行在:**
- **前端**: http://10.10.19.3:8080
- **API**: http://10.10.19.3:3000

**与现有ChatChat服务共存:**
- **ChatChat前端**: http://10.10.19.3:8501 (保持不变)
- **ChatChat后端**: http://10.10.19.3:7861/docs (保持不变)

---

*祝部署顺利！🎉*
