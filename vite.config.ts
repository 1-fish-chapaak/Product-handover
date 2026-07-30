import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Pinned, not "preferred". Surfaces that open in their own tab (the RACM
  // spreadsheet editor, the risk detail page) build their URL from
  // window.location.origin, so a dev server that quietly hopped to 5174 when
  // 5173 was busy left every one of those links pointing at a dead port.
  // strictPort fails loudly instead — better than a tab that can't connect.
  server: { port: 5173, strictPort: true },
})
