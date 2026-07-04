<!--
Done Step renders the final import report summary.
Boundary: pure presentation; starting another import is handled by app.vue.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { Alert, Button, Icon } from '@kisaki3/extension-ui-vue'
import type { VniteDoneSummaryDto } from '../../../shared/import-wizard'
import StatCards, { type StatCard } from './stat-cards.vue'

interface Props {
  summary: VniteDoneSummaryDto | null
  diagnosticsTotal: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  openDiagnostics: []
}>()

const statusAlert = computed(() => {
  switch (props.summary?.status) {
    case 'completed':
      return { variant: 'success' as const, text: `已从 ${props.summary.fileName} 完成导入。` }
    case 'cancelled':
      return { variant: 'warning' as const, text: '导入已取消，已完成的部分不会回滚。' }
    case 'failed':
      return { variant: 'destructive' as const, text: '导入失败，详情见诊断列表。' }
    default:
      return null
  }
})

const stats = computed<readonly StatCard[]>(() => {
  const summary = props.summary
  if (!summary) {
    return []
  }

  return [
    { label: '新增', value: summary.created, tone: 'success' },
    { label: '更新', value: summary.updated },
    { label: '补全成功', value: summary.completionCompleted },
    { label: '补全失败', value: summary.completionFailed, tone: 'warning' },
    { label: '错误', value: summary.errors, tone: 'destructive' },
    { label: '警告', value: summary.warnings, tone: 'warning' }
  ]
})
</script>

<template>
  <div class="space-y-4">
    <template v-if="props.summary">
      <Alert
        v-if="statusAlert"
        :variant="statusAlert.variant"
      >
        {{ statusAlert.text }}
      </Alert>

      <StatCards :stats="stats" />

      <section class="rounded-md border border-border">
        <div class="flex items-center justify-between gap-3 px-3 py-2">
          <div class="min-w-0">
            <h3 class="text-sm font-medium">诊断</h3>
            <p class="text-xs text-muted-foreground">
              {{
                props.diagnosticsTotal > 0
                  ? `需要处理 ${props.diagnosticsTotal} 项`
                  : '没有需要处理的诊断'
              }}
            </p>
          </div>
          <Button
            v-if="props.diagnosticsTotal > 0"
            variant="outline"
            type="button"
            @click="emit('openDiagnostics')"
          >
            <Icon
              icon="icon-[mdi--text-search]"
              class="size-3.5"
            />
            查看诊断
          </Button>
        </div>
      </section>
    </template>

    <Alert v-else>导入任务已结束。</Alert>
  </div>
</template>
