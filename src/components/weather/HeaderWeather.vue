<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWeather, weatherKind } from '@/composables/useWeather'
import WeatherIcon from '@/components/weather/WeatherIcon.vue'

const { t, locale } = useI18n()
const { weather, loading, error, load } = useWeather()

/* ---------------- 实时时钟 ---------------- */
const now = ref(new Date())
let clockTimer = 0
onMounted(() => {
  clockTimer = window.setInterval(() => (now.value = new Date()), 1000)
})
onBeforeUnmount(() => clearInterval(clockTimer))

const pad = (n: number) => String(n).padStart(2, '0')

const timeText = computed(() => {
  const d = now.value
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
})

const dateText = computed(() => {
  const d = now.value
  if (locale.value === 'en') {
    const month = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(d)
    const week = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(d)
    return `${month} ${d.getDate()}, ${week}`
  }
  const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()]
  return `${d.getMonth() + 1}月${d.getDate()}日 ${week}`
})

/* ---------------- 天气展示 ---------------- */
const kind = computed(() => weatherKind(weather.value?.code ?? 3))
const isDay = computed(() => weather.value?.isDay ?? true)

/** 图标底色：按天气类型区分色调，浅色界面下保持柔和 */
const tone = computed(() => {
  if (kind.value === 'clear') return isDay.value ? 'tone-sun' : 'tone-night'
  if (kind.value === 'rain' || kind.value === 'drizzle') return 'tone-rain'
  if (kind.value === 'snow') return 'tone-snow'
  if (kind.value === 'thunder') return 'tone-thunder'
  if (kind.value === 'fog') return 'tone-fog'
  return 'tone-cloud'
})

const desc = computed(() => {
  switch (kind.value) {
    case 'clear':
      return t('weather.clear')
    case 'partly':
      return t('weather.partly')
    case 'cloudy':
      return t('weather.cloudy')
    case 'fog':
      return t('weather.fog')
    case 'drizzle':
      return t('weather.drizzle')
    case 'rain':
      return t('weather.rain')
    case 'snow':
      return t('weather.snow')
    default:
      return t('weather.thunder')
  }
})

const city = computed(() => {
  const loc = weather.value?.location
  if (!loc || loc.source === 'default') return t('weather.defaultCity')
  return loc.city
})

const tempText = computed(() => (weather.value ? `${weather.value.temperature}°` : '--°'))

/** 当前温度在当日区间中的位置，用于温度条 */
const rangePos = computed(() => {
  const w = weather.value
  if (!w) return 50
  const span = Math.max(1, w.high - w.low)
  return Math.min(100, Math.max(0, ((w.temperature - w.low) / span) * 100))
})

const updatedText = computed(() => {
  const w = weather.value
  if (!w) return ''
  const d = new Date(w.fetchedAt)
  return t('weather.updated', { time: `${pad(d.getHours())}:${pad(d.getMinutes())}` })
})
</script>

