# AI辅助需求文档系统 PRD

## 项目概述

### 项目背景
解决需求文档起草难、格式不统一、细节易遗漏的痛点，通过AI辅助降低编写门槛。

### 目标用户
产品经理、独立开发者、需求分析师。

### 核心价值
- **提效**：一句话生成结构化PRD初稿。
- **降本**：局部划词AI辅助，减少重复性编辑。
- **规范**：自定义模板引擎统一输出标准。

---

## 核心功能

### 智能生成与模板管理
- **AI极速生成**：用户输入简短项目想法，AI自动扩写、补全、校正，生成文档初稿。
- **自定义配置**：导出格式为.md文件，允许自定义拼装文档板块（如核心功能、技术栈等）。
- **模板管理**：支持将高频使用的“大纲结构+配置”保存为专属模板，一键复用。

### 划词AI助手
- **悬浮菜单**：选中文本（词/句/段落）时，自动弹出AI快捷操作栏。
- **快捷指令**：提供纠错、润色、专业化、扩写、缩写等预设动作。
- **自定义修改**：支持在悬浮栏输入具体Prompt，精准控制AI修改方向。
- **Diff对比与采纳**：AI修改结果以Diff（差异对比）展示，用户可选择一键替换、拒绝或基于建议继续对话。

### 智能文档编辑器
- **双效编辑**：支持Markdown快捷键与富文本所见即所得体验。
- **基础操作**：支持文档的增删改查、重命名与另存为。
- **无感保存**：采用防抖机制，停止输入毫秒级自动保存至云端/本地。

### 工作台与资产管理
- **自动归档**：新建文档自动生成标题并归档保存。
- **工作台看板**：列表展示所有非删除文档，显示标题、创建时间及最后修改时间。
- **全局检索**：支持通过标题关键词或全文模糊搜索快速定位文档。

---

## 技术设计

### 技术栈
- **底层框架**：Next.js (App Router)
- **开发语言**：TypeScript
- **界面样式**：Tailwind CSS + Framer Motion(提供丝滑动画)
- **组件库**：shadcn/ui
- **编辑器**：TipTap (便于实现划词菜单)
- **数据库**：Prisma
- **状态管理**：Zustand
- **AI 接入**：Vercel AI SDK (处理流式输出)

### 项目结构
```text
├── app/
│   ├── api/             # AI与CRUD接口路由
│   ├── dashboard/       # 工作台页面
│   ├── editor/[id]/     # 核心编辑页面
│   └── page.tsx         # 落地页
├── components/
│   ├── editor/          # 编辑器与划词菜单组件
│   └── shared/          # 通用UI组件
├── lib/
│   ├── ai/              # AI指令与大模型封装
│   └── prisma.ts        # 数据库客户端
├── prisma/
│   └── schema.prisma    # 数据模型定义
└── store/               # Zustand全局状态
```

### 数据模型定义
```prisma
// 用户表
model User {
  id            String     @id @default(cuid())
  email         String     @unique
  documents     Document[] 
  templates     Template[] 
  createdAt     DateTime   @default(now())
}

// 需求文档表
model Document {
  id            String   @id @default(cuid())
  title         String   @default("未命名需求文档")
  content       String   @db.Text 
  isDeleted     Boolean  @default(false) 
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt 
}

// 自定义模板表
model Template {
  id            String   @id @default(cuid())
  name          String   
  structure     Json     // 存储大纲与格式配置
  fileType      String   @default("md") 
  userId        String
  user          User     @relation(fields: [userId], references: [id])
}
```

---

## 非功能性需求

- **性能体验**：AI生成必须采用流式输出（Streaming），缓解用户等待焦虑。
- **数据安全**：明确隐私政策，保证用户输入的项目创意不用于大模型训练。
- **并发限流**：限制单用户AI接口调用频率（如每分钟/每天上限），防恶意刷量。
- **多端适配**：工作台需全端适配，编辑器核心业务优先保障PC端宽屏体验。