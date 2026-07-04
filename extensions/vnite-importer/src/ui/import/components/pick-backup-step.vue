<!--
Pick Backup Step presents the selected Vnite archive and its host-produced
analysis. Boundary: emits file picking; it never reads archives itself.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { Alert, Button, Icon, Progress } from '@kisaki3/extension-ui-vue'
import type { VniteBackupAnalysisDto } from '../../../shared/import-wizard'
import StatCards, { type StatCard } from './stat-cards.vue'

interface Props {
  file: { name: string; sizeBytes: number } | null
  analysis: VniteBackupAnalysisDto | null
  busy: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  pick: []
  openDiagnostics: []
}>()

const analysisStats = computed<readonly StatCard[]>(() => {
  const analysis = props.analysis
  if (!analysis) {
    return []
  }

  return [
    { label: '游戏', value: analysis.gamesTotal },
    { label: '启动配置', value: analysis.localGamesTotal },
    { label: '合集', value: analysis.collectionsTotal },
    { label: '附件', value: analysis.attachmentsTotal },
    {
      label: '诊断',
      value: analysis.diagnostics.errors + analysis.diagnostics.warnings,
      tone: 'warning'
    }
  ]
})

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`
  }

  const units = ['KB', 'MB', 'GB'] as const
  let current = value / 1024
  for (const unit of units) {
    if (current < 1024 || unit === 'GB') {
      return `${current.toFixed(current >= 10 ? 0 : 1)} ${unit}`
    }
    current /= 1024
  }

  return `${value} B`
}
</script>

<template>
  <div class="space-y-4">
    <section class="overflow-hidden rounded-md border border-border">
      <div class="flex min-w-0 items-center gap-3 border-b border-border bg-surface/60 px-3 py-2">
        <div
          class="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background"
        >
          <Icon
            icon="icon-[mdi--archive-outline]"
            class="size-4 text-muted-foreground"
          />
        </div>
        <div class="min-w-0 flex-1">
          <div
            class="truncate text-sm font-medium"
            :class="props.file ? 'text-foreground' : 'text-muted-foreground'"
          >
            {{ props.file ? props.file.name : '尚未选择 Vnite 备份包' }}
          </div>
          <div class="truncate text-xs text-muted-foreground">
            {{ props.file ? formatBytes(props.file.sizeBytes) : '支持 Vnite 导出的 zip 备份包' }}
          </div>
        </div>
        <Button
          variant="outline"
          type="button"
          :disabled="props.busy"
          @click="emit('pick')"
        >
          <Icon
            icon="icon-[mdi--folder-open-outline]"
            class="size-3.5"
          />
          {{ props.file ? '更换' : '选择' }}
        </Button>
      </div>

      <div
        v-if="!props.analysis"
        class="px-3 py-8 text-center text-sm text-muted-foreground"
      >
        选择备份包后会在这里显示内容摘要、字段覆盖率和诊断结果。
      </div>

      <div
        v-else
        class="space-y-4 p-3"
      >
        <StatCards :stats="analysisStats" />
        <p class="text-xs text-muted-foreground">
          启动配置包含启动器、游戏目录和存档路径等 Vnite 本地游戏信息。
        </p>

        <section class="space-y-2">
          <div class="flex items-center justify-between gap-3">
            <h3 class="text-sm font-medium">字段覆盖率</h3>
            <span class="text-xs text-muted-foreground">
              {{ props.analysis.coverage.length }} 个关键字段
            </span>
          </div>
          <div class="divide-y divide-border rounded-md border border-border">
            <div
              v-for="item in props.analysis.coverage"
              :key="item.key"
              class="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 px-3 py-2"
            >
              <span class="truncate text-sm">{{ item.label }}</span>
              <Progress
                :model-value="item.percent"
                class="h-1.5"
              />
              <span class="w-20 text-right text-xs tabular-nums text-muted-foreground">
                {{ item.present }}/{{ item.total }}
              </span>
            </div>
          </div>
        </section>

        <Alert
          v-if="props.analysis.diagnostics.errors > 0"
          variant="destructive"
        >
          <span class="inline-flex items-center justify-between gap-3">
            <span
              >备份分析发现
              {{ props.analysis.diagnostics.errors }} 个错误，生成预览前建议先查看诊断。</span
            >
            <Button
              variant="text"
              size="xs"
              type="button"
              @click="emit('openDiagnostics')"
            >
              查看诊断
            </Button>
          </span>
        </Alert>
        <Alert
          v-else-if="props.analysis.diagnostics.warnings > 0"
          variant="warning"
        >
          <span class="inline-flex items-center justify-between gap-3">
            <span
              >备份分析发现
              {{ props.analysis.diagnostics.warnings }} 个警告，导入时会尽量跳过受影响项目。</span
            >
            <Button
              variant="text"
              size="xs"
              type="button"
              @click="emit('openDiagnostics')"
            >
              查看诊断
            </Button>
          </span>
        </Alert>
      </div>
    </section>
  </div>
</template>
