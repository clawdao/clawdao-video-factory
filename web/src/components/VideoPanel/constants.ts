export const PIPELINE_STEPS = [
  { key: 'intent', label: 'URL/素材' },
  { key: 'asr', label: '语音识别' },
  { key: 'tts', label: '语音合成' },
  { key: 'videoGen', label: '视频生成' },
  { key: 'autoEdit', label: '自动剪辑' },
  { key: 'publish', label: '自动发布' },
]
export const PLATFORMS = [
  { id: 'douyin', name: '抖音' }, { id: 'kuaishou', name: '快手' },
  { id: 'xiaohongshu', name: '小红书' }, { id: 'bilibili', name: 'B站' },
  { id: 'shipinhao', name: '视频号' },
] as const
export type PlatformId = (typeof PLATFORMS)[number]['id']
