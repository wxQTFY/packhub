<script setup lang="ts">
import { Delete, Edit, Plus, Refresh, RefreshLeft, UploadFilled, View } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox, type UploadFile } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { http } from '../../api/http';
import type { SoftwarePackage, VersionChannel } from '../../types';

const router = useRouter();
const packages = ref<SoftwarePackage[]>([]);
const categories = ref<string[]>([]);
const loading = ref(false);
const saving = ref(false);
const uploadProgress = ref(0);
const dialogVisible = ref(false);
const editingId = ref('');
const selectedFile = ref<File | null>(null);
const filters = reactive({
  keyword: '',
  category: '',
  channel: '' as VersionChannel | '',
  published: '',
  sort: 'newest',
});
const form = reactive({
  name: '',
  description: '',
  version: '',
  channel: 'release' as VersionChannel,
  category: '未分类',
  tags: [] as string[],
  releaseNotes: '',
  stable: false,
  archived: false,
  published: true,
});

const channels: Record<VersionChannel, string> = {
  release: '发行版本',
  beta: '公测版本',
  history: '历史版本',
};

const filteredPackages = computed(() => {
  const keyword = filters.keyword.trim().toLowerCase();
  const result = packages.value.filter((item) => {
    const searchable = [item.name, item.version, item.description, item.category, ...item.tags].join(' ').toLowerCase();
    return (
      (!keyword || searchable.includes(keyword)) &&
      (!filters.category || item.category === filters.category) &&
      (!filters.channel || item.channel === filters.channel) &&
      (!filters.published || String(item.published) === filters.published)
    );
  });
  return [...result].sort((a, b) => {
    if (a.stable !== b.stable) return a.stable ? -1 : 1;
    if (filters.sort === 'downloads') return b.downloadCount - a.downloadCount;
    if (filters.sort === 'name') return a.name.localeCompare(b.name, 'zh-CN');
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
});

async function loadPackages() {
  loading.value = true;
  try {
    const [{ data }, categoryResponse] = await Promise.all([http.get('/packages'), http.get('/categories')]);
    packages.value = data.packages;
    categories.value = categoryResponse.data.categories;
  } catch (error) {
    ElMessage.error((error as Error).message);
  } finally {
    loading.value = false;
  }
}

function resetForm() {
  editingId.value = '';
  selectedFile.value = null;
  uploadProgress.value = 0;
  Object.assign(form, {
    name: '',
    description: '',
    version: '',
    channel: 'release',
    category: '未分类',
    tags: [],
    releaseNotes: '',
    stable: false,
    archived: false,
    published: true,
  });
}

function resetFilters() {
  Object.assign(filters, { keyword: '', category: '', channel: '', published: '', sort: 'newest' });
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
    category: item.category,
    tags: [...item.tags],
    releaseNotes: item.releaseNotes,
    stable: item.stable,
    archived: item.archived,
    published: item.published,
  });
  dialogVisible.value = true;
}

function onFileChange(file: UploadFile) {
  selectedFile.value = file.raw || null;
}

async function savePackage() {
  if (!form.name.trim() || !form.version.trim()) {
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
      for (const [key, value] of Object.entries(form)) {
        body.append(key, Array.isArray(value) ? value.join(',') : String(value));
      }
      body.append('file', selectedFile.value as File);
      await http.post('/packages', body, {
        onUploadProgress(event) {
          if (!event.total) return;
          uploadProgress.value = Math.round((event.loaded / event.total) * 100);
        },
      });
    }
    ElMessage.success(editingId.value ? '版本信息已更新' : '安装包上传成功，文件校验已完成');
    dialogVisible.value = false;
    await loadPackages();
  } catch (error) {
    ElMessage.error((error as Error).message);
  } finally {
    saving.value = false;
  }
}

