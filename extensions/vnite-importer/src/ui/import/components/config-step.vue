<!--
Config Step edits the current import scope and execution options.
Boundary: owns only local draft mutations through v-model; host persistence
happens when the app root asks for preview or import.
-->
<script setup lang="ts">
import { computed } from 'vue'
import {
  Alert,
  Button,
  Checkbox,
  Field,
  FieldContent,
  FieldGroup,
  Icon,
  Label,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch
} from '@kisaki3/extension-ui-vue'
import type { GameUpdateSurface } from '@kisaki3/extension-sdk'
import type {
  VniteImportFieldSelection,
  VniteImportOptionsForm
} from '../../../shared/import-wizard'
import { cloneFieldSelection, VNITE_FIELD_GROUPS } from '../fields'

const CONFLICT_MODE_OPTIONS = [
  { value: 'skipExisting', label: '跳过现有' },
  { value: 'mergeSelected', label: '合并缺失字段' },
  { value: 'overwriteSelected', label: '覆盖所选字段' }
] as const

const COMPLETION_PRESET_OPTIONS = [
  { value: 'missingCoreAndMedia', label: '补全缺失的核心资料与媒体' },
  { value: 'missingAll', label: '补全所有缺失字段' },
  { value: 'custom', label: '自定义字段' }
] as const

const COMPLETION_SURFACE_OPTIONS: readonly { value: GameUpdateSurface; label: string }[] = [
  { value: 'name', label: '名称' },
  { value: 'originalName', label: '原名' },
  { value: 'releaseDate', label: '发售日期' },
  { value: 'description', label: '简介' },
  { value: 'relatedSites', label: '相关网站' },
  { value: 'externalIds', label: '外部 ID' },
  { value: 'tags', label: '标签' },
  { value: 'person', label: '人员' },
  { value: 'company', label: '公司' },
  { value: 'character', label: '角色' },
  { value: 'covers', label: '封面' },
  { value: 'backdrops', label: '背景图' },
  { value: 'logos', label: 'Logo' },
  { value: 'icons', label: '图标' }
]

interface Props {
  profiles: readonly { value: string; label: string }[]
  selectedFieldCount: number
  totalFieldCount: number
}

const props = defineProps<Props>()
const options = defineModel<VniteImportOptionsForm>('options', { required: true })
const fieldSelection = defineModel<VniteImportFieldSelection>('fieldSelection', { required: true })

const completionDisabled = computed(() => props.profiles.length === 0)

function toggleSurface(surface: GameUpdateSurface, checked: boolean): void {
  const next = new Set(options.value.completionSurfaces)
  if (checked) {
    next.add(surface)
  } else {
    next.delete(surface)
  }
  options.value.completionSurfaces = [...next]
}

function toggleField(group: keyof VniteImportFieldSelection, key: string, checked: boolean): void {
  const next = cloneFieldSelection(fieldSelection.value)
  const groupDraft = next[group] as Record<string, boolean>
  groupDraft[key] = checked
  fieldSelection.value = next
}

function setGroup(group: (typeof VNITE_FIELD_GROUPS)[number], checked: boolean): void {
  const next = cloneFieldSelection(fieldSelection.value)
  const groupDraft = next[group.key] as Record<string, boolean>
  for (const item of group.items) {
    groupDraft[item.key] = checked
  }
  fieldSelection.value = next
}

function isChecked(group: keyof VniteImportFieldSelection, key: string): boolean {
  return Boolean((fieldSelection.value[group] as Record<string, boolean>)[key])
}

function countGroupSelected(group: (typeof VNITE_FIELD_GROUPS)[number]): number {
  return group.items.filter((item) => isChecked(group.key, item.key)).length
}
</script>

