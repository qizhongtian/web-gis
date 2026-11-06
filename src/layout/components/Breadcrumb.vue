<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

const route = useRoute()
const { t } = useI18n()

/** 由 matched 生成面包屑（仅取有 title 的层级） */
const items = computed(() =>
  route.matched.filter((r) => r.meta?.title).map((r) => ({ path: r.path, title: t(r.meta.title as string) })),
)
</script>

<template>
  <div class="shrink-0 flex items-center justify-between gap-2 min-h-6">
    <el-breadcrumb separator="/" class="!flex items-center">
      <el-breadcrumb-item v-for="item in items" :key="item.path" :to="item.path">
        <span class="text-[13px] text-[#6b7280]">{{ item.title }}</span>
      </el-breadcrumb-item>
    </el-breadcrumb>

    <span class="text-[11px] text-[#9ca3af] hidden md:block truncate max-w-[40%]">{{ route.path }}</span>
  </div>
</template>
