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

### Pit Wall 资源加速状态

`CDN_EDGE_CACHE_ACTIVE` 是部署确认标记，不会自动开通 CDN 或修改缓存规则。正式站素材地址由 `web/src/lib/assets.ts` 指向 `https://cos.merakt.cn`；本地预览的 `NEXT_PUBLIC_LOCAL_MEDIA=1` 会优先显示 `LOCAL`。

1. 确认素材域名已在 CDN 控制台启用，回源到承载公开素材的 COS 桶，CNAME、HTTPS 证书与文件路径正确。仅缓存公开素材；后台、登录、私有媒体和业务 API 不应纳入公共缓存。
2. 配置静态文件缓存，并在覆盖同名对象后刷新对应 URL。字体和通行证导出依赖跨域读取，按下文保留 `Access-Control-Allow-Origin: https://merakt.cn`。若启用了 Referer 防盗链，检测请求也须携带允许的正式站来源；无 Referer 的 403 不能单独证明正式页面加载失败。
3. 正式构建设置 `NEXT_PUBLIC_LOCAL_MEDIA=0`，运行设置 `LOCAL_PREVIEW=0`。用正式站来源检查素材成功返回与缓存命中、跨域响应后，在运行环境中设置 `CDN_EDGE_CACHE_ACTIVE=true` 并重启应用，Pit Wall 将显示 `ENABLED`。

使用仓库的单命令部署脚本时，运行环境来自服务器 `/opt/merak/runtime.env`。将 `CDN_EDGE_CACHE_ACTIVE=true` 加入该文件；修改后需在服务器执行 `docker compose -p merak-deploy -f /opt/merak/deploy-compose.json up -d --force-recreate web`，让容器重新读取环境文件。仅 `restart` 现有容器不会加载修改后的 `env_file`。此步骤不需要重新构建前端；若修改的是 `NEXT_PUBLIC_LOCAL_MEDIA`，则必须重新构建。

