<script setup lang="ts">
import { Delete, Edit, Plus, Refresh } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { onMounted, reactive, ref } from 'vue';
import { http } from '../../api/http';
import type { Permission, User } from '../../types';

const users = ref<User[]>([]);
const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const editingId = ref('');
const form = reactive({
  username: '',
  displayName: '',
  password: '',
  enabled: true,
  permissions: ['portal.download'] as Permission[],
});

const permissionOptions: Array<{ label: string; value: Permission }> = [
  { label: '软件下载', value: 'portal.download' },
  { label: '用户管理', value: 'admin.users' },
  { label: '软件管理', value: 'admin.software' },
];

async function loadUsers() {
  loading.value = true;
  try {
    const { data } = await http.get('/users');
    users.value = data.users;
  } catch (error) {
    ElMessage.error((error as Error).message);
  } finally {
    loading.value = false;
  }
}

function resetForm() {
  editingId.value = '';
  Object.assign(form, {
    username: '',
    displayName: '',
    password: '',
    enabled: true,
    permissions: ['portal.download'],
  });
}

function openCreate() {
  resetForm();
  dialogVisible.value = true;
}

function openEdit(user: User) {
  editingId.value = user.id;
  Object.assign(form, {
    username: user.username,
    displayName: user.displayName,
    password: '',
    enabled: user.enabled,
    permissions: [...user.permissions],
  });
  dialogVisible.value = true;
}

async function saveUser() {
  if (!form.username || (!editingId.value && !form.password)) {
    ElMessage.warning('账号和密码不能为空');
    return;
  }
  saving.value = true;
  try {
    const payload = {
      displayName: form.displayName,
      password: form.password || undefined,
      permissions: form.permissions,
      enabled: form.enabled,
      username: form.username,
    };
    if (editingId.value) await http.put(`/users/${editingId.value}`, payload);
    else await http.post('/users', payload);
    ElMessage.success('保存成功');
    dialogVisible.value = false;
    await loadUsers();
  } catch (error) {
    ElMessage.error((error as Error).message);
  } finally {
    saving.value = false;
  }
}

async function removeUser(user: User) {
  await ElMessageBox.confirm(`确认删除用户 ${user.username}？`, '删除确认', { type: 'warning' });
  try {
    await http.delete(`/users/${user.id}`);
    ElMessage.success('删除成功');
    await loadUsers();
  } catch (error) {
    ElMessage.error((error as Error).message);
  }
}

function permissionLabels(values: Permission[]) {
  return permissionOptions.filter((item) => values.includes(item.value)).map((item) => item.label).join('、');
}

onMounted(loadUsers);
</script>

<template>
  <section class="page">
    <div class="page-header">
      <div>
        <h1>用户权限</h1>
        <p>管理员可以创建账号、重置密码，并配置用户登录后的功能权限。</p>
      </div>
      <div class="actions">
        <el-button :icon="Refresh" @click="loadUsers">刷新</el-button>
        <el-button type="primary" :icon="Plus" @click="openCreate">新增用户</el-button>
      </div>
    </div>

    <el-table v-loading="loading" :data="users" stripe>
      <el-table-column prop="username" label="账号" min-width="140" />
      <el-table-column prop="displayName" label="名称" min-width="140" />
      <el-table-column label="权限" min-width="260">
        <template #default="{ row }">{{ permissionLabels(row.permissions) }}</template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? '启用' : '停用' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="180">
        <template #default="{ row }">{{ new Date(row.createdAt).toLocaleString() }}</template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button :icon="Edit" @click="openEdit(row)">编辑</el-button>
          <el-button type="danger" :icon="Delete" @click="removeUser(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑用户' : '新增用户'" width="520px">
      <el-form label-position="top">
        <el-form-item label="账号">
          <el-input v-model="form.username" :disabled="Boolean(editingId)" />
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="form.displayName" />
        </el-form-item>
        <el-form-item :label="editingId ? '新密码' : '密码'">
          <el-input v-model="form.password" type="password" show-password />
        </el-form-item>
        <el-form-item label="权限">
          <el-checkbox-group v-model="form.permissions">
            <el-checkbox v-for="item in permissionOptions" :key="item.value" :label="item.value">
              {{ item.label }}
            </el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="form.enabled" active-text="启用" inactive-text="停用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveUser">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>
