import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import * as platform from '@/services/platformService';
import * as yaml from '@/services/yamlService';
import type { AppFilterType, AppSpecificConfig } from '@/services/appSpecificConfigService';

export interface AppProfile extends AppSpecificConfig {
  path: string; enabled: boolean; priority: number; raw: Record<string, unknown>; conflicts: string[];
}
const FILTERS: AppFilterType[] = ['filter_exec','filter_class','filter_title'];
export const useAppProfilesStore = defineStore('appProfiles', () => {
  const profiles = ref<AppProfile[]>([]); const loading = ref(false); const error = ref<string|null>(null); const root = ref<string|null>(null);
  const conflictCount = computed(() => profiles.value.filter(p => p.conflicts.length).length);
  async function load(configRoot: string) {
    root.value = configRoot; loading.value = true; error.value = null;
    try {
      const dir = await platform.joinPath(configRoot, 'config');
      if (!(await platform.directoryExists(dir))) { profiles.value=[]; return; }
      const files = (await platform.listFiles(dir)).filter(f => /\.ya?ml(?:\.disabled)?$/i.test(f.name)).sort((a,b)=>a.name.localeCompare(b.name));
      const out: AppProfile[] = [];
      for (let i=0;i<files.length;i++) {
        try {
          const raw = (await yaml.parseYaml(await platform.readFile(files[i].path))) as Record<string, unknown>;
          const ft = FILTERS.find(k => typeof raw[k] === 'string'); if (!ft) continue;
          out.push({ path: files[i].path, fileName: files[i].name.replace(/\.ya?ml(?:\.disabled)?$/i,''), filterType: ft, filterValue: String(raw[ft]),
            enable: raw.enable as boolean|undefined, backend: raw.backend as AppSpecificConfig['backend'], paste_shortcut: raw.paste_shortcut as string|undefined,
            inject_delay: raw.inject_delay as number|undefined, key_delay: raw.key_delay as number|undefined, apply_patch: raw.apply_patch as boolean|undefined,
            matchFiles: Array.isArray(raw.extra_includes) ? raw.extra_includes.filter((v): v is string => typeof v === 'string') : [],
            enabled: !files[i].name.endsWith('.disabled'), priority:i+1, raw, conflicts: [] });
        } catch (e) { console.warn('Skip invalid app profile', files[i].path, e); }
      }
      for (const p of out) p.conflicts = out.filter(q => q.path!==p.path && q.enabled && p.enabled && q.filterType===p.filterType && q.filterValue===p.filterValue).map(q=>q.fileName);
      profiles.value=out;
    } catch(e:any){ error.value=e?.message ?? String(e); } finally { loading.value=false; }
  }
  async function save(item: AppProfile) {
    const data={...item.raw}; FILTERS.forEach(k=>delete data[k]); data[item.filterType]=item.filterValue;
    for(const k of ['enable','backend','paste_shortcut','inject_delay','key_delay','apply_patch'] as const) item[k]===undefined||item[k]===''?delete data[k]:data[k]=item[k] as never;
    if (item.matchFiles?.length) data.extra_includes = [...item.matchFiles]; else delete data.extra_includes;
    await platform.writeFile(item.path, await yaml.serializeYaml(data as any));
    if(root.value) { const svc = await import('@/services/appSpecificConfigService'); await svc.syncAppOnlyMatchExcludes(root.value); await load(root.value); }
  }
  async function remove(item: AppProfile){
    if(root.value) {
      const svc = await import('@/services/appSpecificConfigService');
      await svc.deleteAppOnlySnippetFile(root.value, item);
    }
    await platform.deleteFile(item.path);
    if(root.value) { const svc = await import('@/services/appSpecificConfigService'); await svc.syncAppOnlyMatchExcludes(root.value); await load(root.value); }
  }
  async function setEnabled(item: AppProfile, enabled:boolean){
    let next=item.path; if(enabled && next.endsWith('.disabled')) next=next.slice(0,-9); else if(!enabled && !next.endsWith('.disabled')) next += '.disabled';
    if(next!==item.path) await platform.renameFileOrDirectory(item.path,next); if(root.value) await load(root.value);
  }
  async function move(item: AppProfile, delta:number){
    if(!root.value) return; const ordered=[...profiles.value]; const from=ordered.findIndex(p=>p.path===item.path); const to=Math.max(0,Math.min(ordered.length-1,from+delta)); if(from===to)return;
    const [m]=ordered.splice(from,1); ordered.splice(to,0,m);
    // Espanso resolves overlapping app configs by filename order; numeric prefixes make that order explicit.
    for(let i=0;i<ordered.length;i++){
      const p=ordered[i]; const dir=await platform.joinPath(root.value,'config'); const ext=p.enabled?'.yml':'.yml.disabled'; const base=p.fileName.replace(/^\d{3}[-_]/,'');
      const target=await platform.joinPath(dir,`${String(i+1).padStart(3,'0')}-${base}${ext}`); if(target!==p.path) { await platform.renameFileOrDirectory(p.path,target); p.path=target; }
    }
    await load(root.value);
  }
  return {profiles,loading,error,root,conflictCount,load,save,remove,setEnabled,move};
});
