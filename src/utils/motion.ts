import { computed, ref } from 'vue';
import { useUserPreferences } from '@/store/useUserPreferences';

/**
 * 统一的动效参数与「减少动画」判断。
 *
 * - 时长：fast 用于悬停/小元素，base 用于展开收起、面板，slow 是上限。
 * - 曲线：进入用减速（easeOut），离开用加速（easeIn），不再使用会回弹的曲线。
 * - 减少动画：应用内开关 **或** 系统设置（Windows「设置 → 辅助功能 → 视觉效果 → 动画效果」关闭时）任一生效即可。
 *   CSS 动画由 global.css 统一处理；这里负责 JS 驱动的动画（树展开、SortableJS 拖拽）。
 */
export const MOTION = {
  fast: 120,
  base: 180,
  slow: 240,
  easeOut: 'cubic-bezier(0.2, 0, 0, 1)',
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
} as const;

/** 系统级「减少动画」偏好，全局只监听一次。 */
const systemReducedMotion = ref(false);
if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  systemReducedMotion.value = query.matches;
  query.addEventListener?.('change', (event) => {
    systemReducedMotion.value = event.matches;
  });
}

/** 非响应式的即时判断，供动画钩子在触发瞬间使用。 */
export function isReducedMotion(): boolean {
  if (systemReducedMotion.value) return true;
  return typeof document !== 'undefined' && document.documentElement.dataset.reduceMotion === 'true';
}

/** 响应式版本，供模板绑定（例如 SortableJS 的 animation 时长）。 */
export function useReducedMotion() {
  const preferences = useUserPreferences();
  return computed(() => systemReducedMotion.value || preferences.preferences.reduceMotion);
}

// ---------------------------------------------------------------------------
// 树节点展开 / 收起
//
// 以前用 max-height: 0 → 1000px 的 CSS 过渡：
//   1. 子项超过 1000px 的文件在动画过程中被截断，结束时才「跳」出剩余内容；
//   2. 收起时先要从 1000px 缩到实际高度才看得到变化，内容少时会有明显的停顿；
//   3. transition: all 还会把其他属性一起过渡。
// 现在按实际内容高度用 Web Animations API 做一次精确的高度 + 透明度动画，结束后恢复 auto 高度。
// 内容特别高（几百条片段）时只做淡入淡出，避免每帧重排整棵树；
// 同一帧内大量节点同时展开（搜索自动展开、全部展开）时直接跳过动画。
// ---------------------------------------------------------------------------

const MAX_ANIMATED_HEIGHT = 1600;
const MAX_ANIMATIONS_PER_FRAME = 4;

const running = new WeakMap<Element, Animation>();
let startedThisFrame = 0;
let frameResetScheduled = false;

function countStartInFrame(): number {
  startedThisFrame += 1;
  if (!frameResetScheduled) {
    frameResetScheduled = true;
    requestAnimationFrame(() => {
      startedThisFrame = 0;
      frameResetScheduled = false;
    });
  }
  return startedThisFrame;
}

export function animateCollapse(el: Element, done: () => void, direction: 'enter' | 'leave'): void {
  const node = el as HTMLElement;
  running.get(node)?.cancel();

  if (
    isReducedMotion()
    || typeof node.animate !== 'function'
    || countStartInFrame() > MAX_ANIMATIONS_PER_FRAME
  ) {
    done();
    return;
  }

  const height = node.scrollHeight;
  const fadeOnly = height === 0 || height > MAX_ANIMATED_HEIGHT;
  // 高度越大时长略长，但限制在 140–240ms 之间，短列表不会显得拖沓。
  const duration = fadeOnly ? MOTION.fast : Math.round(Math.min(MOTION.slow, 140 + height / 10));
  const frames: Keyframe[] = fadeOnly
    ? [{ opacity: 0 }, { opacity: 1 }]
    : [
        { height: '0px', opacity: 0 },
        { height: `${height}px`, opacity: 1 },
      ];
  if (direction === 'leave') frames.reverse();

  const previousOverflow = node.style.overflow;
  node.style.overflow = 'hidden';
  const animation = node.animate(frames, {
    duration: direction === 'leave' ? Math.round(duration * 0.8) : duration,
    easing: direction === 'enter' ? MOTION.easeOut : MOTION.easeIn,
    // 离开动画保持最后一帧，避免元素被移除前闪回完整高度。
    fill: direction === 'leave' ? 'forwards' : 'none',
  });
  running.set(node, animation);

  let settled = false;
  const settle = () => {
    if (settled) return;
    settled = true;
    running.delete(node);
    node.style.overflow = previousOverflow;
    done();
  };
  animation.onfinish = settle;
  animation.oncancel = settle;
}

/** 展开途中又收起（或反过来）时，立刻结束旧动画。 */
export function cancelCollapseAnimation(el: Element): void {
  running.get(el)?.cancel();
}
