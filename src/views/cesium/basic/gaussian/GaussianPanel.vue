<script setup lang="ts">
import { computed, ref } from 'vue'
import CesiumOverlay from '@/components/CesiumOverlay.vue'
import { useCesiumLib } from '@/composables/useCesium'
import { useCesiumTileset } from '@/composables/useCesiumTileset'

const Cesium = useCesiumLib()
const { loading, error, loaded, visible, properties, load, remove, zoomTo, setVisible } = useCesiumTileset()

/**
 * 默认示例：3D Tiles 1.1，content 为 .glb，内部使用
 * KHR_gaussian_splatting + KHR_gaussian_splatting_compression_spz_2
 * 源仓库托管在 GitHub Pages，这里走 jsDelivr 镜像，国内网络更稳定且允许跨域
 */
const sampleUrl =
  'https://cdn.jsdelivr.net/gh/bertt/3DGS-3DTiles-demo@main/tileset-data/tileset.json'
const url = ref(sampleUrl)

const version = computed(() => String(Cesium.value?.VERSION ?? '—'))
/** 1.135 起移除了旧的 KHR_spz_gaussian_splats_compression，必须使用新扩展 */
const supported = computed(() => {
  const [major, minor] = version.value.split('.').map((v) => Number(v) || 0)
  return major > 1 || (major === 1 && minor >= 135)
})

function doLoad() {
  if (!url.value.trim()) return
  void load(url.value.trim())
}
</script>

<template>
  <CesiumOverlay title="高斯泼溅（3D Gaussian Splatting）" class="absolute left-3 top-3 z-10" :width="330">
    <div class="badges">
      <span class="badge">Cesium {{ version }}</span>
      <span class="badge" :class="supported ? 'ok' : 'warn'">
        {{ supported ? '支持高斯泼溅' : '版本过低（需 ≥ 1.135）' }}
      </span>
      <span v-if="supported" class="badge ok">KHR_gaussian_splatting</span>
    </div>

    <el-input v-model="url" size="small" class="!mt-2" placeholder="tileset.json 地址（content 为 .glb）" />

    <div class="actions">
      <el-button size="small" type="primary" :loading="loading" :disabled="!supported" @click="doLoad">加载</el-button>
      <el-button size="small" plain :disabled="!loaded" @click="zoomTo">定位</el-button>
      <el-button size="small" plain :disabled="!loaded" @click="remove">移除</el-button>
    </div>

    <div class="row">
      <span>显示</span>
      <el-switch :model-value="visible" size="small" :disabled="!loaded" @update:model-value="(v) => setVisible(!!v)" />
    </div>

    <el-alert
      v-if="!supported"
      class="!mt-2"
      type="warning"
      :closable="false"
      show-icon
      title="当前 Cesium 版本不支持高斯泼溅"
      description="需 CesiumJS >= 1.135（使用 KHR_gaussian_splatting 与 SPZ2 压缩）；旧的 KHR_spz_gaussian_splats_compression 已在 1.135 移除。"
    />

    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="properties.length" class="props">
      <div class="props-title">点击结果</div>
      <div v-for="item in properties" :key="item.name" class="prop-row">
        <span>{{ item.name }}</span>
        <b>{{ item.value }}</b>
      </div>
    </div>

    <p class="hint">
      高斯泼溅没有几何三角网，拾取只能定位到整块内容，不能像倾斜模型那样逐构件取属性；量测请用点云或地形。
    </p>
  </CesiumOverlay>
</template>

<style scoped>
.badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.badge {
  padding: 2px 6px;
  border-radius: 4px;
  background: #f1f5f9;
  color: #64748b;
  font-size: 10px;
  line-height: 1.5;
}
.badge.ok {
  background: #ecfdf5;
  color: #059669;
}
.badge.warn {
  background: #fff7ed;
  color: #c2410c;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.actions :deep(.el-button) {
  margin-left: 0;
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 12px;
  color: #6b7280;
}
.props {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #e6e8eb;
}
.props-title {
  margin-bottom: 4px;
  color: #374151;
  font-size: 11px;
  font-weight: 600;
}
.prop-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 0;
  font-size: 11px;
  color: #9ca3af;
}
.prop-row b {
  overflow: hidden;
  color: #2563eb;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hint,
.error {
  margin: 8px 0 0;
  font-size: 10px;
  line-height: 1.5;
}
.hint {
  color: #9ca3af;
}
.error {
  color: #ef4444;
  word-break: break-all;
}
</style>
