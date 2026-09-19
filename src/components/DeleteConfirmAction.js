import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';



export const DeleteConfirmAction = ({
  onConfirm,
  size = 'sm',
  isDeleting = false,
  deleteText = 'Delete',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  promptText = 'Are you sure?',
  className = '',
  style,
}) => {
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = async (e) => {
    e.stopPropagation();
    try {
      await onConfirm();
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancel = (e) => {
    e.stopPropagation();
    setIsConfirming(false);
  };

  const handleTrigger = (e) => {
    e.stopPropagation();
    setIsConfirming(true);
  };

  const btnClass = size === 'sm' ? 'btn-sm' : '';
  const fontSize = size === 'sm' ? '0.75rem' : '0.875rem';
  const iconSize = size === 'sm' ? 14 : 16;

  if (isConfirming) {
    return (
      <div 
        className={`delete-confirm-group ${className}`} 
        style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center', ...style }}
      >
        <span 
          style={{ 
            color: 'var(--danger)', 
            fontWeight: 600, 
            fontSize, 
            marginRight: '0.25rem',
            whiteSpace: 'nowrap'
          }}
        >
          {promptText}
        </span>
        <button 
          type="button"
          className={`btn btn-secondary ${btnClass}`} 
          onClick={handleCancel}
          disabled={isDeleting}
        >
          {cancelText}
        </button>
        <button 
          type="button"
          className={`btn btn-danger ${btnClass}`} 
          onClick={handleConfirm}
          disabled={isDeleting}
        >
          {isDeleting ? 'Deleting...' : confirmText}
        </button>
      </div>
    );
  }

  return (
    <button 
      type="button"
      className={`btn btn-outline-danger ${btnClass} ${className}`} 
      onClick={handleTrigger}
      disabled={isDeleting}
      style={style}
    >
      <Trash2 size={iconSize} /> {isDeleting ? 'Deleting...' : deleteText}
    </button>
  );
};
