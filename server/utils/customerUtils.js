import { safeTrim } from './validation.js';

/**
 * Returns current date in Asia/Bangkok timezone in YYYY-MM-DD format.
 */
export function getTodayBangkokDateString() {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  } catch {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

/**
 * Normalizes a target date / move-in date string into YYYY-MM-DD format if possible.
 * If cannot be parsed into a calendar date, returns empty string or trimmed string if YYYY-MM-DD.
 */
export function normalizeTargetDate(val) {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (!str) return '';

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // DD-MM-YYYY
  const dmyDashMatch = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmyDashMatch) {
    const [, d, m, y] = dmyDashMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // DD/MM (assume current year)
  const dmMatch = str.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (dmMatch) {
    const [, d, m] = dmMatch;
    const year = new Date().getFullYear();
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  return '';
}

/**
 * Calculates integer days between current date (Asia/Bangkok or local YYYY-MM-DD) and target_date.
 * Positive integer = target_date is in future (e.g., +5 means 5 days from now).
 * 0 = target_date is today.
 * Negative integer = target_date is in past (e.g., -2 means 2 days ago).
 * Returns null if target_date is empty, not provided, or not a valid YYYY-MM-DD string.
 */
export function calculateDaysUntilTarget(targetDateStr, todayStr = null) {
  if (!targetDateStr || typeof targetDateStr !== 'string') return null;
  const trimmed = targetDateStr.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;

  const today = todayStr || getTodayBangkokDateString();
  const [tY, tM, tD] = trimmed.split('-').map(Number);
  const [cY, cM, cD] = today.split('-').map(Number);

  if (!Number.isFinite(tY) || !Number.isFinite(tM) || !Number.isFinite(tD)) return null;
  if (!Number.isFinite(cY) || !Number.isFinite(cM) || !Number.isFinite(cD)) return null;

  const targetUtc = Date.UTC(tY, tM - 1, tD);
  const currentUtc = Date.UTC(cY, cM - 1, cD);

  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  return Math.round((targetUtc - currentUtc) / MS_PER_DAY);
}

/**
 * Enriches a customer object with:
 * - days_until_target: integer days between current date and target_date (or null)
 * - is_urgent: boolean (true if urgency === 'gap')
 * - needs_followup_reminder: boolean (true if status != 'da_chot' and status != 'huy' and target_date is set and days_until_target is between -7 and 30)
 */
export function enrichCustomer(customer, todayStr = null) {
  if (!customer) return customer;

  const targetDate = customer.target_date ? String(customer.target_date).trim() : '';
  const daysUntilTarget = calculateDaysUntilTarget(targetDate, todayStr);
  const isUrgent = customer.urgency === 'gap';

  const status = customer.status || 'chua_cham';
  const hasTargetDate = Boolean(targetDate && daysUntilTarget !== null);

  const needsFollowupReminder = Boolean(
    status !== 'da_chot' &&
      status !== 'da_thue' &&
      status !== 'huy' &&
      hasTargetDate &&
      daysUntilTarget >= -7 &&
      daysUntilTarget <= 30
  );

  return {
    ...customer,
    urgency: customer.urgency || 'binh_thuong',
    target_date: targetDate,
    source: customer.source || 'manual',
    days_until_target: daysUntilTarget,
    is_urgent: isUrgent,
    needs_followup_reminder: needsFollowupReminder,
  };
}
