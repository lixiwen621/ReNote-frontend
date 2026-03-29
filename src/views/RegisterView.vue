<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { useAuthStore } from '@/stores/auth'
import { formatApiErrorMessage } from '@/utils/apiError'

const auth = useAuthStore()
const router = useRouter()

const username = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')

async function onSubmit() {
  errorMessage.value = ''
  if (!username.value.trim() || !password.value) {
    errorMessage.value = '请输入用户名和密码'
    return
  }

  try {
    loading.value = true
    await auth.register(username.value.trim(), password.value)
    router.replace('/')
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
    <div
      class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent"
    />
    <div
      class="pointer-events-none absolute -right-24 top-0 h-[28rem] w-[28rem] rounded-full bg-secondary/25 blur-3xl"
    />
    <div
      class="pointer-events-none absolute -bottom-32 -left-16 h-[26rem] w-[26rem] rounded-full bg-accent/20 blur-3xl"
    />

    <div
      class="card relative z-[1] w-full max-w-[420px] border border-base-300/80 bg-base-100/90 shadow-2xl backdrop-blur-md"
    >
      <div class="card-body gap-8 px-8 py-10">
        <div class="flex flex-col items-center gap-2 text-center">
          <h1 class="text-2xl font-bold tracking-tight text-base-content">创建账号</h1>
          <p class="text-sm text-base-content/60">注册后即可用你的复习任务开始学习</p>
        </div>

        <form class="space-y-5" @submit.prevent="onSubmit" autocomplete="off">
          <label class="form-control w-full">
            <div class="label pt-0"><span class="label-text font-medium">用户名</span></div>
            <input
              v-model="username"
              type="text"
              autocomplete="off"
              class="input input-bordered input-md w-full transition focus:border-primary"
              placeholder="用户名"
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

          <button
            type="submit"
            class="btn btn-primary btn-block h-11 text-base font-medium shadow-lg shadow-primary/25"
            :disabled="loading"
          >
            {{ loading ? '注册中…' : '注册并进入首页' }}
          </button>
        </form>

        <div class="text-center text-xs text-base-content/50">
          已有账号？
          <router-link class="link link-primary link-hover" to="/login">去登录</router-link>
        </div>
      </div>
    </div>
  </div>
</template>

