#!/usr/bin/env bash
# 本地一条龙验证 ISR 命中 / 主动失效 闭环
#
# 用法：
#   bash scripts/test-isr.sh                                # 默认参数
#   ARTICLE_ID=111922920388856522 bash scripts/test-isr.sh
#   PORT=3001 bash scripts/test-isr.sh
#
# 前置：
#   1. dev server 已启动并监听 PORT（默认 3001，可用 PORT=xxx 覆盖）
#   2. 已设置 NUXT_REVALIDATE_SECRET 环境变量（与启动 dev server 时一致）
#      例：NUXT_REVALIDATE_SECRET=local-dev-secret npm run dev
#
# 注意：
#   - dev 模式下 Nitro 默认走"开发模式"，ISR 行为可能与生产不一致
#   - 生产验证请用 npm run build && node .output/server/index.mjs
#
# 期望结果：
#   STEP 1: 首次访问 - 状态 200，写入缓存
#   STEP 2: 再次访问 - 状态 200，命中缓存（响应头多 X-Nitro-Prerender / age）
#   STEP 3: 调用 /api/_revalidate - 200，cleared 数量 >= 1
#   STEP 4: 再次访问 - 重新回源生成

set -u

PORT="${PORT:-3001}"
HOST="${HOST:-127.0.0.1}"
ARTICLE_ID="${ARTICLE_ID:-111922920388856522}"
SECRET="${NUXT_REVALIDATE_SECRET:-local-dev-secret}"
BASE="http://${HOST}:${PORT}"
URL="${BASE}/article-detail/${ARTICLE_ID}"

# 颜色
GREEN="\033[0;32m"
RED="\033[0;31m"
YELLOW="\033[1;33m"
NC="\033[0m"

ok()   { echo -e "${GREEN}✅ $*${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $*${NC}"; }
err()  { echo -e "${RED}❌ $*${NC}"; }

echo "==========================================="
echo " ISR + Revalidate 本地验证"
echo " URL : ${URL}"
echo " 密钥: ${SECRET}"
echo "==========================================="

curl_headers() {
  curl -s -o /dev/null -D - --max-time 10 "$1"
}

step() {
  echo
  echo -e "${YELLOW}▶ $*${NC}"
}

# STEP 1
step "STEP 1 / 首次访问（应 200，回源）"
H1=$(curl_headers "${URL}")
echo "${H1}" | head -1
if echo "${H1}" | grep -qE '^HTTP/[0-9.]+ 200'; then
  ok "首次访问 200"
else
  err "首次访问非 200"
  exit 1
fi

# STEP 2
step "STEP 2 / 再次访问（应 200，命中缓存）"
H2=$(curl_headers "${URL}")
echo "${H2}" | head -1
echo "${H2}" | grep -iE 'x-nitro|cache-control|age|x-vercel|expires' || true
if echo "${H2}" | grep -qE '^HTTP/[0-9.]+ 200'; then
  ok "再次访问 200"
else
  err "再次访问非 200"
fi

# STEP 3
step "STEP 3 / 调用 /api/_revalidate 失效该路径"
RESP=$(curl -s --max-time 10 \
  -X POST "${BASE}/api/_revalidate" \
  -H "Content-Type: application/json" \
  -H "x-revalidate-secret: ${SECRET}" \
  -d "{\"paths\":[\"/article-detail/${ARTICLE_ID}\"]}")
echo "Response: ${RESP}"
if echo "${RESP}" | grep -q '"revalidated":true'; then
  ok "失效成功"
else
  err "失效失败：${RESP}"
fi

# STEP 4
step "STEP 4 / 失效后再次访问（应 200，重新回源）"
H4=$(curl_headers "${URL}")
echo "${H4}" | head -1
if echo "${H4}" | grep -qE '^HTTP/[0-9.]+ 200'; then
  ok "重新回源 200"
else
  err "重新回源非 200"
fi

# STEP 5：鉴权失败
step "STEP 5 / 鉴权失败（应 401）"
CODE=$(curl -s -o /dev/null -w '%{http_code}' \
  -X POST "${BASE}/api/_revalidate" \
  -H "Content-Type: application/json" \
  -H "x-revalidate-secret: WRONG_SECRET" \
  -d "{\"paths\":[\"/\"]}")
if [ "${CODE}" = "401" ]; then
  ok "鉴权拒绝 401 正确"
else
  err "鉴权拒绝期望 401，实际 ${CODE}"
fi

# STEP 6：参数缺失
step "STEP 6 / 参数缺失（应 400）"
CODE=$(curl -s -o /dev/null -w '%{http_code}' \
  -X POST "${BASE}/api/_revalidate" \
  -H "Content-Type: application/json" \
  -H "x-revalidate-secret: ${SECRET}" \
  -d "{}")
if [ "${CODE}" = "400" ]; then
  ok "参数校验 400 正确"
else
  err "参数校验期望 400，实际 ${CODE}"
fi

# STEP 7：全清模式
step "STEP 7 / 全清模式（应 200，cleared.*  >= 0）"
RESP=$(curl -s --max-time 10 \
  -X POST "${BASE}/api/_revalidate" \
  -H "Content-Type: application/json" \
  -H "x-revalidate-secret: ${SECRET}" \
  -d '{"all":true}')
echo "Response: ${RESP}"
if echo "${RESP}" | grep -q '"revalidated":true'; then
  ok "全清成功"
else
  err "全清失败：${RESP}"
fi

echo
echo "==========================================="
echo "  验证完成"
echo "==========================================="
