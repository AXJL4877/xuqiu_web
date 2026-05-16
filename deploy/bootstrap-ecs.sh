#!/bin/bash
# 在 ECS 上首次部署（在项目根目录执行）
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f .env.production ]; then
  cp deploy/env.production.example .env.production
  echo "已生成 .env.production，请先编辑 POSTGRES_PASSWORD 等配置后再运行本脚本。"
  echo "  nano .env.production"
  exit 1
fi

if ! grep -q "POSTGRES_PASSWORD=请改为强密码" .env.production 2>/dev/null; then
  :
else
  echo "请先在 .env.production 中设置强密码 POSTGRES_PASSWORD"
  exit 1
fi

echo "构建并启动服务..."
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

echo ""
echo "部署完成。若安全组已放行 80 端口，可通过以下地址访问："
echo "  http://$(curl -s --max-time 2 http://100.100.100.200/latest/meta-data/public-ipv4 2>/dev/null || hostname -I | awk '{print $1}')"
echo ""
echo "查看日志: docker compose -f docker-compose.prod.yml --env-file .env.production logs -f app"
