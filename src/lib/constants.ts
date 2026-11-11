import type { TierId, WatchContext } from './types'

export const TIERS: { id: TierId; name: string; color: string }[] = [
  { id: 'S', name: '噩梦级', color: '#ff4057' },
  { id: 'A', name: '毛骨悚然', color: '#ff8a3d' },
  { id: 'B', name: '有点东西', color: '#e6d5a0' },
  { id: 'C', name: '不痛不痒', color: '#8791a0' },
  { id: 'D', name: '笑场了', color: '#7c9a5e' },
]

export const tierOf = (id: TierId | null) => TIERS.find((t) => t.id === id) ?? null
export const tierRank = (id: TierId | null) => (id ? TIERS.findIndex((t) => t.id === id) : TIERS.length)

export const HORROR_GENRE_ID = 27

/** TMDB 关键词（英文小写）到中文子类型标签的对照。想加新的子类型，在这里加一行 */
export const KEYWORD_TO_TAG: Record<string, string> = {
  slasher: '砍杀',
  'found footage': '伪纪录片',
  mockumentary: '伪纪录片',
  zombie: '丧尸',
  vampire: '吸血鬼',
  werewolf: '狼人',
  ghost: '鬼魂',
  'haunted house': '鬼屋',
  haunting: '鬼屋',
  possession: '附身',
  'demonic possession': '附身',
  exorcism: '驱魔',
  demon: '恶魔',
  'serial killer': '连环杀手',
  cannibal: '食人',
  cannibalism: '食人',
  gore: '血浆',
  splatter: '血浆',
  'body horror': '身体恐怖',
  'folk horror': '民俗恐怖',
  supernatural: '超自然',
  'supernatural horror': '超自然',
  monster: '怪物',
  creature: '怪物',
  alien: '外星',
  'psychological horror': '心理恐怖',
  'psychological thriller': '心理恐怖',
  'home invasion': '入室',
  witch: '女巫',
  witchcraft: '女巫',
  cult: '邪教',
  curse: '诅咒',
  anthology: '多段式',
  'survival horror': '生存',
  torture: '虐杀',
  clown: '小丑',
  doll: '玩偶',
  'killer doll': '玩偶',
  'cosmic horror': '克苏鲁',
  lovecraftian: '克苏鲁',
  giallo: '铅黄',
  'horror comedy': '恐怖喜剧',
  'religious horror': '宗教恐怖',
  'j-horror': '日式恐怖',
}

export const ALL_TAGS = [...new Set(Object.values(KEYWORD_TO_TAG))]

export const CONTEXT_OPTIONS: {
  [K in keyof WatchContext]: { value: NonNullable<WatchContext[K]>; label: string }[]
} = {
  company: [
    { value: 'solo', label: '一个人' },
    { value: 'friends', label: '和朋友' },
  ],
  time: [
    { value: 'night', label: '深夜' },
    { value: 'day', label: '白天' },
  ],
  place: [
    { value: 'cinema', label: '影院' },
    { value: 'home', label: '在家' },
  ],
}

export const today = () => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
