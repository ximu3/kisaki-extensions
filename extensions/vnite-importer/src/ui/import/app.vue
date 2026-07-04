<!--
Vnite Import Wizard App coordinates host state, local import drafts, and the
dialog workspace shell. Boundary: all durable flow state and file access stay
in the extension host; this document renders DTOs and sends explicit actions.
-->
<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Alert, Button, Icon, Spinner } from '@kisaki3/extension-ui-vue'
import type {
  VniteImportFieldSelection,
  VniteImportOptionsForm,
  VnitePreviewQueryDto,
  VniteWizardState
} from '../../shared/import-wizard'
import { cloneFieldSelection, countSelectedFields, countTotalFields } from './fields'
import { host, onHostStateChanged, toErrorMessage } from './rpc'
import StepIndicator from './components/step-indicator.vue'
import PickBackupStep from './components/pick-backup-step.vue'
import ConfigStep from './components/config-step.vue'
import PreviewStep from './components/preview-step.vue'
import RunningStep from './components/running-step.vue'
import DoneStep from './components/done-step.vue'
import DiagnosticsDialog from './components/diagnostics-dialog.vue'

type BusyAction = 'load' | 'pick' | 'next' | 'back' | 'reset' | 'preview' | 'start' | 'cancel'

const STEPS: readonly {
  key: VniteWizardState['step']
  label: string
  description: string
  icon: string
}[] = [
  {
    key: 'pickBackup',
    label: '备份',
    description: '选择并分析文件',
    icon: 'icon-[mdi--archive-outline]'
  },
  {
    key: 'config',
    label: '范围',
    description: '字段与策略',
    icon: 'icon-[mdi--tune-variant]'
  },
  {
    key: 'preview',
    label: '预览',
    description: '审阅写入计划',
    icon: 'icon-[mdi--table-search]'
  },
  {
    key: 'running',
    label: '导入',
    description: '执行与取消',
    icon: 'icon-[mdi--progress-upload]'
  },
  {
    key: 'done',
    label: '结果',
    description: '报告与诊断',
    icon: 'icon-[mdi--clipboard-check-outline]'
  }
]

const state = ref<VniteWizardState | null>(null)
const fieldSelectionDraft = ref<VniteImportFieldSelection | null>(null)
const options = reactive<VniteImportOptionsForm>({
  completeMetadata: false,
  scraperProfileId: '',
  completionSurfacePreset: 'missingCoreAndMedia',
  completionSurfaces: [],
  conflictMode: 'mergeSelected',
  strictAttachments: false
})
const busyAction = ref<BusyAction | null>('load')
const previewQueryBusy = ref(false)
const loading = ref(true)
const error = ref<string | null>(null)
const diagnosticsOpen = ref(false)

const busy = computed(() => busyAction.value !== null || previewQueryBusy.value)
const stepIndex = computed(() =>
  state.value ? STEPS.findIndex((step) => step.key === state.value?.step) : 0
)
const totalFieldCount = countTotalFields()
const selectedFieldCount = computed(() =>
  fieldSelectionDraft.value ? countSelectedFields(fieldSelectionDraft.value) : 0
)
const optionsModel = computed<VniteImportOptionsForm>({
  get: () => options,
  set: (next) => {
    Object.assign(options, next)
  }
})
const fieldSelectionModel = computed<VniteImportFieldSelection>({
  get: () => {
    if (!fieldSelectionDraft.value) {
      throw new Error('导入字段尚未准备好。')
    }

    return fieldSelectionDraft.value
  },
  set: (next) => {
    fieldSelectionDraft.value = next
  }
})

const submitLabel = computed(() => {
  const current = state.value
  if (!current) {
    return undefined
  }

  switch (current.step) {
    case 'pickBackup':
      return current.file ? '继续配置' : '选择备份包'
    case 'config':
      return '生成预览'
    case 'preview':
      return '开始导入'
    case 'done':
      return '导入另一个备份包'
    case 'running':
      return undefined
  }

  return undefined
})

const submitDisabled = computed(() => {
  const current = state.value
  if (!current || busy.value) {
    return true
  }

  if (current.step === 'config') {
    return selectedFieldCount.value === 0
  }

  return false
})

onHostStateChanged((next) => {
  state.value = next
  if (next.step !== 'config' || !fieldSelectionDraft.value) {
    syncDraft(next)
  }
})

onMounted(() => {
  void runHostAction('load', () => host.getState())
})

function syncDraft(next: VniteWizardState): void {
  Object.assign(options, next.options)
  fieldSelectionDraft.value = cloneFieldSelection(next.fieldSelection)
}

function applyState(next: VniteWizardState, options?: { preserveDraft?: boolean }): void {
  state.value = next
  if (!options?.preserveDraft) {
    syncDraft(next)
  }
}

async function runHostAction(
  actionName: BusyAction,
  action: () => Promise<VniteWizardState>,
  options?: { preserveDraft?: boolean }
): Promise<void> {
  if (busyAction.value && busyAction.value !== 'load') {
    return
  }

  busyAction.value = actionName
  error.value = null
  try {
    applyState(await action(), options)
  } catch (cause) {
    error.value = toErrorMessage(cause)
  } finally {
    busyAction.value = null
    loading.value = false
  }
}

function submit(): void {
  const current = state.value
  if (!current) {
    return
  }

  switch (current.step) {
    case 'pickBackup':
      if (current.file) {
        void runHostAction('next', () => host.goToConfig())
      } else {
        void runHostAction('pick', () => host.pickBackupFile())
      }
      return
    case 'config':
      void runHostAction('preview', () =>
        host.generatePreview(snapshotOptions(), snapshotFieldSelection())
      )
      return
    case 'preview':
      void runHostAction('start', () =>
        host.startImport(snapshotOptions(), snapshotFieldSelection())
      )
      return
    case 'done':
      void runHostAction('reset', () => host.resetFlow())
      return
    case 'running':
      return
  }
}

