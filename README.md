# Multi-Agent Chat / 多模型协作对话平台

A visual multi-model AI chat platform. Create multiple AI agents with different roles, let them work in pipelines or discuss together.

一个可视化的多模型 AI 对话平台。创建多个不同角色的 AI 智能体，让它们以流水线或讨论模式协作。

---

## Features / 功能

- [x] Single-model chat (DeepSeek)
- [x] Conversation history persistence (localStorage)
- [ ] Multi-model management
- [ ] Role / system prompt per model
- [ ] Pipeline workflow (A → B → C)
- [ ] Discussion mode

---

## Tech Stack / 技术栈

| Layer 层 | Tech 技术 |
|-----------|-----------|
| Framework 框架 | Next.js 16 |
| Frontend 前端 | React 19 + Tailwind CSS 4 |
| Backend 后端 | Next.js API Routes |
| Language 语言 | TypeScript |

---

## Getting Started / 本地启动

```bash
# 1. Install dependencies / 安装依赖
npm install

# 2. Set up API keys / 配置 API Key
#    Copy .env.local and fill in your keys
#    复制 .env.local 并填入你的 API Key
#    DEEPSEEK_API_KEY=sk-xxx

# 3. Start dev server / 启动开发服务器
npm run dev

# 4. Open / 打开浏览器
#    http://localhost:3000
```

---

## Environment Variables / 环境变量

| Variable 变量 | Description 说明 |
|---------------|------------------|
| `DEEPSEEK_API_KEY` | DeepSeek API Key |
| `DEEPSEEK_BASE_URL` | DeepSeek API address 接口地址 |

---

## Project Structure / 项目结构

```
src/
├── app/
│   ├── layout.tsx          # Site shell / 网站外壳
│   ├── page.tsx            # Chat page / 聊天首页
│   ├── globals.css         # Global styles / 全局样式
│   └── api/
│       └── chat/
│           └── route.ts    # AI API proxy / AI 接口中转
├── .env.local              # API keys (gitignored) / API 密钥（不上传 Git）
└── ...
```

---

## License / 协议

MIT
