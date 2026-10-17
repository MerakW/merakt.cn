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

## 围场素材上传 COS

正式构建中，通行证的完整车队标识、TR 小盾徽和通行证 PNG 导出统一从 `https://cos.merakt.cn` 读取。`npm run preview:lan` 继续使用本地 `web/public/` 文件；正式构建和运行应将 `NEXT_PUBLIC_LOCAL_MEDIA` 留空或设为 `0`。

上传前准备以下 13 个文件。对象路径相对于 COS 根目录，勿额外加 `public/` 或 `cos-upload-paddock/` 前缀；目标存储桶使用现有 `cos.merakt.cn` 域名绑定的存储桶。上传文件来自同路径的 `web/public/`：

```text
team-logos/ferrari-full-dark.svg
team-logos/mclaren-full-dark.svg
team-logos/mercedes-full-dark.svg
team-logos/redbullracing-full-dark.svg
team-logos/astonmartin-full-dark.svg
team-logos/alpine-full-dark.svg
team-logos/williams-full-dark.svg
team-logos/haasf1team-full-dark.svg
team-logos/audi-full-dark.svg
team-logos/cadillac-full-dark.svg
team-logos/racingbulls-full-dark.svg
team-logos/ferrari-hq.svg
alliances/star-tight.svg
```

前 11 个为通行证队标，第 12 个为 TR 法拉利小盾徽，最后一个为新版星盟标识。`*-full-source.svg`、旧 WebP 和其他小队徽无需上传。所有文件设置 `Content-Type: image/svg+xml`，沿用现有公开素材访问方式。例如 Ferrari 完整队标的最终地址应为 `https://cos.merakt.cn/team-logos/ferrari-full-dark.svg`。

通行证保存通过浏览器读取 SVG 后生成 PNG，因此需要 CORS：在 COS 存储桶的跨域访问配置中，允许来源填写 `https://merakt.cn`，如还使用其他正式站点域名则分别添加其完整 Origin；允许方法为 `GET`、`HEAD`，允许请求头可设为 `*`，缓存时间可设为 `600` 秒，无需携带 Cookie 或开放写入方法。参考[腾讯云 COS 跨域配置](https://cloud.tencent.com/document/product/436/43811)。

若 `cos.merakt.cn` 前有 CDN，应确保最终响应包含与访问站点匹配的 `Access-Control-Allow-Origin`，可参考[腾讯云 CDN 响应头配置](https://cloud.tencent.com/document/product/228/41737)。更新文件或跨域响应头后，刷新对应 URL 的 CDN 缓存，再检查队标显示和“保存围场通行证 PNG”；仅能显示图片并不代表跨域读取已配置成功。

字体 `fonts/Formula1-{Regular,Bold,Black}.ttf` 和音效 `audio/team-radio.wav` 本次仍随站点部署。素材不纳入 Git，部署前需独立上传上述文件。

## 署名

飞机插画： [Norebbo](https://www.norebbo.com/)。站点内的摄影作品按相册署名展示；源码、摄影作品、角色形象及第三方素材的使用权限应分别确认。
