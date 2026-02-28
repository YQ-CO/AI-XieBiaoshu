import { createRouter, createWebHistory } from 'vue-router';
import Login from '../pages/Login.vue';
import Account from '../pages/Account.vue';

const routes = [
  { path: '/', redirect: '/login' },
  { path: '/login', component: Login },
  { path: '/account', component: Account },
  { path: '/orders', component: () => import('../pages/Orders.vue') },
  { path: '/parse', component: () => import('../pages/Parse.vue') },
  { path: '/documents', component: () => import('../pages/MyDocuments.vue') },
  { path: '/documents/preview', component: () => import('../pages/PreviewDocument.vue') },
  { path: '/write/scoring', component: () => import('../pages/WriteScoring.vue') },
  { path: '/write/directory', component: () => import('../pages/WriteDirectory.vue') },
  { path: '/write/special', component: () => import('../pages/WriteSpecial.vue') },
  { path: '/admin/bms', component: () => import('../pages/AdminBms.vue') },
  { path: '/admin/model', component: () => import('../pages/AdminModel.vue') }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

// simple navigation guard: require token for protected routes
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token');
  if (to.path !== '/login' && !token) {
    return next('/login');
  }

  if (to.path.startsWith('/admin')) {
    const adminToken = localStorage.getItem('adminToken');
    const enterpriseId = localStorage.getItem('enterpriseId');
    if (!adminToken && !enterpriseId) return next('/account');

    if (to.path === '/admin/model' && !adminToken) {
      return next('/admin/bms');
    }
  }

  next();
});

export default router;
