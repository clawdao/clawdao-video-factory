# clawdao-video-factory

> 媒体处理中间件 — 抖音解析 / yt-dlp 下载 / FFmpeg 转码 / HTTP 代理
>
> ⚠️ **开发测试中**（version `0.0.1`）— 接口与协议可能变动，暂不推荐生产使用。

`clawdao-video-factory` 是一个独立的媒体处理服务，同时实现 [ClawDao Project Protocol (CPP)](https://github.com/clawdao/clawdao)，可作为 ClawDao 主平台的挂载应用运行，也可独立部署。

## 功能

- **抖音视频解析**：从分享链接获取视频 / 音频下载地址
- **跨平台视频下载**：通过 yt-dlp 下载 YouTube、B 站等平台视频
- **FFmpeg 音视频处理**：格式转换、媒体元信息探查
- **HTTP 代理**：通过代理获取远程资源

## 架构

```
clawdao-video-factory/
├── src/         HTTP 服务端（Bun / Node，端口 18792）
├── web/         Web 前端（React + Antd + Vite，端口 5180）
├── clients/     客户端 SDK（Node / HTTP）
├── scripts/     多进程启动管理器
└── .clawdao/    CPP 协议声明（project.json）
```

前后端通过 HTTP API 通信，可独立部署。

## 快速开始

### 前置条件

- **Bun** ≥ 1.0（推荐）或 Node.js ≥ 18
- [FFmpeg](https://ffmpeg.org/) — 音视频处理
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) — 跨平台视频下载

### 安装

```bash
bun install                  # 服务端（零运行时依赖）
cd web && npm install && cd ..   # 前端依赖
```

### 运行

```bash
# 一键启动（后端 + 前端）
bun run dev

# 分别启动
bun run dev:backend      # 后端 :18792
cd web && npm run dev    # 前端 :5180
```

健康检查：

```bash
curl http://localhost:18792/api/health
```

### CLI

```bash
# 抖音视频解析
bun run src/index.ts douyin --shareUrl "https://v.douyin.com/xxx/"

# 视频下载
bun run src/index.ts download --url "https://youtube.com/watch?v=xxx"
```

## Web 前端

位于 `web/`，提供以下面板：

| 面板 | 说明 |
|---|---|
| TTS | 文本转语音 |
| AutoEdit | 素材拼接与自动剪辑 |
| TalkingHead | 照片驱动数字人 |
| ASR | 音视频转文字 |
| Asset Library | 素材管理 |
| Voice Library | 语音样本管理 |
| Task Center | 任务进度跟踪 |
| Publish Account | 多平台发布凭证 |

## HTTP API

### ClawDao Protocol

| 端点 | 方法 | 说明 |
|---|---|---|
| `/api/health` | GET | 健康检查 |
| `/api/v1/capabilities` | GET | manifest 中声明的 actions |
| `/api/v1/config` | GET / PUT | 读写 manifest 中声明的配置 |
| `/api/v1/tasks` | GET / POST | 任务查询 / 提交 |

### 功能端点

| 端点 | 方法 | 说明 |
|---|---|---|
| `/api/douyin/extract` | POST | 解析抖音分享链接 |
| `/api/douyin/audio` | POST | 提取视频音频 |
| `/api/yt-dlp/download` | POST | 下载视频 |
| `/api/ffmpeg/convert` | POST | 格式转换 |
| `/api/ffmpeg/probe` | POST | 探媒体信息 |
| `/api/proxy/fetch` | POST | HTTP 代理获取 |
| `/api/proxy/fetch-binary` | POST | 二进制代理获取 |

## 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `VF_PORT` | `18792` | HTTP 服务端口 |
| `FFMPEG_PATH` | 自动查找 | FFmpeg 可执行文件 |
| `YT_DLP_PATH` | 自动查找 | yt-dlp 可执行文件 |
| `CLAWDAO_DATA_DIR` | `./temp` | 临时文件目录 |

## 项目结构

```
src/
├── index.ts              # 入口
├── http-server.ts        # HTTP 服务器
├── douyin.ts             # 抖音功能
├── yt-dlp.ts             # 视频下载
├── ffmpeg.ts             # 音视频处理
├── proxy.ts              # 代理访问
├── task-store.ts         # Protocol 任务存储
└── types.ts              # 类型定义

web/src/
├── App.tsx
├── components/
│   ├── VideoPanel/       # 功能面板（TTS / ASR / AutoEdit / TalkingHead / ...）
│   └── common/           # 通用组件
├── api/client.ts
├── hooks/
└── store/

clients/
├── node-client.ts
└── http-client.ts
```

## 开发

```bash
bun test                  # 测试
bun run typecheck         # 类型检查
```

## License

MIT