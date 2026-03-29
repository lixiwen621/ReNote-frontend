import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { getMe as getMeRequest, login as loginRequest, register as registerRequest } from '@/api/backend'
import { clearAccessToken, getAccessToken, setAccessToken } from '@/auth/token'

const USER_KEY = 'renote_user'

function readStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref(getAccessToken())
  const user = ref(readStoredUser())

  const isAuthenticated = computed(() => Boolean(accessToken.value))

  function persistUser(u) {
    user.value = u
    if (u) localStorage.setItem(USER_KEY, JSON.stringify(u))
    else localStorage.removeItem(USER_KEY)
  }

  function setSession(token, userPayload) {
    accessToken.value = token
    setAccessToken(token)
    persistUser(userPayload ?? null)
  }

  function normalizeLoginPayload(data) {
    if (!data || typeof data !== 'object') return { token: '', user: null }

    const token = data.accessToken ?? data.access_token ?? data.token ?? ''

    let user = data.user ?? data.userInfo ?? null
    if (!user && data.userId != null) {
      user = { id: data.userId }
    }

    // 后端 /api/auth/me 才返回 username，这里仅兜底
    if (user && data.username != null && user.username == null) user.username = data.username

    return { token, user }
  }

  async function loadMe() {
    const me = await getMeRequest()
    if (!me) return
    const userId = me.userId ?? me.id
    if (userId == null) return
    persistUser({
      id: userId,
      username: me.username,
    })
  }

  async function login(username, password) {
    const data = await loginRequest({ username, password })
    const { token, user: userPayload } = normalizeLoginPayload(data)
    if (!token) throw new Error('登录响应缺少 accessToken')
    setSession(token, userPayload)

    // 联调阶段：如果登录响应未带用户名，则用 /api/auth/me 补齐
    try {
      await loadMe()
    } catch {
      // 忽略；不影响进入首页
    }
  }

  async function register(username, password) {
    const data = await registerRequest({ username, password })
    const { token, user: userPayload } = normalizeLoginPayload(data)
    if (!token) throw new Error('注册响应缺少 accessToken')
    setSession(token, userPayload)

    try {
      await loadMe()
    } catch {
      // ignore
    }
  }

  function logout() {
    accessToken.value = ''
    clearAccessToken()
    persistUser(null)
  }

  return {
    accessToken,
    user,
    isAuthenticated,
    login,
    register,
    logout,
    setSession,
    loadMe,
  }
})
