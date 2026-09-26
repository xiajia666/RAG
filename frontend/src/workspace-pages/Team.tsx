import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { User } from '../api/types'
import { useAuth } from '../store/auth'

type InviteResult = { user: User; temporary_password: string }
const ROLE_LABEL: Record<User['role'], string> = { admin: '管理员', operator: '编辑', user: '只读' }

export default function Team() {
  const { user: current } = useAuth()
  const [members, setMembers] = useState<User[]>([])
  const [inviteOpen, setInviteOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [role, setRole] = useState<User['role']>('operator')
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null)
  const [credentialAction, setCredentialAction] = useState<'invite' | 'reset'>('invite')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const isAdmin = current?.role === 'admin'
  async function refresh() { setMembers(await api.get<User[]>('/api/users')) }
  useEffect(() => { if (isAdmin) refresh().catch(e => setError(e.message)) }, [isAdmin])
  async function invite() {
    setBusy(true); setError('')
    try { const result = await api.post<InviteResult>('/api/users/invite', { email, username, role }); setCredentialAction('invite'); setInviteResult(result); setEmail(''); setUsername(''); await refresh() }
    catch (e) { setError(e instanceof Error ? e.message : '邀请失败') }
    finally { setBusy(false) }
  }
  async function resetPassword(member: User) {
    setError('')
    try {
      const result = await api.post<{ temporary_password: string }>(`/api/users/${member.id}/reset-password`)
      setCredentialAction('reset'); setInviteResult({ user: member, temporary_password: result.temporary_password }); setInviteOpen(true)
    } catch (e) { setError(e instanceof Error ? e.message : '重置密码失败') }
  }
  async function updateRole(member: User, next: string) {
    setError('')
    try { await api.patch(`/api/users/${member.id}`, { role: next }); await refresh() }
    catch (e) { setError(e instanceof Error ? e.message : '更新失败') }
  }
  async function remove(member: User) {
    if (!window.confirm(`确定移除成员 ${member.username} 吗？`)) return
    try { await api.del(`/api/users/${member.id}`); await refresh() }
    catch (e) { setError(e instanceof Error ? e.message : '移除失败') }
  }
  return <div className="flex-1 overflow-y-auto p-6 animate-fade-in">
    <div className="flex justify-between items-start mb-6"><div><h1 className="text-2xl font-bold">团队管理</h1><p className="text-sm mt-1" style={{ color: 'var(--color-text-3)' }}>{isAdmin ? `${members.length} 名成员` : '只有管理员可以管理团队成员'}</p></div>{isAdmin && <button onClick={() => { setInviteResult(null); setCredentialAction("invite"); setInviteOpen(true) }} className="px-4 py-2 rounded-lg text-sm" style={{ background: 'var(--color-cyan)', color: 'var(--color-text-inv)' }}>＋ 邀请成员</button>}</div>
    {error && <p className="mb-4 text-sm" style={{ color: 'var(--color-red)' }}>{error}</p>}
    <section className="rounded-xl p-4 mb-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}><div className="flex justify-between text-sm mb-2"><span>当前企业成员</span><span>{members.length}</span></div><div className="h-2 rounded-full" style={{ background: 'var(--color-surface-3)' }}><div className="h-full rounded-full" style={{ width: '100%', background: 'var(--color-cyan)' }} /></div><p className="text-xs mt-2" style={{ color: 'var(--color-text-3)' }}>席位上限由部署方案管理；当前版本不提供套餐计费功能。</p></section>
    <section className="rounded-xl overflow-x-auto" style={{ border: '1px solid var(--color-border)' }}><table className="w-full text-sm"><thead><tr style={{ background: 'var(--color-surface)', color: 'var(--color-text-3)' }}>{['成员', '邮箱', '角色', '加入时间', '操作'].map(label => <th key={label} className="p-3 text-left text-xs">{label}</th>)}</tr></thead><tbody>{members.map(member => <tr key={member.id} style={{ background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)' }}><td className="p-3"><div className="flex items-center gap-2"><span className="w-8 h-8 rounded-full flex items-center justify-center" style={{ color: 'var(--color-violet)', background: 'var(--color-violet-dim)' }}>{(member.nickname || member.username).slice(0, 1).toUpperCase()}</span><span>{member.nickname || member.username}{member.id === current?.id && <span className="ml-2 text-xs" style={{ color: 'var(--color-text-3)' }}>你</span>}</span></div></td><td className="p-3 text-xs" style={{ color: 'var(--color-text-3)' }}>{member.email || '—'}</td><td className="p-3"><span className="px-2 py-1 rounded-full text-xs" style={{ color: 'var(--color-cyan)', background: 'var(--color-cyan-dim)' }}>{ROLE_LABEL[member.role]}</span></td><td className="p-3 text-xs" style={{ color: 'var(--color-text-3)' }}>{String(member.created_at).slice(0, 10)}</td><td className="p-3">{isAdmin && member.id !== current?.id ? <div className="flex items-center gap-3"><select value={member.role} onChange={e => void updateRole(member, e.target.value)} className="px-2 py-1 rounded" style={{ color: 'var(--color-text-2)', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}><option value="operator">编辑</option><option value="user">只读</option><option value="admin">管理员</option></select><button onClick={() => void resetPassword(member)} className="text-xs" style={{ color: 'var(--color-cyan)' }}>重置密码</button><button onClick={() => void remove(member)} className="text-xs" style={{ color: 'var(--color-red)' }}>移除</button></div> : <span className="text-xs" style={{ color: 'var(--color-text-3)' }}>—</span>}</td></tr>)}</tbody></table>{!members.length && <p className="p-8 text-center text-sm" style={{ color: 'var(--color-text-3)' }}>暂无成员数据</p>}</section>
    {inviteOpen && <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(7,11,18,.8)' }}><div className="w-full max-w-md rounded-2xl p-6" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-md)' }}><div className="flex justify-between mb-5"><h2 className="font-semibold">邀请团队成员</h2><button onClick={() => setInviteOpen(false)}>关闭</button></div>{inviteResult ? <div><p className="text-sm mb-3">{credentialAction === 'reset' ? '密码已重置。系统没有邮件发送服务，请通过安全渠道把新密码交给成员：' : '成员账号已创建。系统没有邮件发送服务，请通过安全渠道把以下初始凭据交给成员：'}</p><div className="p-3 rounded-lg text-sm space-y-2" style={{ background: 'var(--color-surface-2)' }}><p>用户名：<b>{inviteResult.user.username}</b></p><p>邮箱：{inviteResult.user.email}</p><p>初始密码：<b className="select-all">{inviteResult.temporary_password}</b></p><p>角色：{ROLE_LABEL[inviteResult.user.role]}</p></div><button onClick={() => navigator.clipboard?.writeText(`用户名：${inviteResult.user.username}\n初始密码：${inviteResult.temporary_password}`)} className="mt-4 px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--color-cyan)', color: 'var(--color-text-inv)' }}>复制凭据</button><button onClick={() => { setInviteResult(null); setCredentialAction("invite") }} className="ml-2 px-3 py-2 rounded-lg text-sm">再邀请一位</button><button onClick={() => setInviteOpen(false)} className="ml-2 px-3 py-2 rounded-lg text-sm">完成</button></div> : <div className="space-y-4"><label className="block text-sm">邮箱<input value={email} onChange={e => { setEmail(e.target.value); setUsername(e.target.value.split('@')[0].replace(/[^a-z0-9_-]/gi, '').slice(0, 32)) }} type="email" placeholder="member@company.com" className="mt-1 w-full px-3 py-2 rounded-lg" style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }} /></label><label className="block text-sm">登录用户名<input value={username} onChange={e => setUsername(e.target.value)} minLength={3} maxLength={32} className="mt-1 w-full px-3 py-2 rounded-lg" style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }} /></label><label className="block text-sm">角色<select value={role} onChange={e => setRole(e.target.value as User['role'])} className="mt-1 w-full px-3 py-2 rounded-lg" style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}><option value="operator">编辑：上传与维护文档</option><option value="user">只读：检索与问答</option></select></label><p className="text-xs" style={{ color: 'var(--color-text-3)' }}>账号会立即创建。当前没有邮件服务，提交后会显示初始密码；成员首次登录后可在“设置 → 安全”中修改。</p>{error && <p className="text-sm" style={{ color: 'var(--color-red)' }}>{error}</p>}<div className="flex justify-end gap-2"><button onClick={() => setInviteOpen(false)} className="px-3 py-2 rounded-lg text-sm">取消</button><button onClick={() => void invite()} disabled={!email || username.length < 3 || busy} className="px-4 py-2 rounded-lg text-sm" style={{ background: 'var(--color-cyan)', color: 'var(--color-text-inv)' }}>{busy ? '创建中…' : '创建成员账号'}</button></div></div>}</div></div>}
  </div>
}
