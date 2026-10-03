#!/usr/bin/env bash
set -euo pipefail

# Local-only Linux build: never sends source or artifacts to a registry.
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
output_dir="$project_dir/../../outputs/releases"
assets_dir=""
check_only=false
usage() {
  cat <<'HELP'
Usage: bash scripts/package-linux.sh [--assets /path/to/reviewed-public] [--output /path] [--check]
Build a Linux AMD64 Node 22 standalone archive using local Docker on Ubuntu or macOS.
--assets: optional, explicitly reviewed public assets only; no assets copied by default.
--check: stage and inspect inputs without Docker, downloads, or a build.
Requires local Docker Engine/Desktop (running) and Python 3. No push/upload occurs.
HELP
}
while [ "$#" -gt 0 ]; do
  case "$1" in
    --assets|--output)
      [ "$#" -ge 2 ] || { usage; exit 2; }
      if [ "$1" = --assets ]; then assets_dir="$2"; else output_dir="$2"; fi
      shift 2 ;;
    --check) check_only=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) usage; exit 2 ;;
  esac
done
command -v python3 >/dev/null || { echo 'Python 3 is required.' >&2; exit 1; }
if [ "$check_only" = false ]; then
  command -v docker >/dev/null || { echo '请先安装并启动 Docker Engine（Ubuntu）或 Docker Desktop（Mac），再运行本脚本。可用 --check 检查打包范围。' >&2; exit 1; }
  [ "$(docker context show)" = default ] || [ "$(docker context show)" = desktop-linux ] || { echo '仅允许本地 default / desktop-linux Docker context，避免将代码发往远程构建机。' >&2; exit 1; }
  case "${DOCKER_HOST:-}" in ''|unix://*) ;; *) echo '请移除远程 DOCKER_HOST。' >&2; exit 1;; esac
  docker_endpoint="$(docker context inspect --format '{{.Endpoints.docker.Host}}')"
  case "$docker_endpoint" in unix://*) ;; *) echo 'Docker endpoint 必须是本地 Unix socket。' >&2; exit 1;; esac
  docker info >/dev/null
fi
package_stage="$(mktemp -d "${TMPDIR:-/tmp}/merak-package.XXXXXX")"
trap 'rm -rf "$package_stage"' EXIT
python3 - "$project_dir" "$package_stage" "$assets_dir" <<'PY'
import pathlib, shutil, sys
root, stage = map(pathlib.Path, sys.argv[1:3])
source = stage / 'source'
source.mkdir()
def copy_checked(src, dst):
    if src.is_symlink():
        raise SystemExit(f'Symlinks are not allowed in release inputs: {src}')
    name = src.name.lower()
    if name.startswith('.env') or name in {'.data', 'node_modules', '.git', 'legacy', 'docs', '.ds_store', '__pycache__'} or name.startswith('.next') or name.endswith(('.db', '.sqlite', '.sqlite3', '.csv', '.md', '.db-wal', '.db-shm', '.pyc')):
        return
    if src.is_dir():
        dst.mkdir(parents=True, exist_ok=True)
        for child in src.iterdir(): copy_checked(child, dst / child.name)
    else:
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
for name in ['package.json','package-lock.json','next.config.mjs','next-env.d.ts','tsconfig.json','src','scripts','tests']:
    copy_checked(root / name, source / name)
(source / 'public').mkdir(exist_ok=True)
if sys.argv[3]:
    assets = pathlib.Path(sys.argv[3]).resolve()
    if not assets.is_dir(): raise SystemExit('--assets must be a directory of reviewed public files')
    copy_checked(assets, source / 'public')
print('Staged source files:', sum(p.is_file() for p in source.rglob('*')))
print('Public assets:', sum(p.is_file() for p in (source/'public').rglob('*')))
print('Excluded: environment files, databases, CSV, internal Markdown and development dependencies.')
PY
if [ "$check_only" = true ]; then echo '输入范围检查完成；未运行构建。'; exit 0; fi
mkdir -p "$package_stage/export"
# This official image is downloaded if absent. All compilation happens locally.
docker run --rm --platform linux/amd64 \
  --user "$(id -u):$(id -g)" -e npm_config_cache=/tmp/npm-cache \
  --mount "type=bind,source=$package_stage/source,target=/app" \
  --mount "type=bind,source=$package_stage/export,target=/export" \
  -w /app -e NEXT_TELEMETRY_DISABLED=1 -e GIT_SHA="${GIT_SHA:-}" \
  node:22-bookworm-slim bash -eu -o pipefail -c '
    export PAYLOAD_SECRET="$(node -e "process.stdout.write(require(\"crypto\").randomBytes(32).toString(\"hex\"))")"
    export DATABASE_URL=file:/app/.data/build.db
    export SERVER_URL=http://127.0.0.1:3000
    npm ci
    npm test
    npm run build
    mkdir -p .next/standalone/.next
    cp -R .next/static .next/standalone/.next/static
    cp -R public .next/standalone/public
    node -e "if(process.platform!==\"linux\"||process.arch!==\"x64\")process.exit(1);require(\"sharp\");console.log(\"Linux AMD64 native dependency check passed\")"
    cp scripts/start-production.mjs scripts/prepare-runtime.mjs .next/standalone/
    node --import tsx -e "import(\"./src/migrations/index.ts\").then(({migrations})=>require(\"fs\").writeFileSync(\".next/standalone/release.json\",JSON.stringify({migrations:migrations.map(m=>m.name)})))"
    test -f .next/standalone/server.js
    tar -czf /export/merak-linux-amd64.tar.gz -C .next/standalone .
  '
release_name="merak-linux-amd64-$(date +%Y%m%d-%H%M%S).tar.gz"
mkdir -p "$output_dir"
cp -n "$package_stage/export/merak-linux-amd64.tar.gz" "$output_dir/$release_name"
python3 - "$output_dir/$release_name" <<'PY'
import hashlib, pathlib, sys
p = pathlib.Path(sys.argv[1])
h = hashlib.sha256()
with p.open('rb') as f:
    for block in iter(lambda: f.read(1024*1024), b''): h.update(block)
p.with_suffix(p.suffix+'.sha256').write_text(h.hexdigest()+'  '+p.name+'\n')
print('运行包：', p.resolve())
PY
echo '解压后在 Linux Node 22 环境运行 node start-production.mjs；设置固定密钥及独立 MERAK_DATA_DIR，首次访问自动建表。'
echo '构建成功不代表正式环境验收完成。包中不含开发库或 Flighty 数据。'
