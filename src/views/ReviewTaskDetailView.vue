<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { completeReviewTask, getReviewTask } from '@/api/backend'
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
          <div>
            <div class="text-sm font-medium">任务链接</div>
            <a
              v-if="task?.noteUrl"
              :href="task.noteUrl"
              class="link link-primary break-all"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ task.noteUrl }}
            </a>
            <div v-else class="text-sm opacity-60">未保存链接</div>
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

