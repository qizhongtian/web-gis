<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div class="h-full flex flex-col items-center justify-center gap-3">
    <div class="text-6xl font-semibold tracking-tight text-[#111827]">404</div>
    <p class="text-sm text-[#6b7280]">页面不存在或无权访问 · Page not found</p>
    <el-button type="primary" @click="router.replace('/home')">返回首页 / Home</el-button>
  </div>
</template>
