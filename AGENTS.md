# 接手必读（前端 agent）

本仓库只写 **Vue**。每次开工先看：

`../zhibo-shared/docs/工单.md`

有派给「前端」的待办就先做。架构、命名、API 在 `../zhibo-shared/docs/`，经常读，日常不要改。

总控可以改你的代码。不要改后端，不要打开父目录 `zhibo` 当工作区。

1. [docs/前端协作.md](docs/前端协作.md)
2. [docs/进度.md](docs/进度.md)

缺接口写在 `docs/进度.md` 阻塞项。提交前缀 `[frontend]`。

## 依赖版本（D36，强制）

- `admin-web` / `live-web` 的 `package.json`：**禁止** `^`、`~`、`*`、`latest`，版本写到补丁号。
- 必须提交 `package-lock.json`；装依赖优先 `npm ci`。
- 已有 `.npmrc`：`save-exact=true`。新增包后检查没有浮动范围。
- 升级第三方库：改 `package.json` + 重装更新 lock，写进进度说明原因；不要默默升小版本。

## 代码评审

另有一个**技术总监** agent 只做 code review，结论写在 `../zhibo-shared/docs/代码评审.md`，他不改你的代码。有派给「前端」的条目就修，修完把那条状态改成 `已修` 并留一句怎么改的；不认同可以填 `不修` + 原因，别默默跳过。

## 问清再干（用户约定）

用户提的所有问题/需求：**有不清楚的先问用户，问清楚再动手；没有不清楚的就直接干。** 细则见 [docs/前端协作.md](docs/前端协作.md)。
