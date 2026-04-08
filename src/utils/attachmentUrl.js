/**
 * 将附件 fileUrl 转为浏览器可打开的地址。
 * - 已是 http(s) 则原样返回（如 COS）。
 * - 相对路径 /uploads/...：生产环境拼 VITE_API_BASE_URL；开发环境依赖同源 + Vite 代理 /uploads。
 */
export function resolveAttachmentFileUrl(fileUrl) {
  if (!fileUrl || typeof fileUrl !== 'string') return ''
  const u = fileUrl.trim()
  if (!u) return ''
  if (/^https?:\/\//i.test(u)) return u
  if (u.startsWith('/')) {
    const base = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
    if (base) return `${base}${u}`
    return u
  }
  return u
}

export function formatFileSize(bytes) {
  const n = Number(bytes)
  if (!Number.isFinite(n) || n < 0) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
