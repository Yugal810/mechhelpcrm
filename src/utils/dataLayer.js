import { supabase, isSupabaseConfigured } from '../lib/supabase.js';
import { v4 as uuidv4 } from 'uuid';
import { calculateSettlement } from '../../shared/settlementCalculator.js';

const LEADS_KEY = 'mechhelp_crm_leads';
const CALL_LIST_KEY = 'mechhelp_crm_call_list';

const useSupabase = isSupabaseConfigured;

const delay = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to map DB row to Lead object
const mapDbToLead = (row) => {
  const salespersonFallback = JSON.parse(localStorage.getItem('mechhelp_salesperson_fallback') || '{}');
  return {
    id: row.id,
    customerName: row.customer_name,
    leadSource: row.lead_source,
    salesperson: row.salesperson || salespersonFallback[row.id] || 'Choice',
    identifier: row.identifier,
    carBrand: row.car_brand,
    carModel: row.car_model,
    priority: row.priority,
    leadType: row.lead_type,
    bookingType: row.booking_type,
    garageAssigned: row.garage_assigned,
    garageId: row.garage_id,
    bookingDateTime: row.booking_date_time,
    garageNotified: row.garage_notified,
    nextFollowUpDate: row.next_follow_up_date,
    lastContactedDate: row.last_contacted_date,
    isVip: row.is_vip,
    whatsappBroadcast: row.whatsapp_broadcast,
    retargetTimeSlot: row.retarget_time_slot || null,
    detailsSharedAt: row.details_shared_at || null,
    serviceType: row.service_type || [],
    numberPlate: row.number_plate || '',
    notes: row.notes || '',
    createdDate: row.created_date,
    bookingHistory: (row.booking_history || []).map((h) => ({
      previousDate: h.previous_date,
      previousTime: h.previous_time,
      previousGarage: h.previous_garage,
      newDate: h.new_date,
      newTime: h.new_time,
      newGarage: h.new_garage,
      reason: h.reason,
      remarks: h.remarks,
      rescheduledBy: h.rescheduled_by,
      rescheduledOn: h.rescheduled_on
    })),
    activityHistory: (row.activity_history || []).map((a) => ({
      id: a.id,
      timestamp: a.timestamp,
      outcome: a.outcome,
      notes: a.notes
    }))
  };
};

// Helper to map Lead object to DB row
const mapLeadToDb = (lead) => ({
  id: lead.id,
  customer_name: lead.customerName,
  lead_source: lead.leadSource,
  salesperson: lead.salesperson || 'Choice',
  identifier: lead.identifier,
  car_brand: lead.carBrand,
  car_model: lead.carModel,
  priority: lead.priority,
  lead_type: lead.leadType,
  booking_type: lead.bookingType,
  garage_assigned: lead.garageAssigned,
  booking_date_time: lead.bookingDateTime,
  garage_notified: lead.garageNotified,
  next_follow_up_date: lead.nextFollowUpDate,
  last_contacted_date: lead.lastContactedDate,
  is_vip: lead.isVip,
  whatsapp_broadcast: lead.whatsappBroadcast,
  retarget_time_slot: lead.retargetTimeSlot || null,
  details_shared_at: lead.detailsSharedAt || null,
  service_type: lead.serviceType || [],
  number_plate: lead.numberPlate || null,
  notes: lead.notes,
  created_date: lead.createdDate
});

// Helper to map Call List DB row to SujalCallListItem
const mapCallListToDb = (item) => ({
  id: item.id,
  sales_iq_tag: item.salesIqTag,
  priority: item.priority,
  status: item.status,
  linked_lead_id: item.linkedLeadId,
  date_added: item.dateAdded
});

const mapDbToCallList = (row) => ({
  id: row.id,
  salesIqTag: row.sales_iq_tag,
  priority: row.priority,
  status: row.status,
  linkedLeadId: row.linked_lead_id,
  dateAdded: row.date_added
});