<template>
  <div class="space-y-4">
    <Alert
      v-if="props.profiles.length === 0"
      variant="warning"
    >
      尚未配置游戏刮削配置，无法启用元数据补全。可以先直接导入。
    </Alert>

    <section class="space-y-2">
      <header class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <h3 class="text-sm font-medium">导入字段</h3>
          <p class="text-xs text-muted-foreground">选择从备份包写入 Kisaki 资料库的字段。</p>
        </div>
        <span class="text-xs tabular-nums text-muted-foreground">
          {{ props.selectedFieldCount }}/{{ props.totalFieldCount }}
        </span>
      </header>
      <div class="divide-y divide-border rounded-md border border-border">
        <section
          v-for="group in VNITE_FIELD_GROUPS"
          :key="group.key"
          class="px-3 py-2.5"
        >
          <div class="flex min-w-0 items-start justify-between gap-3">
            <div class="min-w-0">
              <h4 class="text-sm font-medium">{{ group.label }}</h4>
            </div>
            <div class="flex shrink-0 items-center gap-1.5">
              <span class="text-xs tabular-nums text-muted-foreground">
                {{ countGroupSelected(group) }}/{{ group.items.length }}
              </span>
              <Button
                variant="text"
                size="xs"
                type="button"
                @click="setGroup(group, true)"
              >
                全选
              </Button>
              <Button
                variant="text"
                size="xs"
                type="button"
                @click="setGroup(group, false)"
              >
                清空
              </Button>
            </div>
          </div>
          <div class="mt-2 grid grid-cols-3 gap-x-3 gap-y-2.5">
            <Label
              v-for="item in group.items"
              :key="item.key"
              class="min-w-0 font-normal"
            >
              <Checkbox
                :model-value="isChecked(group.key, item.key)"
                @update:model-value="
                  (checked) => toggleField(group.key, item.key, checked === true)
                "
              />
              <span>{{ item.label }}</span>
            </Label>
          </div>
        </section>
      </div>
    </section>

    <section class="space-y-2">
      <h3 class="text-sm font-medium">写入策略</h3>
      <div class="rounded-md border border-border">
        <FieldGroup class="gap-0 divide-y divide-border">
          <Field
            orientation="horizontal"
            label="冲突策略"
            description="命中现有游戏时的写入方式。"
            class="px-3 py-2.5"
          >
            <Select v-model="options.conflictMode">
              <SelectTrigger class="min-w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="mode in CONFLICT_MODE_OPTIONS"
                  :key="mode.value"
                  :value="mode.value"
                >
                  {{ mode.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field
            orientation="horizontal"
            label="附件失败时中止"
            description="关闭时附件失败仅记录诊断。"
            class="px-3 py-2.5"
          >
            <Switch v-model="options.strictAttachments" />
          </Field>
        </FieldGroup>
      </div>
    </section>

    <section class="space-y-2">
      <h3 class="text-sm font-medium">元数据补全</h3>
      <div class="rounded-md border border-border">
        <FieldGroup class="gap-0 divide-y divide-border">
          <Field
            orientation="horizontal"
            label="启用补全"
            description="导入后使用刮削配置补全缺失资料。"
            class="px-3 py-2.5"
          >
            <Switch
              v-model="options.completeMetadata"
              :disabled="completionDisabled"
            />
          </Field>

          <Field
            v-if="options.completeMetadata"
            orientation="horizontal"
            label="刮削配置"
            class="px-3 py-2.5"
          >
            <Select v-model="options.scraperProfileId">
              <SelectTrigger class="min-w-48">
                <SelectValue placeholder="选择刮削配置" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="profile in props.profiles"
                  :key="profile.value"
                  :value="profile.value"
                >
                  {{ profile.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field
            v-if="options.completeMetadata"
            label="补全范围"
            class="px-3 py-2.5"
          >
            <RadioGroup v-model="options.completionSurfacePreset">
              <Label
                v-for="preset in COMPLETION_PRESET_OPTIONS"
                :key="preset.value"
                class="font-normal"
              >
                <RadioGroupItem :value="preset.value" />
                {{ preset.label }}
              </Label>
            </RadioGroup>
          </Field>

          <Field
            v-if="options.completeMetadata && options.completionSurfacePreset === 'custom'"
            label="自定义字段"
            class="px-3 py-2.5"
          >
            <FieldContent class="grid grid-cols-4 gap-x-3 gap-y-2.5">
              <Label
                v-for="surface in COMPLETION_SURFACE_OPTIONS"
                :key="surface.value"
                class="min-w-0 font-normal"
              >
                <Checkbox
                  :model-value="options.completionSurfaces.includes(surface.value)"
                  @update:model-value="(checked) => toggleSurface(surface.value, checked === true)"
                />
                <span>{{ surface.label }}</span>
              </Label>
            </FieldContent>
          </Field>
        </FieldGroup>
      </div>
    </section>

    <Alert variant="info">
      <span class="inline-flex items-center gap-1.5">
        <Icon
          icon="icon-[mdi--information-outline]"
          class="size-3.5"
        />
        生成预览不会写入资料库；只有确认开始导入后才会应用这些设置。
      </span>
    </Alert>
  </div>
</template>
