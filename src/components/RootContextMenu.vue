<template>
  <ContextMenu @update:open="handleContextMenuUpdate">
    <ContextMenuTrigger asChild>
      <slot></slot>
    </ContextMenuTrigger>
    <ContextMenuContent class="min-w-[12rem]">
      <!-- 新建操作 -->
      <ContextMenuItem @select="handleCreateConfigFile">
        <component :is="icons.File" class="mr-2 h-4 w-4" />
        {{ t('contextMenu.newConfigFile') }}
      </ContextMenuItem>
      <ContextMenuItem @select="handleCreateFolder">
        <component :is="icons.FolderPlus" class="mr-2 h-4 w-4" />
        {{ t('contextMenu.newFolder') }}
      </ContextMenuItem>

      <ContextMenuSeparator />

      <!-- 展开/折叠操作 -->
      <ContextMenuItem @select="handleExpandAll">
        <component :is="icons.ChevronsDown" class="mr-2 h-4 w-4" />
        {{ t('contextMenu.expandAll') }}
      </ContextMenuItem>
      <ContextMenuItem @select="handleCollapseAll">
        <component :is="icons.ChevronsUp" class="mr-2 h-4 w-4" />
        {{ t('contextMenu.collapseAll') }}
      </ContextMenuItem>

      <ContextMenuSeparator />

      <!-- 在文件管理器中打开 -->
      <ContextMenuItem @select="handleOpenInExplorer">
        <component :is="icons.FolderOpen" class="mr-2 h-4 w-4" />
        {{ t('contextMenu.openInExplorer') }}
      </ContextMenuItem>

      <ContextMenuSeparator />

      <!-- 浏览官方包（链接到Espanso Hub） -->
      <ContextMenuItem @select="handleOpenPackageHub">
        <component :is="icons.ExternalLink" class="mr-2 h-4 w-4" />
        {{ t('contextMenu.browseOfficialPackages') }}
      </ContextMenuItem>
    </ContextMenuContent>
  </ContextMenu>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useEspansoStore } from '@/store/useEspansoStore';
import { useUserPreferences } from '@/store/useUserPreferences';
import { toast } from 'vue-sonner';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import * as platformService from '@/services/platformService';

// 导入图标
import {
  Plus as PlusIcon,
  File as FileIcon,
  FolderPlus as FolderPlusIcon,
  FolderOpen as FolderOpenIcon,
  ChevronsDown as ChevronsDownIcon,
  ChevronsUp as ChevronsUpIcon,
  ExternalLink as ExternalLinkIcon,
} from 'lucide-vue-next';

// 图标集合
const icons = {
  Plus: PlusIcon,
  File: FileIcon,
  FolderPlus: FolderPlusIcon,
  FolderOpen: FolderOpenIcon,
  ChevronsDown: ChevronsDownIcon,
  ChevronsUp: ChevronsUpIcon,
  ExternalLink: ExternalLinkIcon,
};

const { t } = useI18n();
const store = useEspansoStore();
const userPreferences = useUserPreferences();
const isContextMenuOpen = ref(false);

// 创建新片段


// 创建新配置文件
const handleCreateConfigFile = async () => {
  try {
    const rootDir = store.state.configRootDir;
    if (!rootDir) {
      toast.error('未设置根目录');
      return;
    }

    // 创建唯一的文件名
    const timestamp = new Date().getTime();
    const newFileName = `${timestamp}_config.yml`;

    console.log(`准备创建配置文件, 文件名: ${newFileName}`);

    // 直接在match文件夹中创建文件（传null让store自行处理）
    const newFileId = await store.createConfigFile(null, newFileName);

    if (!newFileId) {
      console.error('创建文件返回ID为空');
      toast.error('创建文件失败');
      return;
    }

    toast.success(`配置文件 ${newFileName} 已创建`);

    // 选中新创建的文件
    store.selectItem(newFileId, 'file');

    // 延时后尝试触发重命名
    if (userPreferences.preferences.autoRenameNewItems) setTimeout(() => {
      const el = document.getElementById(`tree-node-${newFileId}`)?.querySelector('.text-sm.font-medium.flex-grow');
      if (el instanceof HTMLElement) {
        try {
          el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
        } catch (err) {
          console.error('触发双击事件失败:', err);
        }
      }
    }, 300);
  } catch (error: any) {
    console.error('创建配置文件失败:', error);
    toast.error(`创建文件失败: ${error.message || '未知错误'}`);
  }
};

// 创建新文件夹
const handleCreateFolder = async () => {
  try {
    const rootDir = store.state.configRootDir;
    if (!rootDir) {
      toast.error('未设置根目录');
      return;
    }

    // configTree 本身就是 match 目录的内容，不能再依赖一个并不存在的 match 根节点。
    const matchDir = await platformService.joinPath(rootDir, 'match');
    if (!(await platformService.directoryExists(matchDir))) {
      await platformService.createDirectory(matchDir);
    }

    const timestamp = Date.now();
    const newFolderName = `${timestamp}_folder`;
    const newFolderPath = await platformService.joinPath(matchDir, newFolderName);
    await platformService.createDirectory(newFolderPath);

    const { createFolderNode } = await import('@/utils/configTreeUtils');
    const newFolderNode = createFolderNode(newFolderName, newFolderPath);
    store.state.configTree.unshift(newFolderNode);

    toast.success(`文件夹 ${newFolderName} 已创建`);
    store.selectItem(newFolderNode.id, 'folder');

    if (userPreferences.preferences.autoRenameNewItems) setTimeout(() => {
      const el = document.getElementById(`tree-node-${newFolderNode.id}`)?.querySelector('.text-sm.font-medium.flex-grow');
      if (el instanceof HTMLElement) {
        el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
      }
    }, 300);
  } catch (error: any) {
    console.error('创建文件夹失败:', error);
    toast.error(`创建文件夹失败: ${error.message || '未知错误'}`);
  }
};

// 展开所有节点
const handleExpandAll = () => {
  store.expandAllNodes();
};

// 折叠所有节点
const handleCollapseAll = () => {
  store.collapseAllNodes();
};

// 打开Espanso官方包网站
const handleOpenPackageHub = () => {
  window.open('https://hub.espanso.org/', '_blank');
};

// 在文件管理器中打开
const handleOpenInExplorer = async () => {
  try {
    const rootDir = store.state.configRootDir;
    if (!rootDir) {
      toast.error('未设置根目录');
      return;
    }

    const success = await platformService.openInExplorer(rootDir);
    if (!success) {
      toast.error('无法在文件管理器中打开文件夹');
    }
  } catch (error: any) {
    console.error('在文件管理器中打开文件夹失败:', error);
    toast.error(`打开文件夹失败: ${error.message || '未知错误'}`);
  }
};

// 更新上下文菜单状态
const handleContextMenuUpdate = (open: boolean) => {
  isContextMenuOpen.value = open;
};
</script>