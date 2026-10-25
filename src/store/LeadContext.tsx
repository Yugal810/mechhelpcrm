import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { Lead, SujalCallListItem } from '../types';
import { LeadService, CallListService, migrateLocalDataToSupabase, SettlementService } from '../utils/dataLayer';
import { supabase } from '../lib/supabase';
import { playNewLeadSound, playBookingSound } from '../utils/soundService';
import { ToastNotificationContainer, type ToastData } from '../components/ToastNotification';

interface LeadContextType {
  leads: Lead[];
  sujalList: SujalCallListItem[];
  addLead: (lead: Omit<Lead, 'id' | 'createdDate' | 'bookingHistory' | 'activityHistory'>) => Promise<void>;
  updateLead: (lead: Lead) => Promise<void>;
  deleteLead: (id: string) => Promise<void>;
  addSujalItem: (item: Omit<SujalCallListItem, 'id' | 'dateAdded'>) => Promise<void>;
  updateSujalItem: (item: SujalCallListItem) => Promise<void>;
  deleteSujalItem: (id: string) => Promise<void>;
  finalizeBilling: (bookingId: string, lineItems: any[], paidTo: 'garage' | 'mechhelp', garageId?: string, garageName?: string, discount?: number, numberPlate?: string, carBrand?: string, carModel?: string, customerName?: string) => Promise<any>;
  finalizeDirectBilling: (customerName: string, carBrand: string, carModel: string, numberPlate: string, bookingDate: string, garageId: string, garageName: string, lineItems: any[], paidTo: 'garage' | 'mechhelp', discount?: number) => Promise<any>;
  getGarageList: () => Promise<{ id: string; name: string }[]>;
  addGarage: (name: string) => Promise<{ id: string; name: string }>;
  removeGarage: (garageId: string, currentBalance: number) => Promise<void>;
  recordPayment: (garageId: string, amount: number, direction: 'mechhelp_to_garage' | 'garage_to_mechhelp', currentBalance?: number) => Promise<any>;
  getGaragesWithBalances: () => Promise<any[]>;
  getGarageSettlements: (garageId: string) => Promise<any>;
  getAllSettlements: () => Promise<any>;
  getHistorySettlements: () => Promise<any[]>;
  markFinalSettlement: (settlementId: string, billingId?: string) => Promise<void>;
  deleteSettlement: (settlementId: string, billingId?: string, leadId?: string) => Promise<void>;
  updateSettlementBilling: (settlementId: string, billingId: string, leadId: string | null, data: any) => Promise<void>;
  settleGarage: (garageId: string) => Promise<any>;
  isLoading: boolean;
  isMigrating: boolean;
  isEditingLead: boolean;
  setIsEditingLead: (val: boolean) => void;
}

const LeadContext = createContext<LeadContextType | undefined>(undefined);

const useSupabase = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);

