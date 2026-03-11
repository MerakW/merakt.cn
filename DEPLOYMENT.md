# 自动化部署流程指南

本文档说明如何配置三重部署策略：
- **Vercel** → 测试站（自动部署）
- **GitHub Pages** → 备选方案（可选）
- **云服务器** → 正式站（现有 Git Hook）

---

## 📋 目录

1. [Vercel 配置（测试站）](#1-vercel-配置测试站)
2. [GitHub Actions 配置（备选）](#2-github-actions-配置备选)
3. [云服务器部署（正式站）](#3-云服务器部署正式站)
4. [部署流程对比](#4-部署流程对比)

---

## 1️⃣ Vercel 配置（测试站）

### 步骤 1：连接 GitHub 仓库

**用户操作**：
1. 登录 https://vercel.com
2. 点击 "Add New..." → "Project"
3. 选择 GitHub 仓库 `MerakW/merakt.cn`
4. Framework Preset: **Astro**（自动识别）
5. 点击 "Deploy"

### 步骤 2：配置文件

项目已包含 `vercel.json`：

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "astro",
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install"
}
```

### 步骤 3：环境变量（如需要）

如果项目需要环境变量：
1. 进入 Vercel Dashboard → Project Settings
2. 选择 "Environment Variables"
3. 添加所需变量
4. 重新部署以生效

### 步骤 4：自动部署

配置完成后：
- 推送到 `main` 分支 → 自动触发 Vercel 部署
- 部署 URL：`https://merakt-cn.vercel.app`（或自定义）

---

## 2️⃣ GitHub Actions 配置（备选）

### 启用 GitHub Pages

**用户操作**：
1. 进入仓库 Settings → Pages
2. Source: 选择 "GitHub Actions"
3. 保存配置

### 工作流文件

项目已包含 `.github/workflows/deploy.yml`：

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

# ... 自动构建和部署
```

### 配置 Astro for GitHub Pages

如需使用 GitHub Pages，修改 `astro.config.mjs`：

```javascript
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://MerakW.github.io', // 或自定义域名
  adapter: vercel(),
  vite: {
    server: {
      host: true
    }
  }
});
```

### 自动部署

配置完成后：
- 推送到 `main` 分支 → 自动触发 GitHub Actions
- 部署 URL：`https://MerakW.github.io/merakt.cn/`

---

## 3️⃣ 云服务器部署（正式站）

### 现有配置

保留现有 Git Hook 部署流程：

```bash
# 推送到服务器（正式环境）
git push server master
```

### 服务器 Git Hook

服务器端 Hook 自动执行：
1. 拉取最新代码
2. 安装依赖 (`npm install`)
3. 构建项目 (`npm run build`)
4. 部署到 Web 服务器目录

### 分支策略

- **`master` 分支** → 云服务器（正式站）
- **`main` 分支** → Vercel/GitHub Pages（测试站）

---

## 4️⃣ 部署流程对比

| 特性 | Vercel | GitHub Pages | 云服务器 |
|------|--------|--------------|----------|
| **用途** | 测试站 | 备选方案 | 正式站 |
| **触发** | Push to `main` | Push to `main` | Push to `master` |
| **构建时间** | ~30 秒 | ~1-2 分钟 | 取决于服务器 |
| **自定义域名** | ✅ 免费 | ✅ 免费 | ✅ 手动配置 |
| **HTTPS** | ✅ 自动 | ✅ 自动 | ⚙️ 手动配置 |
| **环境变量** | ✅ Dashboard | ❌ 不支持 | ✅ 服务器配置 |
| **部署日志** | ✅ 实时查看 | ✅ Actions 查看 | ⚙️ 服务器日志 |

---

## 🚀 快速开始

### 首次配置

```bash
# 1. 克隆项目
git clone https://github.com/MerakW/merakt.cn.git
cd merakt.cn

# 2. 安装依赖
npm install

# 3. 本地测试
npm run dev

# 4. 构建验证
npm run build
```

### 日常部署

```bash
# 测试站部署（Vercel）
git add .
git commit -m "feat: update content"
git push origin main

# 正式站部署（云服务器）
git push server master
```

---

## 📝 注意事项

1. **分支管理**：
   - `main` → 测试环境
   - `master` → 生产环境

2. **部署顺序**：
   - 先在 Vercel 测试
   - 验证无误后推送到服务器

3. **回滚方案**：
   - Vercel：Dashboard 一键回滚
   - 云服务器：`git revert` + 重新推送

---

## 🔧 故障排查

### Vercel 部署失败

1. 检查 `vercel.json` 配置
2. 查看 Vercel Dashboard 构建日志
3. 验证 `npm run build` 本地可执行

### GitHub Actions 失败

1. 检查 Actions 标签页日志
2. 验证 Node.js 版本兼容性
3. 确认 `dist/` 目录生成正常

### 云服务器部署失败

1. SSH 登录服务器检查日志
2. 验证 Git Hook 权限
3. 检查服务器磁盘空间

---

**最后更新**: 2026-03-11  
**维护者**: Merak
