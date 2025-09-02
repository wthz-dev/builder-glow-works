<script setup lang="ts">
import { reactive, computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

type OrderStatus = 'New' | 'Paid' | 'Cooking' | 'Served' | 'Canceled'
type TableStatus = 'VACANT' | 'ORDERING' | 'EATING' | 'BILLING' | 'CLEANING'

interface CartItem {
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
  status: OrderStatus
  createdAt: number
}
interface TableInfo {
  no: number
  status: TableStatus
}

const brandName = 'ร้านก๋วยเตี๋ยวเส้นทอง'
const TABLE_COUNT = 20

function loadLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

const orders = reactive<Order[]>(loadLocal<Order[]>('noodle_orders', []))
const tables = reactive<TableInfo[]>(
  loadLocal<TableInfo[]>('noodle_tables', Array.from({ length: TABLE_COUNT }).map((_, i) => ({ no: i + 1, status: 'VACANT' }) as TableInfo)),
)

const groupedOrders = computed(() => {
  const map: Record<OrderStatus, Order[]> = { New: [], Paid: [], Cooking: [], Served: [], Canceled: [] }
  for (const o of orders) map[o.status].push(o)
  return map
})

function setOrderStatus(o: Order, s: OrderStatus) { o.status = s; try { localStorage.setItem('noodle_orders', JSON.stringify(orders)) } catch {} }
function cycleTableStatus(t: TableInfo) {
  const seq: TableStatus[] = ['VACANT', 'ORDERING', 'EATING', 'BILLING', 'CLEANING']
  const idx = seq.indexOf(t.status)
  t.status = seq[(idx + 1) % seq.length]
  try { localStorage.setItem('noodle_tables', JSON.stringify(tables)) } catch {}
}

function getTableLink(no: number) {
  const url = new URL(window.location.origin + '/')
  url.searchParams.set('table', String(no))
  return url.toString()
}
function getTableQR(no: number) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(getTableLink(no))}`
}
async function copyLink(no: number) {
  try { await navigator.clipboard.writeText(getTableLink(no)); alert(`คัดลอกลิงก์โต๊ะ ${no} แล้ว`) } catch { alert('คัดลอกไม่สำเร็จ') }
}
function openLink(no: number) { window.open(getTableLink(no), '_blank') }
function downloadQR(no: number) {
  const a = document.createElement('a'); a.href = getTableQR(no); a.download = `table-${no}-qr.png`; document.body.appendChild(a); a.click(); a.remove()
}

function logoutOwner() {
  try { localStorage.setItem('noodle_owner_logged_in', '0') } catch {}
  router.push('/')
}

const router = useRouter()

// === i18n (Thai Labels) ===
const orderStatusTh: Record<OrderStatus, string> = {
  New: 'ใหม่',
  Paid: 'ชำระแล้ว',
  Cooking: 'กำลังทำ',
  Served: 'เสิร์ฟแล้ว',
  Canceled: 'ยกเลิก',
}
const tableStatusTh: Record<TableStatus, string> = {
  VACANT: 'ว่าง',
  ORDERING: 'กำลังสั่ง',
  EATING: 'กำลังกิน',
  BILLING: 'ขอเช็คบิล',
  CLEANING: 'กำลังทำความสะอาด',
}
const orderColumns: OrderStatus[] = ['New','Paid','Cooking','Served','Canceled']

// === Controls for large order volume ===
const filterTable = ref('')
const sortOrder = ref<'desc' | 'asc'>('desc')
const showActiveOnly = ref(true)

const visibleColumns = computed<OrderStatus[]>(() => showActiveOnly.value ? ['New','Paid','Cooking'] : orderColumns)

function filteredSorted(col: OrderStatus) {
  const list = groupedOrders.value[col]
    .filter(o => (filterTable.value ? String(o.table).includes(filterTable.value.trim()) : true))
    .slice()
  list.sort((a, b) => sortOrder.value === 'desc' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt)
  return list
}

function cancelOrder(o: Order) {
  if (confirm(`ยกเลิกออเดอร์โต๊ะ ${o.table}?`)) setOrderStatus(o, 'Canceled')
}

function formatItemLine(c: CartItem): string {
  const parts: string[] = [c.options.noodle, c.options.soup, c.options.spice]
  if (c.options.toppings && c.options.toppings.length) parts.push('+' + c.options.toppings.join(', '))
  if (c.options.note && c.options.note.trim()) parts.push('"' + c.options.note.trim() + '"')
  return parts.join(' • ')
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-noodle to-white">
    <header class="sticky top-0 z-40 bg-white text-black border-b shadow">
      <div class="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-3 select-none">
          <div class="h-9 w-9 rounded-full bg-gradient-to-br from-brand-primary to-broth flex items-center justify-center text-white font-bold shadow">🍜</div>
          <div>
            <h1 class="text-lg font-extrabold text-ink">Owner • {{ brandName }}</h1>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <RouterLink to="/owner/menu" class="rounded-lg border px-3 py-1.5">จัดการเมนู</RouterLink>
          <RouterLink to="/owner/print" class="rounded-lg border px-3 py-1.5">พิมพ์ป้ายโต๊ะ</RouterLink>
          <button class="rounded-lg border px-3 py-1.5" @click="logoutOwner">ออกจากระบบ</button>
          <RouterLink to="/" class="rounded-lg border px-3 py-1.5">ปิด</RouterLink>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-5xl text-[#333] p-4 space-y-6">
      <section class="rounded-xl bg-white border p-3 flex flex-wrap items-center gap-3">
        <div class="flex items-center gap-2">
          <label class="text-sm text-slate-600">ค้นหาโต๊ะ</label>
          <input v-model="filterTable" class="rounded border px-2 py-1 text-sm" placeholder="เช่น 1" />
        </div>
        <div class="flex items-center gap-2">
          <label class="text-sm text-slate-600">เรียงเวลา</label>
          <select v-model="sortOrder" class="rounded border px-2 py-1 text-sm">
            <option value="desc">ใหม่ → เก่า</option>
            <option value="asc">เก่า → ใหม่</option>
          </select>
        </div>
        <label class="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" v-model="showActiveOnly" /> เฉพาะที่กำลังทำงาน
        </label>
      </section>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div v-for="col in visibleColumns" :key="col" class="rounded-xl bg-slate-50 p-0 overflow-hidden border">
          <div class="flex items-center justify-between mb-2">
            <h4 class="font-extrabold text-ink px-3 pt-3">{{ orderStatusTh[col] }}</h4>
            <span class="text-xs text-slate-500 px-3 pt-3">{{ filteredSorted(col).length }}</span>
          </div>
          <div class="space-y-2 max-h-[60vh] overflow-y-auto px-3 pb-3">
            <div v-for="o in filteredSorted(col)" :key="o.id" class="rounded-lg border bg-white p-3">
              <div class="flex items-center justify-between">
                <p class="font-bold">โต๊ะ {{ o.table }}</p>
                <span class="text-xs text-slate-500">฿{{ o.total }}</span>
              </div>
              <p class="text-xs text-slate-500">{{ new Date(o.createdAt).toLocaleTimeString() }}</p>
              <div class="mt-2 space-y-1">
                <div v-for="(c, i) in o.items" :key="i" class="text-xs text-slate-700">
                  <span class="font-semibold">x{{ c.quantity }}</span>
                  <span class="font-bold ml-1">{{ c.name }}</span>
                  <span class="ml-1 text-slate-500">{{ formatItemLine(c) }}</span>
                </div>
              </div>
              <div class="mt-2 flex items-center gap-2">
                <select class="flex-1 rounded border px-2 py-1 text-sm" v-model="o.status">
                  <option value="New">{{ orderStatusTh['New'] }}</option>
                  <option value="Paid">{{ orderStatusTh['Paid'] }}</option>
                  <option value="Cooking">{{ orderStatusTh['Cooking'] }}</option>
                  <option value="Served">{{ orderStatusTh['Served'] }}</option>
                  <option value="Canceled">{{ orderStatusTh['Canceled'] }}</option>
                </select>
                <button v-if="o.status !== 'Canceled'" class="rounded bg-brand-primary text-white px-2 py-1 text-sm" @click="setOrderStatus(o, o.status === 'New' ? 'Paid' : o.status === 'Paid' ? 'Cooking' : o.status === 'Cooking' ? 'Served' : 'Served')">ถัดไป</button>
                <button v-if="o.status !== 'Canceled' && o.status !== 'Served'" class="rounded border px-2 py-1 text-sm" @click="cancelOrder(o)">ยกเลิก</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h4 class="font-extrabold text-ink mb-2">สถานะโต๊ะ</h4>
        <div class="grid grid-cols-3 sm:grid-cols-6 text-[#333] gap-2">
          <div v-for="t in tables" :key="t.no" class="rounded-xl border p-3 bg-white">
            <div class="flex items-center justify-between">
              <p class="font-bold">โต๊ะ {{ t.no }}</p>
              <span class="text-[10px] px-2 py-0.5 rounded-full font-bold" :class="{
                'bg-green-100 text-green-700': t.status === 'VACANT',
                'bg-yellow-100 text-yellow-700': t.status === 'ORDERING',
                'bg-blue-100 text-blue-700': t.status === 'EATING',
                'bg-purple-100 text-purple-700': t.status === 'BILLING',
                'bg-red-100 text-red-700': t.status === 'CLEANING',
              }">{{ tableStatusTh[t.status] }}</span>
            </div>
            <button class="mt-2 w-full rounded-lg border px-2 py-1 text-sm" @click="cycleTableStatus(t)">เปลี่ยนสถานะ</button>
          </div>
        </div>
      </div>

      <div class="pt-4">
        <h4 class="font-extrabold text-ink mb-2">ลิงก์ & QR ต่อโต๊ะ</h4>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 text-[#333] gap-2">
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
    </main>
  </div>
</template>
