<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { completeReviewTask, getReviewTask, updateReviewTaskNoteUrl } from '@/api/backend'
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

const NOTE_URL_MAX = 1024

const noteUrlEditing = ref(false)
const noteUrlDraft = ref('')
const noteUrlSaving = ref(false)
const noteUrlError = ref('')

const taskStatus = computed(() => {
  const t = task.value
  if (!t) return null
  const s = t.status
  if (typeof s === 'number' && !Number.isNaN(s)) return s
  const n = Number(s)
  return Number.isNaN(n) ? null : n
})

const canEditNoteUrl = computed(() => {
  const s = taskStatus.value
  return s === 1 || s === 2
})

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
  const s = scheduledAt.value
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

function startEditNoteUrl() {
  noteUrlError.value = ''
  noteUrlDraft.value = task.value?.noteUrl ?? ''
  noteUrlEditing.value = true
}

function cancelEditNoteUrl() {
  noteUrlEditing.value = false
  noteUrlError.value = ''
}

async function saveNoteUrl() {
  const trimmed = (noteUrlDraft.value ?? '').trim()
  if (trimmed.length > NOTE_URL_MAX) {
    noteUrlError.value = `链接不能超过 ${NOTE_URL_MAX} 个字符`
    return
  }
  const payload = trimmed === '' ? '' : trimmed
  noteUrlError.value = ''
  try {
    noteUrlSaving.value = true
    const data = await updateReviewTaskNoteUrl(taskId.value, payload)
    task.value = data
    noteUrlEditing.value = false
  } catch (e) {
    noteUrlError.value = e.message || '保存失败'
  } finally {
    noteUrlSaving.value = false
  }
}

function parseLocalDateTime(value) {
  // value 形如 2026-03-25T09:00:00（LocalDateTime，无时区）
  // 直接按本地时间解析（与后端“LocalDateTime 原样存储”口径保持一致）
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

const isReminderTriggered = computed(() => {
  if (completed.value) return false
  if (reviewCompletedFromQuery.value) return false
  // 5=cancelled 的排期不应再完成
  if (scheduleStatus.value === 5) return false
  // 列表内 canComplete 固定 true；直链进入时以后端 query 或时间为准
  if (canCompleteFromBackend.value != null) return canCompleteFromBackend.value
  const d = parseLocalDateTime(scheduledAt.value)
  if (!d) return false
  const now = new Date()
  return d.getTime() <= now.getTime()
})

const completeDisabledReason = computed(() => {
  if (isReminderTriggered.value) return ''
  if (scheduleStatus.value === 5) return '该提醒排期已取消'
  if (!scheduledAt.value) return '缺少提醒时间信息，无法判断是否已触发'
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
      scheduledAt.value,
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
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 class="text-xl font-semibold">{{ task?.title || `任务 ${taskId}` }}</h1>
            <p class="mt-1 text-sm opacity-70">
              今日提醒时间：<span class="font-medium">{{ scheduledAt || '-' }}</span>
            </p>
            <p v-if="notifyPhaseLabel" class="mt-1 text-sm opacity-70">
              通知阶段：<span class="font-medium">{{ notifyPhaseLabel }}</span>
            </p>
          </div>
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

        <div v-if="completed" class="alert alert-success mt-4 text-sm">
          <span>该排期已标记完成，无需再次提交。</span>
        </div>
        <div v-else-if="!isReminderTriggered" class="alert alert-warning mt-4 text-sm">
          <span>{{ completeDisabledReason }}</span>
        </div>

        <div class="mt-6 space-y-4">
          <div class="rounded-box border border-base-300 bg-base-200/50 p-4">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="text-sm font-medium text-primary">任务链接</span>
              <button
                v-if="task && canEditNoteUrl && !noteUrlEditing"
                type="button"
                class="btn btn-outline btn-primary btn-sm gap-1"
                :disabled="loading"
                @click="startEditNoteUrl"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    d="M17.414 2.586a2 2 0 010 2.828l-8.79 8.79a1 1 0 01-.39.242l-3.3 1.1a1 1 0 01-1.265-1.265l1.1-3.3a1 1 0 01.242-.39l8.79-8.79a2 2 0 012.828 0z"
                  />
                </svg>
                编辑
              </button>
            </div>

            <div v-if="!noteUrlEditing" class="mt-2 min-w-0">
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

            <div
              v-else
              class="mt-3 rounded-box border border-primary/20 bg-primary/5 p-3"
            >
              <div class="mb-2 text-xs font-medium text-primary/80">更新外部笔记或网页链接（留空则清空）</div>
              <input
                v-model="noteUrlDraft"
                type="text"
                class="input input-bordered input-sm w-full border-primary/30"
                :maxlength="NOTE_URL_MAX"
                placeholder="https://…"
                autocomplete="off"
              />
              <p class="mt-1 text-xs opacity-60">最多 {{ NOTE_URL_MAX }} 字符；仅「进行中 / 已暂停」任务可修改。</p>
              <div v-if="noteUrlError" class="mt-2 text-sm text-error">{{ noteUrlError }}</div>
              <div class="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  class="btn btn-primary btn-sm"
                  :disabled="noteUrlSaving || loading"
                  @click="saveNoteUrl"
                >
                  {{ noteUrlSaving ? '保存中…' : '保存' }}
                </button>
                <button
                  type="button"
                  class="btn btn-ghost btn-sm"
                  :disabled="noteUrlSaving"
                  @click="cancelEditNoteUrl"
                >
                  取消
                </button>
              </div>
            </div>
          </div>

          <div>
            <div class="text-sm font-medium">复习内容</div>
            <div class="mt-1 whitespace-pre-wrap rounded-box border border-base-300 bg-base-200 p-3 text-sm">
              {{ task?.noteContent || '（无）' }}
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