<template>
  <div class="hw-card">
    <!-- 日期时间 -->
    <div class="hw-clock">
      <span class="hw-time">{{ timeText }}</span>
      <span class="hw-date">{{ dateText }}</span>
    </div>

    <span class="hw-divider" />

    <!-- 天气 -->
    <el-popover placement="bottom-end" :width="264" trigger="click" popper-class="hw-pop" :show-arrow="false">
      <template #reference>
        <button type="button" class="hw-weather" :title="`${city} · ${desc}`">
          <span class="hw-icon" :class="tone">
            <WeatherIcon :kind="kind" :is-day="isDay" :size="16" />
          </span>
          <span class="hw-temp">{{ tempText }}</span>
          <span class="hw-desc hidden lg:inline">{{ desc }}</span>
        </button>
      </template>

      <div class="hw-detail">
        <div class="hw-detail-head">
          <div class="min-w-0">
            <p class="hw-detail-city">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
                <circle cx="12" cy="10" r="2.6" />
              </svg>
              {{ city }}
            </p>
            <p class="hw-detail-sub">{{ updatedText || t('weather.loading') }}</p>
          </div>
          <button
            type="button"
            class="hw-refresh"
            :class="{ spinning: loading }"
            :aria-label="t('weather.refresh')"
            :title="t('weather.refresh')"
            @click="load(true)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 11.5A8 8 0 1 0 18.4 16" />
              <path d="M20 5.5v6h-6" />
            </svg>
          </button>
        </div>

        <div class="hw-detail-main">
          <span class="hw-icon hw-icon-lg" :class="tone">
            <WeatherIcon :kind="kind" :is-day="isDay" :size="22" />
          </span>
          <div class="min-w-0">
            <p class="hw-detail-temp">{{ weather ? `${weather.temperature}°` : '--°' }}</p>
            <p class="hw-detail-desc">
              {{ desc }}
              <template v-if="weather">
                <span class="hw-dot">·</span>{{ t('weather.feelsLike') }} {{ weather.apparent }}°
              </template>
            </p>
          </div>
        </div>

        <ul class="hw-metrics">
          <li>
            <span>{{ t('weather.humidity') }}</span>
            <b>{{ weather ? `${weather.humidity}%` : '--' }}</b>
          </li>
          <li>
            <span>{{ t('weather.wind') }}</span>
            <b>{{ weather ? `${weather.wind}` : '--' }}<i v-if="weather"> km/h</i></b>
          </li>
          <li>
            <span>{{ t('weather.precip') }}</span>
            <b>{{ weather ? weather.precipitation.toFixed(1) : '--' }}<i v-if="weather"> mm</i></b>
          </li>
        </ul>

        <div v-if="weather" class="hw-range">
          <span class="hw-range-label">{{ t('weather.low') }} {{ weather.low }}°</span>
          <span class="hw-range-track">
            <i class="hw-range-fill" :style="{ width: `${rangePos}%` }" />
            <i class="hw-range-knob" :style="{ left: `${rangePos}%` }" />
          </span>
          <span class="hw-range-label">{{ t('weather.high') }} {{ weather.high }}°</span>
        </div>

        <p v-if="error" class="hw-detail-error">{{ t('weather.failed') }}</p>
        <p class="hw-detail-foot">{{ t('weather.source') }}</p>
      </div>
    </el-popover>
  </div>
</template>

