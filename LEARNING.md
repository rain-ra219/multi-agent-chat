# 学习笔记 / Learning Notes

> 从零开始搭建多模型协作对话网站 — 当前进度

---

## 第一课：基础概念

### 网页的三个角色（餐厅模型）

| 角色 | 餐厅类比 | 技术 |
|------|---------|------|
| 前端 | 服务员端菜 | React 组件（page.tsx） |
| 后端 | 后厨做菜 | API Routes（route.ts） |
| 数据库 | 冰箱存货 | 还没用到 |

### 什么是框架

框架 = 毛坯房。地基、承重墙、水电管道已经铺好，你只负责装修（写业务逻辑）。

Next.js 帮你省掉的事：
- 路由解析（URL → 文件自动对应）
- HTTP 协议处理
- 构建打包
- 前后端通信

---

## 第二课：Next.js 项目结构

```
src/app/
├── layout.tsx      ← 网站外壳（不变的部分）
├── page.tsx         ← 首页内容
└── api/
    └── chat/
        └── route.ts ← /api/chat 的后端逻辑
```

关键规则：
- 文件名即 URL 路径
- `page.tsx` = 用户能访问的页面
- `route.ts` = API 接口
- `"use client"` = 有交互逻辑的组件需要这行

---

## 第三课：前后端如何连接

前端和后端之间**只有一个连接方式：HTTP 请求**

```
前端 page.tsx                   后端 route.ts
    │                               │
    │  fetch("/api/chat", {         │
    │    body: { messages }         │
    │  })                           │
    │  ──────── HTTP POST ───────▶  │
    │                               │  fetch("api.deepseek.com", ...)
    │                               │  ────────▶ DeepSeek
    │                               │  ◀──────── 回复
    │  ◀─────── JSON 响应 ────────  │
    │                               │
    ▼                               ▼
 界面更新                        返回数据
```

为什么不能从前端直接调 DeepSeek：API Key 是密码，放前端会暴露。

---

## 第四课：核心概念速查

| 概念 | 一句话 |
|------|--------|
| `useState` | 数据变了，界面自动刷新 |
| `useEffect(fn, [deps])` | 在特定时机自动执行代码 |
| `[]` 空依赖 | 只在页面加载时执行一次 |
| `[messages]` 依赖 | messages 每变一次就执行一次 |
| `localStorage.setItem()` | 存数据到浏览器 |
| `localStorage.getItem()` | 从浏览器取数据 |
| `.env.local` | 存密码/Key，Git 不会上传 |
| `.gitignore` | 黑名单，写进去的文件 Git 忽略 |

---

## 第五课：Git 操作

```bash
git init              # 初始化（一次）
git remote add origin # 关联远程仓库（一次）
git add .             # 暂存所有修改
git commit -m "..."   # 提交到本地
git push              # 推送到 GitHub
```

---

## 当前项目状态

✅ 一个能跟 DeepSeek 对话的网页  
✅ 聊天记录持久化（localStorage，刷新不丢）  
✅ 代码已上传 GitHub  

---

## 下一步计划

| 路线 | 内容 |
|------|------|
| A | 接入多个模型（OpenAI + DeepSeek），页面加模型选择器 |
| B | 给每个模型配角色/系统提示词 |
| C | 多模型流水线协作（@A 丰富 → @B 评价） |
