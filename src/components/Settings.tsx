import { Download, RefreshCw, Upload } from 'lucide-react'
import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useEntries, useLog } from '../lib/store'
import { cloudEnabled, signIn, signOut, signUp, syncAll, useSync } from '../lib/sync'
import { hasEnvKey, searchMovies } from '../lib/tmdb'
import type { Entry } from '../lib/types'
import { PageTitle } from './ui'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line py-7">
      <h2 className="mb-4 font-serif text-xl font-bold">{title}</h2>
      <div className="max-w-xl">{children}</div>
    </section>
  )
}

function TmdbKey() {
  const { tmdbKey, setTmdbKey } = useLog()
  const [draft, setDraft] = useState(tmdbKey)
  const [msg, setMsg] = useState('')

  if (hasEnvKey) return <p className="text-sm text-ash">TMDB key 已在部署配置里设置，这里不用填。</p>

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setTmdbKey(draft.trim())
    if (!draft.trim()) return setMsg('已清除')
    setMsg('正在验证')
    try {
      await searchMovies('The Shining')
      setMsg('已保存，key 可用')
    } catch (err) {
      setMsg(err instanceof Error ? err.message : '验证失败')
    }
  }

  return (
    <form onSubmit={save}>
      <p className="mb-4 text-sm text-ash">
        电影的海报和简介来自 TMDB。在{' '}
        <a className="text-bone underline" href="https://www.themoviedb.org/settings/api" target="_blank" rel="noreferrer">
          themoviedb.org 的 API 设置页
        </a>{' '}
        免费申请一个 key 后填在这里。key 只保存在这台设备的浏览器里。
      </p>
      <label className="label" htmlFor="tmdb-key">
        API Key 或 Read Access Token
      </label>
      <div className="flex gap-2">
        <input
          id="tmdb-key"
          className="field num"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <button className="btn btn-primary shrink-0">保存</button>
      </div>
      {msg && <p className="mt-2 text-[13px] text-ash">{msg}</p>}
    </form>
  )
}

function Cloud() {
  const { session, status, error, lastSyncedAt } = useSync()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  if (!cloudEnabled) {
    return (
      <p className="text-sm text-ash">
        还没有配置云同步，记录只保存在这台设备的浏览器里。配置方法见项目 README 的"云同步"一节：填好 Supabase
        的地址和 key 后重新部署，这里会出现登录入口。
      </p>
    )
  }

  if (session) {
    return (
      <div>
        <p className="text-sm">
          已登录 <span className="num text-ash">{session.user.email}</span>
        </p>
        <p className={`mt-1 text-[13px] ${status === 'error' ? 'text-flare' : 'text-ash'}`}>
          {status === 'syncing' && '同步中'}
          {status === 'error' && `同步失败：${error}`}
          {status === 'ok' && lastSyncedAt && `上次同步 ${new Date(lastSyncedAt).toLocaleString('zh-CN')}`}
        </p>
        <div className="mt-4 flex gap-2">
          <button className="btn" onClick={() => void syncAll()} disabled={status === 'syncing'}>
            <RefreshCw size={15} />
            立即同步
          </button>
          <button className="btn btn-quiet" onClick={() => void signOut()}>
            退出登录
          </button>
        </div>
      </div>
    )
  }

  const run = async (fn: typeof signIn) => {
    setBusy(true)
    setMsg(await fn(email.trim(), password))
    setBusy(false)
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void run(signIn)
      }}
    >
      <p className="mb-4 text-sm text-ash">登录后，手机和电脑上的片单会自动保持一致。</p>
      <label className="label" htmlFor="email">
        邮箱
      </label>
      <input id="email" type="email" required className="field mb-3" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      <label className="label" htmlFor="password">
        密码（至少 6 位）
      </label>
      <input
        id="password"
        type="password"
        required
        minLength={6}
        className="field"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
      />
      <div className="mt-4 flex gap-2">
        <button className="btn btn-primary" disabled={busy}>
          登录
        </button>
        <button type="button" className="btn" disabled={busy || !email || password.length < 6} onClick={() => void run(signUp)}>
          注册新账号
        </button>
      </div>
      {msg && <p className="mt-3 text-[13px] text-ash">{msg}</p>}
    </form>
  )
}

function Backup() {
  const entries = useEntries()
  const merge = useLog((s) => s.merge)
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')

  const exportJson = () => {
    const blob = new Blob(
      [JSON.stringify({ app: 'midnight-log', version: 1, exportedAt: new Date().toISOString(), entries }, null, 2)],
      { type: 'application/json' },
    )
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `午夜片单-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const importJson = async (file: File) => {
    try {
      const data = JSON.parse(await file.text())
      const list: unknown = Array.isArray(data) ? data : data?.entries
      if (!Array.isArray(list)) throw new Error()
      const valid = list.filter(
        (e): e is Entry => typeof e?.id === 'number' && typeof e?.title === 'string' && typeof e?.updatedAt === 'string',
      )
      merge(valid)
      setMsg(`已导入 ${valid.length} 条。同一部电影保留较新的一份记录`)
      void syncAll()
    } catch {
      setMsg('这个文件不是午夜片单导出的备份')
    }
  }

  return (
    <div>
      <p className="mb-4 text-sm text-ash">
        导出一个包含全部 {entries.length} 条记录的 JSON 文件。导入时会和现有记录合并，不会清空。
      </p>
      <div className="flex gap-2">
        <button className="btn" onClick={exportJson}>
          <Download size={15} />
          导出备份
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          <Upload size={15} />
          导入备份
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void importJson(f)
            e.target.value = ''
          }}
        />
      </div>
      {msg && <p className="mt-3 text-[13px] text-ash">{msg}</p>}
    </div>
  )
}

export function Settings() {
  return (
    <div>
      <PageTitle>设置</PageTitle>
      <Section title="电影数据">
        <TmdbKey />
      </Section>
      <Section title="云同步">
        <Cloud />
      </Section>
      <Section title="备份">
        <Backup />
      </Section>
      <Section title="关于">
        <p className="text-[13px] leading-relaxed text-ash">
          本应用使用 TMDB API 提供的电影数据和图片，但未获得 TMDB 的认可或认证。
          <br />
          This product uses the TMDB API but is not endorsed or certified by TMDB.
        </p>
      </Section>
    </div>
  )
}
