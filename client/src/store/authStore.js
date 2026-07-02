import { create } from 'zustand';
import api from '../lib/api';

const useAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  isAuthenticated: !!localStorage.getItem('accessToken'),
  accessToken: localStorage.getItem('accessToken') || null,
  refreshToken: localStorage.getItem('refreshToken') || null,
  loading: false,
  error: null,

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      set({ 
        user: data.user, 
        isAuthenticated: true, 
        accessToken: data.accessToken, 
        refreshToken: data.refreshToken, 
        loading: false 
      });
      return data;
    } catch (error) {
      const msg = error.response?.data?.message || 'Login failed';
      set({ error: msg, loading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      await api.post('/auth/logout', { refreshToken });
    } catch (e) {
      // Ignore logout API errors
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    set({ user: null, isAuthenticated: false, accessToken: null, refreshToken: null });
  },

  updateUser: (user) => {
    localStorage.setItem('user', JSON.stringify(user));
    set({ user });
  },

  setAuth: (user, accessToken, refreshToken) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, isAuthenticated: true, accessToken, refreshToken });
  },

  clearAuth: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    set({ user: null, isAuthenticated: false, accessToken: null, refreshToken: null });
  },

  // Helper getters
  isRole: (role) => get().user?.role === role,
  isSuperAdmin: () => get().user?.role === 'super_admin',
  isDepartmentAdmin: () => get().user?.role === 'department_admin',
  isStoreAdmin: () => get().user?.role === 'department_admin' && get().user?.departmentAdminType === 'store',
  isManagementAdmin: () => get().user?.role === 'department_admin' && get().user?.departmentAdminType === 'management',
  isAccountsAdmin: () => get().user?.role === 'department_admin' && get().user?.departmentAdminType === 'accounts',
  isTeamLead: () => get().user?.role === 'team_lead',
  isEmployee: () => get().user?.role === 'employee',
}));

export default useAuthStore;
