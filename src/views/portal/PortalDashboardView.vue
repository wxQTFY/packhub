<script setup lang="ts">
import { Download, FolderOpened, Refresh } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { http } from '../../api/http';
import type { SoftwarePackage } from '../../types';

const router = useRouter();
const packages = ref<SoftwarePackage[]>([]);
const categories = ref<string[]>([]);
const loading = ref(false);

const categoryCards = computed(() =>
  categories.value.map((category) => {
    const items = packages.value.filter((item) => item.category === category);
    return {
      category,
      total: items.length,
      stable: items.filter((item) => !item.archived && item.channel === 'release').length,
      beta: items.filter((item) => !item.archived && item.channel === 'beta').length,
      history: items.filter((item) => item.archived || item.channel === 'history').length,
      downloads: items.reduce((sum, item) => sum + item.downloadCount, 0),
    };
  }),
);

async function loadDashboard() {
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

function openCategory(category: string) {
  router.push(`/downloads/category/${encodeURIComponent(category)}`);
}

onMounted(loadDashboard);
</script>

<template>
  <section class="page">
    <div class="page-header">
      <div>
        <h1>前台仪表盘</h1>
        <p>按软件分类进入下载区，查看稳定版本、公测版本和历史版本。</p>
      </div>
      <el-button :icon="Refresh" @click="loadDashboard">刷新</el-button>
    </div>

    <div v-loading="loading" class="category-grid">
      <article v-for="item in categoryCards" :key="item.category" class="category-card" @click="openCategory(item.category)">
        <div class="category-card-head">
          <el-icon><FolderOpened /></el-icon>
          <h2>{{ item.category }}</h2>
        </div>
        <div class="category-stats">
          <span>稳定版 <strong>{{ item.stable }}</strong></span>
          <span>公测版 <strong>{{ item.beta }}</strong></span>
          <span>历史版 <strong>{{ item.history }}</strong></span>
        </div>
        <div class="category-card-foot">
          <span>{{ item.total }} 个版本</span>
          <span><el-icon><Download /></el-icon>{{ item.downloads }} 次下载</span>
        </div>
      </article>
    </div>
  </section>
</template>
