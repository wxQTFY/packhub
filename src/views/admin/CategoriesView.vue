<script setup lang="ts">
import { Delete, Plus, Refresh } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onMounted, ref } from 'vue';
import { http } from '../../api/http';
import type { SoftwarePackage } from '../../types';

const defaultCategories = ['手术导航', '智能教培'];
const categories = ref<string[]>([]);
const packages = ref<SoftwarePackage[]>([]);
const loading = ref(false);
const saving = ref(false);
const newCategory = ref('');

const categoryRows = computed(() =>
  categories.value.map((name) => ({
    name,
    locked: defaultCategories.includes(name),
    total: packages.value.filter((item) => item.category === name).length,
    published: packages.value.filter((item) => item.category === name && item.published).length,
  })),
);

async function loadCategories() {
  loading.value = true;
  try {
    const [categoryResponse, packageResponse] = await Promise.all([http.get('/categories'), http.get('/packages')]);
    categories.value = categoryResponse.data.categories;
    packages.value = packageResponse.data.packages;
  } catch (error) {
    ElMessage.error((error as Error).message);
  } finally {
    loading.value = false;
  }
}

async function addCategory() {
  const name = newCategory.value.trim();
  if (!name) {
    ElMessage.warning('分类名称不能为空');
    return;
  }
  saving.value = true;
  try {
    const { data } = await http.post('/categories', { name });
    categories.value = data.categories;
    newCategory.value = '';
    ElMessage.success('分类已添加');
  } catch (error) {
    ElMessage.error((error as Error).message);
  } finally {
    saving.value = false;
  }
}

async function removeCategory(name: string) {
  try {
    await ElMessageBox.confirm(`删除分类「${name}」后，该分类下的软件会归到「手术导航」。`, '删除分类', { type: 'warning' });
  } catch {
    return;
  }
  try {
    const { data } = await http.delete(`/categories/${encodeURIComponent(name)}`);
    categories.value = data.categories;
    await loadCategories();
    ElMessage.success('分类已删除');
  } catch (error) {
    ElMessage.error((error as Error).message);
  }
}

onMounted(loadCategories);
</script>

<template>
  <section class="page">
    <div class="page-header">
      <div>
        <h1>分类管理</h1>
        <p>维护前台仪表盘和软件上传时可选择的软件分类。</p>
      </div>
      <el-button :icon="Refresh" @click="loadCategories">刷新</el-button>
    </div>

    <div class="category-editor">
      <el-input v-model="newCategory" clearable placeholder="输入新分类名称" @keyup.enter="addCategory" />
      <el-button type="primary" :icon="Plus" :loading="saving" @click="addCategory">添加分类</el-button>
    </div>

    <el-table v-loading="loading" :data="categoryRows" stripe>
      <el-table-column prop="name" label="分类名称" min-width="180">
        <template #default="{ row }">
          <div class="package-heading">
            <strong>{{ row.name }}</strong>
            <el-tag v-if="row.locked" type="success" size="small">默认分类</el-tag>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="total" label="版本数" width="120" />
      <el-table-column prop="published" label="已发布" width="120" />
      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <el-button :icon="Delete" circle title="删除" :disabled="row.locked" @click="removeCategory(row.name)" />
        </template>
      </el-table-column>
    </el-table>
  </section>
</template>
