import { supabase } from '../lib/supabase';
import { fetchAllSupabaseRows } from './dataLayer';

export interface BackupResult {
  success: boolean;
  totalRecords: number;
  filename: string;
  sizeKb: string;
  error?: string;
}

export interface RestoreResult {
  success: boolean;
  totalRestored: number;
  tableCounts: Record<string, number>;
  error?: string;
}

const BACKUP_TABLES = [
  'leads',
  'booking_history',
  'activity_history',
  'garages',
  'car_brands',
  'car_models',
  'call_list_items',
  'daily_garage_board_entries',
  'daily_summaries',
  'booking_billing',
  'billing_line_items',
  'garage_settlements',
  'garage_payments',
  'profiles',
] as const;

// Order of restoration honoring foreign key dependencies
const RESTORE_ORDER = [
  'profiles',
  'garages',
  'car_brands',
  'car_models',
  'leads',
  'booking_history',
  'activity_history',
  'call_list_items',
  'daily_garage_board_entries',
  'daily_summaries',
  'booking_billing',
  'billing_line_items',
  'garage_payments',
  'garage_settlements',
] as const;

const LOCAL_STORAGE_KEYS = [
  'mechhelp_crm_leads',
  'mechhelp_crm_call_list',
  'mechhelp_salesperson_fallback',
  'mechhelp_fuel_type_fallback',
  'mechhelp_custom_year_fallback',
  'mechhelp_feedback_fallback',
  'mechhelp_retarget_fallback',
  'mechhelp_details_shared_fallback',
  'mechhelp_service_type_fallback',
];

/**
 * Generates an IST timestamp formatted filename: mechhelp_backup_DD-MM-YYYY_HH-mm-ssam/pm.sql
 */
function getFormattedBackupFilename(): string {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffset);
  const pad = (n: number) => String(n).padStart(2, '0');

  const yyyy = istDate.getUTCFullYear();
  const mm = pad(istDate.getUTCMonth() + 1);
  const dd = pad(istDate.getUTCDate());

  const rawHours = istDate.getUTCHours();
  const ampm = rawHours >= 12 ? 'pm' : 'am';
  const hours12 = rawHours % 12 || 12;
  const hh = pad(hours12);
  const min = pad(istDate.getUTCMinutes());
  const ss = pad(istDate.getUTCSeconds());

  return `mechhelp_backup_${dd}-${mm}-${yyyy}_${hh}-${min}-${ss}${ampm}.sql`;
}

/**
 * Formats values into standard PostgreSQL COPY format:
 * - \N for null/undefined
 * - t / f for boolean
 * - Escaped tab (\t), newline (\n), carriage return (\r), backslash (\\)
 */
