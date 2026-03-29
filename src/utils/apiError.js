/**
 * 展示后端统一结构中的 `message`（request 在 code≠0 时写入 Error.message）。
 * 勿在前端写死「用户名或密码错误」等文案，以免与后端策略不一致。
 */
export function formatApiErrorMessage(error, fallback = '请求失败') {
  if (error instanceof Error && typeof error.message === 'string') {
    const text = error.message.trim()
    if (text) return text
  }
  return fallback
}
