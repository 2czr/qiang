# 校园墙项目

## 项目概览

校园墙是一个校园社交平台，包含消息墙、实时聊天室、私聊和好友系统功能。支持超级管理员角色，仅超管可在聊天室查看其他用户的账号和角色信息。

### 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4
- **Database**: Supabase (PostgreSQL + Drizzle ORM for schema)
- **Auth**: 自定义 Bearer Token + Cookie Session（SHA-256 密码哈希，前端优先使用 Bearer Token）

## 目录结构

```
├── public/                 # 静态资源
├── scripts/                # 构建与启动脚本
├── src/
│   ├── app/
│   │   ├── page.tsx            # 主入口（Auth 判断 + 路由）
│   │   ├── main-app.tsx        # 主应用 Shell（导航 + Tab 切换）
│   │   ├── login/              # 登录/注册页面
│   │   ├── wall/               # 校园墙模块
│   │   │   └── campus-wall.tsx # 发帖/评论/点赞组件
│   │   ├── chat/               # 聊天模块
│   │   │   ├── chat-room.tsx   # 聊天室组件（含超管用户管理+头像点击私聊）
│   │   │   └── private-chat.tsx # 私聊组件（支持从聊天室跳转）
│   │   ├── friends/            # 好友模块
│   │   │   └── friends-panel.tsx # 好友列表/请求管理组件
│   │   └── api/                # API 路由
│   │       ├── auth/           # 登录/注册/用户信息
│   │       ├── wall/           # 帖子/评论/点赞/置顶
│   │       ├── chat/           # 聊天室/私聊
│   │       └── admin/          # 超管用户管理（删除/封禁/角色/查看内容）
│   ├── components/ui/      # Shadcn UI 组件库
│   ├── lib/
│   │   ├── auth.ts             # 认证工具（密码哈希/Session/Cookie）
│   │   ├── auth-context.tsx    # React Auth Context
│   │   └── utils.ts            # 通用工具函数
│   └── storage/database/       # Supabase 数据库
│       ├── supabase-client.ts  # Supabase 客户端
│       └── shared/
│           ├── schema.ts       # Drizzle 表结构定义
│           └── relations.ts    # 表关系定义
├── next.config.ts
├── package.json
└── tsconfig.json
```

## 数据库模型

| 表名 | 说明 | 关键字段 |
|------|------|---------|
| users | 用户表 | id, username, nickname, role(user/admin/super_admin), status(active/frozen/deleted), password_hash, device_id |
| wall_posts | 校园墙帖子 | id, user_id, content, image_url, is_anonymous, is_pinned |
| post_comments | 帖子评论 | id, post_id, user_id, content |
| post_likes | 帖子点赞 | id, post_id, user_id |
| chat_rooms | 聊天室 | id, name, description |
| chat_messages | 聊天消息 | id, room_id, user_id, content, image_url |
| private_messages | 私聊消息 | id, sender_id, receiver_id, content, image_url, is_read |
| friend_requests | 好友请求 | id, sender_id, receiver_id, status(pending/accepted/rejected), created_at |

## API 接口

