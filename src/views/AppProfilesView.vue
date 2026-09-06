<template>
  <div class="page">
    <header class="page-header">
      <div>
        <div class="title-row">
          <component :is="headerIcon" class="title-icon" />
          <h1>{{ pageTitle }}</h1>
        </div>
        <p>{{ pageSubtitle }}</p>
      </div>
      <div class="header-actions">
        <Button variant="outline" @click="goCreate">
          <Plus class="w-4 h-4 mr-2" />新建配置
        </Button>
        <Button variant="outline" @click="reload" :disabled="apps.loading">
          <RefreshCw class="w-4 h-4 mr-2" :class="{ spin: apps.loading }" />
          {{ apps.loading ? '刷新中' : '刷新' }}
        </Button>
      </div>
    </header>

    <div class="toolbar" v-if="store.state.configRootDir">
      <div class="search-box">
        <Search class="w-4 h-4" />
        <input v-model="query" placeholder="搜索名称、过滤规则或路径…" />
      </div>
      <div class="summary">
        <span>{{ filteredProfiles.length }} 条规则</span>
        <span v-if="apps.conflictCount" class="summary-conflict">{{ apps.conflictCount }} 个冲突</span>
      </div>
    </div>

    <div v-if="apps.error" class="error-banner">
      <AlertTriangle class="w-4 h-4" />
      <span>加载应用配置失败：{{ apps.error }}</span>
      <button type="button" @click="reload">重试</button>
    </div>

    <div v-if="apps.conflictCount" class="warn">
      <AlertTriangle class="w-4 h-4" />
      <span>发现 {{ apps.conflictCount }} 个冲突配置：相同过滤器和值可能产生不明确的应用行为。</span>
    </div>

    <div v-if="!store.state.configRootDir" class="empty-state">
      <FolderOpen class="empty-icon" />
      <h2>还没有配置目录</h2>
      <p>请先选择 Espanso 配置目录，再管理应用专用规则。</p>
      <Button @click="router.push('/snippets')">返回片段页</Button>
    </div>

    <div v-else-if="apps.loading && !apps.profiles.length" class="empty-state">
      <LoaderCircle class="empty-icon spin" />
      <h2>正在读取应用配置</h2>
      <p>扫描 config 目录中的 YAML 规则…</p>
    </div>

    <div v-else-if="!filteredProfiles.length" class="empty-state">
      <SearchX v-if="query" class="empty-icon" />
      <component :is="headerIcon" v-else class="empty-icon" />
      <h2>{{ query ? '没有匹配的规则' : (category ? `还没有${pageTitle}` : '还没有应用专用配置') }}</h2>
      <p>{{ query ? '换一个关键词试试。' : (category ? '点击下方按钮创建第一条规则。' : '可以从设置页创建第一条规则。') }}</p>
      <Button v-if="!query" @click="goCreate"><Plus class="w-4 h-4 mr-2" />新建应用配置</Button>
      <Button v-else variant="outline" @click="query = ''">清空搜索</Button>
    </div>

    <div v-else class="list" aria-live="polite">
      <article v-for="p in filteredProfiles" :key="p.path" class="profile-card" :class="{ disabled: !p.enabled }">
        <div class="app-icon" :title="p.filterValue">
          <img v-if="iconUrls[p.filterValue]" :src="iconUrls[p.filterValue]" alt="" draggable="false" />
          <AppWindow v-else class="app-icon-fallback" />
        </div>
        <div class="rank" :title="`优先级 ${p.priority}`">#{{ p.priority }}</div>
        <div class="main">
          <div class="profile-title">
            <strong>{{ p.fileName }}</strong>
            <span class="badge">{{ label(p.filterType) }}</span>
            <span v-if="!p.enabled" class="badge muted-badge">已停用</span>
            <span v-if="p.conflicts.length" class="badge conflict">冲突</span>
          </div>
          <code>{{ p.filterValue }}</code>
          <small :title="p.path">{{ p.path }}</small>
          <div v-if="p.conflicts.length" class="conflict-text">与 {{ p.conflicts.join('、') }} 使用相同规则</div>
          <div v-if="profileSnippets[p.path]?.length" class="profile-snippets">
            <span class="profile-snippets-title">仅此应用：</span>
            <span
              v-for="snippet in profileSnippets[p.path]"
              :key="snippet.id"
              class="snippet-chip"
              :title="snippet.label || snippet.trigger || snippet.triggers?.[0] || '专用片段'"
            >
              {{ snippet.trigger || snippet.triggers?.[0] || '（无触发词）' }}<em v-if="snippet.label">{{ snippet.label }}</em>
            </span>
          </div>
        </div>
        <div class="actions">
          <Button size="icon" variant="ghost" @click="move(p, -1)" :disabled="apps.loading || p.priority <= 1" title="提高优先级"><ArrowUp class="w-4 h-4" /></Button>
          <Button size="icon" variant="ghost" @click="move(p, 1)" :disabled="apps.loading || p.priority >= apps.profiles.length" title="降低优先级"><ArrowDown class="w-4 h-4" /></Button>
          <Button size="sm" variant="outline" @click="edit(p)">编辑</Button>
          <Button size="sm" variant="outline" @click="toggle(p)">{{ p.enabled ? '停用' : '启用' }}</Button>
          <Button size="sm" variant="ghost" class="danger" @click="del(p)">删除</Button>
        </div>
      </article>
    </div>

    <div v-if="creating" class="overlay" @click.self="creating = false">
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="app-profile-create-title">
        <div class="dialog-heading">
          <div>
            <h2 id="app-profile-create-title">新建应用规则</h2>
            <p>直接在应用配置管理器中创建 Espanso 应用专用配置。</p>
          </div>
          <button type="button" class="close-button" @click="creating = false" aria-label="关闭"><X class="w-4 h-4" /></button>
        </div>
        <label>配置名称<input v-model="newConfig.fileName" placeholder="vscode / telegram / browser_youtube" /></label>
        <label>过滤类型
          <select v-model="newConfig.filterType">
            <option value="filter_exec">可执行文件</option>
            <option value="filter_class">窗口类 / App ID</option>
            <option value="filter_title">窗口标题</option>
          </select>
        </label>
        <label v-if="newConfig.filterType === 'filter_exec'">拖放准星选取程序
          <div class="app-picker-row">
            <button
              type="button"
              class="target-picker"
              draggable="true"
              title="按住并拖到目标程序窗口上，松开后自动识别 EXE"
              @dragstart="startAppPicker"
              @dragend="finishAppPicker(newConfig)"
            ><Crosshair class="w-5 h-5" /></button>
            <span>将准星拖到目标软件窗口上方后松开</span>
          </div>
        </label>
        <label>匹配值<input v-model="newConfig.filterValue" :placeholder="filterValuePlaceholder" /></label>
        <AppOnlySnippetsEditor v-model="creatingSnippets" />
        <label>后端
          <select v-model="newConfig.backend">
            <option value="auto">auto</option>
            <option value="inject">inject</option>
            <option value="clipboard">clipboard</option>
          </select>
        </label>
        <label>粘贴快捷键<input v-model="newConfig.paste_shortcut" placeholder="CTRL+V / CTRL+SHIFT+V" /></label>
        <div class="dialog-grid">
          <label>注入延迟 (ms)<input type="number" v-model.number="newConfig.inject_delay" /></label>
          <label>按键延迟 (ms)<input type="number" v-model.number="newConfig.key_delay" /></label>
        </div>
        <label class="check"><input type="checkbox" v-model="newConfig.enable" /> 在匹配应用中启用 Espanso</label>
        <label class="check"><input type="checkbox" v-model="newConfig.apply_patch" /> 应用 Espanso 内置补丁</label>
        <div class="footer">
          <Button variant="outline" @click="creating = false">取消</Button>
          <Button @click="saveCreate" :disabled="savingCreate">{{ savingCreate ? '保存中…' : '创建配置' }}</Button>
        </div>
      </div>
    </div>

    <div v-if="editing" class="overlay" @click.self="editing = null">
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="app-profile-dialog-title">
        <div class="dialog-heading">
          <div>
            <h2 id="app-profile-dialog-title">编辑应用规则</h2>
            <p>{{ editing.fileName }}</p>
          </div>
          <button type="button" class="close-button" @click="editing = null" aria-label="关闭"><X class="w-4 h-4" /></button>
        </div>
        <label>过滤类型
          <select v-model="editing.filterType">
            <option value="filter_exec">可执行文件</option>
            <option value="filter_class">窗口类 / App ID</option>
            <option value="filter_title">窗口标题</option>
          </select>
        </label>
        <label v-if="editing.filterType === 'filter_exec'">拖放准星选取程序
          <div class="app-picker-row">
            <button type="button" class="target-picker" draggable="true" title="按住并拖到目标程序窗口上，松开后自动识别 EXE" @dragstart="startAppPicker" @dragend="finishAppPicker(editing)"><Crosshair class="w-5 h-5" /></button>
            <span>将准星拖到目标软件窗口上方后松开</span>
          </div>
        </label>
        <label>匹配值<input v-model="editing.filterValue" :placeholder="filterValuePlaceholder" /></label>
        <AppOnlySnippetsEditor v-model="editingSnippets" />
        <label>后端
          <select v-model="editing.backend">
            <option :value="undefined">继承</option>
            <option value="auto">auto</option>
            <option value="inject">inject</option>
            <option value="clipboard">clipboard</option>
          </select>
        </label>
        <label class="check"><input type="checkbox" v-model="editing.enable" /> 在匹配应用中启用 Espanso</label>
        <div class="footer">
          <Button variant="outline" @click="editing = null">取消</Button>
          <Button @click="saveEdit" :disabled="savingEdit">{{ savingEdit ? '保存中…' : '保存' }}</Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, toRaw, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import {
  AlertTriangle,
  AppWindow,
  Crosshair,
  ArrowDown,
  ArrowUp,
  Folder,
  FolderOpen,
  Globe,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  SearchX,
  X,
} from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import AppOnlySnippetsEditor from '@/components/AppOnlySnippetsEditor.vue';
import { useEspansoStore } from '@/store/useEspansoStore';
import { useAppProfilesStore, type AppProfile } from '@/store/useAppProfilesStore';
import * as appSpecificConfigService from '@/services/appSpecificConfigService';
import type { Match } from '@/types/core/espanso.types';
import { invoke } from '@tauri-apps/api/core';

