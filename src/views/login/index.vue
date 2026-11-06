<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { User, Lock, Check } from '@element-plus/icons-vue'
import { useUserStore } from '@/store/user'
import BrandLogo from '@/components/BrandLogo.vue'
import LangSwitch from '@/components/LangSwitch.vue'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const formRef = ref<FormInstance>()
const loading = ref(false)
const form = reactive({ username: 'admin', password: '123456' })

const rules: FormRules = {
  username: [{ required: true, message: () => t('login.ruleUsername'), trigger: 'blur' }],
  password: [{ required: true, message: () => t('login.rulePassword'), trigger: 'blur' }],
}

function fill(username: string) {
  form.username = username
  form.password = '123456'
}

async function onSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  loading.value = true
  try {
    await userStore.loginAction(form.username, form.password)
    ElMessage.success(t('common.loginSuccess'))
    router.replace((route.query.redirect as string) || '/home')
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.loginFailed'))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="h-full overflow-auto bg-[#f4f6f8]">
    <div class="min-h-full flex items-center justify-center p-4 md:p-8">
      <div class="w-full max-w-4xl bg-white border border-[#e6e8eb] rounded-2xl overflow-hidden grid lg:grid-cols-2 shadow-[0_1px_3px_rgba(16,24,40,0.04)]">
        <!-- 品牌区 -->
        <div class="hidden lg:flex flex-col justify-between p-10 bg-[#f8fafc] border-r border-[#eef0f3]">
          <div>
            <div class="flex items-center gap-2.5">
              <BrandLogo :size="30" />
              <span class="font-semibold text-[15px]">{{ t('login.title') }}</span>
            </div>
            <h2 class="mt-10 text-[26px] leading-snug font-semibold tracking-tight text-[#111827]">
              {{ t('login.slogan') }}
            </h2>
            <p class="mt-3 text-sm leading-relaxed text-[#6b7280]">{{ t('login.desc') }}</p>
          </div>

          <ul class="mt-10 space-y-3 text-sm text-[#4b5563]">
            <li v-for="f in ['feature1', 'feature2', 'feature3']" :key="f" class="flex items-center gap-2.5">
              <span class="w-5 h-5 rounded-full bg-[#eef4ff] text-[#2563eb] grid place-items-center">
                <el-icon :size="12"><Check /></el-icon>
              </span>
              {{ t(`login.${f}`) }}
            </li>
          </ul>
        </div>

        <!-- 表单区 -->
        <div class="p-7 md:p-10">
          <div class="flex items-start justify-between mb-8">
            <div>
              <div class="lg:hidden flex items-center gap-2 mb-5">
                <BrandLogo :size="26" />
                <span class="font-semibold text-sm">{{ t('login.title') }}</span>
              </div>
              <h1 class="text-xl font-semibold tracking-tight">{{ t('login.title') }}</h1>
              <p class="text-sm text-[#6b7280] mt-1.5">{{ t('login.subtitle') }}</p>
            </div>
            <LangSwitch />
          </div>

          <el-form ref="formRef" :model="form" :rules="rules" size="large" @keyup.enter="onSubmit">
            <el-form-item prop="username">
              <el-input v-model="form.username" :placeholder="t('login.username')" :prefix-icon="User" />
            </el-form-item>
            <el-form-item prop="password">
              <el-input
                v-model="form.password"
                type="password"
                show-password
                :placeholder="t('login.password')"
                :prefix-icon="Lock"
              />
            </el-form-item>
            <el-button class="w-full !h-11" type="primary" :loading="loading" @click="onSubmit">
              {{ t('login.btn') }}
            </el-button>
          </el-form>

          <div class="mt-7">
            <p class="text-xs text-[#9ca3af] mb-2">{{ t('login.demoAccounts') }}</p>
            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                class="text-left px-3 py-2.5 rounded-lg border border-[#eef0f3] bg-[#fafbfc] hover:border-[#c7d7fb] hover:bg-[#f8faff] transition-colors"
                @click="fill('admin')"
              >
                <span class="block text-[13px] font-medium text-[#1f2328]">{{ t('login.adminLabel') }}</span>
                <span class="block text-[11px] text-[#9ca3af] mt-0.5">admin / 123456</span>
              </button>
              <button
                type="button"
                class="text-left px-3 py-2.5 rounded-lg border border-[#eef0f3] bg-[#fafbfc] hover:border-[#c7d7fb] hover:bg-[#f8faff] transition-colors"
                @click="fill('viewer')"
              >
                <span class="block text-[13px] font-medium text-[#1f2328]">{{ t('login.viewerLabel') }}</span>
                <span class="block text-[11px] text-[#9ca3af] mt-0.5">viewer / 123456</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
