import { useState } from 'react'
import { getTenantCode, useAuth } from '../store/auth'
import { ApiError } from '../api/client'

function BrandMark() {
  return (
    <span className="login-brand-mark" aria-hidden="true">
      <svg viewBox="0 0 28 28" fill="none">
        <path d="M14 3.5 24 9v10l-10 5.5L4 19V9l10-5.5Z" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="14" cy="14" r="3" fill="currentColor" />
        <path d="M14 5v6m8.5-1.2-5.2 3M22.5 19l-5.2-3M14 23v-6m-8.5 2 5.2-3m-5.2-7 5.2 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    </span>
  )
}

function KnowledgeGraphic() {
  const nodes = [
    [38, 58], [38, 122], [38, 186], [116, 30], [116, 94], [116, 158], [116, 222],
    [194, 58], [194, 122], [194, 186], [270, 94], [270, 158],
  ]
  const edges = [[0,3],[0,4],[1,3],[1,4],[1,5],[2,5],[2,6],[3,7],[3,8],[4,7],[4,8],[4,9],[5,8],[5,9],[6,8],[6,9],[7,10],[7,11],[8,10],[8,11],[9,11]]
  return (
    <svg className="login-graph" viewBox="0 0 308 252" fill="none" aria-hidden="true">
      <defs>
        <radialGradient id="loginNodeGlow"><stop stopColor="#77ffe9" /><stop offset="1" stopColor="#00d6ba" stopOpacity=".2" /></radialGradient>
      </defs>
      {edges.map(([a, b], i) => <line key={i} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]} stroke="#5cf4dc" strokeOpacity=".2" />)}
      {nodes.map(([cx, cy], i) => <g key={i}><circle cx={cx} cy={cy} r="10" fill="#0d1d29" stroke="#47e9d0" strokeOpacity=".32" /><circle cx={cx} cy={cy} r="3.2" fill="url(#loginNodeGlow)" /></g>)}
      <rect x="95" y="83" width="42" height="22" rx="5" fill="#102b32" stroke="#47e9d0" strokeOpacity=".5" />
      <text x="116" y="97" textAnchor="middle" fill="#8bffeb" fontSize="7" fontFamily="monospace">INDEX</text>
      <rect x="173" y="111" width="42" height="22" rx="5" fill="#102b32" stroke="#47e9d0" strokeOpacity=".5" />
      <text x="194" y="125" textAnchor="middle" fill="#8bffeb" fontSize="7" fontFamily="monospace">RETRIEVE</text>
    </svg>
  )
}

export default function Login() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [tenantCode, setTenantCode] = useState(getTenantCode)
  const [tenantName, setTenantName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'login') await login(tenantCode, username, password)
      else await register(tenantName, tenantCode, username, password)
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof TypeError
            ? '无法连接服务器，请检查后端是否启动'
            : '操作失败，请稍后重试',
      )
    } finally {
      setBusy(false)
    }
  }

  function switchMode(next: 'login' | 'register') {
    setMode(next)
    setError('')
  }

  return (
    <main className="login-page">
      <div className="login-frame">
        <section className="login-story" aria-label="产品介绍">
          <a className="login-brand" href="#/login" aria-label="个人知识库首页">
            <BrandMark />
            <span>知微<span className="login-brand-light">·知识库</span></span>
          </a>

          <div className="login-story-copy">
            <div className="login-eyebrow"><span /> PRIVATE KNOWLEDGE WORKSPACE</div>
            <h1>让每一份知识，<br /><span>都能被准确找到。</span></h1>
            <p>汇集团队文档，构建专属知识空间。每个答案都有来源，每次检索都更进一步。</p>
          </div>

          <div className="login-visual">
            <div className="login-orbit login-orbit-one" />
            <div className="login-orbit login-orbit-two" />
            <KnowledgeGraphic />
            <div className="login-visual-caption"><span className="login-live-dot" /> KNOWLEDGE GRAPH <span className="login-caption-line" /> RAG ENGINE</div>
          </div>

          <div className="login-story-footer">
            <span>语义检索</span><i /> <span>私有知识库</span><i /> <span>答案可溯源</span>
            <span className="login-version">WORKSPACE · 01</span>
          </div>
        </section>

        <section className="login-form-side">
          <div className="login-form-top"><span>安全访问</span><span className="login-lock"><svg viewBox="0 0 16 16" fill="none"><rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" /></svg> SECURE</span></div>

          <div className="login-form-content">
            <div className="login-mobile-brand"><BrandMark /><span>知微·知识库</span></div>
            <div className="login-heading-kicker">WELCOME BACK</div>
            <h2>{mode === 'login' ? '欢迎回来' : '创建你的账号'}</h2>
            <p className="login-form-subtitle">{mode === 'login' ? '登录以继续访问你的知识空间。' : '建立账号，开始整理和探索团队知识。'}</p>

            <div className="login-mode-tabs" role="tablist" aria-label="账户操作">
              <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>登录</button>
              <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')}>注册</button>
            </div>

            <form className="login-form" onSubmit={submit}>
              {mode === 'register' && <>
                <label htmlFor="tenant-name">企业名称</label>
                <div className="login-input-wrap"><input id="tenant-name" value={tenantName} onChange={(e) => setTenantName(e.target.value)} placeholder="例如：知微科技" maxLength={128} /></div>
              </>}
              <label htmlFor="tenant-code">企业代码 <span className="login-field-hint">登录时使用</span></label>
              <div className="login-input-wrap"><input id="tenant-code" value={tenantCode} onChange={(e) => setTenantCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="例如：zhiwei-tech" autoComplete="organization" maxLength={64} /></div>

              <label htmlFor="login-username">用户名 {mode === 'register' && <span className="login-field-hint">3–32 个字符</span>}</label>
              <div className="login-input-wrap"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="6.5" r="3" stroke="currentColor" strokeWidth="1.4" /><path d="M4 16c.5-2.5 2.5-4 6-4s5.5 1.5 6 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg><input id="login-username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="输入用户名" autoComplete="username" autoFocus maxLength={mode === 'register' ? 32 : undefined} /></div>

              <div className="login-password-label"><label htmlFor="login-password">密码</label>{mode === 'register' && <span>至少 8 位</span>}</div>
              <div className="login-input-wrap"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="4" y="8" width="12" height="9" rx="2" stroke="currentColor" strokeWidth="1.4" /><path d="M6.5 8V5.5a3.5 3.5 0 0 1 7 0V8" stroke="currentColor" strokeWidth="1.4" /></svg><input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="输入密码" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'register' ? 8 : undefined} /></div>

              {error && <div className="login-error" role="alert"><span>!</span>{error}</div>}
              <button className="login-submit" disabled={busy || !tenantCode || !username || !password || (mode === 'register' && !tenantName.trim())}>
                {busy ? <><span className="login-spinner" />请稍候…</> : <>{mode === 'login' ? '进入知识空间' : '创建账号'}<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10h11m-4-4 4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg></>}
              </button>
            </form>

            <div className="login-helper">{mode === 'login' ? <>还没有账号？ <button type="button" onClick={() => switchMode('register')}>创建账号 <span>→</span></button></> : <>已有账号？ <button type="button" onClick={() => switchMode('login')}>返回登录 <span>→</span></button></>}</div>
            {mode === 'register' && <div className="login-admin-note"><span>✳</span> 首个注册账号将自动成为管理员</div>}
          </div>

          <div className="login-form-footer"><span>© 2026 知微知识库</span><span>你的知识，安心存放</span></div>
        </section>
      </div>
    </main>
  )
}
