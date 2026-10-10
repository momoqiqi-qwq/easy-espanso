import type { Match } from '@/types/core/espanso.types';

/**
 * 生成片段的内容预览文本，用于列表项的第二行。
 * 优先取 replace，再按内容类型回退到 markdown / html / image_path / form，
 * 这样非纯文本片段（应用专用片段里常见）也有预览，而不是空白。
 */
export function getContentPreview(item: Match | null | undefined, maxLength = 100): string {
  if (!item) return '';
  // 用 || 而不是 ??:空字符串的 replace 也应该回退到 markdown/html 等
  const raw =
    item.replace ||
    item.markdown ||
    item.html ||
    item.image_path ||
    (typeof item.form === 'string' ? item.form : '') ||
    '';
  if (!raw) return '';
  const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
  return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
}
