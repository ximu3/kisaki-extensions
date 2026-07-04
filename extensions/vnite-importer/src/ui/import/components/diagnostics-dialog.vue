<!-- Diagnostics table for preview and done steps. -->
<script setup lang="ts">
import {
  Badge,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  type BadgeVariants
} from '@kisaki3/extension-ui-vue'
import type { VniteDiagnosticRowDto } from '../../../shared/import-wizard'

interface Props {
  diagnostics: readonly VniteDiagnosticRowDto[]
  total: number
}

const props = defineProps<Props>()
const open = defineModel<boolean>('open', { required: true })

function levelVariant(level: string): BadgeVariants['variant'] {
  switch (level) {
    case '错误':
    case 'Error':
      return 'destructive'
    case '警告':
    case 'Warning':
      return 'warning'
    default:
      return 'secondary'
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-3xl">
      <DialogHeader>
        <DialogTitle>
          {{
            props.total > props.diagnostics.length
              ? `需要处理的诊断（前 ${props.diagnostics.length} / ${props.total}）`
              : '需要处理的诊断'
          }}
        </DialogTitle>
      </DialogHeader>
      <DialogBody class="max-h-[60vh] overflow-y-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="w-20 pl-4">级别</TableHead>
              <TableHead class="w-40">对象</TableHead>
              <TableHead>说明</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="(diagnostic, index) in props.diagnostics"
              :key="index"
            >
              <TableCell class="pl-4">
                <Badge :variant="levelVariant(diagnostic.level)">{{ diagnostic.level }}</Badge>
              </TableCell>
              <TableCell class="text-muted-foreground">{{ diagnostic.subject }}</TableCell>
              <TableCell>{{ diagnostic.message }}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </DialogBody>
    </DialogContent>
  </Dialog>
</template>
