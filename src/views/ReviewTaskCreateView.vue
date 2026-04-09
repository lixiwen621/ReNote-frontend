<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { createReviewTask, createReviewTaskMultipart } from '@/api/backend'
import { formatFileSize } from '@/utils/attachmentUrl'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const DEFAULT_TIMEZONE = 'Asia/Shanghai'

const theme = ref('light')
const loading = ref(false)
const message = ref('')
const errorMessage = ref('')

/** 1=全部自定义 2=遗忘曲线 */
const reminderStrategy = ref(2)

const newReview = ref({
  title: '',
  sourceType: 1,
  noteUrl: '',
  noteContent: '',
  remindTimes: [],
})

const firstReminderAt = ref('')
const curveRemindTime = ref('')

const createdTaskId = ref('')

const MAX_ATTACHMENT_COUNT = 10
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

/** @type {import('vue').Ref<File[]>} */
const pendingFiles = ref([])
const fileInputRef = ref(null)
const fileDropActive = ref(false)
const fileDragDepth = ref(0)
const attachmentError = ref('')

const filledRemindTimes = computed(() =>
  newReview.value.remindTimes.filter((t) => String(t).trim() !== ''),
)

watch(reminderStrategy, (v) => {
  if (v === 1 && newReview.value.remindTimes.length === 0) {
    newReview.value.remindTimes.push('')
  }
})

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
  attachmentError.value = ''
}

function addRemindTime() {
  newReview.value.remindTimes.push('')
}

function removeRemindTime(index) {
  newReview.value.remindTimes.splice(index, 1)
}

function normalizeLocalDateTimeInput(value) {
  if (!value) return ''
  if (typeof value !== 'string') return String(value)
  if (value.length === 16) return `${value}:00`
  return value
}

function normalizeCurveRemindTime(value) {
  const s = String(value ?? '').trim()
  if (!s) return ''
  if (s.length >= 8 && s[5] === ':') return `${s.slice(0, 5)}`
  if (s.length >= 5 && s[2] === ':') return s.slice(0, 5)
  return s
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

function floorToMinute(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), 0, 0)
}

function openFilePicker() {
  fileInputRef.value?.click()
}

function addFilesFromList(list) {
  if (!list?.length) return
  errorMessage.value = ''
  attachmentError.value = ''
  const next = [...pendingFiles.value]
  for (const file of list) {
    if (next.length >= MAX_ATTACHMENT_COUNT) {
      attachmentError.value = `最多选择 ${MAX_ATTACHMENT_COUNT} 个文件`
      break
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      attachmentError.value = `「${file.name}」超过 ${formatFileSize(MAX_ATTACHMENT_BYTES)}，请上传小于 10MB 的文件`
      continue
    }
    next.push(file)
  }
  pendingFiles.value = next
}

function onFilesSelected(event) {
  addFilesFromList(event.target?.files)
  if (event.target) event.target.value = ''
}

function onFileDragEnter() {
  fileDragDepth.value += 1
  fileDropActive.value = true
}

function onFileDragLeave() {
  fileDragDepth.value = Math.max(0, fileDragDepth.value - 1)
  if (fileDragDepth.value === 0) fileDropActive.value = false
}

function onFileDrop(e) {
  fileDragDepth.value = 0
  fileDropActive.value = false
  addFilesFromList(e.dataTransfer?.files)
}

function removePendingFile(index) {
  pendingFiles.value = pendingFiles.value.filter((_, i) => i !== index)
}

function buildCreatePayload() {
  const base = {
    title: newReview.value.title.trim(),
    sourceType: Number(newReview.value.sourceType),
    noteUrl: newReview.value.noteUrl.trim() || null,
    noteContent: newReview.value.noteContent.trim() || null,
    timezone: DEFAULT_TIMEZONE,
  }

  if (reminderStrategy.value === 1) {
    const remindTimes = filledRemindTimes.value.map(normalizeLocalDateTimeInput)
    return {
      ...base,
      reminderStrategy: 1,
      remindTimes,
    }
  }

  const payload = {
    ...base,
    reminderStrategy: 2,
  }
  const first = normalizeLocalDateTimeInput(firstReminderAt.value)
  if (first) payload.firstReminderAt = first
  const curve = normalizeCurveRemindTime(curveRemindTime.value)
  if (curve) payload.curveRemindTime = curve
  return payload
}

function validateFirstReminderAt(value) {
  const normalized = normalizeLocalDateTimeInput(value)
  if (!normalized) return ''
  const selected = new Date(normalized)
  if (Number.isNaN(selected.getTime())) return '第一次提醒时间格式不正确'
  const now = new Date()
  if (floorToMinute(selected).getTime() === floorToMinute(now).getTime()) {
    return '第一次提醒时间不能与当前分钟相同'
  }
  if (selected.getTime() <= now.getTime()) {
    return '第一次提醒时间须晚于当前时刻'
  }
  return ''
}

