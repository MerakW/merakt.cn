# 🚀 快速启动指南

## 一分钟开始

```bash
# 1. 进入项目目录
cd /home/merak/.openclaw/workspace/merak-website

# 2. 启动开发服务器
npm run dev

# 3. 访问 http://localhost:4321
```

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 构建生产版本 |
| `npm run preview` | 预览生产构建 |
| `./scripts/start.sh` | 快速启动脚本 |
| `./scripts/deploy.sh` | 部署到 Vercel |

## 部署到 Vercel

```bash
# 安装 Vercel CLI
npm install -g vercel

# 登录
vercel login

# 部署
vercel --prod
```

## 项目位置

- **源代码**: `/home/merak/.openclaw/workspace/merak-website/src/`
- **构建输出**: `/home/merak/.openclaw/workspace/merak-website/dist/`
- **配置文件**: `astro.config.mjs`, `package.json`

## 页面路由

- `/` - 主页
- `/merak` - 个人页面
- `/blog` - 博客列表
- `/xuanji` - 璇迹 AI
- `/airways` - Merak Airways

## 需要帮助？

- 查看 `README.md` - 完整项目说明
- 查看 `DEPLOY.md` - 详细部署指南
- 查看 `PROJECT_SUMMARY.md` - 项目总结

---

**Be genuinely helpful, not performatively helpful.** 🐉
