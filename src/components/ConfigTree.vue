<template>
  <div class="config-tree" tabindex="0" @focus="treeHasFocus = true" @blur="treeHasFocus = false" @click="handleTreeClick">
    <div v-if="loading" class="flex items-center justify-center p-4 text-muted-foreground">
      <div class="animate-spin h-5 w-5 border-2 border-border border-t-primary rounded-full mr-2"></div>
      <span>{{ t('common.loading') }}</span>
    </div>
    <div v-else-if="!treeData || treeData.length === 0" class="p-4 text-muted-foreground">
      {{ t('snippets.noSnippets') }}
    </div>
    <div v-else class="tree-container w-full" data-parent-id="root" data-container-type="root">
      <template v-for="node in treeData" :key="node.id">
         <TreeNode
            :node="node"
            :selected-id="selectedId"
            :searchQuery="searchQuery"
            :parentMatches="false"
            :draggable="true"
            :level="0"
            @select="handleSelect"
            @move="handleItemMove"
            @moveNode="handleNodeMove"
            @request-rename="handleRequestRename"
            :on-request-rename="handleRequestRename"
          />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, defineProps, defineEmits, onMounted, onUnmounted, nextTick } from 'vue';
import { useEspansoStore } from '../store/useEspansoStore';
import TreeNode from './TreeNode.vue';
import type { Match } from '@/types/core/espanso.types';
import TreeNodeRegistry from '@/utils/TreeNodeRegistry';
import { toast } from 'vue-sonner';
import { determineSnippetPosition, focusTriggerInput } from '@/utils/snippetPositionUtils';
import type { TreeNodeItem } from '@/types/tree.types';
import { buildTreeData } from '@/utils/configTreeViewUtils';
import { useI18n } from 'vue-i18n';

// 初始化 i18n
const { t } = useI18n();

const props = defineProps<{
  selectedId?: string | null;
  searchQuery?: string;
}>();

const emit = defineEmits<{
  (e: 'select', item: Match): void;
  (e: 'request-rename', item: TreeNodeItem): void;
}>();

const store = useEspansoStore();
const loading = computed(() => store.state.loading);

// Renderer-only tree conversion is kept outside the component so ConfigTree stays lean.
const treeData = computed<TreeNodeItem[]>(() =>
  buildTreeData(store.state.configTree || [], (key) => t(key))
);

const handleSelect = (item: TreeNodeItem) => {
  if (item.type === 'match' && item.match) {
    emit('select', item.match);
  } else if (item.type === 'file' || item.type === 'folder') {
    // 使用store.selectItem方法选择文件节点，而不是直接修改state
    store.selectItem(item.id, item.type);
  }
};

// --- NEW: Handler for file/folder node move event from TreeNode ---
const handleNodeMove = (payload: { nodeId: string; targetParentId: string | null; newIndex: number }) => {
  console.log('[ConfigTree] Received moveNode event:', JSON.stringify(payload));
  store.moveItem(payload.nodeId, payload.targetParentId, payload.newIndex);
};

// --- Handler for match move event from TreeNode ---
const handleItemMove = (payload: { itemId: string; oldParentId: string | null; newParentId: string | null; oldIndex: number; newIndex: number }) => {
  console.log('[ConfigTree] Received move event (for item):', JSON.stringify(payload));
  store.moveItem(payload.itemId, payload.newParentId, payload.newIndex);
};

// 在组件挂载后输出树结构并设置键盘事件监听
onMounted(() => {
  // console.log('ConfigTree组件挂载完成');
  // console.log('当前树结构:', treeData.value);
  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick);
  document.removeEventListener('keydown', handleKeyDown);
});

const handleRequestRename = (item: TreeNodeItem) => {
  // Add defensive check for item
  if (!item) {
    console.warn('[ConfigTree] handleRequestRename received undefined item.');
    return;
  }

  // 只处理 file 和 folder 类型的节点 for renaming
  if (item.type !== 'file' && item.type !== 'folder') {
    console.log('[ConfigTree] Ignoring request-rename for non-file/folder node:', item.type);
    return;
  }

  console.log('[ConfigTree] Received request-rename event from TreeNode:', item.id, item.type);

  // Re-emit the event upwards
  emit('request-rename', item);
  console.log('[ConfigTree] Emitted request-rename upwards with item:', item);
};

const treeHasFocus = ref(false);

// 树组件点击处理函数
const handleTreeClick = (event: MouseEvent) => {
  const treeElement = event.currentTarget as HTMLElement;
  if (treeElement) {
    // 确保树组件获得焦点
    treeElement.focus();
    treeHasFocus.value = true;
    console.log('树组件获得焦点');
  }
};

// 暴露树组件聚焦状态，供其他组件使用
defineExpose({
  treeHasFocus
});

// 监听文档点击事件，检测点击是否在树外部
const handleDocumentClick = (event: MouseEvent) => {
  const treeElement = document.querySelector('.config-tree');
  if (treeElement && !treeElement.contains(event.target as Node)) {
    treeHasFocus.value = false;
    console.log('树组件失去焦点 (外部点击)');
  }
};

