# WebGIS 示例管理平台

基于 **Vue 3 + TypeScript + Pinia + Vue Router 4 + VueUse + Element Plus + UnoCSS** 的 WebGIS 工具示例管理平台，集成 **Cesium.js / OpenLayers / Three.js** 示例，包含登录鉴权、动态路由、权限菜单、按钮权限、中英文切换等后台管理能力，整体为深色科技风。

![tech](https://img.shields.io/badge/Vue-3.x-brightgreen) ![tech](https://img.shields.io/badge/TypeScript-5.x-blue) ![tech](https://img.shields.io/badge/Vite-5.x-purple)

## 一、整体架构

```
web-gis/
├── mock/                     # 轻量 Mock 服务（Vite dev 中间件，无额外依赖）
│   └── index.ts              # /api/login /api/user/info /api/menus /api/users ... 
├── public/                   # 静态资源（favicon 等）
├── src/
│   ├── api/                  # axios 封装（拦截器：token 注入、401 处理、业务码解包）
│   ├── components/
│   │   └── DemoBox.vue       # GIS 示例通用容器（CDN 加载 loading/error/retry + 资源释放）
│   ├── directives/
│   │   └── permission.ts     # v-permission 按钮权限指令
│   ├── i18n/                 # vue-i18n 中英文语言包（zh-CN / en）
│   ├── layout/               # 整体布局
│   │   ├── index.vue         # 头部 + 左侧菜单 + 右侧内容（面包屑 + 动态路由出口）
│   │   └── components/       # Header / SideMenu / MenuItemNode(递归多级菜单) / Breadcrumb
│   ├── router/
│   │   ├── index.ts          # 静态路由（login / layout / 404）
│   │   └── generator.ts      # 菜单树 -> 动态路由（import.meta.glob 懒加载视图）
│   ├── store/                # Pinia
│   │   ├── user.ts           # token / 用户信息 / 权限 / 动态路由装载
│   │   └── app.ts            # 语言、侧边栏状态（VueUse useLocalStorage 持久化）
│   ├── utils/
│   │   ├── loadScript.ts     # 动态注入 script/link
│   │   └── gis/              # cesiumLoader / olLoader / threeLoader（CDN 按需加载）
│   ├── views/
│   │   ├── login/            # 登录页
│   │   ├── dashboard/        # 首页
│   │   ├── cesium/           # Cesium 示例：基础/Geojson/工具/图层/3D Tiles/飞入/坐标转换/
│   │   │                     #           视频融合/聚合/空间分析/综合应用
│   │   ├── openlayer/        # OpenLayers 示例：基础/图层/工具/交互
│   │   ├── three/            # Three.js 示例：基础/几何体/材质/动画
│   │   └── system/           # 用户管理 / 角色管理 / 菜单管理（admin 专属）
│   ├── permission.ts         # 全局路由守卫（鉴权 + 动态路由装载）
│   ├── main.ts
│   └── App.vue
├── vite.config.ts            # 分包 / drop console / alias
├── uno.config.ts             # UnoCSS 原子化 + 科技风 shortcuts
└── package.json
```

### 核心流程

1. **登录**：`POST /api/login`（Mock 校验账号）→ 返回 token（Pinia + VueUse 持久化）。
2. **动态路由**：路由守卫检测到已登录但未装载路由 → 拉取 `/api/user/info` 与 `/api/menus`（按角色过滤的菜单树）→ `generator.ts` 将菜单树转换为路由表 → `router.addRoute()` 注入 Layout 子路由。
3. **权限菜单**：菜单树由 Mock 按角色（admin / viewer）过滤，左侧菜单直接渲染 `store.user.menus`，天然多级（递归组件 `MenuItemNode`）。
4. **按钮权限**：`v-permission="'sys:user:add'"`，无权限时元素被移除。
5. **GIS 示例**：页面统一使用 `DemoBox` 容器，传入 `loader`（加载 Cesium/OL/Three）与 `init`（初始化函数，返回清理函数），组件卸载时自动释放资源。

### 内置账号（Mock）

| 账号      | 密码     | 角色   | 权限                                       |
| --------- | -------- | ------ | ------------------------------------------ |
| `admin`   | `123456` | admin  | 全部菜单 + 用户/角色/菜单管理 + 全部按钮   |
| `viewer`  | `123456` | viewer | GIS 示例菜单，系统管理不可见，仅量算按钮   |

## 二、环境配置

### 环境要求

- Node.js >= 20.19.4（推荐 20 LTS；`.nvmrc` / `.node-version` 已标记 `20.19.4`，`package.json` 的 `engines` / `volta` 同步固定，`nvm use` / `fnm use` 即可切换）
- npm >= 10.8.2（lockfile 由 npm 10 生成，CI 使用 `npm ci`；pnpm / yarn 也能装，但请勿提交其它包管理器的 lockfile）

```bash
# 安装依赖
npm install

# 启动开发服务（Mock 内置）
npm run dev          # http://localhost:5173

# 本地 HTTPS（自签证书，需浏览器手动信任一次）
npm run dev:https    # https://localhost:5173

# 类型检查
npm run typecheck

# 生产构建（含 vue-tsc 类型检查）
npm run build
# 仅构建（跳过类型检查，CI 中可分开跑）
npm run build:fast

# 预览生产构建
npm run preview
```

### 环境变量（.env / .env.development / .env.production）

| 变量               | 说明                       | 默认   |
| ------------------ | -------------------------- | ------ |
| `VITE_API_BASE`    | 接口基础路径               | `/api` |
| `VITE_PORT`        | 开发端口                   | `5173` |
| `VITE_HTTPS`       | 开发服务启用自签 HTTPS（`.env.https`） | -      |
| `VITE_CESIUM_TOKEN`| Cesium ion Token（可选）   | -      |

> `npm run dev:https` 会以 `mode=https` 加载 `.env.https`（内含 `VITE_HTTPS=1`），Vite 用自签证书起 `https://localhost:5173`；
> 页面变成 https 后，视频监控的两个页面会自动把默认 ws 地址切成 `wss`（实时 9102 / 回放 9322），需要流媒体服务器同步提供 wss 并让证书可信。

> 3D Tiles（OSM 建筑）示例需要在 [Cesium ion](https://cesium.com/ion/) 免费申请 Token，可在页面内输入（存入 localStorage）或配置环境变量。
> 接入真实后端时，删除 `vite.config.ts` 中的 `mockServer()` 并启用 `server.proxy` 代理 `/api` 即可，业务代码无需改动。

### GIS 库加载策略

为避免将体积庞大的 Cesium（约 40MB+）打入业务包，平台默认通过 CDN（jsDelivr）**按需动态加载**三大 GIS 库：

- `cesiumLoader.ts`：注入 `Cesium.js` + `widgets.css`（UMD）
- `olLoader.ts`：`ol@9` ESM 子模块动态 import
- `threeLoader.ts`：`three.module.js` 动态 import

如需离线/内网部署：`npm i cesium ol three`，将 loader 改为静态 import，并在 `vite.config.ts` 中配置 `vite-plugin-cesium` 或手动 copy 静态资源。

## 三、打包优化

已在 `vite.config.ts` 中落地：

1. **手动分包（manualChunks）**：`element-plus`、`vue 全家桶`、`vendor` 分离，长缓存 + 并行加载；
2. **代码分割**：全部视图与 GIS 库均为懒加载（路由级 `import()` + 动态 CDN）；
3. **CSS 代码分割**：`cssCodeSplit: true`，按需加载样式；
4. **去除 console/debugger**：esbuild `drop`，零成本清除；
5. **chunkSizeWarningLimit**：放宽 GIS 大包告警阈值，配合分包定位问题。

建议再叠加：

```bash
npm i -D vite-plugin-compression2 rollup-plugin-visualizer
```

```ts
// vite.config.ts
import { compression } from 'vite-plugin-compression2'
import { visualizer } from 'rollup-plugin-visualizer'

plugins: [
  // gzip + brotli 双产物，Nginx 开启 gzip_static/brotli_static
  compression({ algorithm: 'gzip' }),
  compression({ algorithm: 'brotliCompress' }),
  // 构建产物分析
  visualizer({ open: true, gzipSize: true }),
]
```

Nginx 关键配置：

```nginx
gzip_static on;
location /assets/ { add_header Cache-Control "public, max-age=31536000, immutable"; }
```

## 四、编译优化

1. **依赖预构建**：`optimizeDeps.entries` 收敛入口，冷启动更快；高版本 Vite 内部已用 esbuild 预打包 CommonJS 依赖。
2. **esbuild 替代 terser**：默认 minifier 即 esbuild，压缩速度提升 10 倍以上；`drop: ['console','debugger']` 编译期清理。
3. **TypeScript 检查与构建解耦**：`build:fast` 跳过 `vue-tsc`，类型检查交给 CI 的 `typecheck` 步骤，缩短构建时间。
4. **按需加载 Element 图标**：当前全局注册便于开发；体积敏感时可删除 `main.ts` 的全局注册，改为 `<script setup>` 内按需 `import { User } from '@element-plus/icons-vue'`（配合 `unplugin-vue-components` 自动导入 Element Plus 可再减包体）。
5. **UnoCSS 原子化**：构建时按需生成 CSS，产物仅包含实际用到的样式类。
6. **缓存**：开启构建缓存（Vite 5 内置），CI 中缓存 `node_modules/.vite`。

## 五、图片优化

1. **SVG 优先**：Logo / 图标使用 SVG（如 `public/favicon.svg`），矢量无损、体积小、可变色；
2. **按需加载**：示例页面图片全部懒加载 `<img loading="lazy">`，路由级代码分割后图片随页面进入；
3. **现代格式**：位图统一转 **WebP/AVIF**（体积比 PNG/JPG 减少 30~70%）：

   ```bash
   npm i -D vite-plugin-imagemin   # 或构建前用 squoosh/sharp 批量转换
   ```

   ```ts
   // vite.config.ts
   import viteImagemin from 'vite-plugin-imagemin'
   plugins: [viteImagemin({ gifsicle: {}, mozjpeg: { quality: 75 }, pngquant: { quality: [0.65, 0.8] }, webp: { quality: 75 } })]
   ```

4. **小图内联**：`assetsInlineLimit: 8192`，8KB 以下图片直接 base64 内联，减少请求数；
5. **CDN/对象存储**：大图（瓦片截图、示例封面）上 OSS + CDN，并按 DPR 提供 1x/2x。

## 六、功能清单

- 登录 / 退出（Mock 鉴权，token 持久化）
- 头部 + 左侧多级菜单 + 面包屑 + 内容区经典布局（科技风深色主题）
- 动态路由（菜单树 → `addRoute`）、权限菜单（按角色过滤）
- 按钮级权限（`v-permission` 指令）
- 用户 / 角色 / 菜单管理（admin 角色）
- 中英文切换（vue-i18n，全量菜单与文案覆盖）
- Cesium 11 类示例 / OpenLayers 4 类示例 / Three.js 4 类示例
