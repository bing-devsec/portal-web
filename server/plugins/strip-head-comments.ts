/**
 * Nitro server plugin：清理 SSR 输出 <head> 中的 Vue fragment 锚点注释
 * （即 `<!--[-->` 与 `<!--]-->`），让线上 HTML 的 head 区域更干净。
 *
 * 为什么要单独放在 server/plugins 而不是 nuxt.config.ts 的 nitro.hooks：
 *   `render:html` 是 Nitro 运行时实际派发的钩子，但 NitroHooks 的 TS 类型
 *   声明里没有它，写在 nuxt.config.ts 的 nitro.hooks 字面量里会被 TS 报错。
 *   Nuxt 官方推荐做法就是用 server plugin（defineNitroPlugin）注册。
 *
 * 安全说明：
 *   - 只对 html.head 做替换。
 *   - 严禁扩展到 html.body / html.bodyAppend / html.bodyPrepend：body 内的
 *     `<!--[-->` / `<!--]-->` 是 v-if、v-for、<template v-xx>、Teleport 的
 *     hydration 坐标系，一旦剥离，运行时切换 v-if、增删 v-for 项、关闭
 *     Teleport 等动作会立刻报 hydration mismatch 或事件失效。
 *   - `<!--v-if-->` 同理保留：它是 v-if=false 时的占位锚点。
 *
 * 参考：
 *   https://nuxt.com/docs/api/advanced/hooks#nitro-app-hooks-runtime-server-side
 */
export default defineNitroPlugin((nitroApp) => {
    nitroApp.hooks.hook("render:html", (html) => {
        html.head = html.head.map((s) =>
            s.replace(/<!--\[-->|<!--\]-->/g, "")
        );
    });
});
