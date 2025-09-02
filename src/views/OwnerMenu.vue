<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

interface MenuItem {
  id: string
  name: string
  price: number
  category: string
  image?: string
  soldOut?: boolean
}

const brandName = 'ร้านก๋วยเตี๋ยวเส้นทอง'

function loadLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function saveLocal<T>(key: string, value: T) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

const items = reactive<MenuItem[]>(loadLocal<MenuItem[]>('noodle_menu', [
  { id: crypto.randomUUID(), name: 'ก๋วยเตี๋ยวหมูน้ำใส', price: 50, category: 'ก๋วยเตี๋ยว' },
]))

const draft = reactive<MenuItem>({ id: '', name: '', price: 0, category: '', image: '', soldOut: false })
const editingId = ref<string>('')
const q = ref('')
const sortBy = ref<'name'|'price'>('name')
const sortDir = ref<'asc'|'desc'>('asc')

const filtered = computed(() => {
  const list = items.filter(i => q.value ? (i.name + ' ' + i.category).toLowerCase().includes(q.value.toLowerCase()) : true)
  list.sort((a, b) => {
    const dir = sortDir.value === 'asc' ? 1 : -1
    if (sortBy.value === 'price') return (a.price - b.price) * dir
    return a.name.localeCompare(b.name) * dir
  })
  return list
})

function resetDraft() {
  Object.assign(draft, { id: '', name: '', price: 0, category: '', image: '', soldOut: false })
}

function startAdd() {
  editingId.value = ''
  resetDraft()
}

function startEdit(it: MenuItem) {
  editingId.value = it.id
  Object.assign(draft, JSON.parse(JSON.stringify(it)))
}

function saveDraft() {
  if (!draft.name.trim()) return alert('กรุณากรอกชื่อเมนู')
  if (draft.price < 0) return alert('กรุณากรอกราคาให้ถูกต้อง')
  if (editingId.value) {
    const idx = items.findIndex(i => i.id === editingId.value)
    if (idx >= 0) items[idx] = { ...draft, id: editingId.value }
  } else {
    items.unshift({ ...draft, id: crypto.randomUUID() })
  }
  saveLocal('noodle_menu', items)
  startAdd()
}

function removeItem(it: MenuItem) {
  if (!confirm(`ลบเมนู “${it.name}” ?`)) return
  const idx = items.findIndex(i => i.id === it.id)
  if (idx >= 0) items.splice(idx, 1)
  saveLocal('noodle_menu', items)
}

function toggleSoldOut(it: MenuItem) {
  it.soldOut = !it.soldOut
  saveLocal('noodle_menu', items)
}

const router = useRouter()
function backToOwner() { router.push('/owner') }
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-noodle to-white text-[#333]">
    <header class="sticky top-0 z-40 bg-white text-black border-b shadow">
      <div class="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-3 select-none">
          <div class="h-9 w-9 rounded-full bg-gradient-to-br from-brand-primary to-broth flex items-center justify-center text-white font-bold shadow">🍜</div>
          <div>
            <h1 class="text-lg font-extrabold text-ink">จัดการเมนู • {{ brandName }}</h1>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <RouterLink to="/owner" class="rounded-lg border px-3 py-1.5">กลับหน้า Owner</RouterLink>
          <RouterLink to="/" class="rounded-lg border px-3 py-1.5">ปิด</RouterLink>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-5xl p-4 space-y-4">
      <section class="rounded-xl bg-white border p-3 flex flex-wrap items-center gap-3">
        <div class="flex items-center gap-2">
          <label class="text-sm text-slate-600">ค้นหา</label>
          <input v-model="q" placeholder="พิมพ์ชื่อเมนู" class="rounded border px-2 py-1 text-sm" />
        </div>
        <div class="flex items-center gap-2">
          <label class="text-sm text-slate-600">เรียงโดย</label>
          <select v-model="sortBy" class="rounded border px-2 py-1 text-sm">
            <option value="name">ชื่อ</option>
            <option value="price">ราคา</option>
          </select>
          <select v-model="sortDir" class="rounded border px-2 py-1 text-sm">
            <option value="asc">น้อย→มาก / ก-ฮ</option>
            <option value="desc">มาก→น้อย / ฮ-ก</option>
          </select>
        </div>
      </section>

      <section class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="rounded-xl bg-white border p-3 order-2 lg:order-1">
          <h3 class="font-extrabold mb-2">รายการเมนู</h3>
          <div class="max-h-[65vh] overflow-y-auto space-y-2">
            <div v-for="it in filtered" :key="it.id" class="rounded-lg border p-3 bg-white">
              <div class="flex items-start justify-between gap-2">
                <div>
                  <p class="font-bold" :class="{ 'line-through text-slate-400': it.soldOut }">{{ it.name }}</p>
                  <p class="text-xs text-slate-500">หมวด: {{ it.category || '-' }}</p>
                  <p class="text-xs text-slate-500">ราคา: ฿{{ it.price }}</p>
                </div>
                <div class="flex items-center gap-2">
                  <button class="rounded border px-2 py-1 text-sm" @click="startEdit(it)">แก้ไข</button>
                  <button class="rounded border px-2 py-1 text-sm" @click="toggleSoldOut(it)">{{ it.soldOut ? 'เปิดขาย' : 'ปิดขาย' }}</button>
                  <button class="rounded border px-2 py-1 text-sm" @click="removeItem(it)">ลบ</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="rounded-xl bg-white border p-3 order-1 lg:order-2">
          <h3 class="font-extrabold mb-2">{{ editingId ? 'แก้ไขเมนู' : 'เพิ่มเมนูใหม่' }}</h3>
          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <label class="w-28 text-sm text-slate-600">ชื่อเมนู</label>
              <input v-model="draft.name" class="flex-1 rounded border px-2 py-1" />
            </div>
            <div class="flex items-center gap-2">
              <label class="w-28 text-sm text-slate-600">ราคา</label>
              <input v-model.number="draft.price" type="number" min="0" class="w-40 rounded border px-2 py-1" />
            </div>
            <div class="flex items-center gap-2">
              <label class="w-28 text-sm text-slate-600">หมวด</label>
              <input v-model="draft.category" class="flex-1 rounded border px-2 py-1" />
            </div>
            <div class="flex items-center gap-2">
              <label class="w-28 text-sm text-slate-600">รูป (URL)</label>
              <input v-model="draft.image" class="flex-1 rounded border px-2 py-1" />
            </div>
            <div class="flex items-center gap-2">
              <label class="w-28 text-sm text-slate-600">สถานะ</label>
              <label class="text-sm">
                <input type="checkbox" v-model="draft.soldOut" /> ปิดขายชั่วคราว
              </label>
            </div>
            <div class="flex items-center gap-2 pt-2">
              <button class="rounded bg-brand-primary text-white px-3 py-1.5" @click="saveDraft">บันทึก</button>
              <button class="rounded border px-3 py-1.5" @click="startAdd">ล้างฟอร์ม</button>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>
