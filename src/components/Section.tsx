import React from 'react'
import { motion } from 'framer-motion'

export function Section(props: {
  eyebrow?: string
  title: string
  children: React.ReactNode
}) {
  return (
    <motion.section
      className="section-frame"
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <div className="container section-inner">
        <div className="section-head">
          <div className="section-rule" aria-hidden="true" />
          <div className="section-heading-block">
        {props.eyebrow ? (
              <div className="badge section-badge">
            <span style={{ color: 'var(--accent2)' }}>{props.eyebrow}</span>
          </div>
        ) : null}
            <h2 className="h2 section-title">{props.title}</h2>
          </div>
        </div>
        {props.children}
      </div>
    </motion.section>
  )
}
