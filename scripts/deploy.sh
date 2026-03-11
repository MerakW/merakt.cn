#!/bin/bash
# Merak 网站部署脚本

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "🐉 Merak 网站部署脚本"
echo "===================="
echo ""

# 检查 Vercel CLI
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI 未安装"
    echo "请运行：npm install -g vercel"
    exit 1
fi

# 构建
echo "🔨 构建项目..."
npm run build

# 部署
echo ""
echo "🚀 部署到 Vercel..."
vercel --prod

echo ""
echo "✅ 部署完成！"
