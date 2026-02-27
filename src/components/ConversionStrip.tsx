import { Link } from 'react-router-dom'

type ConversionStripProps = {
  eyebrow?: string
  title: string
  body: string
  primary: { label: string; href: string; external?: boolean }
  secondary?: { label: string; href: string; external?: boolean }
}

export function ConversionStrip(props: ConversionStripProps) {
  return (
    <div className="conversion-strip">
      {props.eyebrow ? <div className="conversion-eyebrow">{props.eyebrow}</div> : null}
      <h3 className="conversion-title">{props.title}</h3>
      <p className="conversion-body">{props.body}</p>
      <div className="conversion-actions">
        {props.primary.external ? (
          <a className="btn btn-primary" href={props.primary.href} target="_blank" rel="noreferrer">
            {props.primary.label}
          </a>
        ) : (
          <Link className="btn btn-primary" to={props.primary.href}>
            {props.primary.label}
          </Link>
        )}

        {props.secondary
          ? props.secondary.external
            ? (
              <a className="btn" href={props.secondary.href} target="_blank" rel="noreferrer">
                {props.secondary.label}
              </a>
            )
            : (
              <Link className="btn" to={props.secondary.href}>
                {props.secondary.label}
              </Link>
            )
          : null}
      </div>
    </div>
  )
}
