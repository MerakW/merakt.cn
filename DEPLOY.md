# 部署指南

## ✅ 构建验证

项目已成功构建！生成的文件位于 `dist/` 目录：

```
dist/
├── index.html          # 主页
├── merak/
│   └── index.html      # 个人页面
├── blog/
│   └── index.html      # 博客列表
├── xuanji/
│   └── index.html      # 璇迹 AI 页面
├── airways/
│   └── index.html      # Merak Airways
└── favicon.svg         # 网站图标
```

## 🚀 快速部署到 Vercel

### 方法 1: Vercel CLI（最简单）

```bash
# 1. 安装 Vercel CLI（如果未安装）
npm install -g vercel

# 2. 登录 Vercel
vercel login

# 3. 进入项目目录
cd /home/merak/.openclaw/workspace/merak-website

# 4. 部署（首次会询问项目名称等）
vercel

# 5. 生产部署
vercel --prod
```

### 方法 2: GitHub + Vercel（推荐用于持续部署）

```bash
# 1. 初始化 git 仓库
cd /home/merak/.openclaw/workspace/merak-website
git init
git add .
git commit -m "Initial commit: Merak website"

# 2. 创建 GitHub 仓库并推送
git remote add origin https://github.com/你的用户名/merak-website.git
git branch -M main
git push -u origin main

# 3. 访问 vercel.com
# 4. 点击 "New Project"
# 5. 导入刚才的 GitHub 仓库
# 6. 点击 "Deploy"
```

### 方法 3: 直接使用构建输出

```bash
# 构建已经完成，可以直接部署 dist 目录
vercel --prod
```

## 🌐 自定义域名

部署后，在 Vercel 控制面板中：

1. 进入项目设置
2. 选择 "Domains"
3. 添加你的域名（如 `merak.vercel.app` 或自定义域名）
4. 按照提示配置 DNS

## 📊 项目信息

- **框架**: Astro v5
- **适配器**: @astrojs/vercel
- **构建输出**: 静态站点 (SSG)
- **页面数量**: 5 页
- **构建时间**: ~1.5 秒

## 🔧 后续优化

### 1. 添加博客内容集合

创建 `src/content/blog/` 目录，使用 Astro Content Collections：

```bash
mkdir -p src/content/blog
```

创建 `src/content.config.ts`:

```typescript
import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.date(),
    tags: z.array(z.string()),
    draft: z.boolean().optional(),
  }),
});

export const collections = { blog };
```

### 2. 添加 RSS Feed

安装 RSS 插件：

```bash
npm install @astrojs/rss
```

在 `astro.config.mjs` 中配置。

### 3. 添加分析

在 `BaseLayout.astro` 中添加：
- Google Analytics
- Plausible (隐私友好)
- 或 Vercel Analytics

### 4. SEO 优化

为每个页面添加：
- Open Graph 标签
- Twitter Card 标签
- 结构化数据 (JSON-LD)

## 📝 内容更新流程

### 更新博客文章

1. 编辑 `src/pages/blog.astro` 中的 `posts` 数组
2. 或者创建 Markdown 文件到 `src/content/blog/`
3. 运行 `npm run build`
4. 部署：`vercel --prod`

### 更新个人信息

编辑对应页面文件，然后重新构建部署。

## 🎯 测试清单

部署后检查：

- [ ] 所有页面可访问
- [ ] 暗色模式切换正常
- [ ] 响应式设计在移动端正常
- [ ] 导航链接正确
- [ ] 图片加载正常
- [ ] 无控制台错误

## 📞 支持

遇到问题？

- Astro 文档：https://docs.astro.build
- Vercel 文档：https://vercel.com/docs
- 项目 Issue: GitHub

---

**最后更新**: 2026-03-11  
**构建状态**: ✅ 成功
