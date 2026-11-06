import { defineConfig, presetUno, presetAttributify, presetIcons } from 'unocss'

export default defineConfig({
  presets: [presetUno(), presetAttributify(), presetIcons()],
  theme: {
    colors: {
      app: {
        bg: '#f4f6f8',
        panel: '#ffffff',
        border: '#e6e8eb',
        text: '#1f2328',
        sub: '#6b7280',
        primary: '#2563eb',
      },
    },
  },
  shortcuts: {
    'app-panel': 'bg-white border border-[#e6e8eb] rounded-xl',
    'tech-panel': 'bg-white border border-[#e6e8eb] rounded-xl',
    'tech-glow': 'shadow-sm hover:shadow-md transition-shadow',
    'tech-title': 'text-[#1f2328] font-semibold',
    'icon-btn':
      'inline-flex items-center justify-center h-9 px-2 rounded-lg text-[#4b5563] hover:bg-[#f3f4f6] cursor-pointer select-none',
  },
})
