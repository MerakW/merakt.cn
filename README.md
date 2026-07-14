# Merak / Digital Paddock

Merak 的个人网站。这里放个人资料、毛五照片、航行日志、系统遥测，以及仍在持续整理的兴趣与设定。

站点使用 Astro 静态生成：页面在构建时输出为 HTML、CSS、JavaScript 与媒体文件，可部署到 Vercel，也可直接放到 Nginx、Caddy 或任意静态文件服务器。

## 技术栈

- [Astro 5](https://astro.build/)：静态站点构建
- `@astrojs/vercel`：Vercel 适配器
- 原生 CSS：主题令牌、响应式布局与 reduced motion 支持
- [GSAP](https://gsap.com/)：克制的页面进入与滚动动效
- 原生图片懒加载：毛五图库按接近视口时请求

## 页面

| 路径 | 内容 |
| --- | --- |
| `/` | 首页与站内入口 |
| `/merak` | 人物资料 |
| `/fursuitfriday` | 毛五照片档案 |
| `/blog` | 航行日志 |
| `/status` | Uptime Kuma 系统遥测嵌入页 |
| `/astronix` | Astronix / 璇迹 |
| `/airways` | Merak Airways |

`astronix` 与 `airways` 当前只隐藏入口，路由仍然保留。见 `src/content/site-settings.ts`。

## 本地开发

需要 Node.js 20 或更高版本。

```bash
npm ci
npm run dev
```

默认开发地址为 `http://localhost:4321`。如需局域网访问，Astro 配置已经开启 `host: true`。

## 构建与部署

```bash
npm run build
```

构建产物在 `dist/`。将 `dist/` 内的全部文件上传到服务器站点根目录即可；不要上传整个项目，也不要手动编辑 `dist/`。

例如：

```bash
tar -C dist -czf merakt-cn-static.tar.gz .
```

解压包后，把其中内容放入 Nginx 或 Caddy 的静态目录。目录内的 `index.html` 及各子目录的 `index.html` 已包含所有路由页面。

## 内容维护

日常文案、页面入口与状态页配置不写在页面组件里：

- `src/content/site-copy.ts`：导航、页脚、首页、个人页、博客等固定文案
- `src/content/site-settings.ts`：暂时显示或隐藏的入口
- `src/content/status.ts`：Uptime Kuma 地址与状态页文案
- `src/content/fursuitfriday/*.json`：每一条毛五照片的时间、配文、标签与图片路径
- `public/images/fursuitfriday/`：毛五媒体文件

更具体的编辑说明见 [CONTENT.md](CONTENT.md)。

## 性能约定

- 新图片应优先使用合适尺寸与 WebP；保留透明背景时使用 WebP/PNG。
- 毛五归档图使用原生懒加载；首图优先加载，归档视频不预载。
- 不引入大型 UI 框架、React 或 WebGL；优先使用 Astro、CSS 与原生浏览器能力。
- 提交前运行 `npm run build`。

## 待办

- [ ] iCloud 近期行程：读取专用公开 ICS 日历，仅展示日期、标题和地点；通过定时构建更新，不在客户端或仓库中暴露私人日历凭据。
- [ ] 为毛五归档生成 WebP/AVIF 响应式版本，进一步降低慢速网络下的流量。
- [ ] 内容量增长后，再评估 RSS 与博客 Content Collection。

## 备注

本仓库中不应提交日历公开链接、账号密码、应用专用密码或其他私密凭据。部署平台的环境变量与服务器配置也不应写入 Git。
