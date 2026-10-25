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
  const knownBookedLeadIdsRef = useRef<Set<string>>(new Set());
  const notifiedKeysRef = useRef<Map<string, number>>(new Map());
  const initialLoadDoneRef = useRef(false);
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = useCallback((toast: Omit<ToastData, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    setToasts(prev => [...prev, { ...toast, id }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const isRecentlyCreatedOrUpdated = (lead: Lead): boolean => {
    const times = [
      lead.createdDate ? new Date(lead.createdDate).getTime() : 0,
      lead.lastContactedDate ? new Date(lead.lastContactedDate).getTime() : 0,
      (lead as any).updated_at ? new Date((lead as any).updated_at).getTime() : 0,
    ].filter(t => !isNaN(t) && t > 0);

    if (times.length === 0) return false;
    const latestTime = Math.max(...times);
    // Must be within the last 2 minutes (120,000 ms)
    return Date.now() - latestTime < 120000;
  };

  const fetchAllData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setIsLoading(true);
      await CallListService.rolloverPendingItems();
      const [fetchedLeads, fetchedCallList] = await Promise.all([
        LeadService.getLeads(),
        CallListService.getItems()
      ]);

      if (initialLoadDoneRef.current) {
        // 1. Detect Newly Confirmed Bookings via Polling
        const newlyBooked = fetchedLeads.filter(l => {
          if (l.leadType !== 'Booked') return false;
          const key = `booked-${l.id}`;
          const lastNotified = notifiedKeysRef.current.get(key) || 0;
          const notRecentlyNotified = Date.now() - lastNotified > 15000;
          return (!knownBookedLeadIdsRef.current.has(l.id) || notRecentlyNotified) && isRecentlyCreatedOrUpdated(l);
        });

        if (newlyBooked.length > 0) {
          console.log('🚗 Newly confirmed booking from polling:', newlyBooked);
          playBookingSound();
          newlyBooked.forEach(lead => {
            notifiedKeysRef.current.set(`booked-${lead.id}`, Date.now());
            knownBookedLeadIdsRef.current.add(lead.id);
            addToast({
              type: 'success',
              title: '🚗 Booking Confirmed!',
              message: `${lead.customerName || 'Customer'} • ${lead.garageAssigned || 'Partner Garage'} (${lead.bookingType || 'Visit'})`.trim(),
              duration: 6000,
            });
          });
        }

        // 2. Detect Brand New Fresh Leads via Polling
        const newlyAdded = fetchedLeads.filter(l => {
          if (l.leadType === 'Booked') return false;
          const key = `lead-${l.id}`;
          const lastNotified = notifiedKeysRef.current.get(key) || 0;
          const notRecentlyNotified = Date.now() - lastNotified > 15000;
          return (!knownLeadIdsRef.current.has(l.id) || notRecentlyNotified) && isRecentlyCreatedOrUpdated(l);
        });

        if (newlyAdded.length > 0) {
          console.log('🔔 Truly new fresh lead from polling:', newlyAdded);
          playNewLeadSound();
          newlyAdded.forEach(lead => {
            notifiedKeysRef.current.set(`lead-${lead.id}`, Date.now());
            addToast({
              type: 'success',
              title: '🔔 New Lead Received!',
              message: `${lead.customerName || 'New Customer'} • ${lead.carBrand || ''} ${lead.carModel || ''}`.trim(),
              duration: 5000,
            });
          });
        }
      } else {
        initialLoadDoneRef.current = true;
        // Seed all existing historical leads so they never trigger a notification
        fetchedLeads.forEach(l => {
          notifiedKeysRef.current.set(`lead-${l.id}`, Date.now());
          if (l.leadType === 'Booked') {
            knownBookedLeadIdsRef.current.add(l.id);
            notifiedKeysRef.current.set(`booked-${l.id}`, Date.now());
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
  }, [addToast]);

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
            if (mounted && payload) {
              const isBooking = payload.action === 'booked' || payload.leadType === 'Booked';
              const notifKey = `${payload.id}-${isBooking ? 'booked' : 'lead'}`;
              const lastNotified = notifiedKeysRef.current.get(notifKey) || 0;

              if (Date.now() - lastNotified > 5000) {
                notifiedKeysRef.current.set(notifKey, Date.now());
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
              }
              fetchAllData(true);
            }
          })
          .subscribe();
      } catch (err) {
        console.warn('Realtime channel subscription error:', err);
      }
    }

    // 2. High-reliability polling fallback every 3.5 seconds (zero-flicker background sync)
    const pollInterval = setInterval(() => {
      if (mounted) {
        fetchAllData(true);
      }
    }, 3500);

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
