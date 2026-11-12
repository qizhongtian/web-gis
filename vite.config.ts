import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { resolve } from 'node:path'
import https from 'node:https'
import mockServer from './mock'

/** 复用 TLS 连接，避免地形瓦片逐块握手导致代理缓慢 */
const terrainAgent = new https.Agent({ keepAlive: true, maxSockets: 32 })

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isProd = mode === 'production'
  return {
    plugins: [
      vue(),
      UnoCSS(),
      // API / Hook 自动引入：ref、computed、useRouter、useI18n、useLocalStorage、自定义 composable 等
      AutoImport({
        imports: ['vue', 'vue-router', 'pinia', 'vue-i18n', '@vueuse/core'],
        dirs: ['src/composables', 'src/store', 'src/utils'],
        resolvers: [ElementPlusResolver({ importStyle: false })],
        dts: 'src/types/auto-imports.d.ts',
        vueTemplate: true,
      }),
      // 组件自动引入：src/components 下的全局组件 + Element Plus 按需引入
      Components({
        dirs: ['src/components'],
        resolvers: [ElementPlusResolver({ importStyle: false })],
        dts: 'src/types/components.d.ts',
      }),
      mockServer(),
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    // 预构建 GIS 库子模块，避免首次打开示例页时触发依赖重新优化导致页面刷新
    optimizeDeps: {
      include: [
        'three',
        'leaflet',
        'ol/Map.js',
        'ol/View.js',
        'ol/layer/Tile.js',
        'ol/layer/Vector.js',
        'ol/source/OSM.js',
        'ol/source/XYZ.js',
        'ol/source/Vector.js',
        'ol/format/GeoJSON.js',
        'ol/interaction/Draw.js',
        'ol/interaction/Select.js',
        'ol/style/Style.js',
        'ol/style/Stroke.js',
        'ol/style/Fill.js',
        'ol/style/Circle.js',
        'ol/style/Text.js',
        'ol/Overlay.js',
        'ol/Feature.js',
        'ol/geom/Point.js',
        'ol/geom/Polygon.js',
        'ol/geom/LineString.js',
        'ol/geom/Circle.js',
        'ol/proj.js',
        'ol/sphere.js',
      ],
    },
    define: {
      __APP_ENV__: JSON.stringify(mode),
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      open: false,
      // 真实后端场景下走代理（本项目使用本地 mock 中间件，无需代理）
      proxy: {
        // '/api': { target: 'http://localhost:3000', changeOrigin: true },
        // 香港 DEM 地形服务：源站返回重复的 CORS 头，浏览器直连会被拦截，开发环境走代理
        '/hk-terrain': {
          target: 'https://bk.mediumvis.com:8090',
          changeOrigin: true,
          secure: true,
          agent: terrainAgent,
          rewrite: (path) => path.replace(/^\/hk-terrain/, ''),
        },
      },
    },
    esbuild: {
      // 生产环境去掉 console / debugger（编译优化）
      drop: isProd ? ['console', 'debugger'] : [],
    },
    build: {
      target: 'es2015',
      cssCodeSplit: true,
      sourcemap: false,
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          // 打包优化：手动分包，避免单个 chunk 过大 & 提升缓存命中率
          manualChunks(id) {
            if (id.includes('node_modules')) {
              // GIS 库单独分包：仅在打开对应示例页时按需加载
              if (id.includes('node_modules/ol/')) return 'gis-ol'
              if (id.includes('node_modules/three/')) return 'gis-three'
              if (id.includes('node_modules/leaflet/')) return 'gis-leaflet'
              if (id.includes('node_modules/cesium/')) return 'gis-cesium'
              if (id.includes('element-plus')) return 'element-plus'
              if (id.includes('echarts')) return 'echarts'
              if (id.includes('vue') || id.includes('pinia')) return 'vue-vendor'
              return 'vendor'
            }
          },
        },
      },
    },
  }
})
