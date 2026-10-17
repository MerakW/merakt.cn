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

本地完整数据预览使用 SQLite 在线备份生成的 `.data/paddock-preview/merak.db` 快照及原有本地媒体。设置 `LOCAL_PREVIEW=1`、`NEXT_PUBLIC_LOCAL_MEDIA=1`、`DATABASE_URL=file:./.data/paddock-preview/merak.db`、`MEDIA_DIR=./.data/media`，将 `SERVER_URL` 指向局域网地址后，以 `--hostname 0.0.0.0` 启动。`NEXT_PUBLIC_LOCAL_MEDIA` 必须同时用于构建和运行。后台认证和公开范围仍生效，本地预览采用独立 Cookie 前缀。本地字体放在 `web/public/fonts/Formula1-{Regular,Bold,Black}.ttf`；正式站上传至 COS，见下方素材上传说明。

生产升级需执行 `20261016_160000_paddock` 数据迁移。先备份数据库，再运行 `npm run payload -- migrate`；配置 `MERAK_AUTO_MIGRATE=1` 的环境会在启动时执行迁移。自动旗语使用 2026 赛历，后续年份需更新 `web/src/lib/paddock.ts`。

## 围场素材上传 COS

正式构建中，通行证的完整车队标识、TR 小盾徽、音效和 F1 字体统一从 `https://cos.merakt.cn` 读取；通行证 PNG 在浏览器中生成。`npm run preview:lan` 继续使用本地 `web/public/` 文件；正式构建和运行应将 `NEXT_PUBLIC_LOCAL_MEDIA` 留空或设为 `0`。

上传前准备以下 17 个文件。对象路径相对于 COS 根目录，勿额外加 `public/` 或 `cos-upload-paddock/` 前缀；目标存储桶使用现有 `cos.merakt.cn` 域名绑定的存储桶。上传文件来自同路径的 `web/public/`：

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
fonts/Formula1-Regular.ttf
fonts/Formula1-Bold.ttf
fonts/Formula1-Black.ttf
audio/team-radio.wav
```

前 11 个为通行证队标，第 12 个为 TR 法拉利小盾徽，第 13 个为新版星盟标识，另含 3 个 F1 字体、TR 音效。`*-full-source.svg`、旧 WebP 和其他小队徽无需上传。SVG 文件设置 `Content-Type: image/svg+xml`，TTF 字体设置 `Content-Type: font/ttf`，WAV 设置 `audio/wav`，沿用现有公开素材访问方式。例如 Ferrari 完整队标的最终地址应为 `https://cos.merakt.cn/team-logos/ferrari-full-dark.svg`。

