import React, { useState, useRef } from 'react';
import { useAuth } from '../store/AuthContext';
import {
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Download,
  Upload,
  Database,
} from 'lucide-react';
import {
  downloadDatabaseBackup,
  restoreDatabaseFromBackup,
} from '../utils/backupService';
import './Settings.css';

export const Settings: React.FC = () => {
  const { user, updatePassword } = useAuth();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Database Backup & Restore State
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [backupProgress, setBackupProgress] = useState<string | null>(null);
  const [restoreProgress, setRestoreProgress] = useState<string | null>(null);
  const [backupSuccessMsg, setBackupSuccessMsg] = useState<string | null>(null);
  const [backupErrorMsg, setBackupErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // If both password fields are blank
    if (!newPassword && !confirmPassword) {
      setErrorMsg('Please enter a new password to update your credentials.');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('New password and confirmation password do not match.');
      return;
    }

    try {
      setIsSaving(true);
      const { error } = await updatePassword(newPassword);
      if (error) {
        setErrorMsg(error.message || 'Failed to update password. Please try again.');
      } else {
        setSuccessMsg('Your password has been successfully updated!');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred while updating password.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackup = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setBackupErrorMsg(null);
    setBackupSuccessMsg(null);
    setIsBackingUp(true);

    try {
      const result = await downloadDatabaseBackup((status) => {
        setBackupProgress(status);
      });

      if (result.success) {
        setBackupSuccessMsg(
          `Backup successful! Downloaded as "${result.filename}" (${result.totalRecords.toLocaleString()} records, ${result.sizeKb} KB).`
        );
      } else {
        setBackupErrorMsg(result.error || 'Failed to download database backup.');
      }
    } catch (err: any) {
      setBackupErrorMsg(err?.message || 'An unexpected error occurred while backing up the database.');
    } finally {
      setIsBackingUp(false);
      setBackupProgress(null);
    }
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const confirmed = window.confirm(
      `Restore database from "${file.name}"?\n\nThis will import and restore all database records into Supabase.`
    );

    if (!confirmed) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setBackupErrorMsg(null);
    setBackupSuccessMsg(null);
    setIsRestoring(true);

    try {
      const result = await restoreDatabaseFromBackup(file, (status) => {
        setRestoreProgress(status);
      });

      if (result.success) {
        setBackupSuccessMsg(
          `Database restored successfully! ${result.totalRestored.toLocaleString()} records updated/inserted across all tables.`
        );
      } else {
        setBackupErrorMsg(result.error || 'Failed to restore database from backup file.');
      }
    } catch (err: any) {
      setBackupErrorMsg(err?.message || 'An error occurred during restore.');
    } finally {
      setIsRestoring(false);
      setRestoreProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="settings-page animate-fade-in">
      {/* Header */}
      <div className="settings-header">
        <h1 className="settings-title">Account Settings</h1>
        <p className="settings-subtitle">Manage credentials and local database backups</p>
      </div>

      {/* Alert Notices */}
      {(errorMsg || backupErrorMsg) && (
        <div className="settings-alert settings-alert-error" role="alert">
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{errorMsg || backupErrorMsg}</span>
        </div>
      )}

      {(successMsg || backupSuccessMsg) && (
        <div className="settings-alert settings-alert-success" role="alert">
          <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
          <span>{successMsg || backupSuccessMsg}</span>
        </div>
      )}

      {/* Settings Card */}
      <div className="settings-card surface-panel">
        <form onSubmit={handleSave} className="settings-form">
          {/* Email Address */}
          <div className="settings-field-group">
            <label className="settings-label" htmlFor="settings-email">
              Email Address
            </label>
            <input
              id="settings-email"
              type="email"
              className="settings-input settings-input-readonly"
              value={user?.email || 'sonparatev@gmail.com'}
              readOnly
              disabled
            />
          </div>

          <hr className="settings-divider" />

          {/* Change Password Heading */}
          <div className="settings-section-heading">
            <h2 className="settings-section-title">Change Password</h2>
            <p className="settings-section-desc">Leave blank if you don't want to change it.</p>
          </div>

          {/* New Password */}
          <div className="settings-field-group">
            <label className="settings-label" htmlFor="new-password">
              New Password
            </label>
            <div className="settings-password-wrapper">
              <input
                id="new-password"
                type={showNewPassword ? 'text' : 'password'}
                className="settings-input settings-password-input"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                disabled={isSaving}
              />
              <button
                type="button"
                className="settings-toggle-btn"
                onClick={() => setShowNewPassword((prev) => !prev)}
                tabIndex={-1}
                aria-label={showNewPassword ? 'Hide password' : 'Show password'}
              >
                {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Confirm New Password */}
          <div className="settings-field-group">
            <label className="settings-label" htmlFor="confirm-password">
              Confirm New Password
            </label>
            <div className="settings-password-wrapper">
              <input
                id="confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                className="settings-input settings-password-input"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                disabled={isSaving}
              />
              <button
                type="button"
                className="settings-toggle-btn"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                tabIndex={-1}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Action Button */}
          <div className="settings-action-row">
            <button
              type="submit"
              className="settings-save-btn"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <RefreshCw size={15} className="spin" />
                  <span>Saving...</span>
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>

        <hr className="settings-divider" />

        {/* Database Backup & Restore Section */}
        <div className="settings-backup-section">
          <div className="settings-backup-left">
            <div className="settings-backup-icon-wrapper">
              <Database size={18} className="settings-backup-icon" />
            </div>
            <div>
              <h2 className="settings-section-title">Database Backup & Restore</h2>
              <p className="settings-section-desc">
                Download a complete PostgreSQL SQL dump or restore all database tables.
              </p>
            </div>
          </div>
          <div className="settings-backup-actions">
            <button
              type="button"
              className="settings-backup-btn"
              onClick={handleBackup}
              disabled={isBackingUp || isRestoring}
              title="Download all database tables as PostgreSQL SQL dump"
            >
              {isBackingUp ? (
                <>
                  <RefreshCw size={14} className="spin" />
                  <span>{backupProgress || 'Backing up...'}</span>
                </>
              ) : (
                <>
                  <Download size={14} />
                  <span>Backup</span>
                </>
              )}
            </button>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleRestoreFile}
              accept=".sql,.json,text/plain,application/sql"
              style={{ display: 'none' }}
            />

            <button
              type="button"
              className="settings-restore-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={isBackingUp || isRestoring}
              title="Restore database from a local .sql or .json backup file"
            >
              {isRestoring ? (
                <>
                  <RefreshCw size={14} className="spin" />
                  <span>{restoreProgress || 'Restoring...'}</span>
                </>
              ) : (
                <>
                  <Upload size={14} />
                  <span>Restore</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
