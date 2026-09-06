<template>
  <div :class="['main-layout', 'flex', 'h-screen', 'overflow-hidden', 'bg-background']">

    <!-- Main Content Area -->
    <!-- Revert to static class temporarily -->
    <!-- TODO: Restore dynamic class binding based on platform and fullscreen state once store issues are resolved -->
    <!-- MiddlePane and RightPane now use bg-card for their own background, inherited from theme -->
    <div class="main-content-area flex flex-1 overflow-hidden">
      <MiddlePane 
        ref="middlePaneRef" 
        class="middle-pane overflow-y-auto border-r border-border bg-muted"
      />
      <RightPane 
        ref="rightPaneRef" 
        class="flex-1 overflow-y-auto bg-card"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
// Remove store import if only used for dynamic padding
// import { useEspansoStore } from '../../store/useEspansoStore';
import { ref, onMounted } from 'vue';
import MiddlePane from '../panels/MiddlePane.vue';
import RightPane from '../panels/RightPane.vue';

// 引用组件实例
const middlePaneRef = ref<InstanceType<typeof MiddlePane> | null>(null);
const rightPaneRef = ref<InstanceType<typeof RightPane> | null>(null);

// 在组件挂载后建立引用关系
onMounted(() => {
  // 将中间面板引用传递给右侧面板
  if (rightPaneRef.value && middlePaneRef.value) {
    // @ts-ignore 临时忽略类型错误，实际使用时需要调整类型定义
    rightPaneRef.value.middlePaneRef = middlePaneRef.value;
  }
});
</script>

<style scoped>
.main-layout {
  /* 全局布局样式 */
  position: relative;
}

.middle-pane {
  width: var(--easy-middle-pane-width, 350px);
  min-width: var(--easy-middle-pane-width, 350px);
}

.main-content-area {
  /* 窗口已使用系统原生标题栏，内容直接顶到窗口边缘 */
  position: relative;
}

/* Remove dynamic padding class definition if no longer used */
/*
.pt-\[36px\] {
    padding-top: 36px;
}
*/
</style>
