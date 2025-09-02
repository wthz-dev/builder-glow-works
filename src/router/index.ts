import { createRouter, createWebHistory, type NavigationGuardNext, type RouteLocationNormalized } from 'vue-router'

const routes = [
  {
    path: '/',
    component: () => import('../App.vue'), // temporary: keep App as customer view for now
  },
  {
    path: '/owner',
    component: () => import('../views/OwnerDashboard.vue'),
    meta: { requiresOwner: true },
  },
  {
    path: '/owner/menu',
    component: () => import('../views/OwnerMenu.vue'),
    meta: { requiresOwner: true },
  },
  {
    path: '/owner/print',
    component: () => import('../views/OwnerPrint.vue'),
    meta: { requiresOwner: true },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

function isOwnerLoggedIn(): boolean {
  try {
    return localStorage.getItem('noodle_owner_logged_in') === '1'
  } catch {
    return false
  }
}

function getOwnerPin(): string {
  try {
    return localStorage.getItem('noodle_owner_pin') || '1234'
  } catch {
    return '1234'
  }
}

router.beforeEach((to: RouteLocationNormalized, _from: RouteLocationNormalized, next: NavigationGuardNext) => {
  if (to.meta.requiresOwner) {
    if (isOwnerLoggedIn()) return next()
    // simple prompt-based auth to decouple from App.vue modal
    const pin = window.prompt('กรอกรหัส PIN เจ้าของร้าน')
    if (pin && pin === getOwnerPin()) {
      try { localStorage.setItem('noodle_owner_logged_in', '1') } catch {}
      return next()
    }
    return next('/')
  }
  return next()
})

export default router
