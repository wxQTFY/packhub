# PackHub

PackHub 是面向局域网内部使用的软件安装包管理平台，用于集中维护软件分类、版本、发布说明、安装包和下载记录。

项目采用 Vue 3 + TypeScript + Element Plus 构建前端，Node.js + Express 提供 API 和文件下载服务，SQLite 保存业务数据。

## 核心功能

### 软件下载

- 前台分类仪表盘，按软件分类进入下载区
- 分类下载页顶部快速切换其他软件分类
- 按稳定版本、公测版本、历史版本分组展示
- 查看版本详情、发布说明、更新日志、标签、文件大小和 SHA256
- 显示版本下载次数和当前稳定版标识
- 下载进度和结果反馈
- 支持 HTTP Range 断点续传

### 软件版本管理

- 上传并校验 `.zip` 安装包
- 自动计算文件 SHA256
- 同一软件下版本号唯一校验
- 管理软件名称、版本号、分类、标签和发布说明
- 管理发行版本、公测版本和历史版本
- 设置当前稳定版，旧稳定版自动归档
- 将历史版本回滚为当前稳定版
- 控制版本是否在前台发布
- 删除版本时同步删除对应安装包文件

### 分类管理

- 默认保留 `手术导航`、`智能教培` 两个分类
- 管理员可在后台手动添加分类
- 默认分类不可删除
- 删除自定义分类后，该分类下的软件自动归入 `手术导航`
- 旧 `教培系统` 分类自动迁移为 `智能教培`
- 其他旧分类在升级时自动归入 `手术导航`

### 用户、权限和审计

- 管理员创建、编辑、停用和删除用户
- 按用户配置软件下载、用户管理、软件管理权限
- 后台仪表盘展示版本、分类、下载量和热门软件统计
- 下载记录展示下载账号、时间、软件版本、分类、IP 和客户端
- 下载记录仅具有软件管理权限的管理员可见

### 数据和运行稳定性

- 使用 SQLite 单文件数据库
- 首次启动自动迁移旧 `server/data/db.json`
- 自动修复历史文件名乱码和异常版本状态
- 自动补全历史安装包 SHA256
- 自动清理无效安装包文件
- 启动时检查 Node.js 版本、端口和目录写入权限
- 支持 PM2 守护、崩溃自动重启和文件日志

## 技术栈

- 前端：Vue 3、TypeScript、Vite、Element Plus、Pinia、Vue Router、Axios
- 后端：Node.js、Express、TypeScript、JWT、Multer
- 数据库：Node.js 内置 SQLite
- 进程守护：PM2

## 环境要求

- Node.js 24 或更高版本
- npm
- Windows、Linux 或 macOS

PackHub 使用 Node.js 内置的 `node:sqlite`，低于 Node.js 24 的环境无法启动。

## 快速开始

安装依赖：

```bash
npm install --include=dev
```

开发模式：

```bash
npm run dev
```

默认访问地址：

- 前端开发服务：`http://localhost:5173/`
- 后端 API：`http://localhost:3001/`

默认管理员：

- 账号：`admin`
- 密码：`admin123`

首次登录后应立即修改默认管理员密码。

## 生产部署

### 配置环境变量

参考 `.env.example`，在系统环境、启动终端或 PM2 启动环境中设置：

```bash
PORT=3001
JWT_SECRET=replace-with-a-long-random-secret
MAX_UPLOAD_MB=1024
```

项目当前不会自动加载 `.env` 文件。

