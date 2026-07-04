<!--
Preview Step renders the host-computed write plan as a searchable review table.
Boundary: displays preview DTOs only; starting the import is owned by app.vue.
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Icon,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  type BadgeVariants
} from '@kisaki3/extension-ui-vue'
import type {
  VnitePreviewActionFilterDto,
  VnitePreviewDto,
  VnitePreviewQueryDto,
  VnitePreviewRowDto,
  VnitePreviewSectionDto
} from '../../../shared/import-wizard'
import StatCards, { type StatCard } from './stat-cards.vue'

interface DetailFieldRow {
  label: string
  current: string | undefined
  incoming: string | undefined
}

interface Props {
  preview: VnitePreviewDto
  busy?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  queryChange: [query: VnitePreviewQueryDto]
}>()

const searchDraft = ref<string | number>(props.preview.query.search)
const pageDraft = ref<string | number>(props.preview.pagination.page)
const selectedRow = ref<VnitePreviewRowDto | null>(null)

const detailOpen = computed({
  get: () => selectedRow.value !== null,
  set: (open) => {
    if (!open) {
      selectedRow.value = null
    }
  }
})

const FILTERS: readonly { value: VnitePreviewActionFilterDto; label: string }[] = [
  { value: 'all', label: '全部动作' },
  { value: 'create', label: '新增' },
  { value: 'update', label: '更新' },
  { value: 'skip', label: '跳过' },
  { value: 'fail', label: '失败' }
]

const stats = computed<readonly StatCard[]>(() => [
  { label: '新增', value: props.preview.summary.created, tone: 'success' },
  { label: '更新', value: props.preview.summary.updated },
  { label: '跳过', value: props.preview.summary.skipped, tone: 'warning' },
  { label: '错误', value: props.preview.summary.errors, tone: 'destructive' },
  { label: '警告', value: props.preview.summary.warnings, tone: 'warning' }
])

const pageLabel = computed(() => {
  const pagination = props.preview.pagination
  if (pagination.filteredRowsTotal === 0) {
    return pagination.allRowsTotal === 0 ? '共 0 个游戏' : '无匹配结果'
  }

  const range = `${pagination.firstRow}-${pagination.lastRow}`
  if (pagination.filteredRowsTotal === pagination.allRowsTotal) {
    return `${range} / ${pagination.allRowsTotal} 个游戏`
  }

  return `${range} / ${pagination.filteredRowsTotal} 个匹配（共 ${pagination.allRowsTotal}）`
})

const canGoPrevious = computed(() => props.preview.pagination.page > 1)
const canGoNext = computed(
  () => props.preview.pagination.page < props.preview.pagination.pagesTotal
)

watch(
  () => [
    props.preview.query.search,
    props.preview.pagination.page,
    props.preview.query.action,
    props.preview.query.pageSize
  ],
  ([search, page]) => {
    searchDraft.value = search
    pageDraft.value = page
    selectedRow.value = null
  }
)

function actionLabel(action: VnitePreviewRowDto['action']): string {
  switch (action) {
    case 'create':
      return '新增'
    case 'update':
      return '更新'
    case 'skip':
      return '跳过'
    case 'fail':
      return '失败'
  }
}

function actionVariant(action: VnitePreviewRowDto['action']): BadgeVariants['variant'] {
  switch (action) {
    case 'create':
      return 'success'
    case 'update':
      return 'default'
    case 'skip':
      return 'secondary'
    case 'fail':
      return 'destructive'
  }
}

function diagnosticsLabel(row: VnitePreviewRowDto): string {
  const total = row.diagnostics.errors + row.diagnostics.warnings
  return total > 0 ? `${total} 项` : '-'
}

function diagnosticLevelVariant(level: string): BadgeVariants['variant'] {
  if (level === '错误' || level === 'Error') {
    return 'destructive'
  }

  if (level === '警告' || level === 'Warning') {
    return 'warning'
  }

  return 'secondary'
}

function openDetails(row: VnitePreviewRowDto): void {
  selectedRow.value = row
}

function writtenFieldCount(row: VnitePreviewRowDto): number {
  return row.sections.reduce((sum, section) => sum + section.incoming.length, 0)
}

function writtenFieldLabel(row: VnitePreviewRowDto): string {
  const count = writtenFieldCount(row)
  return count > 0 ? `${count} 个字段` : '无字段写入'
}

function visibleSections(row: VnitePreviewRowDto): readonly VnitePreviewSectionDto[] {
  return row.sections.filter((section) => section.current.length > 0 || section.incoming.length > 0)
}

