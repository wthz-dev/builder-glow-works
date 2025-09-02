<script setup lang="ts">
const brandName = 'ร้านก๋วยเตี๋ยวเส้นทอง'
const TABLE_COUNT = 20

function getTableLink(no: number) {
  const url = new URL(window.location.origin + window.location.pathname)
  url.searchParams.set('table', String(no))
  return url.toString()
}

function getTableQR(no: number) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(getTableLink(no))}`
}

function triggerPrint() {
  setTimeout(() => window.print(), 50)
}
</script>

<template>
  <div class="min-h-screen bg-white">
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
          <RouterLink to="/owner" class="rounded-lg border px-3 py-1.5">กลับ</RouterLink>
          <button class="rounded-lg bg-brand-primary text-white px-3 py-1.5" @click="triggerPrint">สั่งพิมพ์</button>
        </div>
      </div>
    </div>

    <div class="mx-auto max-w-5xl px-6 py-6 print:px-0">
      <div class="print-grid-a4">
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
</template>

<style scoped>
.print-grid-a4 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}
@media print {
  @page { size: A4; margin: 10mm; }
  .print-grid-a4 { gap: 8mm !important; }
  .poster { break-inside: avoid; page-break-inside: avoid; height: calc((297mm - 20mm - 8mm) / 2); }
  .qr-img { width: 60mm !important; height: 60mm !important; }
}
</style>
