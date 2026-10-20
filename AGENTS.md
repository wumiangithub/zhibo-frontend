# 接手必读（前端 agent）

本仓库只写 **Vue**。每次开工先看：

`../zhibo-shared/docs/工单.md`

有派给「前端」的待办就先做。架构、命名、API 在 `../zhibo-shared/docs/`，经常读，日常不要改。  
管理端登录（T21）：只读 `../zhibo-shared/docs/管理端登录.md` + API约定「管理端登录」，**不要**再打开墨刀原型。

总控可以改你的代码。不要改后端，也不要改 `zhibo-wxmini`，不要打开父目录 `zhibo` 当工作区。

1. [docs/前端协作.md](docs/前端协作.md)
2. [docs/进度.md](docs/进度.md)

缺接口写在 `docs/进度.md` 阻塞项。提交前缀 `[frontend]`。

## 主键 / 外键类型（D56，强制）

类型跟库走，**禁止**把数字 id 改成十进制 string：

- 库列 `INT` / `BIGINT`（含 `rs_mainkey_id`、员工/部门/角色 id、`hostIds` / `ownerIds` / `hostId`、审核人、上传人）→ TypeScript `number`，请求/响应 JSON 也是数字。
- 库列 UUID / `VARCHAR`（活动 / 课程 / 素材 / 报备 id）→ `string`。
- 下拉、Map、表单字段的 key / value 与接口类型一致，不要 `Map<string, …>` 去装员工 id。
- 例外：确知可能超过 JS `Number.MAX_SAFE_INTEGER` 的外部大整数才用 string，并在该字段说明原因（当前仅订单中心 `spuId`）。
- 观看端进出场 `userId` 是第三方观众标识，不是员工 `rs_mainkey_id`，保持 string。

细则见 `../zhibo-shared/docs/API约定.md`「通则 · 主键 / 外键类型」。

## 路径前缀（D63，强制）

- 本站 axios `baseURL` 为 **`/api/v1`**；业务封装写相对路径（如 `/live-reports/list` → 实际 `GET /api/v1/live-reports/list`）。
- 细则见 `../zhibo-shared/docs/API约定.md`「通则 · 路径前缀」。

## 路径命名（D62，强制）

- 封装管理端 API 时路径必须带动作段（如 `/activities/create`、`/live-reports/list`），**禁止**靠 HTTP 方法区分同名 URL。
- 单业务 id 放末尾（如 `/activities/audits/${id}`、`/activities/members/list/${id}`），禁止 `/activities/${id}/audits`；多 id 用 params/body。
- 素材/课程/org/watch 等封装已按 D62 改完；对齐契约与决策。细则见 `../zhibo-shared/docs/API约定.md`「通则 · 路径命名」。

## 图片 / 文件上传（D60，强制）

- **禁止**调用 `POST /api/v1/uploads/image`（微吼代理）及前端 `uploadImage`；该接口已废弃。
- 一律：`GET /api/v1/uploads/tos-sts` → 浏览器直传 TOS → CDN/可访问 URL；管理端用 `admin-web/src/utils/tosUpload.ts`（或素材中心既有路径）。
- 对象 key **必须**用 `../zhibo-shared/docs/API约定.md` tos-sts「对象 key 目录」表中的前缀；新功能先登记前缀再编码，禁止自创或塞进 `upload/`。

## 依赖版本（D36，强制）

- `admin-web` / `live-web` 的 `package.json`：**禁止** `^`、`~`、`*`、`latest`，版本写到补丁号。
- 必须提交 `package-lock.json`；装依赖优先 `npm ci`。
- 已有 `.npmrc`：`save-exact=true`。新增包后检查没有浮动范围。
- 升级第三方库：改 `package.json` + 重装更新 lock，写进进度说明原因；不要默默升小版本。

## 代码评审

另有一个**技术总监** agent 只做 code review，结论写在 `../zhibo-shared/docs/代码评审.md`，他不改你的代码。有派给「前端」的条目就修，修完把那条状态改成 `已修` 并留一句怎么改的；不认同可以填 `不修` + 原因，别默默跳过。

## 问清再干（用户约定）

用户提的所有问题/需求：**有不清楚的先问用户，问清楚再动手；没有不清楚的就直接干。** 细则见 [docs/前端协作.md](docs/前端协作.md)。
