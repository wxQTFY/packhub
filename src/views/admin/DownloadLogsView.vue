<script setup lang="ts">
import { Refresh } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { computed, onMounted, ref } from 'vue';
import { http } from '../../api/http';
import type { DownloadLog } from '../../types';

const logs = ref<DownloadLog[]>([]);
const loading = ref(false);
const keyword = ref('');

const filteredLogs = computed(() => {
  const value = keyword.value.trim().toLowerCase();
  if (!value) return logs.value;
  return logs.value.filter((item) =>
    [item.username, item.packageName, item.packageVersion, item.packageCategory, item.originalName, item.ip]
      .join(' ')
      .toLowerCase()
      .includes(value),
  );
});

async function loadLogs() {
  loading.value = true;
  try {
    const { data } = await http.get('/download-logs');
    logs.value = data.logs;
  } catch (error) {
    ElMessage.error((error as Error).message);
  } finally {
    loading.value = false;
  }
}

onMounted(loadLogs);
</script>

<template>
  <section class="page">
    <div class="page-header">
      <div>
        <h1>下载记录</h1>
        <p>查看账号下载安装包的时间、软件版本和来源地址。</p>
      </div>
      <el-button :icon="Refresh" @click="loadLogs">刷新</el-button>
    </div>

    <div class="filter-bar log-filters">
      <el-input v-model="keyword" clearable placeholder="搜索账号、软件、版本、分类、文件名、IP" />
    </div>

    <el-table v-loading="loading" :data="filteredLogs" stripe>
      <el-table-column prop="username" label="账号" width="130" />
      <el-table-column label="下载软件" min-width="240">
        <template #default="{ row }">
          <div class="version-cell">
            <strong>{{ row.packageName }} {{ row.packageVersion }}</strong>
            <small>{{ row.packageCategory }} · {{ row.originalName }}</small>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="下载时间" width="190">
        <template #default="{ row }">{{ new Date(row.createdAt).toLocaleString() }}</template>
      </el-table-column>
      <el-table-column prop="ip" label="IP" width="150" />
      <el-table-column prop="userAgent" label="客户端" min-width="220" show-overflow-tooltip />
    </el-table>
  </section>
</template>
