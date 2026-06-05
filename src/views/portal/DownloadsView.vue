<script setup lang="ts">
import { Download, Refresh } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { computed, onMounted, ref } from 'vue';
import { http } from '../../api/http';
import type { SoftwarePackage, VersionChannel } from '../../types';

const packages = ref<SoftwarePackage[]>([]);
const loading = ref(false);
const channelMeta: Record<VersionChannel, { label: string; description: string; type: 'success' | 'warning' | 'info' }> = {
  release: { label: '发行版本', description: '当前稳定版本，建议正式环境使用。', type: 'success' },
  beta: { label: '公测版本', description: '面向测试用户开放的新功能版本。', type: 'warning' },
  history: { label: '历史版本', description: '已归档版本，便于回退或兼容旧环境。', type: 'info' },
};

const grouped = computed(() =>
  (Object.keys(channelMeta) as VersionChannel[]).map((channel) => ({
    channel,
    ...channelMeta[channel],
    items: packages.value.filter((item) => item.channel === channel),
  })),
);

function formatSize(size: number) {
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

async function loadPackages() {
  loading.value = true;
  try {
    const { data } = await http.get('/portal/packages');
    packages.value = data.packages;
  } catch (error) {
    ElMessage.error((error as Error).message);
  } finally {
    loading.value = false;
  }
}

function downloadPackage(item: SoftwarePackage) {
  const token = localStorage.getItem('packhub_token');
  window.open(`/api/packages/${item.id}/download?token=${token || ''}`, '_blank');
}

onMounted(loadPackages);
</script>

<template>
  <section class="page">
    <div class="page-header">
      <div>
        <h1>软件下载</h1>
        <p>选择需要的版本类型，下载对应 zip 安装包。</p>
      </div>
      <el-button :icon="Refresh" @click="loadPackages">刷新</el-button>
    </div>

    <div v-loading="loading" class="version-sections">
      <section v-for="group in grouped" :key="group.channel" class="version-band">
        <div class="version-title">
          <el-tag :type="group.type" size="large">{{ group.label }}</el-tag>
          <span>{{ group.description }}</span>
        </div>
        <el-empty v-if="group.items.length === 0" description="暂无可下载版本" />
        <el-table v-else :data="group.items" stripe>
          <el-table-column prop="name" label="软件名称" min-width="180" />
          <el-table-column prop="version" label="版本号" width="140" />
          <el-table-column prop="originalName" label="文件名" min-width="220" />
          <el-table-column label="大小" width="120">
            <template #default="{ row }">{{ formatSize(row.size) }}</template>
          </el-table-column>
          <el-table-column label="上传时间" width="180">
            <template #default="{ row }">{{ new Date(row.createdAt).toLocaleString() }}</template>
          </el-table-column>
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" :icon="Download" @click="downloadPackage(row)">下载</el-button>
            </template>
          </el-table-column>
        </el-table>
      </section>
    </div>
  </section>
</template>
