<template>
  <aside class="app-sidebar" :class="{ 'labels-hidden': !showLabels }">
    <div class="sidebar-content">
      <div class="logo" :title="'Easy Espanso'">
        <div class="logo-placeholder">E</div>
      </div>

      <nav class="nav-links" aria-label="Primary navigation">
        <RouterLink
          v-for="route in routes"
          :key="route.name"
          :to="route.path"
          class="nav-link"
          :class="{ active: currentRoute.path.startsWith(route.path) }"
          :aria-current="currentRoute.path.startsWith(route.path) ? 'page' : undefined"
          :title="t(route.meta.title as string)"
        >
          <component :is="getRouteIcon(route)" class="nav-icon" />
          <span v-if="showLabels" class="nav-text">{{ t(route.meta.title as string) }}</span>
        </RouterLink>
      </nav>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter, useRoute, type RouteRecordNormalized } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ScissorsIcon, SettingsIcon, AppWindowIcon, TerminalIcon, FileCodeIcon, GlobeIcon, FolderIcon } from 'lucide-vue-next';
import type { FunctionalComponent } from 'vue';
import { useUserPreferences } from '@/store/useUserPreferences';

const { t } = useI18n();
const router = useRouter();
const currentRoute = useRoute();
const userPreferences = useUserPreferences();
const showLabels = computed(() => userPreferences.preferences.showSidebarLabels);

const icons: Record<string, FunctionalComponent> = {
  Scissors: ScissorsIcon,
  AppWindow: AppWindowIcon,
  Settings: SettingsIcon,
  Terminal: TerminalIcon,
  FileCode: FileCodeIcon,
  Globe: GlobeIcon,
  Folder: FolderIcon,
};

const routes = computed(() => {
  const order = userPreferences.preferences.sidebarOrder;
  return router.getRoutes()
    .filter((route) => route.meta.icon)
    .sort((a, b) => {
      const ai = order.indexOf(String(a.name) as any);
      const bi = order.indexOf(String(b.name) as any);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
});

const getRouteIcon = (route: RouteRecordNormalized) => icons[route.meta.icon as string] || null;
</script>

<style scoped>
.app-sidebar {
  width: var(--easy-sidebar-width, 75px);
  min-width: var(--easy-sidebar-width, 75px);
  height: 100%;
  background-color: hsl(var(--muted) / 0.8);
  border-right: 1px solid hsl(var(--border));
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 0;
  transition: width 180ms ease, min-width 180ms ease;
  position: relative;
  z-index: 20;
  isolation: isolate;
}

.sidebar-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  height: 100%;
}

.logo {
  margin-bottom: 24px;
  padding: 8px;
}

.logo-placeholder {
  width: 40px;
  height: 40px;
  background-color: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.05);
  font-size: 24px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
}

.nav-links {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.nav-link {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 52px;
  padding: 9px 6px;
  color: hsl(var(--muted-foreground));
  text-decoration: none;
  transition: background-color 160ms ease, color 160ms ease, transform 120ms ease;
  position: relative;
  cursor: pointer;
  user-select: none;
}

.nav-link:hover {
  transform: translateY(-1px);
  color: hsl(var(--foreground));
  background-color: hsl(var(--accent) / 0.8);
}

.nav-link.active {
  color: hsl(var(--primary));
  background-color: hsl(var(--primary) / 0.07);
  font-weight: 500;
}

.nav-link.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  width: 3px;
  height: 100%;
  background-color: hsl(var(--primary));
}

.nav-icon {
  width: 22px;
  height: 22px;
  margin-bottom: 4px;
}

.nav-text {
  font-size: 11px;
  line-height: 1.2;
  text-align: center;
  font-weight: 500;
}

.labels-hidden .nav-link {
  min-height: 46px;
}

.labels-hidden .nav-icon {
  margin-bottom: 0;
}
</style>