export const LeadService = {
  async getLeads() {
    if (useSupabase) {
      const { data, error } = await supabase
        .from('leads')
        .select(`
          *,
          booking_history(*),
          activity_history(*)
        `)
        .order('created_date', { ascending: false });
        
      if (error) throw error;
      
      const fallbackData = JSON.parse(localStorage.getItem('mechhelp_retarget_fallback') || '{}');
      const detailsSharedFallback = JSON.parse(localStorage.getItem('mechhelp_details_shared_fallback') || '{}');
      const serviceTypeFallback = JSON.parse(localStorage.getItem('mechhelp_service_type_fallback') || '{}');
      return (data || []).map((row) => {
        const lead = mapDbToLead(row);
        if (!lead.retargetTimeSlot && fallbackData[lead.id]) {
          lead.retargetTimeSlot = fallbackData[lead.id];
        }
        if (!lead.detailsSharedAt && detailsSharedFallback[lead.id]) {
          lead.detailsSharedAt = detailsSharedFallback[lead.id];
        }
        if ((!lead.serviceType || lead.serviceType.length === 0) && serviceTypeFallback[lead.id]) {
          lead.serviceType = serviceTypeFallback[lead.id];
        }
        return lead;
      });
    } else {
      await delay();
      const data = localStorage.getItem(LEADS_KEY);
      return data ? JSON.parse(data) : [];
    }
  },

  async checkSalesIqTagExists(tag, excludeLeadId) {
    const trimmedTag = tag.trim();
    if (!trimmedTag) return false;

    if (useSupabase) {
      let query = supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .ilike('identifier', trimmedTag)
        .eq('lead_source', 'SalesIQ');

      if (excludeLeadId) {
        query = query.neq('id', excludeLeadId);
      }
      const { count, error } = await query;
      if (error) {
        console.error('Error checking SalesIQ Tag uniqueness:', error);
        return false;
      }
      return (count || 0) > 0;
    } else {
      await delay();
      const leads = await this.getLeads();
      return leads.some(l => 
        (l.leadSource === 'SalesIQ' || !l.leadSource) &&
        l.identifier.trim().toLowerCase() === trimmedTag.toLowerCase() &&
        (!excludeLeadId || l.id !== excludeLeadId)
      );
    }
  },

  async addLead(lead) {
    const newLeadId = uuidv4();
    const createdDate = lead.createdDate || new Date().toISOString();
    
    if (useSupabase) {
      let garageId = null;
      if (lead.garageAssigned) {
        const { data: garageMatch } = await supabase
          .from('garages')
          .select('id')
          .ilike('name', lead.garageAssigned.trim())
          .maybeSingle();
        if (garageMatch) garageId = garageMatch.id;
      }

      const detailsSharedAt = lead.leadType === 'Details Shared'
        ? (lead.detailsSharedAt || new Date().toISOString())
        : null;

      const dbLead = {
        id: newLeadId,
        user_id: null,
        customer_name: lead.customerName,
        lead_source: lead.leadSource,
        identifier: lead.identifier,
        car_brand: lead.carBrand,
        car_model: lead.carModel,
        priority: lead.priority,
        lead_type: lead.leadType,
        booking_type: lead.bookingType,
        garage_assigned: lead.garageAssigned,
        garage_id: garageId,
        booking_date_time: lead.bookingDateTime,
        garage_notified: lead.garageNotified,
        next_follow_up_date: lead.nextFollowUpDate,
        last_contacted_date: lead.lastContactedDate,
        is_vip: lead.isVip,
        whatsapp_broadcast: lead.whatsappBroadcast,
        retarget_time_slot: lead.retargetTimeSlot || null,
        details_shared_at: detailsSharedAt,
        service_type: lead.serviceType || [],
        number_plate: lead.numberPlate || null,
        notes: lead.notes,
        created_date: createdDate
      };

      let { data, error } = await supabase
        .from('leads')
        .insert([dbLead])
        .select(`
          *,
          booking_history(*),
          activity_history(*)
        `)
        .single();

      if (error && (error.code === 'PGRST204' || error.message?.includes('retarget_time_slot') || error.message?.includes('details_shared_at') || error.message?.includes('service_type') || error.message?.includes('salesperson'))) {
        delete dbLead.retarget_time_slot;
        delete dbLead.details_shared_at;
        delete dbLead.service_type;
        delete dbLead.salesperson;
        const res = await supabase
          .from('leads')
          .insert([dbLead])
          .select(`
            *,
            booking_history(*),
            activity_history(*)
          `)
          .single();
        data = res.data;
        error = res.error;
        
        if (data) {
          if (lead.retargetTimeSlot) {
            const fallbackData = JSON.parse(localStorage.getItem('mechhelp_retarget_fallback') || '{}');
            fallbackData[data.id] = lead.retargetTimeSlot;
            localStorage.setItem('mechhelp_retarget_fallback', JSON.stringify(fallbackData));
            data.retarget_time_slot = lead.retargetTimeSlot;
          }
          if (detailsSharedAt) {
            const detailsSharedFallback = JSON.parse(localStorage.getItem('mechhelp_details_shared_fallback') || '{}');
            detailsSharedFallback[data.id] = detailsSharedAt;
            localStorage.setItem('mechhelp_details_shared_fallback', JSON.stringify(detailsSharedFallback));
            data.details_shared_at = detailsSharedAt;
          }
          if (lead.serviceType && lead.serviceType.length > 0) {
            const serviceTypeFallback = JSON.parse(localStorage.getItem('mechhelp_service_type_fallback') || '{}');
            serviceTypeFallback[data.id] = lead.serviceType;
            localStorage.setItem('mechhelp_service_type_fallback', JSON.stringify(serviceTypeFallback));
            data.service_type = lead.serviceType;
          }
          if (lead.salesperson) {
            const salespersonFallback = JSON.parse(localStorage.getItem('mechhelp_salesperson_fallback') || '{}');
            salespersonFallback[data.id] = lead.salesperson;
            localStorage.setItem('mechhelp_salesperson_fallback', JSON.stringify(salespersonFallback));
            data.salesperson = lead.salesperson;
          }
        }
      }
        
      if (error) throw error;
      return mapDbToLead(data);
    } else {
      await delay();
      const leads = await this.getLeads();
      const detailsSharedAt = lead.leadType === 'Details Shared'
        ? (lead.detailsSharedAt || new Date().toISOString())
        : null;
      const newLead = {
        ...lead,
        detailsSharedAt,
        id: newLeadId,
        createdDate,
        bookingHistory: [],
        activityHistory: []
      };
      leads.unshift(newLead);
      localStorage.setItem(LEADS_KEY, JSON.stringify(leads));
      return newLead;
    }
  },

  async updateLead(updatedLead) {
    const detailsSharedAt = updatedLead.leadType === 'Details Shared'
      ? (updatedLead.detailsSharedAt || new Date().toISOString())
      : null;
    const finalLead = { ...updatedLead, detailsSharedAt };

    if (useSupabase) {
      let garageId = null;
      if (finalLead.garageAssigned) {
        const { data: garageMatch } = await supabase
          .from('garages')
          .select('id')
          .ilike('name', finalLead.garageAssigned.trim())
          .maybeSingle();
        if (garageMatch) garageId = garageMatch.id;
      }

      let dbLead = { ...mapLeadToDb(finalLead), garage_id: garageId };
      let { error: leadError } = await supabase
        .from('leads')
        .update(dbLead)
        .eq('id', finalLead.id);
        
      if (leadError && (leadError.code === 'PGRST204' || leadError.message?.includes('retarget_time_slot') || leadError.message?.includes('details_shared_at') || leadError.message?.includes('service_type') || leadError.message?.includes('salesperson'))) {
        delete dbLead.retarget_time_slot;
        delete dbLead.details_shared_at;
        delete dbLead.service_type;
        delete dbLead.salesperson;
        const res = await supabase
          .from('leads')
          .update(dbLead)
          .eq('id', finalLead.id);
        leadError = res.error;
        
        if (!leadError) {
          if (finalLead.retargetTimeSlot) {
            const fallbackData = JSON.parse(localStorage.getItem('mechhelp_retarget_fallback') || '{}');
            fallbackData[finalLead.id] = finalLead.retargetTimeSlot;
            localStorage.setItem('mechhelp_retarget_fallback', JSON.stringify(fallbackData));
          }
          if (detailsSharedAt) {
            const detailsSharedFallback = JSON.parse(localStorage.getItem('mechhelp_details_shared_fallback') || '{}');
            detailsSharedFallback[finalLead.id] = detailsSharedAt;
            localStorage.setItem('mechhelp_details_shared_fallback', JSON.stringify(detailsSharedFallback));
          } else {
            const detailsSharedFallback = JSON.parse(localStorage.getItem('mechhelp_details_shared_fallback') || '{}');
            if (detailsSharedFallback[finalLead.id]) {
              delete detailsSharedFallback[finalLead.id];
              localStorage.setItem('mechhelp_details_shared_fallback', JSON.stringify(detailsSharedFallback));
            }
          }
          if (finalLead.serviceType) {
            const serviceTypeFallback = JSON.parse(localStorage.getItem('mechhelp_service_type_fallback') || '{}');
            serviceTypeFallback[finalLead.id] = finalLead.serviceType;
            localStorage.setItem('mechhelp_service_type_fallback', JSON.stringify(serviceTypeFallback));
          }
          if (finalLead.salesperson) {
            const salespersonFallback = JSON.parse(localStorage.getItem('mechhelp_salesperson_fallback') || '{}');
            salespersonFallback[finalLead.id] = finalLead.salesperson;
            localStorage.setItem('mechhelp_salesperson_fallback', JSON.stringify(salespersonFallback));
          }
        }
      }

      if (leadError) throw leadError;

      const { error: deleteBookingError } = await supabase
        .from('booking_history')
        .delete()
        .eq('lead_id', updatedLead.id);
      if (deleteBookingError) throw deleteBookingError;

      if (updatedLead.bookingHistory && updatedLead.bookingHistory.length > 0) {
        const bookingInserts = updatedLead.bookingHistory.map(h => ({
          lead_id: updatedLead.id,
          previous_date: h.previousDate,
          previous_time: h.previousTime,
          previous_garage: h.previousGarage,
          new_date: h.newDate,
          new_time: h.newTime,
          new_garage: h.newGarage,
          reason: h.reason,
          remarks: h.remarks,
          rescheduled_by: h.rescheduledBy,
          rescheduled_on: h.rescheduledOn
        }));
        const { error: insertBookingError } = await supabase
          .from('booking_history')
          .insert(bookingInserts);
        if (insertBookingError) throw insertBookingError;
      }

      const { error: deleteActivityError } = await supabase
        .from('activity_history')
        .delete()
        .eq('lead_id', updatedLead.id);
      if (deleteActivityError) throw deleteActivityError;

      if (updatedLead.activityHistory && updatedLead.activityHistory.length > 0) {
        const activityInserts = updatedLead.activityHistory.map(a => ({
          id: a.id || uuidv4(),
          lead_id: updatedLead.id,
          timestamp: a.timestamp,
          outcome: a.outcome,
          notes: a.notes
        }));
        const { error: insertActivityError } = await supabase
          .from('activity_history')
          .insert(activityInserts);
        if (insertActivityError) throw insertActivityError;
      }

      const { data, error: fetchError } = await supabase
        .from('leads')
        .select(`
          *,
          booking_history(*),
          activity_history(*)
        `)
        .eq('id', updatedLead.id)
        .single();
        
      if (fetchError) throw fetchError;
      return mapDbToLead(data);

    } else {
      await delay();
      const leads = await this.getLeads();
      const index = leads.findIndex(l => l.id === updatedLead.id);
      if (index === -1) throw new Error('Lead not found');
      leads[index] = updatedLead;
      localStorage.setItem(LEADS_KEY, JSON.stringify(leads));
      return updatedLead;
    }
  },

  async deleteLead(id) {
    if (useSupabase) {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
    } else {
      await delay();
      const leads = await this.getLeads();
      const filteredLeads = leads.filter(l => l.id !== id);
      localStorage.setItem(LEADS_KEY, JSON.stringify(filteredLeads));
    }
  }
};