function resetFlow(): void {
  void runHostAction('reset', () => host.resetFlow())
}

function backToConfig(): void {
  void runHostAction('back', () => host.backToConfig(), { preserveDraft: true })
}

function cancelImport(): void {
  void runHostAction('cancel', () => host.cancelImport(), { preserveDraft: true })
}

async function setPreviewQuery(query: VnitePreviewQueryDto): Promise<void> {
  if (busyAction.value || previewQueryBusy.value) {
    return
  }

  previewQueryBusy.value = true
  error.value = null
  try {
    applyState(await host.setPreviewQuery(query), { preserveDraft: true })
  } catch (cause) {
    error.value = toErrorMessage(cause)
  } finally {
    previewQueryBusy.value = false
  }
}

function snapshotOptions(): VniteImportOptionsForm {
  return { ...options, completionSurfaces: [...options.completionSurfaces] }
}

function snapshotFieldSelection(): VniteImportFieldSelection {
  const current = fieldSelectionDraft.value ?? state.value?.fieldSelection
  if (!current) {
    throw new Error('导入字段尚未准备好。')
  }

  return cloneFieldSelection(current)
}
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-background text-foreground">
    <aside class="w-48 shrink-0 border-r border-border bg-surface/60 p-2">
      <StepIndicator
        :steps="STEPS"
        :current-index="stepIndex"
      />
    </aside>

    <section class="flex min-w-0 flex-1 flex-col">
      <header
        class="flex min-h-14 items-center justify-between gap-3 border-b border-border px-4 py-2"
      >
        <div class="min-w-0">
          <div class="truncate text-sm font-medium">
            {{ state?.file?.name ?? 'Vnite 备份导入' }}
          </div>
          <div class="truncate text-xs text-muted-foreground">
            {{
              state?.analysis
                ? `${state.analysis.gamesTotal} 个游戏 / ${state.analysis.attachmentsTotal} 个附件`
                : '选择备份、配置范围、预览写入计划，然后开始导入'
            }}
          </div>
        </div>
        <Button
          v-if="state?.diagnosticsTotal"
          variant="outline"
          size="sm"
          type="button"
          @click="diagnosticsOpen = true"
        >
          <Icon
            icon="icon-[mdi--alert-outline]"
            class="size-3.5"
          />
          诊断 {{ state.diagnosticsTotal }}
        </Button>
      </header>

      <main
        v-if="state"
        class="min-h-0 flex-1 overflow-y-auto px-4 py-3"
      >
        <div class="mx-auto max-w-5xl space-y-3">
          <Alert
            v-if="error"
            variant="destructive"
          >
            {{ error }}
          </Alert>

          <PickBackupStep
            v-if="state.step === 'pickBackup'"
            :file="state.file"
            :analysis="state.analysis"
            :busy="busyAction === 'pick'"
            @pick="() => void runHostAction('pick', () => host.pickBackupFile())"
            @open-diagnostics="diagnosticsOpen = true"
          />

          <ConfigStep
            v-else-if="state.step === 'config' && fieldSelectionDraft"
            v-model:options="optionsModel"
            v-model:field-selection="fieldSelectionModel"
            :profiles="state.profiles"
            :selected-field-count="selectedFieldCount"
            :total-field-count="totalFieldCount"
          />

          <PreviewStep
            v-else-if="state.step === 'preview' && state.preview"
            :preview="state.preview"
            :busy="previewQueryBusy"
            @query-change="(query) => void setPreviewQuery(query)"
          />

          <RunningStep
            v-else-if="state.step === 'running'"
            :run="state.run"
            :busy="busyAction === 'cancel'"
            @cancel="cancelImport"
          />

          <DoneStep
            v-else-if="state.step === 'done'"
            :summary="state.doneSummary"
            :diagnostics-total="state.diagnosticsTotal"
            @open-diagnostics="diagnosticsOpen = true"
          />
        </div>
      </main>

      <main
        v-else
        class="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground"
      >
        <Spinner v-if="loading" />
        {{ loading ? '正在加载导入器…' : '导入器不可用' }}
      </main>

      <footer
        v-if="state"
        class="flex shrink-0 items-center gap-2 border-t border-border px-4 py-2.5"
      >
        <Button
          v-if="state.step === 'config' || state.step === 'preview'"
          variant="outline"
          type="button"
          :disabled="busy"
          @click="resetFlow"
        >
          <Icon
            icon="icon-[mdi--archive-sync-outline]"
            class="size-3.5"
          />
          重新选择
        </Button>
        <Button
          v-if="state.step === 'preview'"
          variant="outline"
          type="button"
          :disabled="busy"
          @click="backToConfig"
        >
          <Icon
            icon="icon-[mdi--arrow-left]"
            class="size-3.5"
          />
          返回修改
        </Button>
        <span class="flex-1" />
        <Button
          v-if="submitLabel"
          type="button"
          :disabled="submitDisabled"
          @click="submit"
        >
          <Spinner v-if="busy && busyAction !== 'cancel'" />
          {{ busy && busyAction !== 'cancel' ? '处理中…' : submitLabel }}
        </Button>
      </footer>
    </section>

    <DiagnosticsDialog
      v-if="state"
      v-model:open="diagnosticsOpen"
      :diagnostics="state.diagnostics"
      :total="state.diagnosticsTotal"
    />
  </div>
</template>
