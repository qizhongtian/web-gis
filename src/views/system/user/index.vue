<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { addUser, deleteUser, getUsers, getRoles } from '@/api/system'

const { t } = useI18n()
const loading = ref(false)
const list = ref<any[]>([])
const roles = ref<any[]>([])
const dialogVisible = ref(false)
const form = reactive({ username: '', nickname: '', roles: ['viewer'] as string[] })

async function load() {
  loading.value = true
  try {
    const [u, r] = await Promise.all([getUsers(), getRoles()])
    list.value = u.data
    roles.value = r.data
  } finally {
    loading.value = false
  }
}

async function onSave() {
  if (!form.username) return ElMessage.warning('请输入用户名')
  await addUser(form)
  ElMessage.success(t('common.confirm'))
  dialogVisible.value = false
  form.username = ''
  form.nickname = ''
  load()
}

async function onDelete(row: any) {
  await ElMessageBox.confirm(`确定删除用户 ${row.username} ?`, t('common.tip'), { type: 'warning' })
  await deleteUser(row.id)
  ElMessage.success(t('common.delete'))
  load()
}

onMounted(load)
</script>

<template>
  <div class="p-4 h-full flex flex-col gap-3 overflow-auto">
    <div class="flex items-center gap-2">
      <el-button v-permission="'sys:user:add'" type="primary" size="small" @click="dialogVisible = true">
        {{ t('system.addUser') }}
      </el-button>
      <span class="text-xs text-[#7c8db0]">新增 / 删除按钮由 v-permission 指令控制（viewer 角色不可见）</span>
    </div>

    <el-table :data="list" v-loading="loading" border size="small" class="tech-panel">
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column :label="t('system.username')" prop="username" />
      <el-table-column :label="t('system.nickname')" prop="nickname" />
      <el-table-column :label="t('system.roles')">
        <template #default="{ row }">
          <el-tag v-for="r in row.roles" :key="r" size="small" class="mr-1" effect="dark">{{ r }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="t('common.action')" width="120">
        <template #default="{ row }">
          <el-button v-permission="'sys:user:delete'" size="small" type="danger" plain @click="onDelete(row)">
            {{ t('common.delete') }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="t('system.addUser')" width="420px">
      <el-form label-width="80px">
        <el-form-item :label="t('system.username')">
          <el-input v-model="form.username" />
        </el-form-item>
        <el-form-item :label="t('system.nickname')">
          <el-input v-model="form.nickname" />
        </el-form-item>
        <el-form-item :label="t('system.roles')">
          <el-checkbox-group v-model="form.roles">
            <el-checkbox v-for="r in roles" :key="r.key" :value="r.key">{{ r.name }}</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="dialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button size="small" type="primary" @click="onSave">{{ t('common.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>
