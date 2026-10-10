import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import i18n from './i18n' // 导入 i18n 实例
import './assets/styles/shadcn.css'
import './assets/styles/main.css'
import './assets/styles/tailwind.css'
import './assets/styles/global.css'
import './assets/styles/custom-tooltip.css'
import { toast } from 'vue-sonner'

// 创建应用实例
const app = createApp(App)

// 添加全局错误处理器
app.config.errorHandler = (err, _instance, info) => {
  console.error('Vue全局错误:', err);
  console.error('错误位置:', info);
  
  // 记录错误但不中断应用
  if (err instanceof Error) {
    console.error('错误堆栈:', err.stack);
    
    // 在开发环境中显示错误通知
    if (import.meta.env.DEV) {
      try {
        toast.error(`应用错误: ${err.message}`);
      } catch (toastError) {
        console.error('显示错误提示失败:', toastError);
      }
    }
  }
  
  // 保留当前页面，让局部 ErrorBoundary/AppLayout 展示错误。
  // 不再强制跳回片段页，否则设置/应用配置页面的轻微错误会表现为‘点了没反应’。
};

// 使用Pinia状态管理
app.use(createPinia())

// 使用路由
app.use(router)

// 使用 i18n
app.use(i18n)

// 挂载应用
app.mount('#app').$nextTick(() => {
  console.log('应用成功挂载到DOM');
  postMessage({ payload: 'removeLoading' }, '*')
})

// 监听应用初始化完成
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM加载完成，应用初始化');
});

// 添加防刷新处理，避免Electron应用中刷新导致的路径问题
window.addEventListener('keydown', (e) => {
  // 拦截F5和Ctrl+R刷新操作
  if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
    e.preventDefault()
    console.log('防止刷新，使用路由导航替代')
    // 通过路由重新导航到当前页面，而不是真正的刷新
    router.replace(router.currentRoute.value.fullPath)
  }
})

// RouterLink 由 vue-router 自己处理。
// 不在 document capture 阶段 preventDefault，否则 hash history 会把 '#/settings'
// 当成当前路由的锚点，导致设置/应用配置点击后停留在原页面。

// 捕获全局未处理的Promise错误
window.addEventListener('unhandledrejection', (event) => {
  console.error('未处理的Promise错误:', event.reason);
  
  // 在开发环境显示错误
  if (import.meta.env.DEV) {
    try {
      toast.error(`Promise错误: ${event.reason.message || '未知错误'}`);
    } catch (e) {
      // 忽略toast错误
    }
  }
});

// 捕获全局错误，避免白屏
window.addEventListener('error', (event) => {
  console.error('捕获到全局错误:', event.error || event.message)
  
  // 在开发环境显示错误提示
  if (import.meta.env.DEV) {
    try {
      toast.error('全局错误: ' + (event.error?.message || event.message || '未知错误'));
    } catch (e) {
      // 忽略toast错误
    }
  }
})

// 路由加载错误只记录并提示，不强制改写当前路由。
// AppLayout 会给用户一个明确的错误界面和返回入口。
router.onError((error) => {
  console.error('路由导航出错:', error)
  try {
    toast.error(`页面加载失败: ${error instanceof Error ? error.message : String(error)}`)
  } catch {
    // toast 不可用时仅保留控制台日志
  }
})
