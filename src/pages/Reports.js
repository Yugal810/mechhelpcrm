import React, { useState, useEffect, useMemo } from 'react';
import { useLeadContext } from '../store/LeadContext.js';
import {
  TrendingUp,
  PieChart as PieChartIcon,
  Clock,
  RotateCcw,
  Target,
  DollarSign,
  Building2,
  Filter,
  ChevronDown,
  ChevronUp,
  Timer,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import './Reports.css';

// Chart Color Palette aligned with theme CSS variables
const COLORS = {
  blue: '#2563eb',
  green: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  purple: '#8b5cf6',
  teal: '#14b8a6',
  indigo: '#6366f1',
  pink: '#ec4899',
  gray: '#6b7280',
};

const PIE_COLORS = [
  COLORS.blue,
  COLORS.green,
  COLORS.warning,
  COLORS.purple,
  COLORS.teal,
  COLORS.danger,
  COLORS.indigo,
  COLORS.pink,
];



export const Reports = () => {
  const { leads, getAllSettlements, getHistorySettlements, getGaragesWithBalances } = useLeadContext();

  // Data states
  const [allSettlementsList, setAllSettlementsList] = useState([]);
  const [historySettlementsList, setHistorySettlementsList] = useState([]);
  const [garagesList, setGaragesList] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // Global Date Filter State
  const [preset, setPreset] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Garage Performance Sort State
  const [sortField, setSortField] = useState('revenue');
  const [sortAsc, setSortAsc] = useState(false);

  // Load backend / context data
  useEffect(() => {
    let isMounted = true;
    const loadAllReportData = async () => {
      try {
        setLoadingData(true);
        const [settlementsRes, historyRes, garagesRes] = await Promise.all([
          getAllSettlements(),
          getHistorySettlements(),
          getGaragesWithBalances(),
        ]);
        if (isMounted) {
          setAllSettlementsList(settlementsRes.settlements || []);
          setHistorySettlementsList(historyRes || []);
          setGaragesList(garagesRes || []);
        }
      } catch (err) {
        console.error('Error loading data for reports:', err);
      } finally {
        if (isMounted) setLoadingData(false);
      }
    };

    loadAllReportData();
    return () => { isMounted = false; };
  }, [getAllSettlements, getHistorySettlements, getGaragesWithBalances]);

  // Combine active & archived settlements for complete reporting
  const combinedSettlements = useMemo(() => {
    const map = new Map();
    allSettlementsList.forEach(s => map.set(s.id, s));
    historySettlementsList.forEach(s => map.set(s.id, s));
    return Array.from(map.values());
  }, [allSettlementsList, historySettlementsList]);

  // Effective Date Range Calculator
  const dateBounds = useMemo(() => {
    const now = new Date();
    if (preset === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      return { start, end };
    }
    if (preset === 'last_3_months') {
      const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      const end = new Date();
      return { start, end };
    }
    if (preset === 'last_6_months') {
      const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const end = new Date();
      return { start, end };
    }
    if (preset === 'custom' && (customStartDate || customEndDate)) {
      const start = customStartDate ? new Date(`${customStartDate}T00:00:00`) : new Date(0);
      const end = customEndDate ? new Date(`${customEndDate}T23:59:59`) : new Date();
      return { start, end };
    }
    return { start: null, end: null }; // All Time
  }, [preset, customStartDate, customEndDate]);

  // Helper to check if ISO date string falls within selected date bounds
  const isDateInBounds = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    if (dateBounds.start && d < dateBounds.start) return false;
    if (dateBounds.end && d > dateBounds.end) return false;
    return true;
  };

  // ── 1. Lead-to-Booking Conversion Data ───────────────────────────────────────
  const filteredLeads = useMemo(() => {
    if (!dateBounds.start && !dateBounds.end) return leads;
    return leads.filter(l => isDateInBounds(l.createdDate));
  }, [leads, dateBounds]);

  const leadConversionStats = useMemo(() => {
    const totalLeads = filteredLeads.length;
    const convertedLeads = filteredLeads.filter(l =>
      l.leadType === 'Booked' || l.leadType === 'Completed' || !!l.bookingDateTime
    );
    const completedLeads = filteredLeads.filter(l => l.leadType === 'Completed');
    const conversionRate = totalLeads > 0 ? (convertedLeads.length / totalLeads) * 100 : 0;

    // Stage Funnel Breakdown
    const stageCounts = {
      'Fresh Lead': 0,
      'Details Shared': 0,
      'Shared Quotation': 0,
      'Booked': 0,
      'Completed': 0,
      'Lost': 0,
    };

    filteredLeads.forEach(l => {
      const stage = l.leadType;
      if (stageCounts[stage] !== undefined) {
        stageCounts[stage]++;
      } else if (stage === 'Call Not Received' || stage === 'Retarget') {
        stageCounts['Fresh Lead']++;
      } else {
        stageCounts['Lost']++;
      }
    });

    const funnel = [
      { name: 'Fresh Leads', count: stageCounts['Fresh Lead'], color: COLORS.blue },
      { name: 'Details Shared', count: stageCounts['Details Shared'], color: COLORS.indigo },
      { name: 'Shared Quotation', count: stageCounts['Shared Quotation'], color: COLORS.warning },
      { name: 'Booked', count: stageCounts['Booked'], color: COLORS.purple },
      { name: 'Completed', count: stageCounts['Completed'], color: COLORS.green },
      { name: 'Lost / Cancelled', count: stageCounts['Lost'], color: COLORS.danger },
    ];

    // Month-over-Month Trend
    const monthlyMap = new Map();
    filteredLeads.forEach(l => {
      if (!l.createdDate) return;
      const d = new Date(l.createdDate);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      if (!monthlyMap.has(key)) {
        monthlyMap.set(key, { month: label, total: 0, converted: 0 });
      }
      const item = monthlyMap.get(key);
      item.total++;
      if (l.leadType === 'Booked' || l.leadType === 'Completed' || !!l.bookingDateTime) {
        item.converted++;
      }
    });

    const monthlyTrend = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([_, val]) => ({
        month: val.month,
        TotalLeads: val.total,
        ConvertedBookings: val.converted,
        ConversionRate: Math.round((val.converted / (val.total || 1)) * 100 * 10) / 10,
      }));

    return {
      totalLeads,
      convertedCount: convertedLeads.length,
      completedCount: completedLeads.length,
      conversionRate: Math.round(conversionRate * 10) / 10,
      funnel,
      monthlyTrend,
    };
  }, [filteredLeads]);

  // ── 2. Booking Reschedule Rate Data ──────────────────────────────────────────
  const filteredBookings = useMemo(() => {
    return leads.filter(l => {
      if (!l.bookingDateTime) return false;
      if (!dateBounds.start && !dateBounds.end) return true;
      return isDateInBounds(l.bookingDateTime);
    });
  }, [leads, dateBounds]);

  const rescheduleStats = useMemo(() => {
    const totalBookings = filteredBookings.length;
    const rescheduledCount = filteredBookings.filter(l => (l.bookingHistory?.length || 0) > 0).length;
    const rescheduleRate = totalBookings > 0 ? (rescheduledCount / totalBookings) * 100 : 0;

    // Monthly Trend
    const monthlyMap = new Map();
    filteredBookings.forEach(l => {
      if (!l.bookingDateTime) return;
      const d = new Date(l.bookingDateTime);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      if (!monthlyMap.has(key)) {
        monthlyMap.set(key, { month: label, total: 0, rescheduled: 0 });
      }
      const item = monthlyMap.get(key);
      item.total++;
      if ((l.bookingHistory?.length || 0) > 0) item.rescheduled++;
    });

    const monthlyTrend = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([_, val]) => ({
        month: val.month,
        TotalBookings: val.total,
        RescheduledBookings: val.rescheduled,
        RescheduleRate: Math.round((val.rescheduled / (val.total || 1)) * 100 * 10) / 10,
      }));

    return {
      totalBookings,
      rescheduledCount,
      rescheduleRate: Math.round(rescheduleRate * 10) / 10,
      monthlyTrend,
    };
  }, [filteredBookings]);

  // ── 3. Revenue Trend Data ───────────────────────────────────────────────────
  const filteredSettlements = useMemo(() => {
    return combinedSettlements.filter(s => {
      const dateStr = s.createdAt || s.bookingDate;
      if (!dateBounds.start && !dateBounds.end) return true;
      return isDateInBounds(dateStr);
    });
  }, [combinedSettlements, dateBounds]);

  const revenueStats = useMemo(() => {
    let totalCustomerBilled = 0;
    let totalMechhelpEarned = 0;
    let totalGaragePaid = 0;
    let totalDiscountBorne = 0;

    const monthlyMap = new Map();

    filteredSettlements.forEach(s => {
      const billing = s.billing;
      if (!billing) return;

      const billedAmount = Number(billing.totalAmount) || 0;
      const discount = Number(billing.discount || 0);

      let mechhelpShare = 0;
      let garageShare = 0;

      const lineItems = billing.lineItems || [];
      lineItems.forEach((item) => {
        const amt = Number(item.amount) || 0;
        if (item.splitEnabled) {
          const mhPct = Number(item.mechhelpPct) ?? 20;
          const gPct = Number(item.garagePct) ?? 80;
          mechhelpShare += amt * (mhPct / 100);
          garageShare += amt * (gPct / 100);
        } else {
          garageShare += amt;
        }
      });

      // Discount is absorbed by MechHelp
      mechhelpShare -= discount;

      totalCustomerBilled += billedAmount;
      totalMechhelpEarned += mechhelpShare;
      totalGaragePaid += garageShare;
      totalDiscountBorne += discount;

      const d = new Date(s.createdAt || s.bookingDate);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

      if (!monthlyMap.has(key)) {
        monthlyMap.set(key, { month: label, customerBilled: 0, mechhelpEarned: 0, garagePaid: 0, discount: 0 });
      }
      const item = monthlyMap.get(key);
      item.customerBilled += billedAmount;
      item.mechhelpEarned += mechhelpShare;
      item.garagePaid += garageShare;
      item.discount += discount;
    });

    const monthlyTrend = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([_, val]) => ({
        month: val.month,
        CustomerBilled: Math.round(val.customerBilled),
        MechHelpShare: Math.round(val.mechhelpEarned),
        GarageShare: Math.round(val.garagePaid),
        Discount: Math.round(val.discount),
      }));

    return {
      totalCustomerBilled: Math.round(totalCustomerBilled),
      totalMechhelpEarned: Math.round(totalMechhelpEarned),
      totalGaragePaid: Math.round(totalGaragePaid),
      totalDiscountBorne: Math.round(totalDiscountBorne),
      monthlyTrend,
    };
  }, [filteredSettlements]);

  // ── 4. Garage-wise Performance Data ───────────────────────────────────────
  const garagePerformanceData = useMemo(() => {
    const map = new Map();

    // Pre-populate with active garages
    garagesList.forEach(g => {
      map.set(g.id, { id: g.id, name: g.name, bookingsCount: 0, revenue: 0, mechhelpShare: 0, garageShare: 0 });
    });

    filteredSettlements.forEach(s => {
      const gId = s.garageId;
      const gName = s.garageName || 'Partner Garage';
      if (!map.has(gId)) {
        map.set(gId, { id: gId, name: gName, bookingsCount: 0, revenue: 0, mechhelpShare: 0, garageShare: 0 });
      }
      const entry = map.get(gId);
      entry.bookingsCount++;

      const billing = s.billing;
      if (billing) {
        const billed = Number(billing.totalAmount) || 0;
        const disc = Number(billing.discount || 0);
        entry.revenue += billed;

        let mhShare = 0;
        let gShare = 0;
        (billing.lineItems || []).forEach((item) => {
          const amt = Number(item.amount) || 0;
          if (item.splitEnabled) {
            mhShare += amt * ((Number(item.mechhelpPct) ?? 20) / 100);
            gShare += amt * ((Number(item.garagePct) ?? 80) / 100);
          } else {
            gShare += amt;
          }
        });
        mhShare -= disc;
        entry.mechhelpShare += mhShare;
        entry.garageShare += gShare;
      }
    });

    const list = Array.from(map.values()).map(item => ({
      ...item,
      bookings: item.bookingsCount,
      revenue: Math.round(item.revenue),
      mechhelpShare: Math.round(item.mechhelpShare),
      garageShare: Math.round(item.garageShare),
    }));

    list.sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      return sortAsc ? valA - valB : valB - valA;
    });

    return list;
  }, [garagesList, filteredSettlements, sortField, sortAsc]);

  // ── 5. Lead Source Breakdown Data ──────────────────────────────────────────
  const leadSourceStats = useMemo(() => {
    const countsMap = new Map();

    filteredLeads.forEach(l => {
      const src = l.leadSource || 'Other';
      if (!countsMap.has(src)) {
        countsMap.set(src, { source: src, total: 0, booked: 0 });
      }
      const entry = countsMap.get(src);
      entry.total++;
      if (l.leadType === 'Booked' || l.leadType === 'Completed' || !!l.bookingDateTime) {
        entry.booked++;
      }
    });

    const chartData = Array.from(countsMap.values()).map((val, idx) => ({
      name: val.source,
      value: val.total,
      booked: val.booked,
      conversionRate: Math.round((val.booked / (val.total || 1)) * 100 * 10) / 10,
      color: PIE_COLORS[idx % PIE_COLORS.length],
    }));

    chartData.sort((a, b) => b.value - a.value);

    return chartData;
  }, [filteredLeads]);

  // ── 6. Time-to-Completion Data ─────────────────────────────────────────────
  const completionTimeStats = useMemo(() => {
    const completedLeads = filteredLeads.filter(l => l.leadType === 'Completed');
    let totalDays = 0;
    let validCount = 0;

    const monthlyMap = new Map();

    completedLeads.forEach(l => {
      const startStr = l.bookingDateTime || l.createdDate;
      const endStr = l.detailsSharedAt || l.lastContactedDate || l.createdDate; // fallback timestamp
      if (!startStr) return;

      const startDate = new Date(startStr);
      const endDate = new Date(endStr);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return;

      const diffMs = Math.max(0, endDate.getTime() - startDate.getTime());
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      totalDays += diffDays;
      validCount++;

      const key = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
      const label = startDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

      if (!monthlyMap.has(key)) {
        monthlyMap.set(key, { month: label, totalDays: 0, count: 0 });
      }
      const item = monthlyMap.get(key);
      item.totalDays += diffDays;
      item.count++;
    });

    const avgDays = validCount > 0 ? totalDays / validCount : 0;

    const monthlyTrend = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([_, val]) => ({
        month: val.month,
        AvgDays: Math.round((val.totalDays / (val.count || 1)) * 10) / 10,
        CompletedCount: val.count,
      }));

    return {
      avgDays: Math.round(avgDays * 10) / 10,
      completedCount: validCount,
      monthlyTrend,
    };
  }, [filteredLeads]);

  // ── 7. Retarget Effectiveness Data ──────────────────────────────────────────
  const retargetStats = useMemo(() => {
    const retargetLeads = filteredLeads.filter(l => l.leadType === 'Retarget' || l.retargetTimeSlot != null);
    const totalRetarget = retargetLeads.length;

    const convertedRetarget = retargetLeads.filter(l => l.leadType === 'Booked' || l.leadType === 'Completed' || !!l.bookingDateTime).length;
    const pendingRetarget = retargetLeads.filter(l => l.leadType === 'Retarget').length;
    const lostRetarget = retargetLeads.filter(l => l.leadType === 'Lost').length;

    const conversionRate = totalRetarget > 0 ? (convertedRetarget / totalRetarget) * 100 : 0;

    // Split by Morning vs Evening slot
    const morningLeads = retargetLeads.filter(l => l.retargetTimeSlot === 'morning');
    const eveningLeads = retargetLeads.filter(l => l.retargetTimeSlot === 'evening');

    const morningConverted = morningLeads.filter(l => l.leadType === 'Booked' || l.leadType === 'Completed' || !!l.bookingDateTime).length;
    const eveningConverted = eveningLeads.filter(l => l.leadType === 'Booked' || l.leadType === 'Completed' || !!l.bookingDateTime).length;

    const morningRate = morningLeads.length > 0 ? (morningConverted / morningLeads.length) * 100 : 0;
    const eveningRate = eveningLeads.length > 0 ? (eveningConverted / eveningLeads.length) * 100 : 0;

    const slotComparison = [
      {
        slot: 'Morning Slot',
        Total: morningLeads.length,
        Converted: morningConverted,
        ConversionRate: Math.round(morningRate * 10) / 10,
      },
      {
        slot: 'Evening Slot',
        Total: eveningLeads.length,
        Converted: eveningConverted,
        ConversionRate: Math.round(eveningRate * 10) / 10,
      },
    ];

    return {
      totalRetarget,
      convertedRetarget,
      pendingRetarget,
      lostRetarget,
      conversionRate: Math.round(conversionRate * 10) / 10,
      slotComparison,
    };
  }, [filteredLeads]);

  // ── 8. Conversion Time Distribution Data ────────────────────────────────────
  const conversionTimeStats = useMemo(() => {
    // Build a map: leadId -> earliest settlement createdAt (the "Completed at" timestamp)
    // combinedSettlements already contains all active + archived settlements
    const settlementCompletionMap = new Map();
    combinedSettlements.forEach(s => {
      const lid = s.leadId;
      const ts = s.createdAt;
      if (!lid || !ts) return;
      // Keep the earliest completion record if somehow duplicated
      if (!settlementCompletionMap.has(lid)) {
        settlementCompletionMap.set(lid, ts);
      } else {
        const existing = new Date(settlementCompletionMap.get(lid));
        const incoming = new Date(ts);
        if (incoming < existing) settlementCompletionMap.set(lid, ts);
      }
    });

    // Only completed leads that have a matching settlement (accurate completion timestamp)
    const completedLeads = filteredLeads.filter(
      l => l.leadType === 'Completed' && settlementCompletionMap.has(l.id)
    );

    if (completedLeads.length === 0) {
      return {
        count: 0,
        median: 0,
        mean: 0,
        min: 0,
        max: 0,
        minLeadName: '',
        maxLeadName: '',
        buckets: [
          { label: '≤1 Week', count: 0, range: '0–7 days' },
          { label: '1–2 Weeks', count: 0, range: '7–14 days' },
          { label: '2–4 Weeks', count: 0, range: '14–28 days' },
          { label: '1–2 Months', count: 0, range: '28–60 days' },
          { label: '2–3 Months', count: 0, range: '60–90 days' },
          { label: '3+ Months', count: 0, range: '90+ days' },
        ],
        monthlyTrend: [],
      };
    }

    // Compute days-to-complete for each lead
    const allDays = [];

    completedLeads.forEach(l => {
      const startStr = l.createdDate;
      const endStr = settlementCompletionMap.get(l.id);
      if (!startStr || !endStr) return;
      const start = new Date(startStr);
      const end = new Date(endStr);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return;
      const days = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      allDays.push({ days, name: l.customerName, createdDate: startStr });
    });

    if (allDays.length === 0) {
      return {
        count: 0, median: 0, mean: 0, min: 0, max: 0,
        minLeadName: '', maxLeadName: '',
        buckets: [
          { label: '≤1 Week', count: 0, range: '0–7 days' },
          { label: '1–2 Weeks', count: 0, range: '7–14 days' },
          { label: '2–4 Weeks', count: 0, range: '14–28 days' },
          { label: '1–2 Months', count: 0, range: '28–60 days' },
          { label: '2–3 Months', count: 0, range: '60–90 days' },
          { label: '3+ Months', count: 0, range: '90+ days' },
        ],
        monthlyTrend: [],
      };
    }

    // Sort by days ascending for median/min/max
    const sorted = [...allDays].sort((a, b) => a.days - b.days);
    const n = sorted.length;
    const median = n % 2 === 0
      ? (sorted[n / 2 - 1].days + sorted[n / 2].days) / 2
      : sorted[Math.floor(n / 2)].days;
    const mean = allDays.reduce((s, d) => s + d.days, 0) / n;
    const minEntry = sorted[0];
    const maxEntry = sorted[n - 1];

    // Bucket boundaries: [0,7), [7,14), [14,28), [28,60), [60,90), [90,+inf)
    const buckets = [
      { label: '≤1 Week',    range: '0–7 days',    count: 0 },
      { label: '1–2 Weeks',  range: '7–14 days',   count: 0 },
      { label: '2–4 Weeks',  range: '14–28 days',  count: 0 },
      { label: '1–2 Months', range: '28–60 days',  count: 0 },
      { label: '2–3 Months', range: '60–90 days',  count: 0 },
      { label: '3+ Months',  range: '90+ days',    count: 0 },
    ];

    allDays.forEach(({ days }) => {
      if (days < 7)        buckets[0].count++;
      else if (days < 14)  buckets[1].count++;
      else if (days < 28)  buckets[2].count++;
      else if (days < 60)  buckets[3].count++;
      else if (days < 90)  buckets[4].count++;
      else                 buckets[5].count++;
    });

    // Monthly trend: group by creation month, compute median days per month
    const monthlyMap = new Map();
    allDays.forEach(({ days, createdDate }) => {
      const d = new Date(createdDate);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      if (!monthlyMap.has(key)) monthlyMap.set(key, { month: label, days: [] });
      monthlyMap.get(key).days.push(days);
    });

    const monthlyTrend = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([_, val]) => {
        const s = [...val.days].sort((a, b) => a - b);
        const nm = s.length;
        const med = nm % 2 === 0
          ? (s[nm / 2 - 1] + s[nm / 2]) / 2
          : s[Math.floor(nm / 2)];
        return {
          month: val.month,
          MedianDays: Math.round(med * 10) / 10,
          Count: nm,
        };
      });

    return {
      count: n,
      median: Math.round(median * 10) / 10,
      mean: Math.round(mean * 10) / 10,
      min: Math.round(minEntry.days * 10) / 10,
      max: Math.round(maxEntry.days * 10) / 10,
      minLeadName: minEntry.name,
      maxLeadName: maxEntry.name,
      buckets,
      monthlyTrend,
    };
  }, [filteredLeads, combinedSettlements]);

  // Handler for table sorting
  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(prev => !prev);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="reports-page animate-fade-in">
      {/* ── Page Header ───────────────────────────────────────────────────── */}
      <div className="reports-header">
        <div className="reports-header-title">
          <h1>Analytics & Reports</h1>
          <p>Read-only performance insights, conversion metrics, and financial breakdown</p>
        </div>
      </div>

      {/* ── Global Date Filter Selector ───────────────────────────────────── */}
      <div className="reports-filter-bar surface-panel">
        <div className="reports-filter-label">
          <Filter size={15} /> Date Scope:
        </div>

        <button
          type="button"
          className={`reports-preset-btn ${preset === 'all' ? 'active' : ''}`}
          onClick={() => setPreset('all')}
        >
          All Time
        </button>
        <button
          type="button"
          className={`reports-preset-btn ${preset === 'this_month' ? 'active' : ''}`}
          onClick={() => setPreset('this_month')}
        >
          This Month
        </button>
        <button
          type="button"
          className={`reports-preset-btn ${preset === 'last_3_months' ? 'active' : ''}`}
          onClick={() => setPreset('last_3_months')}
        >
          Last 3 Months
        </button>
        <button
          type="button"
          className={`reports-preset-btn ${preset === 'last_6_months' ? 'active' : ''}`}
          onClick={() => setPreset('last_6_months')}
        >
          Last 6 Months
        </button>
        <button
          type="button"
          className={`reports-preset-btn ${preset === 'custom' ? 'active' : ''}`}
          onClick={() => setPreset('custom')}
        >
          Custom Range
        </button>

        {preset === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
            <input
              type="date"
              className="form-input"
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem', width: 'auto' }}
              value={customStartDate}
              onChange={e => setCustomStartDate(e.target.value)}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>to</span>
            <input
              type="date"
              className="form-input"
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem', width: 'auto' }}
              value={customEndDate}
              onChange={e => setCustomEndDate(e.target.value)}
            />
          </div>
        )}
      </div>

      {loadingData ? (
        <div style={{ textAlign: 'center', padding: '4rem' }}>
          <p style={{ color: 'var(--text-muted)' }}>Calculating metrics and generating charts...</p>
        </div>
      ) : (
        <>
          {/* ── Summary KPI Top Cards ────────────────────────────────────── */}
          <div className="reports-kpi-grid">
            <div className="reports-kpi-card surface-panel">
              <div className="reports-kpi-header">
                <span className="reports-kpi-title">Lead Conversion</span>
                <div className="reports-kpi-icon"><TrendingUp size={18} /></div>
              </div>
              <div className="reports-kpi-value">{leadConversionStats.conversionRate}%</div>
              <div className="reports-kpi-subtitle">
                {leadConversionStats.convertedCount} of {leadConversionStats.totalLeads} leads converted
              </div>
            </div>

            <div className="reports-kpi-card surface-panel">
              <div className="reports-kpi-header">
                <span className="reports-kpi-title">Reschedule Rate</span>
                <div className="reports-kpi-icon" style={{ color: 'var(--warning)' }}><RotateCcw size={18} /></div>
              </div>
              <div className="reports-kpi-value">{rescheduleStats.rescheduleRate}%</div>
              <div className="reports-kpi-subtitle">
                {rescheduleStats.rescheduledCount} of {rescheduleStats.totalBookings} bookings rescheduled
              </div>
            </div>

            <div className="reports-kpi-card surface-panel">
              <div className="reports-kpi-header">
                <span className="reports-kpi-title">Total Customer Billed</span>
                <div className="reports-kpi-icon" style={{ color: 'var(--success)' }}><DollarSign size={18} /></div>
              </div>
              <div className="reports-kpi-value">₹{revenueStats.totalCustomerBilled.toLocaleString('en-IN')}</div>
              <div className="reports-kpi-subtitle">
                MechHelp: ₹{revenueStats.totalMechhelpEarned.toLocaleString('en-IN')} | Garage: ₹{revenueStats.totalGaragePaid.toLocaleString('en-IN')}
              </div>
            </div>

            <div className="reports-kpi-card surface-panel">
              <div className="reports-kpi-header">
                <span className="reports-kpi-title">Avg Time to Complete</span>
                <div className="reports-kpi-icon" style={{ color: 'var(--info)' }}><Clock size={18} /></div>
              </div>
              <div className="reports-kpi-value">{completionTimeStats.avgDays} Days</div>
              <div className="reports-kpi-subtitle">
                Across {completionTimeStats.completedCount} completed bookings
              </div>
            </div>
          </div>

          {/* ── SECTION 1: Conversion Time Distribution ──────────────────── */}
          <div className="reports-section surface-panel">
            <div className="reports-section-header">
              <div className="reports-section-title">
                <Timer size={20} style={{ color: 'var(--teal)' }} />
                <h2>1. Conversion Time</h2>
              </div>
              <span className="reports-section-badge" style={{ color: 'var(--teal)' }}>
                {conversionTimeStats.count} completed leads · Median: {conversionTimeStats.median} days
              </span>
            </div>

            {conversionTimeStats.count === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                <Timer size={32} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                <p style={{ fontSize: '0.9rem' }}>No completed leads in the selected date window.</p>
                <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Try selecting "All Time" or a wider range.</p>
              </div>
            ) : (
              <>
                {/* ── Supporting stats row ── */}
                <div className="conversion-stats-grid">
                  <div className="conversion-stat-card">
                    <div className="conversion-stat-label">Median Conversion</div>
                    <div className="conversion-stat-value" style={{ color: 'var(--teal)' }}>
                      {conversionTimeStats.median} <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>days</span>
                    </div>
                    <div className="conversion-stat-sub">More robust than the mean for skewed data</div>
                  </div>

                  <div className="conversion-stat-card">
                    <div className="conversion-stat-label">Mean Conversion</div>
                    <div className="conversion-stat-value" style={{ color: 'var(--info)' }}>
                      {conversionTimeStats.mean} <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>days</span>
                    </div>
                    <div className="conversion-stat-sub">Average across {conversionTimeStats.count} completed leads</div>
                  </div>

                  <div className="conversion-stat-card">
                    <div className="conversion-stat-label">Fastest Conversion</div>
                    <div className="conversion-stat-value" style={{ color: 'var(--success)' }}>
                      {conversionTimeStats.min} <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>days</span>
                    </div>
                    <div className="conversion-stat-sub" title={conversionTimeStats.minLeadName}>
                      {conversionTimeStats.minLeadName
                        ? `${conversionTimeStats.minLeadName.split(' ')[0]}…`
                        : '—'}
                    </div>
                  </div>

                  <div className="conversion-stat-card">
                    <div className="conversion-stat-label">Slowest Conversion</div>
                    <div className="conversion-stat-value" style={{ color: 'var(--warning)' }}>
                      {conversionTimeStats.max} <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>days</span>
                    </div>
                    <div className="conversion-stat-sub" title={conversionTimeStats.maxLeadName}>
                      {conversionTimeStats.maxLeadName
                        ? `${conversionTimeStats.maxLeadName.split(' ')[0]}…`
                        : '—'}
                    </div>
                  </div>
                </div>

                {/* ── Two-column: histogram + trend ── */}
                <div className="reports-two-col" style={{ marginTop: '1.5rem' }}>
                  {/* Primary: Distribution Histogram */}
                  <div>
                    <h4 style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      Distribution — Leads by Conversion Time
                    </h4>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                      Each bar = number of leads that converted within that time window. Wide spread = two populations; narrow spike = consistent pipeline.
                    </p>
                    <div style={{ width: '100%', height: 280 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={conversionTimeStats.buckets} barCategoryGap="18%">
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                          <XAxis
                            dataKey="label"
                            stroke="var(--text-muted)"
                            fontSize={11}
                            tick={{ fill: 'var(--text-secondary)' }}
                          />
                          <YAxis
                            stroke="var(--text-muted)"
                            fontSize={12}
                            allowDecimals={false}
                            label={{ value: 'Leads', angle: -90, position: 'insideLeft', fill: 'var(--text-muted)', fontSize: 11 }}
                          />
                          <Tooltip
                            content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                const d = payload[0].payload;
                                return (
                                  <div className="custom-chart-tooltip">
                                    <p className="custom-chart-tooltip-label">{label}</p>
                                    <div className="custom-chart-tooltip-row">
                                      <span>Range:</span>
                                      <strong>{d.range}</strong>
                                    </div>
                                    <div className="custom-chart-tooltip-row" style={{ color: 'var(--teal)' }}>
                                      <span>Leads in bucket:</span>
                                      <strong>{d.count}</strong>
                                    </div>
                                    <div className="custom-chart-tooltip-row">
                                      <span>Share:</span>
                                      <strong>
                                        {conversionTimeStats.count > 0
                                          ? Math.round((d.count / conversionTimeStats.count) * 100)
                                          : 0}%
                                      </strong>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar dataKey="count" name="Leads" radius={[6, 6, 0, 0]}>
                            {conversionTimeStats.buckets.map((entry, index) => {
                              const maxCount = Math.max(...conversionTimeStats.buckets.map(b => b.count));
                              return (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={entry.count === maxCount && entry.count > 0 ? COLORS.teal : `${COLORS.teal}70`}
                                />
                              );
                            })}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Secondary: Median Trend by Month */}
                  <div>
                    <h4 style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      Trend — Median Conversion Time by Month
                    </h4>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                      Grouped by lead creation month. Falling line = leads are converting faster. Rising = pipeline slowing down.
                    </p>
                    {conversionTimeStats.monthlyTrend.length < 2 ? (
                      <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)', fontSize: '0.825rem' }}>
                        Trend requires at least 2 months of data. Widen the date range to see this chart.
                      </div>
                    ) : (
                      <div style={{ width: '100%', height: 280 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={conversionTimeStats.monthlyTrend}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                            <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} />
                            <YAxis stroke="var(--text-muted)" fontSize={12} unit="d" />
                            <Tooltip
                              content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                  const d = payload[0].payload;
                                  return (
                                    <div className="custom-chart-tooltip">
                                      <p className="custom-chart-tooltip-label">{label}</p>
                                      <div className="custom-chart-tooltip-row" style={{ color: COLORS.purple }}>
                                        <span>Median Days:</span>
                                        <strong>{d.MedianDays} days</strong>
                                      </div>
                                      <div className="custom-chart-tooltip-row">
                                        <span>Leads completed:</span>
                                        <strong>{d.Count}</strong>
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="MedianDays"
                              name="Median Days"
                              stroke={COLORS.purple}
                              strokeWidth={3}
                              dot={{ r: 5, fill: COLORS.purple }}
                              activeDot={{ r: 7 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Bucket detail footnote ── */}
                <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-tertiary)', fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                  <span><strong>Bucket ranges used:</strong></span>
                  {conversionTimeStats.buckets.map(b => (
                    <span key={b.label}>{b.label}: {b.range} ({b.count} leads)</span>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* ── SECTION 2: Lead-to-Booking Conversion ─────────────────────── */}
          <div className="reports-section surface-panel">
            <div className="reports-section-header">
              <div className="reports-section-title">
                <TrendingUp size={20} style={{ color: 'var(--vip)' }} />
                <h2>2. Lead-to-Booking Conversion</h2>
              </div>
              <span className="reports-section-badge">Overall Rate: {leadConversionStats.conversionRate}%</span>
            </div>

            <div className="reports-two-col">
              {/* MoM Conversion Rate Trend Chart */}
              <div>
                <h4 style={{ marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  Month-over-Month Conversion Trend (%)
                </h4>
                <div style={{ width: '100%', height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={leadConversionStats.monthlyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                      <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} />
                      <YAxis stroke="var(--text-muted)" fontSize={12} unit="%" />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="custom-chart-tooltip">
                                <p className="custom-chart-tooltip-label">{label}</p>
                                <div className="custom-chart-tooltip-row">
                                  <span>Total Leads:</span>
                                  <strong>{data.TotalLeads}</strong>
                                </div>
                                <div className="custom-chart-tooltip-row">
                                  <span>Booked / Converted:</span>
                                  <strong>{data.ConvertedBookings}</strong>
                                </div>
                                <div className="custom-chart-tooltip-row" style={{ color: 'var(--vip)' }}>
                                  <span>Conversion Rate:</span>
                                  <strong>{data.ConversionRate}%</strong>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="ConversionRate"
                        name="Conversion Rate %"
                        stroke={COLORS.purple}
                        strokeWidth={3}
                        dot={{ r: 4, fill: COLORS.purple }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Lead Stage Funnel Drop-off */}
              <div>
                <h4 style={{ marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  Current Lead Stage Funnel (Drop-off Visibility)
                </h4>
                <div className="funnel-container">
                  {leadConversionStats.funnel.map(item => {
                    const pct = leadConversionStats.totalLeads > 0
                      ? Math.round((item.count / leadConversionStats.totalLeads) * 100)
                      : 0;
                    return (
                      <div key={item.name} className="funnel-step">
                        <div className="funnel-label">{item.name}</div>
                        <div className="funnel-track">
                          <div
                            className="funnel-bar"
                            style={{ width: `${Math.max(5, pct)}%`, backgroundColor: item.color }}
                          >
                            {pct > 8 ? `${pct}%` : ''}
                          </div>
                        </div>
                        <div className="funnel-stats">
                          {item.count} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({pct}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* ── SECTION 2: Booking Reschedule Rate ───────────────────────── */}
          <div className="reports-section surface-panel">
            <div className="reports-section-header">
              <div className="reports-section-title">
                <RotateCcw size={20} style={{ color: 'var(--warning)' }} />
                <h2>3. Booking Reschedule Rate</h2>
              </div>
              <span className="reports-section-badge" style={{ color: 'var(--warning)' }}>
                Reschedule Rate: {rescheduleStats.rescheduleRate}%
              </span>
            </div>

            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={rescheduleStats.monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                  <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} unit="%" />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="custom-chart-tooltip">
                            <p className="custom-chart-tooltip-label">{label}</p>
                            <div className="custom-chart-tooltip-row">
                              <span>Total Bookings:</span>
                              <strong>{data.TotalBookings}</strong>
                            </div>
                            <div className="custom-chart-tooltip-row">
                              <span>Rescheduled Bookings:</span>
                              <strong>{data.RescheduledBookings}</strong>
                            </div>
                            <div className="custom-chart-tooltip-row" style={{ color: 'var(--warning)' }}>
                              <span>Reschedule Rate:</span>
                              <strong>{data.RescheduleRate}%</strong>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="RescheduleRate"
                    name="Reschedule Rate %"
                    stroke={COLORS.warning}
                    fill="rgba(245, 158, 11, 0.15)"
                    strokeWidth={2.5}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── SECTION 3: Revenue Trend & Financial Split ───────────────── */}
          <div className="reports-section surface-panel">
            <div className="reports-section-header">
              <div className="reports-section-title">
                <DollarSign size={20} style={{ color: 'var(--success)' }} />
                <h2>4. Revenue Trend & Financial Split</h2>
              </div>
              <span className="reports-section-badge" style={{ color: 'var(--success)' }}>
                Total Revenue Billed: ₹{revenueStats.totalCustomerBilled.toLocaleString('en-IN')}
              </span>
            </div>

            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueStats.monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                  <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={val => `₹${val / 1000}k`} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="custom-chart-tooltip">
                            <p className="custom-chart-tooltip-label">{label}</p>
                            <div className="custom-chart-tooltip-row">
                              <span>Customer Billed:</span>
                              <strong>₹{data.CustomerBilled.toLocaleString('en-IN')}</strong>
                            </div>
                            <div className="custom-chart-tooltip-row" style={{ color: COLORS.blue }}>
                              <span>MechHelp Earned:</span>
                              <strong>₹{data.MechHelpShare.toLocaleString('en-IN')}</strong>
                            </div>
                            <div className="custom-chart-tooltip-row" style={{ color: COLORS.green }}>
                              <span>Garage Paid:</span>
                              <strong>₹{data.GarageShare.toLocaleString('en-IN')}</strong>
                            </div>
                            {data.Discount > 0 && (
                              <div className="custom-chart-tooltip-row" style={{ color: COLORS.danger }}>
                                <span>Discount Borne:</span>
                                <strong>− ₹{data.Discount.toLocaleString('en-IN')}</strong>
                              </div>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  <Bar dataKey="MechHelpShare" name="MechHelp Net Share" fill={COLORS.blue} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="GarageShare" name="Garage Net Share" fill={COLORS.green} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── SECTION 4: Garage-wise Performance ──────────────────────── */}
          <div className="reports-section surface-panel">
            <div className="reports-section-header">
              <div className="reports-section-title">
                <Building2 size={20} style={{ color: 'var(--info)' }} />
                <h2>5. Garage-wise Performance</h2>
              </div>
              <span className="reports-section-badge">{garagePerformanceData.length} Partner Garages</span>
            </div>

            {/* Garage Performance Table */}
            <div className="reports-table-wrap">
              <table className="reports-table">
                <thead>
                  <tr>
                    <th>Garage Name</th>
                    <th onClick={() => handleSort('bookings')}>
                      Bookings Count {sortField === 'bookings' && (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                    </th>
                    <th onClick={() => handleSort('revenue')}>
                      Total Customer Revenue {sortField === 'revenue' && (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                    </th>
                    <th onClick={() => handleSort('mechhelpShare')}>
                      MechHelp Share {sortField === 'mechhelpShare' && (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                    </th>
                    <th onClick={() => handleSort('garageShare')}>
                      Garage Share {sortField === 'garageShare' && (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {garagePerformanceData.map(g => (
                    <tr key={g.id}>
                      <td><strong>{g.name}</strong></td>
                      <td>{g.bookingsCount}</td>
                      <td>₹{g.revenue.toLocaleString('en-IN')}</td>
                      <td style={{ color: 'var(--info)' }}>₹{g.mechhelpShare.toLocaleString('en-IN')}</td>
                      <td style={{ color: 'var(--success)' }}>₹{g.garageShare.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── SECTION 5 & 6: Lead Source & Completion Time ─────────────── */}
          <div className="reports-two-col">
            {/* SECTION 5: Lead Source Breakdown */}
            <div className="reports-section surface-panel">
              <div className="reports-section-header">
                <div className="reports-section-title">
                  <PieChartIcon size={20} style={{ color: 'var(--teal)' }} />
                  <h2>6. Lead Source Breakdown</h2>
                </div>
              </div>

              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={leadSourceStats}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={40}
                      paddingAngle={3}
                      label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                      labelLine={false}
                    >
                      {leadSourceStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="custom-chart-tooltip">
                              <p className="custom-chart-tooltip-label">{data.name}</p>
                              <div className="custom-chart-tooltip-row">
                                <span>Total Leads:</span>
                                <strong>{data.value}</strong>
                              </div>
                              <div className="custom-chart-tooltip-row">
                                <span>Converted:</span>
                                <strong>{data.booked}</strong>
                              </div>
                              <div className="custom-chart-tooltip-row" style={{ color: 'var(--success)' }}>
                                <span>Conversion Rate:</span>
                                <strong>{data.conversionRate}%</strong>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* SECTION 6: Time-to-Completion */}
            <div className="reports-section surface-panel">
              <div className="reports-section-header">
                <div className="reports-section-title">
                  <Clock size={20} style={{ color: 'var(--info)' }} />
                  <h2>7. Time-to-Completion</h2>
                </div>
                <span className="reports-section-badge">Avg: {completionTimeStats.avgDays} Days</span>
              </div>

              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={completionTimeStats.monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                    <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} />
                    <YAxis stroke="var(--text-muted)" fontSize={12} unit="d" />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="custom-chart-tooltip">
                              <p className="custom-chart-tooltip-label">{label}</p>
                              <div className="custom-chart-tooltip-row">
                                <span>Average Days to Complete:</span>
                                <strong>{data.AvgDays} Days</strong>
                              </div>
                              <div className="custom-chart-tooltip-row">
                                <span>Bookings Completed:</span>
                                <strong>{data.CompletedCount}</strong>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="AvgDays" name="Avg Days to Completion" fill={COLORS.indigo} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* ── SECTION 7: Retarget Effectiveness ────────────────────────── */}
          <div className="reports-section surface-panel">
            <div className="reports-section-header">
              <div className="reports-section-title">
                <Target size={20} style={{ color: 'var(--danger)' }} />
                <h2>8. Retarget Effectiveness</h2>
              </div>
              <span className="reports-section-badge" style={{ color: 'var(--danger)' }}>
                Retarget Conversion: {retargetStats.conversionRate}%
              </span>
            </div>

            <div className="reports-two-col">
              {/* Retarget Overview Stats */}
              <div>
                <h4 style={{ marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  Retarget Pipeline Breakdown
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                  <div style={{ padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Retarget Leads</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{retargetStats.totalRetarget}</div>
                  </div>
                  <div style={{ padding: '1rem', background: 'var(--success-bg)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--success)', textTransform: 'uppercase' }}>Converted to Booking</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)' }}>{retargetStats.convertedRetarget}</div>
                  </div>
                  <div style={{ padding: '1rem', background: 'var(--warning-bg)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--warning)', textTransform: 'uppercase' }}>Pending Retarget</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--warning)' }}>{retargetStats.pendingRetarget}</div>
                  </div>
                  <div style={{ padding: '1rem', background: 'var(--danger-bg)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--danger)', textTransform: 'uppercase' }}>Lost Retargets</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--danger)' }}>{retargetStats.lostRetarget}</div>
                  </div>
                </div>
              </div>

              {/* Slot Comparison Chart: Morning vs Evening */}
              <div>
                <h4 style={{ marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  Morning vs. Evening Time Slot Conversion Comparison
                </h4>
                <div style={{ width: '100%', height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={retargetStats.slotComparison}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                      <XAxis dataKey="slot" stroke="var(--text-muted)" fontSize={12} />
                      <YAxis stroke="var(--text-muted)" fontSize={12} unit="%" />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="custom-chart-tooltip">
                                <p className="custom-chart-tooltip-label">{label}</p>
                                <div className="custom-chart-tooltip-row">
                                  <span>Total Leads in Slot:</span>
                                  <strong>{data.Total}</strong>
                                </div>
                                <div className="custom-chart-tooltip-row">
                                  <span>Converted to Booked:</span>
                                  <strong>{data.Converted}</strong>
                                </div>
                                <div className="custom-chart-tooltip-row" style={{ color: 'var(--success)' }}>
                                  <span>Conversion Rate:</span>
                                  <strong>{data.ConversionRate}%</strong>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="ConversionRate" name="Conversion Rate %" fill={COLORS.teal} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>


        </>
      )}
    </div>
  );
};
