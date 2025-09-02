<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'

interface MenuItem {
  id: string
  name: string
  price: number
  image: string
  category: string
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

const brandName = 'ร้านก๋วยเตี๋ยวเส้นทอง'

const urlParams = new URLSearchParams(window.location.search)
const table = urlParams.get('table') || '-'

const categories = ['ทั้งหมด', 'ก๋วยเตี๋ยว', 'เย็นตาโฟ', 'ต้มยำ', 'แห้ง', 'ของทานเล่น', 'เครื่องดื่ม']
const selectedCategory = ref('ทั้งหมด')

const loading = ref(true)

const menu: MenuItem[] = reactive([
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
])

const filteredMenu = computed(() =>
  selectedCategory.value === 'ทั้งหมด'
    ? menu
    : menu.filter((m) => m.category === selectedCategory.value),
)

const cart = ref<CartItem[]>([])
const promoCode = ref('')
const discount = ref(0)

const cartCount = computed(() => cart.value.reduce((a, c) => a + c.quantity, 0))
const subtotal = computed(() =>
  cart.value.reduce((a, c) => a + c.basePrice * c.quantity, 0),
)
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

function openCart() {
  checkoutStep.value = 'cart'
  showCart.value = true
}

function orderNow() {
  if (!cart.value.length) return toast('โปรดเลือกเมนูก่อน')
  checkoutStep.value = 'payment'
  orderId.value = `T${String(table).padStart(2, '0')}-${Date.now().toString().slice(-6)}`
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
  }
}

function toast(msg: string) {
  showToast.value = true
  toastMsg.value = msg
  setTimeout(() => (showToast.value = false), 1800)
}
const showToast = ref(false)
const toastMsg = ref('')

