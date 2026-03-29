<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { createReviewTask, getReviewTaskSchedules } from '@/api/backend'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const theme = ref('light')
const loading = ref(false)
const message = ref('')
const errorMessage = ref('')

const sourceTypeLabel = {
  1: '印象笔记',
  2: 'other',
}

const scheduleStatusLabel = {
  1: '待发送',
  2: '发送中',
  3: '已发送',
  4: '失败',
  5: '已取消',
}

const newReview = ref({
  title: '',
  sourceType: 1,
  noteUrl: '',
  noteContent: '',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai',
  remindTimes: [],
})

const createdTaskId = ref('')
const createdTask = ref(null)
const schedules = ref([])

const filledRemindTimes = computed(() =>
  newReview.value.remindTimes.filter((t) => String(t).trim() !== ''),
)
const usesForgettingCurve = computed(() => filledRemindTimes.value.length === 0)

function toggleTheme() {
  theme.value = theme.value === 'light' ? 'dark' : 'light'
  document.documentElement.setAttribute('data-theme', theme.value)
}

function logout() {
  auth.logout()
  router.push('/login')
}

function resetTips() {
  message.value = ''
  errorMessage.value = ''
}

function addRemindTime() {
  newReview.value.remindTimes.push('')
}

function removeRemindTime(index) {
  newReview.value.remindTimes.splice(index, 1)
}

function normalizeLocalDateTimeInput(value) {
  // 后端使用 LocalDateTime 入参（不带时区偏移）
  // datetime-local 通常是 `YYYY-MM-DDTHH:mm`，补齐秒到 `:00`
  if (!value) return ''
  if (typeof value !== 'string') return String(value)
  if (value.length === 16) return `${value}:00`
  return value
}

async function fetchTaskSchedules(taskId) {
  schedules.value = await getReviewTaskSchedules(taskId)
}

