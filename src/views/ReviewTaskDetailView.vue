<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { completeReviewTask, editReviewTask, getReviewTask } from '@/api/backend'
import RichTextEditor from '@/components/RichTextEditor.vue'
import { formatFileSize, resolveAttachmentFileUrl } from '@/utils/attachmentUrl'
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

const taskAttachments = computed(() => {
  const t = task.value
  if (!t) return []
  const raw = t.attachments ?? t.Attachments
  return Array.isArray(raw) ? raw : []
})

function attachmentHref(att) {
  return resolveAttachmentFileUrl(att.fileUrl ?? att.file_url ?? '')
}

function attachmentName(att) {
  return att.originalFileName ?? att.original_file_name ?? '附件'
}

/** 将 LocalDateTime 字符串展示为「YYYY-MM-DD HH:mm」 */
function formatDisplayLocalDateTime(value) {
  if (!value) return '-'
  const s = String(value).trim()
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})/)
  if (m) return `${m[1]} ${m[2]}:${m[3]}`
  return s.replace('T', ' ').slice(0, 19)
}

const displayReminderTime = computed(() =>
  formatDisplayLocalDateTime(localScheduledAt.value || scheduledAt.value),
)

const imageAttachments = computed(() => taskAttachments.value.filter((a) => isImageAttachment(a)))

const fileAttachments = computed(() => taskAttachments.value.filter((a) => !isImageAttachment(a)))

function isImageAttachment(att) {
  const t = att.fileType ?? att.file_type
  if (t === 1) return true
  const ct = String(att.contentType ?? att.content_type ?? '').toLowerCase()
  return ct.startsWith('image/')
}

/** 大图预览（点击图片打开，不直接跳转下载） */
const previewAtt = ref(null)

/** 缩放倍数，通过增大 max-height 实现可滚动查看 */
const previewZoom = ref(1)
const PREVIEW_ZOOM_MIN = 0.25
const PREVIEW_ZOOM_MAX = 4
const PREVIEW_ZOOM_STEP = 0.25
/** 缩放 1 时的基准最大高度（vh） */
const PREVIEW_BASE_VH = 68

const previewImageUrl = computed(() =>
  previewAtt.value ? attachmentHref(previewAtt.value) : '',
)

const previewImgStyle = computed(() => {
  const z = previewZoom.value
  const vh = Math.min(400, PREVIEW_BASE_VH * z)
  return { maxHeight: `${vh}vh` }
})

function zoomPreviewIn() {
  previewZoom.value = Math.min(
    PREVIEW_ZOOM_MAX,
    Math.round((previewZoom.value + PREVIEW_ZOOM_STEP) * 100) / 100,
  )
}

function zoomPreviewOut() {
  previewZoom.value = Math.max(
    PREVIEW_ZOOM_MIN,
    Math.round((previewZoom.value - PREVIEW_ZOOM_STEP) * 100) / 100,
  )
}

function resetPreviewZoom() {
  previewZoom.value = 1
}

function onPreviewWheel(e) {
  if (!previewAtt.value) return
  e.preventDefault()
  if (e.deltaY < 0) zoomPreviewIn()
  else zoomPreviewOut()
}

function openImagePreview(att) {
  previewZoom.value = 1
  previewAtt.value = att
}

function closeImagePreview() {
  previewAtt.value = null
  previewZoom.value = 1
}

function onPreviewKeydown(e) {
  if (e.key === 'Escape') closeImagePreview()
  if (!previewAtt.value) return
  if (e.key === '+' || e.key === '=') {
    e.preventDefault()
    zoomPreviewIn()
  }
  if (e.key === '-' || e.key === '_') {
    e.preventDefault()
    zoomPreviewOut()
  }
  if (e.key === '0') {
    e.preventDefault()
    resetPreviewZoom()
  }
}

watch(previewAtt, (v) => {
  if (v) {
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onPreviewKeydown)
  } else {
    document.body.style.overflow = ''
    window.removeEventListener('keydown', onPreviewKeydown)
  }
})

onUnmounted(() => {
  document.body.style.overflow = ''
  window.removeEventListener('keydown', onPreviewKeydown)
})

