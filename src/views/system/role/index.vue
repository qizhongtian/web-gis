<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { addRole, getRoles } from '@/api/system'

const { t } = useI18n()
const loading = ref(false)
const list = ref<any[]>([])
const dialogVisible = ref(false)
const form = reactive({ key: '', name: '', remark: '' })

async function load() {
  loading.value = true
  try {
    list.value = (await getRoles()).data
  } finally {
    loading.value = false
  }
}

async function onSave() {
  if (!form.key || !form.name) return ElMessage.warning('请填写角色标识与名称')
  await addRole(form)
  ElMessage.success(t('common.confirm'))
  dialogVisible.value = false
  form.key = ''
  form.name = ''
  form.remark = ''
  load()
}

onMounted(load)
</script>

<template>
  <div class="p-4 h-full flex flex-col gap-3 overflow-auto">
    <div class="flex items-center gap-2">
      <el-button v-permission="'sys:role:edit'" type="primary" size="small" @click="dialogVisible = true">
        {{ t('system.addRole') }}
      </el-button>
    </div>

    <el-table :data="list" v-loading="loading" border size="small" class="tech-panel">
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column :label="t('system.roleKey')" prop="key" />
      <el-table-column :label="t('system.roleName')" prop="name" />
      <el-table-column :label="t('system.remark')" prop="remark" />
    </el-table>

    <el-dialog v-model="dialogVisible" :title="t('system.addRole')" width="420px">
      <el-form label-width="90px">
        <el-form-item :label="t('system.roleKey')">
          <el-input v-model="form.key" placeholder="editor" />
        </el-form-item>
        <el-form-item :label="t('system.roleName')">
          <el-input v-model="form.name" placeholder="编辑者" />
        </el-form-item>
        <el-form-item :label="t('system.remark')">
          <el-input v-model="form.remark" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="dialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button size="small" type="primary" @click="onSave">{{ t('common.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>
