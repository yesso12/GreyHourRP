import React from 'react'

export function Footer() {
  return (
    <div className="container" style={{ padding: '30px 0 46px 0' }}>
      <div className="hr" />
      <div style={{ display:'flex', flexWrap:'wrap', gap: 12, alignItems:'center', justifyContent:'space-between' }}>
        <div className="small">
          © {new Date().getFullYear()} Grey Hour RP • Persistent semi-serious RP • PvPvE
        </div>
        <div className="small">
          <span style={{ opacity: 0.9 }}>Someone will remember you here.</span>
        </div>
      </div>
    </div>
  )
}