export const LeadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [sujalList, setSujalList] = useState<SujalCallListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isEditingLead, setIsEditingLead] = useState(false);

  const knownLeadIdsRef = useRef<Set<string>>(new Set());
  const notifiedIdsRef = useRef<Set<string>>(new Set());
  const initialLoadDoneRef = useRef(false);
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = useCallback((toast: Omit<ToastData, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    setToasts(prev => [...prev, { ...toast, id }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // fetchAllData ONLY fetches and updates state — ZERO sound triggers here to prevent loops!
  const fetchAllData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setIsLoading(true);
      await CallListService.rolloverPendingItems();
      const [fetchedLeads, fetchedCallList] = await Promise.all([
        LeadService.getLeads(),
        CallListService.getItems()
      ]);

      if (!initialLoadDoneRef.current) {
        initialLoadDoneRef.current = true;
        // Seed all existing historical leads on startup so they NEVER ring
        fetchedLeads.forEach(l => {
          notifiedIdsRef.current.add(l.id);
          notifiedIdsRef.current.add(`${l.id}-lead`);
          if (l.leadType === 'Booked') {
            notifiedIdsRef.current.add(`${l.id}-booked`);
          }
        });
      }

      knownLeadIdsRef.current = new Set(fetchedLeads.map(l => l.id));
      setLeads(fetchedLeads);
      setSujalList(fetchedCallList);
    } catch (error) {
      console.error('Failed to fetch data', error);
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      setIsLoading(true);
      
      if (useSupabase) {
        const hasLocalData = localStorage.getItem('mechhelp_crm_leads');
        if (hasLocalData) {
          setIsMigrating(true);
          try {
            await migrateLocalDataToSupabase();
          } catch (e) {
            console.error("Migration failed", e);
          }
          if (mounted) setIsMigrating(false);
        }
      }
      
      if (mounted) {
        await fetchAllData(false);
      }
    };

    initialize();

    // 1. Supabase Realtime Channel
    let channel: any = null;
    if (useSupabase && supabase?.channel) {
      try {
        channel = supabase
          .channel('crm-realtime-leads')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
            if (mounted) fetchAllData(true);
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'call_list_items' }, () => {
            if (mounted) fetchAllData(true);
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'booking_history' }, () => {
            if (mounted) fetchAllData(true);
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_history' }, () => {
            if (mounted) fetchAllData(true);
          })
          .on('broadcast', { event: 'new_lead' }, (eventObj: any) => {
            const payload = eventObj?.payload;
            console.log('⚡ Direct Realtime Event Received:', payload);
            if (mounted && payload && payload.id) {
              const isBooking = payload.action === 'booked' || payload.leadType === 'Booked';
              const notifKey = `${payload.id}-${isBooking ? 'booked' : 'lead'}`;

              // Bulletproof single-notification check: only notify once per session
              if (notifiedIdsRef.current.has(notifKey)) {
                return;
              }
              notifiedIdsRef.current.add(notifKey);

              if (isBooking) {
                playBookingSound();
                addToast({
                  type: 'success',
                  title: '🚗 Booking Confirmed!',
                  message: `${payload.customerName || payload.name || 'Customer'} • ${payload.garage || 'Partner Garage'} (${payload.bookingType || 'Visit'})`.trim(),
                  duration: 6000,
                });
              } else {
                playNewLeadSound();
                addToast({
                  type: 'success',
                  title: '🔔 New Lead Received!',
                  message: `${payload.name || payload.customerName || 'New Customer'} • ${payload.carBrand || ''} ${payload.carModel || ''}`.trim(),
                  duration: 5000,
                });
              }
              fetchAllData(true);
            }
          })
          .subscribe();
      } catch (err) {
        console.warn('Realtime channel subscription error:', err);
      }
    }

    // 2. High-reliability lightweight polling (checks top 5 recent leads, only notifies unnotified recent leads)
    const pollInterval = setInterval(async () => {
      if (!mounted || !useSupabase) return;
      try {
        const { data: latestRows, error } = await supabase
          .from('leads')
          .select('id, customer_name, car_brand, car_model, lead_type, created_date, last_contacted_date, garage_assigned, booking_type')
          .order('created_date', { ascending: false })
          .limit(5);

        if (error || !latestRows) return;

        let needsFullRefresh = false;
        latestRows.forEach((row: any) => {
          if (!row || !row.id) return;
          const isBooking = row.lead_type === 'Booked';
          const notifKey = `${row.id}-${isBooking ? 'booked' : 'lead'}`;

          // Already notified in this session? Skip permanently!
          if (notifiedIdsRef.current.has(notifKey)) {
            return;
          }

          // Check if created or updated recently (within last 3 minutes)
          const createdMs = row.created_date ? new Date(row.created_date).getTime() : 0;
          const contactedMs = row.last_contacted_date ? new Date(row.last_contacted_date).getTime() : 0;
          const isRecentlyCreated = createdMs > 0 && (Date.now() - createdMs < 180000);
          const isRecentlyContacted = contactedMs > 0 && (Date.now() - contactedMs < 180000);
          const isRelevant = isBooking ? (isRecentlyCreated || isRecentlyContacted) : isRecentlyCreated;

          if (isRelevant) {
            // Mark permanently as notified so it NEVER rings again
            notifiedIdsRef.current.add(notifKey);
            needsFullRefresh = true;

            if (isBooking) {
              console.log('🚗 Newly confirmed booking detected from poll:', row);
              playBookingSound();
              addToast({
                type: 'success',
                title: '🚗 Booking Confirmed!',
                message: `${row.customer_name || 'Customer'} • ${row.garage_assigned || 'Partner Garage'} (${row.booking_type || 'Visit'})`.trim(),
                duration: 6000,
              });
            } else {
              console.log('🔔 New lead detected from poll:', row);
              playNewLeadSound();
              addToast({
                type: 'success',
                title: '🔔 New Lead Received!',
                message: `${row.customer_name || 'New Customer'} • ${row.car_brand || ''} ${row.car_model || ''}`.trim(),
                duration: 5000,
              });
            }
          }
        });

        if (needsFullRefresh) {
          fetchAllData(true);
        }
      } catch (err) {
        console.warn('Lightweight poll error:', err);
      }
    }, 4000);

    return () => {
      mounted = false;
      clearInterval(pollInterval);
      if (channel && supabase?.removeChannel) {
        supabase.removeChannel(channel);
      }
    };
  }, [fetchAllData]);

  const addLead = async (leadData: Omit<Lead, 'id' | 'createdDate' | 'bookingHistory' | 'activityHistory'>) => {
    try {
      const newLead = await LeadService.addLead(leadData);
      setLeads(prev => [newLead, ...prev]);
    } catch (error) {
      console.error('Error adding lead:', error);
      throw error;
    }
  };

  const updateLead = async (updatedLead: Lead) => {
    // 1. Optimistically update local state immediately so UI updates with 0ms delay
    setLeads(prev => prev.map(l => (l.id === updatedLead.id ? updatedLead : l)));
    try {
      const savedLead = await LeadService.updateLead(updatedLead);
      setLeads(prev => prev.map(l => (l.id === savedLead.id ? savedLead : l)));
    } catch (error) {
      console.error('Error updating lead:', error);
      fetchAllData();
      throw error;
    }
  };

  const deleteLead = async (id: string) => {
    try {
      await LeadService.deleteLead(id);
      setLeads(prev => prev.filter(l => l.id !== id));
    } catch (error) {
      console.error('Error deleting lead:', error);
      alert('Failed to delete lead.');
      throw error;
    }
  };

  const addSujalItem = async (itemData: Omit<SujalCallListItem, 'id' | 'dateAdded'>) => {
    try {
      const newItem = await CallListService.addItem(itemData);
      setSujalList(prev => [newItem, ...prev]);
    } catch (error) {
      console.error('Error adding call list item:', error);
      alert('Failed to add item to call list.');
    }
  };

  const updateSujalItem = async (updatedItem: SujalCallListItem) => {
    try {
      const savedItem = await CallListService.updateItem(updatedItem);
      setSujalList(prev => prev.map(i => (i.id === savedItem.id ? savedItem : i)));
    } catch (error) {
      console.error('Error updating call list item:', error);
      alert('Failed to update call list item.');
    }
  };

  const deleteSujalItem = async (id: string) => {
    try {
      await CallListService.deleteItem(id);
      setSujalList(prev => prev.filter(i => i.id !== id));
    } catch (error) {
      console.error('Error deleting call list item:', error);
      alert('Failed to delete call list item.');
    }
  };

  const finalizeBilling = async (bookingId: string, lineItems: any[], paidTo: 'garage' | 'mechhelp', garageId?: string, garageName?: string, discount?: number, numberPlate?: string, carBrand?: string, carModel?: string, customerName?: string) => {
    const res = await SettlementService.finalizeBilling(bookingId, lineItems, paidTo, garageId, garageName, discount, numberPlate, carBrand, carModel, customerName);
    await fetchAllData();
    return res;
  };

  const finalizeDirectBilling = async (customerName: string, carBrand: string, carModel: string, numberPlate: string, bookingDate: string, garageId: string, garageName: string, lineItems: any[], paidTo: 'garage' | 'mechhelp', discount: number = 0) => {
    const res = await SettlementService.finalizeDirectBilling(customerName, carBrand, carModel, numberPlate, bookingDate, garageId, garageName, lineItems, paidTo, discount);
    await fetchAllData();
    return res;
  };

  const getGarageList = async () => {
    return SettlementService.getGarageList();
  };

  const addGarage = async (name: string) => {
    return SettlementService.addGarage(name);
  };

  const removeGarage = async (garageId: string, currentBalance: number) => {
    return SettlementService.removeGarage(garageId, currentBalance);
  };

  const recordPayment = async (garageId: string, amount: number, direction: 'mechhelp_to_garage' | 'garage_to_mechhelp', currentBalance?: number) => {
    return SettlementService.recordPayment(garageId, amount, direction, currentBalance);
  };

  const getGaragesWithBalances = async () => {
    return SettlementService.getGaragesWithBalances();
  };

  const getGarageSettlements = async (garageId: string) => {
    return SettlementService.getGarageSettlements(garageId);
  };

  const settleGarage = async (garageId: string) => {
    const res = await SettlementService.settleGarage(garageId);
    await fetchAllData();
    return res;
  };

  const getAllSettlements = async () => {
    return SettlementService.getAllSettlements();
  };

  const getHistorySettlements = async () => {
    return SettlementService.getHistorySettlements();
  };

  const markFinalSettlement = async (settlementId: string, billingId?: string) => {
    await SettlementService.markFinalSettlement(settlementId, billingId);
    await fetchAllData();
  };

  const deleteSettlement = async (settlementId: string, billingId?: string, leadId?: string) => {
    await SettlementService.deleteSettlement(settlementId, billingId, leadId);
    await fetchAllData();
  };

  const updateSettlementBilling = async (settlementId: string, billingId: string, leadId: string | null, data: any) => {
    await SettlementService.updateSettlementBilling(settlementId, billingId, leadId, data);
    await fetchAllData();
  };

  return (
    <LeadContext.Provider value={{ leads, sujalList, addLead, updateLead, deleteLead, addSujalItem, updateSujalItem, deleteSujalItem, finalizeBilling, finalizeDirectBilling, getGarageList, addGarage, removeGarage, recordPayment, getGaragesWithBalances, getGarageSettlements, getAllSettlements, getHistorySettlements, markFinalSettlement, deleteSettlement, updateSettlementBilling, settleGarage, isLoading, isMigrating, isEditingLead, setIsEditingLead }}>
      {children}
      <ToastNotificationContainer toasts={toasts} onDismiss={dismissToast} />
    </LeadContext.Provider>
  );
};

export const useLeadContext = () => {
  const context = useContext(LeadContext);
  if (context === undefined) {
    throw new Error('useLeadContext must be used within a LeadProvider');
  }
  return context;
};