可用 `curl -I -H 'Referer: https://merakt.cn/' -H 'Origin: https://merakt.cn' https://cos.merakt.cn/airlines/CCA.svg` 检查。状态牌报告部署配置，实际命中情况以 CDN 控制台及响应头为准。参考[腾讯云节点缓存配置](https://cloud.tencent.com/document/product/228/6291)和[响应头配置](https://cloud.tencent.com/document/product/228/41737)。

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

毛五页面在照片旁与大图下方展示后台填写的拍摄信息，照片本身保持无遮挡；近期照片采用滚动展示，往期按年份归档。署名仅解析明确记录的摄影、毛替、后期等角色，同一人的自拍或摄影/后期会合并显示；未记录的署名不推断。在「媒体库 → 拍摄参数」选择拍摄介质：数码显示已填写的相机、镜头、焦段、快门、光圈和 ISO；明确选择胶片后，仅显示相机、镜头和胶片型号。未填写的项目隐藏，不推断拍摄设备。毛五快捷发布和媒体库上传会在保存时读取原图 EXIF，自动补充相机、镜头、焦距、快门、光圈和 ISO；已有值优先保留，胶片记录不填入扫描设备参数。缺失或损坏的 EXIF 不阻止有效照片上传；不额外保存 GPS、序列号或原始 EXIF。后台相机、镜头、胶卷、摄影署名，以及航班机型、ICAO 机型代码、航司、注册号、航班号和起降/备降机场都支持选用已保存值。新值随记录保存后可复用；候选只向登录编辑者开放，不读取私有导入明细，无需数据库迁移。已取消滤镜切换、直方图和 Boop。公共互动接口有进程内限流；部署代理应覆盖 `X-Real-IP`，不能直接信任客户端传入的同名头。

首页航路简报直接从浏览器调用 `https://ipwho.is/` 获取城市级 IP 定位，不申请 GPS 权限，定位仅在当前页面内存中用于计算，不写入数据库或浏览器存储；坐标通过 POST 正文传递，避免进入 URL 访问日志。失败后可手动输入机场三字码。第三方定位服务仍会接收访问者 IP，因此页面承诺仅指本站不保存定位信息。第三方免费接口有额度和可用性限制，见 [IPWHOIS 文档](https://ipwhois.io/documentation)。距离按大圆航线估算，A350-900 时间按 900 km/h 加 1 小时起降余量估算，不代表真实航班。若配置 CSP，请允许 `connect-src https://ipwho.is https://cos.merakt.cn`。

航路简报的自动机场选择规则：

- 自动候选使用 [OurAirports 公开数据](https://ourairports.com/data/) 中有定期航班的陆地机场，与站内机场库取交集；NAY、QPG 等无定期航班条目不会自动选中。原机场库继续支持历史航段。
- 多机场城市使用显式默认值：北京 PEK（备选 PKX）、台北 TPE（TSA）、新加坡 SIN（XSP）、上海 PVG（SHA）、东京 HND（NRT）等。完整规则在 `web/src/lib/radar.ts`。默认值是本站参考出发地的展示约定；界面列出备选机场，手动输入始终优先。
- 城市名称存在时须与都会区相符，并限制默认机场距定位点不超过 120 公里、与最近候选处于同一国家或地区，避免把邻近城市直接吸附到远处枢纽。未配置的城市使用最近的定期航班机场。
- 以固定杭州参考点计算距离；原始距离小于 50 公里只显示“已在杭州附近”，隐藏公里数和预计飞行时间。其他距离取整至 10 公里，时间取整至 5 分钟，匹配 IP 定位的近似精度。
- 公共状态快照位于 `web/src/data/radar-airports.json`，记录来源、获取日期和校验值。在 `web` 下运行 `python3 scripts/update-radar-airports.py` 更新，也支持传入已下载的官方 CSV 文件。运行时不访问机场数据服务；升级前应核对机场状态与都会区默认值。


顶栏保留普通深浅模式和独立遥测按钮，两者互不影响。`Cmd/Ctrl + K` 打开塔台指令窗，`T` 开关遥测视图（输入框内不触发）。遥测标注包含边框的显示尺寸，单位为 CSS 像素；rAF Hz 是前台动画回调频率，不是 GPU 实际渲染帧率，受浏览器、显示器刷新率和省电策略影响，隐藏标签页时暂停采样。TR 的 PLAY RADIO 和开窗提示音使用原始 `audio/team-radio.wav`，Web Audio 分析真实音频驱动频谱；若跨域分析失败则回退到原始音频播放。红色车手文字、白色车队文字和访客回电按顺序逐字呈现，全部完成后显示大回复按钮；重播位于底部。

分享卡片通过 `cd web && node scripts/generate-social-card.mjs` 生成 1200 × 630 PNG。生成文件位于 `web/public/social/paddock-og.png`，上传副本位于 `web/.data/cos-upload-paddock/social/paddock-og.png`。将其上传至 COS 的 `social/paddock-og.png`（`Content-Type: image/png`），正式站 OpenGraph / Twitter 元数据引用此 COS 地址。PNG 不提交 Git，部署前须独立上传；微信和 QQ 是否显示卡片由各平台抓取策略决定。

驾驶舱作为独立彩蛋保留在塔台指令窗：搜索 `Cockpit` 或“驾驶舱”进入石墨面板／青绿仪表模式，`Exit Cockpit` 恢复之前的深浅模式。顶栏切换深浅模式也会退出驾驶舱。照片光圈统一显示为 `ƒ/2.8` 等格式。候机室切换有淡入位移动画，并保留已填写内容；减少动态效果偏好下不播放过渡。异常页面覆盖未知网址、页面渲染失败／离线及根布局异常，提供重试入口，不展示内部错误堆栈。

### 故障页与发布维护

- `/status-preview` 可切换 404、页面错误、离线和全局错误的视觉预览；预览不会制造真实故障。
- `/maintenance-preview` 预览独立的 IN PIT / VSC 页面。真实维护响应为 503；预览本身为 200。
- 当前发布流程在停旧服务后备份数据、切换版本并启动新服务，因此存在停机窗口，时长取决于数据备份及启动耗时。
- 运行包包含 `maintenance/`，部署工具会在停止服务前复制至 `/opt/merak/maintenance`。需在现有 Nginx/OpenResty 应用代理 location 中加入 `proxy_intercept_errors on;` 和 `error_page 502 504 =503 /__maintenance.html;`，同一 server 块加入 `web/scripts/maintenance/nginx.conf` 中的精确 location。先执行代理配置检查，再 reload。若使用 1Panel 容器，需要将宿主机 `/opt/merak/maintenance` 只读挂载到代理容器同路径；不能用浏览器路径代替文件路径。尚未配置代理时，应用停止仍会显示默认网关错误。
- TR 使用 COS 上的开始与结束提示音，消息立即显示；开始提示音结束后仅播放短暂无线电噪音。PTT 回复只追加到当前窗口，不提交数据库，回复后隐藏按钮，并在结束提示音播放完 5 秒后关闭；重播或关闭后重新打开会清空。
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
error_page 502 504 =503 /__maintenance.html;
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

## 中英文支持

前台右上角可切换 `中文 / EN`，首次访问按浏览器语言选择，手动选择通过 `merak-locale` Cookie 保留一年；现有网址、查询参数和锚点继续使用。Payload 后台也支持中文和 English，可在后台语言菜单切换。

界面文案使用固定代码键：中文编辑 `web/src/lib/i18n/zh.ts`，英文编辑 `web/src/lib/i18n/en.ts`。例如修改 `zh.ts` 的 `"nav.home": "围场"` 即可更新中文导航，无需改页面或英文文件。只修改值，保留键名和 `{0}`、`{1}` 等参数占位符。

组件可在 `Localized` 内使用 `@i18n:nav.home@`，或通过 `useTranslator()` / `getTranslator()` 调用 `t('nav.home')`。动态文案使用 `message('flights.since', year)` 或 `t('flights.since', [year])`。中英文词典键名一致性由 TypeScript 校验，代码引用由测试核验；新增文案时同时补齐两份语言文件。`sources.ts` 只兼容既有 API 错误、数据库状态等历史原始值，不是文案编辑入口；已有兼容条目保持不变，新增代码引用不需要增加兼容条目。

`Localized` 只解析显示内容，不修改表单值和状态值；用户填写的文字、博客正文与毛五配文通过 `data-i18n="off"` 保留原文。独立电子名片也使用相同代码键。维护页的文案来自同一词典：`npm run i18n:generate` 更新供 nginx 使用的静态页面，`npm run build` / `npm run build:qa` 会自动执行。

博客后台增加英文标题、摘要和富文本正文；毛五相册增加英文标题、配文及逐张英文配文，媒体可填写英文图片说明。快速发布毛五页也有选填英文配文。英文界面逐字段使用已填写译文，缺少译文（含空白正文）时回退中文，不自动翻译这些创作内容。Team Radio 可独立填写英文近况和逐条英文消息。

发布前按既有部署流程执行新增迁移 `20261018_020000_i18n`；它仅添加可空译文字段并涵盖版本表，无需重写旧记录。运行 `npm test` 验证翻译与回退；`node --import tsx tests/i18n.integration.ts` 会建立临时数据库验证迁移、富文本和版本保存，不读写实际内容库。

后台「首页与站点设置」→「赛道状态」选择 IN PIT，填写「预计恢复时间」后保存，公开页面即返回 HTTP 503。后台、PIT WALL 与管理入口保持可用；可通过 `/manage/maintenance` 提前结束，或手动切回自动或赛道畅通。设置预计恢复时间后，到时自动解除维护（由下一次请求或页面探测触发）；留空则持续至手动关闭。新增迁移 `20261018_030000_maintenance` 保存开始时间、预计恢复时间及版本历史。

红旗页位于 `/red-flag-preview`，503 页位于 `/maintenance-preview`。nginx 仅拦截 502/504，保留应用的 503 响应及预计恢复时间；应用停止时仍使用独立静态页，预计时间显示待定。

### 飞常准手动补齐（可选付费）

航班后台填写航班号与**出发机场当地日期**后，点击「查询并补齐」。页面先显示航班、日期与预计费用，勾选核对后才会创建任务；查询完成后选择航段，补入空白字段，再检查并保存。已有时间和机号不会被覆盖，入位时间缺失时保持空白，不用预计时间代替实际时间。已有查询结果免费复用；需要最新数据时点击「重新查询」，重新核对费用。自动航班同步和 Flighty 校准不会自动调用此付费接口。

启用需要更新云端程序及家庭端运行包，保留既有数据库、工作端签名密钥与同步配置：

1. 云端按现有发布流程执行新增迁移 `20261020_120000_paid_flight_queries`。运行环境设置 `FLIGHT_SYNC_ENABLED=1`、`FLIGHT_SYNC_MODE=remote`、`VARIFLIGHT_ENABLED=1`；每日/月度查询上限分别为 `VARIFLIGHT_DAILY_QUERY_LIMIT=4` 和 `VARIFLIGHT_MONTHLY_QUERY_LIMIT=20`（可改为 0 停止新增付费任务）。上限按北京时间计算。
2. 家庭端用 `npm run package:flight-home` 生成的新版运行包更新程序。将 Key 保存在家庭部署目录 `secrets/variflight-key`，权限 600；在家庭端 `.env` 设置 `VARIFLIGHT_API_KEY_FILE=/run/secrets/variflight-key`，不把 Key 放进云端、网页或 Git。家庭端也独立校验上述每日/月度上限，需按预期设置一致。
3. 既有家庭部署首次升级时创建 `data` 目录并保留其内容，新版 compose 将其挂载到 `/var/lib/flight-logger`；默认 `VARIFLIGHT_CACHE_DB=/var/lib/flight-logger/variflight.sqlite`。该文件保存付费请求占位、原始响应和待上传结果，必须持久化并纳入本机备份；后续更新程序不要删除或覆盖 `data`、`keys`、`secrets` 和 `.env`。完成配置后重建并启动家庭端容器。

一次确认只调用 `searchFlightsByNumber`，不额外查询舒适度等工具。界面按样例脚本标示约 50 积分 / ¥0.50，实际以账户套餐账单为准。确认后 15 分钟内未被家庭端领取则失效，不发起请求；领取后出现超时、服务重启或结果不明时不会自动重新付费。家庭端先保存原始响应再上传，云端暂时离线只重传已保存结果。请求结果未知时仍预留额度，重新查询前先检查供应商账单。

验证命令：`npm test`、`python3 -m unittest discover -s tests -p test_variflight_fetch.py`、`node --import tsx tests/flight-provider-query.integration.ts` 和 `npm run test:flight-worker`；测试使用临时数据库及模拟响应，不消耗供应商额度。
