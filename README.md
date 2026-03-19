# Merak 个人网站

基于 Astro 构建的现代化个人网站，支持暗色模式和响应式设计。

## 🚀 技术栈

- **框架**: [Astro](https://astro.build/) v5
- **部署**: [Vercel](https://vercel.com/)
- **样式**: 原生 CSS + CSS 变量（支持暗色模式）
- **主题**: 灵感来自 AstroPaper

## 📁 项目结构

```
merak-website/
├── public/
│   └── favicon.svg          # 网站图标
├── src/
│   ├── layouts/
│   │   └── BaseLayout.astro # 基础布局（含导航和暗色模式）
│   └── pages/
│       ├── index.astro      # 主页
│       ├── merak.astro      # 个人页面
│       ├── blog.astro       # 博客列表
│       ├── astronix.astro     # 璇迹 AI 页面
│       └── airways.astro    # Merak Airways 航空主题
├── astro.config.mjs         # Astro 配置
├── package.json             # 项目依赖
├── tsconfig.json            # TypeScript 配置
└── README.md                # 本文件
```

## 🎨 功能特性

### 暗色模式

- 自动检测系统偏好
- 手动切换按钮（右上角 🌙/☀️）
- 偏好保存在 localStorage

### 响应式设计

- 移动端优先
- 自适应导航栏
- 灵活的网格布局

### 页面结构

1. **主页** - 大展示 + 快速导航
2. **Merak** - 个人简介 + 兴趣图谱 + 精选集
3. **博文** - 博客列表 + 分类过滤 + 标签云
4. **璇迹** - AI 伙伴介绍 + 能力展示
5. **Merak Airways** - 航空主题内容空间

## 📝 内容更新

### 添加新博客文章

编辑 `src/pages/blog.astro` 中的 `posts` 数组：

```javascript
const posts = [
  {
    title: "文章标题",
    excerpt: "文章摘要",
    date: "2026-03-11",
    category: "分类",
    tags: ["标签 1", "标签 2"],
    slug: "/blog/文章 slug"
  }
];
```

### 修改个人信息

编辑对应页面文件：
- `src/pages/merak.astro` - 个人信息
- `src/pages/xuanji.astro` - 璇迹介绍
- `src/pages/airways.astro` - 航空内容

## 🎯 下一步

- [ ] 集成 Content Collections 管理博客内容
- [ ] 添加 RSS Feed
- [ ] 实现搜索功能
- [ ] 添加评论区
- [ ] 同步 X/QQ 空间功能
- [ ] 添加分析统计

## 📄 许可证

MIT

---

**Be genuinely helpful, not performatively helpful.**
