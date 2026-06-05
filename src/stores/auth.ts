import { defineStore } from 'pinia';
import { http } from '../api/http';
import type { Permission, User } from '../types';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('packhub_token') || '',
    user: null as User | null,
  }),
  getters: {
    isLoggedIn: (state) => Boolean(state.token && state.user),
    can: (state) => (permission: Permission) => Boolean(state.user?.permissions.includes(permission)),
  },
  actions: {
    async login(username: string, password: string) {
      const { data } = await http.post('/auth/login', { username, password });
      this.token = data.token;
      this.user = data.user;
      localStorage.setItem('packhub_token', data.token);
    },
    async loadProfile() {
      if (!this.token) return;
      const { data } = await http.get('/auth/me');
      this.user = data.user;
    },
    logout() {
      this.token = '';
      this.user = null;
      localStorage.removeItem('packhub_token');
    },
  },
});
