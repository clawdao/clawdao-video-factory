# clawdao-video-factory

口播短视频制作工厂 — 媒体处理中间件。

## 安装

```bash
bun add @clawdao/video-factory
```

或者直接克隆运行：

```bash
git clone https://github.com/clawdao/video-factory.git
cd video-factory
bun run src/index.ts --port 18792
```

## 使用

### 1. HTTP Server 模式

```bash
bun run src/index.ts --port 18792
```

端点：

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/douyin/extract` | POST | 抖音分享短链 → 真实 mp4 URL |
| `/api/douyin/audio` | POST | 真实 mp4 → 16k mono WAV |
| `/api/yt-dlp/download` | POST | yt-dlp 视频下载 |
| `/api/proxy/fetch` | POST | 通用 HTTP 代理 (文本) |
| `/api/proxy/fetch-binary` | POST | 通用 HTTP 代理 (二进制) |
| `/api/ffmpeg/convert` | POST | FFmpeg 转码 |
| `/api/ffmpeg/probe` | POST | FFmpeg 探针 |
| `/api/health` | GET | 健康检查 |

### 2. CLI 模式

```bash
bun run src/index.ts douyin/extract --shareUrl="..."
bun run src/index.ts yt-dlp/download --url="..."
bun run src/index.ts ffmpeg/convert -i input.mp4 -o output.mp4
```

### 3. Node 库嵌入

```typescript
import { createFactory } from '@clawdao/video-factory';

const vf = createFactory({ ffmpegPath: '/opt/homebrew/bin/ffmpeg' });
const info = await vf.douyinExtract('https://v.douyin.com/xxxxx/');
const { wav } = await vf.douyinAudio(info.videoUrl, 60);
```

## 兼容旧路径

旧版 clawdao toolbox sidecar 使用 `/api/toolbox/*` 路径。
本服务自动将  `/api/toolbox/*` 转发到标准 `/api/*` 端点。
