# 阿里云 ECS 部署指南

本项目通过 **Docker Compose** 在单台 ECS 上运行：PostgreSQL + Next.js + Nginx。

## 一、准备阿里云资源

### 1. 购买 ECS

- **地域**：离用户近的（如华东、华南）
- **镜像**：Ubuntu 22.04 或 24.04 LTS
- **规格**：建议 2 核 4 GB 起
- **带宽**：按访问量，个人使用 1–5 Mbps 即可
- **系统盘**：40 GB 起

### 2. 配置安全组

入方向放行：

| 端口 | 用途 |
|------|------|
| 22 | SSH 登录 |
| 80 | HTTP 访问网站 |
| 443 | HTTPS（配置证书后） |

> 不要将 PostgreSQL 5432 暴露到公网。

### 3. （可选）域名

在阿里云域名控制台将域名 **A 记录** 解析到 ECS 公网 IP。

---

## 二、登录 ECS 并安装 Docker

```bash
ssh root@你的ECS公网IP

# 上传代码方式任选其一：
# A. Git 克隆（推荐）
apt-get update && apt-get install -y git
git clone https://github.com/AXJL4877/xuqiu_web.git
cd xuqiu_web

# B. 或在本机打包上传后解压

# 安装 Docker
sudo bash deploy/install-docker-ubuntu.sh
```

---

## 三、配置并启动

```bash
cd xuqiu_web   # 项目根目录

# 1. 生产环境变量
cp deploy/env.production.example .env.production
nano .env.production   # 修改 POSTGRES_PASSWORD 为强密码

# 2. 一键构建并启动
bash deploy/bootstrap-ecs.sh
```

启动后包含三个容器：

- `postgres`：数据库（仅内网）
- `app`：Next.js 应用
- `nginx`：反向代理，对外 80 端口

浏览器访问：`http://你的ECS公网IP`

---

## 四、常用运维命令

```bash
# 查看状态
docker compose -f docker-compose.prod.yml --env-file .env.production ps

# 查看应用日志
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f app

# 更新代码后重新部署
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# 停止
docker compose -f docker-compose.prod.yml --env-file .env.production down
```

---

## 五、使用阿里云 RDS PostgreSQL（可选，更稳）

若不想在 ECS 上跑数据库容器：

1. 购买 **RDS PostgreSQL**，创建数据库与用户
2. 修改 `.env.production`，增加：

   ```env
   DATABASE_URL=postgresql://用户:密码@RDS内网地址:5432/数据库名?schema=public
   ```

3. 编辑 `docker-compose.prod.yml`，删除 `postgres` 服务，并在 `app` 的 `environment` 中使用上面的 `DATABASE_URL`
4. 在 RDS 白名单中加入 ECS 内网 IP

---

## 六、HTTPS（推荐）

可使用以下任一方式：

1. **阿里云 SSL 证书** + 在 Nginx 配置 443（需改 `deploy/nginx.conf`）
2. **宝塔面板** 在 ECS 上管理 Nginx 与证书
3. 前置 **阿里云 CDN / SLB** 做 HTTPS 终结

---

## 七、首次使用应用

新数据库为空，需：

1. 打开网站首页
2. 在设置中重新配置 **DeepSeek API**（Base URL / API Key / 模型）
3. 重新创建或生成文档

---

## 八、故障排查

| 现象 | 处理 |
|------|------|
| 无法访问 80 端口 | 检查安全组、`.env.production` 中 `HTTP_PORT`、容器是否运行 |
| 应用启动失败 | `logs -f app`，常见为数据库未就绪或 `DATABASE_URL` 错误 |
| 迁移失败 | 确认 postgres 容器健康：`docker compose ... ps` |
| AI 无响应 | 在应用内重新保存 API 配置，检查 ECS 能否访问 `api.deepseek.com` |
