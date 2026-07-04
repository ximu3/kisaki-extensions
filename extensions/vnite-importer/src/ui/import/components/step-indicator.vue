<!--
Step Indicator renders the import workflow rail for the dialog workspace.
Boundary: presentation only; navigation and permissions stay in the app root.
-->
<script setup lang="ts">
import { Icon } from '@kisaki3/extension-ui-vue'

interface StepItem {
  key: string
  label: string
  description: string
  icon: string
}

interface Props {
  steps: readonly StepItem[]
  currentIndex: number
}

const props = defineProps<Props>()
</script>

<template>
  <ol class="space-y-1">
    <li
      v-for="(step, index) in props.steps"
      :key="step.key"
    >
      <div
        class="flex items-start gap-2 rounded-md px-2 py-2"
        :class="
          index === props.currentIndex
            ? 'bg-accent text-accent-foreground'
            : index < props.currentIndex
              ? 'text-foreground'
              : 'text-muted-foreground'
        "
      >
        <span
          class="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border"
          :class="
            index < props.currentIndex
              ? 'border-primary bg-primary text-primary-foreground'
              : index === props.currentIndex
                ? 'border-primary text-primary'
                : 'border-border'
          "
        >
          <Icon
            v-if="index < props.currentIndex"
            icon="icon-[mdi--check]"
            class="size-3.5"
          />
          <Icon
            v-else
            :icon="step.icon"
            class="size-3.5"
          />
        </span>
        <span class="min-w-0">
          <span class="block truncate text-sm font-medium">{{ step.label }}</span>
          <span class="block truncate text-xs text-muted-foreground">{{ step.description }}</span>
        </span>
      </div>
    </li>
  </ol>
</template>
