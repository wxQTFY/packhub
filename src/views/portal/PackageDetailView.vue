<script setup lang="ts">
import { ArrowLeft, Download } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { http } from '../../api/http';
import type { SoftwarePackage, VersionChannel } from '../../types';

const route = useRoute();
const router = useRouter();
const item = ref<SoftwarePackage | null>(null);
const loading = ref(false);
const downloadProgress = ref<number | null>(null);
const channelLabels: Record<VersionChannel, string> = {
  release: '发行版本',
  beta: '公测版本',
  history: '历史版本',
};

async function loadDetail() {
  loading.value = true;
  try {
    const { data } = await http.get(`/package-details/${route.params.id}`);
    item.value = data.package;
  } catch (error) {
    ElMessage.error((error as Error).message);
    router.replace('/downloads');
  } finally {
    loading.value = false;
  }
}

async function downloadPackage() {
  if (!item.value) return;
  downloadProgress.value = 0;
  try {
    const response = await http.get(`/packages/${item.value.id}/download`, {
      responseType: 'blob',
      onDownloadProgress(event) {
        if (event.total) downloadProgress.value = Math.round((event.loaded / event.total) * 100);
      },
    });
    const url = URL.createObjectURL(response.data);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = item.value.originalName;
    anchor.click();
    URL.revokeObjectURL(url);
    downloadProgress.value = 100;
    ElMessage.success('下载完成');
    await loadDetail();
  } catch (error) {
    downloadProgress.value = null;
    ElMessage.error((error as Error).message);
  }
}

function formatSize(size: number) {
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

onMounted(loadDetail);
</script>

<template>
  <section v-loading="loading" class="page detail-page">
    <div class="detail-toolbar">
      <el-button :icon="ArrowLeft" @click="router.back()">返回</el-button>
    </div>

    <template v-if="item">
      <header class="detail-header">
        <div>
          <div class="detail-tags">
            <el-tag>{{ item.category }}</el-tag>
            <el-tag v-if="item.stable" type="success">当前稳定版</el-tag>
            <el-tag v-if="item.channel === 'beta'" type="warning">公测版本</el-tag>
            <el-tag v-if="item.archived" type="info">已归档</el-tag>
          </div>
          <h1>{{ item.name }} <span>{{ item.version }}</span></h1>
          <p>{{ item.description || '暂无版本简介' }}</p>
        </div>
        <el-button
          type="primary"
          size="large"
          :icon="Download"
          :loading="downloadProgress !== null && downloadProgress < 100"
          @click="downloadPackage"
        >
          {{ downloadProgress !== null && downloadProgress < 100 ? `${downloadProgress}%` : '下载安装包' }}
        </el-button>
      </header>

      <div class="detail-layout">
        <section class="panel-block release-notes">
          <h2>发布说明与更新日志</h2>
          <p>{{ item.releaseNotes || '暂无发布说明。' }}</p>
        </section>
        <aside class="panel-block detail-facts">
          <h2>版本信息</h2>
          <dl>
            <dt>版本类型</dt><dd>{{ channelLabels[item.channel] }}</dd>
            <dt>文件名</dt><dd>{{ item.originalName }}</dd>
            <dt>文件大小</dt><dd>{{ formatSize(item.size) }}</dd>
            <dt>下载次数</dt><dd>{{ item.downloadCount }}</dd>
            <dt>发布时间</dt><dd>{{ new Date(item.createdAt).toLocaleString() }}</dd>
            <dt>SHA256</dt><dd class="mono-text hash-value">{{ item.sha256 }}</dd>
          </dl>
          <div class="tag-list detail-tag-list">
            <el-tag v-for="tag in item.tags" :key="tag" effect="plain">{{ tag }}</el-tag>
          </div>
        </aside>
      </div>
    </template>
  </section>
</template>
