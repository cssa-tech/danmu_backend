#!/usr/bin/env bash
# 弹幕系统一键部署 / 更新脚本（Ubuntu 24.04，自带的 Node.js 版本才够新）
#
# 第一次部署：
#   git clone https://github.com/cssa-tech/danmu_backend.git ~/danmu/danmu_backend
#   bash ~/danmu/danmu_backend/deploy/setup.sh
#
# 以后更新（代码推到 GitHub 之后）：
#   bash ~/danmu/danmu_backend/deploy/setup.sh
#
# 可选：部署某个分支（三个仓库都用这个分支，不存在的话用 main）
#   BRANCH=my-branch bash ~/danmu/danmu_backend/deploy/setup.sh
set -euo pipefail

BRANCH="${BRANCH:-main}"
ORG_URL="https://github.com/cssa-tech"
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"   # 默认是 ~/danmu
WEB_ROOT="/var/www/danmu"
SITE_FILE="/etc/nginx/sites-available/danmu"

step() { echo; echo "==== $* ===="; }

step "1/6 安装系统软件（nginx、redis、node）"
sudo apt-get update -y
sudo apt-get install -y nginx redis-server git curl nodejs npm
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "Node.js 版本太旧（$(node -v)），需要 18 以上。请用 Ubuntu 24.04 重新创建服务器。" >&2
  exit 1
fi
if ! command -v pm2 >/dev/null 2>&1; then
  sudo npm install -g pm2
fi
sudo systemctl enable --now redis-server

# 小内存机器打包前端容易内存不够，没有 swap 就加 1G
if [ "$(swapon --show | wc -l)" -eq 0 ]; then
  step "添加 1G swap"
  sudo fallocate -l 1G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

step "2/6 下载或更新代码（分支: $BRANCH）"
sync_repo() {
  local name="$1" dir="$BASE_DIR/$1"
  if [ ! -d "$dir/.git" ]; then
    git clone "$ORG_URL/$name.git" "$dir"
  fi
  git -C "$dir" fetch origin
  if git -C "$dir" rev-parse --verify --quiet "origin/$BRANCH" >/dev/null; then
    git -C "$dir" checkout -q -B "$BRANCH" "origin/$BRANCH"
  else
    echo "  $name 没有 $BRANCH 分支，使用 main"
    git -C "$dir" checkout -q -B main origin/main
  fi
  echo "  $name: $(git -C "$dir" log --oneline -1)"
}
sync_repo danmu_backend
sync_repo danmu_mobile
sync_repo danmu_screen

step "3/6 打包手机端和大屏幕端"
build_site() {
  local name="$1" target="$2"
  (cd "$BASE_DIR/$name" && npm ci --no-audit --no-fund && npm run build)
  sudo rm -rf "$target"
  sudo mkdir -p "$target"
  sudo cp -r "$BASE_DIR/$name/dist/." "$target/"
}
build_site danmu_mobile "$WEB_ROOT/mobile"
build_site danmu_screen "$WEB_ROOT/screen"

step "4/6 配置 nginx"
if [ -f "$SITE_FILE" ] && grep -q "Certbot" "$SITE_FILE"; then
  echo "  已配置 HTTPS（certbot），保留现有 nginx 配置不覆盖"
else
  sudo cp "$BASE_DIR/danmu_backend/deploy/nginx.conf" "$SITE_FILE"
fi
sudo ln -sf "$SITE_FILE" /etc/nginx/sites-enabled/danmu
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

step "5/6 启动后端（pm2，只监听本机，由 nginx 转发）"
cd "$BASE_DIR/danmu_backend"
npm ci --omit=dev --no-audit --no-fund
pm2 delete danmu-backend >/dev/null 2>&1 || true
HOST=127.0.0.1 PORT=8080 pm2 start multi_process.js --name danmu-backend --update-env
pm2 save
# 让服务器重启后自动拉起后端
sudo env PATH="$PATH" "$(command -v pm2)" startup systemd -u "$USER" --hp "$HOME" >/dev/null

step "6/6 完成"
IP="$(curl -s --max-time 5 https://checkip.amazonaws.com || echo '服务器公网IP')"
echo "  手机端（观众扫码打开）:  http://$IP/"
echo "  大屏幕端（投屏打开）:    http://$IP/screen/"
echo "  查看后端日志:            pm2 logs danmu-backend"
