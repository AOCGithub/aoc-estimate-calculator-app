import { useEffect, useRef } from 'react';

export function RestartDialog({ open, onCancel, onConfirm }) {
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);
  const confirmRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    cancelRef.current.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="restart-dialog"
      aria-labelledby="restart-dialog-title"
      aria-describedby="restart-dialog-description"
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        if (event.shiftKey && document.activeElement === cancelRef.current) {
          event.preventDefault();
          confirmRef.current.focus();
        } else if (!event.shiftKey && document.activeElement === confirmRef.current) {
          event.preventDefault();
          cancelRef.current.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right
          || event.clientY < bounds.top || event.clientY > bounds.bottom) onCancel();
      }}
    >
      <h2 id="restart-dialog-title">Start over?</h2>
      <p id="restart-dialog-description">Your answers and estimate will be cleared.</p>
      <div className="restart-dialog__actions">
        <button ref={cancelRef} type="button" onClick={onCancel}>Keep editing</button>
        <button ref={confirmRef} type="button" className="primary" onClick={onConfirm}>Start over</button>
      </div>
    </dialog>
  );
}
