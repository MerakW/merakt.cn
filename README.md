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
