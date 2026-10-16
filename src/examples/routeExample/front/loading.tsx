import './palette.css'
import './loading.css'

type LoadingProps = {
    label?: string
}

/* A span, not a div, so it can also sit inside a paragraph. */
export function Loading({ label = 'Ładowanie…' }: LoadingProps) {
    return <span className="loading-indicator" role="status">
        <span className="loading-spinner" aria-hidden="true" />
        {label}
    </span>
}