function formatSqlDumpValue(val: any): string {
  if (val === null || val === undefined) return '\\N';
  if (typeof val === 'boolean') return val ? 't' : 'f';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    if (Array.isArray(val)) {
      const escaped = val.map(v => '"' + String(v).replace(/"/g, '\\"') + '"').join(',');
      return '{' + escaped + '}';
    }
    return JSON.stringify(val)
      .replace(/\\/g, '\\\\')
      .replace(/\t/g, '\\t')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');
  }
  return String(val)
    .replace(/\\/g, '\\\\')
    .replace(/\t/g, '\\t')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

/**
 * Generates a standard PostgreSQL SQL dump with COPY statements
 * matching pg_dump --data-only --schema=public output.
 */
function generatePostgresSqlDump(
  tableData: Record<string, any[]>,
  metadata: Record<string, any>,
  localFallbacks: Record<string, any>
): string {
  let sql = `--
-- PostgreSQL database dump (MechHelp CRM)
-- Exported on: ${metadata.exportedAtIST || new Date().toISOString()}
-- Database: postgres.odwsohmlwukrkacvqfso
--

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET row_security = off;

`;

  for (const tableName of RESTORE_ORDER) {
    const rows = tableData[tableName] || [];
    if (!rows || rows.length === 0) continue;

    // Collect all column names across rows
    const colSet = new Set<string>();
    rows.forEach(r => Object.keys(r).forEach(k => colSet.add(k)));
    const columns = Array.from(colSet);

    sql += `--\n-- Data for Name: ${tableName}; Type: TABLE DATA; Schema: public\n--\n\n`;
    sql += `COPY public.${tableName} (${columns.map(c => `"${c}"`).join(', ')}) FROM stdin;\n`;

    for (const row of rows) {
      const line = columns.map(col => formatSqlDumpValue(row[col])).join('\t');
      sql += `${line}\n`;
    }

    sql += `\\.\n\n`;
  }

  // Embed local fallback metadata as a safe SQL comment at the end
  sql += `--\n-- MECHHELP_CRM_FALLBACK_METADATA_START\n`;
  sql += `-- ${JSON.stringify({ metadata, localFallbacks })}\n`;
  sql += `-- MECHHELP_CRM_FALLBACK_METADATA_END\n`;

  return sql;
}

/**
 * Downloads a complete PostgreSQL .sql data dump (matching pg_dump).
 */
export async function downloadDatabaseBackup(
  onProgress?: (status: string) => void
): Promise<BackupResult> {
  try {
    const tableData: Record<string, any[]> = {};
    const tableCounts: Record<string, number> = {};
    let totalRecords = 0;

    for (let i = 0; i < BACKUP_TABLES.length; i++) {
      const table = BACKUP_TABLES[i];
      onProgress?.(`Extracting ${table} (${i + 1}/${BACKUP_TABLES.length})...`);

      try {
        const rows = await fetchAllSupabaseRows(async (from, to) => {
          return await supabase.from(table).select('*').range(from, to);
        });
        tableData[table] = rows || [];
        tableCounts[table] = (rows || []).length;
        totalRecords += (rows || []).length;
      } catch (tableErr) {
        console.warn(`Could not export table ${table}:`, tableErr);
        tableData[table] = [];
        tableCounts[table] = 0;
      }
    }

    // Capture local storage fallbacks to prevent any data loss
    const localFallbacks: Record<string, any> = {};
    for (const key of LOCAL_STORAGE_KEYS) {
      const val = localStorage.getItem(key);
      if (val) {
        try {
          localFallbacks[key] = JSON.parse(val);
        } catch {
          localFallbacks[key] = val;
        }
      }
    }

    onProgress?.('Generating SQL dump file...');

    const metadata = {
      appName: 'MechHelp CRM',
      exportedAtUTC: new Date().toISOString(),
      exportedAtIST: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      version: '1.0',
      totalRecords,
      tableCounts,
    };

    const sqlContent = generatePostgresSqlDump(tableData, metadata, localFallbacks);
    const blob = new Blob([sqlContent], { type: 'application/sql;charset=utf-8' });
    const filename = getFormattedBackupFilename();
    const sizeKb = (blob.size / 1024).toFixed(1);

    // Trigger local download
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = url;
    downloadAnchor.download = filename;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
    URL.revokeObjectURL(url);

    return {
      success: true,
      totalRecords,
      filename,
      sizeKb,
    };
  } catch (error: any) {
    console.error('Database backup failed:', error);
    return {
      success: false,
      totalRecords: 0,
      filename: '',
      sizeKb: '0',
      error: error?.message || 'Failed to download database backup.',
    };
  }
}

/**
 * Parses a standard PostgreSQL SQL dump file (from pg_dump or our Backup button)
 */
function parseSqlDump(sql: string): { tables: Record<string, any[]>; metadata?: any } {
  const tables: Record<string, any[]> = {};
  const copyRegex = /COPY\s+public\.([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s*FROM\s*stdin;([\s\S]*?)\\\./g;
  let match: RegExpExecArray | null;

  while ((match = copyRegex.exec(sql)) !== null) {
    const tableName = match[1];
    const columns = match[2].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    const body = match[3].trim();
    if (!body) {
      tables[tableName] = [];
      continue;
    }

    const lines = body.split('\n');
    const rows: any[] = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      const parts = line.split('\t');
      const row: Record<string, any> = {};
      columns.forEach((col, idx) => {
        let val = parts[idx];
        if (val === undefined || val === '\\N') {
          row[col] = null;
        } else if (val === 't') {
          row[col] = true;
        } else if (val === 'f') {
          row[col] = false;
        } else {
          val = val.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\r/g, '\r').replace(/\\\\/g, '\\');
          if ((val.startsWith('{') && val.endsWith('}')) || (val.startsWith('[') && val.endsWith(']'))) {
            try {
              row[col] = JSON.parse(val);
            } catch {
              row[col] = val;
            }
          } else {
            row[col] = val;
          }
        }
      });
      rows.push(row);
    }
    tables[tableName] = rows;
  }

  // Check for embedded metadata comment
  let metadata: any = null;
  const metaMatch = /-- MECHHELP_CRM_FALLBACK_METADATA_START\s*\n-- (\{[\s\S]*?\})\s*\n-- MECHHELP_CRM_FALLBACK_METADATA_END/.exec(sql);
  if (metaMatch) {
    try {
      metadata = JSON.parse(metaMatch[1]);
    } catch {}
  }

  return { tables, metadata };
}

/**
 * Restores entire database from an uploaded .sql or .json backup file.
 */
export async function restoreDatabaseFromBackup(
  backupFile: File,
  onProgress?: (status: string) => void
): Promise<RestoreResult> {
  try {
    onProgress?.('Reading backup file...');
    const fileContent = await backupFile.text();

    let tables: Record<string, any[]> = {};
    let localFallbacks: Record<string, any> | undefined = undefined;

    if (backupFile.name.endsWith('.sql') || fileContent.includes('COPY public.')) {
      // Parse SQL dump
      const parsed = parseSqlDump(fileContent);
      tables = parsed.tables;
      localFallbacks = parsed.metadata?.localFallbacks;
    } else {
      // Parse JSON dump
      const backupData = JSON.parse(fileContent);
      if (!backupData || !backupData.tables || typeof backupData.tables !== 'object') {
        throw new Error('Invalid backup file format. Missing "tables" property.');
      }
      tables = backupData.tables;
      localFallbacks = backupData.localFallbacks;
    }

    const tableCounts: Record<string, number> = {};
    let totalRestored = 0;
    const chunkSize = 100;

    for (let t = 0; t < RESTORE_ORDER.length; t++) {
      const tableName = RESTORE_ORDER[t];
      const rows: any[] = tables[tableName] || [];

      if (!Array.isArray(rows) || rows.length === 0) {
        tableCounts[tableName] = 0;
        continue;
      }

      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        onProgress?.(
          `Restoring ${tableName} (${Math.min(i + chunkSize, rows.length)}/${rows.length})...`
        );

        const { error } = await supabase
          .from(tableName)
          .upsert(chunk, { onConflict: 'id' });

        if (error) {
          console.error(`Error restoring chunk for ${tableName}:`, error);
          throw new Error(`Failed to restore table "${tableName}": ${error.message}`);
        }
      }

      tableCounts[tableName] = rows.length;
      totalRestored += rows.length;
    }

    // Restore local storage fallbacks if present
    if (localFallbacks && typeof localFallbacks === 'object') {
      onProgress?.('Restoring local preferences & notes...');
      for (const [key, value] of Object.entries(localFallbacks)) {
        if (value !== undefined && value !== null) {
          localStorage.setItem(
            key,
            typeof value === 'string' ? value : JSON.stringify(value)
          );
        }
      }
    }

    return {
      success: true,
      totalRestored,
      tableCounts,
    };
  } catch (error: any) {
    console.error('Database restore failed:', error);
    return {
      success: false,
      totalRestored: 0,
      tableCounts: {},
      error: error?.message || 'Failed to restore database from backup file.',
    };
  }
}
