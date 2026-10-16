import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './modal.css'

type ModalProps = {
    children: ReactNode
    isOpen: boolean
    /** Fired on a backdrop click or the Escape key. */
    onCancel: () => void
}

function Modal({ children, isOpen, onCancel }: ModalProps) {
    
    useEffect(() => {
        if (!isOpen) return

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onCancel()
        }

        document.addEventListener('keydown', onKeyDown)
        return () => document.removeEventListener('keydown', onKeyDown)
    }, [isOpen, onCancel])

    if (!isOpen) return null

    return createPortal(
        <div
            className="modal-backdrop"
            // Only the backdrop itself, not clicks bubbling up from the content
            onClick={(event) => event.target === event.currentTarget && onCancel()}
        >
            <div className="modal-content" role="dialog" aria-modal="true">
                {children}
            </div>
        </div>,
        document.body,
    )
}

export default Modal
