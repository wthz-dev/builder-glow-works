<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'

// ===== Types =====
interface MenuItem {
  id: string
  name: string
  price: number
  image: string
  category: string
  soldOut?: boolean
}

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
const urlParams = new URLSearchParams(window.location.search)
const table = urlParams.get('table') || '-'

// ===== Category / Menu =====
const categories = ['ทั้งหมด', 'ก๋วยเตี๋ยว', 'เย็นตาโฟ', 'ต้มยำ', 'แห้ง', 'ของทานเล่น', 'เครื่องดื่ม']
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

watch(
  menu,
  () => localStorage.setItem('noodle_menu', JSON.stringify(menu)),
  { deep: true },
)

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
  if (item.soldOut) return
  detailItem.value = item
  Object.assign(form, { noodle: 'เส้นเล็ก', soup: 'น้ำใส', spice: 'ไม่เผ็ด', toppings: [], note: '', quantity: 1 })
  showDetail.value = true
}

function toggleTopping(t: string) {
  const i = form.toppings.indexOf(t)
  if (i > -1) form.toppings.splice(i, 1)
  else form.toppings.push(t)
}

function addToCart() {
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
      options: { noodle: form.noodle, soup: form.soup, spice: form.spice, toppings: [...form.toppings], note: form.note.trim() },
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
watch(
  orders,
  () => localStorage.setItem('noodle_orders', JSON.stringify(orders)),
  { deep: true },
)

const tables = reactive<TableInfo[]>(
  loadLocal<TableInfo[]>(
    'noodle_tables',
    Array.from({ length: 12 }).map((_, i) => ({ no: i + 1, status: 'VACANT' } as TableInfo)),
  ),
)
watch(
  tables,
  () => localStorage.setItem('noodle_tables', JSON.stringify(tables)),
  { deep: true },
)

function openCart() {
  checkoutStep.value = 'cart'
  showCart.value = true
}

function orderNow() {
  if (!cart.value.length) return toast('โปรดเลือกเมนูก่อน')
  checkoutStep.value = 'payment'
  const id = `T${String(table).padStart(2, '0')}-${Date.now().toString().slice(-6)}`
  orderId.value = id
  orders.unshift({
    id,
    table: String(table),
    items: JSON.parse(JSON.stringify(cart.value)),
    total: total.value,
    status: 'New',
    createdAt: Date.now(),
  })
  const t = tables.find((t) => String(t.no) === String(table))
  if (t) t.status = 'ORDERING'
}

const qrUrl = computed(() =>
  `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
    `ร้าน:${brandName}|โต๊ะ:${table}|ออเดอร์:${orderId.value}|ยอด:${total.value}`,
  )}`,
)

function onSlipSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    slipName.value = file.name
    paymentStatus.value = 'pending'
    checkoutStep.value = 'status'
    const o = orders.find((o) => o.id === orderId.value)
    if (o) o.slipName = file.name
  }
}

function markPaid() {
  paymentStatus.value = 'paid'
  checkoutStep.value = 'status'
  const o = orders.find((o) => o.id === orderId.value)
  if (o) o.status = 'Paid'
  const t = tables.find((t) => String(t.no) === String(table))
  if (t) t.status = 'EATING'
}

// ===== Owner: UI State =====
const ownerOpen = ref(false)
const ownerTab = ref<'dashboard' | 'menu'>('dashboard')

function cycleTableStatus(t: TableInfo) {
  const seq: TableInfo['status'][] = ['VACANT', 'ORDERING', 'EATING', 'BILLING', 'CLEANING']
  const idx = seq.indexOf(t.status)
  t.status = seq[(idx + 1) % seq.length]
}

function setOrderStatus(o: Order, s: Order['status']) {
  o.status = s
}

