<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { createReviewTask } from '@/api/backend'
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

    const base = {
      title: newReview.value.title.trim(),
      sourceType: Number(newReview.value.sourceType),
      noteUrl: newReview.value.noteUrl.trim() || null,
      noteContent: newReview.value.noteContent.trim() || null,
      timezone: DEFAULT_TIMEZONE,
    }

    let payload
    if (reminderStrategy.value === 1) {
      const remindTimes = filledRemindTimes.value.map(normalizeLocalDateTimeInput)
      payload = {
        ...base,
        reminderStrategy: 1,
        remindTimes,
      }
    } else {
      payload = {
        ...base,
        reminderStrategy: 2,
      }
      const first = normalizeLocalDateTimeInput(firstReminderAt.value)
      if (first) payload.firstReminderAt = first
      const curve = normalizeCurveRemindTime(curveRemindTime.value)
      if (curve) payload.curveRemindTime = curve
    }

    const data = await createReviewTask(payload)
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
  <div class="min-h-screen bg-base-200 text-base-content">
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

    <main class="mx-auto max-w-2xl px-4 py-8">
      <div v-if="message" class="alert alert-success mb-3 text-sm">
        <span>{{ message }}</span>
      </div>
      <div v-if="errorMessage" class="alert alert-error mb-3 text-sm">
        <span>{{ errorMessage }}</span>
      </div>

      <div class="rounded-box border border-base-300 bg-base-100 p-6 shadow-sm">
        <h2 class="text-lg font-semibold">创建复习任务</h2>

        <fieldset class="fieldset mt-6 gap-5">
          <label class="fieldset-label gap-1">
            <span class="label-text font-medium">标题</span>
            <input v-model="newReview.title" type="text" class="input input-bordered w-full" placeholder="例如：第三章并发" />
          </label>

          <label class="fieldset-label gap-1">
            <span class="label-text font-medium">来源</span>
            <select v-model.number="newReview.sourceType" class="select select-bordered w-full">
              <option :value="1">印象笔记</option>
              <option :value="2">其他</option>
            </select>
          </label>

          <label class="fieldset-label gap-1">
            <span class="label-text font-medium">复习内容</span>
            <textarea
              v-model="newReview.noteContent"
              class="textarea textarea-bordered min-h-24 w-full text-sm leading-relaxed"
              placeholder="范围与要点，不必全文粘贴"
            />
          </label>

          <label class="fieldset-label gap-1">
            <span class="label-text font-medium">外链（可选）</span>
            <input v-model="newReview.noteUrl" type="url" class="input input-bordered w-full" placeholder="https://…" />
          </label>

          <label class="fieldset-label gap-1">
            <span class="label-text font-medium text-base-content/60">时区</span>
            <input
              type="text"
              class="input input-bordered input-sm w-full max-w-xs cursor-not-allowed bg-base-200"
              :value="DEFAULT_TIMEZONE"
              readonly
              tabindex="-1"
            />
          </label>

          <!-- 提醒：单卡片 -->
          <div class="rounded-box border border-base-300 bg-base-200/40 p-4">
            <div class="flex items-start gap-2">
              <span class="text-sm font-medium leading-6">提醒方式</span>
              <button
                type="button"
                class="btn btn-ghost btn-xs mt-0.5 h-6 min-h-0 px-1.5 text-base-content/50"
                title="自定义：按你填的多个时间排期。遗忘曲线：首次可选手动时间；之后各次在「创建日 + 天偏移」上使用统一时分（具体以后端为准）。"
              >
                ?
              </button>
            </div>

            <div class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label
                class="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition"
                :class="
                  reminderStrategy === 1
                    ? 'border-primary bg-primary/10'
                    : 'border-base-300 bg-base-100 hover:border-base-content/20'
                "
              >
                <input v-model.number="reminderStrategy" type="radio" name="reminderStrategy" class="radio radio-primary radio-sm" :value="1" />
                <span class="text-sm">自定义多条时间</span>
              </label>
              <label
                class="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition"
                :class="
                  reminderStrategy === 2
                    ? 'border-primary bg-primary/10'
                    : 'border-base-300 bg-base-100 hover:border-base-content/20'
                "
              >
                <input v-model.number="reminderStrategy" type="radio" name="reminderStrategy" class="radio radio-primary radio-sm" :value="2" />
                <span class="text-sm">遗忘曲线</span>
              </label>
            </div>

            <!-- 策略 1 -->
            <div v-if="reminderStrategy === 1" class="mt-4 space-y-3 border-t border-base-300 pt-4">
              <p class="text-xs text-base-content/50">至少一条；每条为完整日期时间。</p>
              <ul class="flex flex-col gap-2">
                <li v-for="(_t, index) in newReview.remindTimes" :key="index" class="flex items-center gap-2">
                  <input
                    v-model="newReview.remindTimes[index]"
                    type="datetime-local"
                    class="input input-bordered input-sm min-w-0 flex-1"
                    :aria-label="`提醒时间 ${index + 1}`"
                  />
                  <button type="button" class="btn btn-ghost btn-square btn-xs shrink-0" title="删除" @click="removeRemindTime(index)">
                    ✕
                  </button>
                </li>
              </ul>
              <button type="button" class="btn btn-outline btn-xs" @click="addRemindTime">＋ 添加一条</button>
            </div>

            <!-- 策略 2 -->
            <div v-else class="mt-4 space-y-4 border-t border-base-300 pt-4">
              <div class="grid gap-4 sm:grid-cols-2">
                <label class="form-control w-full">
                  <span class="label py-0 pb-1">
                    <span class="label-text text-sm">第一次提醒</span>
                  </span>
                  <input
                    v-model="firstReminderAt"
                    type="datetime-local"
                    step="60"
                    class="input input-bordered input-sm w-full"
                    :min="nowPlusOneMinuteLocal()"
                    title="可选；填写须晚于当前时刻且不可与当前分钟相同"
                    aria-label="第一次提醒时间"
                  />
                </label>
                <label class="form-control w-full">
                  <span class="label py-0 pb-1">
                    <span class="label-text text-sm">其余次数统一时刻</span>
                  </span>
                  <input
                    v-model="curveRemindTime"
                    type="time"
                    step="60"
                    class="input input-bordered input-sm w-full max-w-[12rem]"
                    title="第 2 次及以后节点的时:分；不填则用服务端默认"
                    aria-label="遗忘曲线统一时分"
                  />
                </label>
              </div>
              <p class="text-xs text-base-content/45">
                不填则由服务端按默认规则生成；天偏移与次数以后端配置为准。
              </p>
            </div>
          </div>

          <div class="pt-1">
            <button type="button" class="btn btn-primary w-full sm:w-auto" :disabled="loading" @click="submitReviewTask">
              {{ loading ? '保存中…' : '保存' }}
            </button>
          </div>
        </fieldset>
      </div>
    </main>
  </div>
</template>
