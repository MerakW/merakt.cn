# Merak · 数字围场

[merakt.cn](https://merakt.cn) 是 Merak 的个人网站，记录飞行、旅行、影像和日常。这里有一本可以慢慢翻的相册、一份持续更新的飞行日志，也有一间欢迎访客留言的候机室。

## 在这里可以看到什么

- **围场**：近况与站点内容入口。
- **飞行**：航程、机场、航司与机型收藏，路线地图，以及出位、起飞、接地、入位等实际运行时间。时间按机场当地时区展示。
- **毛五**：Fursuit Friday 影像记录，支持按年份浏览、照片放大与短片播放。
- **日志**：文章与旅行记录。
- **候机室**：领取一张访客登机牌，留下到访记录。
- **关于**：个人介绍与电子名片。

站点支持深浅主题。相册和航程列表会在接近底部时自动追加内容，图片加载中显示骨架占位；飞机灯光仅用于顶部登机牌和展开详情。动画遵循系统的减少动态效果设置。飞行记录是个人记录，不作为实时航班信息服务。

## 内容管理

网站使用 Payload CMS 管理内容。管理员可以编辑文章、相册和航班，审核访客留言，也可以拖入一张照片并粘贴文案，完成压缩、上传 COS 和发布。

飞行记录支持 Flighty CSV 导入、实际运行时间补齐及可选的航班信息同步。内容可以保留私有或按设置公开；订票资料及原始导入数据不属于公开展示内容。

后台支持密码和通行密钥登录。支持的浏览器可通过原生自动填充选择通行密钥，也可使用页面上的登录按钮。正式使用需要 HTTPS；通行密钥绑定到注册时的站点域名。

## 技术栈

- Next.js、React、TypeScript
- Payload CMS、SQLite
- 腾讯云 COS / CDN、Sharp 图片处理
- WebAuthn / SimpleWebAuthn
- Temporal、D3 地理投影

应用源码位于 [`web/`](web/)，页面、组件和服务端逻辑位于 `web/src/`，构建及运行工具位于 `web/scripts/`。

## 本地运行

需要 Node.js **22.13 或更高的 22.x 版本**，也可使用项目声明支持的 24.x 版本。

```sh
cd web
npm ci
cp .env.example .env
```

编辑 `.env`，设置独立的 `PAYLOAD_SECRET` 与本地数据库、站点地址等配置；已有环境文件时保留原配置。然后启动：

```sh
npm run dev
```

访问 [本地站点](http://127.0.0.1:3000)；内容后台位于 `/admin`，管理登录入口位于 `/manage/login`。

数据库、私人媒体、机模与其他图片素材不随源码分发。运行自己的实例时，需要配置自己的素材及存储服务；COS 上传和外部航班同步需另行配置服务端凭据。

常用检查与构建命令：

```sh
npm run typecheck
npm test
npm run build
```

## 部署

项目提供 Linux AMD64 独立运行包及 SSH 部署工具，构建需要本机 Docker 和 Python 3。站点数据与程序包分开保存；生产环境通过反向代理提供 HTTPS。

```sh
cd web
./deploy.sh init
# 在生成的本地配置文件中填写自己的部署目标、Git ref 和公开素材路径
./deploy.sh
```

也可仅生成运行包：

```sh
npm run package:linux -- --assets /path/to/public-assets --output /path/to/releases
```

部署前需要配置固定密钥、持久化数据目录及运行环境变量，并按项目迁移流程更新数据库。真实凭据、数据库和私人素材应保存在自己的运行环境中。

## 围场功能

`/pit-wall` 合并运行遥测与管理入口；管理员登录后显示发布、审核和设置操作，`/manage` 跳转至该页。S / M / H / I 配方可在文章、相册与近况中选择。Team Radio 读取最新公开近况，使用 51 号，侧边按钮可开关；Escape 可关闭。只有文章详情显示标题与 Sector 阅读进度。

ERS 显示 V8 堆内存余量；OT 显示本地资源模式或已确认的 CDN 配置；构建寿命优先使用 `DEPLOYED_AT`，否则读取实际构建时间。内容查询延迟来自公开日志计数查询，访问 Pit Wall 时采样，最多每分钟保存一次，保留 24 小时；不代表外部网络延迟或可用率。采样文件默认在 `.data/telemetry/content-latency.json`，可用 `CONTENT_TELEMETRY_FILE` 覆盖。

运行 `cd web && npm run preview:lan` 即可自行构建并启动局域网预览，命令会自动检测当前局域网地址，按 Ctrl+C 停止。

本地完整数据预览使用 SQLite 在线备份生成的 `.data/paddock-preview/merak.db` 快照及原有本地媒体。设置 `LOCAL_PREVIEW=1`、`NEXT_PUBLIC_LOCAL_MEDIA=1`、`DATABASE_URL=file:./.data/paddock-preview/merak.db`、`MEDIA_DIR=./.data/media`，将 `SERVER_URL` 指向局域网地址后，以 `--hostname 0.0.0.0` 启动。`NEXT_PUBLIC_LOCAL_MEDIA` 必须同时用于构建和运行。后台认证和公开范围仍生效，本地预览采用独立 Cookie 前缀。字体放在 `web/public/fonts/Formula1-{Regular,Bold,Black}.ttf`，随本地素材单独提供。

生产升级需执行 `20261016_160000_paddock` 数据迁移。先备份数据库，再运行 `npm run payload -- migrate`；配置 `MERAK_AUTO_MIGRATE=1` 的环境会在启动时执行迁移。自动旗语使用 2026 赛历，后续年份需更新 `web/src/lib/paddock.ts`。

## 署名

飞机插画： [Norebbo](https://www.norebbo.com/)。站点内的摄影作品按相册署名展示；源码、摄影作品、角色形象及第三方素材的使用权限应分别确认。