onMounted(() => {
  setTimeout(() => (loading.value = false), 800)
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-noodle to-white">
    <!-- Header -->
    <header class="sticky top-0 z-40 bg-white/90 backdrop-blur shadow-soft">
      <div class="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="h-9 w-9 rounded-full bg-gradient-to-br from-brand-primary to-broth flex items-center justify-center text-white font-bold shadow">
            🍜
          </div>
          <div>
            <h1 class="text-lg font-extrabold text-ink">{{ brandName }}</h1>
            <p class="text-xs text-slate-500">โต๊ะ: <span class="font-semibold">{{ table }}</span></p>
          </div>
        </div>
        <button
          class="hidden sm:inline-flex items-center gap-2 rounded-lg bg-brand-primary px-3 py-2 text-white text-sm font-semibold shadow hover:bg-brand-accent active:scale-[.98]"
          @click="toast('โหมดเจ้าของร้านเป็นเพลสโฮลเดอร์')"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
            <path d="M11.7 2.1a.75.75 0 0 1 .6 0l7.5 3.214a.75.75 0 0 1 .45.69V10.5a9.75 9.75 0 1 1-16.5 6.864V6.004a.75.75 0 0 1 .45-.69L11.7 2.1Z"/>
          </svg>
          สำหรับเจ้าของ
        </button>
      </div>
    </header>

    <!-- Category pills -->
    <div class="mx-auto max-w-5xl px-4 pt-4">
      <div class="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        <button
          v-for="c in categories"
          :key="c"
          class="whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition-colors"
          :class="selectedCategory === c ? 'bg-brand-primary text-white border-brand-primary' : 'bg-white text-ink border-slate-200 hover:bg-slate-50'"
          @click="selectedCategory = c"
        >
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
        <div v-if="filteredMenu.length === 0" class="text-center py-16 text-slate-500">
          ไม่มีเมนูในหมวดนี้
        </div>

        <div v-else class="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <article
            v-for="item in filteredMenu"
            :key="item.id"
            class="rounded-xl bg-white shadow-soft overflow-hidden border border-slate-100"
          >
            <img :src="item.image" :alt="item.name" class="h-28 w-full object-cover sm:h-36" />
            <div class="p-3">
              <h3 class="font-bold text-ink leading-tight line-clamp-2">{{ item.name }}</h3>
              <div class="mt-1 flex items-center justify-between">
                <p class="text-brand-accent font-extrabold">฿{{ item.price }}</p>
                <button
                  class="rounded-lg bg-brand-primary px-3 py-1.5 text-white text-sm font-semibold shadow hover:bg-brand-accent active:scale-[.98]"
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
    <div
      class="fixed inset-x-0 bottom-0 z-40"
      v-if="cartCount > 0"
    >
      <div class="mx-auto max-w-5xl p-3">
        <div class="rounded-2xl bg-ink text-white shadow-soft p-3 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-primary px-2 text-xs font-bold">{{ cartCount }}</span>
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
              <button v-for="n in ['เส้นเล็ก','เส้นใหญ่','บะหมี่','วุ้นเส้น']" :key="n" @click="form.noodle = n"
                class="rounded-lg border px-3 py-2 text-sm font-semibold"
                :class="form.noodle===n ? 'bg-brand-primary text-white border-brand-primary' : 'bg-white text-ink border-slate-200'">
                {{ n }}
              </button>
            </div>
          </div>
          <div>
            <label class="text-sm font-semibold text-ink">น้ำซุป</label>
            <div class="mt-2 grid grid-cols-4 gap-2">
              <button v-for="s in ['น้ำใ��','น้ำตก','ต้มยำ','แห้ง']" :key="s" @click="form.soup = s"
                class="rounded-lg border px-3 py-2 text-sm font-semibold"
                :class="form.soup===s ? 'bg-brand-primary text-white border-brand-primary' : 'bg-white text-ink border-slate-200'">
                {{ s }}
              </button>
            </div>
          </div>
          <div>
            <label class="text-sm font-semibold text-ink">ความเผ็ด</label>
            <div class="mt-2 grid grid-cols-4 gap-2">
              <button v-for="sp in ['ไม่เผ็ด','เผ็ดน้อย','เผ็ดกลาง','เผ็ดมาก']" :key="sp" @click="form.spice = sp"
                class="rounded-lg border px-3 py-2 text-sm font-semibold"
                :class="form.spice===sp ? 'bg-brand-primary text-white border-brand-primary' : 'bg-white text-ink border-slate-200'">
                {{ sp }}
              </button>
            </div>
          </div>
          <div>
            <label class="text-sm font-semibold text-ink">ท็อปปิ้ง</label>
            <div class="mt-2 grid grid-cols-3 gap-2">
              <button v-for="t in ['หมู','ลูกชิ้น','ตับ','กากหมู','คะน้า','ถั่วงอก']" :key="t" @click="toggleTopping(t)"
                class="rounded-lg border px-3 py-2 text-sm font-semibold"
                :class="form.toppings.includes(t) ? 'bg-leaf text-white border-leaf' : 'bg-white text-ink border-slate-200'">
                {{ t }}
              </button>
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

          <button class="w-full rounded-xl bg-brand-primary px-4 py-3 text-white font-extrabold text-lg shadow disabled:opacity-50" :disabled="!cart.length" @click="orderNow">
            สั่งเลย
          </button>
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
          <button class="w-full rounded-xl bg-ink px-4 py-3 text-white font-extrabold" @click="paymentStatus='paid'; checkoutStep='status'">ชำระสำเร็จ (ทดลอง)</button>
        </div>

        <!-- Status -->
        <div v-else class="p-6 space-y-4 text-center">
          <div class="mx-auto h-16 w-16 rounded-full flex items-center justify-center" :class="{
              'bg-yellow-100 text-yellow-700': paymentStatus==='pending',
              'bg-green-100 text-green-700': paymentStatus==='paid',
              'bg-red-100 text-red-700': paymentStatus==='failed',
            }">
            <svg v-if="paymentStatus==='pending'" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" class="w-8 h-8"><path d="M12 2.25a9.75 9.75 0 1 0 9.75 9.75A9.76 9.76 0 0 0 12 2.25Zm.75 5.25a.75.75 0 0 0-1.5 0v5.25c0 .414.336.75.75.75H15a.75.75 0 0 0 0-1.5h-2.25Z"/></svg>
            <svg v-else-if="paymentStatus==='paid'" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" class="w-8 h-8"><path d="M9 12.75 11.25 15l4.5-4.5 1.5 1.5L11.25 18 7.5 14.25Z"/></svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" class="w-8 h-8"><path d="M12 2.25a9.75 9.75 0 1 0 9.75 9.75A9.76 9.76 0 0 0 12 2.25Zm3.53 12.72-1.06 1.06L12 13.56l-2.47 2.47-1.06-1.06L10.94 12 8.47 9.53l1.06-1.06L12 10.94l2.47-2.47 1.06 1.06L13.06 12Z"/></svg>
          </div>
          <h4 class="text-xl font-extrabold text-ink" v-if="paymentStatus==='pending'">รอเช็กยอด</h4>
          <h4 class="text-xl font-extrabold text-ink" v-else-if="paymentStatus==='paid'">ชำระแล้ว</h4>
          <h4 class="text-xl font-extrabold text-ink" v-else>ไม่สำเร็จ</h4>
          <p class="text-sm text-slate-500" v-if="slipName">ไฟล์: {{ slipName }}</p>
          <div class="pt-2">
            <a href="tel:0800000000" class="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-3 text-white font-extrabold">
              ติดต่อพนักงาน
            </a>
          </div>
        </div>
      </div>
    </div>

    <!-- Toast -->
    <div v-if="showToast" class="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-white text-sm shadow-soft">{{ toastMsg }}</div>
  </div>
</template>

<style scoped>
/**** small utilities ****/
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
