# 直播项目 · 前端仓库

本仓库只放 **Vue 前端**（`admin-web` + `live-web`）。  
后端 / 架构在隔壁：`D:\ai-project\qoder\zhibo`

## 给前端模型

先读 [`AGENTS.md`](./AGENTS.md) 和 [`docs/前端协作.md`](./docs/前端协作.md)。  
**不要打开后端仓库，不要改 Java。**

本仓库的 git 提交 = 前端改动。提交信息建议前缀 `[frontend]`。

## 启动

```bat
cd admin-web
npm install
npm run dev
```

```bat
cd live-web
npm install
npm run dev
```

- 管理端：http://127.0.0.1:5173 ，`/api` 代理到后端 `8081`
- 观看端：http://127.0.0.1:5174 ，`/api` 代理到后端 `8082`
