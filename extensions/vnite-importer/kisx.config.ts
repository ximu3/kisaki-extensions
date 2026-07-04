import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from '@kisaki3/extension-cli/config'

export default defineConfig({
  ui: {
    plugins: [vue(), tailwindcss()]
  }
})
