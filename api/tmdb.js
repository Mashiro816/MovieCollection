// Vercel 会把 api/ 目录下的文件部署成服务端函数，这个文件对应的地址是 /api/tmdb。
// key 从 Vercel 项目的环境变量 TMDB_KEY 读取，只存在于服务端。
import { createTmdbHandler } from '../server/tmdb-proxy.js'

export default createTmdbHandler(() => process.env)
