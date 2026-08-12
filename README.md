# 天一把 (tianyiba)

**Galgame 角色猜测游戏**：类 Wordle 玩法，根据逐属性反馈在 8 次机会内猜出目标角色。

[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Node.js >= 22](https://img.shields.io/badge/node-%E2%89%A522-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![npm workspaces](https://img.shields.io/badge/npm-workspaces-CB3837?logo=npm&logoColor=white)](https://www.npmjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React 18](https://img.shields.io/badge/React_18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![Express](https://img.shields.io/badge/Express-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-FF4438?logo=redis&logoColor=white)](https://redis.io/)

## 目录

- [玩法](#玩法)
- [功能特性](#功能特性)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [常用命令](#常用命令)
- [角色数据](#角色数据)
- [项目结构](#项目结构)
- [贡献](#贡献)
- [许可证](#许可证)

## 玩法

输入角色名后，系统会按以下属性给出逐项反馈：

| 属性 | 说明 |
| --- | --- |
| 作品 | 目标角色所属作品 |
| 所属会社 | 作品开发/发行会社 |
| 发售时间 | 作品发售年份 |
| 性别 | 角色性别 |
| 声优 | 角色声优 |
| 发色 | 角色发色 |
| 发长 | 角色发型长度 |

反馈规则：

- 🟩 绿色：该属性与答案完全一致。
- 🟨 黄色：接近答案，例如同发色色系，或发售年份相差不超过 2 年。
- ↑↓ 箭头：数值型属性提示答案更早或更晚。

在 8 次机会内猜中目标角色即获胜。

## 功能特性

- 🎮 单人模式：支持入门版 / 简单版 / 完整版三档角色池，进行中的对局可断线续玩。
- 🔍 查角色：支持按角色名 / 作品 / 声优模糊搜索，自动补全不设数量上限。
- 📚 角色库浏览：支持显示全部角色、按难度筛选、按作品搜索、按会社查看全部作品。
- 📊 统计与回放、🏆 排行榜、📢 公告。
- 👤 匿名游玩：无需登录即可开始，战绩按浏览器本地标识记账，登录后自动并入账号。
- 🀄 中文数据：角色名、作品名、会社名优先使用有来源的简体中文译名。
- 🎨 双主题：Blast 暗色与日间浅色主题，首次访问跟随系统偏好。

> 本项目是 [弗一把 (csgofriberg)](https://github.com/Pleasure199/galgameSoraNimi) 玩法的角色扮演改编：将猜测对象从 CS Major 选手改为 galgame 角色，并精简为纯单机玩法。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | React 18 + Vite + TypeScript + React Router |
| 后端 | Node.js + Express + TypeScript |
| 数据库 | PostgreSQL 16 |
| 缓存 | Redis（可选，缺失时自动降级为内存模式） |
| 认证 | JWT + bcrypt（HttpOnly Cookie） |
| 校验 / 测试 | Zod / Vitest |
| 包管理 | npm workspaces |

## 快速开始

### 环境要求

- Node.js ≥ 22
- npm
- PostgreSQL 16
- Redis（可选，本地开发可降级为内存模式）

### 安装与启动

```bash
npm install
cp .env.example .env
```

编辑 `.env`，确认 `DB_URL` 指向本机 PostgreSQL：

```bash
DB_CLIENT=pg
DB_URL=postgres://tianyiba:tianyiba@127.0.0.1:5432/tianyiba
```

启动开发服务：

```bash
npm run dev
```

- 前端：http://localhost:5173
- 后端 API：http://localhost:3000

### 初始化数据库

首次运行时先初始化数据库结构：

```bash
npm run migrate
```

角色数据来自 VNDB 数据库导出 `vndb-db-2026-08-07`。将 dump 导入 PostgreSQL 的 `vndb` schema（参见该目录下的 `README.txt`）后，执行：

```bash
npm run db:import-vndb
```

如需用 Bangumi 数据补齐简体中文译名，可先运行：

```bash
npm run db:build-bangumi-names
```

该脚本默认读取 `/private/tmp/bgm2` 下的 Bangumi `jsonlines` 导出，可通过 `BGM_DIR` 环境变量指定目录。

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 同时启动前后端开发服务 |
| `npm run build` | 构建前端并编译后端 |
| `npm start` | 生产模式启动（server 托管 client/dist） |
| `npm test` | 运行前后端测试 |
| `npm run test:client` | 仅运行前端测试 |
| `npm run migrate` | 初始化数据库结构 |
| `npm run db:import-vndb` | 从 VNDB schema 生成应用角色表 |
| `npm run db:build-bangumi-names` | 生成 Bangumi 简体中文译名映射 |

## 角色数据

角色数据存储在 PostgreSQL 的 `characters` 表中，服务启动时从数据库构建内存缓存，当前共 13373 名角色。

### 字段

```
name / work / company / release_year / gender / cv / hair_color / hair_color_family / hair_length / difficulties
```

### 数据说明

- 难度归属直接写在每条角色上，如 `["normal"]`、`["normal","easy"]`、`["normal","easy","beginner"]`，保证入门 ⊂ 简单 ⊂ 普通。
- 发色与色系值必须与前端 `GameRules` 色系列表一致，否则同色系「黄色」判定会失效。
- 发长以 VNDB 词条属性为主。
- 角色名优先使用有来源的简体中文译名（Bangumi 简体中文名、项目原有译名）；日文/罗马音角色只有在找到可靠译名后才进入角色池。

### 数据库结构

- `vndb` schema：VNDB 原始表（`chars`、`chars_names`、`chars_traits`、`chars_vns`、`vn`、`vn_titles`、`vn_seiyuu` 等）。
- `public.characters`：应用侧角色表，名称唯一，`difficulties` 以 JSON 数组文本保存。
- `public.character_name_overrides`：有来源的简体中文译名覆盖表。

旧 `server/data/*.json` 已移除，角色数据只从 PostgreSQL 读取。

## 项目结构

```
.
├── client/                 # React 前端
│   ├── public/             # 静态资源（含新海天主题图片）
│   └── src/
│       ├── api/            # axios 封装、角色列表缓存
│       ├── components/     # Page / GuessBoard / GuessInputBar / GameRules 等
│       ├── i18n/           # 界面文案与错误码翻译
│       ├── pages/          # Home / Search / SingleGame / Stats 等
│       ├── store/          # auth / theme / guest 等轻量状态
│       ├── styles/         # 全局样式与主题
│       └── utils/          # 难度、反馈等工具函数
├── server/                 # Express 后端
│   └── src/
│       ├── config.ts       # 环境配置
│       ├── db/             # Knex 实例与建表
│       ├── middleware/     # 认证、Zod 校验、限流、错误处理
│       ├── routes/         # auth / characters / game / stats / leaderboard / announcements
│       └── services/       # 游戏判定、角色缓存、单人对局存储等
├── scripts/                # 数据导入与文档生成脚本
└── vndb-db-2026-08-07/     # VNDB 数据库导出（本地数据源，不纳入 git）
```

## 贡献

- 问题反馈 / 功能建议：[GitHub Issues](https://github.com/Pleasure199/galgameSoraNimi/issues/new/choose)
- 提交 PR 前请运行 `npm test` 与 `npm run build`。
- 用户可见文案维护在 `client/src/i18n/resources.ts`。
- 角色数据与难度池相关改动集中在 `scripts/` 与 `vndb-db-2026-08-07/`。

## 许可证

本项目基于 [Apache-2.0](LICENSE) 开源。