function detailRows(section: VnitePreviewSectionDto): readonly DetailFieldRow[] {
  const labels = new Set([
    ...section.current.map((field) => field.label),
    ...section.incoming.map((field) => field.label)
  ])

  return [...labels].map((label) => ({
    label,
    current: section.current.find((field) => field.label === label)?.value,
    incoming: section.incoming.find((field) => field.label === label)?.value
  }))
}

function hasCurrentValues(row: VnitePreviewRowDto): boolean {
  return row.sections.some((section) => section.current.length > 0)
}

function detailEmptyMessage(row: VnitePreviewRowDto): string {
  return row.action === 'skip' ? '该项目不会写入字段。' : '没有可展示的字段。'
}

function detailStatusText(row: VnitePreviewRowDto): string {
  return [
    writtenFieldLabel(row),
    diagnosticsLabel(row) !== '-' ? `诊断 ${diagnosticsLabel(row)}` : undefined
  ]
    .filter(Boolean)
    .join(' · ')
}

function requestQuery(query: Partial<VnitePreviewQueryDto>): void {
  emit('queryChange', {
    ...props.preview.query,
    ...query
  })
}

function setAction(action: VnitePreviewActionFilterDto): void {
  requestQuery({ action, page: 1 })
}

function applySearch(): void {
  requestQuery({ search: String(searchDraft.value).trim(), page: 1 })
}

function goToPage(page: number): void {
  requestQuery({ page })
}

function applyPageDraft(): void {
  const page = Number(pageDraft.value)
  if (!Number.isFinite(page)) {
    pageDraft.value = props.preview.pagination.page
    return
  }

  goToPage(Math.trunc(page))
}
</script>

