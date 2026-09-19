import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Save, X, Trash2 } from 'lucide-react';
import { useLeadContext } from '../store/LeadContext.js';



export const LeadNoteButton = ({ lead }) => {
  const { updateLead } = useLeadContext();
  const [isOpen, setIsOpen] = useState(false);
  const [noteText, setNoteText] = useState(lead.notes || '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setNoteText(lead.notes || '');
  }, [lead.notes]);

  const hasNote = Boolean(lead.notes && lead.notes.trim().length > 0);

  const handleOpen = (e) => {
    e.stopPropagation();
    setNoteText(lead.notes || '');
    setIsOpen(true);
  };

  const handleClose = () => {
    if (isSaving) return;
    setIsOpen(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const trimmed = noteText.trim();
      await updateLead({
        ...lead,
        notes: trimmed,
      });
      setIsOpen(false);
    } catch (err) {
      console.error('Failed to save lead note:', err);
      alert('Failed to save note. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    setIsSaving(true);
    try {
      await updateLead({
        ...lead,
        notes: '',
      });
      setNoteText('');
      setIsOpen(false);
    } catch (err) {
      console.error('Failed to clear lead note:', err);
      alert('Failed to clear note. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={`note-btn ${hasNote ? 'note-btn-has-content' : 'note-btn-empty'}`}
        onClick={handleOpen}
        title={hasNote ? lead.notes : 'Click to add note'}
      >
        <FileText size={13} /> Note
      </button>

      {isOpen &&
        createPortal(
          <div className="modal-overlay" onClick={handleClose} style={{ zIndex: 1100, padding: '5rem 1rem 2rem' }}>
            <div
              className="modal-content surface-panel animate-fade-in"
              style={{ maxWidth: '480px' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileText size={18} className={hasNote ? 'text-success' : 'text-danger'} />
                  <h2 style={{ fontSize: '1.1rem', margin: 0 }}>
                    Note for {lead.customerName || 'Lead'}
                  </h2>
                </div>
                <button type="button" className="btn-icon" onClick={handleClose} disabled={isSaving}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSave}>
                <div className="modal-body">
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                    <strong>{lead.identifier}</strong> · {lead.carBrand} {lead.carModel} ({lead.leadSource})
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Lead Notes</label>
                    <textarea
                      className="form-textarea"
                      rows={5}
                      placeholder="Write any quick notes, customer preferences, or reminders for this lead..."
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>

                <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
                  <div>
                    {hasNote && (
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm"
                        onClick={handleClear}
                        disabled={isSaving}
                      >
                        <Trash2 size={14} /> Clear Note
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleClose}
                      disabled={isSaving}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary btn-sm"
                      disabled={isSaving}
                    >
                      <Save size={14} /> {isSaving ? 'Saving...' : 'Save Note'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
