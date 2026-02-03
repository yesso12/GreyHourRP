import React from 'react'
import { motion } from 'framer-motion'

export function Section(props: {
  eyebrow?: string
  title: string
  children: React.ReactNode
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      style={{ padding: '38px 0' }}
    >
      <div className="container">
        {props.eyebrow ? (
          <div className="badge" style={{ marginBottom: 14 }}>
            <span style={{ color: 'var(--accent2)' }}>{props.eyebrow}</span>
          </div>
        ) : null}
        <h2 className="h2" style={{ marginBottom: 10 }}>{props.title}</h2>
        {props.children}
      </div>
    </motion.section>
  )
}
