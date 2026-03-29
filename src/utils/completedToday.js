const STORAGE_PREFIX = 'renote-completed-schedules'

/** 与概览/今日列表请求的 date 参数一致（用户本机日历日） */
export function todayDateStr() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function storageKey(dateStr) {
  return `${STORAGE_PREFIX}:${dateStr}`
}

function scheduleKey(taskId, scheduleId, scheduledAt) {
  if (scheduleId != null && scheduleId !== '' && !Number.isNaN(Number(scheduleId))) {
    return `s:${Number(scheduleId)}`
  }
  return `t:${taskId}:${scheduledAt || ''}`
}

export function markScheduleCompletedForDate(dateStr, taskId, scheduleId, scheduledAt) {
  const key = storageKey(dateStr)
  const set = new Set(JSON.parse(sessionStorage.getItem(key) || '[]'))
  set.add(scheduleKey(taskId, scheduleId, scheduledAt))
  sessionStorage.setItem(key, JSON.stringify([...set]))
}

export function isScheduleMarkedCompleted(dateStr, taskId, scheduleId, scheduledAt) {
  const key = storageKey(dateStr)
  const set = new Set(JSON.parse(sessionStorage.getItem(key) || '[]'))
  return set.has(scheduleKey(taskId, scheduleId, scheduledAt))
}

/**
 * 「复习已完成」仅看显式标记：`scheduleStatus=3` 表示通知已发，不代表复习已做。
 * 今日列表项在产生 review_record 前不会消失；完成态主要靠本机 session 标记。
 */
export function isScheduleDoneByPayload(item) {
  if (item?.completed === true || item?.completed_today === true) return true
  return false
}