async function rollback(item: SoftwarePackage) {
  await ElMessageBox.confirm(`确认将 ${item.name} ${item.version} 设为当前稳定版？`, '版本回滚', { type: 'warning' });
  try {
    await http.post(`/packages/${item.id}/rollback`);
    ElMessage.success('已切换当前稳定版，原稳定版已归档');
    await loadPackages();
  } catch (error) {
    ElMessage.error((error as Error).message);
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

function shortHash(hash: string) {
  return hash ? `${hash.slice(0, 12)}...` : '生成中';
}

onMounted(loadPackages);
</script>

<template>
  <section class="page">
    <div class="page-header">
      <div>
        <h1>软件版本</h1>
        <p>管理同一软件的多个版本、稳定版、分类、标签和发布说明。</p>
      </div>
      <div class="actions">
        <el-button :icon="Refresh" @click="loadPackages">刷新</el-button>
        <el-button type="primary" :icon="Plus" @click="openCreate">上传安装包</el-button>
      </div>
    </div>

    <div class="filter-bar">
      <el-input v-model="filters.keyword" clearable placeholder="搜索软件、版本、标签" />
      <el-select v-model="filters.category" clearable placeholder="全部分类">
        <el-option v-for="category in categories" :key="category" :label="category" :value="category" />
      </el-select>
      <el-select v-model="filters.channel" clearable placeholder="全部渠道">
        <el-option v-for="(label, value) in channels" :key="value" :label="label" :value="value" />
      </el-select>
      <el-select v-model="filters.published" clearable placeholder="发布状态">
        <el-option label="已发布" value="true" />
        <el-option label="未发布" value="false" />
      </el-select>
      <el-select v-model="filters.sort" placeholder="排序">
        <el-option label="最近上传" value="newest" />
        <el-option label="下载最多" value="downloads" />
        <el-option label="软件名称" value="name" />
      </el-select>
      <el-button :icon="RefreshLeft" circle title="重置筛选" @click="resetFilters" />
    </div>

    <el-table v-loading="loading" :data="filteredPackages" stripe>
      <el-table-column label="软件版本" min-width="210">
        <template #default="{ row }">
          <div class="version-cell">
            <strong>{{ row.name }} {{ row.version }}</strong>
            <span>
              <el-tag v-if="row.stable" type="success" size="small">当前稳定版</el-tag>
              <el-tag v-if="row.archived" type="info" size="small">已归档</el-tag>
              <el-tag v-if="row.channel === 'beta'" type="warning" size="small">公测</el-tag>
            </span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="category" label="分类" width="120" />
      <el-table-column label="标签" min-width="150">
        <template #default="{ row }">
          <div class="tag-list">
            <el-tag v-for="tag in row.tags" :key="tag" size="small" effect="plain">{{ tag }}</el-tag>
            <span v-if="!row.tags.length">-</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="文件" min-width="190">
        <template #default="{ row }">
          <div class="file-cell">
            <span>{{ row.originalName }}</span>
            <small>{{ formatSize(row.size) }} · {{ row.downloadCount }} 次下载</small>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="SHA256" width="150">
        <template #default="{ row }">
          <el-tooltip :content="row.sha256 || '暂无 hash'" placement="top">
            <span class="mono-text">{{ shortHash(row.sha256) }}</span>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column label="发布" width="90">
        <template #default="{ row }">
          <el-tag :type="row.published ? 'success' : 'info'">{{ row.published ? '已发布' : '未发布' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="265" fixed="right">
        <template #default="{ row }">
          <el-button :icon="View" circle title="查看详情" @click="router.push(`/downloads/${row.id}`)" />
          <el-button :icon="Edit" circle title="编辑" @click="openEdit(row)" />
          <el-button v-if="!row.stable" type="warning" :icon="RefreshLeft" circle title="设为稳定版" @click="rollback(row)" />
          <el-button type="danger" :icon="Delete" circle title="删除" @click="removePackage(row)" />
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑版本信息' : '上传安装包'" width="640px">
      <el-form label-position="top">
        <div class="form-grid">
          <el-form-item label="软件名称">
            <el-input v-model="form.name" placeholder="例如：桌面客户端" />
          </el-form-item>
          <el-form-item label="版本号">
            <el-input v-model="form.version" placeholder="例如：1.0.0" />
          </el-form-item>
          <el-form-item label="版本类型">
            <el-select v-model="form.channel">
              <el-option v-for="(label, value) in channels" :key="value" :label="label" :value="value" />
            </el-select>
          </el-form-item>
          <el-form-item label="软件分类">
            <el-select v-model="form.category" allow-create filterable default-first-option>
              <el-option v-for="category in categories" :key="category" :label="category" :value="category" />
            </el-select>
          </el-form-item>
        </div>
        <el-form-item label="标签">
          <el-select v-model="form.tags" multiple allow-create filterable default-first-option placeholder="输入后回车添加标签" />
        </el-form-item>
        <el-form-item label="简要说明">
          <el-input v-model="form.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="发布说明 / 更新日志">
          <el-input v-model="form.releaseNotes" type="textarea" :rows="5" placeholder="记录新增功能、修复内容和升级注意事项" />
        </el-form-item>
        <el-form-item v-if="!editingId" label="zip 文件">
          <el-upload drag :auto-upload="false" accept=".zip" :limit="1" :on-change="onFileChange">
            <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
            <div class="el-upload__text">拖入或点击选择 zip 安装包</div>
          </el-upload>
        </el-form-item>
        <el-progress v-if="saving && !editingId" :percentage="uploadProgress" />
        <div class="switch-row">
          <el-switch v-model="form.published" active-text="前台发布" />
          <el-switch v-model="form.stable" active-text="当前稳定版" />
          <el-switch v-model="form.archived" active-text="归档版本" />
        </div>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="savePackage">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>
