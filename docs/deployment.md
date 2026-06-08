# PackHub 部署和运行稳定性

## 生产启动

```bash
npm install --include=dev
npm run build
npm start
```

生产环境建议设置环境变量：

```bash
PORT=3001
JWT_SECRET=replace-with-a-long-random-secret
MAX_UPLOAD_MB=1024
```

## PM2 守护进程

PM2 会在服务崩溃后自动重启，并把日志写入 `logs/`。

```bash
npm run build
npm run pm2:start
npm run pm2:logs
```

常用命令：

```bash
npm run pm2:restart
npm run pm2:stop
npm run pm2:status
```

## Windows 开机自启动

在 Windows 部署机上执行：

```bat
npm run build
npm run pm2:start
npx pm2 save
npx pm2-startup install
```

如果 `pm2-startup` 不可用，可以用 Windows 任务计划程序创建登录时任务，动作填写：

```text
程序: npm
参数: run pm2:start
起始于: PackHub 项目目录
```

## 启动检查

PackHub 启动时会检查：

- Node.js 版本是否满足 SQLite 运行要求
- 端口配置是否合法
- `server/data/`、`server/uploads/`、`logs/` 是否可写
- `JWT_SECRET` 是否配置

健康检查接口：

```text
GET /api/health
```

## 数据和日志

- SQLite 数据库：`server/data/packhub.sqlite`
- 旧 JSON 自动迁移备份：`server/data/db.json.migrated-*.bak`
- 应用日志：`logs/app.log`
- PM2 日志：`logs/pm2-out.log`、`logs/pm2-error.log`
- 下载日志：`logs/downloads.log`
