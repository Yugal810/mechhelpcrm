import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Lead, SujalCallListItem } from '../types';
import { LeadService, CallListService, migrateLocalDataToSupabase, SettlementService } from '../utils/dataLayer';
import { supabase } from '../lib/supabase';

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

  const fetchAllData = useCallback(async () => {
    try {
      await CallListService.rolloverPendingItems();
      const [fetchedLeads, fetchedCallList] = await Promise.all([
        LeadService.getLeads(),
        CallListService.getItems()
      ]);
      setLeads(fetchedLeads);
      setSujalList(fetchedCallList);
    } catch (error) {
      console.error('Failed to fetch data', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
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
          setIsMigrating(false);
        }
      }
      
      await fetchAllData();
      
      if (useSupabase) {
        const channel = supabase
          .channel(`schema-db-changes-${Date.now()}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchAllData())
          .on('postgres_changes', { event: '*', schema: 'public', table: 'call_list_items' }, () => fetchAllData())
          .on('postgres_changes', { event: '*', schema: 'public', table: 'booking_history' }, () => fetchAllData())
          .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_history' }, () => fetchAllData())
          .subscribe();

        return () => {
          supabase.removeChannel(channel);
        };
      }
    };

    initialize();
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
