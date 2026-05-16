# Vercel 部署指南

## 前置条件

- GitHub 仓库已推送代码（如 `AXJL4877/xuqiu_web`）
- 一个 **PostgreSQL** 数据库（不能再用本地 SQLite）

推荐（免费起步）：

| 服务 | 说明 |
|------|------|
| [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres) | 控制台一键创建，与 Vercel 集成最好 |
| [Neon](https://neon.tech) | 免费档，需配置 `DATABASE_URL` + `DIRECT_URL` |
| [Supabase](https://supabase.com) | 免费 PostgreSQL |

---

## 一、在 Vercel 创建项目

1. 打开 [vercel.com](https://vercel.com) 并登录  
2. **Add New → Project**  
3. 导入 GitHub 仓库 `xuqiu_web`  
4. Framework 选 **Next.js**（自动识别）  
5. 先不要点 Deploy，先配置数据库和环境变量  

---

## 二、配置 PostgreSQL

### 方式 A：Vercel Postgres（推荐）

1. 项目 → **Storage** → **Create Database** → **Postgres**  
2. 创建后，在 **Connect to Project** 里勾选你的项目  
3. Vercel 会自动注入 `POSTGRES_URL` 等变量  

在 **Settings → Environment Variables** 中新增（或让 Vercel 自动映射）：

| 变量名 | 值 |
|--------|-----|
| `DATABASE_URL` | 使用 Storage 提供的 ** pooled ** 连接串（含 `pooler` 或 Prisma 兼容 URL） |
| `DIRECT_URL` | 使用 **非 pooled** 直连串（用于迁移，若有） |

> 若只有 `POSTGRES_URL`，可复制到 `DATABASE_URL`；有 `POSTGRES_URL_NON_POOLING` 则填到 `DIRECT_URL`。

### 方式 B：Neon

1. [neon.tech](https://neon.tech) 创建项目  
2. 复制 **Pooled connection** → `DATABASE_URL`  
3. 复制 **Direct connection** → `DIRECT_URL`  

---

## 三、环境变量（Production / Preview / Development 都勾选）

| 变量 | 必填 | 说明 |
|------|------|------|
| `DATABASE_URL` | ✅ | PostgreSQL 连接串（应用 + 构建迁移） |
| `DIRECT_URL` | 建议 | 直连串，供 `prisma migrate deploy`（Neon / Vercel Postgres） |

无需在 Vercel 配置 DeepSeek Key：在网站 **设置页** 保存到数据库即可。

---

## 四、构建设置（一般默认即可）

| 项 | 值 |
|----|-----|
| Build Command | `npm run build` |
| Install Command | `npm install` |
| Output Directory | （留空，Next.js 默认） |
| Node.js Version | 20.x |

`npm run build` 会执行：

1. `prisma migrate deploy`（建表/更新表）  
2. `next build`  

`postinstall` 会执行 `prisma generate`。

---

## 五、部署

点击 **Deploy**，等待构建完成。

访问：`https://你的项目名.vercel.app`

首次使用请在网站内重新配置 **AI 模型（DeepSeek）**，数据库为空。

---

## 六、套餐与超时

| 路由 | `maxDuration` | 说明 |
|------|---------------|------|
| `/api/ai/generate` | 120s | 长 PRD 生成 |
| `/api/ai/selection` | 60s | 划词助手 |

- **Hobby（免费）**：Serverless 最长约 **10 秒**，长生成可能超时  
- **Pro**：可调至约 **60 秒** 或更高  

若免费版经常超时，需升级 Pro 或优化为更短输出。

---

## 七、更新代码

推送到 GitHub `main` 分支后，Vercel 会自动重新部署。

```bash
git add .
git commit -m "your message"
git push origin main
```

---

## 八、故障排查

| 现象 | 处理 |
|------|------|
| Build 失败 `DATABASE_URL` | 在 Vercel 环境变量中配置数据库连接 |
| `migrate deploy` 失败 | 配置 `DIRECT_URL`（Neon/Vercel Postgres 直连） |
| 页面 500 / 数据库错误 | 查看 **Deployments → Functions → Logs** |
| AI 无响应 | 在应用设置中重新保存 API Key；确认能访问 `api.deepseek.com` |
| 生成中途断开 | 免费版超时，考虑升级 Pro |