const router = useRouter();
const route = useRoute();
const { t } = useI18n();
const store = useEspansoStore();
const apps = useAppProfilesStore();

// ==================== 页面分类（/web 网页、/folders 文件夹、/apps 全部） ====================
type ProfileCategory = 'web' | 'folder';
const category = computed(() => route.meta.profileCategory as ProfileCategory | undefined);

// 能在 PATH 中找到的常见浏览器
const BROWSER_EXES = ['chrome', 'msedge', 'edge', 'firefox', 'brave', 'opera', 'vivaldi', 'safari', '360se', '360chrome', 'qqbrowser', 'maxthon'];

// 判定规则归属哪个分类页（undefined = 不属于专用页，仅在应用配置总页显示）
function profileCategory(p: AppProfile): ProfileCategory | undefined {
  const v = p.filterValue.toLowerCase();
  if (p.filterType === 'filter_exec') {
    if (v.includes('explorer')) return 'folder';
    if (BROWSER_EXES.some((b) => v.includes(b))) return 'web';
  }
  if (p.filterType === 'filter_class' && /explore|cabinet/.test(v)) return 'folder';
  // 窗口标题匹配通常是浏览器标签页 / 网站名
  if (p.filterType === 'filter_title') return 'web';
  return undefined;
}

const pageTitle = computed(() => {
  if (category.value === 'web') return t('appProfiles.web.title');
  if (category.value === 'folder') return t('appProfiles.folder.title');
  return t('appProfiles.default.title');
});
const pageSubtitle = computed(() => {
  if (category.value === 'web') return t('appProfiles.web.subtitle');
  if (category.value === 'folder') return t('appProfiles.folder.subtitle');
  return t('appProfiles.default.subtitle');
});
const headerIcon = computed(() => (category.value === 'web' ? Globe : category.value === 'folder' ? Folder : AppWindow));
const editing = ref<AppProfile | null>(null);
const creating = ref(false);
const newConfig = ref<appSpecificConfigService.AppSpecificConfig>({
  fileName: 'app',
  filterType: 'filter_exec',
  filterValue: '',
  enable: true,
  backend: 'auto',
  paste_shortcut: '',
  inject_delay: 0,
  key_delay: 0,
  apply_patch: true,
  matchFiles: [],
});
const savingCreate = ref(false);
const query = ref('');
const savingEdit = ref(false);
const creatingSnippets = ref<Match[]>([]);
const editingSnippets = ref<Match[]>([]);
const profileSnippets = ref<Record<string, Match[]>>({});

