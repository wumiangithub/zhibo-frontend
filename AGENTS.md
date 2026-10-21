# 接手必读（前端 agent）

本仓库只写 **Vue**。每次开工先看：

`../zhibo-shared/docs/工单.md`

有派给「前端」的待办就先做。架构、命名、API 在 `../zhibo-shared/docs/`，经常读，日常不要改。  
管理端登录（T21）：只读 `../zhibo-shared/docs/管理端登录.md` + API约定「管理端登录」，**不要**再打开墨刀原型。

总控可以改你的代码。不要改后端，也不要改 `zhibo-wxmini`，不要打开父目录 `zhibo` 当工作区。

## 必读文档（细则只在下面两份里维护，本文件不重复抄）

1. **[docs/前端协作.md](docs/前端协作.md)** — 协作流程、问清再干、端口/代理、分页/依赖等已定约束、可改范围  
2. **[docs/设计规范.md](docs/设计规范.md)** — 主题 token、**公用组件表**（图片预览、审核记录侧栏等）、模块分区  
3. [docs/进度.md](docs/进度.md) — 当前进度与阻塞项  

缺接口写在 `docs/进度.md` 阻塞项。提交前缀 `[frontend]`。

改 UI 共用能力或约束前：先查设计规范「公用组件」；协作/流程问题先查前端协作。**禁止**在本文件再写一套与上述文档重复的细则。

## 契约红线（shared 决策，本仓强制）

细则以 `../zhibo-shared/docs/API约定.md` / `决策.md` 为准，此处只列提醒：

| 编号 | 要点 |
|------|------|
| D56 | 库 `INT`/`BIGINT` id → TS `number`；UUID → `string`；勿把员工 id 当 string |
| D60 | 上传只走 TOS STS；禁微吼 `uploadImage`；objectKey 用契约目录表前缀 |
| D62 | API 路径带动作段；单业务 id 放末尾 |
| D63 | axios `baseURL=/api/v1`；禁 `@/api/v1/...` 模块路径 |
| D64 | 禁 `git checkout/restore/reset --hard/clean -fd` 覆盖未提交 WIP |
| D36 | `package.json` 无 `^`/`~`；交 lock；优先 `npm ci` |

## 代码评审

另有一个**技术总监** agent 只做 code review，结论写在 `../zhibo-shared/docs/代码评审.md`，他不改你的代码。有派给「前端」的条目就修，修完把那条状态改成 `已修` 并留一句怎么改的；不认同可以填 `不修` + 原因，别默默跳过。