<style scoped>
.hw-card {
  display: flex;
  flex: none;
  align-items: center;
  height: 34px;
  padding: 0 6px 0 11px;
  border: 1px solid #e6e8eb;
  border-radius: 10px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.hw-card:hover {
  border-color: #d8e2f0;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.05);
}

.hw-clock {
  display: flex;
  flex-direction: column;
  justify-content: center;
  line-height: 1.15;
}
.hw-time {
  color: #1f2328;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
  font-variant-numeric: tabular-nums;
}
.hw-date {
  color: #9ca3af;
  font-size: 10.5px;
  white-space: nowrap;
}

.hw-divider {
  width: 1px;
  height: 18px;
  margin: 0 6px 0 10px;
  background: #e8ebef;
}

.hw-weather {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 8px 0 5px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  transition: background 0.15s ease;
}
.hw-weather:hover {
  background: rgba(37, 99, 235, 0.06);
}

.hw-icon {
  display: grid;
  flex: none;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 7px;
}
.tone-sun {
  background: linear-gradient(135deg, #fff8e6, #ffe6b0);
  color: #f59e0b;
}
.tone-night {
  background: linear-gradient(135deg, #eef2ff, #dbe3ff);
  color: #4f46e5;
}
.tone-cloud {
  background: linear-gradient(135deg, #f8fafc, #e6ecf3);
  color: #64748b;
}
.tone-rain {
  background: linear-gradient(135deg, #f0f7ff, #d5e6ff);
  color: #2563eb;
}
.tone-snow {
  background: linear-gradient(135deg, #f1fdff, #d7f4fb);
  color: #0891b2;
}
.tone-thunder {
  background: linear-gradient(135deg, #fff8ed, #ffe6c7);
  color: #ea580c;
}
.tone-fog {
  background: linear-gradient(135deg, #f9fafb, #e8edf3);
  color: #94a3b8;
}

.hw-temp {
  color: #1f2328;
  font-size: 12.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.hw-desc {
  color: #6b7280;
  font-size: 11.5px;
  white-space: nowrap;
}

/* ---------------- 详情面板 ---------------- */
.hw-detail {
  padding: 2px 2px 0;
}
.hw-detail-head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  justify-content: space-between;
}
.hw-detail-city {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  color: #1f2328;
  font-size: 13px;
  font-weight: 600;
}
.hw-detail-city svg {
  color: #9ca3af;
}
.hw-detail-sub {
  margin: 3px 0 0;
  color: #9ca3af;
  font-size: 11px;
}
.hw-refresh {
  display: grid;
  flex: none;
  place-items: center;
  width: 26px;
  height: 26px;
  border: 1px solid #e6e8eb;
  border-radius: 8px;
  background: #fff;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s ease;
}
.hw-refresh:hover {
  border-color: #c7d7fb;
  color: #2563eb;
}
.hw-refresh.spinning svg {
  animation: hw-spin 0.9s linear infinite;
}
@keyframes hw-spin {
  to {
    transform: rotate(360deg);
  }
}

.hw-detail-main {
  display: flex;
  align-items: center;
  gap: 11px;
  margin-top: 12px;
}
.hw-icon-lg {
  width: 40px;
  height: 40px;
  border-radius: 12px;
}
.hw-detail-temp {
  margin: 0;
  color: #1f2328;
  font-size: 24px;
  font-weight: 650;
  line-height: 1.1;
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
}
.hw-detail-desc {
  margin: 3px 0 0;
  color: #6b7280;
  font-size: 11.5px;
}
.hw-dot {
  margin: 0 4px;
  color: #d1d5db;
}

.hw-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}
.hw-metrics li {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 7px 9px;
  border-radius: 9px;
  background: #f8fafc;
}
.hw-metrics span {
  color: #9ca3af;
  font-size: 10.5px;
}
.hw-metrics b {
  color: #1f2328;
  font-size: 12.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.hw-metrics i {
  color: #9ca3af;
  font-size: 10px;
  font-style: normal;
  font-weight: 400;
}

.hw-range {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}
.hw-range-label {
  flex: none;
  color: #9ca3af;
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
}
.hw-range-track {
  position: relative;
  flex: 1;
  height: 4px;
  border-radius: 999px;
  background: linear-gradient(90deg, #bfdbfe, #fde68a);
}
.hw-range-fill {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.32);
}
.hw-range-knob {
  position: absolute;
  top: 50%;
  width: 8px;
  height: 8px;
  margin-left: -4px;
  border: 1.5px solid #fff;
  border-radius: 50%;
  background: #2563eb;
  box-shadow: 0 1px 3px rgba(37, 99, 235, 0.4);
  transform: translateY(-50%);
}

.hw-detail-error {
  margin: 10px 0 0;
  color: #ef4444;
  font-size: 11px;
}
.hw-detail-foot {
  margin: 10px 0 0;
  padding-top: 8px;
  border-top: 1px solid #f1f3f6;
  color: #b0b7c0;
  font-size: 10px;
}

/* 小屏：只保留时间，隐藏日期与文案 */
@media (max-width: 767px) {
  .hw-date,
  .hw-desc {
    display: none;
  }
  .hw-card {
    height: 32px;
    padding-left: 8px;
  }
}
@media (max-width: 479px) {
  .hw-card {
    height: 30px;
    padding: 0 4px 0 8px;
  }
  .hw-time {
    font-size: 12px;
  }
  .hw-divider {
    margin: 0 4px 0 6px;
  }
  .hw-weather {
    padding: 0 4px;
    gap: 4px;
  }
}
@media (max-width: 359px) {
  .hw-clock,
  .hw-divider {
    display: none;
  }
}

:global(.hw-pop) {
  padding: 12px 14px 12px !important;
  border-radius: 14px !important;
  border: 1px solid #eceff3 !important;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.12) !important;
}
</style>
