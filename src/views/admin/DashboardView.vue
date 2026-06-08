<script setup lang="ts">
import { Download, Files, FolderOpened, Refresh, Upload } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { onMounted, ref } from 'vue';
import { http } from '../../api/http';
import type { DashboardSummary, SoftwarePackage, VersionChannel } from '../../types';

const loading = ref(false);
const summary = ref<DashboardSummary | null>(null);

const channelLabels: Record<VersionChannel, string> = {
  release: '发行版本',
  beta: '公测版本',
  history: '历史版本',
};

async function loadSummary() {
  loading.value = true;
  try {
    const { data } = await http.get('/dashboard');
    summary.value = data;
  } catch (error) {
    ElMessage.error((error as Error).message);
  } finally {
    loading.value = false;
  }
}

function formatSize(size: number) {
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function versionLabel(item: SoftwarePackage) {
  return `${item.name} ${item.version}`;
}

onMounted(loadSummary);
</script>

<template>
  <section class="page">
    <div class="page-header">
      <div>
        <h1>后台仪表盘</h1>
        <p>查看安装包规模、发布状态和下载热度。</p>
      </div>
      <el-button :icon="Refresh" @click="loadSummary">刷新</el-button>
    </div>

    <div v-loading="loading" class="dashboard-grid">
      <div class="metric-tile">
        <el-icon><Files /></el-icon>
        <span>版本总数</span>
        <strong>{{ summary?.totalPackages ?? 0 }}</strong>
      </div>
      <div class="metric-tile">
        <el-icon><Upload /></el-icon>
        <span>已发布</span>
        <strong>{{ summary?.publishedPackages ?? 0 }}</strong>
      </div>
      <div class="metric-tile">
        <el-icon><FolderOpened /></el-icon>
        <span>软件 / 分类</span>
        <strong>{{ summary?.softwareCount ?? 0 }} / {{ summary?.categoryCount ?? 0 }}</strong>
      </div>
      <div class="metric-tile">
        <el-icon><Download /></el-icon>
        <span>下载 / 体积</span>
        <strong>{{ summary?.totalDownloads ?? 0 }} / {{ formatSize(summary?.totalSize ?? 0) }}</strong>
      </div>
    </div>

    <div class="dashboard-panels">
      <section class="panel-block">
        <h2>版本分布</h2>
        <div class="channel-stack">
          <div v-for="(label, channel) in channelLabels" :key="channel" class="channel-row">
            <span>{{ label }}</span>
            <strong>{{ summary?.byChannel[channel as VersionChannel] ?? 0 }}</strong>
          </div>
        </div>
      </section>

      <section class="panel-block">
        <h2>最近上传</h2>
        <el-empty v-if="!summary?.recent.length" description="暂无版本" />
        <div v-else class="compact-list">
          <div v-for="item in summary.recent" :key="item.id" class="compact-list-item">
            <span>{{ versionLabel(item) }}</span>
            <small>{{ item.category }} · {{ new Date(item.createdAt).toLocaleString() }}</small>
          </div>
        </div>
      </section>

      <section class="panel-block">
        <h2>热门下载</h2>
        <el-empty v-if="!summary?.popular.length" description="暂无下载" />
        <div v-else class="compact-list">
          <div v-for="item in summary.popular" :key="item.id" class="compact-list-item">
            <span>{{ versionLabel(item) }}</span>
            <small>{{ item.downloadCount }} 次 · {{ formatSize(item.size) }}</small>
          </div>
        </div>
      </section>
    </div>
  </section>
</template>
