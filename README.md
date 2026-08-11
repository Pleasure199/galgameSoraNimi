<div align="center">

# 天一把 (tianyiba)

**Galgame 角色猜测游戏 —— 类 Wordle 玩法，猜出目标角色即获胜**

[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Node.js ≥ 22](https://img.shields.io/badge/node-%E2%89%A522-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![npm workspaces](https://img.shields.io/badge/npm-workspaces-CB3837?logo=npm&logoColor=white)](https://www.npmjs.com/)

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![React 18](https://img.shields.io/badge/React_18-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?logo=express&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-FF4438?logo=redis&logoColor=white)

[玩法](#玩法) · [功能特性](#功能特性) · [快速开始](#快速开始) · [角色数据](#角色数据) · [项目结构](#项目结构) · [贡献](#贡献)

</div>

---

## 玩法

输入角色名，系统按 **作品 / 所属会社 / 发售时间 / 性别 / 声优 / 发色 / 发长** 逐属性给出对比反馈：

- 🟩 **绿色** —— 该属性与答案完全一致
- 🟨 **黄色** —— 接近（同发色色系、发售年份相差不超过 2 年）
- ↑↓ **箭头** —— 数值型属性（发售时间）提示答案更早或更晚

8 次机会内猜出目标角色即获胜，猜中角色名同样直接获胜。

## 功能特性

- 🎮 **单人模式** —— 可选择入门版 / 简单版 / 完整版角色池，进行中对局可断线续玩
- 🔍 **查角色** —— 按角色名 / 作品 / 声优模糊搜索角色资料
- 📊 **统计与回放** / 🏆 **排行榜** / 📢 **公告**
- 👤 **无需登录** —— 匿名访客可直接游玩，战绩按浏览器本地标识记账，登录后自动并入账号
- 🀄 **中文界面** —— 当前仅提供简体中文（暂时移除多语言切换），角色名 / 作品 / 会社均使用简体中文官方译名
- 🎨 **双主题** —— Blast 暗色 / 日间浅色，首次访问跟随系统偏好

> 本作是 [弗一把 (csgofriberg)](https://github.com/shnlfriberg/csgofriberg) 玩法的角色扮演改编：猜测对象从 CS Major 选手改为 galgame 角色，并精简为纯单机玩法。

## 技术栈

| 层     | 技术                                             |
| ------ | ------------------------------------------------ |
| 前端   | React 18 + Vite + TypeScript + React Router      |
| 后端   | Node.js + Express + TypeScript                   |
| 数据库 | PostgreSQL 16（VNDB 原始表在 vndb schema，应用表在 public） |
| 缓存   | Redis（可选，缺位时内存降级）                    |
| 认证   | JWT + bcrypt（HttpOnly Cookie，客户端不存明文）  |
| 校验/测试 | Zod / Vitest                                 |
| 包管理 | npm workspaces                                   |

## 快速开始

**环境要求**：Node.js ≥ 22、npm、PostgreSQL 16、Redis（可选，本地开发可降级为内存模式）。

```bash
npm install
cp .env.example .env    # 修改 DB_URL 指向本机 PostgreSQL
npm run dev             # server: 3000, client: 5173
```

访问 http://localhost:5173 。

首次初始化数据库：

```bash
npm run migrate
node scripts/buildBangumiNameMap.mjs
node scripts/importVndbCharacters.mjs
```

### 运行时行为说明

- Redis 默认连接 `redis://127.0.0.1:6379`；生产环境可设 `REDIS_REQUIRED=true`，Redis 故障时拒绝启动而非降级
- 访客显示 ID 使用 HMAC-SHA256 派生，可用 `GUEST_ID_SALT` 配置独立盐（未配置时复用 `JWT_SECRET`）
- 单人进行中的对局只保存在 Redis，**1800 秒（30 分钟）** 无有效操作自动过期；猜中、次数耗尽或查看答案后才写入数据库，主动离开或重新开始只清理临时状态、不产生历史战绩
- 无 Redis 时进行中对局降级为内存存储，重启即丢失；排行榜与公告等热点查询有本地内存缓存兜底

## 常用脚本

| 命令             | 说明                              |
| ---------------- | --------------------------------- |
| `npm run dev`    | 同时启动前后端开发服务            |
| `npm run build`  | 构建前端 + 编译后端               |
| `npm start`      | 生产模式启动（server 托管 client/dist）|
| `npm test`       | 运行前后端测试                    |
| `npm run migrate`| 初始化用户/战绩/公告等数据库结构    |

## 角色数据

角色数据存储在 PostgreSQL 的 `characters` 表，数据源为 VNDB 数据库导出 `vndb-db-2026-08-07`，并通过 Bangumi 简体中文名补齐日文/罗马音角色的译名。当前共 13373 名角色，服务启动时从 PostgreSQL 构建内存缓存。字段包括：

```
name / work / company / release_year / gender / cv / hair_color / hair_color_family / hair_length / difficulties
```

- 难度归属直接写在每条角色上（如 `["normal"]`、`["normal","easy"]`、`["normal","easy","beginner"]`），保证入门 ⊂ 简单 ⊂ 普通
- 发色与色系值须与前端 `GameRules` 色系列表一致，否则同色系「黄色」判定会失效
- 发长以 VNDB 词条属性为主
- 角色名优先使用有来源的简体中文译名（Bangumi 简体中文名、项目原有译名）；日文/罗马音角色只有在找到可靠译名后才进入角色池
- `vndb` schema：VNDB 原始表（chars、chars_names、chars_traits、chars_vns、vn、vn_titles、vn_seiyuu 等）
- `public.characters`：应用侧角色表，名称唯一，`difficulties` 使用 JSON 数组文本保存
- `public.character_name_overrides`：有来源的简体中文译名覆盖表
- 批量导入：`node scripts/importVndbCharacters.mjs` 从 VNDB schema 生成 `characters` 表
- `server/data/*.json` 仅作为一次性迁移种子，运行时不读取

## 项目结构

```
server
├── data/              # characters.json 角色数据源
└── src
    ├── config.ts      # 环境配置
    ├── db/            # Knex 实例、建表（不含角色数据）
    ├── middleware/    # 认证、Zod 校验、限流、错误处理
    ├── routes/        # auth / characters / game / stats / leaderboard / announcements
    └── services/      # 游戏判定、角色缓存、单人对局存储等
client/src
├── api/               # axios 封装、角色列表缓存
├── store/             # auth / theme / guest 等轻量状态
├── i18n/              # 中文文案与错误码翻译
├── components/        # Page / GuessBoard / GuessInputBar / GameRules / ...
└── pages/             # Home / SingleGame / SingleLobby / Search / Stats / ...
```

## 贡献

- 🐛 [问题反馈 / 功能建议](https://github.com/shnlfriberg/csgofriberg/issues/new/choose)
- 提交 PR 前请运行 `npm test` 与 `npm run build`；所有用户可见文案维护在 `client/src/i18n/resources.ts`（当前仅简体中文生效）

## 许可证

本项目基于 [Apache-2.0](LICENSE) 开源。
