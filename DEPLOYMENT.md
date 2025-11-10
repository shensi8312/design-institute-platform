# MST-AI 建筑设计平台 - 部署指南

## 📋 目录

1. [环境要求](#环境要求)
2. [数据库配置](#数据库配置)
3. [本地打包](#本地打包)
4. [服务器部署](#服务器部署)
5. [常见问题](#常见问题)

---

## 🔧 环境要求

### 服务器最低配置
- CPU: 4核
- 内存: 8GB
- 磁盘: 100GB
- 操作系统: Ubuntu 20.04+ / CentOS 7+

### 软件要求
- Node.js >= 18.0.0
- Python >= 3.11
- PostgreSQL >= 15
- Redis >= 7
- Neo4j >= 5
- PM2 (进程管理器)

---

## 💾 数据库配置

### 当前数据库密码

根据代码配置，你的开发环境数据库密码为：

```bash
# PostgreSQL
主机: localhost
端口: 5433
数据库: design_platform
用户: postgres
密码: postgres

# Redis
主机: localhost
端口: 6379
密码: redis123

# Neo4j
主机: localhost
端口: 7687/7474
用户: neo4j
密码: neo4j123

# MinIO
端点: localhost:9000
访问密钥: minioadmin
密钥: minioadmin
控制台: http://localhost:9001
```

### ⚠️ 生产环境安全建议

**强烈建议在生产环境修改所有默认密码！**

1. **修改PostgreSQL密码**:
```bash
# 登录PostgreSQL
psql -h localhost -p 5433 -U postgres

# 修改密码
ALTER USER postgres WITH PASSWORD '你的新密码';
```

2. **修改Redis密码**:
```bash
# 编辑Redis配置
sudo vi /etc/redis/redis.conf

# 修改以下行
requirepass 你的新密码

# 重启Redis
sudo systemctl restart redis
```

3. **修改Neo4j密码**:
```bash
# 访问 http://localhost:7474
# 首次登录用 neo4j/neo4j123
# 系统会要求修改密码
```

4. **修改MinIO密码**:
```bash
# 访问 http://localhost:9001
# 登录后在Settings中修改密码
```

### 数据库初始化

如果是全新部署，需要初始化数据库：

```bash
# 1. 创建数据库
psql -h localhost -p 5433 -U postgres
CREATE DATABASE design_platform;
\q

# 2. 运行迁移
cd /opt/design-institute-platform/current/apps/api
npm run migrate

# 3. (可选) 导入初始数据
npm run seed
```

---

## 📦 本地打包

### 步骤1: 打包项目

在你的本地开发机器上运行：

```bash
cd /Users/shenguoli/Documents/projects/design-institute-platform

# 运行打包脚本
./package.sh
```

这会生成一个 `release.tar.gz` 文件，包含：
- 所有源代码
- 配置文件
- 部署脚本
- 部署说明

### 步骤2: 上传到服务器

```bash
# 上传压缩包
scp release.tar.gz user@your-server:/tmp/

# 或使用其他方式（FTP、SFTP等）
```

---

## 🚀 服务器部署

### 方式一: 使用自动部署脚本（推荐）

```bash
# 1. SSH登录服务器
ssh user@your-server

# 2. 解压文件
cd /tmp
tar -xzf release.tar.gz -C /opt/mst-platform

# 3. 运行部署脚本
cd /opt/mst-platform
sudo ./deploy.sh
```

部署脚本会自动：
- ✅ 检查系统要求
- ✅ 检查数据库连接
- ✅ 创建目录结构
- ✅ 备份现有版本
- ✅ 安装依赖
- ✅ 配置环境变量
- ✅ 启动服务

### 方式二: 手动部署

#### 1. 准备目录

```bash
sudo mkdir -p /opt/design-institute-platform
sudo chown $USER:$USER /opt/design-institute-platform
cd /opt/design-institute-platform
```

#### 2. 解压代码

```bash
tar -xzf /tmp/release.tar.gz
```

#### 3. 配置环境变量

```bash
# 复制并编辑环境配置
cp .env.production .env
vi .env

# 修改以下配置：
# DB_PASSWORD=你的PostgreSQL密码
# REDIS_PASSWORD=你的Redis密码
# NEO4J_PASSWORD=你的Neo4j密码
# JWT_SECRET=至少32位随机字符串
```

#### 4. 安装依赖

```bash
# 安装PM2
npm install -g pm2

# 安装API依赖
cd apps/api
npm ci --only=production

# 构建前端
cd ../web
npm ci
npm run build
cd ../..
```

#### 5. 启动服务

```bash
# 启动API服务
cd apps/api
pm2 start src/app.js --name mst-api --env production
cd ../..

# 启动Python服务
cd services/document-recognition
pm2 start app.py --name mst-document --interpreter python3
cd ../..

cd services/vector-service
pm2 start app.py --name mst-vector --interpreter python3
cd ../..

# 保存PM2配置
pm2 save
pm2 startup
```

### 6. 配置Nginx（前端反向代理）

创建Nginx配置文件 `/etc/nginx/sites-available/mst-platform`:

```nginx
server {
    listen 80;
    server_name your-domain.com;  # 修改为你的域名

    # 前端静态文件
    location / {
        root /opt/design-institute-platform/apps/web/dist;
        try_files $uri $uri/ /index.html;

        # 启用gzip压缩
        gzip on;
        gzip_types text/plain text/css application/json application/javascript;
    }

    # API代理
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    # 文件上传大小限制
    client_max_body_size 100M;
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/mst-platform /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 🔍 验证部署

### 检查服务状态

```bash
# 查看PM2进程
pm2 list

# 查看日志
pm2 logs

# 查看特定服务日志
pm2 logs mst-api
```

### 测试API

```bash
# 健康检查
curl http://localhost:3000/health

# 应返回: {"status":"ok"}
```

### 访问应用

```bash
# 前端
http://your-domain.com

# API文档（如果有）
http://your-domain.com/api-docs
```

---

## 🛠 常用管理命令

### PM2进程管理

```bash
# 查看所有进程
pm2 list

# 重启服务
pm2 restart mst-api
pm2 restart all

# 停止服务
pm2 stop mst-api
pm2 stop all

# 删除进程
pm2 delete mst-api

# 查看详细信息
pm2 show mst-api

# 监控
pm2 monit
```

### 日志管理

```bash
# 查看实时日志
pm2 logs

# 查看错误日志
pm2 logs --err

# 清空日志
pm2 flush
```

### 更新部署

```bash
# 1. 上传新版本
scp release.tar.gz user@server:/tmp/

# 2. 备份当前版本
cd /opt/design-institute-platform
tar -czf backup-$(date +%Y%m%d).tar.gz .

# 3. 解压新版本
tar -xzf /tmp/release.tar.gz

# 4. 重启服务
pm2 restart all
```

---

## ❓ 常见问题

### Q1: API无法连接数据库

**A**: 检查数据库配置和连接

```bash
# 测试PostgreSQL连接
PGPASSWORD=你的密码 psql -h localhost -p 5433 -U postgres -d design_platform -c "SELECT 1"

# 检查.env文件配置
cat /opt/design-institute-platform/.env | grep DB_
```

### Q2: Redis连接失败

**A**: 检查Redis密码

```bash
# 测试Redis连接
redis-cli -a 你的密码 ping

# 应返回: PONG
```

### Q3: 前端页面无法访问

**A**: 检查Nginx配置

```bash
# 测试配置
sudo nginx -t

# 查看错误日志
sudo tail -f /var/log/nginx/error.log

# 检查端口占用
sudo netstat -tlnp | grep :80
```

### Q4: 服务启动后自动退出

**A**: 查看PM2日志

```bash
# 查看错误日志
pm2 logs mst-api --err

# 常见原因：
# - 端口被占用
# - 数据库连接失败
# - 缺少依赖
# - 环境变量配置错误
```

### Q5: 如何查看服务运行状态

**A**: 使用多种方式检查

```bash
# PM2状态
pm2 list

# 系统资源
pm2 monit

# 端口占用
sudo netstat -tlnp | grep -E "3000|8085|8086"

# 进程
ps aux | grep node
ps aux | grep python
```

### Q6: 数据库迁移失败

**A**: 手动运行迁移

```bash
cd /opt/design-institute-platform/apps/api

# 查看迁移状态
npm run migrate:status

# 回滚迁移
npm run migrate:rollback

# 重新运行
npm run migrate
```

---

## 📊 监控与维护

### 定期备份

创建备份脚本 `/opt/scripts/backup.sh`:

```bash
#!/bin/bash

BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d-%H%M%S)

# 备份代码
tar -czf ${BACKUP_DIR}/code-${DATE}.tar.gz /opt/design-institute-platform

# 备份数据库
PGPASSWORD=你的密码 pg_dump -h localhost -p 5433 -U postgres design_platform > ${BACKUP_DIR}/db-${DATE}.sql

# 删除30天前的备份
find ${BACKUP_DIR} -name "*.tar.gz" -mtime +30 -delete
find ${BACKUP_DIR} -name "*.sql" -mtime +30 -delete
```

添加到crontab：

```bash
# 每天凌晨2点备份
0 2 * * * /opt/scripts/backup.sh
```

### 日志轮转

配置 `/etc/logrotate.d/mst-platform`:

```
/var/log/design-institute-platform/*.log {
    daily
    rotate 7
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

---

## 🔐 安全建议

1. ✅ **修改所有默认密码**
2. ✅ **启用防火墙，只开放必要端口**
3. ✅ **使用HTTPS（配置SSL证书）**
4. ✅ **定期更新系统和依赖**
5. ✅ **配置日志监控和告警**
6. ✅ **限制数据库远程访问**
7. ✅ **定期备份数据**

---

## 📞 技术支持

如遇问题，请查看：
- 项目文档: `/docs`
- API日志: `pm2 logs mst-api`
- 系统日志: `/var/log/design-institute-platform/`

---

*更新时间: 2025*