export const CallListService = {
  async getItems() {
    if (useSupabase) {
      const { data, error } = await supabase
        .from('call_list_items')
        .select('*')
        .order('date_added', { ascending: false });
        
      if (error) throw error;
      return (data || []).map(mapDbToCallList);
    } else {
      await delay();
      const data = localStorage.getItem(CALL_LIST_KEY);
      return data ? JSON.parse(data) : [];
    }
  },

  async addItem(item) {
    const newItem = {
      ...item,
      id: uuidv4(),
      dateAdded: new Date().toISOString(),
    };
    
    if (useSupabase) {
      const { data, error } = await supabase
        .from('call_list_items')
        .insert([mapCallListToDb(newItem)])
        .select()
        .single();
        
      if (error) throw error;
      return mapDbToCallList(data);
    } else {
      await delay();
      const items = await this.getItems();
      items.unshift(newItem);
      localStorage.setItem(CALL_LIST_KEY, JSON.stringify(items));
      return newItem;
    }
  },

  async updateItem(updatedItem) {
    if (useSupabase) {
      const { data, error } = await supabase
        .from('call_list_items')
        .update(mapCallListToDb(updatedItem))
        .eq('id', updatedItem.id)
        .select()
        .single();
        
      if (error) throw error;
      return mapDbToCallList(data);
    } else {
      await delay();
      const items = await this.getItems();
      const index = items.findIndex(i => i.id === updatedItem.id);
      if (index === -1) throw new Error('Item not found');
      items[index] = updatedItem;
      localStorage.setItem(CALL_LIST_KEY, JSON.stringify(items));
      return updatedItem;
    }
  },
  
  async deleteItem(id) {
    if (useSupabase) {
      const { error } = await supabase
        .from('call_list_items')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
    } else {
      await delay();
      const items = await this.getItems();
      const filteredItems = items.filter(i => i.id !== id);
      localStorage.setItem(CALL_LIST_KEY, JSON.stringify(filteredItems));
    }
  },

  async rolloverPendingItems() {
    const today = new Date().toISOString().split('T')[0];
    const lastLogin = localStorage.getItem('lastLoginDate');
    
    if (lastLogin !== today) {
      const items = await this.getItems();
      const itemsToUpdate = items.filter(item => item.status === 'Call Not Received');
      
      if (itemsToUpdate.length > 0) {
        if (useSupabase) {
          await Promise.all(itemsToUpdate.map(item => 
            supabase.from('call_list_items').update({ status: 'Pending' }).eq('id', item.id)
          ));
        } else {
          const updatedItems = items.map(item => {
            if (item.status === 'Call Not Received') {
              return { ...item, status: 'Pending' };
            }
            return item;
          });
          localStorage.setItem(CALL_LIST_KEY, JSON.stringify(updatedItems));
        }
      }
      localStorage.setItem('lastLoginDate', today);
    }
  }
};

export const migrateLocalDataToSupabase = async () => {
  if (!useSupabase) return;
  
  const leadsData = localStorage.getItem(LEADS_KEY);
  const callListData = localStorage.getItem(CALL_LIST_KEY);
  
  if (!leadsData && !callListData) return;

  try {
    if (leadsData) {
      const leads = JSON.parse(leadsData);
      
      for (const lead of leads) {
        const dbLead = {
          ...mapLeadToDb(lead),
          user_id: null
        };
        
        const { error } = await supabase.from('leads').upsert(dbLead);
        if (error) console.error('Failed to migrate lead:', error);
        
        if (lead.bookingHistory && lead.bookingHistory.length > 0) {
          const bookingInserts = lead.bookingHistory.map(h => ({
            lead_id: lead.id,
            previous_date: h.previousDate,
            previous_time: h.previousTime,
            previous_garage: h.previousGarage,
            new_date: h.newDate,
            new_time: h.newTime,
            new_garage: h.newGarage,
            reason: h.reason,
            remarks: h.remarks,
            rescheduled_by: h.rescheduledBy,
            rescheduled_on: h.rescheduledOn
          }));
          await supabase.from('booking_history').upsert(bookingInserts);
        }
        
        if (lead.activityHistory && lead.activityHistory.length > 0) {
          const activityInserts = lead.activityHistory.map(a => ({
            id: a.id || uuidv4(),
            lead_id: lead.id,
            timestamp: a.timestamp,
            outcome: a.outcome,
            notes: a.notes
          }));
          await supabase.from('activity_history').upsert(activityInserts);
        }
      }
      
      localStorage.setItem(`${LEADS_KEY}_migrated`, leadsData);
      localStorage.removeItem(LEADS_KEY);
    }
    
    if (callListData) {
      const items = JSON.parse(callListData);
      const dbItems = items.map(mapCallListToDb);
      
      const { error } = await supabase.from('call_list_items').upsert(dbItems);
      if (error) console.error('Failed to migrate call list:', error);
      else {
        localStorage.setItem(`${CALL_LIST_KEY}_migrated`, callListData);
        localStorage.removeItem(CALL_LIST_KEY);
      }
    }
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  }
};

const BILLING_KEY = 'mechhelp_crm_billing';
const LINE_ITEMS_KEY = 'mechhelp_crm_line_items';
const SETTLEMENTS_KEY = 'mechhelp_crm_settlements';

export const MOCK_GARAGES = [
  { id: 'g1', name: 'Umar Automobiles' },
  { id: 'g2', name: 'V.S Car Care' },
  { id: 'g3', name: 'Shree Govind Automobile' },
  { id: 'g4', name: 'Sarkar Garage' },
  { id: 'g5', name: 'The Engine Room' },
  { id: 'g6', name: 'Car Hub' },
  { id: 'g7', name: 'D & G Auto Care' },
  { id: 'g8', name: 'B.S Autopoint' },
  { id: 'g9', name: 'The Mechanic' },
  { id: 'g10', name: 'Car Way Motors' },
  { id: 'g11', name: 'Good Luck Automobile' },
  { id: 'g12', name: 'New Friends Automobiles and Auto Electrics' },
  { id: 'g13', name: 'S-Drive Auto Care' },
  { id: 'g14', name: 'Shivaji Motors' },
  { id: 'g15', name: 'Fulsunge Automobiles' },
  { id: 'g16', name: 'Moving Wheels Car Garage' },
  { id: 'g17', name: 'Taj Automobiles' },
  { id: 'g18', name: 'Rathi Autoworks' }
];