配置说明：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3001` | 服务监听端口 |
| `JWT_SECRET` | 开发默认值 | JWT 签名密钥，生产环境必须设置强随机值 |
| `MAX_UPLOAD_MB` | `1024` | 单个安装包最大上传体积，单位 MB |

### 构建并启动

```bash
npm install --include=dev
npm run build
npm start
```

生产模式由 Express 同时托管构建后的前端页面和 API：

```text
http://部署电脑IP:3001/
```

### PM2 守护运行

```bash
npm run build
npm run pm2:start
npm run pm2:status
npm run pm2:logs
```

其他 PM2 命令：

```bash
npm run pm2:restart
npm run pm2:stop
```

Windows 开机自启动、任务计划程序和防火墙配置见 [部署和运行稳定性](docs/deployment.md)。

## 使用流程

### 管理员

1. 使用默认管理员账号登录并修改密码。
2. 在“分类管理”中维护软件分类。
3. 在“软件版本”中上传安装包并填写版本信息。
4. 设置版本类型、发布状态和当前稳定版。
5. 在“用户权限”中创建账号并分配权限。
6. 在“下载记录”中查看用户下载行为。

### 下载用户

1. 登录后进入“软件下载”。
2. 从前台仪表盘选择软件分类。
3. 在分类页面查看稳定版本、公测版本和历史版本。
4. 查看版本详情或直接下载安装包。

## 权限说明

| 权限 | 功能 |
| --- | --- |
| `portal.download` | 访问软件下载、版本详情和安装包下载 |
| `admin.software` | 访问后台仪表盘、软件版本、分类管理和下载记录 |
| `admin.users` | 管理用户和权限 |

## 数据和文件

| 路径 | 说明 |
| --- | --- |
| `server/data/packhub.sqlite` | SQLite 数据库 |
| `server/data/db.json.migrated-*.bak` | 旧 JSON 数据迁移备份 |
| `server/uploads/` | 安装包文件 |
| `logs/app.log` | 应用日志 |
| `logs/downloads.log` | 下载文本日志 |
| `logs/pm2-out.log` | PM2 标准输出日志 |
| `logs/pm2-error.log` | PM2 错误日志 |

部署和备份时，应同时备份 `server/data/packhub.sqlite` 和 `server/uploads/`。

## 常用命令

```bash
npm run dev          # 同时启动前端和后端开发服务
npm run dev:web      # 只启动 Vite 前端开发服务
npm run dev:server   # 以监听模式启动后端
npm run server       # 启动后端
npm start            # 生产模式启动，托管 dist 前端和 API
npm run build        # 前端类型检查和生产构建
npm run preview      # 预览生产构建
npm run pm2:start    # 使用 PM2 守护运行
npm run pm2:restart  # 重启 PM2 服务
npm run pm2:stop     # 停止 PM2 服务
npm run pm2:status   # 查看 PM2 状态
npm run pm2:logs     # 查看 PM2 日志
```

健康检查接口：

```text
GET /api/health
```

## 目录结构

```text
packhub/
├─ server/
│  ├─ index.ts                 # Express API、鉴权、SQLite、上传和下载
│  ├─ data/                    # SQLite 数据库和迁移备份
│  └─ uploads/                 # zip 安装包
├─ src/
│  ├─ api/                     # Axios 请求封装
│  ├─ layouts/                 # 登录后主布局
│  ├─ router/                  # 路由和权限守卫
│  ├─ stores/                  # Pinia 登录状态
│  └─ views/
│     ├─ admin/                # 仪表盘、版本、分类、用户、下载记录
│     └─ portal/               # 软件分类仪表盘、下载列表、版本详情
├─ docs/                       # 部署和优化文档
├─ logs/                       # 应用和 PM2 日志
├─ ecosystem.config.cjs        # PM2 配置
└─ .env.example                # 环境变量示例
```

## 安全和运维建议

- 生产环境必须设置强随机 `JWT_SECRET`
- 首次登录后立即修改默认管理员密码
- 定期备份 SQLite 数据库和安装包目录
- 仅在可信局域网开放 PackHub 服务端口
- 多人并发下载大文件时，可使用 Nginx 承担静态文件传输
- 定期检查 `logs/` 和后台下载记录

更完整的规划见 [PackHub 优化方案](docs/optimization-roadmap.md)。