<template>
  <div class="space-y-4">
    <StatCards :stats="stats" />

    <section class="space-y-2">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-1">
          <Button
            v-for="item in FILTERS"
            :key="item.value"
            type="button"
            size="sm"
            :variant="props.preview.query.action === item.value ? 'secondary' : 'ghost'"
            :disabled="props.busy"
            @click="setAction(item.value)"
          >
            {{ item.label }}
          </Button>
        </div>
        <div class="flex min-w-0 items-center gap-2">
          <Input
            v-model="searchDraft"
            class="w-56"
            placeholder="搜索游戏或字段"
            :disabled="props.busy"
            @keydown.enter.prevent="applySearch"
          />
          <Button
            variant="outline"
            size="icon-sm"
            type="button"
            :disabled="props.busy"
            aria-label="搜索"
            title="搜索"
            @click="applySearch"
          >
            <Icon
              icon="icon-[mdi--magnify]"
              class="size-3.5"
            />
          </Button>
        </div>
      </div>

      <div class="overflow-hidden rounded-md border border-border">
        <div
          class="flex items-center justify-between border-b border-border bg-surface/60 px-3 py-2"
        >
          <h3 class="text-sm font-medium">写入预览</h3>
          <span class="text-xs text-muted-foreground">
            {{ pageLabel }}
          </span>
        </div>

        <Table class="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead class="w-20 pl-3">动作</TableHead>
              <TableHead class="min-w-0">游戏</TableHead>
              <TableHead class="w-28">写入</TableHead>
              <TableHead class="w-12 text-right pr-3">详情</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="row in props.preview.rows"
              :key="row.id"
            >
              <TableCell class="pl-3">
                <Badge :variant="actionVariant(row.action)">{{ actionLabel(row.action) }}</Badge>
              </TableCell>
              <TableCell class="min-w-0">
                <div class="max-w-[28rem] truncate font-medium leading-5">{{ row.title }}</div>
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ writtenFieldLabel(row) }}
              </TableCell>
              <TableCell class="pr-3 text-right">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  type="button"
                  aria-label="打开详情"
                  title="打开详情"
                  @click="openDetails(row)"
                >
                  <Icon
                    icon="icon-[mdi--text-box-search-outline]"
                    class="size-3.5"
                  />
                </Button>
              </TableCell>
            </TableRow>
            <TableRow v-if="props.preview.rows.length === 0">
              <TableCell
                colspan="4"
                class="py-8 text-center text-sm text-muted-foreground"
              >
                没有匹配的预览项目
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <div
          class="flex items-center justify-between border-t border-border bg-surface/40 px-3 py-2"
        >
          <span class="text-xs text-muted-foreground">
            每页 {{ props.preview.pagination.pageSize }} 个
          </span>
          <div class="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon-sm"
              type="button"
              :disabled="props.busy || !canGoPrevious"
              aria-label="第一页"
              title="第一页"
              @click="goToPage(1)"
            >
              <Icon
                icon="icon-[mdi--page-first]"
                class="size-3.5"
              />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              type="button"
              :disabled="props.busy || !canGoPrevious"
              aria-label="上一页"
              title="上一页"
              @click="goToPage(props.preview.pagination.page - 1)"
            >
              <Icon
                icon="icon-[mdi--chevron-left]"
                class="size-3.5"
              />
            </Button>
            <div class="flex items-center gap-1 text-xs text-muted-foreground">
              <span>第</span>
              <Input
                v-model="pageDraft"
                class="h-6 w-12 px-1 text-center text-xs"
                :disabled="props.busy"
                @keydown.enter.prevent="applyPageDraft"
                @blur="applyPageDraft"
              />
              <span>/ {{ props.preview.pagination.pagesTotal }} 页</span>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              type="button"
              :disabled="props.busy || !canGoNext"
              aria-label="下一页"
              title="下一页"
              @click="goToPage(props.preview.pagination.page + 1)"
            >
              <Icon
                icon="icon-[mdi--chevron-right]"
                class="size-3.5"
              />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              type="button"
              :disabled="props.busy || !canGoNext"
              aria-label="最后一页"
              title="最后一页"
              @click="goToPage(props.preview.pagination.pagesTotal)"
            >
              <Icon
                icon="icon-[mdi--page-last]"
                class="size-3.5"
              />
            </Button>
          </div>
        </div>
      </div>
    </section>

    <Dialog v-model:open="detailOpen">
      <DialogContent class="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{{ selectedRow?.title ?? '预览详情' }}</DialogTitle>
        </DialogHeader>
        <DialogBody
          v-if="selectedRow"
          class="max-h-[65vh] overflow-y-auto p-0"
        >
          <div class="space-y-2 border-b border-border px-4 py-3">
            <div class="flex min-w-0 items-center gap-2">
              <Badge :variant="actionVariant(selectedRow.action)">
                {{ actionLabel(selectedRow.action) }}
              </Badge>
            </div>
            <div class="text-xs text-muted-foreground">
              {{ detailStatusText(selectedRow) }}
            </div>
          </div>

          <section
            v-if="selectedRow.diagnosticRows.length > 0"
            class="border-b border-border"
          >
            <div class="border-b border-border bg-surface/60 px-4 py-2 text-sm font-medium">
              诊断
            </div>
            <Table class="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead class="w-20 pl-4">级别</TableHead>
                  <TableHead class="w-36">对象</TableHead>
                  <TableHead>说明</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow
                  v-for="(diagnostic, index) in selectedRow.diagnosticRows"
                  :key="index"
                >
                  <TableCell class="pl-4">
                    <Badge :variant="diagnosticLevelVariant(diagnostic.level)">
                      {{ diagnostic.level }}
                    </Badge>
                  </TableCell>
                  <TableCell class="text-muted-foreground">{{ diagnostic.subject }}</TableCell>
                  <TableCell>{{ diagnostic.message }}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </section>

          <div
            v-if="visibleSections(selectedRow).length > 0"
            class="divide-y divide-border"
          >
            <section
              v-for="section in visibleSections(selectedRow)"
              :key="section.key"
            >
              <div class="border-b border-border bg-surface/60 px-4 py-2 text-sm font-medium">
                {{ section.label }}
              </div>
              <Table class="text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead class="w-28 pl-4">字段</TableHead>
                    <TableHead v-if="hasCurrentValues(selectedRow)">现有</TableHead>
                    <TableHead>
                      {{ hasCurrentValues(selectedRow) ? '导入内容' : '内容' }}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow
                    v-for="field in detailRows(section)"
                    :key="field.label"
                  >
                    <TableCell class="pl-4 text-muted-foreground">{{ field.label }}</TableCell>
                    <TableCell
                      v-if="hasCurrentValues(selectedRow)"
                      class="text-xs text-muted-foreground"
                    >
                      {{ field.current ?? '-' }}
                    </TableCell>
                    <TableCell class="text-xs">{{ field.incoming ?? '-' }}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </section>
          </div>
          <div
            v-else
            class="px-4 py-8 text-center text-sm text-muted-foreground"
          >
            {{ detailEmptyMessage(selectedRow) }}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  </div>
</template>
