<template>
  <ContextMenu>
    <ContextMenuTrigger as-child><slot /></ContextMenuTrigger>
    <ContextMenuContent class="min-w-[12rem]">
      <ContextMenuItem @select="emit('action', 'edit')">{{ t('extensionMenu.edit') }}</ContextMenuItem>
      <ContextMenuItem @select="emit('action', 'new')">{{ t('extensions.new') }}</ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem @select="emit('action', 'copy')">{{ t('extensionMenu.copy') }}</ContextMenuItem>
      <ContextMenuItem @select="emit('action', 'cut')">{{ t('extensionMenu.cut') }}</ContextMenuItem>
      <ContextMenuItem @select="emit('action', 'paste')">{{ t('extensionMenu.paste') }}</ContextMenuItem>
      <ContextMenuItem @select="emit('action', 'path')">{{ t('extensionMenu.path') }}</ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem variant="destructive" @select="emit('action', 'delete')">{{ t('extensions.form.delete') }}</ContextMenuItem>
    </ContextMenuContent>
  </ContextMenu>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu';
export type ExtensionMenuAction = 'edit' | 'new' | 'copy' | 'cut' | 'paste' | 'path' | 'delete';
const emit = defineEmits<{ action: [action: ExtensionMenuAction] }>();
const { t } = useI18n();
</script>
