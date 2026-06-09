# 指纹解密接口规格（给后端 meta-api 实现）

> 面向 Go 后端开发。本文档定义一个**新接口**：把浏览器加密的指纹密文解密成明文指纹返回。
> Nuxt 侧已改造完成，上线后会调用该接口；接口未上线前，JSON 分享功能不可用。

## 1. 背景与动机

JSON 分享接口（Nuxt 的 `/api/share-json`）需要"浏览器指纹"作为匿名用户身份，用于配额、限流、"我的分享"列表过滤、删除鉴权。

- 浏览器端用 `JSEncrypt`（**RSA PKCS#1 v1.5** padding）+ 公钥加密指纹，放到请求头 `x-client-id`。
- 原先 Nuxt 进程内用 Node `crypto.privateDecrypt(RSA_PKCS1_PADDING)` 解密。
- **问题**：新版 Node（>= 18.19 / 20.11，含 CVE-2023-46809 安全修复）**已禁用** `privateDecrypt` 的 `RSA_PKCS1_PADDING`，线上容器（node 20.17）解密直接抛错：
  ```
  RSA_PKCS1_PADDING is no longer supported for private decryption
  ```
  导致线上分享报"无法验证客户端身份"。本地旧/特殊构建的 Node 仍允许，所以本地正常——这掩盖了问题。

**解决方案**：Go 后端的私钥与 PKCS#1 解密一直可用（文章详情等接口本就依赖它解密 `x-client-id`）。因此把指纹解密统一**委托给 Go**，Nuxt 仅做转发，自身不再读取/持有私钥。

## 2. 调用链路

```
浏览器 ──(x-client-id: 加密指纹密文)──> Nuxt /api/share-json
   Nuxt ──(内网直连 meta-api:8080)──> Go  POST /user/fingerprint/decrypt
   Go 用私钥 PKCS#1 解密 ──> 返回明文指纹 ──> Nuxt 用明文指纹跑配额/限流/存储
```

- Nuxt → Go 走**内网直连**（容器内 `http://meta-api:8080`，即 Nuxt 的 `ssrApiBase`），不经过 nginx。
- 这与文章详情 SSR 直连后端是同一通道。

## 3. 接口定义（需要后端新增）

### 路径与方法

```
POST /user/fingerprint/decrypt
```

### 请求

**Header**

| Header | 必填 | 说明 |
|--------|------|------|
| `Content-Type` | 是 | `application/json` |
| `x-client-id` | 否 | 浏览器加密后的指纹密文（base64）。与 body 二选一，优先级更高 |

**Body**

```json
{
  "encryptedFingerprint": "<浏览器加密后的指纹密文 base64>"
}
```

> Nuxt 会**同时**在 `x-client-id` 头和 body 里带上同一份密文，后端任取其一即可（建议优先读 `x-client-id`，为空再读 body）。

### 响应

**解密成功**（HTTP 200）

```json
{
  "code": 2000,
  "message": "success",
  "data": {
    "fingerprint": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4"
  }
}
```

**解密失败 / 密文非法 / 缺参**（HTTP 200，靠 `code` 区分）

```json
{
  "code": 4001,
  "message": "failed",
  "data": null
}
```

### 字段约定

- `code`：成功固定为 `2000`（与现有后端成功码一致）；失败用任意非 2000 码（示例 `4001`，可按你们规范调整）。
- `data.fingerprint`：解密出的**明文指纹**，必须是 **32 位小写十六进制**（`^[a-f0-9]{32}$`，与前端 `FingerprintJS.hashComponents` 输出一致）。
- **必须返回明文指纹本身**，不能只返回 success/failed。原因：Nuxt 拿这串明文当用户身份键做配额（每人最多 5 个分享）、限流、列表过滤、删除鉴权，拿不到指纹则这些功能全部失效。

## 4. 解密算法要求（关键，务必对齐）

