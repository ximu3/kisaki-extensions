<!--
Stat Cards renders compact numeric summaries in a divider-friendly grid.
Boundary: pure presentation; callers choose labels, values, and semantic tone.
-->
<script setup lang="ts">
export interface StatCard {
  label: string
  value: number | string
  /**
   * Highlights non-zero values with a semantic tone.
   */
  tone?: 'warning' | 'destructive' | 'success'
}

interface Props {
  stats: readonly StatCard[]
}

const props = defineProps<Props>()

function valueClass(stat: StatCard): string {
  if (!stat.tone || stat.value === 0) {
    return 'text-foreground'
  }

  switch (stat.tone) {
    case 'warning':
      return 'text-warning'
    case 'destructive':
      return 'text-destructive'
    case 'success':
      return 'text-success'
  }
}
</script>

<template>
  <div class="overflow-hidden rounded-md border border-border">
    <div
      class="-mt-px -ml-px grid w-[calc(100%+1px)] grid-cols-[repeat(auto-fit,minmax(7rem,1fr))]"
    >
      <div
        v-for="stat in props.stats"
        :key="stat.label"
        class="flex min-w-0 flex-col gap-0.5 border-t border-l border-border px-3 py-2"
      >
        <span class="text-xs text-muted-foreground">{{ stat.label }}</span>
        <span
          class="truncate text-lg leading-tight font-semibold"
          :class="valueClass(stat)"
        >
          {{ stat.value }}
        </span>
      </div>
    </div>
  </div>
</template>
