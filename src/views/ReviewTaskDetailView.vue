<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { completeReviewTask, editReviewTask, getReviewTask } from '@/api/backend'
import RichTextEditor from '@/components/RichTextEditor.vue'
import {
  isScheduleMarkedCompleted,
  markScheduleCompletedForDate,
  todayDateStr,
} from '@/utils/completedToday'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const errorMessage = ref('')
const completed = ref(false)

const task = ref(null)

// 提醒时间和排期状态在保存后可能会变，用 ref 维护本地展示值
const localScheduledAt = ref('')
const localScheduleStatus = ref(null)

// ---- 编辑面板 ----
const editing = ref(false)
const editDraft = ref({ scheduledAt: '', noteUrl: '', noteContent: '' })
const editSaving = ref(false)
const editError = ref('')

const taskStatus = computed(() => {
  const t = task.value
  if (!t) return null
  const s = t.status
  if (typeof s === 'number' && !Number.isNaN(s)) return s
  const n = Number(s)
  return Number.isNaN(n) ? null : n
})

const canEdit = computed(() => {
  const s = taskStatus.value
  return s === 1 || s === 2
})

/** 提醒时间是否可修改（仅 PENDING=1 状态的排期） */
const canEditScheduleTime = computed(() => localScheduleStatus.value === 1)

const taskId = computed(() => String(route.params.taskId || ''))
const scheduleId = computed(() => {
  const v = route.query.scheduleId
  return typeof v === 'string' && v ? Number(v) : null
})
const scheduledAt = computed(() => {
  const v = route.query.scheduledAt
  return typeof v === 'string' ? v : ''
})
const canCompleteFromBackend = computed(() => {
  const v = route.query.canComplete
  if (v === 'true') return true
  if (v === 'false') return false
  return null
})
const scheduleStatus = computed(() => {
  const v = route.query.scheduleStatus
  return typeof v === 'string' && v ? Number(v) : null
})
const reminderNotifyPhase = computed(() => {
  const v = route.query.reminderNotifyPhase
  if (typeof v === 'string' && v !== '') {
    const n = Number(v)
    return Number.isNaN(n) ? null : n
  }
  return null
})

const reviewCompletedFromQuery = computed(() => route.query.reviewCompleted === 'true')

function scheduleDateKey() {
  const s = localScheduledAt.value || scheduledAt.value
  if (s && s.length >= 10) {
    const part = s.slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(part)) return part
  }
  return todayDateStr()
}

const NOTIFY_PHASE_LABEL = {
  1: '待发送通知',
  2: '发送中',
  3: '已发送通知',
  4: '发送失败',
}

const notifyPhaseLabel = computed(() => {
  const p = reminderNotifyPhase.value
  if (p == null) return ''
  return NOTIFY_PHASE_LABEL[p] ?? `阶段 ${p}`
})

function resetTips() {
  errorMessage.value = ''
}

// ---- 统一编辑面板 ----
function startEdit() {
  editError.value = ''
  const sa = localScheduledAt.value || scheduledAt.value
  editDraft.value = {
    // datetime-local 输入框格式 YYYY-MM-DDTHH:mm（去掉秒）
    scheduledAt: sa ? sa.substring(0, 16) : '',
    noteUrl: task.value?.noteUrl ?? '',
    noteContent: task.value?.noteContent ?? '',
  }
  editing.value = true
}

function cancelEdit() {
  editing.value = false
  editError.value = ''
}

async function saveEdit() {
  editError.value = ''
  try {
    editSaving.value = true
    const body = {
      noteUrl: editDraft.value.noteUrl,
      noteContent: editDraft.value.noteContent,
    }
    // 仅当有排期且排期可修改且用户填写了时间时才提交提醒时间
    if (scheduleId.value && canEditScheduleTime.value && editDraft.value.scheduledAt) {
      body.scheduleId = scheduleId.value
      body.scheduledAt = editDraft.value.scheduledAt + ':00'
    }
    const data = await editReviewTask(taskId.value, body)
    // 同步 task 数据
    task.value = { ...task.value, ...data }
    // 更新本地提醒时间展示
    if (data.scheduledAt) {
      localScheduledAt.value = data.scheduledAt
    }
    if (data.scheduleStatus != null) {
      localScheduleStatus.value = data.scheduleStatus
    }
    editing.value = false
  } catch (e) {
    editError.value = e.message || '保存失败'
  } finally {
    editSaving.value = false
  }
}