| 路径 | 方法 | 说明 | 认证 |
|------|------|------|------|
| /api/auth/login | POST | 登录 | 否 |
| /api/auth/register | POST | 注册 | 否 |
| /api/auth/me | GET | 获取当前用户 | 是 |
| /api/wall/posts | GET/POST | 获取/发布帖子 | GET 否, POST 是 |
| /api/wall/comments | GET/POST | 获取/发布评论 | GET 否, POST 是 |
| /api/wall/likes | POST | 点赞/取消点赞 | 是 |
| /api/wall/pin | POST | 置顶/取消置顶 | 是(管理员) |
| /api/chat/rooms | GET | 获取聊天室列表 | 否 |
| /api/chat/messages | GET/POST | 获取/发送聊天消息 | GET 否, POST 是 |
| /api/chat/private | GET/POST | 获取/发送私聊消息 | 是 |
| /api/chat/private/list | GET | 获取私聊对话列表 | 是 |
| /api/admin/users/[id] | GET/DELETE | 查看用户详情/硬删除用户(永久删除+级联) | 是(超管) |
| /api/admin/users/[id]/freeze | POST | 封禁/解封用户 | 是(超管) |
| /api/admin/users/[id]/role | POST | 修改用户角色 | 是(超管) |
| /api/admin/users/[id]/permissions | POST | 修改管理员权限 | 是(超管) |
| /api/admin/users/[id]/posts | GET | 查看用户帖子 | 是(超管) |
| /api/admin/users/[id]/messages | GET | 查看用户聊天记录 | 是(超管) |
| /api/upload/image | POST | 上传图片(S3) | 是 |
| /api/friends/request | POST/GET | 发送好友请求/获取请求列表 | 是 |
| /api/friends/respond | POST | 接受/拒绝好友请求 | 是 |
| /api/friends/list | GET/DELETE | 好友列表/删除好友 | 是 |
| /api/friends/status | GET | 查询好友关系状态 | 是 |

## 核心业务逻辑

- **超管权限控制**: 聊天室消息 API 根据当前用户角色决定返回的用户信息字段。super_admin 可看到 username 和 role，普通用户只能看到 nickname 和 avatar_url。
- **超管用户管理**: 超管可在聊天室点击用户头像，查看用户帖子/聊天记录，封禁/解封/删除账号，设置管理员角色，配置管理员权限。
- **管理员权限系统**: admin 角色用户可通过超管配置 permissions (canPin, canDelete, canViewUser, canManageRole)，存储为 jsonb。
- **认证方式**: 同时支持 Cookie 和 Authorization Bearer Token 认证，前端优先使用 Bearer Token (通过 authFetch 工具函数)。
- **账号状态**: 用户有 active/frozen/deleted 三种状态，frozen 无法登录。超管删除用户为硬删除（永久删除+级联删除关联数据）。
- **一机一号限制**: 注册时记录 device_id（设备指纹），同一设备仅允许注册一个账号，防止恶意刷号。
- **免责声明**: 登录页面底部展示免责声明，用户发布言论仅代表个人观点，与本平台无关。
- **置顶广告区**: 校园墙顶部预留置顶广告专属展示区域（AdBanner组件），独立区块不遮挡普通帖子。
- **匿名发帖**: 校园墙支持匿名发布，匿名帖子的用户信息在 GET 时被遮蔽为"匿名用户"（user_id 仍存储但前端不展示）。
- **帖子撤回**: 帖子作者和管理员可撤回帖子（POST /api/wall/posts/delete），级联删除评论和点赞。
- **图片支持**: 校园墙帖子、聊天室消息、私聊消息均支持发送图片，通过 S3 对象存储上传。
- **私聊入口**: 聊天室中点击头像触发 private-chat 事件，跳转到私信页面。
- **消息轮询**: 聊天室和私聊每 3 秒轮询一次新消息。
- **好友系统**: 校园墙帖子可加好友，好友Tab管理好友列表和请求。双向请求自动接受，支持删除好友。
- **登录持久化**: Token 保存在 localStorage，页面刷新后自动恢复登录状态。

## 超级管理员账号

- 用户名: `admin`
- 密码: `admin123`
- 角色: `super_admin`

## 构建与测试命令

- `pnpm ts-check` - TypeScript 类型检查
- `pnpm lint` / `pnpm lint:build` - ESLint 检查
- `pnpm dev` - 启动开发环境（端口 5000）
- `pnpm build` - 构建生产版本
- `pnpm start` - 启动生产环境

## 编码规范

- TypeScript strict 模式，禁止隐式 any
- 字段名统一 snake_case（数据库列名）
- 每次数据库操作必须检查 error 并 throw
- Supabase SDK 做数据操作，Drizzle 仅做 Schema 定义
- 密码哈希使用 SHA-256 + salt，Session 使用 Base64 编码的 JSON payload
