<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

// ===== Types =====
interface MenuItem {
  id: string
  name: string
  price: number
  image: string
  category: string
  soldOut?: boolean
}

// Helpers for Orders panel
function statusTh(s: string) {
  const m: Record<string, string> = {
    New: 'รับออเดอร์แล้ว',
    Cooking: 'กำลังทำ',
    Served: 'เสิร์ฟแล้ว',
    Canceled: 'ยกเลิก',
    Paid: 'ชำระแล้ว',
  }
  return m[s] || s
}
function formatTime(ts?: number) {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

// Migration will run after orders are initialized

// (routing migration in progress)

// Minimal stubs to satisfy existing template refs while we move print UI to its own route
const ownerPrintOpen = ref(false)
function openPrintPosters() { router.push('/owner/print') }
function closePrintPosters() { ownerPrintOpen.value = false }
function triggerPrint() { window.print() }

interface CartItem {
  id: string
  name: string
  basePrice: number
  quantity: number
  options: {
    noodle: string
    soup: string
    spice: string
    toppings: string[]
    note: string
  }
}

interface Order {
  id: string
  orderNo: string
  table: string
  items: CartItem[]
  total: number
  status: 'New' | 'Paid' | 'Cooking' | 'Served' | 'Canceled'
  createdAt: number
  slipName?: string
}

interface TableInfo {
  no: number
  status: 'VACANT' | 'ORDERING' | 'EATING' | 'BILLING' | 'CLEANING'
}

// ===== Brand / Context =====
const brandName = 'ร้านก๋วยเตี๋ยวเส้นทอง'
const TABLE_COUNT = 20
const tableRef = ref<string>('-')
const table = computed(() => tableRef.value)

function isValidTable(no: string) {
  const n = Number(no)
  return Number.isInteger(n) && n >= 1 && n <= TABLE_COUNT
}

function setTable(no: string) {
  tableRef.value = no
  try {
    localStorage.setItem('noodle_current_table', no)
  } catch {}
  const url = new URL(window.location.href)
  url.searchParams.set('table', no)
  history.replaceState({}, '', url.toString())
}

const tablePromptOpen = ref(false)
const tableInput = ref<string | number>('')

function ensureTable() {
  const url = new URL(window.location.href)
  const fromUrl = url.searchParams.get('table')
  let candidate = fromUrl || null
  if (!candidate) {
    try {
      candidate = localStorage.getItem('noodle_current_table')
    } catch {}
  }
  if (candidate && isValidTable(candidate)) {
    setTable(String(Number(candidate)))
  } else {
    tablePromptOpen.value = true
  }
}

function confirmTable() {
  const raw = tableInput.value as unknown
  const val = String(typeof raw === 'number' ? Math.trunc(raw as number) : (raw ?? ''))
    .trim()
  if (!isValidTable(val)) {
    toast(`กรุณาใส่เลขโต๊ะ 1–${TABLE_COUNT}`)
    return
  }
  setTable(String(Number(val)))
  tablePromptOpen.value = false
}

// ===== Category / Menu =====
const categories = [
  'ทั้งหมด',
  'ก๋วยเตี๋ยว',
  'เย็นตาโฟ',
  'ต้มยำ',
  'แห้ง',
  'ของทานเล่น',
  'เครื่องดื่ม',
]
const selectedCategory = ref('ทั้งหมด')

const loading = ref(true)

function loadLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

const menu = reactive<MenuItem[]>(
  loadLocal<MenuItem[]>('noodle_menu', [
    {
      id: '1',
      name: 'เส้นเล็กน้ำใสหมู',
      price: 55,
      image:
        'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?q=80&w=1200&auto=format&fit=crop',
      category: 'ก๋วยเตี๋ยว',
    },
    {
      id: '2',
      name: 'บะหมี่แห้งหมูแดง',
      price: 60,
      image:
        'https://images.unsplash.com/photo-1557872943-16a5ac26437b?q=80&w=1200&auto=format&fit=crop',
      category: 'แห้ง',
    },
    {
      id: '3',
      name: 'เส้นใหญ่ต้มยำ',
      price: 65,
      image:
        'https://images.unsplash.com/photo-1563245372-f21724e3856d?q=80&w=1200&auto=format&fit=crop',
      category: 'ต้มยำ',
    },
    {
      id: '4',
      name: 'เย็นตาโฟเส้นหมี่',
      price: 60,
      image:
        'https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=1200&auto=format&fit=crop',
      category: 'เย็นตาโฟ',
    },
    {
      id: '5',
      name: 'เกี๊ยวกรอบ',
      price: 35,
      image:
        'https://images.unsplash.com/photo-1526318472351-c75fcf070305?q=80&w=1200&auto=format&fit=crop',
      category: 'ของทานเล่น',
    },
    {
      id: '6',
      name: 'ชามะนาว',
      price: 25,
      image:
        'https://images.unsplash.com/photo-1516685018646-549198525c1b?q=80&w=1200&auto=format&fit=crop',
      category: 'เครื่องดื่ม',
    },
  ]),
)

watch(menu, () => localStorage.setItem('noodle_menu', JSON.stringify(menu)), { deep: true })

const filteredMenu = computed(() =>
  selectedCategory.value === 'ทั้งหมด'
    ? menu
    : menu.filter((m) => m.category === selectedCategory.value),
)

// ===== Cart / Checkout =====
const cart = ref<CartItem[]>([])
const promoCode = ref('')
const discount = ref(0)
const cartCount = computed(() => cart.value.reduce((a, c) => a + c.quantity, 0))
const subtotal = computed(() => cart.value.reduce((a, c) => a + c.basePrice * c.quantity, 0))
const total = computed(() => Math.max(0, subtotal.value - discount.value))

const showDetail = ref(false)
const detailItem = ref<MenuItem | null>(null)

const form = reactive({
  noodle: 'เส้นเล็ก',
  soup: 'น้ำใส',
  spice: 'ไม่เผ็ด',
  toppings: [] as string[],
  note: '',
  quantity: 1,
})

function openDetail(item: MenuItem) {
  if (item.soldOut || isLockedForOrdering.value) return
  detailItem.value = item
  Object.assign(form, {
    noodle: 'เส้นเล็ก',
    soup: 'น้ำใส',
    spice: 'ไม่เผ็ด',
    toppings: [],
    note: '',
    quantity: 1,
  })
  showDetail.value = true
}

function toggleTopping(t: string) {
  const i = form.toppings.indexOf(t)
  if (i > -1) form.toppings.splice(i, 1)
  else form.toppings.push(t)
}

function addToCart() {
  if (isLockedForOrdering.value) {
    toast('ออเดอร์นี้ชำระแล้ว ไม่สามารถสั่งเพิ่มได้')
    return
  }
  if (!detailItem.value) return
  const id = `${detailItem.value.id}-${form.noodle}-${form.soup}-${form.spice}-${[...form.toppings].sort().join('.')}-${form.note}`
  const existing = cart.value.find((c) => c.id === id)
  if (existing) existing.quantity += form.quantity
  else
    cart.value.push({
      id,
      name: detailItem.value.name,
      basePrice: detailItem.value.price,
      quantity: form.quantity,
      options: {
        noodle: form.noodle,
        soup: form.soup,
        spice: form.spice,
        toppings: [...form.toppings],
        note: form.note.trim(),
      },
    })
  showDetail.value = false
  toast('เพิ่มลงตะกร้าแล้ว')
}

function inc(i: number) {
  cart.value[i].quantity++
}
function dec(i: number) {
  if (cart.value[i].quantity > 1) cart.value[i].quantity--
  else cart.value.splice(i, 1)
}

function applyPromo() {
  const code = promoCode.value.trim().toUpperCase()
  if (!code) {
    discount.value = 0
    return
  }
  if (code === 'SAVE10') {
    discount.value = Math.round(subtotal.value * 0.1)
    toast('ใช้โค้ดส่วนลด 10%')
  } else {
    discount.value = 0
    toast('โค้ดไม่ถูกต้อง')
  }
}

const showCart = ref(false)
const checkoutStep = ref<'cart' | 'payment' | 'status'>('cart')
const paymentStatus = ref<'pending' | 'paid' | 'failed'>('pending')
const slipName = ref('')
const orderId = ref('')

// ===== Orders / Tables (Owner) =====
const orders = reactive<Order[]>(loadLocal<Order[]>('noodle_orders', []))
watch(orders, () => localStorage.setItem('noodle_orders', JSON.stringify(orders)), { deep: true })

// Run migration now that orders exist
;(function migrateOrderNos() {
  const byOldest = orders.slice().sort((a, b) => a.createdAt - b.createdAt)
  const seqPerDay: Record<string, number> = {}
  for (const o of byOldest) {
    const d = new Date(o.createdAt)
    const yy = String(d.getFullYear()).slice(-2)
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const datePart = `${yy}${mm}${dd}`
    if (!o.orderNo) {
      const key = `noodle_order_seq_${datePart}`
      const current = (seqPerDay[datePart] ?? Number(localStorage.getItem(key) || '0')) + 1
      seqPerDay[datePart] = current
      o.orderNo = `${datePart}-${String(current).padStart(3, '0')}`
    } else {
      const match = o.orderNo.match(/^(\d{6})-(\d{3,})$/)
      if (match) {
        const dp = match[1]
        const num = Number(match[2])
        seqPerDay[dp] = Math.max(seqPerDay[dp] ?? 0, num)
      }
    }
  }
  for (const [datePart, n] of Object.entries(seqPerDay)) {
    const key = `noodle_order_seq_${datePart}`
    const prev = Number(localStorage.getItem(key) || '0')
    if (n > prev) localStorage.setItem(key, String(n))
  }
})()

// Global running order number per day: YYMMDD-XXX (e.g., 250902-001)
function nextOrderNo(): string {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(-2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const datePart = `${yy}${mm}${dd}`
  const key = `noodle_order_seq_${datePart}`
  const current = Number(localStorage.getItem(key) || '0') + 1
  localStorage.setItem(key, String(current))
  return `${datePart}-${String(current).padStart(3, '0')}`
}

const tables = reactive<TableInfo[]>(
  loadLocal<TableInfo[]>(
    'noodle_tables',
    Array.from({ length: TABLE_COUNT }).map((_, i) => ({ no: i + 1, status: 'VACANT' }) as TableInfo),
  ),
)
watch(tables, () => localStorage.setItem('noodle_tables', JSON.stringify(tables)), { deep: true })

function openCart() {
  checkoutStep.value = 'cart'
  showCart.value = true
}
// Start billing: aggregate all unpaid orders for this table into one payment
function startBilling() {
  checkoutStep.value = 'payment'
  showCart.value = true
  paymentStatus.value = 'pending'
}
// Keep legacy function used by template (opens cart read-only when all paid)
function openCartLocked() {
  checkoutStep.value = 'cart'
  showCart.value = true
}

// Multi-order: allow ordering while there are unpaid orders.
// Lock only if there is at least one order and all are paid.
const unpaidOrdersForTable = computed(() =>
  orders.filter((o) => o.table === String(table.value) && o.status !== 'Paid'),
)
const hasAnyOrderForTable = computed(() =>
  orders.some((o) => o.table === String(table.value)),
)
const isLockedForOrdering = computed(
  () => hasAnyOrderForTable.value && unpaidOrdersForTable.value.length === 0,
)
// Legacy shim: previously toggled an override; now simply inform the user
function startAdditionalOrder() {
  toast('เริ่มสั่งเพิ่มได้เลย')
}

function closeTableForNewCustomer() {
  if (!confirm('ปิดโต๊ะและเตรียมสำหรับลูกค้าใหม่?')) return
  // Clear current cart
  cart.value = []
  // Mark table as VACANT
  const idx = Number(table.value) - 1
  if (!Number.isNaN(idx) && tables[idx]) tables[idx].status = 'VACANT'
  toast('ปิดโต๊ะเรียบร้อย พร้อมรับลูกค้าใหม่')
}

function orderNow() {
  if (!cart.value.length) return toast('โปรดเลือกเมนูก่อน')
  const id = `T${String(table.value).padStart(2, '0')}-${Date.now().toString().slice(-6)}`
  orderId.value = id
  orders.unshift({
    id,
    orderNo: nextOrderNo(),
    table: String(table.value),
    items: JSON.parse(JSON.stringify(cart.value)),
    total: total.value,
    status: 'New',
    createdAt: Date.now(),
  })
  const t = tables.find((t) => String(t.no) === String(table.value))
  if (t) t.status = 'ORDERING'
  // Clear cart and close sheet; payment only via "เช็คบิล"
  cart.value = []
  showCart.value = false
  checkoutStep.value = 'cart'
  toast('ส่งออเดอร์แล้ว')
}

const unpaidTotalForTable = computed(() =>
  unpaidOrdersForTable.value.reduce((a, o) => a + (o.total || 0), 0),
)
const payAmount = computed(() =>
  checkoutStep.value === 'payment' ? unpaidTotalForTable.value : total.value,
)
const qrUrl = computed(() =>
  `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
    `${brandName} โต๊ะ ${table.value} ชำระเงิน ฿${payAmount.value}`,
  )}`,
)

// Orders panel: show placed orders and statuses for current table
const showOrdersPanel = ref(false)
const ordersForTable = computed(() =>
  orders.filter((o) => String(o.table) === String(table.value)).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
)
const ordersByStatus = computed(() => {
  const buckets: Record<'New' | 'Cooking' | 'Served' | 'Canceled' | 'Paid', typeof ordersForTable.value> = {
    New: [],
    Cooking: [],
    Served: [],
    Canceled: [],
    Paid: [],
  }
  for (const o of ordersForTable.value) {
    if (buckets[o.status as keyof typeof buckets]) buckets[o.status as keyof typeof buckets].push(o)
  }
  return buckets
})
function openOrdersPanel() { showOrdersPanel.value = true }
function closeOrdersPanel() { showOrdersPanel.value = false }

function onSlipSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    slipName.value = file.name
    paymentStatus.value = 'pending'
    checkoutStep.value = 'status'
    // Attach slip to all unpaid orders for this table (aggregated bill)
    const tableStr = String(table.value)
    for (const o of orders) {
      if (o.table === tableStr && o.status !== 'Paid') o.slipName = file.name
    }
  }
}

