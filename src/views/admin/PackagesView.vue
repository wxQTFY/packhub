<script setup lang="ts">
import { Delete, Edit, Plus, Refresh, UploadFilled } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox, type UploadFile } from 'element-plus';
import { onMounted, reactive, ref } from 'vue';
import { http } from '../../api/http';
import type { SoftwarePackage, VersionChannel } from '../../types';

const packages = ref<SoftwarePackage[]>([]);
const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const editingId = ref('');
const selectedFile = ref<File | null>(null);
const form = reactive({
  name: '',
  description: '',
  version: '',
  channel: 'release' as VersionChannel,
  published: true,
});

const channels: Record<VersionChannel, string> = {
  release: '发行版本',
  beta: '公测版本',
  history: '历史版本',
};

async function loadPackages() {
  loading.value = true;
  try {
    const { data } = await http.get('/packages');
    packages.value = data.packages;
  } catch (error) {
    ElMessage.error((error as Error).message);
  } finally {
    loading.value = false;
  }
}

function resetForm() {
  editingId.value = '';
  selectedFile.value = null;
  Object.assign(form, { name: '', description: '', version: '', channel: 'release', published: true });
}

function openCreate() {
  resetForm();
  dialogVisible.value = true;
}

function openEdit(item: SoftwarePackage) {
  editingId.value = item.id;
  selectedFile.value = null;
  Object.assign(form, {
    name: item.name,
    description: item.description,
    version: item.version,
    channel: item.channel,
    published: item.published,
  });
  dialogVisible.value = true;
}

function onFileChange(file: UploadFile) {
  selectedFile.value = file.raw || null;
}

async function savePackage() {
  if (!form.name || !form.version) {
    ElMessage.warning('软件名称和版本号不能为空');
    return;
  }
  if (!editingId.value && !selectedFile.value) {
    ElMessage.warning('请上传 zip 安装包');
    return;
  }
  saving.value = true;
  try {
    if (editingId.value) {
      await http.put(`/packages/${editingId.value}`, form);
    } else {
      const body = new FormData();
      body.append('name', form.name);
      body.append('description', form.description);
      body.append('version', form.version);
      body.append('channel', form.channel);
      body.append('published', String(form.published));
      body.append('file', selectedFile.value as File);
      await http.post('/packages', body);
    }
    ElMessage.success('保存成功');
    dialogVisible.value = false;
    await loadPackages();
  } catch (error) {
    ElMessage.error((error as Error).message);
  } finally {
    saving.value = false;
  }
}

async function removePackage(item: SoftwarePackage) {
  await ElMessageBox.confirm(`确认删除 ${item.name} ${item.version}？`, '删除确认', { type: 'warning' });
  try {
    await http.delete(`/packages/${item.id}`);
    ElMessage.success('删除成功');
    await loadPackages();
  } catch (error) {
    ElMessage.error((error as Error).message);
  }
}

function formatSize(size: number) {
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

onMounted(loadPackages);
</script>

<template>
  <section class="page">
    <div class="page-header">
      <div>
        <h1>软件版本</h1>
        <p>上传 zip 安装包，并按发行版本、公测版本、历史版本进行管理。</p>
      </div>
      <div class="actions">
        <el-button :icon="Refresh" @click="loadPackages">刷新</el-button>
        <el-button type="primary" :icon="Plus" @click="openCreate">上传安装包</el-button>
      </div>
    </div>

    <el-table v-loading="loading" :data="packages" stripe>
      <el-table-column prop="name" label="软件名称" min-width="160" />
      <el-table-column prop="version" label="版本号" width="120" />
      <el-table-column label="版本类型" width="120">
        <template #default="{ row }">{{ channels[row.channel as VersionChannel] }}</template>
      </el-table-column>
      <el-table-column prop="originalName" label="文件名" min-width="220" />
      <el-table-column label="大小" width="110">
        <template #default="{ row }">{{ formatSize(row.size) }}</template>
      </el-table-column>
      <el-table-column label="发布" width="90">
        <template #default="{ row }">
          <el-tag :type="row.published ? 'success' : 'info'">{{ row.published ? '已发布' : '未发布' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button :icon="Edit" @click="openEdit(row)">编辑</el-button>
          <el-button type="danger" :icon="Delete" @click="removePackage(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑版本信息' : '上传安装包'" width="560px">
      <el-form label-position="top">
        <el-form-item label="软件名称">
          <el-input v-model="form.name" placeholder="例如：桌面客户端" />
        </el-form-item>
        <el-form-item label="版本号">
          <el-input v-model="form.version" placeholder="例如：1.0.0" />
        </el-form-item>
        <el-form-item label="版本类型">
          <el-segmented v-model="form.channel" :options="[
            { label: '发行版本', value: 'release' },
            { label: '公测版本', value: 'beta' },
            { label: '历史版本', value: 'history' },
          ]" />
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="form.description" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item v-if="!editingId" label="zip 文件">
          <el-upload drag :auto-upload="false" accept=".zip" :limit="1" :on-change="onFileChange">
            <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
            <div class="el-upload__text">拖入或点击选择 zip 安装包</div>
          </el-upload>
        </el-form-item>
        <el-form-item label="前台可见">
          <el-switch v-model="form.published" active-text="发布" inactive-text="隐藏" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="savePackage">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>