跨域字体加载和通行证保存（读取 SVG 后生成 PNG）都需要 CORS：在 COS 存储桶的跨域访问配置中，允许来源填写 `https://merakt.cn`，如还使用其他正式站点域名则分别添加其完整 Origin；允许方法为 `GET`、`HEAD`，允许请求头可设为 `*`，缓存时间可设为 `600` 秒，无需携带 Cookie 或开放写入方法。参考[腾讯云 COS 跨域配置](https://cloud.tencent.com/document/product/436/43811)。

若 `cos.merakt.cn` 前有 CDN，应确保最终响应包含与访问站点匹配的 `Access-Control-Allow-Origin`，可参考[腾讯云 CDN 响应头配置](https://cloud.tencent.com/document/product/228/41737)。更新文件或跨域响应头后，刷新对应 URL 的 CDN 缓存，再检查 F1 字体、队标显示和“保存围场通行证 PNG”；仅能显示图片并不代表跨域读取已配置成功。

字体正式地址例如 `https://cos.merakt.cn/fonts/Formula1-Bold.ttf`；音效地址为 `https://cos.merakt.cn/audio/team-radio.wav`。素材不纳入 Git，部署前需独立上传上述文件。

本次新增及今后新增的公开图片、视频、音频和字体通过 `web/src/lib/assets.ts` 的 `assetURL()` 使用 COS，`imageURL()` 保留为兼容别名。本地预览使用本地素材。既有服务器素材和既有字体保持原加载方式，不做迁移。

保存通行证需要跨域读取队标及字体。队标展示与导出统一使用匿名 CORS，导出时重新读取资源，避免复用旧的非跨域图片缓存。若保存仍失败，请按提示区分字体或队标，检查该资源的最终 CDN 响应；`https://merakt.cn` 与 `https://www.merakt.cn` 是不同来源，实际使用的域名均须配置，或统一跳转到主域名。修改配置后刷新 CDN 缓存并重新加载页面。

## 署名

飞机插画： [Norebbo](https://www.norebbo.com/)。站点内的摄影作品按相册署名展示；源码、摄影作品、角色形象及第三方素材的使用权限应分别确认。

## 围场互动与遥测

Pit Wall 的五红灯挑战使用浏览器高精度计时，切到后台或失焦会取消当前发车。访客主动登记成绩后进入月榜和总榜（月榜按北京时间每月 1 日开始）；昵称在后台「围场互动」勾选公开后显示，此前使用访客编号。服务端校验一次性签名凭证、等待时间和成绩范围；这是休闲榜单，不是防作弊竞技排名。PTT 预设回电仅在当前窗口显示，不写入后台。部署时需执行新增迁移 `20261017_152556_paddock_interactions` 和 `20261017_155746_photo_equipment`，或使用既有自动迁移流程。

照片角落以毛玻璃参数牌展示后台填写的拍摄信息。在「媒体库 → 拍摄参数」选择拍摄介质：数码显示已填写的相机、镜头、焦段、快门、光圈和 ISO；明确选择胶片后，仅显示相机、镜头和胶片型号。未填写的项目隐藏，不推断拍摄设备。已取消滤镜切换、直方图和 Boop。公共互动接口有进程内限流；部署代理应覆盖 `X-Real-IP`，不能直接信任客户端传入的同名头。

首页航路简报直接从浏览器调用 `https://ipwho.is/` 获取城市级 IP 定位，不申请 GPS 权限，定位仅在当前页面内存中用于计算，不写入数据库或浏览器存储；坐标通过 POST 正文传递，避免进入 URL 访问日志。失败后可手动输入机场三字码。第三方定位服务仍会接收访问者 IP，因此页面承诺仅指本站不保存定位信息。第三方免费接口有额度和可用性限制，见 [IPWHOIS 文档](https://ipwhois.io/documentation)。距离按大圆航线估算，A350-900 时间按 900 km/h 加 1 小时起降余量估算，不代表真实航班。若配置 CSP，请允许 `connect-src https://ipwho.is https://cos.merakt.cn`。

顶栏保留普通深浅模式和独立遥测按钮，两者互不影响。`Cmd/Ctrl + K` 打开塔台指令窗，`T` 开关遥测视图（输入框内不触发）。遥测标注包含边框的显示尺寸，单位为 CSS 像素；rAF Hz 是前台动画回调频率，不是 GPU 实际渲染帧率，受浏览器、显示器刷新率和省电策略影响，隐藏标签页时暂停采样。TR 的 PLAY RADIO 和开窗提示音使用原始 `audio/team-radio.wav`，Web Audio 分析真实音频驱动频谱；若跨域分析失败则回退到原始音频播放。红色车手文字、白色车队文字和访客回电按顺序逐字呈现，全部完成后显示大回复按钮；重播位于底部。

分享卡片通过 `cd web && node scripts/generate-social-card.mjs` 生成 1200 × 630 PNG。生成文件位于 `web/public/social/paddock-og.png`，上传副本位于 `web/.data/cos-upload-paddock/social/paddock-og.png`。将其上传至 COS 的 `social/paddock-og.png`（`Content-Type: image/png`），正式站 OpenGraph / Twitter 元数据引用此 COS 地址。PNG 不提交 Git，部署前须独立上传；微信和 QQ 是否显示卡片由各平台抓取策略决定。

驾驶舱作为独立彩蛋保留在塔台指令窗：搜索 `Cockpit` 或“驾驶舱”进入石墨面板／青绿仪表模式，`Exit Cockpit` 恢复之前的深浅模式。顶栏切换深浅模式也会退出驾驶舱。照片光圈统一显示为 `ƒ/2.8` 等格式。候机室切换有淡入位移动画，并保留已填写内容；减少动态效果偏好下不播放过渡。异常页面覆盖未知网址、页面渲染失败／离线及根布局异常，提供重试入口，不展示内部错误堆栈。

### 故障页与发布维护

- `/status-preview` 可切换 404、页面错误、离线和全局错误的视觉预览；预览不会制造真实故障。
- `/maintenance-preview` 预览独立的 IN PIT / VSC 页面。真实维护响应为 503；预览本身为 200。
- 当前发布流程在停旧服务后备份数据、切换版本并启动新服务，因此存在停机窗口，时长取决于数据备份及启动耗时。
- 运行包包含 `maintenance/`，部署工具会在停止服务前复制至 `/opt/merak/maintenance`。需在现有 Nginx/OpenResty 应用代理 location 中加入 `proxy_intercept_errors on;` 和 `error_page 502 503 504 =503 /__maintenance.html;`，同一 server 块加入 `web/scripts/maintenance/nginx.conf` 中的精确 location。先执行代理配置检查，再 reload。若使用 1Panel 容器，需要将宿主机 `/opt/merak/maintenance` 只读挂载到代理容器同路径；不能用浏览器路径代替文件路径。尚未配置代理时，应用停止仍会显示默认网关错误。
- TR 保留原提示音，音频开始后逐字显示内容；提示音结束后的波形为视觉动画。PTT 回复只追加到当前窗口，不提交数据库，重播或关闭后重新打开会清空。
- 命令窗 `Enter Cockpit / Flight Deck` 进入独立导航和仪表布局；`Exit Flight Deck` 恢复正常界面。UTC 时钟是真实时间，不展示虚构飞行参数。

### 本轮上线顺序与数据库迁移

素材上传与数据库迁移是两个独立步骤。COS 存放图片、字体、音频；数据库迁移为反应挑战成绩和照片参数增加表及字段，不会把本地预览数据库上传到云端。

1. 先上传上方清单的 COS 文件；已上传且内容未变的文件不用重复上传。本阶段新增 `social/paddock-og.png`。保持目录层级，上传到现有素材桶；覆盖同名对象后刷新对应 CDN URL 缓存。正式构建不要设置 `NEXT_PUBLIC_LOCAL_MEDIA=1`。
2. 提交代码并推送到配置的部署 ref 后，在运行部署工具的机器进入 `web`，执行 `./deploy.sh check` 检查依赖，再执行 `./deploy.sh`。工具读取 `.env.deploy.json` 中的 ref；未提交的本地修改不会进入运行包。如果配置指向 `origin/main`，必须先将该版本推送到该分支。已有部署配置无需重新 init。
3. 既有部署工具使用 `node start-production.mjs` 启动。启动检查确认生产迁移历史、生成迁移前 SQLite 一致性备份，并设置 `MERAK_AUTO_MIGRATE=1`。Payload 启动时执行尚未记录的迁移；成功后记录历史，后续启动不重复执行。使用此流程时**不需要再手动运行 migrate**。
4. 本轮新增 `20261017_152556_paddock_interactions`（挑战成绩表、快门/光圈/ISO）及 `20261017_155746_photo_equipment`（拍摄介质、相机、镜头、焦段、胶片型号）。此前的围场迁移若未执行，也由历史检查识别为待执行项。本轮 TR 节奏、样式修正不新增数据库迁移。
5. 在云服务器用 `docker logs --tail 100 merak-web` 查看启动及迁移结果，检查后台「媒体库 → 拍摄参数」和 Pit Wall 成绩功能。部署工具还会做 API 健康检查；失败则停止新版并保留备份，不自动擦除数据。若报告开发库/历史缺失，不要强行开启 push 或重置库，需要先转换数据库副本。
6. 若云端不是由此工具管理（例如另建的 1Panel 容器），不要直接运行部署工具接管。使用生成包内的 `node start-production.mjs` 作为启动命令，保留原 PAYLOAD_SECRET、持久化数据库/媒体挂载与绝对路径配置。它会执行同一套备份及自动迁移流程。单独运行 `node server.js` 会跳过这层启动检查。

部署工具在服务器保存全量数据备份至 `/opt/merak/backups/`，运行时迁移前数据库快照默认位于持久化数据目录的 `backups/`（受管部署为宿主机 `/opt/merak/data/backups/`）。需要回退时在部署工具所在机器执行 `./deploy.sh rollback --restore-data`，会恢复上一版程序及配套数据库，回退前的当前数据会另存；升级后新增内容不会出现在恢复后的旧库里。


### 手动接入 IN PIT 维护页（1Panel / OpenResty）

维护页是独立 HTML，不上传 COS，也不需要数据库迁移。它必须在 Node 应用停止时仍能由反向代理读取。

1. 本地文件为 `web/scripts/maintenance/in-pit.html`。使用 1Panel 文件管理上传到服务器 `/opt/merak/maintenance/in-pit.html`（先建目录，文件权限 644）。既有 `deploy.sh` 发布工具会自动放置该文件，无需重复上传。
2. 若 OpenResty 在容器中，在容器挂载设置中增加只读挂载：宿主机 `/opt/merak/maintenance` → 容器 `/opt/merak/maintenance`。只上传到宿主机但不挂载，容器无法读取。
3. 编辑站点 Nginx 配置，在已有应用代理 `location /` 内加入下面两行，保留原有 proxy_pass：

```nginx
proxy_intercept_errors on;
error_page 502 503 504 =503 /__maintenance.html;
```

4. 在同一个 `server` 块中、其他 location 外面加入：

```nginx
location = /__maintenance.html {
    internal;
    alias /opt/merak/maintenance/in-pit.html;
    default_type text/html;
    add_header Retry-After 30 always;
    add_header Cache-Control "no-store" always;
}
```

5. 在 1Panel 检查配置并重载 OpenResty。先用 `/maintenance-preview` 看外观；由于配置了 internal，直接访问 `/__maintenance.html` 返回 404 是正常行为。真实接管要在计划发布窗口观察应用暂时停止后的主站响应，预期状态码 503，内容为 IN PIT；不要为了预览随意停止生产服务。

本轮分享图更新仍使用 `social/paddock-og.png` 对象路径，覆盖 COS 原文件并刷新该 URL 的 CDN 缓存即可。头像复用电子名片已有 `/images/card/avatar.webp`，无需新增上传。月榜/总榜仅修改查询范围，不新增迁移。
