import { useEffect, useRef, useState } from 'react'
import { getTenantCode, useAuth } from '../store/auth'
import { api, ApiError } from '../api/client'

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

type CompanionMood = 'neutral' | 'curious' | 'username' | 'covering' | 'peeking' | 'rejected'

function LoginPeople({ mood, isUsernamePeekReturning }: { mood: CompanionMood; isUsernamePeekReturning: boolean }) {
  const stageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const panel = stageRef.current?.closest('.login-frame') as HTMLElement
    if (!panel) return

    function followPointer(event: Event) {
      const pointerEvent = event as PointerEvent
      const stage = stageRef.current
      if (pointerEvent.pointerType === 'touch' || !stage) return
      const bounds = panel.getBoundingClientRect()
      const x = Math.max(-0.5, Math.min(0.5, (pointerEvent.clientX - bounds.left) / bounds.width - 0.5))
      const y = Math.max(-0.5, Math.min(0.5, (pointerEvent.clientY - bounds.top) / bounds.height - 0.5))
      stage.style.setProperty('--look-x', `${(x * 7).toFixed(1)}px`)
      stage.style.setProperty('--look-y', `${(y * 6).toFixed(1)}px`)
      stage.style.setProperty('--socket-x', `${(x * 1.6).toFixed(1)}px`)
      stage.style.setProperty('--socket-y', `${(y * 1.2).toFixed(1)}px`)
      stage.style.setProperty('--body-skew', `${(-x * 12).toFixed(1)}deg`)
      const stageBounds = stage.getBoundingClientRect()
      stage.classList.toggle(
        'is-engaged',
        pointerEvent.clientX >= stageBounds.left && pointerEvent.clientX <= stageBounds.right &&
        pointerEvent.clientY >= stageBounds.top && pointerEvent.clientY <= stageBounds.bottom,
      )
    }

    function resetGaze() {
      stageRef.current?.style.setProperty('--look-x', '0px')
      stageRef.current?.style.setProperty('--look-y', '0px')
      stageRef.current?.style.setProperty('--socket-x', '0px')
      stageRef.current?.style.setProperty('--socket-y', '0px')
      stageRef.current?.style.setProperty('--body-skew', '0deg')
      stageRef.current?.classList.remove('is-engaged')
    }

    window.addEventListener('pointermove', followPointer, { passive: true })
    window.addEventListener('pointerleave', resetGaze)
    return () => {
      window.removeEventListener('pointermove', followPointer)
      window.removeEventListener('pointerleave', resetGaze)
    }
  }, [])

  return (
    <div ref={stageRef} className={`login-people-stage is-${mood}${isUsernamePeekReturning ? ' is-username-returning' : ''}`} aria-hidden="true">
      <svg className="login-people" viewBox="0 0 420 340" fill="none">
        <g transform="matrix(.92 0 0 1.15 7.6 13)">
        <g className="login-person login-person-violet">
          <g className="login-person-follow">
          <path className="login-person-arm login-person-arm-left" d="M108 166 91 148" stroke="#9C82FF" strokeWidth="9" />
          <path className="login-person-arm login-person-arm-right" d="M204 166 221 148" stroke="#9C82FF" strokeWidth="9" />
          <path d="M105 278V44a10 10 0 0 1 10-10h82a10 10 0 0 1 10 10v234h-102Z" fill="#7042F5" />
          <g className="login-person-eye-socket"><circle className="login-person-eye" cx="140" cy="91" r="6.7" fill="white" /><circle className="login-person-pupil" cx="140" cy="91" r="2.3" fill="#22242B" /></g>
          <g className="login-person-eye-socket"><circle className="login-person-eye" cx="174" cy="91" r="6.7" fill="white" /><circle className="login-person-pupil" cx="174" cy="91" r="2.3" fill="#22242B" /></g>
          <g className="login-person-dizzy-eye login-person-dizzy-eye-left"><path d="M140 91C143 89 145 92 143 94C141 96 137 94 138 91C139 87 145 86 148 90C151 95 148 100 144 101" stroke="#F5F1FF" /></g>
          <g className="login-person-dizzy-eye login-person-dizzy-eye-right"><path d="M174 91C177 89 179 92 177 94C175 96 171 94 172 91C173 87 179 86 182 90C185 95 182 100 178 101" stroke="#F5F1FF" /></g>
          <ellipse className="login-person-dizzy-mouth" cx="157" cy="115" rx="3.2" ry="4.2" fill="#30205F" />
          <rect className="login-person-closed-eye" x="133" y="89.2" width="14" height="3.6" rx="1.8" fill="#35216F" />
          <rect className="login-person-closed-eye" x="167" y="90.2" width="14" height="3.6" rx="1.8" fill="#35216F" />
          <path className="login-person-smile" d="M148 110q9 8 18 0" />
          <path className="login-person-frown" d="M148 116q9 -8 18 0" />
          <circle className="login-person-cheek" cx="126" cy="111" r="5" fill="#FF7892" /><circle className="login-person-cheek" cx="188" cy="111" r="5" fill="#FF7892" />
          </g>
        </g>
        <g className="login-person login-person-charcoal">
          <g className="login-person-follow">
          <path className="login-person-arm login-person-arm-left" d="M208 194 192 177" stroke="#515258" strokeWidth="8" />
          <path className="login-person-arm login-person-arm-right" d="M285 194 301 177" stroke="#515258" strokeWidth="8" />
          <path d="M205 278V99a9 9 0 0 1 9-9h65a9 9 0 0 1 9 9v179h-83Z" fill="#28292D" />
          <g className="login-person-eye-socket"><circle className="login-person-eye" cx="230" cy="142" r="6.2" fill="white" /><circle className="login-person-pupil" cx="230" cy="142" r="2.1" fill="#22242B" /></g>
          <g className="login-person-eye-socket"><circle className="login-person-eye" cx="256" cy="142" r="6.2" fill="white" /><circle className="login-person-pupil" cx="256" cy="142" r="2.1" fill="#22242B" /></g>
          <g className="login-person-dizzy-eye login-person-dizzy-eye-left"><path d="M230 142C233 140 235 143 233 145C231 147 227 145 228 142C229 138 235 137 238 141C241 146 238 151 234 152" stroke="#F1F3F2" /></g>
          <g className="login-person-dizzy-eye login-person-dizzy-eye-right"><path d="M256 142C259 140 261 143 259 145C257 147 253 145 254 142C255 138 261 137 264 141C267 146 264 151 260 152" stroke="#F1F3F2" /></g>
          <ellipse className="login-person-dizzy-mouth" cx="246" cy="165" rx="2.7" ry="3.8" fill="#F1F3F2" />
          <rect className="login-person-closed-eye" x="224" y="140.2" width="12" height="3.6" rx="1.8" fill="#C5C8CA" />
          <rect className="login-person-closed-eye" x="250" y="141.2" width="12" height="3.6" rx="1.8" fill="#C5C8CA" />
          <path className="login-person-smile" d="M236 160q7 6 14 0" />
          <path className="login-person-frown" d="M236 166q7 -6 14 0" />
          <circle className="login-person-cheek" cx="218" cy="161" r="4.5" fill="#FF7892" /><circle className="login-person-cheek" cx="268" cy="161" r="4.5" fill="#FF7892" />
          </g>
        </g>
        <g className="login-person login-person-yellow">
          <g className="login-person-follow">
          <path className="login-person-arm login-person-arm-left" d="M285 246 269 229" stroke="#D7C239" strokeWidth="10" />
          <path className="login-person-arm login-person-arm-right" d="M385 246 401 229" stroke="#D7C239" strokeWidth="10" />
          <path d="M278 278V196a57 57 0 0 1 114 0v82H278Z" fill="#F1D94F" />
          <g className="login-person-eye-socket"><circle className="login-person-eye" cx="316" cy="188" r="5.7" fill="#28292D" /><circle className="login-person-pupil" cx="316" cy="188" r="1.6" fill="#fff" /></g>
          <g className="login-person-eye-socket"><circle className="login-person-eye" cx="352" cy="188" r="5.7" fill="#28292D" /><circle className="login-person-pupil" cx="352" cy="188" r="1.6" fill="#fff" /></g>
          <g className="login-person-dizzy-eye login-person-dizzy-eye-left"><path d="M316 188C319 186 321 189 319 191C317 193 313 191 314 188C315 184 321 183 324 187C327 192 324 197 320 198" stroke="#28292D" /></g>
          <g className="login-person-dizzy-eye login-person-dizzy-eye-right"><path d="M352 188C355 186 357 189 355 191C353 193 349 191 350 188C351 184 357 183 360 187C363 192 360 197 356 198" stroke="#28292D" /></g>
          <ellipse className="login-person-dizzy-mouth" cx="334" cy="220" rx="2.5" ry="3.4" fill="#28292D" />
          <rect className="login-person-closed-eye" x="310" y="186.2" width="12" height="3.6" rx="1.8" fill="#28292D" />
          <rect className="login-person-closed-eye" x="346" y="187.2" width="12" height="3.6" rx="1.8" fill="#28292D" />
          <path className="login-person-frown" d="M326 224q8 -6 16 0" />
          <circle className="login-person-cheek" cx="300" cy="204" r="4.5" fill="#FF7892" /><circle className="login-person-cheek" cx="368" cy="204" r="4.5" fill="#FF7892" />
          <path d="M307 220h54" stroke="#28292D" strokeWidth="3.5" strokeLinecap="round" />
          </g>
        </g>
        <g className="login-person login-person-coral">
          <g className="login-person-follow">
          <path className="login-person-arm login-person-arm-left" d="M55 256 38 239" stroke="#F18058" strokeWidth="11" />
          <path className="login-person-arm login-person-arm-right" d="M191 256 208 239" stroke="#F18058" strokeWidth="11" />
          <path d="M48 278v-43a75 75 0 0 1 150 0v43H48Z" fill="#FF9B70" />
          <g className="login-person-eye-socket"><circle className="login-person-eye" cx="104" cy="228" r="5.7" fill="#28292D" /><circle className="login-person-pupil" cx="104" cy="228" r="1.6" fill="#fff" /></g>
          <g className="login-person-eye-socket"><circle className="login-person-eye" cx="140" cy="228" r="5.7" fill="#28292D" /><circle className="login-person-pupil" cx="140" cy="228" r="1.6" fill="#fff" /></g>
          <g className="login-person-dizzy-eye login-person-dizzy-eye-left"><path d="M104 228C107 226 109 229 107 231C105 233 101 231 102 228C103 224 109 223 112 227C115 232 112 237 108 238" stroke="#28292D" /></g>
          <g className="login-person-dizzy-eye login-person-dizzy-eye-right"><path d="M140 228C143 226 145 229 143 231C141 233 137 231 138 228C139 224 145 223 148 227C151 232 148 237 144 238" stroke="#28292D" /></g>
          <ellipse className="login-person-dizzy-mouth" cx="122" cy="253" rx="2.5" ry="3.4" fill="#28292D" />
          <rect className="login-person-closed-eye" x="98" y="226.2" width="12" height="3.6" rx="1.8" fill="#28292D" />
          <rect className="login-person-closed-eye" x="134" y="227.2" width="12" height="3.6" rx="1.8" fill="#28292D" />
          <path className="login-person-smile" d="M114 249q8 6 16 0" />
          <path className="login-person-frown" d="M114 255q8 -6 16 0" />
          <circle className="login-person-cheek" cx="87" cy="246" r="4.5" fill="#FF7892" /><circle className="login-person-cheek" cx="157" cy="246" r="4.5" fill="#FF7892" />
          </g>
        </g>
        </g>
      </svg>
    </div>
  )
}

