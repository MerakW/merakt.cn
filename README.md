# Merak · 数字围场

Next.js + Payload CMS + SQLite。

## 本地开发

```sh
cd web
npm ci
cp .env.example .env
npm run dev
```

已有 `.env` 时请保留原配置。预览地址：http://127.0.0.1:3000。

```sh
npm test
npm run typecheck
npm run build
```

数据库、媒体和机模素材在本地单独配置，不随源码分发。机模 Credit：Norebbo。

## 家庭服务器预览

需要 Python 3.10+ 和本机 Docker。公开素材另行放置；预览不会连接云端或上传文件。

```sh
cd web
./deploy.sh preview --assets /path/to/reviewed-public --host 192.168.1.20
```

将 IP 替换为家庭服务器内网地址，浏览器访问 `http://192.168.1.20:3001`。
省略 `--host` 时仅本机可访问；可用 `--port` 修改端口。首次为空库，在 `/admin` 初始化管理员。
预览构建当前工作目录代码，独立数据保存在 `web/.data/local-preview/data`，后续启动继续使用。

```sh
./deploy.sh preview-stop
```

停止后数据保留。重新执行 preview 会重新构建。预览目录和素材不要提交 Git，也不要开放到公网。

## 云端发布

```sh
cd web
./deploy.sh init
# 编辑本地 .env.deploy.json 的 SSH 地址、HTTPS 域名、Git ref 和公开素材路径
./deploy.sh
```

家庭服务器从指定 Git 提交构建，SSH 上传后备份数据并启动新版。云端需要 Docker Compose、Python 3.10+ 和可非交互 sudo 的部署账户；1Panel 配置域名与 HTTPS 反向代理到宿主机 `127.0.0.1:3000`。
首次自动建库；运行数据位于云端 `/opt/merak/data`，不随程序替换。

```sh
./deploy.sh rollback --restore-data
```

回退恢复上一版及部署前数据，回退前数据另存保留。首次部署无上一版可回退。

## 单张毛五发布

登录后访问 `/manage/fursuitfriday`，拖入一张图片、粘贴配文，再点击「上传并发布」。记录日期默认当天（上海时区），可修改；文案中的「摄影：」或「📷：」会识别为摄影署名。

服务器自动纠正图片方向、移除元信息、将长边缩到最多 2048px，并压缩为 WebP。压缩图上传到 COS，相册随后公开发布；媒体库同时保留一份压缩图供后台使用。相同图片、文案和日期重复提交会返回已有相册。COS 上传成功但数据库保存失败时，可重试；已上传对象保留供重试使用。

云端在 `/opt/merak/runtime.env` 中添加以下配置，保留原有环境变量：

```dotenv
COS_BUCKET=你的存储桶名称-APPID
COS_REGION=ap-shanghai
COS_SECRET_ID=
COS_SECRET_KEY=
```

填写实际地域；使用临时凭据时另设置 `COS_SESSION_TOKEN`。上传账号需要目标 `fursuitfriday/` 目录的 `cos:PutObject` 权限。CDN `https://cos.merakt.cn` 应指向该存储桶，并允许站点读取该目录。

更新配置后重建运行容器以载入环境变量：

```sh
sudo docker compose -p merak-deploy -f /opt/merak/deploy-compose.json up -d --force-recreate web
```

本地预览在 `web/.env` 配置相同变量后重启。密钥只供服务端使用，不写入 `NEXT_PUBLIC_` 变量，也不提交真实环境文件。上传服务未配置时，页面可以整理图片和文案，发布按钮会禁用。
