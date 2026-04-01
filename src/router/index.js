import { createRouter, createWebHistory } from 'vue-router'

import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/views/RegisterView.vue'),
      meta: { public: true },
    },
    {
      path: '/tasks/new',
      name: 'task_new',
      component: () => import('@/views/ReviewTaskCreateView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/tasks/:taskId',
      name: 'task_detail',
      component: () => import('@/views/ReviewTaskDetailView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/week',
      name: 'week_schedule',
      component: () => import('@/views/WeekScheduleView.vue'),
      meta: { requiresAuth: true },
    },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return {
      name: 'login',
      query: { redirect: to.fullPath !== '/' ? to.fullPath : undefined },
    }
  }
  if (to.name === 'login' && auth.isAuthenticated) {
    return { name: 'home' }
  }
  if (to.name === 'register' && auth.isAuthenticated) {
    return { name: 'home' }
  }
  return true
})

export default router
