<script setup lang="ts">
import { Download, Refresh, RefreshLeft, View } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { http } from '../../api/http';
import type { SoftwarePackage, VersionChannel } from '../../types';

const router = useRouter();
const packages = ref<SoftwarePackage[]>([]);
const categories = ref<string[]>([]);
const loading = ref(false);
const downloadState = reactive<Record<string, number>>({});
const filters = reactive({ keyword: '', category: '', sort: 'stable' });
const channelMeta: Record<VersionChannel, { label: string; description: string; type: 'success' | 'warning' | 'info' }> = {
  release: { label: '发行版本', description: '正式发布版本，当前稳定版优先展示。', type: 'success' },
  beta: { label: '公测版本', description: '用于验证新功能，建议测试环境使用。', type: 'warning' },
  history: { label: '历史版本', description: '已归档版本，适用于回退和兼容场景。', type: 'info' },
};

const filtered = computed(() => {
  const keyword = filters.keyword.trim().toLowerCase();
  const result = packages.value.filter((item) => {
    const searchable = [item.name, item.version, item.description, item.category, ...item.tags].join(' ').toLowerCase();
    return (!keyword || searchable.includes(keyword)) && (!filters.category || item.category === filters.category);
  });
  return [...result].sort((a, b) => {
    if (filters.sort === 'downloads') return b.downloadCount - a.downloadCount;
    if (filters.sort === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (a.stable !== b.stable) return a.stable ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
});

const grouped = computed(() =>
  (Object.keys(channelMeta) as VersionChannel[]).map((channel) => ({
    channel,
    ...channelMeta[channel],
    items: filtered.value.filter((item) => (channel === 'history' ? item.archived : !item.archived && item.channel === channel)),
  })),
);

function formatSize(size: number) {
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

async function loadPackages() {
  loading.value = true;
  try {
    const [{ data }, categoryResponse] = await Promise.all([http.get('/portal/packages'), http.get('/categories')]);
    packages.value = data.packages;
    categories.value = categoryResponse.data.categories;
  } catch (error) {
    ElMessage.error((error as Error).message);
  } finally {
    loading.value = false;
  }
}

async function downloadPackage(item: SoftwarePackage) {
  downloadState[item.id] = 0;
  try {
    const response = await http.get(`/packages/${item.id}/download`, {
      responseType: 'blob',
      onDownloadProgress(event) {
        if (!event.total) return;
        downloadState[item.id] = Math.round((event.loaded / event.total) * 100);
      },
    });
    const url = URL.createObjectURL(response.data);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = item.originalName;
    anchor.click();
    URL.revokeObjectURL(url);
    downloadState[item.id] = 100;
    ElMessage.success(`${item.name} ${item.version} 下载完成`);
    await loadPackages();
  } catch (error) {
    delete downloadState[item.id];
    ElMessage.error((error as Error).message);
  }
}

function resetFilters() {
  Object.assign(filters, { keyword: '', category: '', sort: 'stable' });
}

onMounted(loadPackages);
</script>

<template>
  <section class="page">
    <div class="page-header">
      <div>
        <h1>软件下载</h1>
        <p>查找软件版本，查看更新说明并下载安装包。</p>
      </div>
      <el-button :icon="Refresh" @click="loadPackages">刷新</el-button>
    </div>

    <div class="filter-bar portal-filters">
      <el-input v-model="filters.keyword" clearable placeholder="搜索软件、版本、标签" />
      <el-select v-model="filters.category" clearable placeholder="全部分类">
        <el-option v-for="category in categories" :key="category" :label="category" :value="category" />
      </el-select>
      <el-select v-model="filters.sort" placeholder="排序">
        <el-option label="稳定版优先" value="stable" />
        <el-option label="最近上传" value="newest" />
        <el-option label="下载最多" value="downloads" />
      </el-select>
      <el-button :icon="RefreshLeft" circle title="重置筛选" @click="resetFilters" />
    </div>

    <div v-loading="loading" class="version-sections">
      <section v-for="group in grouped" :key="group.channel" class="version-band">
        <div class="version-title">
          <div>
            <el-tag :type="group.type" size="large">{{ group.label }}</el-tag>
            <span>{{ group.description }}</span>
          </div>
          <strong>{{ group.items.length }} 个版本</strong>
        </div>
        <el-empty v-if="group.items.length === 0" description="暂无匹配版本" />
        <div v-else class="package-list">
          <article v-for="item in group.items" :key="item.id" class="package-row">
            <div class="package-main">
              <div class="package-heading">
                <h2>{{ item.name }} <span>{{ item.version }}</span></h2>
                <el-tag v-if="item.stable" type="success" size="small">当前稳定版</el-tag>
                <el-tag v-if="item.channel === 'beta'" type="warning" size="small">公测</el-tag>
              </div>
              <p>{{ item.description || '暂无版本简介' }}</p>
              <div class="package-meta">
                <span>{{ item.category }}</span>
                <span>{{ formatSize(item.size) }}</span>
                <span>{{ item.downloadCount }} 次下载</span>
                <el-tag v-for="tag in item.tags" :key="tag" size="small" effect="plain">{{ tag }}</el-tag>
              </div>
            </div>
            <div class="package-actions">
              <el-button :icon="View" @click="router.push(`/downloads/${item.id}`)">详情</el-button>
              <el-button
                type="primary"
                :icon="Download"
                :loading="downloadState[item.id] !== undefined && downloadState[item.id] < 100"
                @click="downloadPackage(item)"
              >
                {{ downloadState[item.id] !== undefined && downloadState[item.id] < 100 ? `${downloadState[item.id]}%` : '下载' }}
              </el-button>
            </div>
          </article>
        </div>
      </section>
    </div>
  </section>
</template>
