import { useEffect, useState } from 'react'
import { api, setToken } from '../api/client'
import { useAuth } from '../store/auth'

const TABS = ['通用', 'API & 集成', '模型配置', '安全', '账单'] as const
type Tab = typeof TABS[number]
type Tenant = { id: string; tenant_code: string; name: string }
type Models = { embedding_model: string; chat_model: string; embedding_configured: boolean; chat_configured: boolean }
type SettingsValue = { language?: string; email_notifications?: boolean; top_k?: number; security?: Record<string, boolean> }

export default function Settings() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [tab, setTab] = useState<Tab>('通用')
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [models, setModels] = useState<Models | null>(null)
  const [settings, setSettings] = useState<SettingsValue>({})
  const [name, setName] = useState('')
  const [saved, setSaved] = useState('')
  const [error, setError] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  useEffect(() => {
    Promise.all([api.get<Tenant>('/api/tenant'), api.get<Models>('/api/models'), api.get<SettingsValue>('/api/settings')]).then(([t, m, s]) => { setTenant(t); setName(t.name); setModels(m); setSettings(s) }).catch(e => setError(e.message))
  }, [])
  async function saveGeneral() {
    setError(''); setSaved('')
    try { const updated = await api.patch<Tenant>('/api/tenant', { name }); setTenant(updated); await saveSettings({ language: settings.language || '简体中文', email_notifications: settings.email_notifications ?? false }) }
    catch (e) { setError(e instanceof Error ? e.message : '保存失败') }
  }
  async function saveSettings(patch: SettingsValue) {
    setError(''); setSaved('')
    try { const next = { ...settings, ...patch }; const result = await api.patch<SettingsValue>('/api/settings', { settings: next }); setSettings(result); setSaved('已保存') }
    catch (e) { setError(e instanceof Error ? e.message : '保存失败') }
  }
  async function changePassword() {
    setError(''); setSaved('')
    try { const result = await api.post<{ token: string }>('/api/auth/change-password', { current_password: currentPassword, new_password: newPassword }); setToken(result.token); setCurrentPassword(''); setNewPassword(''); setSaved('密码已更新') }
    catch (e) { setError(e instanceof Error ? e.message : '修改密码失败') }
  }
  const security = settings.security || {}
  const toggles = [{ id: 'two_factor', title: '双因素认证', desc: '当前版本尚未接入验证码服务' }, { id: 'sso', title: '单点登录（SSO）', desc: '当前版本尚未接入企业身份提供商' }, { id: 'audit_log', title: '操作审计日志', desc: '审计日志功能尚未启用' }, { id: 'ip_allowlist', title: 'IP 白名单', desc: '限制访问来源需在网关或服务器配置' }]
  return <div className="flex-1 overflow-y-auto p-6 animate-fade-in"><h1 className="text-2xl font-bold mb-6">设置</h1><div className="flex gap-1 mb-6 overflow-x-auto" style={{ borderBottom: '1px solid var(--color-border)' }}>{TABS.map(item => <button key={item} onClick={() => setTab(item)} className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: tab === item ? 'var(--color-cyan)' : 'var(--color-text-3)', borderBottom: `2px solid ${tab === item ? 'var(--color-cyan)' : 'transparent'}` }}>{item}</button>)}</div><div className="max-w-3xl space-y-5">{error && <p className="text-sm" style={{ color: 'var(--color-red)' }}>{error}</p>}{saved && <p className="text-sm" style={{ color: 'var(--color-green)' }}>{saved}</p>}
    {tab === '通用' && <section className="space-y-5"><label className="block text-sm">企业名称<input disabled={!isAdmin} value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full px-3 py-2.5 rounded-lg" style={inputStyle} /></label><div><label className="block text-sm mb-1">企业代码</label><div className="px-3 py-2.5 rounded-lg text-sm" style={{ color: 'var(--color-text-2)', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>{tenant?.tenant_code || '加载中…'}</div><p className="text-xs mt-1" style={{ color: 'var(--color-text-3)' }}>企业代码是登录时的租户标识，创建后不可更改。</p></div><label className="block text-sm">默认语言<select disabled={!isAdmin} value={settings.language || '简体中文'} onChange={e => setSettings(v => ({ ...v, language: e.target.value }))} className="mt-1 w-full px-3 py-2.5 rounded-lg" style={inputStyle}><option>简体中文</option><option>English</option></select></label><Toggle disabled={!isAdmin} title="邮件通知" desc="邮件发送服务配置后可用于系统通知" value={settings.email_notifications || false} onChange={value => setSettings(s => ({ ...s, email_notifications: value }))} /><button disabled={!isAdmin} onClick={() => void saveGeneral()} className="px-5 py-2.5 rounded-lg text-sm" style={{ ...primaryStyle, opacity: isAdmin ? 1 : .5 }}>保存更改</button></section>}
    {tab === 'API & 集成' && <section className="space-y-4"><div className="rounded-xl p-5" style={cardStyle}><h2 className="font-semibold mb-2">API 接入地址</h2><p className="text-sm mb-3" style={{ color: 'var(--color-text-2)' }}>当前服务未实现独立 API 密钥管理。应用接口使用当前登录会话令牌鉴权，请勿在页面中暴露服务端密钥。</p><code className="block p-3 rounded-lg text-xs break-all" style={{ background: 'var(--color-surface-2)', color: 'var(--color-cyan)' }}>{window.location.origin}/api</code><a className="inline-block mt-3 text-sm" style={{ color: 'var(--color-cyan)' }} href="/docs" target="_blank" rel="noreferrer">打开后端 API 文档 →</a></div><div className="rounded-xl p-5" style={cardStyle}><h2 className="font-semibold mb-2">外部集成</h2><p className="text-sm" style={{ color: 'var(--color-text-3)' }}>Notion、飞书、Slack 等数据同步尚未接入。接入状态会在对应连接器完成配置后显示。</p></div></section>}
    {tab === '模型配置' && <section className="space-y-4"><div className="rounded-xl p-5" style={cardStyle}><h2 className="font-semibold mb-3">服务端当前模型</h2><div className="space-y-3 text-sm"><p>嵌入模型：<b>{models?.embedding_model || '读取中…'}</b><span className="ml-2 text-xs" style={{ color: models?.embedding_configured ? 'var(--color-green)' : 'var(--color-amber)' }}>{models?.embedding_configured ? '已配置凭据' : '未配置凭据'}</span></p><p>问答模型：<b>{models?.chat_model || '读取中…'}</b><span className="ml-2 text-xs" style={{ color: models?.chat_configured ? 'var(--color-green)' : 'var(--color-amber)' }}>{models?.chat_configured ? '已配置凭据' : '未配置凭据'}</span></p></div><p className="text-xs mt-4" style={{ color: 'var(--color-text-3)' }}>模型与供应商凭据由服务器环境变量管理，不能通过浏览器读取或修改。</p></div><div className="rounded-xl p-5" style={cardStyle}><label className="block text-sm">最大召回片段数：{settings.top_k ?? 4}<input disabled={!isAdmin} type="range" min="1" max="10" value={settings.top_k ?? 4} onChange={e => setSettings(s => ({ ...s, top_k: Number(e.target.value) }))} className="w-full mt-3" /></label><button disabled={!isAdmin} onClick={() => void saveSettings({ top_k: settings.top_k ?? 4 })} className="mt-4 px-4 py-2 rounded-lg text-sm" style={{ ...primaryStyle, opacity: isAdmin ? 1 : .5 }}>保存召回设置</button><p className="text-xs mt-2" style={{ color: 'var(--color-text-3)' }}>保存后会用于后续知识库检索。</p></div></section>}
    {tab === '安全' && <section className="space-y-3">{toggles.map(item => <Toggle disabled={!isAdmin} key={item.id} title={item.title} desc={item.desc} value={security[item.id] || false} onChange={value => { const next = { ...security, [item.id]: value }; setSettings(s => ({ ...s, security: next })); void saveSettings({ security: next }) }} />)}<div className="rounded-xl p-5 space-y-3" style={cardStyle}><h2 className="font-semibold">修改登录密码</h2><input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="当前密码" autoComplete="current-password" className="w-full px-3 py-2 rounded-lg" style={inputStyle} /><input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="新密码，至少 8 位" autoComplete="new-password" className="w-full px-3 py-2 rounded-lg" style={inputStyle} /><button disabled={!currentPassword || newPassword.length < 8} onClick={() => void changePassword()} className="px-4 py-2 rounded-lg text-sm" style={primaryStyle}>更新密码</button></div><p className="text-xs" style={{ color: 'var(--color-text-3)' }}>安全选项状态仅作为组织偏好保存；未集成的安全功能不会被伪装成已启用的保护措施。</p></section>}
    {tab === '账单' && <section className="rounded-xl p-5" style={cardStyle}><h2 className="font-semibold mb-2">账单与套餐</h2><p className="text-sm" style={{ color: 'var(--color-text-2)' }}>当前自部署版本没有连接订阅计费服务，因此不会展示虚构套餐或账单记录。</p></section>}
  </div></div>
}

function Toggle({ title, desc, value, onChange, disabled = false }: { title: string; desc: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean }) { return <div className="flex items-center justify-between gap-4 p-4 rounded-xl" style={cardStyle}><div><div className="text-sm font-medium">{title}</div><div className="text-xs mt-1" style={{ color: 'var(--color-text-3)' }}>{desc}</div></div><button type="button" disabled={disabled} role="switch" aria-checked={value} onClick={() => onChange(!value)} className="w-10 h-6 rounded-full relative shrink-0" style={{ background: value ? 'var(--color-cyan)' : 'var(--color-surface-3)', opacity: disabled ? .5 : 1 }}><span className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all" style={{ left: value ? 'calc(100% - 20px)' : 4 }} /></button></div> }
const cardStyle = { background: 'var(--color-surface)', border: '1px solid var(--color-border)' }
const inputStyle = { color: 'var(--color-text)', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }
const primaryStyle = { color: 'var(--color-text-inv)', background: 'var(--color-cyan)' }
