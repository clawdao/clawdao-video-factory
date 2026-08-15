import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { existsSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'

// ══════════════════════════════════════════════════════════════
// 端口自动适配（PORT AUTO-ASSIGNMENT）
//   - 后端 API 端口：环境变量 VF_PORT > .clawdao/project.json ports.dev > 18792
//   - 前端端口：     环境变量 VF_WEB_PORT > .clawdao/project.json ports.web > 5180
// 每次 start-all.ts 启动都会把实际端口回写到 project.json，
// 因此这里读取 project.json 即可与后端保持同步。
// ══════════════════════════════════════════════════════════════

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function readManifest(): Record<string, any> {
  const manifestPath = path.resolve(__dirname, '../.clawdao/project.json')
  try {
    if (existsSync(manifestPath)) {
      return JSON.parse(readFileSync(manifestPath, 'utf-8'))
    }
  } catch { /* ignore */ }
  return {}
}

function resolveApiPort(): number {
  if (process.env.VF_PORT) return Number(process.env.VF_PORT) || 18792
  const manifest = readManifest()
  if (manifest?.ports?.dev) return Number(manifest.ports.dev)
  return 18792
}

function resolveWebPort(): number {
  if (process.env.VF_WEB_PORT) return Number(process.env.VF_WEB_PORT) || 5180
  const manifest = readManifest()
  if (manifest?.ports?.web) return Number(manifest.ports.web)
  return 5180
}

const apiPort = resolveApiPort()
const apiTarget = `http://127.0.0.1:${apiPort}`

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: resolveWebPort(),
    host: true,
    proxy: {
      '/api/douyin': { target: apiTarget, changeOrigin: true },
      '/api/proxy': { target: apiTarget, changeOrigin: true },
      '/api/ffmpeg': { target: apiTarget, changeOrigin: true },
      '/api/yt-dlp': { target: apiTarget, changeOrigin: true },
      '/api/health': { target: apiTarget, changeOrigin: true },
      // LongCat 数字人视频（v1.2）
      '/api/video': { target: apiTarget, changeOrigin: true },
      // 通用回退：其余 /api/* 一律代理到后端，避免新增端点漏配
      '/api': { target: apiTarget, changeOrigin: true },
    },
  },
})
