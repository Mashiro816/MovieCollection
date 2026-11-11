/**
 * TMDB 转发：浏览器请求 /api/tmdb，由服务端带上 key 去访问 TMDB，key 不进入浏览器。
 *
 * 这个文件被两个地方使用：
 *   - api/tmdb.js       线上（Vercel 的服务端函数）
 *   - vite.config.ts    本地开发和预览（npm run dev / npm run preview）
 */

// 只转发应用用得到的三类接口和几个参数，避免被别人当成通用的 TMDB 代理
const ALLOWED_PATHS = [/^\/search\/movie$/, /^\/movie\/\d+$/, /^\/collection\/\d+$/]
const ALLOWED_PARAMS = ['query', 'language', 'include_adult', 'append_to_response', 'page']

const json = (status, body, cache = 'no-store') => ({ status, body: JSON.stringify(body), cache })

/**
 * @param {URLSearchParams} params 浏览器发来的查询参数，其中 path 是 TMDB 的接口路径
 * @param {Record<string, string | undefined>} env 环境变量
 */
export async function tmdbProxy(params, env) {
  // 兼容旧的变量名 VITE_TMDB_KEY；前端代码已不再引用它，所以不会被打包进浏览器
  const key = (env.TMDB_KEY || env.VITE_TMDB_KEY || '').trim()
  if (!key) return json(500, { error: 'missing_key' })

  const path = params.get('path') || ''
  if (!ALLOWED_PATHS.some((re) => re.test(path))) return json(400, { error: 'bad_path' })

  const base = env.TMDB_API_BASE || 'https://api.themoviedb.org/3'
  const url = new URL(base + path)
  for (const name of ALLOWED_PARAMS) {
    const value = params.get(name)
    if (value != null) url.searchParams.set(name, value)
  }
  // v4 的 Read Access Token 是 JWT（eyJ 开头），放在请求头；v3 的 key 放在查询参数
  const isToken = key.startsWith('eyJ')
  if (!isToken) url.searchParams.set('api_key', key)

  let upstream
  try {
    upstream = await fetch(url, isToken ? { headers: { Authorization: `Bearer ${key}` } } : undefined)
  } catch {
    return json(502, { error: 'upstream_unreachable' })
  }
  if (upstream.status === 401) return json(401, { error: 'invalid_key' })
  if (!upstream.ok) return json(upstream.status, { error: 'upstream_error' })

  // 电影信息很少变化，让 Vercel 的 CDN 缓存：搜索 1 小时，详情和系列 1 天
  const maxAge = path === '/search/movie' ? 3600 : 86400
  return {
    status: 200,
    body: await upstream.text(),
    cache: `public, s-maxage=${maxAge}, stale-while-revalidate=604800`,
  }
}

/** 包装成 Node 的请求处理函数（Vercel 和 Vite 的开发服务器都认这种形式） */
export function createTmdbHandler(getEnv) {
  return async function handler(req, res) {
    const { searchParams } = new URL(req.url || '', 'http://localhost')
    const result =
      req.method === 'GET' ? await tmdbProxy(searchParams, getEnv()) : json(405, { error: 'method_not_allowed' })
    res.statusCode = result.status
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', result.cache)
    res.end(result.body)
  }
}
