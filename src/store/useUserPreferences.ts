import { defineStore } from 'pinia';
import { ref } from 'vue';

export type InterfaceDensity = 'compact' | 'comfortable' | 'spacious';
export type FontScale = 90 | 100 | 110 | 125 | 150;
export type AccentColor = 'blue' | 'violet' | 'cyan' | 'emerald' | 'amber' | 'rose';
export type ScrollbarSize = 'slim' | 'standard' | 'wide';
export type SidebarSize = 'compact' | 'standard' | 'wide';
export type ToastPosition = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
export type ToastDuration = 1500 | 2500 | 4000 | 6000;
export type HistoryLimit = 20 | 60 | 100 | 200;
export type DragActivationDelay = 120 | 180 | 250 | 350;
export type MiddlePaneWidth = 300 | 350 | 420 | 500;
export type TreeIndentSize = 14 | 18 | 20 | 24 | 28;
export type SidebarRouteId = 'snippets' | 'shell' | 'scripts' | 'web' | 'folders' | 'apps' | 'settings';

const ALL_SIDEBAR_ROUTE_IDS: SidebarRouteId[] = ['snippets', 'shell', 'scripts', 'web', 'folders', 'apps', 'settings'];

export interface UserPreferences {
  hideUnsavedChangesWarning: boolean;
  interfaceDensity: InterfaceDensity;
  reduceMotion: boolean;
  rememberTreeState: boolean;
  autoExpandOnSearch: boolean;
  expandOnRowClick: boolean;
  showMatchDescriptions: boolean;
  fontScale: FontScale;
  accentColor: AccentColor;
  scrollbarSize: ScrollbarSize;
  sidebarSize: SidebarSize;
  showSidebarLabels: boolean;
  checkEspansoOnStartup: boolean;
  checkUpdatesOnStartup: boolean;
  toastPosition: ToastPosition;
  toastDuration: ToastDuration;
  autoSave: boolean;
  backupBeforeSave: boolean;
  maxRecentWorkspaces: number;
  historyLimit: HistoryLimit;
  confirmBeforeDelete: boolean;
  autoRenameNewItems: boolean;
  dragActivationDelay: DragActivationDelay;
  middlePaneWidth: MiddlePaneWidth;
  treeIndentSize: TreeIndentSize;
  sidebarOrder: SidebarRouteId[];
}

const DEFAULT_PREFERENCES: UserPreferences = {
  hideUnsavedChangesWarning: false,
  interfaceDensity: 'comfortable',
  reduceMotion: false,
  rememberTreeState: true,
  autoExpandOnSearch: true,
  expandOnRowClick: true,
  showMatchDescriptions: true,
  fontScale: 100,
  accentColor: 'violet',
  scrollbarSize: 'standard',
  sidebarSize: 'standard',
  showSidebarLabels: true,
  checkEspansoOnStartup: true,
  checkUpdatesOnStartup: true,
  toastPosition: 'top-center',
  toastDuration: 2500,
  autoSave: true,
  backupBeforeSave: true,
  maxRecentWorkspaces: 8,
  historyLimit: 60,
  confirmBeforeDelete: true,
  autoRenameNewItems: true,
  dragActivationDelay: 180,
  middlePaneWidth: 350,
  treeIndentSize: 20,
  sidebarOrder: ['snippets', 'shell', 'scripts', 'web', 'folders', 'apps', 'settings'],
};

