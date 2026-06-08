<script setup lang="ts">
import { DataBoard, Download, Files, FolderOpened, List, SwitchButton, User } from '@element-plus/icons-vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const router = useRouter();

function logout() {
  auth.logout();
  router.push('/login');
}
</script>

<template>
  <el-container class="app-shell">
    <el-aside width="232px" class="sidebar">
      <div class="brand">
        <span class="brand-mark">P</span>
        <div>
          <strong>PackHub</strong>
          <small>安装包管理</small>
        </div>
      </div>
      <el-menu router :default-active="$route.path" class="nav-menu">
        <el-menu-item v-if="auth.can('portal.download')" index="/downloads">
          <el-icon><Download /></el-icon>
          <span>前台下载</span>
        </el-menu-item>
        <el-menu-item v-if="auth.can('admin.software')" index="/admin/dashboard">
          <el-icon><DataBoard /></el-icon>
          <span>后台仪表盘</span>
        </el-menu-item>
        <el-menu-item v-if="auth.can('admin.software')" index="/admin/packages">
          <el-icon><Files /></el-icon>
          <span>软件版本</span>
        </el-menu-item>
        <el-menu-item v-if="auth.can('admin.software')" index="/admin/categories">
          <el-icon><FolderOpened /></el-icon>
          <span>分类管理</span>
        </el-menu-item>
        <el-menu-item v-if="auth.can('admin.software')" index="/admin/download-logs">
          <el-icon><List /></el-icon>
          <span>下载记录</span>
        </el-menu-item>
        <el-menu-item v-if="auth.can('admin.users')" index="/admin/users">
          <el-icon><User /></el-icon>
          <span>用户权限</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="topbar">
        <div>
          <strong>{{ auth.user?.displayName }}</strong>
          <span>{{ auth.user?.username }}</span>
        </div>
        <el-button :icon="SwitchButton" @click="logout">退出</el-button>
      </el-header>
      <el-main class="content">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>