async function submitReviewTask() {
  resetTips()

  if (!newReview.value.title.trim()) {
    errorMessage.value = '标题不能为空'
    return
  }

  if (reminderStrategy.value === 1) {
    if (filledRemindTimes.value.length === 0) {
      errorMessage.value = '请至少填写一条提醒时间'
      return
    }
  } else {
    const err = validateFirstReminderAt(firstReminderAt.value)
    if (err) {
      errorMessage.value = err
      return
    }
  }

  try {
    loading.value = true

    const payload = buildCreatePayload()
    const files = pendingFiles.value
    const data =
      files.length > 0
        ? await createReviewTaskMultipart(payload, files)
        : await createReviewTask(payload)
    createdTaskId.value = String(data?.id ?? '')
    message.value = `创建成功，任务 ID: ${createdTaskId.value}，正在返回首页...`

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
  <div
    class="min-h-screen bg-gradient-to-b from-base-200 via-base-200 to-base-300/40 text-base-content"
  >
    <div class="navbar border-b border-base-300/80 bg-base-100/95 shadow-sm backdrop-blur-sm">
      <div class="flex-1">
        <a class="btn btn-ghost text-xl font-semibold tracking-tight">ReNote</a>
        <span class="hidden text-sm text-base-content/60 sm:inline">新建复习</span>
      </div>
      <div class="flex-none items-center gap-2 sm:flex">
        <button type="button" class="btn btn-ghost btn-sm" @click="toggleTheme">
          {{ theme === 'light' ? '🌙 深色' : '☀️ 浅色' }}
        </button>
        <button type="button" class="btn btn-primary btn-sm" @click="router.push('/')">返回首页</button>
        <button type="button" class="btn btn-outline btn-sm" @click="logout">退出</button>
      </div>
    </div>

    <main class="mx-auto max-w-xl px-4 py-10 sm:px-5 sm:py-12">
      <div v-if="message" class="alert alert-success mb-4 text-sm shadow-sm">
        <span>{{ message }}</span>
      </div>
      <div v-if="errorMessage" class="alert alert-error mb-4 text-sm shadow-sm">
        <span>{{ errorMessage }}</span>
      </div>

      <div
        class="overflow-hidden rounded-2xl border border-base-300/90 bg-base-100 shadow-lg shadow-base-300/40 ring-1 ring-black/5"
      >
        <div class="h-1 bg-gradient-to-r from-primary via-secondary to-accent" aria-hidden="true" />
        <div class="px-5 pb-8 pt-6 sm:px-8 sm:pb-10 sm:pt-8">
          <header class="mb-8 border-b border-base-200 pb-6">
            <h1 class="text-xl font-bold tracking-tight sm:text-2xl">创建复习任务</h1>
            <p class="mt-1.5 text-sm leading-relaxed text-base-content/55">
              填写基本信息与提醒规则；可选添加图片或文件附件。
            </p>
          </header>

          <form class="space-y-10" @submit.prevent="submitReviewTask">
            <!-- 基本信息 -->
            <section class="space-y-5">
              <h2 class="flex items-center gap-3">
                <span
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary shadow-sm ring-1 ring-primary/15"
                  aria-hidden="true"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                    />
                  </svg>
                </span>
                <span class="min-w-0">
                  <span class="block text-sm font-semibold tracking-tight text-base-content">基本信息</span>
                  <span class="mt-0.5 block text-xs font-normal text-base-content/50">标题、来源、内容与链接</span>
                </span>
              </h2>

              <label class="form-control w-full gap-1.5">
                <span class="label py-0"><span class="label-text text-sm font-medium">标题</span></span>
                <input
                  v-model="newReview.title"
                  type="text"
                  class="input input-bordered w-full border-base-300 bg-base-100 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="例如：第三章 · 并发"
                  autocomplete="off"
                />
              </label>

              <label class="form-control w-full gap-1.5">
                <span class="label py-0"><span class="label-text text-sm font-medium">来源</span></span>
                <select
                  v-model.number="newReview.sourceType"
                  class="select select-bordered w-full border-base-300 bg-base-100 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option :value="1">印象笔记</option>
                  <option :value="2">其他</option>
                </select>
              </label>

              <label class="form-control w-full gap-1.5">
                <span class="label py-0"><span class="label-text text-sm font-medium">复习内容</span></span>
                <textarea
                  v-model="newReview.noteContent"
                  class="textarea textarea-bordered min-h-[6.5rem] w-full resize-y border-base-300 bg-base-100 text-sm leading-relaxed focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="范围与要点，不必全文粘贴"
                />
              </label>

              <label class="form-control w-full gap-1.5">
                <span class="label py-0">
                  <span class="label-text text-sm font-medium">外链</span>
                  <span class="label-text-alt font-normal text-base-content/45">可选</span>
                </span>
                <input
                  v-model="newReview.noteUrl"
                  type="url"
                  class="input input-bordered w-full border-base-300 bg-base-100 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="https://…"
                />
              </label>

              <div class="form-control w-full max-w-xs gap-1.5">
                <span class="label py-0">
                  <span class="label-text text-sm font-medium text-base-content/50">时区</span>
                </span>
                <input
                  type="text"
                  class="input input-bordered input-sm w-full cursor-not-allowed border-dashed border-base-300 bg-base-200/80 text-base-content/70"
                  :value="DEFAULT_TIMEZONE"
                  readonly
                  tabindex="-1"
                />
              </div>
            </section>

            <!-- 提醒 -->
            <section class="space-y-4">
              <h2 class="flex items-center gap-3">
                <span
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary/15 text-secondary shadow-sm ring-1 ring-secondary/20"
                  aria-hidden="true"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </span>
                <span class="min-w-0">
                  <span class="block text-sm font-semibold tracking-tight text-base-content">提醒设置</span>
                  <span class="mt-0.5 block text-xs font-normal text-base-content/50">自定义时间或遗忘曲线排期</span>
                </span>
              </h2>

              <div
                class="rounded-xl border border-base-300/80 bg-gradient-to-br from-base-200/80 to-base-100 p-5 shadow-inner sm:p-6"
              >
                <div class="mb-4 flex items-center justify-between gap-2">
                  <span class="text-sm font-semibold text-base-content">提醒方式</span>
                  <button
                    type="button"
                    class="btn btn-circle btn-ghost btn-xs h-7 w-7 min-h-0 text-base-content/40 hover:bg-base-300/50 hover:text-base-content"
                    title="自定义：按多个时间点排期。遗忘曲线：首次可选手动时间，其余按天偏移与统一时刻（以后端为准）。"
                  >
                    ?
                  </button>
                </div>

                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label
                    class="group relative flex cursor-pointer items-start gap-3 rounded-xl border-2 px-4 py-3.5 transition-all duration-200"
                    :class="
                      reminderStrategy === 1
                        ? 'border-primary bg-primary/10 shadow-sm shadow-primary/10'
                        : 'border-transparent bg-base-100 ring-1 ring-base-300 hover:ring-base-content/15'
                    "
                  >
                    <input
                      v-model.number="reminderStrategy"
                      type="radio"
                      name="reminderStrategy"
                      class="radio radio-primary radio-sm mt-0.5 shrink-0"
                      :value="1"
                    />
                    <span class="min-w-0">
                      <span class="block text-sm font-medium leading-snug">自定义多条</span>
                      <span class="mt-0.5 block text-xs text-base-content/50">自行指定多个提醒时间</span>
                    </span>
                  </label>
                  <label
                    class="group relative flex cursor-pointer items-start gap-3 rounded-xl border-2 px-4 py-3.5 transition-all duration-200"
                    :class="
                      reminderStrategy === 2
                        ? 'border-primary bg-primary/10 shadow-sm shadow-primary/10'
                        : 'border-transparent bg-base-100 ring-1 ring-base-300 hover:ring-base-content/15'
                    "
                  >
                    <input
                      v-model.number="reminderStrategy"
                      type="radio"
                      name="reminderStrategy"
                      class="radio radio-primary radio-sm mt-0.5 shrink-0"
                      :value="2"
                    />
                    <span class="min-w-0">
                      <span class="block text-sm font-medium leading-snug">遗忘曲线</span>
                      <span class="mt-0.5 block text-xs text-base-content/50">首次与后续节点由规则生成</span>
                    </span>
                  </label>
                </div>

                <div v-if="reminderStrategy === 1" class="mt-5 space-y-3 border-t border-base-300/80 pt-5">
                  <p class="text-xs text-base-content/50">至少填写一条完整日期时间。</p>
                  <ul class="space-y-2.5">
                    <li v-for="(_t, index) in newReview.remindTimes" :key="index" class="flex items-center gap-2">
                      <input
                        v-model="newReview.remindTimes[index]"
                        type="datetime-local"
                        class="input input-bordered input-sm min-w-0 flex-1 border-base-300 focus:border-primary focus:ring-2 focus:ring-primary/20"
                        :aria-label="`提醒时间 ${index + 1}`"
                      />
                      <button
                        type="button"
                        class="btn btn-square btn-ghost btn-sm shrink-0 text-base-content/50 hover:bg-error/10 hover:text-error"
                        title="删除"
                        @click="removeRemindTime(index)"
                      >
                        ✕
                      </button>
                    </li>
                  </ul>
                  <button type="button" class="btn btn-ghost btn-sm gap-1 text-primary" @click="addRemindTime">
                    <span class="text-base leading-none">＋</span>
                    添加时间
                  </button>
                </div>

                <div v-else class="mt-5 space-y-4 border-t border-base-300/80 pt-5">
                  <div class="grid gap-4 sm:grid-cols-2">
                    <label class="form-control w-full gap-1">
                      <span class="label py-0"><span class="label-text text-xs font-medium">第一次提醒</span></span>
                      <input
                        v-model="firstReminderAt"
                        type="datetime-local"
                        step="60"
                        class="input input-bordered w-full border-base-300 focus:border-primary focus:ring-2 focus:ring-primary/20"
                        :min="nowPlusOneMinuteLocal()"
                        title="可选"
                        aria-label="第一次提醒时间"
                      />
                    </label>
                    <label class="form-control w-full gap-1">
                      <span class="label py-0"><span class="label-text text-xs font-medium">后续统一时刻</span></span>
                      <input
                        v-model="curveRemindTime"
                        type="time"
                        step="60"
                        class="input input-bordered w-full border-base-300 focus:border-primary focus:ring-2 focus:ring-primary/20"
                        aria-label="遗忘曲线统一时分"
                      />
                    </label>
                  </div>
                  <p class="text-xs leading-relaxed text-base-content/45">
                    留空则由服务端按默认规则生成；天偏移与次数以后端为准。
                  </p>
                </div>
              </div>
            </section>

            <!-- 附件 -->
            <section class="space-y-4">
              <h2 class="flex items-center gap-3">
                <span
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent shadow-sm ring-1 ring-accent/25"
                  aria-hidden="true"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13"
                    />
                  </svg>
                </span>
                <span class="min-w-0">
                  <span class="block text-sm font-semibold tracking-tight text-base-content">附件</span>
                  <span class="mt-0.5 block text-xs font-normal text-base-content/50">图片或文件，可选</span>
                </span>
              </h2>

              <input ref="fileInputRef" type="file" class="hidden" multiple @change="onFilesSelected" aria-hidden="true" />
              <div
                role="button"
                tabindex="0"
                class="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition-all duration-200 sm:py-10"
                :class="
                  fileDropActive
                    ? 'border-primary bg-primary/10 scale-[1.01]'
                    : 'border-base-300/90 bg-base-200/30 hover:border-primary/40 hover:bg-base-200/50'
                "
                @click="openFilePicker"
                @keydown.enter.prevent="openFilePicker"
                @keydown.space.prevent="openFilePicker"
                @dragenter.prevent="onFileDragEnter"
                @dragover.prevent="fileDropActive = true"
                @dragleave.prevent="onFileDragLeave"
                @drop.prevent="onFileDrop"
              >
                <div class="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                </div>
                <p class="text-sm font-medium text-base-content">点击选择或拖放文件到此处</p>
                <p class="mt-1 max-w-sm text-xs text-base-content/50">
                  最多 {{ MAX_ATTACHMENT_COUNT }} 个，单个 ≤ {{ formatFileSize(MAX_ATTACHMENT_BYTES) }}
                </p>
              </div>
              <div v-if="attachmentError" class="mt-2 rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-xs text-error">
                {{ attachmentError }}
              </div>

              <ul v-if="pendingFiles.length" class="space-y-2">
                <li
                  v-for="(f, i) in pendingFiles"
                  :key="`${f.name}-${f.size}-${i}`"
                  class="flex items-center gap-3 rounded-lg border border-base-300/80 bg-base-100 px-3 py-2.5 text-sm shadow-sm"
                >
                  <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-base-200 text-base-content/50" aria-hidden="true">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                    </svg>
                  </span>
                  <div class="min-w-0 flex-1">
                    <div class="truncate font-medium" :title="f.name">{{ f.name }}</div>
                    <div class="text-xs text-base-content/45">{{ formatFileSize(f.size) }}</div>
                  </div>
                  <button type="button" class="btn btn-ghost btn-sm shrink-0 text-error/80 hover:bg-error/10" @click="removePendingFile(i)">
                    移除
                  </button>
                </li>
              </ul>
            </section>

            <div class="-mx-5 border-t border-base-200 bg-base-200/30 px-5 py-5 sm:-mx-8 sm:px-8">
              <button
                type="submit"
                class="btn btn-primary btn-block h-12 text-base font-semibold shadow-lg shadow-primary/25"
                :class="{ loading }"
                :disabled="loading"
              >
                {{ loading ? '' : '创建任务' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  </div>
</template>