function markPaid() {
  paymentStatus.value = 'paid'
  checkoutStep.value = 'status'
  // Mark all unpaid orders for this table as Paid (one-time bill)
  const tableStr = String(table.value)
  for (const o of orders) {
    if (o.table === tableStr && o.status !== 'Paid') o.status = 'Paid'
  }
  const t = tables.find((t) => String(t.no) === tableStr)
  if (t) t.status = 'EATING'
}

// Latest order per table and lock flag after payment
const latestOrderForTable = computed(() => {
  const list = orders
    .filter((o) => o.table === String(table.value))
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
  return list[0] || null
})
const hasPaidOrderForTable = computed(() => {
  const o = latestOrderForTable.value
  return !!o && (o.status === 'Paid' || o.status === 'Cooking' || o.status === 'Served')
})

// ===== Owner: Table Links & QR Helpers =====
function getTableLink(no: number) {
  const url = new URL(window.location.href)
  url.searchParams.set('table', String(no))
  return url.toString()
}

function getTableQR(no: number) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
    getTableLink(no),
  )}`
}

async function copyLink(no: number) {
  try {
    await navigator.clipboard.writeText(getTableLink(no))
    toast(`คัดลอกลิงก์โต๊ะ ${no} แล้ว`)
  } catch {
    toast('คัดลอกไม่สำเร็จ')
  }
}

function openLink(no: number) {
  window.open(getTableLink(no), '_blank')
}

function downloadQR(no: number) {
  const a = document.createElement('a')
  a.href = getTableQR(no)
  a.download = `table-${no}-qr.png`
  document.body.appendChild(a)
  a.click()
  a.remove()
}

// ===== Owner: UI State =====
const ownerOpen = ref(false)
const ownerTab = ref<'dashboard' | 'menu'>('dashboard')

// Owner Login (PIN)
const ownerLoggedIn = ref(false)
const ownerLoginOpen = ref(false)
const ownerPassInput = ref('')
const ownerPin = ref('1234')

function loadOwnerAuth() {
  try {
    const savedPin = localStorage.getItem('noodle_owner_pin')
    if (savedPin) ownerPin.value = savedPin
    const logged = localStorage.getItem('noodle_owner_logged_in') === '1'
    ownerLoggedIn.value = logged
  } catch {}
}

function persistLoggedIn(v: boolean) {
  try {
    localStorage.setItem('noodle_owner_logged_in', v ? '1' : '0')
  } catch {}
}

function openOwnerPanel() {
  if (ownerLoggedIn.value) {
    ownerOpen.value = true
  } else {
    ownerPassInput.value = ''
    ownerLoginOpen.value = true
  }
}

function authenticateOwner() {
  if (ownerPassInput.value === ownerPin.value) {
    ownerLoggedIn.value = true
    persistLoggedIn(true)
    ownerLoginOpen.value = false
    ownerOpen.value = true
  } else {
    toast('รหัสไม่ถูกต้อง')
  }
}

function cancelOwnerLogin() {
  ownerLoginOpen.value = false
}

function logoutOwner() {
  ownerLoggedIn.value = false
  persistLoggedIn(false)
  ownerOpen.value = false
}

// Secret long-press to open owner route
const router = useRouter()
const secretTimer = ref<number | null>(null)
function secretPressStart() {
  if (secretTimer.value) {
    clearTimeout(secretTimer.value)
    secretTimer.value = null
  }
  secretTimer.value = window.setTimeout(() => {
    router.push('/owner')
  }, 1200)
}
function secretPressEnd() {
  if (secretTimer.value) {
    clearTimeout(secretTimer.value)
    secretTimer.value = null
  }
}

function cycleTableStatus(t: TableInfo) {
  const seq: TableInfo['status'][] = ['VACANT', 'ORDERING', 'EATING', 'BILLING', 'CLEANING']
  const idx = seq.indexOf(t.status)
  t.status = seq[(idx + 1) % seq.length]
}

function setOrderStatus(o: Order, s: Order['status']) {
  o.status = s
}

const groupedOrders = computed(() => {
  const map: Record<Order['status'], Order[]> = {
    New: [],
    Paid: [],
    Cooking: [],
    Served: [],
    Canceled: [],
  }
  for (const o of orders) map[o.status].push(o)
  return map
})

// ===== Owner: Menu CRUD =====
const editOpen = ref(false)
const editTitle = ref('')
const formMenu = reactive<{
  id: string | null
  name: string
  price: number | null
  image: string
  category: string
  soldOut: boolean
}>({ id: null, name: '', price: null, image: '', category: categories[1], soldOut: false })

function onPickImage(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    formMenu.image = String(reader.result || '')
  }
  reader.readAsDataURL(file)
}

function openCreateMenu() {
  editTitle.value = 'เพิ่มเมนูใหม่'
  Object.assign(formMenu, {
    id: null,
    name: '',
    price: null,
    image: '',
    category: categories[1],
    soldOut: false,
  })
  editOpen.value = true
}

function openEditMenu(m: MenuItem) {
  editTitle.value = 'แก้ไขเมนู'
  Object.assign(formMenu, {
    id: m.id,
    name: m.name,
    price: m.price,
    image: m.image,
    category: m.category,
    soldOut: !!m.soldOut,
  })
  editOpen.value = true
}

function saveMenu() {
  if (!formMenu.name || formMenu.price == null) {
    toast('กรุณากรอกชื่อและราคา')
    return
  }
  if (formMenu.id) {
    const idx = menu.findIndex((x) => x.id === formMenu.id)
    if (idx > -1) {
      menu[idx] = {
        id: formMenu.id,
        name: formMenu.name,
        price: Number(formMenu.price),
        image: formMenu.image,
        category: formMenu.category,
        soldOut: formMenu.soldOut,
      }
    }
  } else {
    const id = Date.now().toString(36)
    menu.unshift({
      id,
      name: formMenu.name,
      price: Number(formMenu.price),
      image:
        formMenu.image ||
        'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?q=80&w=1200&auto=format&fit=crop',
      category: formMenu.category,
      soldOut: formMenu.soldOut,
    })
  }
  editOpen.value = false
}

function deleteMenuItem(m: MenuItem) {
  const idx = menu.findIndex((x) => x.id === m.id)
  if (idx > -1) menu.splice(idx, 1)
}

function toggleSoldOut(m: MenuItem) {
  m.soldOut = !m.soldOut
}

// ===== Toast =====
function toast(msg: string) {
  showToast.value = true
  toastMsg.value = msg
  setTimeout(() => (showToast.value = false), 1800)
}
const showToast = ref(false)
const toastMsg = ref('')

onMounted(() => {
  setTimeout(() => (loading.value = false), 600)
  ensureTable()
  // init owner auth
  loadOwnerAuth()
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-noodle to-white">
    <!-- Header -->
    <header class="sticky top-0 z-40 bg-white/90 backdrop-blur shadow-soft">
      <div class="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
        <div
          class="flex items-center gap-3 select-none"
          @mousedown="secretPressStart"
          @mouseup="secretPressEnd"
          @mouseleave="secretPressEnd"
          @touchstart.passive="secretPressStart"
          @touchend.passive="secretPressEnd"
        >
          <div
            class="h-9 w-9 rounded-full bg-gradient-to-br from-brand-primary to-broth flex items-center justify-center text-white font-bold shadow"
          >
            🍜
          </div>
          <div>
            <h1 class="text-lg font-extrabold text-ink">{{ brandName }}</h1>
            <p class="text-xs text-slate-500">
              โต๊ะ: <span class="font-semibold">{{ table }}</span>
            </p>
          </div>
        </div>
        <!-- Hidden owner access: long-press logo (no visible button) -->
      </div>
    </header>

    <!-- Category pills -->
    <div class="mx-auto max-w-5xl px-4 pt-4">
      <div class="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        <button
          v-for="c in categories"
          :key="c"
          class="whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition-colors"
          :class="
            selectedCategory === c
              ? 'bg-brand-primary text-white border-brand-primary'
              : 'bg-white text-ink border-slate-200 hover:bg-slate-50'
          "
          @click="selectedCategory = c"
        >
          {{ c }}
        </button>
      </div>
    </div>

    <!-- Orders Modal -->
    <div v-if="showOrdersPanel" class="fixed inset-0 z-50 flex text-[#333] items-center justify-center bg-black/40">
      <div class="w-full max-w-lg rounded-2xl bg-white p-4 shadow-soft">
        <div class="flex items-center justify-between mb-2">
          <div class="text-lg font-extrabold">ออเดอร์ของโต๊ะ {{ table }}</div>
          <button class="text-slate-600 hover:text-ink" @click="closeOrdersPanel()">ปิด</button>
        </div>
        <div v-if="ordersForTable.length === 0" class="text-sm text-slate-500">ยังไม่มีออเดอร์</div>
        <div v-else class="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
          <div v-for="o in ordersForTable" :key="o.id" class="rounded-xl border border-slate-200 p-3">
            <div class="flex items-center justify-between">
              <div class="font-bold">เลขที่: {{ o.orderNo || o.id }}</div>
              <div class="text-xs text-slate-600">{{ formatTime(o.createdAt) }}</div>
            </div>
            <div class="mt-1 text-sm">
              สถานะ: <span class="font-semibold">{{ statusTh(o.status) }}</span>
            </div>
            <ul class="mt-2 text-sm list-disc pl-5 space-y-1">
              <li v-for="it in o.items" :key="it.id">
                {{ it.name }} x{{ it.quantity }}
                <span v-if="it.options?.note" class="text-slate-500">- {{ it.options.note }}</span>
              </li>
            </ul>
            <div class="mt-2 text-right font-bold">฿{{ o.total }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Print Posters Overlay -->
    <div v-if="ownerPrintOpen" class="fixed inset-0 z-[60] bg-white overflow-y-auto">
      <div class="print:hidden sticky top-0 z-10 border-b bg-white">
        <div class="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="h-9 w-9 rounded-full bg-gradient-to-br from-brand-primary to-broth flex items-center justify-center text-white font-bold shadow">🍜</div>
            <div>
              <h2 class="text-lg font-extrabold text-ink">พิมพ์ป้ายโต๊ะ</h2>
              <p class="text-xs text-slate-500">รวม QR ทั้ง {{ TABLE_COUNT }} โต๊ะ</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button class="rounded-lg border px-3 py-1.5" @click="closePrintPosters">ปิด</button>
            <button class="rounded-lg bg-brand-primary text-white px-3 py-1.5" @click="triggerPrint">สั่งพิมพ์</button>
          </div>
        </div>
      </div>
      <div class="mx-auto max-w-5xl px-6 py-6 print:px-0">
        <div class="grid grid-cols-1 md:grid-cols-2 print-grid-a4">
          <div
            v-for="n in TABLE_COUNT"
            :key="n"
            class="poster border rounded-2xl p-6 print:p-4 flex flex-col items-center text-center gap-3 print:gap-2 shadow-sm"
          >
            <div class="flex items-center gap-3">
              <div class="h-10 w-10 rounded-full bg-gradient-to-br from-brand-primary to-broth flex items-center justify-center text-white font-bold shadow">🍜</div>
              <div class="text-left">
                <div class="text-base print:text-sm font-extrabold text-ink">{{ brandName }}</div>
                <div class="text-xs print:text-[11px] text-slate-500">สแกนเพื่อสั่งอาหาร</div>
              </div>
            </div>
            <img :src="getTableQR(n)" alt="QR โต๊ะ" class="w-[220px] h-[220px] qr-img" />
            <div class="text-2xl print:text-xl font-black text-ink">โต๊ะ {{ n }}</div>
            <div class="text-sm print:text-xs text-slate-600">เปิดกล้อง/แอปแสกน → ไปที่เมนูออนไลน์ของโต๊ะนี้</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom bar: unpaid summary and actions -->
    <div class="fixed inset-x-0 bottom-0 z-40" v-if="unpaidOrdersForTable.length > 0 || isLockedForOrdering">
      <div class="mx-auto max-w-5xl p-3">
        <div class="rounded-2xl bg-ink text-white shadow-soft p-3 flex items-center justify-between gap-2">
          <template v-if="unpaidOrdersForTable.length > 0">
            <div class="flex items-center gap-2">
              <span class="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-primary px-2 text-xs font-bold">{{ unpaidOrdersForTable.length }}</span>
              <span class="text-sm">ยอดค้างชำระ</span>
              <span class="font-extrabold">฿{{ unpaidTotalForTable }}</span>
            </div>
            <div class="flex items-center gap-2">
              <button class="rounded-xl bg-brand-primary px-4 py-2 font-bold hover:bg-brand-accent active:scale-[.98]" @click="startBilling()">
                เช็คบิล
              </button>
              <button class="rounded-xl bg-indigo-600 px-4 py-2 font-bold hover:bg-indigo-500 active:scale-[.98]" @click="openOrdersPanel()">
                ดูออเดอร์
              </button>
              <button class="rounded-xl bg-slate-600 px-4 py-2 font-bold hover:bg-slate-500 active:scale-[.98]" @click="openCart()">
                ดูตะกร้า
              </button>
            </div>
          </template>
          <template v-else>
            <div class="flex items-center gap-2">
              <span class="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-green-600 px-2 text-xs font-bold">✓</span>
              <span class="text-sm">ออเดอร์ชำระแล้ว</span>
            </div>
            <div class="flex items-center gap-2">
              <button class="rounded-xl bg-slate-600 px-4 py-2 font-bold hover:bg-slate-500 active:scale-[.98]" @click="closeTableForNewCustomer()">
                ปิดโต๊ะ
              </button>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- Owner Login Modal -->
    <div
      v-if="ownerLoginOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    >
      <div class="w-full max-w-sm rounded-2xl bg-white p-4 shadow-soft">
        <h3 class="text-lg font-extrabold text-ink">เข้าสู่ระบบเจ้าของร้าน</h3>
        <p class="text-sm text-slate-500 mt-1">กรอกรหัส PIN</p>
        <input
          v-model="ownerPassInput"
          type="password"
          inputmode="numeric"
          class="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2"
          placeholder="เช่น 1234"
          @keyup.enter="authenticateOwner"
        />
        <div class="mt-3 flex justify-end gap-2">
          <button class="rounded-lg border px-3 py-2" @click="cancelOwnerLogin">ยกเลิก</button>
          <button class="rounded-lg bg-brand-primary text-white px-3 py-2" @click="authenticateOwner">ยืนยัน</button>
        </div>
      </div>
    </div>

    <!-- Table Prompt Modal -->
    <div
      v-if="tablePromptOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    >
      <div class="w-full max-w-sm rounded-2xl bg-white p-4 shadow-soft">
        <h3 class="text-lg font-extrabold text-ink">ระบุหมายเลขโต๊ะ</h3>
        <p class="text-sm text-slate-500 mt-1">ใส่เลขโต๊ะ 1–{{ TABLE_COUNT }}</p>
        <input
          v-model="tableInput"
          type="number"
          min="1"
          :max="TABLE_COUNT"
          class="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2"
          placeholder="เช่น 5"
          @keyup.enter="confirmTable"
        />
        <div class="mt-3 flex justify-end gap-2">
          <button class="rounded-lg border px-3 py-2" @click="confirmTable">ยืนยัน</button>
        </div>
      </div>
    </div>

    <!-- Menu grid -->
    <main class="mx-auto max-w-5xl p-4 pb-28">
      <div v-if="loading" class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div
          v-for="i in 6"
          :key="i"
          class="rounded-xl bg-white shadow-soft overflow-hidden animate-pulse"
        >
          <div class="h-24 sm:h-32 bg-slate-200"></div>
          <div class="p-3 space-y-2">
            <div class="h-4 bg-slate-200 rounded"></div>
            <div class="h-4 w-1/2 bg-slate-200 rounded"></div>
            <div class="h-9 bg-slate-200 rounded"></div>
          </div>
        </div>
      </div>

      <div v-else>
        <div v-if="filteredMenu.length === 0" class="text-center py-16 text-slate-500">
          ไม่มีเมนูในหมวดนี้
        </div>

        <div v-else class="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <article
            v-for="item in filteredMenu"
            :key="item.id"
            class="relative rounded-xl bg-white shadow-soft overflow-hidden border border-slate-100"
          >
            <img :src="item.image" :alt="item.name" class="h-28 w-full object-cover sm:h-36" />
            <div
              v-if="item.soldOut"
              class="absolute left-2 top-2 rounded bg-red-600 text-white text-xs font-bold px-2 py-1"
            >
              หมดชั่วคราว
            </div>
            <div class="p-3">
              <h3 class="font-bold text-ink leading-tight line-clamp-2">{{ item.name }}</h3>
              <div class="mt-1 flex items-center justify-between">
                <p class="text-brand-accent font-extrabold">฿{{ item.price }}</p>
                <button
                  class="rounded-lg px-3 py-1.5 text-sm font-semibold shadow active:scale-[.98]"
                  :class="
                    item.soldOut || isLockedForOrdering
                      ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                      : 'bg-brand-primary text-white hover:bg-brand-accent'
                  "
                  :disabled="item.soldOut || isLockedForOrdering"
                  @click="openDetail(item)"
                >
                  เลือก
                </button>
              </div>
            </div>
          </article>
        </div>
      </div>
    </main>

    <!-- Floating cart bar -->
    <div class="fixed inset-x-0 bottom-0 z-40" v-if="cartCount > 0 && !isLockedForOrdering">
      <div class="mx-auto max-w-5xl p-3">
        <div
          class="rounded-2xl bg-ink text-white shadow-soft p-3 flex items-center justify-between"
        >
          <div class="flex items-center gap-2">
            <span
              class="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-primary px-2 text-xs font-bold"
              >{{ cartCount }}</span
            >
            <span class="text-sm">ยอดรวม</span>
            <span class="font-extrabold">฿{{ total }}</span>
          </div>
          <button
            class="rounded-xl bg-brand-primary px-4 py-2 font-bold hover:bg-brand-accent active:scale-[.98]"
            @click="openCart()"
          >
            ดูตะกร้า / ชำระเงิน
          </button>
        </div>
      </div>
    </div>

    <!-- Detail modal -->
    <div
      v-if="showDetail"
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
    >
      <div
        class="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white p-4 max-h-[90vh] overflow-y-auto"
      >
        <div class="h-40 w-full rounded-xl overflow-hidden">
          <img
            :src="detailItem?.image"
            :alt="detailItem?.name"
            class="h-full w-full object-cover"
          />
        </div>
        <h3 class="mt-3 text-xl font-extrabold text-ink">{{ detailItem?.name }}</h3>
        <p class="text-brand-accent font-bold">฿{{ detailItem?.price }}</p>

        <div class="mt-3 grid gap-3">
          <div>
            <label class="text-sm font-semibold text-ink">เลือกเส้น</label>
            <div class="mt-2 grid grid-cols-3 gap-2">
              <button
                v-for="n in ['เส้นเล็ก', 'เส้นใหญ่', 'บะหมี่', 'วุ้นเส้น']"
                :key="n"
                @click="form.noodle = n"
                class="rounded-lg border px-3 py-2 text-sm font-semibold"
                :class="
                  form.noodle === n
                    ? 'bg-brand-primary text-white border-brand-primary'
                    : 'bg-white text-ink border-slate-200'
                "
              >
                {{ n }}
              </button>
            </div>
          </div>
          <div>
            <label class="text-sm font-semibold text-ink">น้ำซุป</label>
            <div class="mt-2 grid grid-cols-4 gap-2">
              <button
                v-for="s in ['น้ำใส', 'น้��ตก', 'ต้มยำ', 'แห้ง']"
                :key="s"
                @click="form.soup = s"
                class="rounded-lg border px-3 py-2 text-sm font-semibold"
                :class="
                  form.soup === s
                    ? 'bg-brand-primary text-white border-brand-primary'
                    : 'bg-white text-ink border-slate-200'
                "
              >
                {{ s }}
              </button>
            </div>
          </div>
          <div>
            <label class="text-sm font-semibold text-ink">ความเผ็ด</label>
            <div class="mt-2 grid grid-cols-4 gap-2">
              <button
                v-for="sp in ['ไม่เผ็ด', 'เผ็ดน้อย', 'เผ็ดกลาง', 'เผ็ดมาก']"
                :key="sp"
                @click="form.spice = sp"
                class="rounded-lg border px-3 py-2 text-sm font-semibold"
                :class="
                  form.spice === sp
                    ? 'bg-brand-primary text-white border-brand-primary'
                    : 'bg-white text-ink border-slate-200'
                "
              >
                {{ sp }}
              </button>
            </div>
          </div>
          <div>
            <label class="text-sm font-semibold text-ink">ท็อปปิ้ง</label>
            <div class="mt-2 grid grid-cols-3 gap-2">
              <button
                v-for="t in ['หมู', 'ลูกชิ้น', 'ตับ', 'กากหมู', 'คะน้า', 'ถั่วงอก']"
                :key="t"
                @click="toggleTopping(t)"
                class="rounded-lg border px-3 py-2 text-sm font-semibold"
                :class="
                  form.toppings.includes(t)
                    ? 'bg-leaf text-white border-leaf'
                    : 'bg-white text-ink border-slate-200'
                "
              >
                {{ t }}
              </button>
            </div>
          </div>
          <div>
            <label class="text-sm font-semibold text-ink">โน้ตถึงร้าน</label>
            <textarea
              v-model="form.note"
              rows="2"
              placeholder="เช่น ไม่ใส่ผักชี"
              class="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            ></textarea>
          </div>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <button
                class="h-10 w-10 rounded-full bg-slate-100 text-xl font-bold"
                @click="form.quantity = Math.max(1, form.quantity - 1)"
              >
                -
              </button>
              <span class="min-w-8 text-center font-bold">{{ form.quantity }}</span>
              <button
                class="h-10 w-10 rounded-full bg-slate-100 text-xl font-bold"
                @click="form.quantity++"
              >
                +
              </button>
            </div>
            <div class="flex gap-2">
              <button class="rounded-lg px-4 py-2 font-semibold border" @click="showDetail = false">
                ยกเลิก
              </button>
              <button
                class="rounded-lg bg-brand-primary px-4 py-2 font-bold text-white shadow"
                @click="addToCart()"
              >
                เพิ่มลงตะกร้า
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Cart & Checkout Sheet -->
    <div
      v-if="showCart"
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
    >
      <div
        class="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white max-h-[90vh] overflow-y-auto"
      >
        <div class="sticky top-0 z-10 bg-white border-b p-4 flex items-center justify-between">
          <h3 class="text-lg font-extrabold text-ink" v-if="checkoutStep === 'cart'">ตะกร้าสั่ง</h3>
          <h3 class="text-lg font-extrabold text-ink" v-else-if="checkoutStep === 'payment'">
            ชำระเงิน
          </h3>
          <h3 class="text-lg font-extrabold text-ink" v-else>สถานะการชำระเงิน</h3>
          <button class="rounded-lg border px-3 py-1.5" @click="showCart = false">ปิด</button>
        </div>

        <!-- Cart -->
        <div v-if="checkoutStep === 'cart'" class="p-4 space-y-4">
          <template v-if="isLockedForOrdering && latestOrderForTable">
            <div class="rounded-xl bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
              ออเดอร์นี้ชำระแล้ว ไม่สามารถสั่งเพิ่มได้
            </div>

            <div v-for="c in latestOrderForTable.items" :key="c.id" class="rounded-xl border p-3">
              <p class="font-bold text-ink">{{ c.name }}</p>
              <p class="text-xs text-slate-500">
                {{ c.options.noodle }} • {{ c.options.soup }} • {{ c.options.spice }}
              </p>
              <p class="text-xs text-slate-500" v-if="c.options.toppings.length">
                ท็อปปิ้ง: {{ c.options.toppings.join(', ') }}
              </p>
              <p class="text-xs text-slate-500" v-if="c.options.note">โน้ต: {{ c.options.note }}</p>
              <div class="mt-2 flex items-center justify-between">
                <span class="text-sm text-slate-600">จำนวน: {{ c.quantity }}</span>
                <p class="font-bold">฿{{ c.basePrice * c.quantity }}</p>
              </div>
            </div>

            <div class="rounded-xl bg-slate-50 p-3 space-y-1">
              <div class="flex justify-between font-extrabold text-ink text-lg">
                <span>สุทธิ</span><span>฿{{ latestOrderForTable.total }}</span>
              </div>
            </div>
            <div class="text-center text-sm text-slate-500">สถานะ: {{ latestOrderForTable.status }}</div>
          </template>
          <template v-else>
            <div v-if="!cart.length" class="text-center text-slate-500 py-10">
              ยังไม่มีสินค้าในตะกร้า
            </div>

            <div v-for="(c, i) in cart" :key="c.id" class="rounded-xl border p-3 flex gap-3">
              <div class="flex-1">
                <p class="font-bold text-ink">{{ c.name }}</p>
                <p class="text-xs text-slate-500">
                  {{ c.options.noodle }} • {{ c.options.soup }} • {{ c.options.spice }}
                </p>
                <p class="text-xs text-slate-500" v-if="c.options.toppings.length">
                  ท็อปปิ้ง: {{ c.options.toppings.join(', ') }}
                </p>
                <p class="text-xs text-slate-500" v-if="c.options.note">โน้ต: {{ c.options.note }}</p>
                <div class="mt-2 flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <button class="h-8 w-8 rounded-full bg-slate-100 font-bold" @click="dec(i)">
                      -
                    </button>
                    <span class="w-6 text-center">{{ c.quantity }}</span>
                    <button class="h-8 w-8 rounded-full bg-slate-100 font-bold" @click="inc(i)">
                      +
                    </button>
                  </div>
                  <p class="font-bold">฿{{ c.basePrice * c.quantity }}</p>
                </div>
              </div>
            </div>

            <div class="rounded-xl border p-3 space-y-2">
              <label class="text-sm font-semibold">โค้ดส่วนลด</label>
              <div class="flex gap-2">
                <input
                  v-model="promoCode"
                  placeholder="เช่น SAVE10"
                  class="flex-1 rounded-lg border px-3 py-2"
                />
                <button class="rounded-lg border px-4 py-2 font-semibold" @click="applyPromo">
                  ใช้โค้ด
                </button>
              </div>
            </div>

            <div class="rounded-xl bg-slate-50 p-3 space-y-1">
              <div class="flex justify-between text-sm">
                <span>ยอดรวม</span><span>฿{{ subtotal }}</span>
              </div>
              <div class="flex justify-between text-sm text-green-600">
                <span>ส่วนลด</span><span>-฿{{ discount }}</span>
              </div>
              <div class="flex justify-between font-extrabold text-ink text-lg">
                <span>สุทธิ</span><span>฿{{ total }}</span>
              </div>
            </div>

            <button
              class="w-full rounded-xl bg-brand-primary px-4 py-3 text-white font-extrabold text-lg shadow disabled:opacity-50"
              :disabled="!cart.length"
              @click="orderNow"
            >
              สั่งเลย
            </button>
          </template>
        </div>

        <!-- Payment -->
        <div v-else-if="checkoutStep === 'payment'" class="p-4 space-y-4">
          <div class="rounded-xl border p-4 text-center">
            <p class="text-sm text-slate-500">สแกนเพื่อชำระยอด</p>
            <img :src="qrUrl" alt="QR" class="mx-auto mt-2 h-56 w-56" />
            <p class="mt-2 font-extrabold text-ink">฿{{ payAmount }}</p>
            <p class="text-xs text-slate-500" v-if="unpaidOrdersForTable.length > 0">
              ยอดค้างชำระทั้งหมดของโต๊ะนี้ ({{ unpaidOrdersForTable.length }} ออเดอร์)
            </p>
          </div>
          <div class="rounded-xl border p-3 space-y-2">
            <label class="text-sm font-semibold">อัปโหลดสลิป/แจ้งโอน</label>
            <input
              type="file"
              accept="image/*"
              @change="onSlipSelected"
              class="block w-full text-sm"
            />
          </div>
          <button
            class="w-full rounded-xl bg-ink px-4 py-3 text-white font-extrabold"
            @click="markPaid"
          >
            ชำระสำเร็จ (ทดลอง)
          </button>
        </div>

        <!-- Status -->
        <div v-else class="p-6 space-y-4 text-center">
          <div
            class="mx-auto h-16 w-16 rounded-full flex items-center justify-center"
            :class="{
              'bg-yellow-100 text-yellow-700': paymentStatus === 'pending',
              'bg-green-100 text-green-700': paymentStatus === 'paid',
              'bg-red-100 text-red-700': paymentStatus === 'failed',
            }"
          >
            <svg
              v-if="paymentStatus === 'pending'"
              xmlns="http://www.w3.org/2000/svg"
              fill="currentColor"
              viewBox="0 0 24 24"
              class="w-8 h-8"
            >
              <path
                d="M12 2.25a9.75 9.75 0 1 0 9.75 9.75A9.76 9.76 0 0 0 12 2.25Zm.75 5.25a.75.75 0 0 0-1.5 0v5.25c0 .414.336.75.75.75H15a.75.75 0 0 0 0-1.5h-2.25Z"
              />
            </svg>
            <svg
              v-else-if="paymentStatus === 'paid'"
              xmlns="http://www.w3.org/2000/svg"
              fill="currentColor"
              viewBox="0 0 24 24"
              class="w-8 h-8"
            >
              <path d="M9 12.75 11.25 15l4.5-4.5 1.5 1.5L11.25 18 7.5 14.25Z" />
            </svg>
            <svg
              v-else
              xmlns="http://www.w3.org/2000/svg"
              fill="currentColor"
              viewBox="0 0 24 24"
              class="w-8 h-8"
            >
              <path
                d="M12 2.25a9.75 9.75 0 1 0 9.75 9.75A9.76 9.76 0 0 0 12 2.25Zm3.53 12.72-1.06 1.06L12 13.56l-2.47 2.47-1.06-1.06L10.94 12 8.47 9.53l1.06-1.06L12 10.94l2.47-2.47 1.06 1.06L13.06 12Z"
              />
            </svg>
          </div>
          <h4 class="text-xl font-extrabold text-ink" v-if="paymentStatus === 'pending'">
            รอเช็กยอด
          </h4>
          <h4 class="text-xl font-extrabold text-ink" v-else-if="paymentStatus === 'paid'">
            ชำระแล้ว
          </h4>
          <h4 class="text-xl font-extrabold text-ink" v-else>ไม่สำเร็จ</h4>
          <p class="text-sm text-slate-500" v-if="slipName">ไฟล์: {{ slipName }}</p>
          <div class="pt-2">
            <a
              href="tel:0800000000"
              class="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-3 text-white font-extrabold"
              >ติดต่อพนักงาน</a
            >
          </div>
        </div>
      </div>
    </div>

    <!-- Owner Panel -->
    <div
      v-if="ownerOpen"
      class="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center"
    >
      <div
        class="w-full sm:max-w-3xl bg-white rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-hidden shadow-soft"
      >
        <div class="flex items-center justify-between border-b px-4 py-3">
          <div class="flex items-center gap-2">
            <button
              class="rounded-full border px-3 py-1.5 text-sm font-semibold"
              :class="ownerTab === 'dashboard' ? 'bg-ink text-white border-ink' : 'bg-white'"
              @click="ownerTab = 'dashboard'"
            >
              แดชบอร์ด
            </button>
            <button
              class="rounded-full border px-3 py-1.5 text-sm font-semibold"
              :class="ownerTab === 'menu' ? 'bg-ink text-white border-ink' : 'bg-white'"
              @click="ownerTab = 'menu'"
            >
              จัดการเมนู
            </button>
          </div>
          <div class="flex items-center gap-2">
            <button class="rounded-lg border px-3 py-1.5" @click="openPrintPosters">พิมพ์ป้ายโต๊ะ</button>
            <button v-if="ownerLoggedIn" class="rounded-lg border px-3 py-1.5" @click="logoutOwner">ออกจากระบบ</button>
            <button class="rounded-lg border px-3 py-1.5" @click="ownerOpen = false">ปิด</button>
          </div>
        </div>

        <!-- Dashboard -->
        <div v-if="ownerTab === 'dashboard'" class="p-4 space-y-6 overflow-y-auto">
          <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div
              v-for="col in ['New', 'Paid', 'Cooking', 'Served', 'Canceled']"
              :key="col"
              class="rounded-xl bg-slate-50 p-3"
            >
              <div class="flex items-center justify-between mb-2">
                <h4 class="font-extrabold text-ink">{{ col }}</h4>
                <span class="text-xs text-slate-500">{{ groupedOrders[col].length }}</span>
              </div>
              <div class="space-y-2 min-h-[60px]">
                <div
                  v-for="o in groupedOrders[col]"
                  :key="o.id"
                  class="rounded-lg border bg-white p-3"
                >
                  <div class="flex items-center justify-between">
                    <p class="font-bold">โต๊ะ {{ o.table }}</p>
                    <span class="text-xs text-slate-500">฿{{ o.total }}</span>
                  </div>
                  <p class="text-xs text-slate-500">
                    {{ new Date(o.createdAt).toLocaleTimeString() }}
                  </p>
                  <div class="mt-2 flex items-center gap-2">
                    <select class="flex-1 rounded border px-2 py-1 text-sm" v-model="o.status">
                      <option value="New">New</option>
                      <option value="Paid">Paid</option>
                      <option value="Cooking">Cooking</option>
                      <option value="Served">Served</option>
                      <option value="Canceled">Canceled</option>
                    </select>
                    <button
                      v-if="o.status !== 'Canceled'"
                      class="rounded bg-brand-primary text-white px-2 py-1 text-sm"
                      @click="
                        setOrderStatus(
                          o,
                          o.status === 'New'
                            ? 'Paid'
                            : o.status === 'Paid'
                              ? 'Cooking'
                              : o.status === 'Cooking'
                                ? 'Served'
                                : 'Served',
                        )
                      "
                    >
                      ถัดไป
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h4 class="font-extrabold text-ink mb-2">สถานะโต๊ะ</h4>
            <div class="grid grid-cols-3 sm:grid-cols-6 gap-2">
              <div v-for="t in tables" :key="t.no" class="rounded-xl border p-3 bg-white">
                <div class="flex items-center justify-between">
                  <p class="font-bold">โต๊ะ {{ t.no }}</p>
                  <span
                    class="text-[10px] px-2 py-0.5 rounded-full font-bold"
                    :class="{
                      'bg-green-100 text-green-700': t.status === 'VACANT',
                      'bg-yellow-100 text-yellow-700': t.status === 'ORDERING',
                      'bg-blue-100 text-blue-700': t.status === 'EATING',
                      'bg-purple-100 text-purple-700': t.status === 'BILLING',
                      'bg-red-100 text-red-700': t.status === 'CLEANING',
                    }"
                    >{{ t.status }}</span
                  >
                </div>
                <button
                  class="mt-2 w-full rounded-lg border px-2 py-1 text-sm"
                  @click="cycleTableStatus(t)"
                >
                  เปลี่ยนสถานะ
                </button>
              </div>
            </div>
          </div>

          <div class="pt-4">
            <h4 class="font-extrabold text-ink mb-2">ลิงก์ & QR ต่อโต๊ะ</h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              <div v-for="t in tables" :key="'link-'+t.no" class="rounded-xl border p-3 bg-white">
                <p class="font-bold">โต๊ะ {{ t.no }}</p>
                <p class="text-xs text-slate-500 break-all mt-1">{{ getTableLink(t.no) }}</p>
                <div class="mt-2 flex items-center gap-2">
                  <button class="rounded-lg border px-2 py-1 text-sm" @click="copyLink(t.no)">คัดลอก</button>
                  <button class="rounded-lg border px-2 py-1 text-sm" @click="openLink(t.no)">เปิด</button>
                  <button class="rounded-lg border px-2 py-1 text-sm" @click="downloadQR(t.no)">ดาวน์โหลด QR</button>
                </div>
                <img :src="getTableQR(t.no)" alt="qr" class="mt-2 h-28 w-28" />
              </div>
            </div>
          </div>
        </div>

        <!-- Menu Management -->
        <div v-else class="p-4 space-y-4 overflow-y-auto">
          <div class="flex items-center justify-between">
            <h4 class="font-extrabold text-ink">เมนูทั้งหมด</h4>
            <button
              class="rounded-lg bg-brand-primary text-white px-3 py-2 font-semibold"
              @click="openCreateMenu"
            >
              + เพิ่มเมนู
            </button>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div v-for="m in menu" :key="m.id" class="rounded-xl border overflow-hidden bg-white">
              <img :src="m.image" :alt="m.name" class="h-28 w-full object-cover" />
              <div class="p-3 space-y-2">
                <div class="flex items-center justify-between">
                  <p class="font-bold text-ink">{{ m.name }}</p>
                  <span class="text-brand-accent font-extrabold">฿{{ m.price }}</span>
                </div>
                <div class="flex items-center gap-2 text-xs text-slate-500">
                  <span class="rounded bg-slate-100 px-2 py-0.5">{{ m.category }}</span>
                  <span v-if="m.soldOut" class="rounded bg-red-100 text-red-700 px-2 py-0.5"
                    >หมดชั่วคราว</span
                  >
                </div>
                <div class="flex items-center gap-2 pt-1">
                  <button class="rounded-lg border px-3 py-1.5 text-sm" @click="openEditMenu(m)">
                    แก้ไข
                  </button>
                  <button class="rounded-lg border px-3 py-1.5 text-sm" @click="toggleSoldOut(m)">
                    {{ m.soldOut ? 'เปิดขาย' : 'หมดชั่วคราว' }}
                  </button>
                  <button
                    class="ml-auto rounded-lg bg-red-600 text-white px-3 py-1.5 text-sm"
                    @click="deleteMenuItem(m)"
                  >
                    ลบ
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Menu Editor Modal -->
    <div
      v-if="editOpen"
      class="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center"
    >
      <div
        class="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-4 max-h-[90vh] overflow-y-auto"
      >
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-lg font-extrabold text-ink">{{ editTitle }}</h3>
          <button class="rounded-lg border px-3 py-1.5" @click="editOpen = false">ปิด</button>
        </div>
        <div class="grid gap-3">
          <div>
            <label class="text-sm font-semibold">ชื่อเมนู</label>
            <input v-model="formMenu.name" class="mt-1 w-full rounded-lg border px-3 py-2" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-sm font-semibold">ราคา</label>
              <input
                v-model.number="formMenu.price"
                type="number"
                min="0"
                class="mt-1 w-full rounded-lg border px-3 py-2"
              />
            </div>
            <div>
              <label class="text-sm font-semibold">หมวด</label>
              <select v-model="formMenu.category" class="mt-1 w-full rounded-lg border px-3 py-2">
                <option v-for="c in categories.filter((c) => c !== 'ทั้งหมด')" :key="c" :value="c">
                  {{ c }}
                </option>
              </select>
            </div>
          </div>
          <div>
            <label class="text-sm font-semibold">รูปภาพ</label>
            <input
              type="file"
              accept="image/*"
              class="mt-1 block w-full text-sm"
              @change="onPickImage"
            />
            <img
              v-if="formMenu.image"
              :src="formMenu.image"
              alt="preview"
              class="mt-2 h-32 w-full object-cover rounded"
            />
          </div>
          <div class="flex items-center gap-2">
            <input id="sold" type="checkbox" v-model="formMenu.soldOut" class="h-4 w-4" />
            <label for="sold" class="text-sm">หมดชั่วคราว</label>
          </div>
          <button
            class="w-full rounded-xl bg-brand-primary px-4 py-3 text-white font-extrabold"
            @click="saveMenu"
          >
            บันทึก
          </button>
        </div>
      </div>
    </div>

    <!-- Toast -->
    <div
      v-if="showToast"
      class="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-white text-sm shadow-soft"
    >
      {{ toastMsg }}
    </div>
  </div>
</template>

<style scoped>
.shadow-soft {
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.06);
}

/* Also define the standard property 'line-clamp' for compatibility */
.clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-clamp: 2;
}
.print-grid-a4 {
  /* default (screen) fallback; overridden in print */
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

@media print {
  @page {
    size: A4;
    margin: 10mm;
  }
  .print-grid-a4 {
    display: grid !important;
    grid-template-columns: 1fr 1fr !important;
    gap: 8mm !important;
  }
  .poster {
    /* Avoid breaking posters across pages and force 2 rows per page */
    break-inside: avoid;
    page-break-inside: avoid;
    height: calc((297mm - 20mm - 8mm) / 2); /* pageHeight - verticalMargins - one gap, divided by 2 */
  }
  .qr-img {
    width: 60mm !important;
    height: 60mm !important;
  }
}
</style>
