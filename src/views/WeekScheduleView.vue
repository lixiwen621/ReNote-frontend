<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { getReviewTasksWeek, updateReviewTaskScheduleTime } from '@/api/backend'
import { useAuthStore } from '@/stores/auth'
import { todayDateStr } from '@/utils/completedToday'

const auth = useAuthStore()
const router = useRouter()

const theme = ref('light')
const loading = ref(false)
const errorMessage = ref('')
const weekPayload = ref(null)
const editingKey = ref('')
const editingTime = ref('')
const editLoading = ref(false)

/** 当前周锚点日（任意落在该周的 YYYY-MM-DD） */
const anchorDate = ref(todayDateStr())
/** 选中日（YYYY-MM-DD） */
const selectedDate = ref(todayDateStr())

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']

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

function addDaysYmd(ymd, delta) {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(y, m - 1, d + delta)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

const days = computed(() => {
  const raw = weekPayload.value?.days ?? weekPayload.value?.Days
  if (!Array.isArray(raw)) return []
  return raw
})

const selectedItems = computed(() => {
  const d = days.value.find((x) => (x.date ?? x.Date) === selectedDate.value)
  return d?.items ?? d?.Items ?? []
})

function dayNumber(dateStr) {
  if (!dateStr || dateStr.length < 10) return ''
  return dateStr.slice(8, 10).replace(/^0/, '') || dateStr.slice(8, 10)
}

function hasItems(day) {
  const items = day?.items ?? day?.Items ?? []
  return Array.isArray(items) && items.length > 0
}

function toDateTimeLocalValue(v) {
  if (!v || typeof v !== 'string') return ''
  return v.length >= 19 ? v.slice(0, 19) : v
}

function nowPlusOneMinuteLocal() {
  const d = new Date(Date.now() + 60 * 1000)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day}T${hh}:${mm}`
}

function itemKey(item) {
  return `${item.taskId}-${item.scheduleId}`
}

function isItemCompleted(item) {
  return item.reviewCompleted === true || item.review_completed === true
}

function canEditSchedule(item) {
  if (isItemCompleted(item)) return false
  const st = item.scheduleStatus
  if (st === 2 || st === 5) return false
  return true
}

async function fetchWeek() {
  errorMessage.value = ''
  try {
    loading.value = true
    weekPayload.value = await getReviewTasksWeek(anchorDate.value)
    const list = days.value
    if (list.length && !list.some((x) => (x.date ?? x.Date) === selectedDate.value)) {
      selectedDate.value = list[0].date ?? list[0].Date ?? selectedDate.value
    }
  } catch (e) {
    weekPayload.value = null
    errorMessage.value = e.message || '加载本周日程失败'
  } finally {
    loading.value = false
  }
}

function selectDay(dateStr) {
  selectedDate.value = dateStr
}

function prevWeek() {
  anchorDate.value = addDaysYmd(anchorDate.value, -7)
  selectedDate.value = addDaysYmd(selectedDate.value, -7)
  fetchWeek()
}

function nextWeek() {
  anchorDate.value = addDaysYmd(anchorDate.value, 7)
  selectedDate.value = addDaysYmd(selectedDate.value, 7)
  fetchWeek()
}

function openItem(item) {
  const rc = isItemCompleted(item)
  router.push({
    name: 'task_detail',
    params: { taskId: item.taskId },
    query: {
      scheduleId: item.scheduleId,
      scheduledAt: item.scheduledAt,
      canComplete: item.canComplete,
      scheduleStatus: item.scheduleStatus,
      reminderNotifyPhase: item.reminderNotifyPhase ?? item.reminder_notify_phase,
      reviewCompleted: rc ? 'true' : 'false',
      from: 'week',
    },
  })
}

function openEdit(item) {
  if (!canEditSchedule(item) || editLoading.value) return
  editingKey.value = itemKey(item)
  editingTime.value = toDateTimeLocalValue(item.scheduledAt)
}

function cancelEdit() {
  editingKey.value = ''
  editingTime.value = ''
}

function normalizeDateTimeForApi(v) {
  if (!v) return ''
  if (v.length === 16) return `${v}:00`
  return v
}

function parseLocalDateTime(v) {
  if (!v) return null
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return null
  return d
}

async function saveEdit(item) {
  if (!editingTime.value) {
    errorMessage.value = '请选择提醒时间'
    return
  }
  const candidate = parseLocalDateTime(editingTime.value)
  if (!candidate) {
    errorMessage.value = '提醒时间格式不正确'
    return
  }
  const nowMinute = new Date()
  nowMinute.setSeconds(0, 0)
  if (candidate.getTime() <= nowMinute.getTime()) {
    errorMessage.value = '提醒时间必须晚于当前分钟'
    return
  }

  try {
    errorMessage.value = ''
    editLoading.value = true
    await updateReviewTaskScheduleTime(
      item.taskId,
      item.scheduleId,
      normalizeDateTimeForApi(editingTime.value),
    )
    cancelEdit()
    await fetchWeek()
  } catch (e) {
    errorMessage.value = e.message || '修改提醒时间失败'
  } finally {
    editLoading.value = false
  }
}

function phaseBadgeClass(phase) {
  if (phase === 3) return 'badge-success'
  if (phase === 4) return 'badge-error'
  if (phase === 2) return 'badge-info'
  return 'badge-ghost'
}

onMounted(() => {
  fetchWeek()
})
</script>

<template>
  <div class="min-h-screen bg-base-200 text-base-content">
    <div class="navbar bg-base-100 shadow-sm">
      <div class="flex-1">
        <button type="button" class="btn btn-ghost text-xl font-semibold" @click="router.push('/')">
          ReNote
        </button>
        <span class="hidden text-sm opacity-70 sm:inline">本周日程</span>
      </div>
      <div class="flex-none items-center gap-2 sm:flex">
        <button type="button" class="btn btn-ghost btn-sm" @click="toggleTheme">
          {{ theme === 'light' ? '🌙 深色' : '☀️ 浅色' }}
        </button>
        <button type="button" class="btn btn-outline btn-sm" @click="logout">退出</button>
      </div>
    </div>

    <main class="mx-auto max-w-5xl px-4 py-8">
      <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold">一周复习日程</h1>
        <div class="flex items-center gap-2">
          <button type="button" class="btn btn-ghost btn-sm" @click="prevWeek">上一周</button>
          <button type="button" class="btn btn-ghost btn-sm" @click="nextWeek">下一周</button>
          <button type="button" class="btn btn-outline btn-sm" :disabled="loading" @click="fetchWeek">
            {{ loading ? '刷新中…' : '刷新' }}
          </button>
        </div>
      </div>

      <p v-if="weekPayload" class="mb-4 text-sm opacity-70">
        {{ weekPayload.weekStart ?? weekPayload.week_start }} ~ {{ weekPayload.weekEnd ?? weekPayload.week_end }}
      </p>

      <div v-if="errorMessage" class="alert alert-error mb-4">
        <span>{{ errorMessage }}</span>
      </div>

      <div v-if="loading && !weekPayload" class="opacity-70">加载中…</div>

      <template v-else-if="weekPayload">
        <!-- 周历：周一～周日 -->
        <div
          class="flex justify-between gap-1 overflow-x-auto rounded-box border border-base-300 bg-base-100 p-3 shadow-sm sm:gap-2"
        >
          <button
            v-for="(day, idx) in days"
            :key="day.date ?? day.Date"
            type="button"
            class="flex min-w-[2.75rem] flex-1 flex-col items-center gap-1 rounded-2xl py-2 transition sm:min-w-[3.25rem]"
            :class="
              (day.date ?? day.Date) === selectedDate
                ? 'bg-primary text-primary-content'
                : 'hover:bg-base-200'
            "
            @click="selectDay(day.date ?? day.Date)"
          >
            <span class="text-xs opacity-80">{{ WEEKDAY_LABELS[idx] ?? '·' }}</span>
            <span class="text-lg font-semibold leading-none">{{ dayNumber(day.date ?? day.Date) }}</span>
            <span
              v-if="hasItems(day)"
              class="h-1.5 w-1.5 rounded-full"
              :class="(day.date ?? day.Date) === selectedDate ? 'bg-primary-content' : 'bg-primary'"
            />
            <span v-else class="h-1.5 w-1.5" />
          </button>
        </div>

        <!-- 选中日列表 -->
        <div class="mt-8 rounded-box border border-base-300 bg-base-100 p-6 shadow-sm">
          <h2 class="text-lg font-semibold">
            {{ selectedDate }} 的排期
          </h2>
          <p class="mt-1 text-xs opacity-60">已发通知但未完成的条目，修改时间后会重新进入待提醒。</p>
          <p v-if="selectedItems.length === 0" class="mt-4 text-sm opacity-60">当天没有复习排期</p>
          <ul v-else class="mt-4 space-y-3">
            <li
              v-for="(item, i) in selectedItems"
              :key="String(item.scheduleId) + '-' + i + '-' + item.scheduledAt"
            >
              <button
                type="button"
                class="flex w-full items-start gap-3 rounded-box border border-base-300 p-4 text-left transition hover:bg-base-200"
                :class="
                  isItemCompleted(item) ? 'opacity-80' : ''
                "
                @click="openItem(item)"
              >
                <span
                  v-if="isItemCompleted(item)"
                  class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success/20 text-success"
                  aria-hidden="true"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fill-rule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clip-rule="evenodd"
                    />
                  </svg>
                </span>
                <span v-else class="mt-1 h-8 w-8 shrink-0 rounded-full border-2 border-base-300" />
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="font-medium">{{ item.title }}</span>
                    <span
                      v-if="isItemCompleted(item)"
                      class="badge badge-success badge-sm"
                    >
                      已完成
                    </span>
                    <span
                      v-else
                      class="badge badge-sm whitespace-nowrap"
                      :class="
                        phaseBadgeClass(
                          item.reminderNotifyPhase ?? item.reminder_notify_phase,
                        )
                      "
                    >
                      {{
                        reminderNotifyPhaseLabel[
                          item.reminderNotifyPhase ?? item.reminder_notify_phase
                        ] || '待完成'
                      }}
                    </span>
                  </div>
                  <p class="mt-1 text-sm opacity-70">提醒时间：{{ item.scheduledAt }}</p>
                  <div v-if="canEditSchedule(item)" class="mt-3">
                    <button
                      type="button"
                      class="btn btn-outline btn-primary btn-sm gap-1"
                      :disabled="editLoading"
                      @click.stop="openEdit(item)"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M17.414 2.586a2 2 0 010 2.828l-8.79 8.79a1 1 0 01-.39.242l-3.3 1.1a1 1 0 01-1.265-1.265l1.1-3.3a1 1 0 01.242-.39l8.79-8.79a2 2 0 012.828 0z" />
                      </svg>
                      编辑提醒时间
                    </button>
                  </div>
                  <div
                    v-if="editingKey === itemKey(item)"
                    class="mt-3 rounded-box border border-primary/20 bg-primary/5 p-3"
                    @click.stop
                  >
                    <div class="mb-2 text-xs font-medium text-primary/80">调整该排期的提醒时间</div>
                    <div class="flex flex-wrap items-center gap-2">
                      <input
                        v-model="editingTime"
                        type="datetime-local"
                        step="1"
                        class="input input-bordered input-sm min-w-[15rem] flex-1 border-primary/30"
                        :min="nowPlusOneMinuteLocal()"
                      />
                      <button
                        type="button"
                        class="btn btn-primary btn-sm"
                        :disabled="editLoading"
                        @click="saveEdit(item)"
                      >
                        {{ editLoading ? '保存中…' : '保存修改' }}
                      </button>
                      <button
                        type="button"
                        class="btn btn-ghost btn-sm"
                        :disabled="editLoading"
                        @click="cancelEdit"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                </div>
              </button>
            </li>
          </ul>
        </div>
      </template>

      <div class="mt-10 text-center">
        <button type="button" class="btn btn-ghost btn-sm" @click="router.push('/')">返回首页</button>
      </div>
    </main>
  </div>
</template>
