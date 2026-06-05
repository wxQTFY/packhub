<script setup lang="ts">
import { Lock, User } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const loading = ref(false);
const form = reactive({ username: 'admin', password: 'admin123' });

async function submit() {
  loading.value = true;
  try {
    await auth.login(form.username, form.password);
    await router.push((route.query.redirect as string) || '/downloads');
  } catch (error) {
    ElMessage.error((error as Error).message);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="login-page">
    <section class="login-panel">
      <div class="login-copy">
        <span>PackHub</span>
        <h1>软件安装包管理平台</h1>
        <p>统一管理发行版本、公测版本和历史版本，按用户权限开放下载入口。</p>
      </div>
      <el-form class="login-form" @submit.prevent="submit">
        <h2>账号登录</h2>
        <el-form-item>
          <el-input v-model="form.username" :prefix-icon="User" size="large" placeholder="账号" />
        </el-form-item>
        <el-form-item>
          <el-input v-model="form.password" :prefix-icon="Lock" type="password" show-password size="large" placeholder="密码" />
        </el-form-item>
        <el-button type="primary" size="large" :loading="loading" native-type="submit">登录</el-button>
        <p class="hint">默认管理员：admin / admin123</p>
      </el-form>
    </section>
  </main>
</template>