// 获取所有可见且可选择的节点（扁平化树结构）
const getAllSelectableNodes = (): { node: TreeNodeItem, element: HTMLElement }[] => {
  const result: { node: TreeNodeItem, element: HTMLElement }[] = [];

  // 递归函数，用于遍历树结构
  const traverseTree = (nodes: TreeNodeItem[]) => {
    for (const node of nodes) {
      // 获取节点对应的DOM元素
      const nodeElement = document.getElementById(`tree-node-${node.id}`);

      // 只处理可见的节点（DOM元素存在）
      if (nodeElement) {
        // 文件和匹配项是可选择的
        if (node.type === 'file' || node.type === 'match') {
          result.push({ node, element: nodeElement });
        }

        // 检查节点是否展开
        const nodeInfo = TreeNodeRegistry.get(node.id);
        const isNodeOpen = nodeInfo?.info?.isOpen?.value === true;

        // 如果节点有子节点且是展开的，则递归处理子节点
        if (isNodeOpen && node.children && node.children.length > 0) {
          traverseTree(node.children);
        }
      }
    }
  };

  // 从根节点开始遍历
  traverseTree(treeData.value);
  return result;
};

// 处理键盘导航
const handleKeyDown = (event: KeyboardEvent) => {
  // 只有当树组件有焦点时才处理键盘事件
  if (!treeHasFocus.value) {
    return;
  }

  // 处理Tab键快速创建新片段
  if (event.key === 'Tab' && !event.shiftKey) {
    event.preventDefault(); // 阻止默认的Tab行为
    createNewSnippet();
    return;
  }

  // 处理上下箭头键
  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;

  // 阻止默认行为（例如页面滚动）
  event.preventDefault();

  // 获取所有可选择的节点
  const selectableNodes = getAllSelectableNodes();
  if (selectableNodes.length === 0) {
    return;
  }

  // 找到当前选中节点的索引
  const currentIndex = selectableNodes.findIndex(item => item.node.id === props.selectedId);

  // 计算下一个要选择的节点索引
  let nextIndex = currentIndex;
  if (event.key === 'ArrowDown') {
    // 向下移动一行
    nextIndex = currentIndex < selectableNodes.length - 1 ? currentIndex + 1 : currentIndex;
  } else if (event.key === 'ArrowUp') {
    // 向上移动一行
    nextIndex = currentIndex > 0 ? currentIndex - 1 : 0;
  }

  // 如果索引没有变化，则不需要进一步处理
  if (nextIndex === currentIndex && currentIndex !== -1) {
    return;
  }

  // 如果没有选中项，则选择第一个节点
  if (currentIndex === -1) {
    nextIndex = 0;
  }

  // 获取下一个要选择的节点
  const nextNode = selectableNodes[nextIndex].node;
  const nextElement = selectableNodes[nextIndex].element;

  // 选择节点
  handleSelect(nextNode);

  // 确保选中的节点在视图中可见
  nextElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
};

// 创建新片段
const createNewSnippet = async () => {
  console.log('创建新片段: 使用Tab键');

  // 使用工具函数确定新片段的位置
  const { targetParentNodeId, insertIndex } = determineSnippetPosition(store.state.configTree, props.selectedId || null);

  if (!targetParentNodeId) {
    console.error('创建新片段: 无法确定目标父节点');
    toast.error(t('snippets.form.autoSave.error', { error: t('snippets.noSelection') }));
    return;
  }

  console.log(`创建新片段: 目标父节点 ${targetParentNodeId}, 插入索引 ${insertIndex}`);

  // 创建新片段数据
  const newMatchData = {
    trigger: ':new',
    replace: "",
    label: "",
  };

  try {
    // 调用 store 的 addItem 方法创建新片段
    const addedItem = await store.addItem(newMatchData, 'match', targetParentNodeId, insertIndex);

    if (addedItem) {
      console.log('创建新片段: 成功创建新片段', addedItem.id);
      toast.success(t('snippets.form.autoSave.success'));

      // 在下一个 tick 中开始尝试聚焦
      nextTick(() => {
        // 给UI一些时间来渲染
        setTimeout(() => focusTriggerInput(), 100);
      });
    } else {
      console.error('创建新片段: 创建失败');
      toast.error(t('snippets.form.autoSave.error', { error: t('common.error') }));
    }
  } catch (error: any) {
    console.error('创建新片段: 错误', error);
    toast.error(t('snippets.form.autoSave.error', { error: error.message || t('common.error') }));
  }
};

// 默认收起所有节点
const isOpen = ref(false);

</script>

<style scoped>
.config-tree {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden; /* 隐藏横向滚动条 */
  padding: 0;
  margin: 0;
  outline: none; /* 移除默认的焦点轮廓 */
  @apply bg-background; /* Use theme background */
}

/* 树组件获得焦点时的样式 */
.tree-has-focus {
  /* box-shadow: inset 0 0 0 2px rgba(59, 130, 246, 0.3); */ /* 改用 ring */
  @apply ring-2 ring-ring ring-inset;
}

.tree-container {
  width: 100%;
  margin: 0;
  padding: 0; /* 移除左侧内边距，恢复为0 */
}

/* 拖拽样式 */
.tree-ghost {
  opacity: 0.5;
  /* background-color: #f1f5f9 !important; */
  /* border: 1px dashed #64748b !important; */
  @apply bg-accent/50 border border-dashed border-border !important;
}

.tree-drag {
  opacity: 0.7;
  z-index: 10;
}

/* 确保被拖拽节点的直接子元素（例如图标和名称的容器）不会破坏高度 */
.sortable-drag > div {
  display: flex;
  align-items: center;
  height: 100%;
}
</style>
