# 🚀 MST-AI平台 - 快速部署指南

## 📋 服务器信息

- **数据库服务器**: 10.10.19.4 (PostgreSQL, Redis, Neo4j, Milvus, MinIO)
- **应用服务器**: 10.10.19.3 (运行你的平台)
- **用户名**: aiuser
- **密码**: asd123465QWE

---

## ⚡ 5步部署

### 第1步: 本地打包 (你的Mac)

```bash
cd /Users/shenguoli/Documents/projects/design-institute-platform
./package.sh
```

✅ 生成 `release.tar.gz`

---

### 第2步: 上传到应用服务器

```bash
scp release.tar.gz aiuser@10.10.19.3:/tmp/
# 密码: asd123465QWE
```

---

### 第3步: 配置数据库服务器防火墙

**SSH登录数据库服务器**:
```bash
ssh aiuser@10.10.19.4
# 密码: asd123465QWE
```

**开放端口**:
```bash
# 允许应用服务器访问所有数据库服务
sudo ufw allow from 10.10.19.3 to any port 5432
sudo ufw allow from 10.10.19.3 to any port 6379
sudo ufw allow from 10.10.19.3 to any port 7687
sudo ufw allow from 10.10.19.3 to any port 19530
sudo ufw allow from 10.10.19.3 to any port 9000

# 查看规则
sudo ufw status
```

**配置PostgreSQL远程访问**:
```bash
# 编辑配置
sudo vi /etc/postgresql/*/main/postgresql.conf
# 修改: listen_addresses = '*'

sudo vi /etc/postgresql/*/main/pg_hba.conf
# 添加: host all all 10.10.19.3/32 md5

# 重启
sudo systemctl restart postgresql
```

**配置Redis远程访问**:
```bash
sudo vi /etc/redis/redis.conf
# 修改:
#   bind 0.0.0.0
#   requirepass 你的密码

sudo systemctl restart redis
```

**配置Neo4j远程访问**:
```bash
sudo vi /etc/neo4j/neo4j.conf
# 修改: dbms.default_listen_address=0.0.0.0

sudo systemctl restart neo4j
```

**创建数据库**:
```bash
sudo -u postgres psql
CREATE DATABASE design_platform;
\q
```

---

### 第4步: 部署到应用服务器

**SSH登录应用服务器**:
```bash
ssh aiuser@10.10.19.3
# 密码: asd123465QWE
```

**运行部署**:
```bash
cd /tmp
tar -xzf release.tar.gz -C ~/
cd ~/release
sudo ./deploy-to-server.sh
```

**配置数据库密码**:

脚本会提示编辑环境变量，或手动编辑:
```bash
sudo vi /opt/mst-platform/current/.env
```

修改这些配置:
```bash
DB_PASSWORD=你的PostgreSQL密码
REDIS_PASSWORD=你的Redis密码
NEO4J_PASSWORD=你的Neo4j密码
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
JWT_SECRET=$(openssl rand -base64 32)
```

保存后重启:
```bash
pm2 restart all
```

---

### 第5步: 访问应用

在浏览器打开:
```
http://10.10.19.3
```

---

## 🎯 端口使用

### 应用服务器 (10.10.19.3)
| 服务 | 端口 | 访问地址 |
|-----|------|---------|
| 前端 | 80 | http://10.10.19.3 |
| API | 3000 | http://10.10.19.3:3000 |
| 文档服务 | 8086 | 内部服务 |
| 向量服务 | 8085 | 内部服务 |

### 数据库服务器 (10.10.19.4)
| 服务 | 端口 | 访问地址 |
|-----|------|---------|
| PostgreSQL | 5432 | 内部访问 |
| Redis | 6379 | 内部访问 |
| Neo4j | 7474/7687 | http://10.10.19.4:7474 |
| Milvus | 19530 | 内部访问 |
| MinIO | 9000/9001 | http://10.10.19.4:9001 |
| Elasticsearch | 9200 | 内部访问 |

---

## 🔍 验证部署

```bash
# 在应用服务器上
pm2 list

# 测试API
curl http://localhost:3000/health

# 查看日志
pm2 logs
```

---

## 🛠 常用命令

```bash
# 重启所有服务
pm2 restart all

# 查看日志
pm2 logs

# 查看监控
pm2 monit

# 停止服务
pm2 stop all

# 重启Nginx
sudo systemctl restart nginx
```

---

## ❓ 遇到问题?

### 无法连接数据库
```bash
# 测试连接
nc -zv 10.10.19.4 5432

# 检查防火墙
ssh aiuser@10.10.19.4
sudo ufw status
```

### API无法启动
```bash
pm2 logs mst-api --err
```

### 前端无法访问
```bash
sudo systemctl status nginx
sudo tail -f /var/log/nginx/mst-platform-error.log
```

---

## 📚 完整文档

详细说明: [SERVER_DEPLOYMENT_GUIDE.md](./SERVER_DEPLOYMENT_GUIDE.md)

---

**部署完成后访问**: http://10.10.19.3 🎉