export const useUserPreferences = defineStore('userPreferences', () => {
  const sanitizePreferences = (input: Partial<UserPreferences>): UserPreferences => {
    const merged = { ...DEFAULT_PREFERENCES, ...input } as UserPreferences;
    if (typeof merged.checkUpdatesOnStartup !== 'boolean') merged.checkUpdatesOnStartup = true;
    if (![90, 100, 110, 125, 150].includes(merged.fontScale)) merged.fontScale = DEFAULT_PREFERENCES.fontScale;
    if (!['blue', 'violet', 'cyan', 'emerald', 'amber', 'rose'].includes(merged.accentColor)) merged.accentColor = DEFAULT_PREFERENCES.accentColor;
    if (!['slim', 'standard', 'wide'].includes(merged.scrollbarSize)) merged.scrollbarSize = DEFAULT_PREFERENCES.scrollbarSize;
    if (!['compact', 'standard', 'wide'].includes(merged.sidebarSize)) merged.sidebarSize = DEFAULT_PREFERENCES.sidebarSize;
    if (!['compact', 'comfortable', 'spacious'].includes(merged.interfaceDensity)) merged.interfaceDensity = DEFAULT_PREFERENCES.interfaceDensity;
    if (![3, 5, 8, 12, 20].includes(Number(merged.maxRecentWorkspaces))) merged.maxRecentWorkspaces = DEFAULT_PREFERENCES.maxRecentWorkspaces;
    if (![20, 60, 100, 200].includes(Number(merged.historyLimit))) merged.historyLimit = DEFAULT_PREFERENCES.historyLimit;
    if (![120, 180, 250, 350].includes(Number(merged.dragActivationDelay))) merged.dragActivationDelay = DEFAULT_PREFERENCES.dragActivationDelay;
    if (![300, 350, 420, 500].includes(Number(merged.middlePaneWidth))) merged.middlePaneWidth = DEFAULT_PREFERENCES.middlePaneWidth;
    if (![14, 18, 20, 24, 28].includes(Number(merged.treeIndentSize))) merged.treeIndentSize = DEFAULT_PREFERENCES.treeIndentSize;
    // 兼容旧版排序：保留用户已有项的相对顺序，缺失的新入口按默认顺序追加到末尾
    const knownOrder = Array.isArray(merged.sidebarOrder)
      ? merged.sidebarOrder.filter((id, i, arr) => ALL_SIDEBAR_ROUTE_IDS.includes(id) && arr.indexOf(id) === i)
      : [];
    merged.sidebarOrder = [
      ...knownOrder,
      ...ALL_SIDEBAR_ROUTE_IDS.filter((id) => !knownOrder.includes(id)),
    ];
    return merged;
  };


  const loadPreferences = (): UserPreferences => {
    try {
      const savedPrefs = localStorage.getItem('userPreferences');
      if (savedPrefs) {
        const parsed = JSON.parse(savedPrefs) as Partial<UserPreferences>;
        return sanitizePreferences(parsed);
      }
    } catch (error) {
      console.error('加载用户偏好设置失败:', error);
    }
    return { ...DEFAULT_PREFERENCES };
  };

  const preferences = ref<UserPreferences>(loadPreferences());

  const applyPreferencesToDocument = () => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.dataset.uiDensity = preferences.value.interfaceDensity;
    root.dataset.reduceMotion = String(preferences.value.reduceMotion);
    root.dataset.sidebarSize = preferences.value.sidebarSize;
    root.dataset.accentColor = preferences.value.accentColor;
    root.dataset.scrollbarSize = preferences.value.scrollbarSize;
    root.dataset.sidebarLabels = String(preferences.value.showSidebarLabels);
    root.style.setProperty('--easy-font-scale', String(preferences.value.fontScale / 100));
    root.style.setProperty('--easy-middle-pane-width', `${preferences.value.middlePaneWidth}px`);
    root.style.setProperty('--easy-tree-indent', `${preferences.value.treeIndentSize}px`);
  };

  const savePreferences = () => {
    try {
      localStorage.setItem('userPreferences', JSON.stringify(preferences.value));
    } catch (error) {
      console.error('保存用户偏好设置失败:', error);
    }
  };

  const updatePreference = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    preferences.value[key] = value;
    savePreferences();
    applyPreferencesToDocument();
  };

  const exportPreferences = () => JSON.stringify({
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    preferences: preferences.value,
  }, null, 2);

  const importPreferences = (payload: string) => {
    const parsed = JSON.parse(payload) as { preferences?: Partial<UserPreferences> } | Partial<UserPreferences>;
    const candidate = 'preferences' in parsed && parsed.preferences ? parsed.preferences : parsed;
    preferences.value = sanitizePreferences(candidate as Partial<UserPreferences>);
    savePreferences();
    applyPreferencesToDocument();
  };

  const resetInterfacePreferences = () => {
    preferences.value = {
      ...preferences.value,
      interfaceDensity: DEFAULT_PREFERENCES.interfaceDensity,
      reduceMotion: DEFAULT_PREFERENCES.reduceMotion,
      rememberTreeState: DEFAULT_PREFERENCES.rememberTreeState,
      autoExpandOnSearch: DEFAULT_PREFERENCES.autoExpandOnSearch,
      expandOnRowClick: DEFAULT_PREFERENCES.expandOnRowClick,
      showMatchDescriptions: DEFAULT_PREFERENCES.showMatchDescriptions,
      fontScale: DEFAULT_PREFERENCES.fontScale,
      accentColor: DEFAULT_PREFERENCES.accentColor,
      scrollbarSize: DEFAULT_PREFERENCES.scrollbarSize,
      sidebarSize: DEFAULT_PREFERENCES.sidebarSize,
      showSidebarLabels: DEFAULT_PREFERENCES.showSidebarLabels,
      hideUnsavedChangesWarning: DEFAULT_PREFERENCES.hideUnsavedChangesWarning,
      checkEspansoOnStartup: DEFAULT_PREFERENCES.checkEspansoOnStartup,
      checkUpdatesOnStartup: DEFAULT_PREFERENCES.checkUpdatesOnStartup,
      toastPosition: DEFAULT_PREFERENCES.toastPosition,
      toastDuration: DEFAULT_PREFERENCES.toastDuration,
      autoSave: DEFAULT_PREFERENCES.autoSave,
      backupBeforeSave: DEFAULT_PREFERENCES.backupBeforeSave,
      maxRecentWorkspaces: DEFAULT_PREFERENCES.maxRecentWorkspaces,
      historyLimit: DEFAULT_PREFERENCES.historyLimit,
      confirmBeforeDelete: DEFAULT_PREFERENCES.confirmBeforeDelete,
      autoRenameNewItems: DEFAULT_PREFERENCES.autoRenameNewItems,
      dragActivationDelay: DEFAULT_PREFERENCES.dragActivationDelay,
      middlePaneWidth: DEFAULT_PREFERENCES.middlePaneWidth,
      treeIndentSize: DEFAULT_PREFERENCES.treeIndentSize,
      sidebarOrder: [...DEFAULT_PREFERENCES.sidebarOrder],
    };
    savePreferences();
    applyPreferencesToDocument();
  };

  return {
    preferences,
    updatePreference,
    exportPreferences,
    importPreferences,
    resetInterfacePreferences,
    applyPreferencesToDocument,
  };
});
