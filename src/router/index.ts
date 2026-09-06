import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router';
import i18n from '../i18n';

const SnippetsView = () => import('../views/SnippetsView.vue');
import SettingsView from '../views/SettingsView.vue';
import AppProfilesView from '../views/AppProfilesView.vue';
const NotFoundView = () => import('../views/NotFoundView.vue');

const routes: Array<RouteRecordRaw> = [
  { path: '/', redirect: '/snippets' },
  {
    path: '/snippets',
    name: 'snippets',
    component: SnippetsView,
    meta: { title: 'sidebar.snippets', icon: 'Scissors' },
  },
  { path: '/apps', name: 'apps', component: AppProfilesView, meta: { title: 'sidebar.apps', icon: 'AppWindow' } },
  {
    path: '/shell',
    name: 'shell',
    component: () => import('../views/ExtensionsView.vue'),
    meta: { title: 'sidebar.shell', icon: 'Terminal', extType: 'shell' },
  },
  {
    path: '/scripts',
    name: 'scripts',
    component: () => import('../views/ExtensionsView.vue'),
    meta: { title: 'sidebar.scripts', icon: 'FileCode', extType: 'script' },
  },
  {
    path: '/web',
    name: 'web',
    component: () => import('../views/ExtensionsView.vue'),
    meta: { title: 'sidebar.web', icon: 'Globe', extType: 'web' },
  },
  {
    path: '/folders',
    name: 'folders',
    component: () => import('../views/ExtensionsView.vue'),
    meta: { title: 'sidebar.folders', icon: 'Folder', extType: 'folder' },
  },
  {
    path: '/settings',
    name: 'settings',
    component: SettingsView,
    meta: { title: 'sidebar.settings', icon: 'Settings' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: NotFoundView,
    meta: { title: 'common.pageNotFound' },
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

// Navigation should be immediate. RouterLink already prevents duplicate navigation safely,
// so the previous custom throttling/redirect recovery only added latency and could kick users
// out of Settings during fast interactions.
router.afterEach((to) => {
  const title = to.meta.title ? i18n.global.t(to.meta.title as string) : 'Easy Espanso';
  document.title = `${title} - Easy Espanso`;
});

router.onError((error) => {
  console.error('[Router] 页面加载失败:', error);
});

export default router;
