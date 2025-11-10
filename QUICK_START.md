# 🚀 快速部署指南

## 步骤总览

```
本地打包 → 上传服务器 → 自动部署 → 访问应用
  (5分钟)    (传输时间)     (10分钟)    (完成)
```

---

## 📦 步骤1: 本地打包（在你的Mac上）

```bash
cd /Users/shenguoli/Documents/projects/design-institute-platform

# 运行打包脚本
./package.sh
```

✅ 完成后会生成 `release.tar.gz` 文件

---

## 📤 步骤2: 上传到服务器

### 方式A: 使用SCP

```bash
# 上传文件
scp release.tar.gz root@你的服务器IP:/tmp/

# 示例
scp release.tar.gz root@192.168.1.100:/tmp/
```

### 方式B: 使用SFTP工具

推荐工具：
- FileZilla
- Transmit (Mac)
- WinSCP (Windows)

上传 `release.tar.gz` 到服务器 `/tmp/` 目录

---

## 🚀 步骤3: 服务器部署

### 3.1 SSH登录服务器

```bash
ssh root@你的服务器IP
```

### 3.2 解压并运行部署脚本

```bash
# 创建部署目录
mkdir -p /opt/mst-platform
cd /opt/mst-platform

# 解压
tar -xzf /tmp/release.tar.gz

# 运行部署脚本
chmod +x deploy.sh
./deploy.sh
```

### 3.3 配置数据库密码

部署脚本会提示你编辑 `.env` 文件：

```bash
vi /opt/mst-platform/current/.env
```

修改以下配置（使用你服务器上的实际密码）：

```bash
# PostgreSQL
DB_PASSWORD=postgres        # 改为你的实际密码

# Redis
REDIS_PASSWORD=redis123     # 改为你的实际密码

# Neo4j
NEO4J_PASSWORD=neo4j123     # 改为你的实际密码

# JWT密钥（生成一个32位随机字符串）
JWT_SECRET=请生成一个32位以上的随机字符串
```

💡 **生成随机密钥**:
```bash
openssl rand -base64 32
```

### 3.4 重启服务

```bash
pm2 restart all
```

---

## 🔍 步骤4: 验证部署

### 检查服务状态

```bash
# 查看PM2进程
pm2 list

# 应该看到:
# ┌─────┬──────────────────┬─────────┬─────────┐
# │ id  │ name             │ status  │ cpu     │
# ├─────┼──────────────────┼─────────┼─────────┤
# │ 0   │ mst-api          │ online  │ 0%      │
# │ 1   │ mst-document     │ online  │ 0%      │
# │ 2   │ mst-vector       │ online  │ 0%      │
# └─────┴──────────────────┴─────────┴─────────┘
```

### 测试API

```bash
curl http://localhost:3000/health

# 应返回: {"status":"ok"}
```

---

## 🌐 步骤5: 配置Nginx（可选）

如果要通过域名访问，需要配置Nginx反向代理：

### 5.1 创建Nginx配置

```bash
sudo vi /etc/nginx/sites-available/mst-platform
```

粘贴以下内容：

```nginx
server {
    listen 80;
    server_name 你的域名.com;  # 修改为你的域名或IP

    # 前端
    location / {
        root /opt/mst-platform/current/apps/web/dist;
        try_files $uri $uri/ /index.html;
        gzip on;
    }

    # API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    client_max_body_size 100M;
}
```

### 5.2 启用配置

```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/mst-platform /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启Nginx
sudo systemctl reload nginx
```

---

## ✅ 完成！

现在可以访问你的应用：

- **前端**: http://你的服务器IP 或 http://你的域名.com
- **API**: http://你的服务器IP:3000 或 http://你的域名.com/api
- **Neo4j**: http://你的服务器IP:7474
- **MinIO**: http://你的服务器IP:9001

---

## 🛠 常用管理命令

```bash
# 查看服务状态
pm2 list

# 查看日志
pm2 logs

# 重启服务
pm2 restart all
pm2 restart mst-api

# 停止服务
pm2 stop all

# 查看资源占用
pm2 monit
```

---

## ❓ 遇到问题？

### 问题1: 数据库连接失败

```bash
# 检查PostgreSQL是否运行
sudo systemctl status postgresql

# 测试连接
PGPASSWORD=你的密码 psql -h localhost -p 5433 -U postgres -d design_platform
```

### 问题2: 端口被占用

```bash
# 查看端口占用
sudo netstat -tlnp | grep 3000

# 杀死进程
sudo kill -9 进程ID
```

### 问题3: PM2服务无法启动

```bash
# 查看错误日志
pm2 logs mst-api --err

# 删除并重新启动
pm2 delete all
cd /opt/mst-platform/current/apps/api
pm2 start src/app.js --name mst-api
```

---

## 📚 详细文档

完整部署文档请查看: [DEPLOYMENT.md](./DEPLOYMENT.md)

---

## 🔐 安全提示

1. ⚠️ **修改所有默认密码**
2. ⚠️ **配置防火墙规则**
3. ⚠️ **启用HTTPS（推荐Let's Encrypt）**
4. ⚠️ **定期备份数据库**

---

*祝部署顺利！🎉*
