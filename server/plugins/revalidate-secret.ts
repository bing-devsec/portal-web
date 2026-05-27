import { existsSync, readFileSync } from "node:fs";

/**
 * 运行时注入 ISR 主动失效接口的共享密钥
 *
 * 为什么需要这个 plugin：
 *   nuxt.config.ts 里 runtimeConfig.revalidateSecret 是在 build 时被求值的，
 *   而生产部署使用 docker-compose secrets，密钥文件只在容器运行时才挂载到
 *   /run/secrets/nuxt_revalidate_secret。Nuxt 自带的 NUXT_<KEY> 环境变量
 *   覆盖机制只认完全匹配的变量名，不识别 _FILE 后缀（docker secrets 约定）。
 *
 *   因此固化进产物的值是空字符串，容器启动后 server/api/_revalidate.post.ts
 *   读到 expected 为空，直接 500 返回 "revalidate secret not configured"。
 *
 * 解决方案：
 *   在 nitro 启动钩子里读密钥文件 / 环境变量，覆盖 runtimeConfig.revalidateSecret。
 *   优先级：
 *     1) NUXT_REVALIDATE_SECRET_FILE → 容器内通常是 /run/secrets/nuxt_revalidate_secret
 *     2) NUXT_REVALIDATE_SECRET      → 直接传值（本地开发或简单部署）
 */
export default defineNitroPlugin(() => {
  const config = useRuntimeConfig();
  // 已经有值（NUXT_REVALIDATE_SECRET 环境变量已被 Nuxt 自动覆盖）就不再处理
  if (config.revalidateSecret) return;

  const secretFile = process.env.NUXT_REVALIDATE_SECRET_FILE;
  if (secretFile && existsSync(secretFile)) {
    // trim：手动 echo > file 时容易尾部带换行符，与后端 header 不一致会导致 401
    config.revalidateSecret = readFileSync(secretFile, "utf-8").trim();
    return;
  }

  const secretEnv = process.env.NUXT_REVALIDATE_SECRET;
  if (secretEnv) {
    config.revalidateSecret = secretEnv.trim();
    return;
  }

  // 仍然为空时不报错——保持与 nuxt.config.ts 中"运行时由接口主动 500 提醒"的一致行为
  console.warn(
    "[revalidate-secret] NUXT_REVALIDATE_SECRET(_FILE) not configured; /api/_revalidate will return 500."
  );
});
