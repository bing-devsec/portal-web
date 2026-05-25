declare module '~/components/CatalogRenderer.vue' {
  const component: any
  export default component
} 

// 第三方库类型占位声明，避免 TypeScript 在未安装类型时报错
declare module 'mermaid' {
  const mermaid: any
  export default mermaid
}

declare module 'echarts' {
  const echarts: any
  export default echarts
}