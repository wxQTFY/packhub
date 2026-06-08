# PackHub

软件安装包管理平台，基于 Vite + Vue 3 + TypeScript + Element Plus + Node/Express。

## 功能

- 管理员登录后台，创建、编辑、停用和删除用户
- 管理员为用户配置功能权限：前台下载、用户管理、软件管理
- 上传 `.zip` 安装包，并归类为发行版本、公测版本、历史版本
- 后台管理安装包发布状态，前台仅展示已发布版本
- 用户登录后按权限查看下载入口并下载 zip 文件
- 使用 SQLite 保存用户、安装包、下载统计和下载日志
- 上传 zip 后校验文件内容并生成 SHA256，下载支持断点续传

## 启动

```bash
npm install --include=dev
npm run dev
```

默认访问地址：

- 前端：http://localhost:5173/
- 后端：http://localhost:3001/

默认管理员：

- 账号：admin
- 密码：admin123

## 局域网部署

在部署电脑上执行：

```bash
npm install --include=dev
npm run build
npm start
```

生产环境建议先配置：

```bash
PORT=3001
JWT_SECRET=replace-with-a-long-random-secret
MAX_UPLOAD_MB=1024
```

启动后，同一局域网内的其他电脑访问：

```text
http://部署电脑IP:3001/
```

Windows 查看本机局域网 IP：

```bat
ipconfig
```

找到当前网卡的 `IPv4 地址`，例如 `192.168.1.20`，则访问地址为：

```text
http://192.168.1.20:3001/
```

如果其他电脑打不开，需要在 Windows 防火墙中放行 TCP 端口 `3001`，或执行：

```bat
netsh advfirewall firewall add rule name="PackHub 3001" dir=in action=allow protocol=TCP localport=3001
```

## 常用命令

```bash
npm run dev        # 同时启动前端和后端
npm run dev:web    # 只启动 Vite 前端
npm run server     # 只启动 Node 后端
npm start          # 生产模式启动，托管 dist 前端和 API
npm run build      # 前端类型检查和生产构建
npm run pm2:start  # 使用 PM2 守护运行
npm run pm2:logs   # 查看 PM2 日志
```

## 目录结构

```text
server/
  index.ts         # Express API、鉴权、上传和下载
  data/packhub.sqlite # 本地 SQLite 数据库，首次启动自动生成
  uploads/         # zip 安装包存储目录
logs/              # 应用、PM2、下载日志
src/
  api/             # Axios 封装
  layouts/         # 登录后主布局
  router/          # Vue Router 和权限守卫
  stores/          # Pinia 登录态
  views/           # 登录、前台下载、后台管理页面
```

## 后续生产化建议

- 按部署环境配置强随机 `JWT_SECRET`
- 使用对象存储或专用文件服务保存安装包
- 增加版本唯一性规则和更完整的操作审计

更完整的优化规划见：[PackHub 优化方案](docs/optimization-roadmap.md)
部署细节见：[部署和运行稳定性](docs/deployment.md)
