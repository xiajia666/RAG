import { useState } from 'react'

const MEMBERS = [
  { name: '张小明', avatar: '张', email: 'zhangxm@example.com', role: '超级管理员', dept: '产品', kbs: 12, joined: '2026-01-10', status: 'online' },
  { name: '李梅', avatar: '李', email: 'limei@example.com', role: '管理员', dept: '产品', kbs: 5, joined: '2026-02-22', status: 'online' },
  { name: '王刚', avatar: '王', email: 'wanggang@example.com', role: '编辑', dept: '技术', kbs: 3, joined: '2026-03-14', status: 'offline' },
  { name: '陈雨', avatar: '陈', email: 'chenyu@example.com', role: '编辑', dept: '客服', kbs: 2, joined: '2026-05-01', status: 'offline' },
  { name: '赵磊', avatar: '赵', email: 'zhaolei@example.com', role: '只读', dept: '法务', kbs: 1, joined: '2026-07-30', status: 'online' },
  { name: '刘芳', avatar: '刘', email: 'liufang@example.com', role: '只读', dept: 'HR', kbs: 1, joined: '2026-09-01', status: 'offline' },
]

const ROLE_META: Record<string, { color: string; bg: string; desc: string }> = {
  '超级管理员': { color: 'var(--color-cyan)', bg: 'var(--color-cyan-dim)', desc: '所有权限' },
  '管理员': { color: 'var(--color-blue)', bg: 'var(--color-blue-dim)', desc: '管理知识库和成员' },
  '编辑': { color: 'var(--color-violet)', bg: 'var(--color-violet-dim)', desc: '上传和编辑文档' },
  '只读': { color: 'var(--color-text-3)', bg: 'var(--color-surface-3)', desc: '仅可查询' },
}

export default function Team() {
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('编辑')

  return (
    <div className="flex-1 overflow-y-auto animate-fade-in" style={{ padding: '24px 28px' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.4rem', letterSpacing: '-0.02em' }}>团队管理</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-3)' }}>{MEMBERS.length} 名成员 · 已使用 6 / 50 席位</p>
        </div>
        <button onClick={() => setInviteOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium" style={{ background: 'var(--color-cyan)', color: 'var(--color-text-inv)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          邀请成员
        </button>
      </div>

      {/* Seat usage bar */}
      <div className="rounded-xl p-4 mb-6 flex items-center gap-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div className="flex-1">
          <div className="flex justify-between text-xs mb-1.5" style={{ color: 'var(--color-text-2)' }}>
            <span>席位使用</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>6 / 50</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-3)' }}>
            <div className="h-full rounded-full" style={{ width: '12%', background: 'var(--color-cyan)' }}/>
          </div>
        </div>
        <button className="text-xs px-3 py-1.5 rounded-lg shrink-0" style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-2)' }}>升级套餐</button>
      </div>

      {/* Role legend */}
      <div className="flex flex-wrap gap-3 mb-5">
        {Object.entries(ROLE_META).map(([role, { color, bg, desc }]) => (
          <div key={role} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs" style={{ background: bg, border: `1px solid ${color}25` }}>
            <span style={{ color }}>{role}</span>
            <span style={{ color: 'var(--color-text-3)' }}>· {desc}</span>
          </div>
        ))}
      </div>

      {/* Members table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
              {['成员', '邮箱', '角色', '部门', '可访问知识库', '加入时间', '操作'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--color-text-3)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MEMBERS.map((m, i) => (
              <tr key={i} className="transition-colors" style={{ borderBottom: i < MEMBERS.length - 1 ? '1px solid var(--color-border)' : 'none', background: 'var(--color-surface)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-surface)')}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm" style={{ background: 'var(--color-violet-dim)', color: 'var(--color-violet)', border: '1px solid rgba(139,92,246,0.2)' }}>{m.avatar}</div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2" style={{ background: m.status === 'online' ? 'var(--color-green)' : 'var(--color-text-3)', borderColor: 'var(--color-surface)' }}/>
                    </div>
                    <span className="font-medium">{m.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-3)' }}>{m.email}</td>
                <td className="px-4 py-3">
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: ROLE_META[m.role].bg, color: ROLE_META[m.role].color, fontFamily: 'var(--font-mono)' }}>{m.role}</span>
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-2)' }}>{m.dept}</td>
                <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-2)', fontFamily: 'var(--font-mono)' }}>{m.kbs} 个</td>
                <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-3)' }}>{m.joined}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-3 text-xs">
                    <button style={{ color: 'var(--color-cyan)' }}>编辑</button>
                    {m.role !== '超级管理员' && <button style={{ color: 'var(--color-red)' }}>移除</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invite modal */}
      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(7,11,18,0.85)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-md rounded-2xl p-6 animate-fade-in" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-md)' }}>
            <div className="flex items-center justify-between mb-5">
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>邀请团队成员</span>
              <button onClick={() => setInviteOpen(false)} style={{ color: 'var(--color-text-3)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs block mb-1.5" style={{ color: 'var(--color-text-2)' }}>邮箱地址</label>
                <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="colleague@company.com" className="w-full px-3 py-2.5 rounded-lg text-sm" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border-md)', color: 'var(--color-text)' }}/>
              </div>
              <div>
                <label className="text-xs block mb-2" style={{ color: 'var(--color-text-2)' }}>角色权限</label>
                <div className="space-y-2">
                  {Object.entries(ROLE_META).filter(([r]) => r !== '超级管理员').map(([role, { color, bg, desc }]) => (
                    <button key={role} onClick={() => setInviteRole(role)} className="w-full flex items-center gap-3 p-3 rounded-xl text-left" style={{ background: inviteRole === role ? bg : 'var(--color-surface-2)', border: `1px solid ${inviteRole === role ? color + '40' : 'var(--color-border)'}` }}>
                      <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ border: `2px solid ${inviteRole === role ? color : 'var(--color-text-3)'}` }}>
                        {inviteRole === role && <div className="w-2 h-2 rounded-full" style={{ background: color }}/>}
                      </div>
                      <div>
                        <div className="text-sm font-medium" style={{ color: inviteRole === role ? color : 'var(--color-text)' }}>{role}</div>
                        <div className="text-xs" style={{ color: 'var(--color-text-3)' }}>{desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setInviteOpen(false)} className="flex-1 py-2.5 rounded-xl text-sm" style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-2)' }}>取消</button>
                <button className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: 'var(--color-cyan)', color: 'var(--color-text-inv)' }} onClick={() => setInviteOpen(false)}>发送邀请</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
