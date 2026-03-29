<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { getReviewTasksOverview, getTodayReviewTasks } from '@/api/backend'
import { useAuthStore } from '@/stores/auth'
import {
  isScheduleDoneByPayload,
  isScheduleMarkedCompleted,
  todayDateStr,
} from '@/utils/completedToday'

const auth = useAuthStore()
const router = useRouter()

const theme = ref('light')
const errorMessage = ref('')

const overview = ref(null)
const overviewLoading = ref(false)

const todayTasks = ref([])
const todayTasksLoading = ref(false)

/** §2.2.1 reminderNotifyPhase（展示用） */
const reminderNotifyPhaseLabel = {
  1: '待发通知',
  2: '发送中',
  3: '已发通知',
  4: '发送失败',
}

function toggleTheme() {
  theme.value = theme.value === 'light' ? 'dark' : 'light'
  document.documentElement.setAttribute('data-theme', theme.value)
}

function logout() {
  auth.logout()
  router.push('/login')
}

function resetTips() {
  errorMessage.value = ''
}

async function fetchTodayOverview() {
  resetTips()
  try {
    overviewLoading.value = true
    overview.value = await getReviewTasksOverview(todayDateStr())
  } catch (error) {
    errorMessage.value = error.message || '获取今日概览失败'
  } finally {
    overviewLoading.value = false
  }
}

async function fetchTodayTasks() {
  resetTips()
  try {
    todayTasksLoading.value = true
    todayTasks.value = await getTodayReviewTasks(todayDateStr())
  } catch (e) {
    todayTasks.value = []
    errorMessage.value = e.message || '获取今日任务失败'
  } finally {
    todayTasksLoading.value = false
  }
}

function isTaskCardDone(item) {
  const d = todayDateStr()
  if (isScheduleDoneByPayload(item)) return true
  return isScheduleMarkedCompleted(d, item.taskId, item.scheduleId, item.scheduledAt)
}

function openTaskDetail(item) {
  if (isTaskCardDone(item)) return
  router.push({
    name: 'task_detail',
    params: { taskId: item.taskId },
    query: {
      scheduleId: item.scheduleId,
      scheduledAt: item.scheduledAt,
      canComplete: item.canComplete,
      scheduleStatus: item.scheduleStatus,
      reminderNotifyPhase: item.reminderNotifyPhase ?? item.reminder_notify_phase,
    },
  })
}

function notifyPhaseBadgeClass(phase) {
  if (phase === 3) return 'badge-success'
  if (phase === 4) return 'badge-error'
  if (phase === 2) return 'badge-info'
  return 'badge-ghost'
}

function cardNotifyLabel(item) {
  if (isTaskCardDone(item)) return ''
  const p = item.reminderNotifyPhase ?? item.reminder_notify_phase
  if (p == null) return ''
  return reminderNotifyPhaseLabel[p] ?? `阶段${p}`
}

onMounted(() => {
  fetchTodayOverview()
  fetchTodayTasks()
})
</script>