type EditableAppConfig = appSpecificConfigService.AppSpecificConfig | AppProfile;
const pickingApp = ref(false);

function startAppPicker(event: DragEvent) {
  pickingApp.value = true;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('text/plain', 'Easy Espanso target picker');
  }
}

async function finishAppPicker(target: EditableAppConfig) {
  if (!pickingApp.value) return;
  pickingApp.value = false;
  try {
    const executablePath = await invoke<string>('get_executable_under_cursor');
    const executable = executablePath.split(/[\\/]/).pop() || executablePath;
    target.filterType = 'filter_exec';
    target.filterValue = executable;
    if (!target.fileName || target.fileName === 'app') target.fileName = executable.replace(/\.exe$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_') || 'app';
    toast.success(`已识别程序：${executable}`);
    // 准星识别到的完整路径只存在于此刻，立即用它在后端提取图标并按 exe 名缓存，
    // 之后列表按文件名查找直接命中（下载目录等 PATH 外的程序也能显示图标）
    invoke<string>('get_app_icon_base64', { executable: executablePath })
      .then((url) => {
        if (url && url.startsWith('data:image')) {
          iconUrls.value[executable.toLowerCase()] = url;
          failedIcons.delete(executable.toLowerCase());
        }
      })
      .catch(() => {});
  } catch (error: any) {
    toast.error(error?.message ?? String(error));
  }
}

const filteredProfiles = computed(() => {
  const needle = query.value.trim().toLowerCase();
  return apps.profiles
    .filter((profile) => !category.value || profileCategory(profile) === category.value)
    .filter((profile) =>
      !needle ||
      [profile.fileName, profile.filterType, profile.filterValue, profile.path]
        .some((value) => value.toLowerCase().includes(needle)),
    );
});

// ==================== 程序图标 ====================
const iconUrls = ref<Record<string, string>>({});
const failedIcons = new Set<string>();

// 提取 exe 图标（filter_exec 类型才有意义），结果缓存在组件生命周期内
const loadIcon = async (filterValue: string) => {
  const key = filterValue.trim();
  if (!key || iconUrls.value[key] || failedIcons.has(key)) return;
  failedIcons.add(key); // 先占位防止重复请求，成功后覆盖
  try {
    const url = await invoke<string>('get_app_icon_base64', { executable: key });
    if (url && url.startsWith('data:image')) {
      iconUrls.value[key] = url;
      failedIcons.delete(key);
    }
  } catch {
    // 解析失败保持回退图标
  }
};

watch(
  () => apps.profiles.map((p) => p.filterValue).join('|'),
  () => {
    apps.profiles.forEach((p) => {
      if (p.filterType === 'filter_exec') loadIcon(p.filterValue);
    });
  },
  { immediate: true },
);

const reload = async () => {
  if (!store.state.configRootDir) return;
  await apps.load(store.state.configRootDir);
  const entries = await Promise.all(apps.profiles.map(async (profile) => {
    try {
      const snippets = await appSpecificConfigService.loadAppOnlySnippets(store.state.configRootDir!, profile);
      return [profile.path, snippets] as const;
    } catch (error) {
      console.warn('读取应用专用片段失败:', profile.path, error);
      return [profile.path, [] as Match[]] as const;
    }
  }));
  profileSnippets.value = Object.fromEntries(entries);
};

onMounted(reload);
watch(() => store.state.configRootDir, reload);

const label = (value: string) => value === 'filter_exec' ? '程序' : value === 'filter_class' ? '窗口类' : '标题';
const goCreate = () => {
  creatingSnippets.value = [];
  creating.value = true;
  // 按分类页预填过滤类型与匹配值
  if (category.value === 'folder') {
    newConfig.value.filterType = 'filter_exec';
    newConfig.value.filterValue = 'explorer.exe';
  } else if (category.value === 'web') {
    newConfig.value.filterType = 'filter_exec';
    newConfig.value.filterValue = '';
  }
};

const filterValuePlaceholder = computed(() => {
  if (category.value === 'web') return '例如 YouTube、GitHub 或 chrome.exe';
  if (category.value === 'folder') return '例如 explorer.exe';
  return '例如 Code.exe、Telegram、YouTube';
});

// 切换分类页时收起弹窗，避免跨页残留
watch(category, () => {
  creating.value = false;
  editing.value = null;
});

const cloneProfile = (profile: AppProfile): AppProfile => {
  const plain = toRaw(profile);
  return {
    ...plain,
    raw: { ...toRaw(plain.raw) },
    conflicts: [...plain.conflicts],
    matchFiles: [...(plain.matchFiles || [])],
  };
};
const edit = async (profile: AppProfile) => {
  editing.value = cloneProfile(profile);
  editingSnippets.value = [];
  if (!store.state.configRootDir) {
    return;
  }
  try {
    editingSnippets.value = await appSpecificConfigService.loadAppOnlySnippets(store.state.configRootDir, profile);
  } catch (error: any) {
    editingSnippets.value = [];
    toast.error(`读取专用片段失败：${error?.message ?? String(error)}`);
  }
};

async function saveCreate() {
  if (!store.state.configRootDir || savingCreate.value) return;
  if (!newConfig.value.fileName.trim()) { toast.error('配置名称不能为空'); return; }
  if (!newConfig.value.filterValue.trim()) { toast.error('匹配值不能为空'); return; }
  // 匹配值是完整路径时（用户手填下载目录等），按 exe 名预取图标缓存
  if (/[\\/]/.test(newConfig.value.filterValue)) {
    invoke<string>('get_app_icon_base64', { executable: newConfig.value.filterValue })
      .then((url) => {
        const name = newConfig.value.filterValue.split(/[\\/]/).pop()?.toLowerCase() ?? '';
        if (url && url.startsWith('data:image') && name) {
          iconUrls.value[name] = url;
          failedIcons.delete(name);
        }
      })
      .catch(() => {});
  }
  savingCreate.value = true;
  try {
    const item = appSpecificConfigService.withAppOnlyMatchReference({ ...newConfig.value });
    await appSpecificConfigService.saveAppOnlySnippets(store.state.configRootDir, item, creatingSnippets.value);
    await appSpecificConfigService.saveAppSpecificConfig(store.state.configRootDir, item);
    await appSpecificConfigService.syncAppOnlyMatchExcludes(store.state.configRootDir);
    creating.value = false;
    creatingSnippets.value = [];
    newConfig.value = { fileName: 'app', filterType: 'filter_exec', filterValue: '', enable: true, backend: 'auto', paste_shortcut: '', inject_delay: 0, key_delay: 0, apply_patch: true, matchFiles: [] };
    await reload();
    toast.success('应用配置已创建');
  } catch (error: any) {
    toast.error(`创建失败：${error?.message ?? String(error)}`);
  } finally {
    savingCreate.value = false;
  }
}

async function saveEdit() {
  if (!editing.value || savingEdit.value) return;
  if (!editing.value.filterValue.trim()) {
    toast.error('匹配值不能为空');
    return;
  }
  savingEdit.value = true;
  try {
    const item = appSpecificConfigService.withAppOnlyMatchReference(editing.value);
    await appSpecificConfigService.saveAppOnlySnippets(store.state.configRootDir!, item, editingSnippets.value);
    await apps.save(item);
    editing.value = null;
    editingSnippets.value = [];
    await reload();
    toast.success('应用配置已保存');
  } catch (error: any) {
    toast.error(`保存失败：${error?.message ?? String(error)}`);
  } finally {
    savingEdit.value = false;
  }
}

async function move(profile: AppProfile, delta: number) {
  try {
    await apps.move(profile, delta);
    await reload();
  } catch (error: any) {
    toast.error(`调整优先级失败：${error?.message ?? String(error)}`);
  }
}

async function toggle(profile: AppProfile) {
  try {
    await apps.setEnabled(profile, !profile.enabled);
    await reload();
    toast.success(profile.enabled ? '应用配置已停用' : '应用配置已启用');
  } catch (error: any) {
    toast.error(`操作失败：${error?.message ?? String(error)}`);
  }
}

async function del(profile: AppProfile) {
  if (!confirm(`删除 ${profile.fileName}？此操作会删除对应 YAML 文件。`)) return;
  try {
    await apps.remove(profile);
    await reload();
    toast.success('已删除');
  } catch (error: any) {
    toast.error(`删除失败：${error?.message ?? String(error)}`);
  }
}
</script>

<style scoped>
.page {
  height: 100%;
  overflow: auto;
  padding: 28px;
  max-width: 1280px;
  margin: auto;
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 18px;
}
.title-row { display: flex; align-items: center; gap: 10px; }
.title-icon { width: 24px; height: 24px; color: hsl(var(--primary)); }
h1 { font-size: 26px; font-weight: 700; }
p, small { color: hsl(var(--muted-foreground)); }
.header-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px;
  margin-bottom: 14px;
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) + 2px);
  background: hsl(var(--card));
}
.search-box {
  min-width: 220px;
  max-width: 520px;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  background: hsl(var(--background));
  color: hsl(var(--muted-foreground));
}
.search-box:focus-within { border-color: hsl(var(--primary)); box-shadow: 0 0 0 2px hsl(var(--primary) / 0.12); }
.search-box input { border: 0; box-shadow: none; background: transparent; padding: 8px 0; }
.search-box input:focus { box-shadow: none; }
.summary { display: flex; gap: 8px; font-size: 12px; color: hsl(var(--muted-foreground)); white-space: nowrap; }
.summary span { padding: 4px 8px; border-radius: 9999px; background: hsl(var(--muted)); }
.summary .summary-conflict { background: hsl(38 92% 50% / 0.15); color: hsl(32 95% 44%); }
.warn, .error-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-radius: 10px;
  margin-bottom: 14px;
}
.warn { border: 1px solid hsl(38 92% 50% / 0.45); background: hsl(38 92% 50% / 0.08); }
.error-banner { border: 1px solid hsl(var(--destructive) / 0.45); background: hsl(var(--destructive) / 0.08); color: hsl(var(--destructive)); }
.error-banner button { margin-left: auto; text-decoration: underline; }
.empty-state {
  min-height: 360px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 10px;
  border: 1px dashed hsl(var(--border));
  border-radius: 14px;
  background: hsl(var(--card) / 0.55);
}
.empty-state h2 { font-size: 18px; font-weight: 650; }
.empty-icon { width: 36px; height: 36px; color: hsl(var(--primary)); opacity: 0.85; }
.list { display: grid; gap: 10px; }
.profile-card {
  display: flex;
  align-items: center;
  gap: 14px;
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
  padding: 14px;
  background: hsl(var(--card));
  transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
}
.profile-card:hover { border-color: hsl(var(--primary) / 0.35); box-shadow: 0 8px 26px rgb(0 0 0 / 0.06); transform: translateY(-1px); }
.profile-card.disabled { opacity: .62; }
.rank { font-weight: 700; width: 42px; color: hsl(var(--primary)); }
.app-icon {
  width: 42px; height: 42px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  background: hsl(var(--muted)); border: 1px solid hsl(var(--border));
  border-radius: 10px; overflow: hidden;
}
.app-icon img { width: 32px; height: 32px; object-fit: contain; image-rendering: auto; }
.app-icon-fallback { width: 22px; height: 22px; color: hsl(var(--muted-foreground)); }
.main { flex: 1; min-width: 0; }
.profile-title { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.badge { font-size: 12px; padding: 2px 7px; border-radius: 9999px; background: hsl(var(--primary) / 0.09); color: hsl(var(--primary)); }
.muted-badge { background: hsl(var(--muted)); color: hsl(var(--muted-foreground)); }
.conflict { background: hsl(38 92% 50% / 0.16); color: hsl(32 95% 44%); }
.main code, .main small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 5px; }
.main code { color: hsl(var(--foreground)); }
.conflict-text { font-size: 12px; color: hsl(32 95% 44%); margin-top: 4px; }
.actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
.danger { color: hsl(var(--destructive)); }
.overlay { position: fixed; inset: 0; background: rgb(0 0 0 / .55); backdrop-filter: blur(4px); display: grid; place-items: center; z-index: 80; padding: 20px; }
.dialog { width: min(920px, 96vw); max-height: 92vh; overflow-y: auto; background: hsl(var(--background)); border: 1px solid hsl(var(--border)); box-shadow: 0 24px 80px rgb(0 0 0 / .28); padding: 22px; border-radius: 14px; display: grid; gap: 14px; }
.dialog-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.dialog h2 { font-size: 20px; font-weight: 650; }
.dialog label { display: grid; gap: 6px; font-size: 13px; font-weight: 500; }
.dialog input, .dialog select { border: 1px solid hsl(var(--border)); border-radius: 8px; padding: 9px; background: hsl(var(--background)); color: hsl(var(--foreground)); }
.dialog .check { display: flex; align-items: center; font-weight: 400; }
.dialog .check input { width: auto; }
.app-picker-row { display: flex; align-items: center; gap: 10px; min-height: 42px; padding: 8px 10px; border: 1px solid hsl(var(--border)); border-radius: 8px; background: hsl(var(--muted) / .35); color: hsl(var(--muted-foreground)); font-weight: 400; }
.target-picker { width: 34px; height: 34px; display: inline-grid; place-items: center; flex: 0 0 auto; border: 1px solid hsl(var(--border)); border-radius: 7px; background: hsl(var(--background)); color: hsl(var(--primary)); cursor: crosshair; }
.target-picker:active { transform: scale(.96); }
.match-file-box { border: 1px solid hsl(var(--border)); border-radius: 10px; padding: 10px 12px 12px; display: grid; gap: 8px; }
.match-file-box legend { padding: 0 5px; font-size: 13px; font-weight: 600; }
.match-file-box p { font-size: 12px; margin: 0; }
.match-file-list { max-height: 240px; overflow: auto; display: grid; gap: 5px; padding-right: 4px; }
.dialog .match-file-item { display: flex; align-items: center; gap: 8px; padding: 5px 6px; border-radius: 6px; font-size: 12px; }
.dialog .match-file-item:hover { background: hsl(var(--accent)); }
.match-file-entry { border: 1px solid hsl(var(--border) / .65); border-radius: 8px; overflow: hidden; }
.match-file-entry + .match-file-entry { margin-top: 5px; }
.snippet-count { margin-left: auto; color: hsl(var(--muted-foreground)); font-size: 11px; white-space: nowrap; }
.snippet-preview { display: flex; flex-wrap: wrap; gap: 5px; padding: 4px 8px 8px 30px; background: hsl(var(--muted) / .18); }
.snippet-chip { display: inline-flex; align-items: center; gap: 4px; max-width: 180px; padding: 2px 6px; border-radius: 5px; background: hsl(var(--background)); border: 1px solid hsl(var(--border)); font-size: 11px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.snippet-chip em { color: hsl(var(--muted-foreground)); font-family: inherit; font-style: normal; }
.profile-snippets { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; margin-top: 8px; }
.profile-snippets-title { font-size: 11px; color: hsl(var(--muted-foreground)); margin-right: 2px; }
.close-button { width: 32px; height: 32px; padding: 0; color: hsl(var(--muted-foreground)); }
.close-button:hover { background: hsl(var(--accent)); color: hsl(var(--foreground)); }
.dialog-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.footer { display: flex; justify-content: flex-end; gap: 8px; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 880px) {
  .page { padding: 20px; }
  .page-header { flex-direction: column; }
  .header-actions { width: 100%; justify-content: flex-start; }
  .toolbar { align-items: stretch; flex-direction: column; }
  .summary { justify-content: flex-end; }
  .profile-card { align-items: flex-start; flex-wrap: wrap; }
  .actions { width: 100%; justify-content: flex-start; padding-left: 56px; }
}
</style>