const groupedOrders = computed(() => {
  const map: Record<Order['status'], Order[]> = { New: [], Paid: [], Cooking: [], Served: [], Canceled: [] }
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
  Object.assign(formMenu, { id: null, name: '', price: null, image: '', category: categories[1], soldOut: false })
  editOpen.value = true
}

function openEditMenu(m: MenuItem) {
  editTitle.value = 'แก้ไขเมนู'
  Object.assign(formMenu, { id: m.id, name: m.name, price: m.price, image: m.image, category: m.category, soldOut: !!m.soldOut })
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
      menu[idx] = { id: formMenu.id, name: formMenu.name, price: Number(formMenu.price), image: formMenu.image, category: formMenu.category, soldOut: formMenu.soldOut }
    }
  } else {
    const id = Date.now().toString(36)
    menu.unshift({ id, name: formMenu.name, price: Number(formMenu.price), image: formMenu.image || 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?q=80&w=1200&auto=format&fit=crop', category: formMenu.category, soldOut: formMenu.soldOut })
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
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-noodle to-white">
    <!-- Header -->
    <header class="sticky top-0 z-40 bg-white/90 backdrop-blur shadow-soft">
      <div class="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="h-9 w-9 rounded-full bg-gradient-to-br from-brand-primary to-broth flex items-center justify-center text-white font-bold shadow">🍜</div>
          <div>
            <h1 class="text-lg font-extrabold text-ink">{{ brandName }}</h1>
            <p class="text-xs text-slate-500">โต๊ะ: <span class="font-semibold">{{ table }}</span></p>
          </div>
        </div>
        <button class="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-3 py-2 text-white text-sm font-semibold shadow hover:bg-brand-accent active:scale-[.98]" @click="ownerOpen = true">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5"><path d="M11.7 2.1a.75.75 0 0 1 .6 0l7.5 3.214a.75.75 0 0 1 .45.69V10.5a9.75 9.75 0 1 1-16.5 6.864V6.004a.75.75 0 0 1 .45-.69L11.7 2.1Z"/></svg>
          สำหรับเจ้าของ
        </button>
      </div>
    </header>

    <!-- Category pills -->
    <div class="mx-auto max-w-5xl px-4 pt-4">
      <div class="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        <button v-for="c in categories" :key="c" class="whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition-colors" :class="selectedCategory === c ? 'bg-brand-primary text-white border-brand-primary' : 'bg-white text-ink border-slate-200 hover:bg-slate-50'" @click="selectedCategory = c">
          {{ c }}
        </button>
      </div>
    </div>

    <!-- Menu grid -->
    <main class="mx-auto max-w-5xl p-4 pb-28">
      <div v-if="loading" class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div v-for="i in 6" :key="i" class="rounded-xl bg-white shadow-soft overflow-hidden animate-pulse">
          <div class="h-24 sm:h-32 bg-slate-200"></div>
          <div class="p-3 space-y-2">
            <div class="h-4 bg-slate-200 rounded"></div>
            <div class="h-4 w-1/2 bg-slate-200 rounded"></div>
            <div class="h-9 bg-slate-200 rounded"></div>
          </div>
        </div>
      </div>

      <div v-else>
        <div v-if="filteredMenu.length === 0" class="text-center py-16 text-slate-500">ไม่มีเมนูในหมวดนี้</div>

        <div v-else class="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <article v-for="item in filteredMenu" :key="item.id" class="relative rounded-xl bg-white shadow-soft overflow-hidden border border-slate-100">
            <img :src="item.image" :alt="item.name" class="h-28 w-full object-cover sm:h-36" />
            <div v-if="item.soldOut" class="absolute left-2 top-2 rounded bg-red-600 text-white text-xs font-bold px-2 py-1">หมดชั่วคราว</div>
            <div class="p-3">
              <h3 class="font-bold text-ink leading-tight line-clamp-2">{{ item.name }}</h3>
              <div class="mt-1 flex items-center justify-between">
                <p class="text-brand-accent font-extrabold">฿{{ item.price }}</p>
                <button class="rounded-lg px-3 py-1.5 text-sm font-semibold shadow active:scale-[.98]" :class="item.soldOut ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-brand-primary text-white hover:bg-brand-accent'" :disabled="item.soldOut" @click="openDetail(item)">เลือก</button>
              </div>
            </div>
          </article>
        </div>
      </div>
    </main>

    <!-- Floating cart bar -->
    <div class="fixed inset-x-0 bottom-0 z-40" v-if="cartCount > 0">
      <div class="mx-auto max-w-5xl p-3">
        <div class="rounded-2xl bg-ink text-white shadow-soft p-3 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-primary px-2 text-xs font-bold">{{ cartCount }}</span>
            <span class="text-sm">ยอดรวม</span>
            <span class="font-extrabold">฿{{ total }}</span>
          </div>
          <button class="rounded-xl bg-brand-primary px-4 py-2 font-bold hover:bg-brand-accent active:scale-[.98]" @click="openCart()">ดูตะกร้า / ชำระเงิน</button>
        </div>
      </div>
    </div>

    <!-- Detail modal -->
    <div v-if="showDetail" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div class="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white p-4 max-h-[90vh] overflow-y-auto">
        <div class="h-40 w-full rounded-xl overflow-hidden">
          <img :src="detailItem?.image" :alt="detailItem?.name" class="h-full w-full object-cover" />
        </div>
        <h3 class="mt-3 text-xl font-extrabold text-ink">{{ detailItem?.name }}</h3>
        <p class="text-brand-accent font-bold">฿{{ detailItem?.price }}</p>

        <div class="mt-3 grid gap-3">
          <div>
            <label class="text-sm font-semibold text-ink">เลือกเส้น</label>
            <div class="mt-2 grid grid-cols-3 gap-2">
              <button v-for="n in ['เส้นเล็ก','เส้นใหญ่','บะหมี่','วุ้นเส้น']" :key="n" @click="form.noodle = n" class="rounded-lg border px-3 py-2 text-sm font-semibold" :class="form.noodle===n ? 'bg-brand-primary text-white border-brand-primary' : 'bg-white text-ink border-slate-200'">{{ n }}</button>
            </div>
          </div>
          <div>
            <label class="text-sm font-semibold text-ink">น้ำซุป</label>
            <div class="mt-2 grid grid-cols-4 gap-2">
              <button v-for="s in ['น้ำใส','น้��ตก','ต้มยำ','แห้ง']" :key="s" @click="form.soup = s" class="rounded-lg border px-3 py-2 text-sm font-semibold" :class="form.soup===s ? 'bg-brand-primary text-white border-brand-primary' : 'bg-white text-ink border-slate-200'">{{ s }}</button>
            </div>
          </div>
          <div>
            <label class="text-sm font-semibold text-ink">ความเผ็ด</label>
            <div class="mt-2 grid grid-cols-4 gap-2">
              <button v-for="sp in ['ไม่เผ็ด','เผ็ดน้อย','เผ็ดกลาง','เผ็ดมาก']" :key="sp" @click="form.spice = sp" class="rounded-lg border px-3 py-2 text-sm font-semibold" :class="form.spice===sp ? 'bg-brand-primary text-white border-brand-primary' : 'bg-white text-ink border-slate-200'">{{ sp }}</button>
            </div>
          </div>
          <div>
            <label class="text-sm font-semibold text-ink">ท็อปปิ้ง</label>
            <div class="mt-2 grid grid-cols-3 gap-2">
              <button v-for="t in ['หมู','ลูกชิ้น','ตับ','กากหมู','คะน้า','ถั่วงอก']" :key="t" @click="toggleTopping(t)" class="rounded-lg border px-3 py-2 text-sm font-semibold" :class="form.toppings.includes(t) ? 'bg-leaf text-white border-leaf' : 'bg-white text-ink border-slate-200'">{{ t }}</button>
            </div>
          </div>
          <div>
            <label class="text-sm font-semibold text-ink">โน้ตถึงร้าน</label>
            <textarea v-model="form.note" rows="2" placeholder="เช่น ไม่ใส่ผักชี" class="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"></textarea>
          </div>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <button class="h-10 w-10 rounded-full bg-slate-100 text-xl font-bold" @click="form.quantity = Math.max(1, form.quantity-1)">-</button>
              <span class="min-w-8 text-center font-bold">{{ form.quantity }}</span>
              <button class="h-10 w-10 rounded-full bg-slate-100 text-xl font-bold" @click="form.quantity++">+</button>
            </div>
            <div class="flex gap-2">
              <button class="rounded-lg px-4 py-2 font-semibold border" @click="showDetail=false">ยกเลิก</button>
              <button class="rounded-lg bg-brand-primary px-4 py-2 font-bold text-white shadow" @click="addToCart()">เพิ่มลงตะกร้า</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Cart & Checkout Sheet -->
    <div v-if="showCart" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div class="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white max-h-[90vh] overflow-y-auto">
        <div class="sticky top-0 z-10 bg-white border-b p-4 flex items-center justify-between">
          <h3 class="text-lg font-extrabold text-ink" v-if="checkoutStep==='cart'">ตะกร้าสั่ง</h3>
          <h3 class="text-lg font-extrabold text-ink" v-else-if="checkoutStep==='payment'">ชำระเงิน</h3>
          <h3 class="text-lg font-extrabold text-ink" v-else>สถานะการชำระเงิน</h3>
          <button class="rounded-lg border px-3 py-1.5" @click="showCart=false">ปิด</button>
        </div>

        <!-- Cart -->
        <div v-if="checkoutStep==='cart'" class="p-4 space-y-4">
          <div v-if="!cart.length" class="text-center text-slate-500 py-10">ยังไม่มีสินค้าในตะกร้า</div>

          <div v-for="(c,i) in cart" :key="c.id" class="rounded-xl border p-3 flex gap-3">
            <div class="flex-1">
              <p class="font-bold text-ink">{{ c.name }}</p>
              <p class="text-xs text-slate-500">{{ c.options.noodle }} • {{ c.options.soup }} • {{ c.options.spice }}</p>
              <p class="text-xs text-slate-500" v-if="c.options.toppings.length">ท็อปปิ้ง: {{ c.options.toppings.join(', ') }}</p>
              <p class="text-xs text-slate-500" v-if="c.options.note">โน้ต: {{ c.options.note }}</p>
              <div class="mt-2 flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <button class="h-8 w-8 rounded-full bg-slate-100 font-bold" @click="dec(i)">-</button>
                  <span class="w-6 text-center">{{ c.quantity }}</span>
                  <button class="h-8 w-8 rounded-full bg-slate-100 font-bold" @click="inc(i)">+</button>
                </div>
                <p class="font-bold">฿{{ c.basePrice * c.quantity }}</p>
              </div>
            </div>
          </div>

          <div class="rounded-xl border p-3 space-y-2">
            <label class="text-sm font-semibold">โค้ดส่วนลด</label>
            <div class="flex gap-2">
              <input v-model="promoCode" placeholder="เช่น SAVE10" class="flex-1 rounded-lg border px-3 py-2" />
              <button class="rounded-lg border px-4 py-2 font-semibold" @click="applyPromo">ใช้โค้ด</button>
            </div>
          </div>

          <div class="rounded-xl bg-slate-50 p-3 space-y-1">
            <div class="flex justify-between text-sm"><span>ยอดรวม</span><span>฿{{ subtotal }}</span></div>
            <div class="flex justify-between text-sm text-green-600"><span>ส่วนลด</span><span>-฿{{ discount }}</span></div>
            <div class="flex justify-between font-extrabold text-ink text-lg"><span>สุทธิ</span><span>฿{{ total }}</span></div>
          </div>

          <button class="w-full rounded-xl bg-brand-primary px-4 py-3 text-white font-extrabold text-lg shadow disabled:opacity-50" :disabled="!cart.length" @click="orderNow">สั่งเลย</button>
        </div>

        <!-- Payment -->
        <div v-else-if="checkoutStep==='payment'" class="p-4 space-y-4">
          <div class="rounded-xl border p-4 text-center">
            <p class="text-sm text-slate-500">สแกนเพื่อชำระยอด</p>
            <img :src="qrUrl" alt="QR" class="mx-auto mt-2 h-56 w-56" />
            <p class="mt-2 font-extrabold text-ink">฿{{ total }}</p>
            <p class="text-xs text-slate-500">ออเดอร์: {{ orderId }}</p>
          </div>
          <div class="rounded-xl border p-3 space-y-2">
            <label class="text-sm font-semibold">อัปโหลดสลิป/แจ้งโอน</label>
            <input type="file" accept="image/*" @change="onSlipSelected" class="block w-full text-sm" />
          </div>
          <button class="w-full rounded-xl bg-ink px-4 py-3 text-white font-extrabold" @click="markPaid">ชำระสำเร็จ (ทดลอง)</button>
        </div>

        <!-- Status -->
        <div v-else class="p-6 space-y-4 text-center">
          <div class="mx-auto h-16 w-16 rounded-full flex items-center justify-center" :class="{ 'bg-yellow-100 text-yellow-700': paymentStatus==='pending', 'bg-green-100 text-green-700': paymentStatus==='paid', 'bg-red-100 text-red-700': paymentStatus==='failed' }">
            <svg v-if="paymentStatus==='pending'" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" class="w-8 h-8"><path d="M12 2.25a9.75 9.75 0 1 0 9.75 9.75A9.76 9.76 0 0 0 12 2.25Zm.75 5.25a.75.75 0 0 0-1.5 0v5.25c0 .414.336.75.75.75H15a.75.75 0 0 0 0-1.5h-2.25Z"/></svg>
            <svg v-else-if="paymentStatus==='paid'" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" class="w-8 h-8"><path d="M9 12.75 11.25 15l4.5-4.5 1.5 1.5L11.25 18 7.5 14.25Z"/></svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" class="w-8 h-8"><path d="M12 2.25a9.75 9.75 0 1 0 9.75 9.75A9.76 9.76 0 0 0 12 2.25Zm3.53 12.72-1.06 1.06L12 13.56l-2.47 2.47-1.06-1.06L10.94 12 8.47 9.53l1.06-1.06L12 10.94l2.47-2.47 1.06 1.06L13.06 12Z"/></svg>
          </div>
          <h4 class="text-xl font-extrabold text-ink" v-if="paymentStatus==='pending'">รอเช็กยอด</h4>
          <h4 class="text-xl font-extrabold text-ink" v-else-if="paymentStatus==='paid'">ชำระแล้ว</h4>
          <h4 class="text-xl font-extrabold text-ink" v-else>ไม่สำเร็จ</h4>
          <p class="text-sm text-slate-500" v-if="slipName">ไฟล์: {{ slipName }}</p>
          <div class="pt-2">
            <a href="tel:0800000000" class="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-3 text-white font-extrabold">ติดต่อพนักงาน</a>
          </div>
        </div>
      </div>
    </div>

    <!-- Owner Panel -->
    <div v-if="ownerOpen" class="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center">
      <div class="w-full sm:max-w-3xl bg-white rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-hidden shadow-soft">
        <div class="flex items-center justify-between border-b px-4 py-3">
          <div class="flex items-center gap-2">
            <button class="rounded-full border px-3 py-1.5 text-sm font-semibold" :class="ownerTab==='dashboard' ? 'bg-ink text-white border-ink' : 'bg-white'" @click="ownerTab='dashboard'">แดชบอร์ด</button>
            <button class="rounded-full border px-3 py-1.5 text-sm font-semibold" :class="ownerTab==='menu' ? 'bg-ink text-white border-ink' : 'bg-white'" @click="ownerTab='menu'">จัดการเมนู</button>
          </div>
          <button class="rounded-lg border px-3 py-1.5" @click="ownerOpen=false">ปิด</button>
        </div>

        <!-- Dashboard -->
        <div v-if="ownerTab==='dashboard'" class="p-4 space-y-6 overflow-y-auto">
          <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div v-for="col in ['New','Paid','Cooking','Served','Canceled']" :key="col" class="rounded-xl bg-slate-50 p-3">
              <div class="flex items-center justify-between mb-2">
                <h4 class="font-extrabold text-ink">{{ col }}</h4>
                <span class="text-xs text-slate-500">{{ groupedOrders[col].length }}</span>
              </div>
              <div class="space-y-2 min-h-[60px]">
                <div v-for="o in groupedOrders[col]" :key="o.id" class="rounded-lg border bg-white p-3">
                  <div class="flex items-center justify-between">
                    <p class="font-bold">โต๊ะ {{ o.table }}</p>
                    <span class="text-xs text-slate-500">฿{{ o.total }}</span>
                  </div>
                  <p class="text-xs text-slate-500">{{ new Date(o.createdAt).toLocaleTimeString() }}</p>
                  <div class="mt-2 flex items-center gap-2">
                    <select class="flex-1 rounded border px-2 py-1 text-sm" v-model="o.status">
                      <option value="New">New</option>
                      <option value="Paid">Paid</option>
                      <option value="Cooking">Cooking</option>
                      <option value="Served">Served</option>
                      <option value="Canceled">Canceled</option>
                    </select>
                    <button v-if="o.status!=='Canceled'" class="rounded bg-brand-primary text-white px-2 py-1 text-sm" @click="setOrderStatus(o, o.status==='New' ? 'Paid' : o.status==='Paid' ? 'Cooking' : o.status==='Cooking' ? 'Served' : 'Served')">ถัดไป</button>
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
                  <span class="text-[10px] px-2 py-0.5 rounded-full font-bold" :class="{
                      'bg-green-100 text-green-700': t.status==='VACANT',
                      'bg-yellow-100 text-yellow-700': t.status==='ORDERING',
                      'bg-blue-100 text-blue-700': t.status==='EATING',
                      'bg-purple-100 text-purple-700': t.status==='BILLING',
                      'bg-red-100 text-red-700': t.status==='CLEANING',
                    }">{{ t.status }}</span>
                </div>
                <button class="mt-2 w-full rounded-lg border px-2 py-1 text-sm" @click="cycleTableStatus(t)">เปลี่ยนสถานะ</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Menu Management -->
        <div v-else class="p-4 space-y-4 overflow-y-auto">
          <div class="flex items-center justify-between">
            <h4 class="font-extrabold text-ink">เมนูทั้งหมด</h4>
            <button class="rounded-lg bg-brand-primary text-white px-3 py-2 font-semibold" @click="openCreateMenu">+ เพิ่มเมนู</button>
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
                  <span v-if="m.soldOut" class="rounded bg-red-100 text-red-700 px-2 py-0.5">หมดชั่วคราว</span>
                </div>
                <div class="flex items-center gap-2 pt-1">
                  <button class="rounded-lg border px-3 py-1.5 text-sm" @click="openEditMenu(m)">แก้ไข</button>
                  <button class="rounded-lg border px-3 py-1.5 text-sm" @click="toggleSoldOut(m)">{{ m.soldOut ? 'เปิดขาย' : 'หมดชั่วคราว' }}</button>
                  <button class="ml-auto rounded-lg bg-red-600 text-white px-3 py-1.5 text-sm" @click="deleteMenuItem(m)">ลบ</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Menu Editor Modal -->
    <div v-if="editOpen" class="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center">
      <div class="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-4 max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-lg font-extrabold text-ink">{{ editTitle }}</h3>
          <button class="rounded-lg border px-3 py-1.5" @click="editOpen=false">ปิด</button>
        </div>
        <div class="grid gap-3">
          <div>
            <label class="text-sm font-semibold">ชื่อเมนู</label>
            <input v-model="formMenu.name" class="mt-1 w-full rounded-lg border px-3 py-2" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-sm font-semibold">ราคา</label>
              <input v-model.number="formMenu.price" type="number" min="0" class="mt-1 w-full rounded-lg border px-3 py-2" />
            </div>
            <div>
              <label class="text-sm font-semibold">หมวด</label>
              <select v-model="formMenu.category" class="mt-1 w-full rounded-lg border px-3 py-2">
                <option v-for="c in categories.filter(c=>c!=='ทั้งหมด')" :key="c" :value="c">{{ c }}</option>
              </select>
            </div>
          </div>
          <div>
            <label class="text-sm font-semibold">รูปภาพ</label>
            <input type="file" accept="image/*" class="mt-1 block w-full text-sm" @change="onPickImage" />
            <img v-if="formMenu.image" :src="formMenu.image" alt="preview" class="mt-2 h-32 w-full object-cover rounded" />
          </div>
          <div class="flex items-center gap-2">
            <input id="sold" type="checkbox" v-model="formMenu.soldOut" class="h-4 w-4" />
            <label for="sold" class="text-sm">หมดชั่วคราว</label>
          </div>
          <button class="w-full rounded-xl bg-brand-primary px-4 py-3 text-white font-extrabold" @click="saveMenu">บันทึก</button>
        </div>
      </div>
    </div>

    <!-- Toast -->
    <div v-if="showToast" class="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-white text-sm shadow-soft">{{ toastMsg }}</div>
  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
