<!--
Running Step renders live TaskRun progress pushed by the extension host.
Boundary: emits cancel requests; task ownership and cancellation authorization
stay in the host TaskRun capability.
-->
<script setup lang="ts">
import { computed } from 'vue'
import {
  Alert,
  Button,
  Icon,
  Progress,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@kisaki3/extension-ui-vue'
import type { TaskRunStatus } from '@kisaki3/extension-sdk'
import type { VniteRunDto } from '../../../shared/import-wizard'

const RUN_STATUS_LABELS: Record<TaskRunStatus, string> = {
  queued: '排队中',
  running: '运行中',
  pausing: '暂停中',
  paused: '已暂停',
  cancelling: '取消中',
  completed: '已完成',
  failed: '已失败',
  cancelled: '已取消'
}

const PHASES: readonly { key: string; label: string }[] = [
  { key: 'extracting', label: '解压备份' },
  { key: 'reading', label: '读取数据' },
  { key: 'buildingGraph', label: '构建计划' },
  { key: 'attachments', label: '准备附件' },
  { key: 'writing', label: '写入资料库' },
  { key: 'completion', label: '元数据补全' },
  { key: 'cleanup', label: '清理' },
  { key: 'finished', label: '完成' }
]

const COUNTER_LABELS: Record<string, string> = {
  gamesTotal: '游戏总数',
  gamesCreated: '新增游戏',
  gamesUpdated: '更新游戏',
  gamesSkipped: '跳过游戏',
  gamesFailed: '失败游戏',
  collectionsCreated: '新增合集',
  collectionsUpdated: '更新合集',
  attachmentsImported: '导入附件',
  attachmentsFailed: '附件失败',
  completionCompleted: '补全成功',
  completionFailed: '补全失败',
  errors: '错误',
  warnings: '警告'
}

interface Props {
  run: VniteRunDto | null
  busy: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  cancel: []
}>()

const statusText = computed(() => {
  const run = props.run
  if (!run) {
    return RUN_STATUS_LABELS.running
  }

  return run.phaseLabel ?? RUN_STATUS_LABELS[run.status]
})

const progressValue = computed(() => props.run?.work?.percent ?? 0)
const hasDeterminateProgress = computed(
  () => props.run?.work?.percent !== undefined && props.run.work.indeterminate !== true
)
const isCancelling = computed(() => props.run?.status === 'cancelling')

const currentPhaseIndex = computed(() => {
  const key = props.run?.phaseKey
  return key ? PHASES.findIndex((phase) => phase.key === key) : -1
})

const counterRows = computed(() =>
  Object.entries(props.run?.counters ?? {})
    .filter(([, value]) => value !== 0)
    .map(([key, value]) => ({
      key,
      label: COUNTER_LABELS[key] ?? key,
      value
    }))
)
</script>

<template>
  <div class="space-y-4">
    <section class="rounded-md border border-border">
      <div
        class="flex items-center justify-between gap-3 border-b border-border bg-surface/60 px-3 py-2"
      >
        <div class="flex min-w-0 items-center gap-2">
          <Spinner
            v-if="!isCancelling"
            class="size-4 text-primary"
          />
          <Icon
            v-else
            icon="icon-[mdi--cancel]"
            class="size-4 text-warning"
          />
          <div class="min-w-0">
            <div class="truncate text-sm font-medium">{{ statusText }}</div>
            <div class="truncate text-xs text-muted-foreground">
              {{ isCancelling ? '正在等待导入任务安全停止' : '导入任务正在后台运行' }}
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          type="button"
          :disabled="props.busy || !props.run?.canCancel"
          @click="emit('cancel')"
        >
          <Spinner v-if="props.busy" />
          <Icon
            v-else
            icon="icon-[mdi--stop-circle-outline]"
            class="size-3.5"
          />
          {{ isCancelling ? '取消中' : '取消导入' }}
        </Button>
      </div>

      <div class="space-y-3 p-3">
        <Progress
          v-if="hasDeterminateProgress"
          :model-value="progressValue"
        />
        <div
          v-else
          class="h-1.5 overflow-hidden rounded-full bg-muted"
        >
          <div class="h-full w-1/3 animate-pulse rounded-full bg-primary/70" />
        </div>

        <div class="grid grid-cols-4 gap-2">
          <div
            v-for="(phase, index) in PHASES"
            :key="phase.key"
            class="flex items-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-xs"
            :class="index <= currentPhaseIndex ? 'text-foreground' : 'text-muted-foreground'"
          >
            <Icon
              :icon="
                index < currentPhaseIndex
                  ? 'icon-[mdi--check]'
                  : index === currentPhaseIndex
                    ? 'icon-[mdi--progress-clock]'
                    : 'icon-[mdi--circle-outline]'
              "
              class="size-3.5 shrink-0"
            />
            <span class="truncate">{{ phase.label }}</span>
          </div>
        </div>
      </div>
    </section>

    <Alert variant="info"> 取消请求会在安全检查点生效；已写入的资料不会自动回滚。 </Alert>

    <section
      v-if="counterRows.length > 0"
      class="overflow-hidden rounded-md border border-border"
    >
      <div class="border-b border-border bg-surface/60 px-3 py-2">
        <h3 class="text-sm font-medium">实时计数</h3>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="pl-3">项目</TableHead>
            <TableHead class="text-right">数量</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="row in counterRows"
            :key="row.key"
          >
            <TableCell class="pl-3">{{ row.label }}</TableCell>
            <TableCell class="text-right tabular-nums">{{ row.value }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </section>
  </div>
</template>
