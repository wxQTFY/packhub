import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import type { Permission } from '../types';
import AdminLayout from '../layouts/AdminLayout.vue';
import LoginView from '../views/LoginView.vue';
import DashboardView from '../views/admin/DashboardView.vue';
import DownloadLogsView from '../views/admin/DownloadLogsView.vue';
import PackagesView from '../views/admin/PackagesView.vue';
import UsersView from '../views/admin/UsersView.vue';
import PackageDetailView from '../views/portal/PackageDetailView.vue';
import DownloadsView from '../views/portal/DownloadsView.vue';
import PortalDashboardView from '../views/portal/PortalDashboardView.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/downloads' },
    { path: '/login', component: LoginView },
    {
      path: '/',
      component: AdminLayout,
      children: [
        { path: 'downloads', component: PortalDashboardView, meta: { permission: 'portal.download' } },
        { path: 'downloads/category/:category', component: DownloadsView, meta: { permission: 'portal.download' } },
        { path: 'downloads/:id', component: PackageDetailView, meta: { permission: 'portal.download' } },
        { path: 'admin/dashboard', component: DashboardView, meta: { permission: 'admin.software' } },
        { path: 'admin/download-logs', component: DownloadLogsView, meta: { permission: 'admin.software' } },
        { path: 'admin/users', component: UsersView, meta: { permission: 'admin.users' } },
        { path: 'admin/packages', component: PackagesView, meta: { permission: 'admin.software' } },
      ],
    },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (to.path === '/login') return true;
  if (auth.token && !auth.user) {
    try {
      await auth.loadProfile();
    } catch {
      auth.logout();
    }
  }
  if (!auth.user) return `/login?redirect=${encodeURIComponent(to.fullPath)}`;
  const permission = to.meta.permission as Permission | undefined;
  if (permission && !auth.can(permission)) return '/downloads';
  return true;
});

export default router;