- **算法**：RSA
- **Padding**：`RSA PKCS#1 v1.5`（**不是** OAEP）。因为前端 `JSEncrypt` 只支持 PKCS#1 v1.5。
- **私钥**：必须与 Nuxt `/api/keys` 对外暴露的**公钥配对**。
  - 该公钥即 `keys/public_key.pem`，前端取它做加密。
  - 后端用于文章详情解密 `x-client-id` 的私钥若与此公钥同源，直接复用即可（线上文章详情能正常解密 = 已配对）。
- 解密得到明文后，**校验**是否匹配 `^[a-f0-9]{32}$`，不匹配按失败处理（返回非 2000）。

### Go 参考实现（示意）

```go
// POST /user/fingerprint/decrypt
func DecryptFingerprint(c *gin.Context) {
    enc := c.GetHeader("x-client-id")
    if enc == "" {
        var body struct {
            EncryptedFingerprint string `json:"encryptedFingerprint"`
        }
        _ = c.ShouldBindJSON(&body)
        enc = body.EncryptedFingerprint
    }
    if enc == "" {
        c.JSON(200, gin.H{"code": 4001, "message": "failed", "data": nil})
        return
    }

    ciphertext, err := base64.StdEncoding.DecodeString(enc)
    if err != nil {
        c.JSON(200, gin.H{"code": 4001, "message": "failed", "data": nil})
        return
    }

    // privateKey 为与 public_key.pem 配对的 *rsa.PrivateKey
    plain, err := rsa.DecryptPKCS1v15(rand.Reader, privateKey, ciphertext)
    if err != nil {
        c.JSON(200, gin.H{"code": 4001, "message": "failed", "data": nil})
        return
    }

    fp := string(plain)
    if !regexp.MustCompile(`^[a-f0-9]{32}$`).MatchString(fp) {
        c.JSON(200, gin.H{"code": 4001, "message": "failed", "data": nil})
        return
    }

    c.JSON(200, gin.H{
        "code": 2000, "message": "success",
        "data": gin.H{"fingerprint": fp},
    })
}
```

## 5. 安全与运维注意

- **内网回传明文指纹是可接受的**：指纹本身非机密，仅作匿名身份标识；且 meta-api:8080 不对公网暴露。
- **建议鉴权/限流**：该接口可被高频调用，建议复用现有网关层限流；如需更严格，可校验来源仅限内网。
- **密钥轮换**：若轮换公私钥对，务必保证 `keys/public_key.pem`（前端加密用）与后端解密私钥**同步更新且配对**，否则解密全部失败。
- **错误日志**：解密失败时建议记录密文长度等非敏感信息便于排查，不要打印明文指纹。

## 6. Nuxt 侧改动（已完成，供后端了解上下游）

- `server/api/share-json.ts`：删除本地私钥读取与 `privateDecrypt` 逻辑，改为 `POST {ssrApiBase}/user/fingerprint/decrypt` 调用本接口；`getClientFingerprint` 改为异步。
- 移除了与请求头指纹相关的无关注入：
  - 删除 `plugins/api-interceptor.client.ts`（原先给文章详情注入 `x-client-id`）。
  - `utils/api.ts`：不再给所有 `/user/*` 请求注入 `x-client-id`。
  - `pages/article-detail/[id].vue`：文章详情请求不再带 `x-client-id`。
- **结论**：改造后，请求头 `x-client-id` **仅** JSON 分享链路使用。文章详情、浏览量打点等接口若后端原本未真正使用该头，可一并忽略；浏览量打点的指纹仍在请求 **body** 内（未改动）。

## 7. 联调自测

公钥取自 `GET /api/keys`（Nuxt 暴露）。可用前端同款 `JSEncrypt` 加密一个 32-hex 串，调用本接口验证回包：

```bash
curl -X POST http://meta-api:8080/user/fingerprint/decrypt \
  -H 'Content-Type: application/json' \
  -H 'x-client-id: <base64 密文>' \
  -d '{"encryptedFingerprint":"<base64 密文>"}'
# 期望: {"code":2000,"message":"success","data":{"fingerprint":"<32-hex>"}}
```