/**
 * 优先 fetch + Blob 触发下载（可指定文件名）；跨域无 CORS 时回退为 a[download]。
 */
async function downloadAttachment(att) {
  const url = attachmentHref(att)
  const name = attachmentName(att)
  if (!url) return
  try {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit' })
    if (!res.ok) throw new Error('fetch failed')
    const blob = await res.blob()
    const objUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objUrl
    a.download = name
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(objUrl)
  } catch {
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }
}

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
  <div class="min-h-screen bg-gradient-to-b from-base-200 via-base-200 to-base-300/40 text-base-content">
    <div class="navbar border-b border-base-300/80 bg-base-100/95 shadow-sm backdrop-blur-sm">
      <div class="flex-1">
        <button type="button" class="btn btn-ghost" @click="goBackFromDetail">← 返回</button>
        <span class="text-sm text-base-content/60">任务详情</span>
      </div>
    </div>

    <main class="mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <div v-if="errorMessage" class="alert alert-error shadow-sm">
        <span>{{ errorMessage }}</span>
      </div>

      <div
        class="mt-4 overflow-hidden rounded-2xl border border-base-300/90 bg-base-100 shadow-lg shadow-base-300/30 ring-1 ring-black/5 sm:mt-6"
      >
        <div class="h-1 bg-gradient-to-r from-primary via-secondary to-accent" aria-hidden="true" />

        <div class="p-5 sm:p-8">
        <!-- 标题 + 完成按钮 -->
        <div class="flex flex-wrap items-start justify-between gap-4 border-b border-base-200 pb-6">
          <div class="min-w-0 flex-1">
            <h1 class="text-xl font-bold tracking-tight text-base-content sm:text-2xl">
              {{ task?.title || `任务 ${taskId}` }}
            </h1>
            <dl class="mt-4 space-y-2 text-sm">
              <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <dt class="shrink-0 text-base-content/50">提醒时间</dt>
                <dd class="font-mono text-sm font-medium text-base-content tabular-nums">
                  {{ displayReminderTime }}
                </dd>
              </div>
              <div v-if="notifyPhaseLabel" class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <dt class="shrink-0 text-base-content/50">通知阶段</dt>
                <dd>
                  <span class="badge badge-ghost badge-sm font-normal">{{ notifyPhaseLabel }}</span>
                </dd>
              </div>
            </dl>
          </div>
          <div class="flex flex-wrap items-center justify-end gap-2 rounded-xl border border-base-300/70 bg-base-200/35 p-1.5 shadow-sm">
            <button
              v-if="task && canEdit && !editing"
              type="button"
              class="btn h-10 min-h-10 gap-1.5 rounded-lg border border-transparent bg-base-100 px-4 text-sm font-medium text-base-content shadow-sm transition-all hover:-translate-y-0.5 hover:border-base-300/90 hover:bg-base-100 hover:shadow-md"
              :disabled="loading"
              @click="startEdit"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 opacity-65" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M17.414 2.586a2 2 0 010 2.828l-8.79 8.79a1 1 0 01-.39.242l-3.3 1.1a1 1 0 01-1.265-1.265l1.1-3.3a1 1 0 01.242-.39l8.79-8.79a2 2 0 012.828 0z" />
              </svg>
              编辑
            </button>
            <button
              v-if="!completed"
              type="button"
              class="btn h-10 min-h-10 rounded-lg border-0 bg-gradient-to-r from-primary to-secondary px-5 text-sm font-semibold text-white shadow-md shadow-primary/35 transition-all hover:-translate-y-0.5 hover:brightness-105 hover:shadow-lg hover:shadow-primary/40 disabled:translate-y-0 disabled:brightness-100"
              :disabled="loading || !isReminderTriggered"
              @click="onComplete"
            >
              {{ loading ? '提交中…' : '完成复习' }}
            </button>
            <span v-else class="badge badge-success badge-lg">已完成</span>
          </div>
        </div>

        <div v-if="completed" class="alert alert-success mt-5 text-sm shadow-sm">
          <span>该排期已标记完成，无需再次提交。</span>
        </div>
        <div v-else-if="!isReminderTriggered" class="alert alert-warning mt-5 text-sm shadow-sm">
          <span>{{ completeDisabledReason }}</span>
        </div>

        <!-- ===== 统一编辑面板 ===== -->
        <div v-if="editing" class="mt-6 rounded-xl border border-primary/25 bg-primary/5 p-5 space-y-4">
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
        <div v-else class="mt-8 space-y-8">
          <!-- 任务链接 -->
          <section>
            <h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-base-content/45">任务链接</h2>
            <div
              v-if="task?.noteUrl"
              class="rounded-xl border border-base-300/90 bg-base-200/30 px-4 py-3"
            >
              <a
                :href="task.noteUrl"
                class="link link-primary break-all text-sm font-medium leading-relaxed"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ task.noteUrl }}
              </a>
            </div>
            <p v-else class="flex items-center gap-2 rounded-xl border border-dashed border-base-300/80 bg-base-200/20 px-4 py-3 text-sm text-base-content/45">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
              </svg>
              未保存外链
            </p>
          </section>

          <!-- 附件：图片画廊 + 文件列表 -->
          <section v-if="taskAttachments.length">
            <h2 class="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-base-content/45">
              <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3A1.5 1.5 0 001.5 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008H12V8.25z" />
                </svg>
              </span>
              附件
              <span class="font-normal normal-case tracking-normal text-base-content/40">（{{ taskAttachments.length }}）</span>
            </h2>

            <div v-if="imageAttachments.length" class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <article
                v-for="att in imageAttachments"
                :key="`img-${att.id ?? attachmentHref(att)}`"
                class="overflow-hidden rounded-xl border border-base-300/90 bg-base-100 shadow-sm transition-shadow hover:shadow-md"
              >
                <button
                  type="button"
                  class="relative block w-full cursor-zoom-in bg-gradient-to-b from-base-200/90 to-base-200/40 text-left"
                  :title="`点击预览：${attachmentName(att)}`"
                  @click="openImagePreview(att)"
                >
                  <div class="flex aspect-[4/3] max-h-72 min-h-[11rem] items-center justify-center p-2 sm:min-h-[13rem]">
                    <img
                      :src="attachmentHref(att)"
                      :alt="attachmentName(att)"
                      class="pointer-events-none max-h-full max-w-full rounded-lg object-contain shadow-sm ring-1 ring-black/5"
                      loading="lazy"
                    />
                  </div>
                </button>
                <div class="border-t border-base-200 bg-base-100 px-3 py-2.5">
                  <div class="flex items-start justify-between gap-2">
                    <span
                      class="min-w-0 flex-1 truncate text-sm font-medium text-base-content"
                      :title="attachmentName(att)"
                    >
                      {{ attachmentName(att) }}
                    </span>
                    <button
                      type="button"
                      class="btn btn-ghost btn-xs shrink-0 gap-1 text-primary"
                      @click.stop="downloadAttachment(att)"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M12 4v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                      下载
                    </button>
                  </div>
                  <p class="mt-1 text-xs text-base-content/45">
                    {{ formatFileSize(att.fileSize ?? att.file_size) }}
                    <span v-if="att.contentType || att.content_type"> · {{ att.contentType ?? att.content_type }}</span>
                  </p>
                </div>
              </article>
            </div>

            <ul v-if="fileAttachments.length" :class="imageAttachments.length ? 'mt-4 space-y-2' : 'space-y-2'">
              <li
                v-for="att in fileAttachments"
                :key="`file-${att.id ?? attachmentHref(att)}`"
                class="flex items-center gap-3 rounded-xl border border-base-300/80 bg-base-200/25 px-3 py-2.5 transition-colors hover:bg-base-200/45"
              >
                <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-base-300/40 text-base-content/60">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </span>
                <div class="min-w-0 flex-1">
                  <a
                    :href="attachmentHref(att)"
                    class="link link-primary block truncate text-sm font-medium"
                    target="_blank"
                    rel="noopener noreferrer"
                    :title="attachmentName(att)"
                  >
                    {{ attachmentName(att) }}
                  </a>
                  <p class="text-xs text-base-content/45">
                    {{ formatFileSize(att.fileSize ?? att.file_size) }}
                    <span v-if="att.contentType || att.content_type"> · {{ att.contentType ?? att.content_type }}</span>
                  </p>
                </div>
                <a
                  :href="attachmentHref(att)"
                  class="btn btn-ghost btn-sm shrink-0 gap-1 text-primary"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  打开
                </a>
              </li>
            </ul>
          </section>

          <!-- 复习内容 -->
          <section>
            <h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-base-content/45">复习内容</h2>
            <div
              v-if="task?.noteContent"
              class="rich-content rounded-xl border border-base-300/90 bg-base-200/25 p-4 text-sm leading-relaxed sm:p-5"
              v-html="task.noteContent"
            />
            <p v-else class="rounded-xl border border-dashed border-base-300/80 bg-base-200/15 px-4 py-8 text-center text-sm text-base-content/45">
              暂无正文
            </p>
          </section>
        </div>
        </div>
      </div>
    </main>

    <Teleport to="body">
      <div
        v-if="previewAtt"
        class="fixed inset-0 z-[100] flex flex-col bg-black/85 p-4"
        role="dialog"
        aria-modal="true"
        aria-label="图片预览"
        @click.self="closeImagePreview"
      >
        <button
          type="button"
          class="btn btn-circle btn-ghost btn-sm absolute right-3 top-3 z-[110] border border-white/25 text-white hover:bg-white/10"
          aria-label="关闭预览"
          @click="closeImagePreview"
        >
          ✕
        </button>

        <!-- 缩放工具条 -->
        <div
          class="absolute left-3 top-3 z-[110] flex flex-wrap items-center gap-1 rounded-lg border border-white/20 bg-black/40 px-1.5 py-1 backdrop-blur-sm"
          @click.stop
        >
          <button
            type="button"
            class="btn btn-ghost btn-xs h-8 min-h-8 px-2 text-white hover:bg-white/15"
            aria-label="缩小"
            :disabled="previewZoom <= PREVIEW_ZOOM_MIN"
            @click="zoomPreviewOut"
          >
            −
          </button>
          <span class="min-w-[3.25rem] text-center text-xs tabular-nums text-white/90">
            {{ Math.round(previewZoom * 100) }}%
          </span>
          <button
            type="button"
            class="btn btn-ghost btn-xs h-8 min-h-8 px-2 text-white hover:bg-white/15"
            aria-label="放大"
            :disabled="previewZoom >= PREVIEW_ZOOM_MAX"
            @click="zoomPreviewIn"
          >
            +
          </button>
          <button
            type="button"
            class="btn btn-ghost btn-xs h-8 min-h-8 px-2 text-white/80 hover:bg-white/15"
            title="重置为 100%（快捷键 0）"
            @click="resetPreviewZoom"
          >
            复位
          </button>
        </div>

        <p class="pointer-events-none absolute left-3 top-14 z-[109] max-w-[14rem] text-[11px] leading-snug text-white/50 sm:top-12">
          滚轮缩放 · +/- 键 · 0 复位 · Esc 关闭
        </p>

        <!-- 可滚动区域：放大后可拖动滚动条查看边缘 -->
        <div
          class="mt-12 min-h-0 flex-1 overflow-auto overscroll-contain sm:mt-10"
          @wheel.prevent="onPreviewWheel"
          @click.self="closeImagePreview"
        >
          <div class="flex min-h-full min-w-full items-center justify-center p-4 pb-8">
            <img
              :src="previewImageUrl"
              :alt="attachmentName(previewAtt)"
              :style="previewImgStyle"
              class="max-w-full object-contain shadow-2xl transition-[max-height] duration-150 ease-out"
              @click.stop
            />
          </div>
        </div>

        <div
          class="mt-auto flex max-w-full flex-shrink-0 flex-wrap items-center justify-center gap-3 border-t border-white/10 pt-3"
          @click.stop
        >
          <span class="max-w-[min(100%,28rem)] truncate text-center text-sm text-white/90">
            {{ attachmentName(previewAtt) }}
          </span>
          <button
            type="button"
            class="btn btn-sm border-0 bg-white/15 text-white hover:bg-white/25"
            @click="downloadAttachment(previewAtt)"
          >
            下载原图
          </button>
        </div>
      </div>
    </Teleport>
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
