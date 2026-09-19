import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';





export const ToastNotificationContainer = ({ toasts, onDismiss }) => {
  if (!toasts || toasts.length === 0) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: '1.25rem',
        right: '1.25rem',
        zIndex: 3000,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        maxWidth: '380px',
        width: 'calc(100vw - 2.5rem)',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => (
        <SingleToast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>,
    document.body
  );
};

const SingleToast = ({ toast, onDismiss }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleClose();
    }, toast.duration || 3500);

    return () => clearTimeout(timer);
  }, [toast]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(toast.id);
    }, 200);
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'danger':
        return <AlertCircle size={20} style={{ color: 'var(--danger)' }} />;
      case 'warning':
        return <AlertTriangle size={20} style={{ color: 'var(--warning)' }} />;
      case 'info':
        return <Info size={20} style={{ color: 'var(--info)' }} />;
      case 'success':
      default:
        return <CheckCircle2 size={20} style={{ color: 'var(--success)' }} />;
    }
  };

  const getBorderColor = () => {
    switch (toast.type) {
      case 'danger':
        return 'var(--danger)';
      case 'warning':
        return 'var(--warning)';
      case 'info':
        return 'var(--info)';
      case 'success':
      default:
        return 'var(--success)';
    }
  };

  return (
    <div
      style={{
        pointerEvents: 'auto',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        padding: '0.875rem 1rem',
        backgroundColor: 'var(--bg-secondary)',
        borderLeft: `4px solid ${getBorderColor()}`,
        borderTop: '1px solid var(--border-light)',
        borderRight: '1px solid var(--border-light)',
        borderBottom: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-md)',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.1)',
        color: 'var(--text-primary)',
        animation: isExiting
          ? 'toastSlideOut 0.2s ease forwards'
          : 'toastSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      }}
    >
      <div style={{ marginTop: '1px', flexShrink: 0 }}>{getIcon()}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.3 }}>
          {toast.title}
        </div>
        {toast.message && (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem', lineHeight: 1.4 }}>
            {toast.message}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={handleClose}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          padding: '2px',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: '-2px',
          marginRight: '-4px',
        }}
      >
        <X size={16} />
      </button>
      <style>{`
        @keyframes toastSlideIn {
          from {
            opacity: 0;
            transform: translateY(-12px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes toastSlideOut {
          from {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          to {
            opacity: 0;
            transform: translateY(-8px) scale(0.96);
          }
        }
      `}</style>
    </div>
  );
};
