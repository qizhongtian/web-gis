import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import basicSsl from '@vitejs/plugin-basic-ssl'
import UnoCSS from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { resolve } from 'node:path'
import mockServer from './mock'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isProd = mode === 'production'
  // 部署子路径（GitHub Pages 项目站点为 /<仓库名>/）：CI 环境变量 > .env.[mode] > 根路径
  const env = loadEnv(mode, process.cwd(), '')
  const base = (process.env.VITE_BASE || env.VITE_BASE || '/').replace(/\/?$/, '/')
  // 本地 HTTPS：npm run dev:https（.env.https 里 VITE_HTTPS=1），自签证书，浏览器需手动信任一次
  const useHttps = (process.env.VITE_HTTPS || env.VITE_HTTPS) === '1'
  return {
    base,
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
      // 开启后 dev / preview 都用自签证书，页面变 https 时播放器会自动改用 wss
      ...(useHttps ? [basicSsl()] : []),
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
      // 地形默认走全球高程（ArcGIS，免密钥、可直接跨域），开发环境也不需要地形代理
      proxy: {
        // '/api': { target: 'http://localhost:3000', changeOrigin: true },
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
