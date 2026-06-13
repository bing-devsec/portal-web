# Anti-Bot Guard v1 发布上线手册

> 配套实现：[anti-bot-guard-v1-spec.md](./anti-bot-guard-v1-spec.md)
>
> 适用范围：crypto-wasm（Rust）/ portal-web（Nuxt 3 SSR）/ meta-api（Go）三层联合部署。
>
> 一句话原则：**"先 Rust，后前端，最后后端"**——任意一层版本错位都会导致 HMAC 校验失败 / wasm 加载 404 / 签名拒绝，按本文严格的"build_hash 注册顺序"操作即可。

---

## 0. 名词与坐标

| 名词 | 含义 |
|---|---|
| **build_hash** | crypto-wasm 编译期由 git HEAD 截前 8B 嵌入；最终参与 HMAC 拼接，后端按白名单校验 |
| **public/guard/** | portal-web 静态资源目录，浏览器从 `/guard/guard_core_bg.wasm` 拉 wasm |
| **KEY_DIR** | meta-api 私钥目录（`./keys` 或 `/root/blog-website/keys`），watcher 监听 `private_key.pem` 热更 |
| **build_hashes / skip_hmac_when_empty** | meta-api `config.yml` 的 guard 段配置 |
| **token** | share/precheck 一次性令牌，TTL 60s，redis 单 key 单消费 |

三个仓库的本地路径：

```
/Users/bytedance/crypto-wasm     # Rust 源码 + wasm 构建脚本
/Users/bytedance/portal-web      # Nuxt 3 前端 + SSR + public/guard 静态产物
/Users/bytedance/meta-api        # Go 后端 + guard engine + share/viewlog 服务
```

---

## 1. 工具链准备（首次部署机器执行一次）

### 1.1 Rust 端（构建机器）

```bash
# rustup（如已装可跳过）
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"

# wasm 目标
rustup target add wasm32-unknown-unknown

# wasm-pack：rust → wasm + bindgen 胶水
cargo install wasm-pack --locked

# binaryen：wasm-opt + wasm-strip（macOS）
brew install binaryen

# wabt：wasm-objdump（验证脚本依赖）
brew install wabt

# Linux 服务器（Debian/Ubuntu）
# apt-get install -y binaryen wabt
```

最低版本要求：
- rustc ≥ 1.78（任何近一年 stable 都可）
- wasm-pack ≥ 0.12
- binaryen ≥ 116（必须支持 `--enable-bulk-memory-opt`）
- wabt ≥ 1.0.34

### 1.2 前端（portal-web）

```bash
# Node 版本：见 .nvmrc / package.json engines
nvm use            # 自动读 .nvmrc，目前固定 Node 20.x

# 依赖
cd /Users/bytedance/portal-web
pnpm install       # 或 npm ci
```

### 1.3 后端（meta-api）

```bash
# Go ≥ 1.22
go version
# 没有 go 时（macOS）：
# brew install go

# 依赖
cd /Users/bytedance/meta-api
go mod download
```

---

## 2. 部署前的密钥就位

> 风控引擎依赖 RSA-2048 密钥对：**前端持公钥加密 AES key、后端持私钥解密**。两端必须用同一对密钥；密钥不是版本控制对象，部署机器自己生成或从安全网盘下发。

### 2.1 生成新密钥（首次部署 / 计划轮换时）

```bash
mkdir -p /Users/bytedance/meta-api/keys
cd /Users/bytedance/meta-api/keys

# 如已有当前私钥 → 归档为 .prev（双密钥窗口期）
[ -f private_key.pem ] && mv private_key.pem private_key.pem.prev

# 生成新密钥（PKCS#8 PEM）
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out private_key.pem
openssl rsa -in private_key.pem -pubout -out public_key.pem

chmod 600 private_key.pem private_key.pem.prev 2>/dev/null || true
chmod 644 public_key.pem
```

### 2.2 公钥同步到 portal-web

```bash
mkdir -p /Users/bytedance/portal-web/keys
cp /Users/bytedance/meta-api/keys/public_key.pem /Users/bytedance/portal-web/keys/public_key.pem
```

[server/api/keys.ts](file:///Users/bytedance/portal-web/server/api/keys.ts#L7) 会从 `process.cwd()/keys/public_key.pem` 读取并通过 `/api/keys` 暴露给浏览器；**只暴露公钥，私钥永远只放后端**。

### 2.3 生产部署目录约定

| 角色 | 路径 | 权限 |
|---|---|---|
| meta-api 私钥 | `$KEY_DIR/private_key.pem`（默认 `./keys`，prod 推荐 `/root/blog-website/keys`） | 0600 |
| meta-api 旧私钥 | 同目录 `private_key.pem.prev` | 0600 |
| portal-web 公钥 | `<portal-web 启动目录>/keys/public_key.pem` | 0644 |

---

## 3. Rust 编译流程（每次发版）

```bash
cd /Users/bytedance/crypto-wasm

# 0. 确认 git HEAD 已 commit（build_hash 来自 git rev-parse HEAD 前 8B）
#    脏树会让 build_hash 等于上一次 commit 的 hash，无影响但不可追溯。
git status --short && echo OK

# 1. 单元测试 + Rust ↔ Go round-trip 测试
CARGO_TARGET_DIR=/tmp/guard-wasm-target cargo test --release

# 2. 真实 wasm 构建：build.sh 一键打包
#    步骤 = wasm-pack build → wasm-strip → wasm-opt -Oz → verify-obfuscation.sh → 计算 sha256 → 写 build_hash.txt
bash scripts/build.sh

# 3. 校验产物
ls -la pkg/
# pkg/guard_core_bg.wasm        # 二进制
# pkg/guard_core.js             # wasm-bindgen 胶水
# pkg/guard_core.d.ts           # TS 声明
# pkg/build_hash.txt            # sha256(wasm)，仅作产物指纹用，与 BUILD_HASH（git）不同
```

### 3.1 关键产物含义

| 文件 | 用途 | 是否提交 git |
|---|---|---|
| `guard_core_bg.wasm` | wasm 二进制本体，浏览器加载 | 否（每次构建生成） |
| `guard_core.js` | wasm-bindgen 自动生成的 ES module 胶水，浏览器侧 `import init` 入口 | 否 |
| `guard_core.d.ts` | TS 类型声明 | 否 |
| `build_hash.txt` | sha256(wasm)，**便于产物溯源**；与 HMAC 用的 BUILD_HASH 不是一回事 | 否 |

### 3.2 BUILD_HASH（HMAC 用）的取法

⚠️ 这个值不是 `build_hash.txt` 里的 sha256，而是 **git HEAD 的前 16 hex 字符 = 8 字节**，由 [build.rs](file:///Users/bytedance/crypto-wasm/build.rs) 编译期注入。取它的命令：

```bash
cd /Users/bytedance/crypto-wasm
git rev-parse HEAD | cut -c1-16
# 例如：a1b2c3d4e5f60718
```

**这个 16-hex 字符串才是后端 `build_hashes` 配置要填的内容。**

### 3.3 验证 obfuscation 是否生效

build.sh 会自动调用 `scripts/verify-obfuscation.sh` 扫描以下泄露：
- 16-char 连续 hex 锚点（曾经的 BUILD_HASH ASCII 字符串）
- E01..E07 错误码明文
- 黑名单关键字：`HMAC-SHA256 key length` / `InvalidPublicKey` / `guard-core` 等

任一命中 → build.sh `exit 1`。手工再跑一次：

```bash
bash scripts/verify-obfuscation.sh pkg/guard_core_bg.wasm
# 输出：[ok] obfuscation check passed for pkg/guard_core_bg.wasm
```

---

## 4. 前端集成 / 部署（portal-web）

### 4.1 同步 wasm 产物到 public/guard

```bash
cd /Users/bytedance/portal-web

# rsync 拷贝：保留 README.md 等手写文件，不删本地多余文件
rsync -av \
  /Users/bytedance/crypto-wasm/pkg/ \
  public/guard/

# 验证关键文件存在
ls -l public/guard/guard_core_bg.wasm public/guard/guard_core.js
```

> [public/guard/.gitignore](file:///Users/bytedance/portal-web/public/guard/.gitignore) 会把 wasm / glue / build_hash.txt 全部 ignore（仅 `.gitignore` 自己提交），确保仓库干净。每次部署前请重新执行同步。

### 4.2 SSR / 静态资源构建

```bash
cd /Users/bytedance/portal-web

# 类型检查 + lint
pnpm typecheck

# 生产构建
pnpm build

# 本地烟测（强烈建议）
pnpm preview
# 浏览器打开 http://localhost:3000，DevTools Network 验证：
#   GET /guard/guard_core_bg.wasm  → 200 application/wasm
#   GET /api/keys                   → 200 { publicKey: "-----BEGIN PUBLIC KEY-----..." }
```

### 4.3 运行时配置

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `NUXT_PUBLIC_GUARD_WASM_BASE` | `/guard` | wasm 资源路径前缀（CDN 部署可改） |
| `NUXT_PUBLIC_BASE_URL` | `/api-backend` | 后端 API 反代前缀（走 Nginx / Nuxt nitro proxy） |
| meta-api 私钥目录 | `$KEY_DIR` env，默认 `./keys` | watcher 监听 |

部署时把 wasm 二进制走 immutable cache（生产 CDN 推荐）：

```nginx
# Nginx
location /guard/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
    try_files $uri =404;
}
```

---

## 5. 后端配置 / 部署（meta-api）

### 5.1 配置文件

[config/config.yml](file:///Users/bytedance/meta-api/config/config.yml) 末尾新增（如已有则更新）guard 段：

```yaml
guard:
  # 接受的前端 wasm build_hash 白名单（hex，16 字符 = 8 字节）。
  # 取自 crypto-wasm 仓库 `git rev-parse HEAD | cut -c1-16`
  # 灰度期间可配置多个允许新旧版本并存。
  build_hashes:
    - "a1b2c3d4e5f60718"      # 当前生产版本
    # - "0011223344556677"    # 上一个版本（双跑期保留）

  # build_hashes 为空时是否跳过 HMAC 校验。
  #   开发期 = true（仍校验 RSA/AES/TLV，方便本地调试不锁版本）
  #   生产期 = false（必须严格校验）
  skip_hmac_when_empty: false
```

环境变量（生产推荐）：

```bash
export KEY_DIR=/root/blog-website/keys
export GIN_MODE=release
```

### 5.2 编译 / 打包 / 部署

> 本节给出**完整的发布流水**：从源码 → 二进制 → 压缩部署包 → 服务器解包 → systemd 启动。所有命令都在 `/Users/bytedance/meta-api` 工作目录下执行。

#### 5.2.1 关键事实速记

| 项 | 值 |
|---|---|
| 入口 | [main.go](file:///Users/bytedance/meta-api/main.go)（单文件 `package main`，**没有 `./cmd/...`**） |
| Go 版本 | go 1.24.x（go.mod 锁定 `1.24.0`） |
| 配置文件 | [config/config.yml](file:///Users/bytedance/meta-api/config/config.yml)（git ignore） |
| 私钥目录 | `$KEY_DIR`（默认 `./keys`，git ignore） |
| 日志目录 | `./log/*`（git ignore，需要进程有写权限） |

#### 5.2.2 本地编译（开发期 / 单测 / 烟测）

```bash
cd /Users/bytedance/meta-api

# (1) 单元测试 + Rust↔Go round-trip
GUARD_FIXTURE_BIN=/tmp/guard-wasm-target/release/examples/gen_envelope \
  go test ./common/guard/... ./app/handler/share/... ./app/handler/viewlog/... -count=1
# 没跑过 cargo build --example gen_envelope 时可去掉 GUARD_FIXTURE_BIN，
# round-trip 测试会自动 skip。

# (2) 静态检查
go vet ./...

# (3) 本地 debug 构建（含调试符号，启动快）
go build -o /tmp/meta-api .
KEY_DIR=$(pwd)/keys /tmp/meta-api
# Ctrl+C 优雅停止
```

#### 5.2.3 生产构建（要写进部署包的二进制）

`-ldflags` 同时做三件事：strip 调试符号、注入版本元数据、`-trimpath` 抹掉本地路径。

```bash
cd /Users/bytedance/meta-api

# 复用变量，避免拼写错
APP_NAME=meta-api
GIT_REV=$(git rev-parse --short HEAD)
BUILD_TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
GO_VERSION=$(go version | awk '{print $3}')

# Linux amd64 静态二进制（最常见服务器目标）
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 \
  go build \
    -trimpath \
    -ldflags="-s -w \
      -X 'main.gitRev=${GIT_REV}' \
      -X 'main.buildTime=${BUILD_TS}' \
      -X 'main.goVersion=${GO_VERSION}'" \
    -o dist/${APP_NAME} \
    .

# Linux arm64（aarch64 服务器，如阿里云倚天 / AWS Graviton）
GOOS=linux GOARCH=arm64 CGO_ENABLED=0 \
  go build \
    -trimpath \
    -ldflags="-s -w \
      -X 'main.gitRev=${GIT_REV}' \
      -X 'main.buildTime=${BUILD_TS}' \
      -X 'main.goVersion=${GO_VERSION}'" \
    -o dist/${APP_NAME}-arm64 \
    .
```

`-ldflags` 选项含义：

| 参数 | 作用 |
|---|---|
| `-s` | 去除符号表 |
| `-w` | 去除 DWARF 调试信息 |
| `-trimpath` | 把构建路径里的 `/Users/.../meta-api` 替换成空，避免泄漏开发机用户名 |
| `-X 'main.gitRev=...'` | 把变量注入到 main 包里（main.go 需新增对应 `var gitRev string`） |
| `CGO_ENABLED=0` | 强制纯静态链接，部署机器不依赖 glibc 版本 |

启用版本注入需要在 [main.go](file:///Users/bytedance/meta-api/main.go) 顶部加几行：

```go
package main

import (
    "flag"
    "fmt"
    "meta-api/app"
    "meta-api/bootstrap"
)

// 由 go build -ldflags="-X 'main.xxx=yyy'" 注入；未设置时为空。
var (
    gitRev    = "dev"
    buildTime = "unknown"
    goVersion = "unknown"
)

func main() {
    showVersion := flag.Bool("version", false, "print version info and exit")
    flag.Parse()
    if *showVersion {
        fmt.Printf("meta-api %s built=%s go=%s\n", gitRev, buildTime, goVersion)
        return
    }
    bootstrapApp := bootstrap.New()
    bootstrapApp.InitConfig()
    bootstrapApp.InitLogger()
    bootstrapApp.InitIDGenerator()
    bootstrapApp.InitCron()
    bootstrapApp.InitMySQL()
    bootstrapApp.InitRedis()
    app.NewApp(bootstrapApp).RunWithGracefulShutdown()
}
```

> 这一步是**可选的"加分项"**——线上 oncall 时 `./meta-api -version` 一秒确认到底跑的是哪个 commit。不加也能正常发布。

#### 5.2.4 进一步压缩二进制（可选）

`-ldflags="-s -w"` 已经能把约 30MB 的 debug 二进制压到约 18MB。还要更小可以装 [upx](https://github.com/upx/upx)：

```bash
# macOS: brew install upx；Debian/Ubuntu: apt install upx-ucl
upx --best --lzma dist/meta-api
# ~18MB → ~5MB；副作用：启动时间多 10-50ms，部分 AV 软件会误报，慎用。
```

服务器流量紧张才需要 upx；一般场景跳过。

#### 5.2.5 制作发布压缩包

部署包除了二进制还要带"开箱即用"的辅助文件，用 tar.gz：

```bash
cd /Users/bytedance/meta-api

APP_NAME=meta-api
VERSION=$(git rev-parse --short HEAD)
TS=$(date +%Y%m%d-%H%M%S)
PKG_DIR=dist/${APP_NAME}-${VERSION}-${TS}

mkdir -p "${PKG_DIR}"/{bin,config,log,keys,scripts}

# 1) 二进制
cp dist/${APP_NAME} "${PKG_DIR}/bin/"

# 2) 配置模板（不带敏感值）
cp config/config.yml "${PKG_DIR}/config/config.yml.example"

# 3) systemd unit（见 §5.2.6）
cp scripts/meta-api.service "${PKG_DIR}/scripts/" 2>/dev/null || true

# 4) 一键启停脚本（见 §5.2.7）
cp scripts/start.sh scripts/stop.sh "${PKG_DIR}/scripts/" 2>/dev/null || true

# 5) 版本元数据（部署后一眼可看）
cat > "${PKG_DIR}/VERSION" <<EOF
app: ${APP_NAME}
git_rev: $(git rev-parse HEAD)
git_short: ${VERSION}
built_at: $(date -u +%Y-%m-%dT%H:%M:%SZ)
built_by: $(whoami)@$(hostname)
go_version: $(go version | awk '{print $3}')
EOF

# 6) 打包（保留权限位，二进制 0755）
chmod 0755 "${PKG_DIR}/bin/${APP_NAME}"
chmod 0750 "${PKG_DIR}/scripts/"*.sh 2>/dev/null || true

tar -czvf "dist/${APP_NAME}-${VERSION}-${TS}.tar.gz" -C dist "${APP_NAME}-${VERSION}-${TS}"

ls -lh "dist/${APP_NAME}-${VERSION}-${TS}.tar.gz"
```

最终包结构：

```
meta-api-<rev>-<ts>/
├── VERSION                       # 部署元数据（git rev / build_at / go_version）
├── bin/
│   └── meta-api                  # 0755 可执行
├── config/
│   └── config.yml.example        # 不含敏感值的模板
├── scripts/
│   ├── meta-api.service          # systemd unit（见 §5.2.6）
│   ├── start.sh                  # 前台启动（开发期）
│   └── stop.sh                   # 优雅停止
├── keys/                          # 空目录（运行时挂载真实私钥）
└── log/                           # 空目录（进程写日志）
```

#### 5.2.6 systemd 部署（推荐）

下面这份 unit 文件示例，可放到 `scripts/meta-api.service`，发版时随 tar.gz 带过去：

```ini
# /etc/systemd/system/meta-api.service
[Unit]
Description=meta-api server (anti-bot guard v1)
After=network-online.target redis.service mysql.service
Wants=network-online.target

[Service]
Type=simple
User=meta-api
Group=meta-api
WorkingDirectory=/opt/meta-api
ExecStart=/opt/meta-api/bin/meta-api
ExecReload=/bin/kill -HUP $MAINPID

# 优雅关闭：服务收 SIGTERM 后 RunWithGracefulShutdown 会退 in-flight 请求
KillSignal=SIGTERM
TimeoutStopSec=30

# 资源限制 / 安全沙箱
LimitNOFILE=65535
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/opt/meta-api/log /opt/meta-api/keys

# 自动重启
Restart=on-failure
RestartSec=5s

# 关键环境变量（仅示例，按需调整）
Environment=GIN_MODE=release
Environment=KEY_DIR=/opt/meta-api/keys

# 日志走 journald + 文件双轨：journald 便于命令行 query，文件由 lumberjack 切片
StandardOutput=append:/opt/meta-api/log/stdout.log
StandardError=append:/opt/meta-api/log/stderr.log

[Install]
WantedBy=multi-user.target
```

**首次部署到服务器**（按一次即可，后续只需替换二进制）：

```bash
# 1. 创建运行用户（不可登录、无 home）
sudo useradd --system --shell /usr/sbin/nologin meta-api

# 2. 部署目录
sudo mkdir -p /opt/meta-api/{bin,config,log,keys}
sudo chown -R meta-api:meta-api /opt/meta-api
sudo chmod 0750 /opt/meta-api/keys   # 仅 owner 可访问私钥

# 3. 解包
TARBALL=meta-api-2784e34-20260612.tar.gz   # ← 替换成你实际的包名
sudo tar -xzvf "${TARBALL}" -C /tmp/
sudo cp -r /tmp/meta-api-2784e34-*/bin/* /opt/meta-api/bin/
sudo cp /tmp/meta-api-2784e34-*/scripts/meta-api.service /etc/systemd/system/

