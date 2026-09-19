import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, CheckCircle2, X } from 'lucide-react';



export const ConfirmationModal = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  loading = false,
  variant = 'primary',
  icon,
}) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !loading) {
        onCancel();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onCancel]);

  if (!isOpen) return null;

  const renderIcon = () => {
    if (icon) return icon;
    switch (variant) {
      case 'danger':
        return <Trash2 size={22} style={{ color: 'var(--danger)' }} />;
      case 'warning':
        return <AlertTriangle size={22} style={{ color: 'var(--warning)' }} />;
      case 'success':
        return <CheckCircle2 size={22} style={{ color: 'var(--success)' }} />;
      case 'primary':
      default:
        return <AlertTriangle size={22} style={{ color: 'var(--vip)' }} />;
    }
  };

  const getConfirmButtonClass = () => {
    switch (variant) {
      case 'danger':
        return 'btn btn-danger';
      case 'warning':
        return 'btn btn-primary';
      case 'success':
        return 'btn btn-primary';
      case 'primary':
      default:
        return 'btn btn-primary';
    }
  };

  const getHeaderIconBg = () => {
    switch (variant) {
      case 'danger':
        return 'var(--danger-bg)';
      case 'warning':
        return 'var(--warning-bg)';
      case 'success':
        return 'var(--success-bg)';
      case 'primary':
      default:
        return 'var(--vip-bg)';
    }
  };

  return createPortal(
    <div
      className="modal-overlay animate-fade-in"
      style={{
        zIndex: 2100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) {
          onCancel();
        }
      }}
    >
      <div
        className="modal-content surface-panel"
        style={{
          maxWidth: '440px',
          width: '100%',
          borderRadius: 'var(--radius-xl)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
          border: '1px solid var(--border-light)',
          backgroundColor: 'var(--bg-secondary)',
          color: 'var(--text-primary)',
          animation: 'confirmationModalPop 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            padding: '1.5rem 1.5rem 0.5rem 1.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                backgroundColor: getHeaderIconBg(),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {renderIcon()}
            </div>
            <h3
              style={{
                fontSize: '1.15rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                margin: 0,
                lineHeight: 1.3,
              }}
            >
              {title}
            </h3>
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={onCancel}
            disabled={loading}
            style={{ marginTop: '-0.25rem', marginRight: '-0.25rem' }}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '0.75rem 1.5rem 1.5rem 1.5rem' }}>
          <div
            style={{
              fontSize: '0.9rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
              whiteSpace: typeof message === 'string' ? 'pre-line' : undefined,
            }}
          >
            {message}
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            padding: '1rem 1.5rem',
            backgroundColor: 'var(--bg-tertiary)',
            borderTop: '1px solid var(--border-light)',
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={loading}
            style={{ minWidth: '85px' }}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={getConfirmButtonClass()}
            onClick={onConfirm}
            disabled={loading}
            style={{
              minWidth: '100px',
              backgroundColor: variant === 'danger' ? 'var(--danger)' : undefined,
              color: variant === 'danger' ? '#ffffff' : undefined,
            }}
          >
            {loading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes confirmationModalPop {
          0% {
            opacity: 0;
            transform: scale(0.92) translateY(8px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>,
    document.body
  );
};
