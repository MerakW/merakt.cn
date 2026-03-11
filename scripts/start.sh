#!/bin/bash
# Merak 网站快速启动脚本

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "🐉 Merak 网站启动脚本"
echo "===================="
echo ""

# 检查 node_modules
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
fi

# 启动开发服务器
echo "🚀 启动开发服务器..."
echo "访问：http://localhost:4321"
echo ""

npm run dev