# 4. 配置 + 私钥（这两类敏感文件不在 tar 里）
sudo cp /tmp/meta-api-2784e34-*/config/config.yml.example /opt/meta-api/config/config.yml
sudo vim /opt/meta-api/config/config.yml          # 填 mysql / redis / build_hashes
sudo install -o meta-api -g meta-api -m 0600 \
  ~/your_local_keys/private_key.pem /opt/meta-api/keys/private_key.pem

# 5. 启动
sudo systemctl daemon-reload
sudo systemctl enable --now meta-api
sudo systemctl status meta-api
sudo journalctl -u meta-api -f -n 200
```

#### 5.2.7 蓝绿 / 滚动发布（每次发版）

```bash
# 假设新包已上传到服务器 ~/releases/

set -e
NEW_TAR=~/releases/meta-api-NEWREV-NEWTS.tar.gz
WORK=/tmp/meta-api-newdeploy.$$

# 1. 解包到临时目录
mkdir -p "$WORK"
tar -xzvf "$NEW_TAR" -C "$WORK"
NEW_BIN=$(ls "$WORK"/*/bin/meta-api)

# 2. 验证新二进制本身能起来（5 秒烟测）
"$NEW_BIN" -version
# 输出：meta-api 2784e34 built=2026-06-12T... go=go1.24.0

# 3. 原子替换（rename 同分区原子保证）
sudo install -m 0755 -o meta-api -g meta-api "$NEW_BIN" /opt/meta-api/bin/meta-api.new
sudo mv -f /opt/meta-api/bin/meta-api.new /opt/meta-api/bin/meta-api

# 4. 平滑重启（systemd 收 stop signal → main 函数 RunWithGracefulShutdown 退 in-flight → 启动新进程）
sudo systemctl restart meta-api

# 5. 健康检查（5-10 秒内应返回正常）
sleep 5
curl -fsS http://127.0.0.1:8080/api/keys >/dev/null && echo OK
sudo systemctl is-active meta-api
sudo journalctl -u meta-api -n 50 --no-pager
```

#### 5.2.8 一键 Makefile（强烈推荐放仓库）

把上面散落的命令聚合到 `meta-api/Makefile`：

```makefile
APP_NAME    := meta-api
GIT_REV     := $(shell git rev-parse --short HEAD)
BUILD_TS    := $(shell date -u +%Y-%m-%dT%H:%M:%SZ)
GO_VERSION  := $(shell go version | awk '{print $$3}')
LDFLAGS     := -s -w \
                -X 'main.gitRev=$(GIT_REV)' \
                -X 'main.buildTime=$(BUILD_TS)' \
                -X 'main.goVersion=$(GO_VERSION)'

.PHONY: test vet build build-linux pkg clean

test:
	go test ./... -count=1

vet:
	go vet ./...

# 本地 debug build
build:
	go build -ldflags="$(LDFLAGS)" -o dist/$(APP_NAME) .

# Linux 生产 build
build-linux:
	GOOS=linux GOARCH=amd64 CGO_ENABLED=0 \
	  go build -trimpath -ldflags="$(LDFLAGS)" -o dist/$(APP_NAME) .

# 完整发布包
pkg: build-linux
	@TS=$$(date +%Y%m%d-%H%M%S); \
	PKG=dist/$(APP_NAME)-$(GIT_REV)-$$TS; \
	rm -rf $$PKG && mkdir -p $$PKG/{bin,config,scripts,log,keys}; \
	cp dist/$(APP_NAME) $$PKG/bin/; \
	cp config/config.yml $$PKG/config/config.yml.example; \
	cp scripts/meta-api.service $$PKG/scripts/ 2>/dev/null || true; \
	echo "git_rev: $$(git rev-parse HEAD)"   >  $$PKG/VERSION; \
	echo "git_short: $(GIT_REV)"             >> $$PKG/VERSION; \
	echo "built_at: $(BUILD_TS)"             >> $$PKG/VERSION; \
	echo "go_version: $(GO_VERSION)"         >> $$PKG/VERSION; \
	chmod 0755 $$PKG/bin/$(APP_NAME); \
	tar -czvf $$PKG.tar.gz -C dist $$(basename $$PKG); \
	ls -lh $$PKG.tar.gz

clean:
	rm -rf dist/
```

之后发版只需：

```bash
cd /Users/bytedance/meta-api
make test
make pkg
# → dist/meta-api-2784e34-20260612-153012.tar.gz
```

### 5.3 健康检查

```bash
# 1. /api/keys 透传通路
curl -s http://localhost:3000/api/keys | head -c 80
# 期望开头：{"publicKey":"-----BEGIN PUBLIC KEY-----..."

# 2. share/precheck 风控通路（用真实浏览器更稳，curl 不带 envelope 必拒）
# 验证日志：grep guard_eval logs/http.info.log | head -1
# decision=0 (Accept) / decision=1 (Silent) / reject_reason=L1..L4
```

---

## 6. 标准发版顺序（**严格按 1→6 执行**）

> 任何一步失败立刻 stop & rollback，下一步开始前必须确认上一步达成"验证标准"。

### 步骤 1：Rust 构建 + 自检

```bash
cd /Users/bytedance/crypto-wasm
git pull
CARGO_TARGET_DIR=/tmp/guard-wasm-target cargo test --release
bash scripts/build.sh
```
**验证标准**：
- [x] 所有 cargo test 通过
- [x] verify-obfuscation.sh 输出 `[ok]`
- [x] `pkg/guard_core_bg.wasm` < 200KB（当前约 100KB）

### 步骤 2：记录新 BUILD_HASH

```bash
cd /Users/bytedance/crypto-wasm
NEW_HASH=$(git rev-parse HEAD | cut -c1-16)
echo "NEW_BUILD_HASH=$NEW_HASH"
```
**验证标准**：
- [x] hash 是 16 个 hex 字符
- [x] 与之前发版记录的 hash **不同**（说明 git HEAD 有变更）

### 步骤 3：后端先注册新 hash（双白名单）

修改 [config.yml](file:///Users/bytedance/meta-api/config/config.yml) 的 `guard.build_hashes`，**保留旧 hash + 增加新 hash**：

```yaml
guard:
  build_hashes:
    - "<NEW_HASH>"     # 新版本
    - "<OLD_HASH>"     # 旧版本（保留 15-30 分钟双跑期）
  skip_hmac_when_empty: false
```

热重启 meta-api（或 SIGHUP，本项目当前为冷重启）：
```bash
systemctl restart meta-api    # 或自家进程管理工具
```

**验证标准**：
- [x] 后端启动成功，日志无 `guard build_hashes invalid` 错误
- [x] 旧前端流量不被拒（grep 一段日志确认 `decision=0` 仍在）

### 步骤 4：前端同步新 wasm 并发布

```bash
cd /Users/bytedance/portal-web

# 同步产物
rsync -av /Users/bytedance/crypto-wasm/pkg/ public/guard/

# 构建 + 部署
pnpm build
# 走自家 CI / SCP / rsync 把 .output/ 推到目标机器，本文不展开
```

**验证标准**：
- [x] 浏览器 DevTools 加载 `/guard/guard_core_bg.wasm` → 200
- [x] `Guard.build_hash()` 返回的 8 字节 hex == 新 hash
- [x] 创建分享 + 我的分享 + 文章详情浏览量 全部正常（不应再出现 `E0x` 报错）

### 步骤 5：观察一段时间，移除旧 hash

灰度 15-30 分钟（看你流量大小决定），无异常后：

```yaml
guard:
  build_hashes:
    - "<NEW_HASH>"     # 仅保留当前生产
  skip_hmac_when_empty: false
```

再次重启 meta-api，旧 wasm 用户从此被静默拒。

**验证标准**：
- [x] 浏览器硬刷一次仍然全功能正常
- [x] 老 hash 的请求被拒（日志 `reject_reason=HMAC_BAD`）

### 步骤 6：归档构建产物

```bash
cd /Users/bytedance/crypto-wasm
TS=$(date +%Y%m%d-%H%M%S)
mkdir -p archive/$TS
cp pkg/guard_core_bg.wasm pkg/guard_core.js pkg/build_hash.txt archive/$TS/
echo "$NEW_HASH" > archive/$TS/BUILD_HASH
git rev-parse HEAD > archive/$TS/git_head
```

便于事故时直接 rollback 到上次产物。

---

## 7. 回滚 SOP

### 7.1 前端 wasm 出问题（E0x 报错率激增）

```bash
# 1. 后端 config.yml 临时把 skip_hmac_when_empty 改为 true 并清空 build_hashes
guard:
  build_hashes: []
  skip_hmac_when_empty: true
# 2. 重启 meta-api（约 5 秒）
# 3. 用户立刻恢复（HMAC 不再校验，但 RSA + AES + TLV + nonce + dedup 仍生效）
# 4. 把 portal-web/public/guard 还原到上一次 archive/$TS/ 的产物，重新 build & 发布
# 5. 后端配置改回严格模式，重启
```

### 7.2 后端 share/viewlog 异常

直接走标准 Go 服务回滚，本文不展开。

### 7.3 私钥泄漏

```bash
# 1. 在所有服务器上立即执行：
cd $KEY_DIR
mv private_key.pem private_key.pem.compromised
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out private_key.pem
openssl rsa -in private_key.pem -pubout -out public_key.pem
# 2. keymanager watcher 自动 reload，不用重启
# 3. 把新 public_key.pem 同步到 portal-web/keys/，重启 Nuxt
# 4. 老 envelope 仍可被 .compromised 解（窗口期），15 分钟后删除
rm private_key.pem.compromised
# 5. 审计 redis 中受影响 fingerprint 的访问轨迹
```

---

## 8. 常见错误 → 定位

| 现象 | 首查 | 修复路径 |
|---|---|---|
| 浏览器 console `E01` | RSA 公钥格式 | 检查 `public/guard` 是否同步 + `/api/keys` 返回是否 PEM |
| 浏览器 console `E06` | fingerprint 长度 | FingerprintJS 输出 32 hex，[useClientGuard.ts](file:///Users/bytedance/portal-web/composables/useClientGuard.ts) `stretchFingerprintTo64Hex` 是否生效 |
| meta-api 日志 `HMAC_BAD` | build_hash 错位 | 比对 `git rev-parse HEAD \| cut -c1-16` vs config.yml |
| meta-api 日志 `RSA_FAIL` | 公私钥不匹配 | 重新走 §2 拷贝公钥 |
| precheck 200 但 token="" | 请求被静默拒 | 看 audit 日志 `reject_reason`：L1=UA 黑名单 / L2=referer / L3=频控 / L4=行为分 |
| precheck 4290 rate limited | 频控触发 | 调整 [engine.go](file:///Users/bytedance/meta-api/common/guard/engine.go) IP/fp 阈值 或 redis 清空 `guard:share-create:rate:*` |
| share/create 500 "bad fingerprint from engine" | 长度对齐 | service 期待 64hex，前端是否已拉伸 |
| 浏览器报错"无法获取浏览器指纹" | sign 失败 | 看 console 上一条 `[xx] sign failed` 真实原因 |
| Nuxt SSR 报 `public_key not found` | keys 目录 | 启动目录下必须有 `keys/public_key.pem` |
| meta-api 启动 `keymanager disabled: load current key failed` | KEY_DIR | 检查 `KEY_DIR` 环境变量，默认 `./keys` |

---

## 9. 关键文件路径速查

### 9.1 crypto-wasm

| 路径 | 说明 |
|---|---|
| [src/lib.rs](file:///Users/bytedance/crypto-wasm/src/lib.rs) | wasm-bindgen 入口 + Guard 类型 |
| [src/envelope.rs](file:///Users/bytedance/crypto-wasm/src/envelope.rs) | 二进制信封打包（296B 头 + ciphertext + 32B HMAC） |
| [src/crypto.rs](file:///Users/bytedance/crypto-wasm/src/crypto.rs) | AES-GCM / RSA-OAEP / HMAC / base64 |
| [src/error.rs](file:///Users/bytedance/crypto-wasm/src/error.rs) | E01..E07 错误码（obfstr 编码） |
| [src/build_info.rs](file:///Users/bytedance/crypto-wasm/src/build_info.rs) | BUILD_HASH 编译期注入 |
| [build.rs](file:///Users/bytedance/crypto-wasm/build.rs) | 写 BUILD_HASH 到 OUT_DIR |
| [scripts/build.sh](file:///Users/bytedance/crypto-wasm/scripts/build.sh) | 一键构建脚本 |
| [scripts/verify-obfuscation.sh](file:///Users/bytedance/crypto-wasm/scripts/verify-obfuscation.sh) | 反逆向自检 |

### 9.2 portal-web

| 路径 | 说明 |
|---|---|
| [composables/useClientGuard.ts](file:///Users/bytedance/portal-web/composables/useClientGuard.ts) | wasm 加载 + sign 调用入口 |
| [composables/useBehaviorRecorder.ts](file:///Users/bytedance/portal-web/composables/useBehaviorRecorder.ts) | 行为采集 ringbuffer |
| [public/guard/](file:///Users/bytedance/portal-web/public/guard) | wasm 静态产物（gitignore） |
| [server/api/keys.ts](file:///Users/bytedance/portal-web/server/api/keys.ts) | `/api/keys` 公钥下发 |
| [server/api/share-json.ts](file:///Users/bytedance/portal-web/server/api/share-json.ts) | SSR 中转 share-create 请求 |
| [components/JsonTool/ShareDialog.vue](file:///Users/bytedance/portal-web/components/JsonTool/ShareDialog.vue) | 分享弹窗（precheck + create + 我的分享） |
| [keys/public_key.pem](file:///Users/bytedance/portal-web/keys/public_key.pem) | 后端同款公钥 |

### 9.3 meta-api

| 路径 | 说明 |
|---|---|
| [common/guard/engine.go](file:///Users/bytedance/meta-api/common/guard/engine.go) | 风控引擎主流程（信封解码 + L1-L4） |
| [common/guard/store.go](file:///Users/bytedance/meta-api/common/guard/store.go) | redis 抽象（nonce / dedup / rate） |
| [common/guard/decrypt.go](file:///Users/bytedance/meta-api/common/guard/decrypt.go) | RSA + AES + HMAC |
| [common/guard/builds.go](file:///Users/bytedance/meta-api/common/guard/builds.go) | BuildHashRegistry |
| [app/handler/share/share.go](file:///Users/bytedance/meta-api/app/handler/share/share.go) | `/share/precheck` + `/share/create` 端点 |
| [app/service/share/service.go](file:///Users/bytedance/meta-api/app/service/share/service.go) | token 一次性令牌 |
| [config/config.yml](file:///Users/bytedance/meta-api/config/config.yml) | 配置入口 |
| [pkg/keymanager/manager.go](file:///Users/bytedance/meta-api/pkg/keymanager/manager.go) | 私钥热更 watcher |

---

## 10. 检查清单（每次发版剪贴板用）

```
[ ] crypto-wasm: git pull && cargo test --release 全绿
[ ] crypto-wasm: bash scripts/build.sh 成功，verify-obfuscation [ok]
[ ] crypto-wasm: 记录 NEW_BUILD_HASH = git rev-parse HEAD | cut -c1-16
[ ] meta-api: config.yml build_hashes 加入 NEW_BUILD_HASH（保留 OLD）
[ ] meta-api: 重启 + 健康检查 + 日志无 invalid hash
[ ] portal-web: rsync wasm 产物到 public/guard/
[ ] portal-web: pnpm build 成功
[ ] portal-web: 部署 + 浏览器硬刷 + 全功能烟测
[ ] 监控 15-30 分钟无 E0x / HMAC_BAD 报警
[ ] meta-api: config.yml 移除 OLD_BUILD_HASH，再次重启
[ ] crypto-wasm: archive/$TS/ 归档产物
[ ] git tag v1.x.y && git push --tags
```