async function submitReviewTask() {
  resetTips()

  if (!newReview.value.title.trim()) {
    errorMessage.value = '标题不能为空'
    return
  }

  try {
    loading.value = true

    const remindTimes = filledRemindTimes.value.map(normalizeLocalDateTimeInput)
    const payload = {
      title: newReview.value.title.trim(),
      sourceType: Number(newReview.value.sourceType),
      noteUrl: newReview.value.noteUrl.trim() || null,
      noteContent: newReview.value.noteContent.trim() || null,
      timezone: newReview.value.timezone,
      scheduleMode: remindTimes.length > 0 ? 1 : 2,
      remindTimes,
    }

    createdTask.value = await createReviewTask(payload)
    createdTaskId.value = String(createdTask.value?.id ?? '')
    message.value = `创建成功，任务 ID: ${createdTaskId.value}，正在返回首页...`

    // 按你的要求：创建成功后返回首页并刷新
    await router.replace('/')
    window.location.reload()
  } catch (e) {
    errorMessage.value = e.message || '创建失败'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-base-200 text-base-content">
    <!-- 顶栏 -->
    <div class="navbar bg-base-100 shadow-sm">
      <div class="flex-1">
        <a class="btn btn-ghost text-xl font-semibold tracking-tight">ReNote</a>
        <span class="hidden text-sm opacity-70 sm:inline">新建复习</span>
      </div>
      <div class="flex-none items-center gap-2 sm:flex">
        <button type="button" class="btn btn-ghost btn-sm" @click="toggleTheme">
          {{ theme === 'light' ? '🌙 深色' : '☀️ 浅色' }}
        </button>
        <button type="button" class="btn btn-primary btn-sm" @click="router.push('/')">
          返回首页
        </button>
        <button type="button" class="btn btn-outline btn-sm" @click="logout">退出</button>
      </div>
    </div>

    <main class="mx-auto max-w-5xl px-4 py-10">
      <div v-if="message" class="alert alert-success mt-2">
        <span>{{ message }}</span>
      </div>
      <div v-if="errorMessage" class="alert alert-error mt-3">
        <span>{{ errorMessage }}</span>
      </div>

      <div class="mt-8 rounded-box border border-base-300 bg-base-100 p-6 shadow-sm">
        <h2 class="mb-1 text-lg font-semibold">创建复习任务</h2>
        <p class="mb-4 max-w-2xl text-sm opacity-70">
          内容和链接可同时存储；提醒时间支持多个。若都不设，则后端按<strong>遗忘曲线</strong>自动排期。
        </p>

        <fieldset class="fieldset mx-auto max-w-2xl gap-4">
          <label class="fieldset-label">
            <span class="label-text font-medium">标题</span>
            <input v-model="newReview.title" type="text" class="input input-bordered w-full" placeholder="例如：第三章并发 · 笔记" />
          </label>

          <label class="fieldset-label">
            <span class="label-text font-medium">来源类型</span>
            <select v-model.number="newReview.sourceType" class="select select-bordered w-full">
              <option :value="1">1 - evernote</option>
              <option :value="2">2 - other</option>
            </select>
          </label>

          <label class="fieldset-label">
            <span class="label-text font-medium">复习内容（noteContent）</span>
            <span class="label-text-alt text-xs opacity-70">写清要复习的范围，不必全文粘贴</span>
            <textarea v-model="newReview.noteContent" class="textarea textarea-bordered min-h-28 w-full text-base leading-relaxed" placeholder="例如：本章重点：happens-before；错题：第 5 题选 C 的原因…"></textarea>
          </label>

          <label class="fieldset-label">
            <span class="label-text font-medium">印象笔记链接（noteUrl）</span>
            <span class="label-text-alt text-xs opacity-70">可选；用于点击跳转原文</span>
            <input v-model="newReview.noteUrl" type="url" class="input input-bordered w-full" placeholder="https://app.yinxiang.com/..."/>
          </label>

          <label class="fieldset-label">
            <span class="label-text font-medium">时区（timezone）</span>
            <input v-model="newReview.timezone" type="text" class="input input-bordered w-full" />
          </label>

          <div class="fieldset">
            <span class="label-text font-medium">提醒时间</span>
            <span class="label-text-alt block text-xs opacity-70">
              可添加多个时间点；若<strong>不添加</strong>或<strong>全部留空</strong>，保存后将由系统按<strong>遗忘曲线</strong>自动排期。
            </span>

            <ul class="mt-3 flex flex-col gap-2">
              <li v-for="(_t, index) in newReview.remindTimes" :key="index" class="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                <input
                  v-model="newReview.remindTimes[index]"
                  type="datetime-local"
                  class="input input-bordered min-w-0 flex-1"
                  :aria-label="`提醒时间 ${index + 1}`"
                />
                <button type="button" class="btn btn-ghost btn-square btn-sm shrink-0" title="删除该时间" @click="removeRemindTime(index)">
                  ✕
                </button>
              </li>
            </ul>

            <button type="button" class="btn btn-outline btn-sm mt-2 gap-1" @click="addRemindTime">
              <span class="text-lg leading-none">＋</span>
              添加提醒时间
            </button>

            <div class="alert mt-3 text-sm" :class="usesForgettingCurve ? 'alert-info' : 'alert-success'">
              <span v-if="usesForgettingCurve">
                当前未设置有效提醒时间 → 将使用<strong>遗忘曲线</strong>自动排期。
              </span>
              <span v-else>
                已设置 <strong>{{ filledRemindTimes.length }}</strong> 个提醒时间 → 将按这些时间点提醒（具体以后端为准）。
              </span>
            </div>
          </div>

          <div class="flex flex-wrap gap-2 pt-2">
            <button type="button" class="btn btn-primary" :disabled="loading" @click="submitReviewTask">
              {{ loading ? '保存中...' : '保存到后端' }}
            </button>
          </div>
        </fieldset>
      </div>

      <div v-if="schedules.length" class="mt-8 overflow-x-auto rounded-box border border-base-300 bg-base-100 p-6 shadow-sm">
        <h3 class="mb-2 text-lg font-semibold">创建后的提醒计划</h3>
        <p class="mb-4 text-sm opacity-70">
          任务：<span class="font-medium">{{ createdTaskId }}</span> · 来源：{{ sourceTypeLabel[createdTask?.sourceType] || createdTask?.sourceType }}
        </p>
        <table class="table table-zebra">
          <thead>
            <tr>
              <th>ID</th>
              <th>scheduledAt</th>
              <th>status</th>
              <th>attemptCount</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in schedules" :key="item.id">
              <td>{{ item.id }}</td>
              <td>{{ item.scheduledAt }}</td>
              <td>{{ scheduleStatusLabel[item.status] || item.status }}</td>
              <td>{{ item.attemptCount }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  </div>
</template>

