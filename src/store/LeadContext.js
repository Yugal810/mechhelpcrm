import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { LeadService, CallListService, migrateLocalDataToSupabase, SettlementService } from '../utils/dataLayer.js';
import { supabase, isSupabaseConfigured } from '../lib/supabase.js';

const LeadContext = createContext(undefined);

const useSupabase = isSupabaseConfigured;

export const LeadProvider = ({ children }) => {
  const [leads, setLeads] = useState([]);
  const [sujalList, setSujalList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMigrating, setIsMigrating] = useState(false);

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

  const addLead = async (leadData) => {
    try {
      const newLead = await LeadService.addLead(leadData);
      setLeads(prev => [newLead, ...prev]);
    } catch (error) {
      console.error('Error adding lead:', error);
      throw error;
    }
  };

  const updateLead = async (updatedLead) => {
    try {
      const savedLead = await LeadService.updateLead(updatedLead);
      setLeads(prev => prev.map(l => (l.id === savedLead.id ? savedLead : l)));
    } catch (error) {
      console.error('Error updating lead:', error);
      throw error;
    }
  };

  const deleteLead = async (id) => {
    try {
      await LeadService.deleteLead(id);
      setLeads(prev => prev.filter(l => l.id !== id));
    } catch (error) {
      console.error('Error deleting lead:', error);
      alert('Failed to delete lead.');
      throw error;
    }
  };

  const addSujalItem = async (itemData) => {
    try {
      const newItem = await CallListService.addItem(itemData);
      setSujalList(prev => [newItem, ...prev]);
    } catch (error) {
      console.error('Error adding call list item:', error);
      alert('Failed to add item to call list.');
    }
  };

  const updateSujalItem = async (updatedItem) => {
    try {
      const savedItem = await CallListService.updateItem(updatedItem);
      setSujalList(prev => prev.map(i => (i.id === savedItem.id ? savedItem : i)));
    } catch (error) {
      console.error('Error updating call list item:', error);
      alert('Failed to update call list item.');
    }
  };

  const deleteSujalItem = async (id) => {
    try {
      await CallListService.deleteItem(id);
      setSujalList(prev => prev.filter(i => i.id !== id));
    } catch (error) {
      console.error('Error deleting call list item:', error);
      alert('Failed to delete call list item.');
    }
  };

  const finalizeBilling = async (bookingId, lineItems, paidTo, garageId, garageName, discount, numberPlate, carBrand, carModel, customerName) => {
    const res = await SettlementService.finalizeBilling(bookingId, lineItems, paidTo, garageId, garageName, discount, numberPlate, carBrand, carModel, customerName);
    await fetchAllData();
    return res;
  };

  const finalizeDirectBilling = async (customerName, carBrand, carModel, numberPlate, bookingDate, garageId, garageName, lineItems, paidTo, discount = 0) => {
    const res = await SettlementService.finalizeDirectBilling(customerName, carBrand, carModel, numberPlate, bookingDate, garageId, garageName, lineItems, paidTo, discount);
    await fetchAllData();
    return res;
  };

  const getGarageList = async () => {
    return SettlementService.getGarageList();
  };

  const addGarage = async (name) => {
    return SettlementService.addGarage(name);
  };

  const removeGarage = async (garageId, currentBalance) => {
    return SettlementService.removeGarage(garageId, currentBalance);
  };

  const recordPayment = async (garageId, amount, direction, currentBalance) => {
    return SettlementService.recordPayment(garageId, amount, direction, currentBalance);
  };

  const getGaragesWithBalances = async () => {
    return SettlementService.getGaragesWithBalances();
  };

  const getGarageSettlements = async (garageId) => {
    return SettlementService.getGarageSettlements(garageId);
  };

  const settleGarage = async (garageId) => {
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

  const markFinalSettlement = async (settlementId, billingId) => {
    await SettlementService.markFinalSettlement(settlementId, billingId);
    await fetchAllData();
  };

  const deleteSettlement = async (settlementId, billingId, leadId) => {
    await SettlementService.deleteSettlement(settlementId, billingId, leadId);
    await fetchAllData();
  };

  const updateSettlementBilling = async (settlementId, billingId, leadId, data) => {
    await SettlementService.updateSettlementBilling(settlementId, billingId, leadId, data);
    await fetchAllData();
  };

  return (
    <LeadContext.Provider value={{ leads, sujalList, addLead, updateLead, deleteLead, addSujalItem, updateSujalItem, deleteSujalItem, finalizeBilling, finalizeDirectBilling, getGarageList, addGarage, removeGarage, recordPayment, getGaragesWithBalances, getGarageSettlements, getAllSettlements, getHistorySettlements, markFinalSettlement, deleteSettlement, updateSettlementBilling, settleGarage, isLoading, isMigrating }}>
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