export default function Login() {
  const { login, register, guestLogin } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [tenantCode, setTenantCode] = useState(getTenantCode)
  const [tenantName, setTenantName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [guestEnabled, setGuestEnabled] = useState(false)
  const [focusedField, setFocusedField] = useState<'tenant' | 'username' | 'password' | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [loginRejected, setLoginRejected] = useState(false)
  const [isUsernamePeekReturning, setIsUsernamePeekReturning] = useState(false)
  const usernamePeekReturnTimer = useRef<number | null>(null)

  const companionMood: CompanionMood = loginRejected
    ? 'rejected'
    : focusedField === 'password'
    ? (showPassword ? 'peeking' : 'covering')
    : focusedField === 'username'
      ? 'username'
    : focusedField
      ? 'curious'
      : 'neutral'

  function focusUsername() {
    if (usernamePeekReturnTimer.current !== null) {
      window.clearTimeout(usernamePeekReturnTimer.current)
      usernamePeekReturnTimer.current = null
    }
    setIsUsernamePeekReturning(false)
    setFocusedField('username')
  }

  function blurUsername() {
    setFocusedField(null)
    setIsUsernamePeekReturning(true)
    if (usernamePeekReturnTimer.current !== null) window.clearTimeout(usernamePeekReturnTimer.current)
    usernamePeekReturnTimer.current = window.setTimeout(() => {
      setIsUsernamePeekReturning(false)
      usernamePeekReturnTimer.current = null
    }, 1080)
  }

  useEffect(() => {
    let active = true
    api.get<{ enabled: boolean }>('/api/auth/guest/status')
      .then(result => { if (active) setGuestEnabled(result.enabled) })
      .catch(() => { if (active) setGuestEnabled(false) })
    return () => { active = false }
  }, [])

  useEffect(() => () => {
    if (usernamePeekReturnTimer.current !== null) window.clearTimeout(usernamePeekReturnTimer.current)
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoginRejected(false)
    setBusy(true)
    try {
      if (mode === 'login') await login(tenantCode, username, password)
      else await register(tenantName, tenantCode, username, password)
    } catch (err) {
      if (mode === 'login' && err instanceof ApiError && err.status === 401) {
        setLoginRejected(true)
        window.setTimeout(() => setLoginRejected(false), 1700)
      }
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

  async function enterAsGuest() {
    setError('')
    setBusy(true)
    try {
      await guestLogin()
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof TypeError
            ? '无法连接服务器，请检查后端是否启动'
            : '游客登录失败，请稍后重试',
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
          <a className="login-brand" href="#/login" aria-label="知微知识库首页">
            <BrandMark />
            <span>知微<span className="login-brand-light">·知识库</span></span>
          </a>

          <div className="login-story-copy">
            <h1>个人与团队知识，<br /><span>都能被快速检索。</span></h1>
            <div className="story-description">
              <p className="story-lead">
                个人知识，<span className="text-highlight">快速检索</span>；
                团队资料，<span className="text-highlight">随时共享</span>。
              </p>
            </div>
          </div>

          <div className="login-visual">
            <LoginPeople mood={companionMood} isUsernamePeekReturning={isUsernamePeekReturning} />
            <span className="login-people-caption">把知识，变成随时可用的答案</span>
          </div>

          <div className="login-story-footer">
            <div className="login-feature-list">
              <div className="login-feature">
                <span className="login-feature-icon">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                    <path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z" stroke="currentColor" strokeWidth="1.3" />
                  </svg>
                </span>
                <span>AI 智能问答</span>
              </div>

              <i className="login-feature-divider" />

              <div className="login-feature">
                <span className="login-feature-icon">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M6 3.5h8l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                    <path d="M14 3.5v5h4M8 14l2.5 2.5L16 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span>原文可追溯</span>
              </div>

              <i className="login-feature-divider" />

              <div className="login-feature">
                <span className="login-feature-icon">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.5" />
                    <path d="m15.5 15.5 5 5M7.5 10.5h6M10.5 7.5v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </span>
                <span>语义精准检索</span>
              </div>

              <i className="login-feature-divider" />

              <div className="login-feature">
                <span className="login-feature-icon">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M3.5 19v-1.5A4.5 4.5 0 0 1 8 13h2a4.5 4.5 0 0 1 4.5 4.5V19h-11Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                    <path d="M16 5.5a3 3 0 0 1 0 5.8M17 13.5a4.5 4.5 0 0 1 3.5 4.4V19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </span>
                <span>团队知识共享</span>
              </div>
            </div>
          </div>
        </section>

        <section className="login-form-side">
          <div className="login-form-content">
            <div className="login-mobile-brand"><BrandMark /><span>知微·知识库</span></div>
            <div className="login-mobile-people"><LoginPeople mood={companionMood} isUsernamePeekReturning={isUsernamePeekReturning} /></div>
            <div className="login-heading-kicker">WELCOME BACK</div>
            <h2>{mode === 'login' ? '欢迎回来' : '创建你的账号'}</h2>
            <p className="login-form-subtitle">{mode === 'login' ? '登录以继续访问你的知识空间。' : '创建个人或团队空间，开始整理资料并基于文档提问。'}</p>

            <div className="login-mode-tabs" role="tablist" aria-label="账户操作">
              <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>登录</button>
              <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')}>注册</button>
            </div>

            <form className="login-form" onSubmit={submit}>
              {mode === 'register' && <>
                <label htmlFor="tenant-name">空间名称</label>
                <div className="login-input-wrap"><input id="tenant-name" value={tenantName} onChange={(e) => setTenantName(e.target.value)} placeholder="例如：我的知识空间 / 知微团队" maxLength={128} /></div>
              </>}
              <label htmlFor="tenant-code">空间代码 <span className="login-field-hint">个人或团队成员登录时使用</span></label>
              <div className="login-input-wrap"><input id="tenant-code" value={tenantCode} onChange={(e) => setTenantCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} onFocus={() => setFocusedField('tenant')} onBlur={() => setFocusedField(null)} placeholder="例如：my-knowledge" autoComplete="organization" maxLength={64} /></div>

              <label htmlFor="login-username">用户名 {mode === 'register' && <span className="login-field-hint">3–32 个字符</span>}</label>
              <div className="login-input-wrap"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="6.5" r="3" stroke="currentColor" strokeWidth="1.4" /><path d="M4 16c.5-2.5 2.5-4 6-4s5.5 1.5 6 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg><input id="login-username" value={username} onChange={(e) => setUsername(e.target.value)} onFocus={focusUsername} onBlur={blurUsername} placeholder="输入用户名" autoComplete="username" maxLength={mode === 'register' ? 32 : undefined} /></div>

              <div className="login-password-label"><label htmlFor="login-password">密码</label>{mode === 'register' && <span>至少 8 位</span>}</div>
              <div className="login-input-wrap"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="4" y="8" width="12" height="9" rx="2" stroke="currentColor" strokeWidth="1.4" /><path d="M6.5 8V5.5a3.5 3.5 0 0 1 7 0V8" stroke="currentColor" strokeWidth="1.4" /></svg><input id="login-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => { setPassword(e.target.value); setLoginRejected(false) }} onFocus={() => setFocusedField('password')} onBlur={() => setFocusedField(null)} placeholder="输入密码" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'register' ? 8 : undefined} /><button type="button" className="login-password-toggle" onMouseDown={event => event.preventDefault()} onFocus={() => setFocusedField('password')} onBlur={() => setFocusedField(null)} onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? '隐藏密码' : '显示密码'} title={showPassword ? '隐藏密码' : '显示密码'}><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M2.2 10s2.7-5 7.8-5 7.8 5 7.8 5-2.7 5-7.8 5-7.8-5-7.8-5Z" stroke="currentColor" strokeWidth="1.4" /><circle cx="10" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.4" />{showPassword && <path d="m3 3 14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />}</svg></button></div>

              {error && <div className="login-error" role="alert"><span>!</span>{error}</div>}
              <div className={`login-action-row${guestEnabled ? ' has-guest' : ''}`}>
                <button className="login-submit" disabled={busy || !tenantCode || !username || !password || (mode === 'register' && !tenantName.trim())}>
                  {busy ? <><span className="login-spinner" />请稍候…</> : mode === 'login' ? '进入知识空间' : '创建账号'}
                </button>
                {guestEnabled && <button type="button" disabled={busy} onClick={() => void enterAsGuest()} className="login-guest-button">
                  <span className="login-guest-label">{busy ? '请稍候…' : '游客体验'}</span>
                  <span className="login-guest-info" role="note" tabIndex={0} aria-label="游客账号说明" onClick={event => event.stopPropagation()}>
                    ?
                    <span className="login-guest-tooltip">游客共用此账号空间，请勿输入敏感资料</span>
                  </span>
                </button>}
              </div>
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
