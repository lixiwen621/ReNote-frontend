<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAuthStore } from '@/stores/auth'
import { formatApiErrorMessage } from '@/utils/apiError'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const username = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')

const theme = ref(
  document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light',
)

function toggleTheme() {
  theme.value = theme.value === 'light' ? 'dark' : 'light'
  document.documentElement.setAttribute('data-theme', theme.value)
}

async function onSubmit() {
  errorMessage.value = ''
  if (!username.value.trim() || !password.value) {
    errorMessage.value = '请输入用户名和密码'
    return
  }
  try {
    loading.value = true
    await auth.login(username.value.trim(), password.value)
    const redirect =
      typeof route.query.redirect === 'string' && route.query.redirect
        ? route.query.redirect
        : '/'
    await router.replace(redirect)
  } catch (e) {
    errorMessage.value = formatApiErrorMessage(e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div
    class="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-base-200 px-4 py-10"
  >
    <!-- 背景：柔和渐变 + 光斑 -->
    <div
      class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent"
    />
    <div
      class="pointer-events-none absolute -right-24 top-0 h-[28rem] w-[28rem] rounded-full bg-secondary/25 blur-3xl"
    />
    <div
      class="pointer-events-none absolute -bottom-32 -left-16 h-[26rem] w-[26rem] rounded-full bg-accent/20 blur-3xl"
    />
    <div
      class="pointer-events-none absolute left-1/2 top-1/2 h-px w-[120%] -translate-x-1/2 -translate-y-1/2 rotate-[-8deg] bg-gradient-to-r from-transparent via-primary/10 to-transparent"
    />

    <div class="absolute right-4 top-4 z-10">
      <button
        type="button"
        class="btn btn-ghost btn-sm gap-2 rounded-full"
        aria-label="切换主题"
        @click="toggleTheme"
      >
        {{ theme === 'light' ? '🌙 深色' : '☀️ 浅色' }}
      </button>
    </div>

    <div
      class="pointer-events-none absolute bottom-6 left-0 right-0 text-center text-xs text-base-content/40"
    >
      ReNote · 复习提醒
    </div>

    <div
      class="card relative z-[1] w-full max-w-[420px] border border-base-300/80 bg-base-100/90 shadow-2xl backdrop-blur-md"
    >
      <div class="card-body gap-8 px-8 py-10 sm:px-10">
        <div class="flex flex-col items-center gap-3 text-center">
          <div
            class="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/20"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-8 w-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="1.5"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
              />
            </svg>
          </div>
          <div>
            <h1 class="text-2xl font-bold tracking-tight text-base-content">欢迎回来</h1>
            <p class="mt-1 text-sm text-base-content/60">登录后仅查看和管理你的复习任务</p>
          </div>
        </div>

        <form class="space-y-6" @submit.prevent="onSubmit" autocomplete="off">
          <label class="form-control w-full">
            <div class="label pt-0"><span class="label-text font-medium">用户名</span></div>
            <input
              v-model="username"
              type="text"
              autocomplete="off"
              class="input input-bordered input-md w-full transition focus:border-primary"
              placeholder="用户名或邮箱"
            />
          </label>

          <label class="form-control w-full">
            <div class="label pt-0"><span class="label-text font-medium">密码</span></div>
            <input
              v-model="password"
              type="password"
              autocomplete="new-password"
              class="input input-bordered input-md w-full transition focus:border-primary"
              placeholder="输入密码"
            />
          </label>

          <div v-if="errorMessage" role="alert" class="alert alert-error text-sm shadow-sm">
            <span>{{ errorMessage }}</span>
          </div>

          <div :class="errorMessage ? 'pt-1' : 'pt-3'">
            <button
              type="submit"
              class="btn btn-primary btn-block h-11 text-base font-medium shadow-lg shadow-primary/25"
              :class="{ loading }"
              :disabled="loading"
            >
              {{ loading ? '' : '登录' }}
            </button>
          </div>
        </form>

        <div class="text-center">
          <p class="text-xs leading-relaxed text-base-content/45">
            使用 Bearer Token 会话；登录成功后请求将自动携带凭证
          </p>
          <div class="mt-3 text-xs text-base-content/50">
            没有账号？
            <router-link class="link link-primary link-hover" to="/register">去注册</router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
