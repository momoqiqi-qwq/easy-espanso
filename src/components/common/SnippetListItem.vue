<template>
  <div
    :class="[
      'group cursor-pointer border-l-2 rounded-md mb-2.5 transition-all bg-card shadow-xs border border-border/30',
      selected
        ? 'border-l-primary shadow-sm bg-accent/10 border-primary/20'
        : 'border-l-transparent hover:border-l-primary/40 hover:shadow-sm hover:bg-accent/5 hover:border-border/60',
    ]"
    @click="emit('select')"
  >
    <div class="py-2.5 px-3">
      <div class="flex items-center gap-2">
        <div class="flex-1 min-w-0">
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-2 flex-wrap">
              <h3 class="text-sm font-medium" :class="selected ? 'text-primary' : 'text-foreground'">
                <HighlightText v-if="searchQuery" :text="trigger" :searchQuery="searchQuery" />
                <template v-else>{{ trigger }}</template>
              </h3>
              <div
                v-if="label"
                class="text-xs px-1.5 rounded truncate max-w-[120px]"
                :class="selected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'"
              >
                {{ label }}
              </div>
            </div>
            <div
              v-if="secondary"
              class="text-xs"
              :class="selected ? 'text-foreground/90' : 'text-muted-foreground'"
            >
              {{ secondary }}
            </div>
          </div>
        </div>

        <div v-if="tags && tags.length" class="flex gap-1 flex-wrap justify-end flex-shrink-0">
          <Badge
            v-for="tag in tags"
            :key="tag"
            variant="outline"
            class="text-xs border-0 bg-muted/50 px-1.5 py-0 whitespace-nowrap"
            @click.stop="emit('tag-click', tag)"
          >
            {{ tag }}
          </Badge>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Badge } from '@/components/ui/badge';
import HighlightText from './HighlightText.vue';

withDefaults(
  defineProps<{
    trigger: string;
    label?: string;
    /** 第二行：描述或内容预览 */
    secondary?: string;
    selected?: boolean;
    tags?: string[];
    searchQuery?: string;
  }>(),
  {
    label: '',
    secondary: '',
    selected: false,
    tags: () => [],
    searchQuery: '',
  },
);

const emit = defineEmits<{
  (e: 'select'): void;
  (e: 'tag-click', tag: string): void;
}>();
</script>
