import { clearAccessToken, getAccessToken } from '@/auth/token'

// 开发环境优先走 Vite proxy（避免 CORS）；生产环境再使用 VITE_API_BASE_URL
const API_BASE_URL = import.meta.env.DEV
  ? ''
  : (import.meta.env.VITE_API_BASE_URL ?? '')

let authExpiredHandled = false

async function parseJsonResponse(response) {
  const text = await response.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('服务器返回非 JSON')
  }
}

function redirectToLoginWithCleanup() {
  if (authExpiredHandled) return
  authExpiredHandled = true
  clearAccessToken()
  window.location.assign(`/login?redirect=${encodeURIComponent(window.location.pathname)}`)
}

function resolveApiErrorMessage(payload, status) {
  const code = Number(payload?.code)
  const rawMessage = typeof payload?.message === 'string' ? payload.message.trim() : ''
  const message = rawMessage || '请求失败'

  if (code === 400) return message
  if (code === 401) return '登录已失效，请重新登录'
  if (code === 403) return rawMessage || '无权限访问'
  if (code === 422) return message
  if (code === 500) return rawMessage || '系统异常，请稍后重试'

  // 兜底：网关/反向代理非 2xx 且没有明确业务码
  if (status >= 500) return rawMessage || '系统异常，请稍后重试'
  if (status >= 400) return rawMessage || `请求失败（HTTP ${status}）`

  return message
}

function assertApiSuccess(payload, response) {
  const code = Number(payload?.code)
  if (code === 200) return

  if (response.status === 401 || code === 401) {
    redirectToLoginWithCleanup()
    throw new Error('登录已失效，请重新登录')
  }

  throw new Error(resolveApiErrorMessage(payload, response.status))
}

async function request(path, options = {}) {
  const { skipAuth, ...fetchOptions } = options
  const headers = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers || {}),
  }

  if (!skipAuth) {
    const token = getAccessToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...fetchOptions,
    headers,
  })

  const payload = await parseJsonResponse(response)
  assertApiSuccess(payload, response)

  return payload.data
}

export function login(body) {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
    skipAuth: true,
  })
}

export function register(body) {
  return request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(body),
    skipAuth: true,
  })
}

export function getMe() {
  return request('/api/auth/me')
}

export function createReviewTask(body) {
  return request('/api/review-tasks', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/**
 * 创建复习任务（含附件）。multipart/form-data：task 为 JSON 段，files 为多文件。
 * @param {Record<string, unknown>} taskPayload 与 POST /api/review-tasks 的 JSON body 一致
 * @param {File[]} files
 */
export async function createReviewTaskMultipart(taskPayload, files = []) {
  const token = getAccessToken()
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`

  const formData = new FormData()
  formData.append(
    'task',
    new Blob([JSON.stringify(taskPayload)], { type: 'application/json' }),
  )
  for (const f of files) {
    formData.append('files', f)
  }

  const response = await fetch(`${API_BASE_URL}/api/review-tasks/multipart`, {
    method: 'POST',
    headers,
    body: formData,
  })

  const payload = await parseJsonResponse(response)
  assertApiSuccess(payload, response)

  return payload.data
}

export function getReviewTask(taskId) {
  return request(`/api/review-tasks/${taskId}`)
}

export function getReviewTaskSchedules(taskId) {
  return request(`/api/review-tasks/${taskId}/schedules`)
}

export function getReviewTasksOverview(date) {
  const query = date ? `?date=${encodeURIComponent(date)}` : ''
  return request(`/api/review-tasks/overview${query}`)
}

export function getTodayReviewTasks(date) {
  const query = date ? `?date=${encodeURIComponent(date)}` : ''
  return request(`/api/review-tasks/today${query}`)
}

export function getReviewTasksWeek(date) {
  const query = date ? `?date=${encodeURIComponent(date)}` : ''
  return request(`/api/review-tasks/week${query}`)
}

export function updateReviewTaskScheduleTime(taskId, scheduleId, scheduledAt) {
  return request(`/api/review-tasks/${taskId}/schedules/${scheduleId}/time`, {
    method: 'PATCH',
    body: JSON.stringify({ scheduledAt }),
  })
}

export function updateReviewTaskNoteUrl(taskId, noteUrl) {
  return request(`/api/review-tasks/${taskId}/note-url`, {
    method: 'PATCH',
    body: JSON.stringify({ noteUrl }),
  })
}

export function completeReviewTask(taskId, body) {
  return request(`/api/review-tasks/${taskId}/complete`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function updateReviewTaskNoteContent(taskId, noteContent) {
  return request(`/api/review-tasks/${taskId}/note-content`, {
    method: 'PATCH',
    body: JSON.stringify({ noteContent }),
  })
}

export function editReviewTask(taskId, body) {
  return request(`/api/review-tasks/${taskId}/edit`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function bindWechatNotify(body) {
  return request('/api/notify/bind/wechat', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function sendWechatNotify(body) {
  return request('/api/notify/send/wechat', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function dispatchReminders() {
  return request('/api/reminders/dispatch', { method: 'POST' })
}

export async function hello() {
  const headers = {}
  const token = getAccessToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(`${API_BASE_URL}/api/hello`, { headers })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.text()
}
