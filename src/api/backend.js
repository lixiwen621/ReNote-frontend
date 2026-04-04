import { clearAccessToken, getAccessToken } from '@/auth/token'

// 开发环境优先走 Vite proxy（避免 CORS）；生产环境再使用 VITE_API_BASE_URL
const API_BASE_URL = import.meta.env.DEV
  ? ''
  : (import.meta.env.VITE_API_BASE_URL ?? '')

async function parseJsonResponse(response) {
  const text = await response.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('服务器返回非 JSON')
  }
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

  if (response.status === 401) {
    clearAccessToken()
    window.location.assign(`/login?redirect=${encodeURIComponent(window.location.pathname)}`)
    throw new Error('登录已过期，请重新登录')
  }

  const payload = await parseJsonResponse(response)

  if (payload?.code !== 0) {
    throw new Error(payload?.message || '请求失败')
  }

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
