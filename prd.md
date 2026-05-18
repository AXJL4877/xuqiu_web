# AI辅助需求文档系统 PRD

## 项目概述

### 项目背景
解决需求文档起草难、格式不统一、细节易遗漏的痛点，通过AI辅助降低编写门槛。

### 目标用户
产品经理、独立开发者、需求分析师。

### 核心价值
- **提效**：渐进式生成结构化PRD初稿。
- **降本**：局部划词AI辅助，减少重复性编辑。
- **规范**：自定义模板引擎统一输出标准。

---

## 核心功能

### 询问式渐进式 AI 交互智能生成

整体流程分为三阶段：**信息收集** → **确认与假设勾选** → **流式生成 PRD 初稿**。询问与生成解耦，生成阶段复用现有模板配置与流式输出能力。

#### 基础机制
- **AI 询问机制**：用户与 AI 双向交互（提问—回答—记录），信息收集充分且经用户确认后，AI 自动扩写、补全、校正，生成文档初稿。
- **打破沙锅问到底**：AI 根据用户最初提示词与当前笔记板状态，按「缺口驱动」衍生提问（非固定问卷）；确保精准理解需求，**禁止捏造、禁止自以为是**；对笔记板已充分覆盖的维度不再重复提问。
- **问题询问弹窗**：点击「开始生成」后进入询问流程；每轮以弹窗为主、**每轮 1 题**（复杂场景最多 2 题），展示动态预估剩余题数；支持单选、多选、短填空；选择题至少含一项「自定义输入」；提供「以上都不对」「跳过本题」；每题可折叠展示「为何问这题」一行说明。
- **题干与选项划词名词解释**：在弹窗的**题干**与**选项文案**中，用户可选中任意词/短语，唤起轻量划词菜单（与编辑器划词助手能力复用、交互更轻）；默认提供「名词解释」，结合当前题目与项目语境给出简明释义（面向非专业用户，避免百科式长文）；释义以浮层/侧栏展示，**不关闭询问弹窗、不打断答题**；支持一键关闭；解释内容仅作理解辅助，**不得自动写入答案或笔记板**；同一术语可缓存释义以减少重复调用。
- **结构化笔记板**：与所选模板板块对齐的分栏笔记（非整段自由文本）；每答一题自动写入对应栏；用户可实时编辑，防抖自动保存；**以用户修改后的笔记板为唯一事实源（SSOT）**；每条事实标注来源（如 `[Q3]`、`[用户编辑]`）；用户在笔记板补全某栏后，后续提问跳过该维度。
- **结束询问**：提供「结束询问」按钮，防止过度追问；点击后进入**确认页**（非直接生成），展示：已确认事实、仍缺失字段、AI 待验证假设（默认未勾选）；用户勾选接受的假设后，再进入 PRD 生成。

#### 质量与防捏造
- **事实 vs 假设分层**：已确认事实来自用户原话或笔记板；未勾选假设不得用确定语气写入正文，可放入「待确认」或「开放问题」。
- **冲突检测**：新答案与笔记板/历史回答矛盾时，优先弹出澄清题，不静默覆盖笔记板。
- **补全策略**（结束询问后、生成前可选，默认「标准」）：保守—仅列待补充；标准—合理推断且标注「（推断）」；积极—尽量补全并附「假设清单」附录。

#### 与现有能力衔接
- **模板联动**：询问开始前选择模板，缺口清单与提问范围仅覆盖模板已启用板块；生成时板块顺序与 `buildPrdSystemPrompt` 规则一致。
- **会话持久化**：询问进度、问答历史、笔记板状态可恢复（刷新/关页后续问）。
- **生成后衔接**：初稿中由假设生成的段落可在编辑器中高亮；与「划词 AI 助手」联动做证实/删改（二期可选）。

#### 接口与数据（实现参考）
- `POST /api/ai/inquiry/next`：提交回答/笔记板，返回下一题（含题干、选项、缺口元数据）。
- `POST /api/ai/inquiry/explain`：提交划词文本 + 题目上下文，流式返回名词解释。
- `POST /api/ai/inquiry/finish`：结束询问，返回确认页数据（事实/缺口/假设）。
- `POST /api/ai/generate`：body 传结构化 `notebook`（及已勾选假设），流式生成 PRD。
- 建议新增 `InquirySession`（`idea`、`notebook` Json、`messages` Json、`status`、`assumptions` Json，可选关联 `documentId`）；询问按会话限流，避免按「每题」单独计费。

#### 验收标准
1. 仅输入模糊创意，经询问后笔记板覆盖所选模板全部必填维度（或用户主动结束并确认假设）。
2. 用户修改笔记板后，下一轮不再问已覆盖维度。
3. 题干/选项内划词可获 contextual 名词解释，且不打断弹窗答题流程。
4. 「结束询问」必经确认页；未勾选假设不得出现在正文确定语气中。
5. 关闭页面再打开，询问进度与笔记板一致；生成结果板块与模板配置一致。

### 模板管理
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
- **数据库**：PostgreSQL（Prisma 7 + `@prisma/adapter-pg`，连接串 `DATABASE_URL`；迁移可用 `DIRECT_URL`）
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
│   └── prisma.ts        # PostgreSQL 客户端（PrismaPg 适配器）
├── prisma/
│   ├── schema.prisma    # 数据模型定义（provider = postgresql）
│   └── migrations/      # 数据库迁移文件
└── store/               # Zustand全局状态
```

### 数据模型定义
```prisma
datasource db {
  provider = "postgresql"
}

// 用户表
model User {
  id          String       @id @default(cuid())
  email       String       @unique
  documents   Document[]
  templates   Template[]
  aiProviders AiProvider[]
  createdAt   DateTime     @default(now())
}

// AI 模型配置（DeepSeek 等，存于 PostgreSQL）
model AiProvider {
  id        String   @id @default(cuid())
  name      String
  baseUrl   String
  apiKey    String
  model     String
  isDefault Boolean  @default(false)
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// 需求文档表
model Document {
  id        String   @id @default(cuid())
  title     String   @default("未命名需求文档")
  content   String
  isDeleted Boolean  @default(false)
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// 自定义模板表
model Template {
  id        String @id @default(cuid())
  name      String
  structure Json   // 存储大纲与格式配置
  fileType  String @default("md")
  userId    String
  user      User   @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

---

## 非功能性需求

- **性能体验**：AI生成必须采用流式输出（Streaming），缓解用户等待焦虑。
- **数据安全**：明确隐私政策，保证用户输入的项目创意不用于大模型训练。
- **并发限流**：限制单用户AI接口调用频率（如每分钟/每天上限），防恶意刷量。
- **多端适配**：工作台需全端适配，编辑器核心业务优先保障PC端宽屏体验。