function parseLocalDateTime(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

const isReminderTriggered = computed(() => {
  if (completed.value) return false
  if (reviewCompletedFromQuery.value) return false
  if (scheduleStatus.value === 5) return false
  if (canCompleteFromBackend.value != null) return canCompleteFromBackend.value
  const sa = localScheduledAt.value || scheduledAt.value
  const d = parseLocalDateTime(sa)
  if (!d) return false
  const now = new Date()
  return d.getTime() <= now.getTime()
})

const completeDisabledReason = computed(() => {
  if (isReminderTriggered.value) return ''
  if (scheduleStatus.value === 5) return '该提醒排期已取消'
  const sa = localScheduledAt.value || scheduledAt.value
  if (!sa) return '缺少提醒时间信息，无法判断是否已触发'
  if (canCompleteFromBackend.value === false) return '当前不可标记完成'
  return '提醒尚未触发（未到提醒时间）'
})

async function fetchTask() {
  resetTips()
  try {
    loading.value = true
    task.value = await getReviewTask(taskId.value)
  } catch (e) {
    errorMessage.value = e.message || '加载任务失败'
  } finally {
    loading.value = false
  }
}

async function onComplete() {
  resetTips()
  if (completed.value) return
  if (!isReminderTriggered.value) {
    errorMessage.value = completeDisabledReason.value || '当前不可完成'
    return
  }

  try {
    loading.value = true
    const body = {
      reviewResult: 1,
      confidenceScore: 4,
      note: '完成复习（前端）',
    }
    if (scheduleId.value != null && !Number.isNaN(scheduleId.value)) body.scheduleId = scheduleId.value

    await completeReviewTask(taskId.value, body)
    completed.value = true
    markScheduleCompletedForDate(
      scheduleDateKey(),
      taskId.value,
      scheduleId.value,
      localScheduledAt.value || scheduledAt.value,
    )
  } catch (e) {
    errorMessage.value = e.message || '完成失败'
  } finally {
    loading.value = false
  }
}

function goBackFromDetail() {
  if (route.query.from === 'week') {
    router.push({ name: 'week_schedule' })
    return
  }
  router.push('/')
}

onMounted(() => {
  // 初始化本地展示值
  localScheduledAt.value = scheduledAt.value
  localScheduleStatus.value = scheduleStatus.value

  completed.value =
    reviewCompletedFromQuery.value ||
    isScheduleMarkedCompleted(
      scheduleDateKey(),
      taskId.value,
      scheduleId.value,
      scheduledAt.value,
    )
  fetchTask()
})
</script>

<template>
  <div class="min-h-screen bg-base-200 text-base-content">
    <div class="navbar bg-base-100 shadow-sm">
      <div class="flex-1">
        <button type="button" class="btn btn-ghost" @click="goBackFromDetail">← 返回</button>
        <span class="text-sm opacity-70">任务详情</span>
      </div>
    </div>

    <main class="mx-auto max-w-3xl px-4 py-10">
      <div v-if="errorMessage" class="alert alert-error">
        <span>{{ errorMessage }}</span>
      </div>

      <div class="mt-6 rounded-box border border-base-300 bg-base-100 p-6 shadow-sm">
        <!-- 标题 + 完成按钮 -->
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 class="text-xl font-semibold">{{ task?.title || `任务 ${taskId}` }}</h1>
            <p class="mt-1 text-sm opacity-70">
              今日提醒时间：<span class="font-medium">{{ localScheduledAt || '-' }}</span>
            </p>
            <p v-if="notifyPhaseLabel" class="mt-1 text-sm opacity-70">
              通知阶段：<span class="font-medium">{{ notifyPhaseLabel }}</span>
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <!-- 统一编辑按钮 -->
            <button
              v-if="task && canEdit && !editing"
              type="button"
              class="btn btn-outline btn-primary btn-sm gap-1"
              :disabled="loading"
              @click="startEdit"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M17.414 2.586a2 2 0 010 2.828l-8.79 8.79a1 1 0 01-.39.242l-3.3 1.1a1 1 0 01-1.265-1.265l1.1-3.3a1 1 0 01.242-.39l8.79-8.79a2 2 0 012.828 0z" />
              </svg>
              编辑
            </button>
            <button
              v-if="!completed"
              type="button"
              class="btn btn-primary"
              :disabled="loading || !isReminderTriggered"
              @click="onComplete"
            >
              {{ loading ? '提交中…' : '完成复习' }}
            </button>
            <span v-else class="badge badge-success badge-lg">已完成</span>
          </div>
        </div>

        <div v-if="completed" class="alert alert-success mt-4 text-sm">
          <span>该排期已标记完成，无需再次提交。</span>
        </div>
        <div v-else-if="!isReminderTriggered" class="alert alert-warning mt-4 text-sm">
          <span>{{ completeDisabledReason }}</span>
        </div>

        <!-- ===== 统一编辑面板 ===== -->
        <div v-if="editing" class="mt-6 rounded-box border border-primary/20 bg-primary/5 p-4 space-y-4">
          <p class="text-xs font-medium text-primary/80">编辑任务信息</p>

          <!-- 提醒时间（仅在有排期时显示） -->
          <div v-if="scheduleId">
            <label class="label pb-1">
              <span class="label-text text-sm font-medium">提醒时间</span>
              <span v-if="!canEditScheduleTime" class="label-text-alt text-warning text-xs">
                当前状态不可修改
              </span>
            </label>
            <input
              v-model="editDraft.scheduledAt"
              type="datetime-local"
              class="input input-bordered input-sm w-full"
              :disabled="!canEditScheduleTime"
            />
          </div>

          <!-- 任务链接 -->
          <div>
            <label class="label pb-1">
              <span class="label-text text-sm font-medium">任务链接</span>
              <span class="label-text-alt text-xs opacity-60">留空则清空</span>
            </label>
            <input
              v-model="editDraft.noteUrl"
              type="text"
              class="input input-bordered input-sm w-full"
              maxlength="1024"
              placeholder="https://…"
              autocomplete="off"
            />
          </div>

          <!-- 复习内容 -->
          <div>
            <label class="label pb-1">
              <span class="label-text text-sm font-medium">复习内容</span>
            </label>
            <RichTextEditor v-model="editDraft.noteContent" :editable="true" />
          </div>

          <div v-if="editError" class="text-sm text-error">{{ editError }}</div>

          <div class="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              class="btn btn-primary btn-sm"
              :disabled="editSaving || loading"
              @click="saveEdit"
            >
              {{ editSaving ? '保存中…' : '保存' }}
            </button>
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              :disabled="editSaving"
              @click="cancelEdit"
            >
              取消
            </button>
          </div>
        </div>

        <!-- ===== 任务信息展示（非编辑态） ===== -->
        <div v-else class="mt-6 space-y-4">
          <!-- 任务链接 -->
          <div class="rounded-box border border-base-300 bg-base-200/50 p-4">
            <span class="text-sm font-medium text-primary">任务链接</span>
            <div class="mt-2 min-w-0">
              <a
                v-if="task?.noteUrl"
                :href="task.noteUrl"
                class="link link-primary break-all text-sm"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ task.noteUrl }}
              </a>
              <div v-else class="text-sm opacity-60">未保存链接</div>
            </div>
          </div>

          <!-- 复习内容 -->
          <div>
            <span class="text-sm font-medium">复习内容</span>
            <div class="mt-2">
              <div
                v-if="task?.noteContent"
                class="rich-content rounded-box border border-base-300 bg-base-200/50 p-3 text-sm"
                v-html="task.noteContent"
              />
              <div v-else class="rounded-box border border-base-300 bg-base-200/50 p-3 text-sm opacity-60">（无）</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.rich-content :deep(ul) { list-style-type: disc; padding-left: 1.25rem; }
.rich-content :deep(ol) { list-style-type: decimal; padding-left: 1.25rem; }
.rich-content :deep(strong) { font-weight: 700; }
.rich-content :deep(em) { font-style: italic; }
.rich-content :deep(u) { text-decoration: underline; }
.rich-content :deep(s) { text-decoration: line-through; }
.rich-content :deep(blockquote) {
  border-left: 3px solid oklch(var(--bc) / 0.3);
  margin-left: 0;
  padding-left: 0.75rem;
  opacity: 0.75;
}
.rich-content :deep(pre) {
  background: oklch(var(--b2));
  border-radius: 0.375rem;
  padding: 0.5rem 0.75rem;
  font-family: ui-monospace, monospace;
  font-size: 0.85em;
}
.rich-content :deep(code:not(pre code)) {
  background: oklch(var(--b2));
  border-radius: 0.25rem;
  padding: 0.1em 0.3em;
  font-family: ui-monospace, monospace;
  font-size: 0.85em;
}
.rich-content :deep(p + p) { margin-top: 0.5rem; }
</style>