export const SettlementService = {
  async getGarageList() {
    if (useSupabase) {
      try {
        const { data, error } = await supabase
          .from('garages')
          .select('id, name')
          .eq('is_active', true)
          .order('name', { ascending: true });
        if (error) throw error;
        return data || [];
      } catch (e) {
        const { data, error } = await supabase
          .from('garages')
          .select('id, name')
          .order('name', { ascending: true });
        if (error) throw error;
        return data || [];
      }
    } else {
      await delay();
      return MOCK_GARAGES.map(g => ({ id: g.id, name: g.name }));
    }
  },

  async finalizeBilling(
    bookingId,
    lineItems,
    paidTo,
    preResolvedGarageId,
    preResolvedGarageName,
    discount = 0,
    numberPlate,
    carBrand,
    carModel,
    customerName
  ) {
    if (useSupabase) {
      let resolvedGarageId = preResolvedGarageId ?? null;

      if (!resolvedGarageId) {
        const { data: lead, error: leadErr } = await supabase
          .from('leads')
          .select('garage_assigned, garage_id')
          .eq('id', bookingId)
          .single();

        if (leadErr) throw leadErr;
        if (!lead) throw new Error('Booking not found.');

        resolvedGarageId = lead.garage_id ?? null;

        if (!resolvedGarageId && lead.garage_assigned) {
          const { data: garageByName, error: gnErr } = await supabase
            .from('garages')
            .select('id')
            .ilike('name', lead.garage_assigned.trim())
            .maybeSingle();
          if (gnErr) throw gnErr;
          if (garageByName) resolvedGarageId = garageByName.id;
        }

        if (!resolvedGarageId) {
          const name = lead.garage_assigned || '(none)';
          throw new Error(`Booking garage "${name}" could not be matched to a known garage. Please select a garage from the dropdown.`);
        }
      }

      const leadUpdatePayload = {
        garage_id: resolvedGarageId,
        lead_type: 'Completed',
        ...(preResolvedGarageName ? { garage_assigned: preResolvedGarageName } : {}),
      };
      if (customerName !== undefined && customerName.trim()) leadUpdatePayload.customer_name = customerName.trim();
      if (carBrand !== undefined) leadUpdatePayload.car_brand = carBrand.trim();
      if (carModel !== undefined) leadUpdatePayload.car_model = carModel.trim();
      if (numberPlate !== undefined) leadUpdatePayload.number_plate = numberPlate.trim() || null;

      await supabase
        .from('leads')
        .update(leadUpdatePayload)
        .eq('id', bookingId);

      const { data: existingBilling, error: billCheckErr } = await supabase
        .from('booking_billing')
        .select('id')
        .eq('booking_id', bookingId)
        .maybeSingle();
      if (billCheckErr) throw billCheckErr;
      if (existingBilling) throw new Error('Billing is already finalized for this booking.');

      const calcResult = calculateSettlement(
        lineItems.map(item => ({
          name: item.name,
          amount: Number(item.amount) || 0,
          splitEnabled: !!item.splitEnabled,
          mechhelpPct: Number(item.mechhelpPct) ?? 20,
          garagePct: Number(item.garagePct) ?? 80,
        })),
        paidTo,
        discount
      );

      const billingInsertData = {
        booking_id: bookingId,
        lead_id: bookingId,
        garage_id: resolvedGarageId,
        total_amount: calcResult.totalAmount,
        discount: calcResult.discount,
        paid_to: paidTo,
        status: 'finalized',
      };

      const { data: billing, error: billingErr } = await supabase
        .from('booking_billing')
        .insert(billingInsertData)
        .select('*')
        .single();
      if (billingErr) throw billingErr;

      if (lineItems.length > 0) {
        const { error: liErr } = await supabase.from('billing_line_items').insert(
          lineItems.map(item => ({
            billing_id: billing.id,
            name: item.name,
            amount: Number(item.amount) || 0,
            split_enabled: !!item.splitEnabled,
            mechhelp_pct: Number(item.mechhelpPct) ?? 20,
            garage_pct: Number(item.garagePct) ?? 80,
          }))
        );
        if (liErr) throw liErr;
      }

      if (calcResult.grossAmount > 0) {
        const { error: settlErr } = await supabase.from('garage_settlements').insert({
          garage_id: resolvedGarageId,
          billing_id: billing.id,
          lead_id: bookingId,
          net_amount: calcResult.netAmount,
          settled: false,
        });
        if (settlErr) throw settlErr;
      }

      const { error: updateErr } = await supabase
        .from('leads')
        .update({ lead_type: 'Completed' })
        .eq('id', bookingId);
      if (updateErr) throw updateErr;

      return { success: true, billing, calculations: calcResult };

    } else {
      await delay();
      
      const leads = await LeadService.getLeads();
      const leadIndex = leads.findIndex(l => l.id === bookingId);
      if (leadIndex === -1) throw new Error('Booking not found');
      
      const lead = leads[leadIndex];
      const garageName = lead.garageAssigned || '';

      const matchedGarage = MOCK_GARAGES.find(
        g => g.name.toLowerCase().trim() === garageName.toLowerCase().trim()
      ) || MOCK_GARAGES[0];

      const billingsData = localStorage.getItem(BILLING_KEY);
      const billings = billingsData ? JSON.parse(billingsData) : [];
      if (billings.some(b => b.bookingId === bookingId)) {
        throw new Error('Billing is already finalized for this booking.');
      }

      const calcResult = calculateSettlement(
        lineItems.map(item => ({
          name: item.name,
          amount: Number(item.amount) || 0,
          splitEnabled: !!item.splitEnabled,
          mechhelpPct: Number(item.mechhelpPct) ?? 20,
          garagePct: Number(item.garagePct) ?? 80,
        })),
        paidTo,
        discount
      );

      const billingId = uuidv4();
      const newBilling = {
        id: billingId,
        bookingId,
        leadId: bookingId,
        garageId: matchedGarage.id,
        totalAmount: calcResult.totalAmount,
        discount: calcResult.discount,
        paidTo,
        status: 'finalized',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const lineItemsData = localStorage.getItem(LINE_ITEMS_KEY);
      const existingLineItems = lineItemsData ? JSON.parse(lineItemsData) : [];
      const newLineItems = lineItems.map(item => ({
        id: uuidv4(),
        billingId,
        name: item.name,
        amount: Number(item.amount) || 0,
        splitEnabled: !!item.splitEnabled,
        mechhelpPct: Number(item.mechhelpPct) ?? 20,
        garagePct: Number(item.garagePct) ?? 80,
        createdAt: new Date().toISOString()
      }));

      const settlementsData = localStorage.getItem(SETTLEMENTS_KEY);
      const settlements = settlementsData ? JSON.parse(settlementsData) : [];

      if (calcResult.grossAmount > 0) {
        const newSettlement = {
          id: uuidv4(),
          garageId: matchedGarage.id,
          billingId,
          leadId: bookingId,
          netAmount: calcResult.netAmount,
          settled: false,
          createdAt: new Date().toISOString()
        };
        settlements.unshift(newSettlement);
        localStorage.setItem(SETTLEMENTS_KEY, JSON.stringify(settlements));
      }

      billings.unshift(newBilling);
      localStorage.setItem(BILLING_KEY, JSON.stringify(billings));
      localStorage.setItem(LINE_ITEMS_KEY, JSON.stringify([...newLineItems, ...existingLineItems]));

      lead.leadType = 'Completed';
      lead.garageAssigned = matchedGarage.name;
      if (customerName !== undefined && customerName.trim()) lead.customerName = customerName.trim();
      if (carBrand !== undefined) lead.carBrand = carBrand.trim();
      if (carModel !== undefined) lead.carModel = carModel.trim();
      if (numberPlate !== undefined) lead.numberPlate = numberPlate.trim();
      leads[leadIndex] = lead;
      localStorage.setItem(LEADS_KEY, JSON.stringify(leads));

      return {
        success: true,
        billing: newBilling,
        calculations: calcResult
      };
    }
  },

  async finalizeDirectBilling(
    customerName,
    carBrand,
    carModel,
    numberPlate,
    bookingDate,
    garageId,
    garageName,
    lineItems,
    paidTo,
    discount = 0
  ) {
    if (useSupabase) {
      const { data: newLead, error: leadErr } = await supabase
        .from('leads')
        .insert({
          customer_name: customerName || 'Walk-in Customer',
          lead_source: 'Direct (Walk-in)',
          identifier: `walkin-${Date.now()}`,
          car_brand: carBrand || 'Unknown',
          car_model: carModel || 'Unknown',
          number_plate: numberPlate ? numberPlate.trim() : null,
          priority: 'Medium',
          lead_type: 'Completed',
          booking_type: 'Direct',
          garage_assigned: garageName,
          garage_id: garageId,
          booking_date_time: bookingDate
            ? new Date(bookingDate).toISOString()
            : new Date().toISOString(),
        })
        .select('id')
        .single();
      if (leadErr) throw leadErr;

      return this.finalizeBilling(newLead.id, lineItems, paidTo, garageId, garageName, discount, numberPlate, carBrand, carModel, customerName);

    } else {
      const newLeadId = uuidv4();
      const now = new Date().toISOString();
      const newLead = {
        id: newLeadId,
        customerName: customerName || 'Walk-in Customer',
        leadSource: 'Direct (Walk-in)',
        identifier: `walkin-${Date.now()}`,
        carBrand: carBrand || 'Unknown',
        carModel: carModel || 'Unknown',
        numberPlate: numberPlate ? numberPlate.trim() : '',
        priority: 'Medium',
        leadType: 'Completed',
        bookingType: 'Direct',
        garageAssigned: garageName,
        garageId,
        bookingDateTime: bookingDate ? new Date(bookingDate).toISOString() : now,
        garageNotified: false,
        isVip: false,
        whatsappBroadcast: false,
        createdDate: now,
        bookingHistory: [],
        activityHistory: [],
      };
      const leadsData = localStorage.getItem(LEADS_KEY);
      const leads = leadsData ? JSON.parse(leadsData) : [];
      leads.unshift(newLead);
      localStorage.setItem(LEADS_KEY, JSON.stringify(leads));

      return this.finalizeBilling(newLeadId, lineItems, paidTo, garageId, garageName, discount, numberPlate, carBrand, carModel, customerName);
    }
  },

  async getGaragesWithBalances() {
    if (useSupabase) {
      const { data: garages, error: garagesErr } = await supabase
        .from('garages')
        .select('id, name')
        .order('name', { ascending: true });
      if (garagesErr) throw garagesErr;

      const { data: allRows, error: settlErr } = await supabase
        .from('garage_settlements')
        .select('garage_id, net_amount');
      if (settlErr) throw settlErr;

      const balancesMap = new Map();
      (allRows || []).forEach((row) => {
        const current = balancesMap.get(row.garage_id) || 0;
        balancesMap.set(row.garage_id, current + Number(row.net_amount || 0));
      });

      return (garages || []).map((g) => ({
        id: g.id,
        name: g.name,
        balance: Math.round((balancesMap.get(g.id) || 0) * 100) / 100,
      }));
    } else {
      await delay();
      const settlementsData = localStorage.getItem(SETTLEMENTS_KEY);
      const settlements = settlementsData ? JSON.parse(settlementsData) : [];

      const balancesMap = new Map();
      settlements.forEach(s => {
        const current = balancesMap.get(s.garageId) || 0;
        balancesMap.set(s.garageId, current + Number(s.netAmount || 0));
      });

      return MOCK_GARAGES.map(g => ({
        id: g.id,
        name: g.name,
        balance: Math.round((balancesMap.get(g.id) || 0) * 100) / 100
      }));
    }
  },

  async getGarageSettlements(garageId) {
    if (useSupabase) {
      const { data: garage, error: garageErr } = await supabase
        .from('garages')
        .select('id, name')
        .eq('id', garageId)
        .maybeSingle();
      if (garageErr) throw garageErr;
      if (!garage) throw new Error('Garage not found');

      const mapSettlementRows = (rows) => {
        let balance = 0;
        (rows || []).forEach((row) => {
          balance += Number(row.net_amount) || 0;
        });

        const formatted = (rows || [])
          .filter((row) => !row.final_settlement && !row.booking_billing?.final_settlement)
          .map((row) => {
            const isSettled = !!row.settled;
            const netAmount = Number(row.net_amount) || 0;

            const billingRow = Array.isArray(row.booking_billing) ? row.booking_billing[0] : row.booking_billing;
            const leadRow = Array.isArray(row.leads) ? row.leads[0] : row.leads;
            const leadId = row.lead_id || leadRow?.id || row.leadId || null;

            return {
              id: row.id,
              leadId,
              garageId: row.garage_id || row.garageId,
              netAmount,
              settled: isSettled,
              settledAt: row.settled_at,
              createdAt: row.created_at,
              customerName: leadRow?.customer_name || row.customerName || 'Unknown Customer',
              bookingDate: leadRow?.booking_date_time || row.bookingDate || row.created_at,
              carBrand: leadRow?.car_brand || row.carBrand || '',
              carModel: leadRow?.car_model || row.carModel || '',
              numberPlate: leadRow?.number_plate || row.numberPlate || '',
              finalSettlement: !!row.final_settlement || !!billingRow?.final_settlement,
              billing: billingRow ? {
                id: billingRow.id,
                totalAmount: Number(billingRow.total_amount),
                discount: Number(billingRow.discount ?? 0),
                paidTo: billingRow.paid_to,
                status: billingRow.status,
                finalSettlement: !!billingRow.final_settlement,
                lineItems: (billingRow.billing_line_items || []).map((item) => ({
                  id: item.id,
                  name: item.name,
                  amount: Number(item.amount),
                  splitEnabled: !!item.split_enabled,
                  mechhelpPct: Number(item.mechhelp_pct),
                  garagePct: Number(item.garage_pct)
                }))
              } : null
            };
          });
        return { formatted, balance };
      };

      const BASE_SELECT = `id, lead_id, garage_id, net_amount, settled, settled_at, created_at, final_settlement, leads (id, customer_name, booking_date_time, car_brand, car_model, number_plate), booking_billing (id, total_amount, paid_to, status, final_settlement, billing_line_items (id, name, amount, split_enabled, mechhelp_pct, garage_pct))`;
      const SELECT_WITH_DISCOUNT = BASE_SELECT.replace('total_amount,', 'total_amount, discount,');
      const LEGACY_SELECT = `id, lead_id, garage_id, net_amount, settled, settled_at, created_at, final_settlement, leads (id, customer_name, booking_date_time, car_brand, car_model), booking_billing (id, total_amount, paid_to, status, final_settlement, billing_line_items (id, name, amount, split_enabled, mechhelp_pct, garage_pct))`;

      let settlements = null;
      const { data: dataWithDiscount, error: errWithDiscount } = await supabase
        .from('garage_settlements')
        .select(SELECT_WITH_DISCOUNT)
        .eq('garage_id', garageId)
        .order('created_at', { ascending: false });

      if (errWithDiscount) {
        const { data: dataWithoutDiscount, error: errWithoutDiscount } = await supabase
          .from('garage_settlements')
          .select(BASE_SELECT)
          .eq('garage_id', garageId)
          .order('created_at', { ascending: false });

        if (errWithoutDiscount) {
          const { data: legacyData, error: legacyErr } = await supabase
            .from('garage_settlements')
            .select(LEGACY_SELECT)
            .eq('garage_id', garageId)
            .order('created_at', { ascending: false });
          if (legacyErr) throw legacyErr;
          settlements = legacyData;
        } else {
          settlements = dataWithoutDiscount;
        }
      } else {
        settlements = dataWithDiscount;
      }

      const { formatted: formattedSettlements, balance } = mapSettlementRows(settlements || []);
      return { garage, balance: Math.round(balance * 100) / 100, settlements: formattedSettlements };
    } else {
      await delay();
      const garage = MOCK_GARAGES.find(g => g.id === garageId);
      if (!garage) throw new Error('Garage not found');
      const settlementsData = localStorage.getItem(SETTLEMENTS_KEY);
      const settlements = settlementsData ? JSON.parse(settlementsData) : [];
      const billingsData = localStorage.getItem(BILLING_KEY);
      const billings = billingsData ? JSON.parse(billingsData) : [];
      const lineItemsData = localStorage.getItem(LINE_ITEMS_KEY);
      const lineItems = lineItemsData ? JSON.parse(lineItemsData) : [];
      const leads = await LeadService.getLeads();

      const allGarageSettlements = settlements.filter(s => s.garageId === garageId);
      const balance = allGarageSettlements.reduce((sum, s) => sum + (Number(s.netAmount) || 0), 0);

      const activeSettlements = allGarageSettlements
        .filter(s => !s.finalSettlement)
        .map(s => {
          const billing = billings.find(b => b.id === s.billingId);
          const lead = leads.find(l => l.id === s.leadId);
          const billingLineItems = lineItems.filter(li => li.billingId === s.billingId);
          return {
            id: s.id,
            leadId: s.leadId,
            garageId: s.garageId,
            netAmount: Number(s.netAmount),
            settled: !!s.settled,
            settledAt: s.settledAt,
            createdAt: s.createdAt,
            customerName: lead?.customerName || 'Unknown Customer',
            bookingDate: lead?.bookingDateTime || s.createdAt,
            carBrand: lead?.carBrand || '',
            carModel: lead?.carModel || '',
            numberPlate: lead?.numberPlate || '',
            finalSettlement: !!s.finalSettlement || !!billing?.finalSettlement,
            billing: billing ? {
              id: billing.id,
              totalAmount: Number(billing.totalAmount),
              discount: Number(billing.discount ?? 0),
              paidTo: billing.paidTo,
              status: billing.status,
              finalSettlement: !!billing.finalSettlement,
              lineItems: billingLineItems.map(li => ({
                id: li.id,
                name: li.name,
                amount: Number(li.amount),
                splitEnabled: !!li.splitEnabled,
                mechhelpPct: Number(li.mechhelpPct),
                garagePct: Number(li.garagePct)
              }))
            } : null
          };
        });

      return { garage, balance: Math.round(balance * 100) / 100, settlements: activeSettlements };
    }
  },

  async getAllSettlements() {
    if (useSupabase) {
      const BASE_SELECT = `id, lead_id, garage_id, net_amount, settled, settled_at, created_at, final_settlement, leads (id, customer_name, booking_date_time, car_brand, car_model, number_plate), booking_billing (id, total_amount, paid_to, status, final_settlement, billing_line_items (id, name, amount, split_enabled, mechhelp_pct, garage_pct))`;
      const SELECT_WITH_DISCOUNT = BASE_SELECT.replace('total_amount,', 'total_amount, discount,');
      const LEGACY_SELECT = `id, lead_id, garage_id, net_amount, settled, settled_at, created_at, final_settlement, leads (id, customer_name, booking_date_time, car_brand, car_model), booking_billing (id, total_amount, paid_to, status, final_settlement, billing_line_items (id, name, amount, split_enabled, mechhelp_pct, garage_pct))`;

      const mapRows = (rows) =>
        (rows || [])
          .filter((row) => !row.final_settlement && !row.booking_billing?.final_settlement)
          .map((row) => {
            const billingRow = Array.isArray(row.booking_billing) ? row.booking_billing[0] : row.booking_billing;
            const leadRow = Array.isArray(row.leads) ? row.leads[0] : row.leads;
            const leadId = row.lead_id || leadRow?.id || row.leadId || null;
            return {
              id: row.id,
              leadId,
              garageId: row.garage_id || row.garageId,
              netAmount: Number(row.net_amount) || 0,
              settled: !!row.settled,
              settledAt: row.settled_at,
              createdAt: row.created_at,
              customerName: leadRow?.customer_name || row.customerName || 'Unknown Customer',
              bookingDate: leadRow?.booking_date_time || row.bookingDate || row.created_at,
              carBrand: leadRow?.car_brand || row.carBrand || '',
              carModel: leadRow?.car_model || row.carModel || '',
              numberPlate: leadRow?.number_plate || row.numberPlate || '',
              finalSettlement: !!row.final_settlement || !!billingRow?.final_settlement,
              billing: billingRow ? {
                id: billingRow.id,
                totalAmount: Number(billingRow.total_amount),
                discount: Number(billingRow.discount ?? 0),
                paidTo: billingRow.paid_to,
                status: billingRow.status,
                finalSettlement: !!billingRow.final_settlement,
                lineItems: (billingRow.billing_line_items || []).map((item) => ({
                  id: item.id,
                  name: item.name,
                  amount: Number(item.amount),
                  splitEnabled: !!item.split_enabled,
                  mechhelpPct: Number(item.mechhelp_pct),
                  garagePct: Number(item.garage_pct)
                }))
              } : null
            };
          });

      let rows = null;
      const { data: dataWithDiscount, error: errWithDiscount } = await supabase
        .from('garage_settlements')
        .select(SELECT_WITH_DISCOUNT)
        .order('created_at', { ascending: false });

      if (errWithDiscount) {
        const { data: dataWithoutDiscount, error: errWithoutDiscount } = await supabase
          .from('garage_settlements')
          .select(BASE_SELECT)
          .order('created_at', { ascending: false });
        if (errWithoutDiscount) {
          const { data: legacyData, error: legacyErr } = await supabase
            .from('garage_settlements')
            .select(LEGACY_SELECT)
            .order('created_at', { ascending: false });
          if (legacyErr) throw legacyErr;
          rows = legacyData;
        } else {
          rows = dataWithoutDiscount;
        }
      } else {
        rows = dataWithDiscount;
      }
      return { settlements: mapRows(rows || []) };
    } else {
      await delay();
      const settlementsData = localStorage.getItem(SETTLEMENTS_KEY);
      const settlements = settlementsData ? JSON.parse(settlementsData) : [];
      const billingsData = localStorage.getItem(BILLING_KEY);
      const billings = billingsData ? JSON.parse(billingsData) : [];
      const lineItemsData = localStorage.getItem(LINE_ITEMS_KEY);
      const lineItems = lineItemsData ? JSON.parse(lineItemsData) : [];
      const leads = await LeadService.getLeads();

      const allSettlements = settlements
        .filter(s => !s.finalSettlement)
        .map(s => {
          const billing = billings.find(b => b.id === s.billingId);
          const lead = leads.find(l => l.id === s.leadId);
          const billingLineItems = lineItems.filter(li => li.billingId === s.billingId);
          return {
            id: s.id,
            leadId: s.leadId,
            garageId: s.garageId,
            netAmount: Number(s.netAmount),
            settled: !!s.settled,
            settledAt: s.settledAt,
            createdAt: s.createdAt,
            customerName: lead?.customerName || 'Unknown Customer',
            bookingDate: lead?.bookingDateTime || s.createdAt,
            carBrand: lead?.carBrand || '',
            carModel: lead?.carModel || '',
            numberPlate: lead?.numberPlate || '',
            finalSettlement: !!s.finalSettlement || !!billing?.finalSettlement,
            billing: billing ? {
              id: billing.id,
              totalAmount: Number(billing.totalAmount),
              discount: Number(billing.discount ?? 0),
              paidTo: billing.paidTo,
              status: billing.status,
              finalSettlement: !!billing.finalSettlement,
              lineItems: billingLineItems.map(li => ({
                id: li.id,
                name: li.name,
                amount: Number(li.amount),
                splitEnabled: !!li.splitEnabled,
                mechhelpPct: Number(li.mechhelpPct),
                garagePct: Number(li.garagePct)
              }))
            } : null
          };
        });
      return { settlements: allSettlements };
    }
  },

  async getHistorySettlements() {
    if (useSupabase) {
      const SELECT_HISTORY = `id, lead_id, garage_id, net_amount, settled, settled_at, created_at, final_settlement, garages (id, name), leads (id, customer_name, booking_date_time, car_brand, car_model, number_plate), booking_billing (id, total_amount, paid_to, status, final_settlement, billing_line_items (id, name, amount, split_enabled, mechhelp_pct, garage_pct))`;
      let rows = null;
      const { data, error } = await supabase
        .from('garage_settlements')
        .select(SELECT_HISTORY)
        .eq('final_settlement', true)
        .order('created_at', { ascending: false });

      if (error) {
        const LEGACY_HISTORY_SELECT = SELECT_HISTORY.replace('discount,', '');
        const { data: legacyData, error: legacyErr } = await supabase
          .from('garage_settlements')
          .select(LEGACY_HISTORY_SELECT)
          .eq('final_settlement', true)
          .order('created_at', { ascending: false });
        if (legacyErr) throw legacyErr;
        rows = legacyData;
      } else {
        rows = data;
      }
      return (rows || [])
        .filter((row) => row.final_settlement === true || row.booking_billing?.final_settlement === true)
        .map((row) => {
          const billingRow = Array.isArray(row.booking_billing) ? row.booking_billing[0] : row.booking_billing;
          const garageRow = Array.isArray(row.garages) ? row.garages[0] : row.garages;
          const leadRow = Array.isArray(row.leads) ? row.leads[0] : row.leads;
          const leadId = row.lead_id || leadRow?.id || row.leadId || null;
          return {
            id: row.id,
            leadId,
            garageId: row.garage_id,
            garageName: garageRow?.name || 'Partner Garage',
            netAmount: Number(row.net_amount) || 0,
            settled: !!row.settled,
            settledAt: row.settled_at,
            createdAt: row.created_at,
            customerName: leadRow?.customer_name || row.customerName || 'Unknown Customer',
            bookingDate: leadRow?.booking_date_time || row.bookingDate || row.created_at,
            carBrand: leadRow?.car_brand || row.carBrand || '',
            carModel: leadRow?.car_model || row.carModel || '',
            numberPlate: leadRow?.number_plate || row.numberPlate || '',
            finalSettlement: true,
            billing: billingRow ? {
              id: billingRow.id,
              totalAmount: Number(billingRow.total_amount),
              discount: Number(billingRow.discount ?? 0),
              paidTo: billingRow.paid_to,
              status: billingRow.status,
              finalSettlement: true,
              lineItems: (billingRow.billing_line_items || []).map((item) => ({
                id: item.id,
                name: item.name,
                amount: Number(item.amount),
                splitEnabled: !!item.split_enabled,
                mechhelpPct: Number(item.mechhelp_pct),
                garagePct: Number(item.garage_pct)
              }))
            } : null
          };
        });
    } else {
      await delay();
      const settlementsData = localStorage.getItem(SETTLEMENTS_KEY);
      const settlements = settlementsData ? JSON.parse(settlementsData) : [];
      const billingsData = localStorage.getItem(BILLING_KEY);
      const billings = billingsData ? JSON.parse(billingsData) : [];
      const lineItemsData = localStorage.getItem(LINE_ITEMS_KEY);
      const lineItems = lineItemsData ? JSON.parse(lineItemsData) : [];
      const leads = await LeadService.getLeads();

      return settlements
        .filter(s => s.finalSettlement)
        .map(s => {
          const billing = billings.find(b => b.id === s.billingId);
          const lead = leads.find(l => l.id === s.leadId);
          const garage = MOCK_GARAGES.find(g => g.id === s.garageId);
          const billingLineItems = lineItems.filter(li => li.billingId === s.billingId);
          return {
            id: s.id,
            leadId: s.leadId,
            garageId: s.garageId,
            garageName: garage?.name || 'Partner Garage',
            netAmount: Number(s.netAmount),
            settled: !!s.settled,
            settledAt: s.settledAt,
            createdAt: s.createdAt,
            customerName: lead?.customerName || 'Unknown Customer',
            bookingDate: lead?.bookingDateTime || s.createdAt,
            carBrand: lead?.carBrand || '',
            carModel: lead?.carModel || '',
            numberPlate: lead?.numberPlate || '',
            finalSettlement: true,
            billing: billing ? {
              id: billing.id,
              totalAmount: Number(billing.totalAmount),
              discount: Number(billing.discount ?? 0),
              paidTo: billing.paidTo,
              status: billing.status,
              finalSettlement: true,
              lineItems: billingLineItems.map(li => ({
                id: li.id,
                name: li.name,
                amount: Number(li.amount),
                splitEnabled: !!li.splitEnabled,
                mechhelpPct: Number(li.mechhelpPct),
                garagePct: Number(li.garagePct)
              }))
            } : null
          };
        });
    }
  },

  async markFinalSettlement(settlementId, billingId) {
    if (useSupabase) {
      if (billingId) {
        await supabase.from('booking_billing').update({ final_settlement: true }).eq('id', billingId);
      }
      await supabase.from('garage_settlements').update({ final_settlement: true }).eq('id', settlementId);
    } else {
      await delay();
      const settlementsData = localStorage.getItem(SETTLEMENTS_KEY);
      if (settlementsData) {
        const list = JSON.parse(settlementsData);
        const updated = list.map(s => s.id === settlementId ? { ...s, finalSettlement: true } : s);
        localStorage.setItem(SETTLEMENTS_KEY, JSON.stringify(updated));
      }
      if (billingId) {
        const billingsData = localStorage.getItem(BILLING_KEY);
        if (billingsData) {
          const list = JSON.parse(billingsData);
          const updated = list.map(b => b.id === billingId ? { ...b, finalSettlement: true } : b);
          localStorage.setItem(BILLING_KEY, JSON.stringify(updated));
        }
      }
    }
  },

  async deleteSettlement(settlementId, billingId, leadId) {
    if (useSupabase) {
      const { error: settlErr } = await supabase.from('garage_settlements').delete().eq('id', settlementId);
      if (settlErr) console.warn('Delete garage_settlement error:', settlErr);
      if (billingId) {
        const { error: billErr } = await supabase.from('booking_billing').delete().eq('id', billingId);
        if (billErr) console.warn('Delete booking_billing error:', billErr);
      }
      if (leadId) {
        const { error: leadErr } = await supabase.from('leads').delete().eq('id', leadId);
        if (leadErr) console.warn('Delete lead error:', leadErr);
      }
    } else {
      await delay();
      const settlementsData = localStorage.getItem(SETTLEMENTS_KEY);
      if (settlementsData) {
        const list = JSON.parse(settlementsData);
        localStorage.setItem(SETTLEMENTS_KEY, JSON.stringify(list.filter(s => s.id !== settlementId)));
      }
      if (billingId) {
        const billingsData = localStorage.getItem(BILLING_KEY);
        if (billingsData) {
          const list = JSON.parse(billingsData);
          localStorage.setItem(BILLING_KEY, JSON.stringify(list.filter(b => b.id !== billingId)));
        }
        const lineItemsData = localStorage.getItem(LINE_ITEMS_KEY);
        if (lineItemsData) {
          const list = JSON.parse(lineItemsData);
          localStorage.setItem(LINE_ITEMS_KEY, JSON.stringify(list.filter(li => li.billingId !== billingId)));
        }
      }
      if (leadId) {
        const leadsData = localStorage.getItem(LEADS_KEY);
        if (leadsData) {
          const list = JSON.parse(leadsData);
          localStorage.setItem(LEADS_KEY, JSON.stringify(list.filter(l => l.id !== leadId)));
        }
      }
    }
  },

  async updateSettlementBilling(
    settlementId,
    billingId,
    leadId,
    data
  ) {
    const calc = calculateSettlement(data.lineItems, data.paidTo, data.discount);
    if (useSupabase) {
      if (leadId) {
        const { error: leadErr } = await supabase.from('leads').update({
          customer_name: data.customerName,
          car_brand: data.carBrand,
          car_model: data.carModel,
          number_plate: data.numberPlate || null,
          booking_date_time: data.bookingDate ? new Date(data.bookingDate).toISOString() : new Date().toISOString(),
          garage_id: data.garageId || null,
          garage_assigned: data.garageName || null,
        }).eq('id', leadId);
        if (leadErr) {
          console.error('Failed to update lead:', leadErr);
          throw new Error(`Failed to update lead: ${leadErr.message}`);
        }
      }
      const { error: billErr } = await supabase.from('booking_billing').update({
        total_amount: calc.totalAmount,
        discount: calc.discount,
        paid_to: data.paidTo,
        garage_id: data.garageId || null,
      }).eq('id', billingId);
      if (billErr) {
        console.error('Failed to update booking_billing:', billErr);
        throw new Error(`Failed to update billing: ${billErr.message}`);
      }

      const { error: delLineErr } = await supabase.from('billing_line_items').delete().eq('billing_id', billingId);
      if (delLineErr) console.warn('Delete billing_line_items error:', delLineErr);

      if (data.lineItems.length > 0) {
        const inserts = data.lineItems.map((item) => ({
          billing_id: billingId,
          name: item.name,
          amount: Number(item.amount) || 0,
          split_enabled: item.splitEnabled,
          mechhelp_pct: item.splitEnabled ? item.mechhelpPct : 0,
          garage_pct: item.splitEnabled ? item.garagePct : 100,
        }));
        const { error: insLineErr } = await supabase.from('billing_line_items').insert(inserts);
        if (insLineErr) {
          console.error('Failed to insert billing_line_items:', insLineErr);
          throw new Error(`Failed to update line items: ${insLineErr.message}`);
        }
      }
      const { error: settlErr } = await supabase.from('garage_settlements').update({
        net_amount: calc.netAmount,
        garage_id: data.garageId || null,
      }).eq('id', settlementId);
      if (settlErr) {
        console.error('Failed to update garage_settlements:', settlErr);
        throw new Error(`Failed to update settlement balance: ${settlErr.message}`);
      }
    } else {
      await delay();
      if (leadId) {
        const leadsData = localStorage.getItem(LEADS_KEY);
        if (leadsData) {
          const list = JSON.parse(leadsData);
          const updated = list.map(l => l.id === leadId ? {
            ...l,
            customerName: data.customerName,
            carBrand: data.carBrand,
            carModel: data.carModel,
            numberPlate: data.numberPlate,
            bookingDateTime: data.bookingDate ? new Date(data.bookingDate).toISOString() : l.bookingDateTime,
            garageId: data.garageId,
            garageAssigned: data.garageName,
          } : l);
          localStorage.setItem(LEADS_KEY, JSON.stringify(updated));
        }
      }
      const billingsData = localStorage.getItem(BILLING_KEY);
      if (billingsData) {
        const list = JSON.parse(billingsData);
        const updated = list.map(b => b.id === billingId ? {
          ...b,
          totalAmount: calc.totalAmount,
          discount: calc.discount,
          paidTo: data.paidTo,
          garageId: data.garageId,
        } : b);
        localStorage.setItem(BILLING_KEY, JSON.stringify(updated));
      }
      const lineItemsData = localStorage.getItem(LINE_ITEMS_KEY);
      const list = lineItemsData ? JSON.parse(lineItemsData) : [];
      const filtered = list.filter(li => li.billingId !== billingId);
      const newItems = data.lineItems.map((item) => ({
        id: uuidv4(),
        billingId,
        name: item.name,
        amount: item.amount,
        splitEnabled: item.splitEnabled,
        mechhelpPct: item.splitEnabled ? item.mechhelpPct : 0,
        garagePct: item.splitEnabled ? item.garagePct : 100,
      }));
      localStorage.setItem(LINE_ITEMS_KEY, JSON.stringify([...filtered, ...newItems]));
      const settlementsData = localStorage.getItem(SETTLEMENTS_KEY);
      if (settlementsData) {
        const slist = JSON.parse(settlementsData);
        const updated = slist.map(s => s.id === settlementId ? {
          ...s,
          netAmount: calc.netAmount,
          garageId: data.garageId,
        } : s);
        localStorage.setItem(SETTLEMENTS_KEY, JSON.stringify(updated));
      }
    }
  },

  async settleGarage(garageId) {
    if (useSupabase) {
      const now = new Date().toISOString();
      const { data, error } = await supabase.from('garage_settlements').update({ settled: true, settled_at: now }).eq('garage_id', garageId).eq('settled', false).select('*');
      if (error) throw error;
      return { success: true, count: data?.length || 0 };
    } else {
      await delay();
      const settlementsData = localStorage.getItem(SETTLEMENTS_KEY);
      const settlements = settlementsData ? JSON.parse(settlementsData) : [];
      let count = 0;
      const updatedSettlements = settlements.map(s => {
        if (s.garageId === garageId && !s.settled) {
          count++;
          return { ...s, settled: true, settledAt: new Date().toISOString() };
        }
        return s;
      });
      localStorage.setItem(SETTLEMENTS_KEY, JSON.stringify(updatedSettlements));
      return { success: true, count };
    }
  },

  async recordPayment(
    garageId,
    amount,
    direction,
    _currentBalance
  ) {
    if (amount <= 0) throw new Error('Payment amount must be greater than zero.');
    const signedAmount = Math.abs(amount);
    const netAmount = direction === 'mechhelp_to_garage' ? signedAmount : -signedAmount;
    if (useSupabase) {
      const { error } = await supabase.from('garage_settlements').insert({
        garage_id: garageId,
        billing_id: null,
        lead_id: null,
        net_amount: netAmount,
        settled: true,
        settled_at: new Date().toISOString(),
      });
      if (error) throw error;
      return { success: true, amount: signedAmount, netAmount, direction };
    } else {
      await delay();
      const settlementsData = localStorage.getItem(SETTLEMENTS_KEY);
      const settlements = settlementsData ? JSON.parse(settlementsData) : [];
      settlements.unshift({
        id: uuidv4(),
        garageId,
        billingId: null,
        leadId: null,
        netAmount,
        settled: true,
        settledAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        isPaymentRow: true,
        direction,
      });
      localStorage.setItem(SETTLEMENTS_KEY, JSON.stringify(settlements));
      return { success: true, amount: signedAmount, netAmount, direction };
    }
  },

  async addGarage(name) {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Garage name cannot be empty.');
    if (useSupabase) {
      const { data, error } = await supabase.from('garages').insert({ name: trimmed }).select('id, name').single();
      if (error) throw error;
      return data;
    } else {
      await delay();
      if (MOCK_GARAGES.some(g => g.name.toLowerCase() === trimmed.toLowerCase())) {
        throw new Error(`A garage named "${trimmed}" already exists.`);
      }
      const newGarage = { id: `g${Date.now()}`, name: trimmed };
      MOCK_GARAGES.push(newGarage);
      return newGarage;
    }
  },

  async removeGarage(garageId, currentBalance) {
    if (Math.round(currentBalance * 100) !== 0) {
      throw new Error(`Cannot remove this garage — it has an outstanding balance of ₹${Math.abs(currentBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}. Settle the balance first.`);
    }
    if (useSupabase) {
      const { error } = await supabase.from('garages').update({ is_active: false }).eq('id', garageId);
      if (error) {
        const { error: deleteErr } = await supabase.from('garages').delete().eq('id', garageId);
        if (deleteErr) throw deleteErr;
      }
    } else {
      await delay();
      const idx = MOCK_GARAGES.findIndex(g => g.id === garageId);
      if (idx !== -1) MOCK_GARAGES.splice(idx, 1);
    }
  },
};

const DGB_STORAGE_KEY = 'mechhelp_daily_garage_board';

const mapDbToDgbEntry = (row) => ({
  id: row.id,
  garageId: row.garage_id,
  customerName: row.customer_name,
  carName: row.car_name,
  numberPlate: row.number_plate || undefined,
  notes: row.notes ?? '',
  status: row.status ?? 'pending',
  source: row.source ?? 'custom',
  leadId: row.lead_id || undefined,
  createdDate: row.created_date,
  createdAt: row.created_at,
});

export const DailyGarageBoardService = {
  async getEntries(date) {
    if (useSupabase) {
      const { data, error } = await supabase
        .from('daily_garage_board_entries')
        .select('*')
        .eq('created_date', date)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []).map(mapDbToDgbEntry);
    } else {
      await delay();
      const raw = localStorage.getItem(DGB_STORAGE_KEY);
      const all = raw ? JSON.parse(raw) : [];
      return all.filter(e => e.createdDate === date);
    }
  },

  async addEntry(data) {
    if (useSupabase) {
      const { data: row, error } = await supabase
        .from('daily_garage_board_entries')
        .insert({
          garage_id: data.garageId,
          customer_name: data.customerName.trim(),
          car_name: data.carName.trim(),
          number_plate: data.numberPlate?.trim() || null,
          notes: data.notes?.trim() ?? '',
          status: 'pending',
          source: data.source || 'custom',
          lead_id: data.leadId || null,
          created_date: data.createdDate,
        })
        .select('*')
        .single();
      if (error) throw error;
      return mapDbToDgbEntry(row);
    } else {
      await delay();
      const raw = localStorage.getItem(DGB_STORAGE_KEY);
      const all = raw ? JSON.parse(raw) : [];
      const newEntry = {
        id: uuidv4(),
        garageId: data.garageId,
        customerName: data.customerName.trim(),
        carName: data.carName.trim(),
        numberPlate: data.numberPlate?.trim() || undefined,
        notes: data.notes?.trim() ?? '',
        status: 'pending',
        source: data.source || 'custom',
        leadId: data.leadId || undefined,
        createdDate: data.createdDate,
        createdAt: new Date().toISOString(),
      };
      all.push(newEntry);
      localStorage.setItem(DGB_STORAGE_KEY, JSON.stringify(all));
      return newEntry;
    }
  },

  async updateEntry(id, patch) {
    if (useSupabase) {
      const dbPatch = {};
      if (patch.notes !== undefined) dbPatch.notes = patch.notes;
      if (patch.status !== undefined) dbPatch.status = patch.status;
      if (patch.customerName !== undefined) dbPatch.customer_name = patch.customerName.trim();
      if (patch.carName !== undefined) dbPatch.car_name = patch.carName.trim();
      if (patch.numberPlate !== undefined) dbPatch.number_plate = patch.numberPlate.trim() || null;

      const { data: row, error } = await supabase
        .from('daily_garage_board_entries')
        .update(dbPatch)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return mapDbToDgbEntry(row);
    } else {
      await delay();
      const raw = localStorage.getItem(DGB_STORAGE_KEY);
      const all = raw ? JSON.parse(raw) : [];
      const idx = all.findIndex(e => e.id === id);
      if (idx === -1) throw new Error('Entry not found');
      if (patch.notes !== undefined) all[idx].notes = patch.notes;
      if (patch.status !== undefined) all[idx].status = patch.status;
      if (patch.customerName !== undefined) all[idx].customerName = patch.customerName.trim();
      if (patch.carName !== undefined) all[idx].carName = patch.carName.trim();
      if (patch.numberPlate !== undefined) all[idx].numberPlate = patch.numberPlate.trim() || undefined;
      localStorage.setItem(DGB_STORAGE_KEY, JSON.stringify(all));
      return all[idx];
    }
  },

  async deleteEntry(id) {
    if (useSupabase) {
      const { error } = await supabase
        .from('daily_garage_board_entries')
        .delete()
        .eq('id', id);
      if (error) throw error;
    } else {
      await delay();
      const raw = localStorage.getItem(DGB_STORAGE_KEY);
      const all = raw ? JSON.parse(raw) : [];
      const filtered = all.filter(e => e.id !== id);
      localStorage.setItem(DGB_STORAGE_KEY, JSON.stringify(filtered));
    }
  },

  async lookupByTag(tag) {
    const trimmed = tag.trim();
    if (!trimmed) return null;

    if (useSupabase) {
      const { data: leadData, error: leadErr } = await supabase
        .from('leads')
        .select('id, customer_name, car_brand, car_model, number_plate')
        .ilike('identifier', trimmed)
        .maybeSingle();

      if (!leadErr && leadData) {
        return {
          customerName: leadData.customer_name,
          carName: [leadData.car_brand, leadData.car_model].filter(Boolean).join(' ').trim(),
          numberPlate: leadData.number_plate || undefined,
          leadId: leadData.id,
        };
      }

      const { data: callData, error: callErr } = await supabase
        .from('call_list_items')
        .select('linked_lead_id')
        .ilike('sales_iq_tag', trimmed)
        .maybeSingle();

      if (!callErr && callData?.linked_lead_id) {
        const { data: linkedLead } = await supabase
          .from('leads')
          .select('id, customer_name, car_brand, car_model, number_plate')
          .eq('id', callData.linked_lead_id)
          .maybeSingle();

        if (linkedLead) {
          return {
            customerName: linkedLead.customer_name,
            carName: [linkedLead.car_brand, linkedLead.car_model].filter(Boolean).join(' ').trim(),
            numberPlate: linkedLead.number_plate || undefined,
            leadId: linkedLead.id,
          };
        }
      }

      return null;
    } else {
      await delay();
      const raw = localStorage.getItem(LEADS_KEY);
      const leads = raw ? JSON.parse(raw) : [];
      const match = leads.find(
        l => (l.identifier || '').trim().toLowerCase() === trimmed.toLowerCase()
      );
      if (match) {
        const brand = match.carBrand || match.car_brand || '';
        const model = match.carModel || match.car_model || '';
        return {
          customerName: match.customerName || match.customer_name || '',
          carName: [brand, model].filter(Boolean).join(' ').trim(),
          numberPlate: match.numberPlate || match.number_plate || undefined,
          leadId: match.id,
        };
      }

      const callListRaw = localStorage.getItem('mechhelp_call_list_items');
      const callItems = callListRaw ? JSON.parse(callListRaw) : [];
      const callMatch = callItems.find(
        c => (c.salesIqTag || c.sales_iq_tag || '').trim().toLowerCase() === trimmed.toLowerCase()
      );
      if (callMatch?.linkedLeadId) {
        const linked = leads.find(l => l.id === callMatch.linkedLeadId);
        if (linked) {
          const brand = linked.carBrand || linked.car_brand || '';
          const model = linked.carModel || linked.car_model || '';
          return {
            customerName: linked.customerName || linked.customer_name || '',
            carName: [brand, model].filter(Boolean).join(' ').trim(),
            numberPlate: linked.numberPlate || linked.number_plate || undefined,
            leadId: linked.id,
          };
        }
      }

      return null;
    }
  },
};
