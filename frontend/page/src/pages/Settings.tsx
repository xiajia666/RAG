import { useState } from 'react'

const TABS = ['通用', 'API & 集成', '模型配置', '安全', '账单'] as const
type Tab = typeof TABS[number]

const INTEGRATIONS = [
  { name: 'Notion', desc: '同步 Notion 工作区内容', connected: true, icon: '📝' },
  { name: 'Confluence', desc: '接入 Confluence 知识空间', connected: false, icon: '📋' },
  { name: '飞书文档', desc: '接入飞书云文档', connected: true, icon: '🪶' },
  { name: 'Google Drive', desc: '同步 Google Drive 文件', connected: false, icon: '📂' },
  { name: 'WeCom', desc: '企业微信机器人推送', connected: false, icon: '💬' },
  { name: 'Slack', desc: 'Slack bot 问答集成', connected: true, icon: '⚡' },
]

export default function Settings() {
  const [tab, setTab] = useState<Tab>('通用')
  const [orgName, setOrgName] = useState('示例科技有限公司')
  const [apiVisible, setApiVisible] = useState(false)
  const API_KEY = 'nr_live_sk_a8f2e1c4d9b3f7a2e5c8d1f4a7b2e5c8'

  return (
    <div className="flex-1 overflow-y-auto animate-fade-in" style={{ padding: '24px 28px' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.4rem', letterSpacing: '-0.02em', marginBottom: 24 }}>设置</h1>

      {/* Tab bar */}
      <div className="flex gap-0 mb-8 border-b" style={{ borderColor: 'var(--color-border)' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className="px-4 pb-3 text-sm transition-all" style={{ color: tab === t ? 'var(--color-cyan)' : 'var(--color-text-3)', borderBottom: `2px solid ${tab === t ? 'var(--color-cyan)' : 'transparent'}`, marginBottom: -1, fontWeight: tab === t ? 500 : 400 }}>
            {t}
          </button>
        ))}
      </div>

      <div className="max-w-2xl">
        {tab === '通用' && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <label className="text-xs block mb-1.5" style={{ color: 'var(--color-text-2)' }}>企业名称</label>
              <input value={orgName} onChange={e => setOrgName(e.target.value)} className="w-full px-3 py-2.5 rounded-lg text-sm" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-md)', color: 'var(--color-text)' }}/>
            </div>
            <div>
              <label className="text-xs block mb-1.5" style={{ color: 'var(--color-text-2)' }}>企业 Logo</label>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>🏢</div>
                <button className="px-4 py-2 rounded-lg text-sm" style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-2)' }}>上传图片</button>
              </div>
            </div>
            <div>
              <label className="text-xs block mb-2" style={{ color: 'var(--color-text-2)' }}>默认语言</label>
              <select className="w-full px-3 py-2.5 rounded-lg text-sm" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-md)', color: 'var(--color-text)' }}>
                <option>简体中文</option>
                <option>English</option>
              </select>
            </div>
            <div className="flex items-center justify-between py-4 border-t border-b" style={{ borderColor: 'var(--color-border)' }}>
              <div>
                <div className="text-sm font-medium">邮件通知</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-3)' }}>文档索引完成、成员操作等通知</div>
              </div>
              <div className="w-10 h-6 rounded-full cursor-pointer relative" style={{ background: 'var(--color-cyan)' }}>
                <div className="absolute right-1 top-1 w-4 h-4 rounded-full bg-white"/>
              </div>
            </div>
            <button className="px-5 py-2.5 rounded-lg text-sm font-medium" style={{ background: 'var(--color-cyan)', color: 'var(--color-text-inv)' }}>保存更改</button>
          </div>
        )}

        {tab === 'API & 集成' && (
          <div className="space-y-6 animate-fade-in">
            {/* API Key */}
            <div className="p-5 rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, marginBottom: 12 }}>API 密钥</div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 px-3 py-2 rounded-lg text-sm font-mono overflow-hidden" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {apiVisible ? API_KEY : API_KEY.replace(/(?<=^.{12}).+(?=.{4}$)/g, '•'.repeat(20))}
                </div>
                <button onClick={() => setApiVisible(v => !v)} className="px-3 py-2 rounded-lg text-sm" style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-2)', whiteSpace: 'nowrap' }}>
                  {apiVisible ? '隐藏' : '显示'}
                </button>
                <button className="px-3 py-2 rounded-lg text-sm" style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-2)', whiteSpace: 'nowrap' }}>复制</button>
              </div>
              <div className="flex gap-2">
                <button className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'var(--color-amber-dim)', color: 'var(--color-amber)', border: '1px solid rgba(245,158,11,0.25)' }}>重新生成</button>
                <a href="#" className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-2)', border: '1px solid var(--color-border)' }}>查看 API 文档</a>
              </div>
            </div>

            {/* Integrations */}
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, marginBottom: 12 }}>外部集成</div>
              <div className="space-y-3">
                {INTEGRATIONS.map(({ name, desc, connected, icon }) => (
                  <div key={name} className="flex items-center gap-4 p-4 rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                    <span className="text-xl shrink-0">{icon}</span>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{name}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-3)' }}>{desc}</div>
                    </div>
                    <button className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all" style={{
                      background: connected ? 'var(--color-green-dim)' : 'var(--color-cyan)',
                      color: connected ? 'var(--color-green)' : 'var(--color-text-inv)',
                      border: connected ? '1px solid rgba(34,197,94,0.25)' : 'none',
                    }}>
                      {connected ? '已连接' : '连接'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === '模型配置' && (
          <div className="space-y-5 animate-fade-in">
            <div className="p-4 rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <div className="text-sm font-medium mb-3">嵌入模型</div>
              <div className="space-y-2">
                {['text-embedding-3-large（推荐）', 'text-embedding-3-small', '私有部署模型'].map((m, i) => (
                  <label key={m} className="flex items-center gap-3 p-3 rounded-lg cursor-pointer" style={{ background: i === 0 ? 'var(--color-cyan-dim)' : 'var(--color-surface-2)', border: `1px solid ${i === 0 ? 'rgba(0,212,180,0.3)' : 'var(--color-border)'}` }}>
                    <input type="radio" name="embed" defaultChecked={i === 0} className="accent-emerald-400"/>
                    <span className="text-sm">{m}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="p-4 rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <div className="text-sm font-medium mb-3">生成模型</div>
              <div className="space-y-2">
                {['GPT-4o（默认）', 'Claude claude-sonnet-5', 'Llama 3.1 70B', '私有大模型'].map((m, i) => (
                  <label key={m} className="flex items-center gap-3 p-3 rounded-lg cursor-pointer" style={{ background: i === 0 ? 'var(--color-cyan-dim)' : 'var(--color-surface-2)', border: `1px solid ${i === 0 ? 'rgba(0,212,180,0.3)' : 'var(--color-border)'}` }}>
                    <input type="radio" name="gen" defaultChecked={i === 0} className="accent-emerald-400"/>
                    <span className="text-sm">{m}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs block mb-1.5" style={{ color: 'var(--color-text-2)' }}>最大召回片段数</label>
              <input type="range" min="1" max="10" defaultValue={5} className="w-full"/>
              <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--color-text-3)', fontFamily: 'var(--font-mono)' }}>
                <span>1</span><span>5（当前）</span><span>10</span>
              </div>
            </div>
          </div>
        )}

        {tab === '安全' && (
          <div className="space-y-5 animate-fade-in">
            {[
              { title: '双因素认证（2FA）', desc: '登录时需要额外验证码', enabled: true },
              { title: '单点登录（SSO）', desc: '通过企业 IdP 统一认证', enabled: false },
              { title: '操作审计日志', desc: '记录所有成员操作行为', enabled: true },
              { title: 'IP 白名单', desc: '仅允许指定 IP 段访问', enabled: false },
            ].map(({ title, desc, enabled }) => (
              <div key={title} className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                <div>
                  <div className="text-sm font-medium">{title}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-3)' }}>{desc}</div>
                </div>
                <div className="w-10 h-6 rounded-full cursor-pointer relative shrink-0" style={{ background: enabled ? 'var(--color-cyan)' : 'var(--color-surface-3)' }}>
                  <div className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all" style={{ left: enabled ? 'calc(100% - 20px)' : 4 }}/>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === '账单' && (
          <div className="space-y-5 animate-fade-in">
            <div className="p-5 rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(0,212,180,0.08) 0%, rgba(59,130,246,0.05) 100%)', border: '1px solid rgba(0,212,180,0.2)' }}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs" style={{ color: 'var(--color-cyan)', fontFamily: 'var(--font-mono)' }}>当前套餐</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.3rem', marginTop: 4 }}>专业版</div>
                  <div className="text-sm mt-1" style={{ color: 'var(--color-text-2)' }}>¥599 / 月 · 下次续费：2026-10-25</div>
                </div>
                <button className="px-3 py-1.5 rounded-lg text-xs" style={{ border: '1px solid rgba(0,212,180,0.3)', color: 'var(--color-cyan)' }}>升级套餐</button>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-4 pt-4" style={{ borderTop: '1px solid rgba(0,212,180,0.15)' }}>
                {[
                  { label: '文档存储', used: '14.2 GB', total: '50 GB' },
                  { label: '本月查询', used: '18,294', total: '500,000' },
                  { label: '团队席位', used: '6', total: '20' },
                ].map(({ label, used, total }) => (
                  <div key={label}>
                    <div className="text-xs" style={{ color: 'var(--color-text-3)' }}>{label}</div>
                    <div className="text-sm font-medium mt-0.5">{used} <span style={{ color: 'var(--color-text-3)', fontWeight: 400 }}>/ {total}</span></div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, marginBottom: 12 }}>账单记录</div>
              {['2026-09-01', '2026-08-01', '2026-07-01'].map(date => (
                <div key={date} className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <div>
                    <div className="text-sm">专业版 · 月付</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-3)' }}>{date}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">¥599</span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--color-green-dim)', color: 'var(--color-green)' }}>已付款</span>
                    <button className="text-xs" style={{ color: 'var(--color-cyan)' }}>下载发票</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