<template>
  <div class="min-h-screen bg-base-200 text-base-content">
    <div class="navbar bg-base-100 shadow-sm">
      <div class="flex-1">
        <a class="btn btn-ghost text-xl font-semibold tracking-tight">ReNote</a>
        <span class="hidden text-sm opacity-70 sm:inline">复习提醒 · 已登录</span>
      </div>
      <div class="flex-none items-center gap-2 sm:flex">
        <span v-if="auth.user" class="hidden max-w-[10rem] truncate text-sm opacity-80 sm:inline">
          {{ auth.user.username || auth.user.displayName || `用户 ${auth.user.id}` }}
        </span>
        <button type="button" class="btn btn-ghost btn-sm" @click="toggleTheme">
          {{ theme === 'light' ? '🌙 深色' : '☀️ 浅色' }}
        </button>
        <button type="button" class="btn btn-outline btn-sm" @click="logout">退出</button>
      </div>
    </div>

    <main class="mx-auto max-w-5xl px-4 py-10">
      <div class="mx-auto max-w-md rounded-box bg-base-100 p-1 shadow-md">
        <div class="card bg-base-200 shadow-inner">
          <div class="card-body gap-3">
            <h2 class="card-title text-base">今日概览</h2>
            <div v-if="overviewLoading" class="text-sm opacity-70">加载中…</div>
            <div v-else class="stats stats-vertical shadow-sm">
              <div class="stat place-items-center py-3">
                <div class="stat-title">待复习（任务）</div>
                <div class="stat-value text-primary">
                  {{
                    overview?.dueTaskCount ??
                    overview?.due_task_count ??
                    0
                  }}
                </div>
              </div>
              <div class="stat place-items-center py-3">
                <div class="stat-title">未完成排期</div>
                <div class="stat-value text-warning">
                  {{
                    overview?.dueReminderCount ??
                    overview?.due_reminder_count ??
                    0
                  }}
                </div>
              </div>
              <div class="stat place-items-center py-3">
                <div class="stat-title">待发通知</div>
                <div class="stat-value text-secondary">
                  {{
                    overview?.pendingNotifyReminderCount ??
                    overview?.pending_notify_reminder_count ??
                    0
                  }}
                </div>
              </div>
              <div class="stat place-items-center py-3">
                <div class="stat-title">今日已完成</div>
                <div class="stat-value text-success">
                  {{
                    overview?.completedTodayCount ??
                    overview?.completed_today_count ??
                    0
                  }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="errorMessage" class="alert alert-error mt-10">
        <span>{{ errorMessage }}</span>
      </div>

      <div class="mt-12 flex items-center justify-between gap-4 rounded-box border border-base-300 bg-base-100 p-6 shadow-sm">
        <h2 class="text-lg font-semibold">复习任务</h2>
        <button type="button" class="btn btn-primary" @click="router.push('/tasks/new')">去新建复习</button>
      </div>

      <div class="mt-8 rounded-box border border-base-300 bg-base-100 p-6 shadow-sm">
        <div class="flex items-center justify-between gap-4">
          <h2 class="text-lg font-semibold">今日任务</h2>
          <button
            type="button"
            class="btn btn-outline btn-sm"
            :disabled="todayTasksLoading"
            @click="fetchTodayTasks"
          >
            {{ todayTasksLoading ? '刷新中...' : '刷新' }}
          </button>
        </div>

        <div v-if="todayTasksLoading" class="mt-4 opacity-70">加载中…</div>

        <div v-else-if="todayTasks.length === 0" class="mt-4 text-sm opacity-60">
          请新建复习任务
        </div>

        <div v-else class="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <button
            v-for="item in todayTasks"
            :key="String(item.scheduleId ?? item.taskId) + '-' + String(item.scheduledAt)"
            type="button"
            class="card border border-base-300 text-left shadow-sm transition"
            :class="
              isTaskCardDone(item)
                ? 'cursor-default bg-base-200/80 opacity-90'
                : 'cursor-pointer bg-base-100 hover:shadow-md'
            "
            :disabled="isTaskCardDone(item)"
            @click="openTaskDetail(item)"
          >
            <div class="card-body gap-2 p-5">
              <div class="flex items-start justify-between gap-2">
                <h3 class="card-title line-clamp-2 text-base leading-snug">{{ item.title }}</h3>
                <span
                  class="badge whitespace-nowrap"
                  :class="
                    isTaskCardDone(item)
                      ? 'badge-outline badge-success'
                      : notifyPhaseBadgeClass(
                          item.reminderNotifyPhase ?? item.reminder_notify_phase,
                        )
                  "
                >
                  {{
                    isTaskCardDone(item)
                      ? '已完成'
                      : cardNotifyLabel(item) || (item.canComplete ? '可完成' : '暂不可')
                  }}
                </span>
              </div>
              <p class="text-sm opacity-70">提醒时间：{{ item.scheduledAt }}</p>
            </div>
          </button>
        </div>
      </div>
    </main>
  </div>
</template>
