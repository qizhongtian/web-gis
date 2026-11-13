<script setup lang="ts">
import CesiumViewer from '@/components/CesiumViewer.vue'
import ClusterDetailPanel from './ClusterDetailPanel.vue'
</script>

<template>
  <div class="h-full min-h-0 flex flex-col gap-2 p-2">
    <p class="demo-hint">
      聚合点详情：点聚合气泡本身<b>可点击</b>，点击后在气泡旁弹出信息窗，把被合并进来的点位
      <b>逐条列出来</b>（名称 / 数值 / 经纬度），列表里点任意一行还能直接飞到该点。聚合的成员关系来自
      <b>EntityCluster</b> 的 <code>clusterEvent</code>。
    </p>

    <CesiumViewer class="flex-1 min-h-0 rounded-lg overflow-hidden" :home="[114.1694, 22.3193, 42000]">
      <ClusterDetailPanel />
    </CesiumViewer>
  </div>
</template>
