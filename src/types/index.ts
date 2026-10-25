export type LeadSource = 'SalesIQ' | 'Direct Call' | 'Referral';
export type Salesperson = 'Choice' | 'Nothing' | 'Tecno' | 'Realme';
export type LeadType = 'Fresh Lead' | 'Call Not Received' | 'Details Shared' | 'Shared Quotation' | 'Retarget' | 'Booked' | 'Completed' | 'Lost' | 'Redirected' | 'Rescheduled';
export type BookingType = 'Pickup' | 'Garage Visit';
export type Priority = 'High' | 'Medium' | 'Low';
export type ServiceType = 'Service' | 'Painting/Denting';

export interface RescheduleHistoryEntry {
  previousDate: string;
  previousTime: string;
  previousGarage?: string;
  newDate: string;
  newTime: string;
  newGarage?: string;
  reason: string;
  remarks: string;
  rescheduledBy: string;
  rescheduledOn: string;
}

export interface CallActivity {
  id: string;
  timestamp: string;
  outcome: string;
  notes?: string;
}

export interface Lead {
  id: string;
  customerName: string;
  leadSource: LeadSource;
  salesperson?: Salesperson;
  identifier: string; // SalesIQ Tag OR Last 4 Digits
  carBrand: string;
  carModel: string;
  priority: Priority;
  leadType: LeadType;
  bookingType?: BookingType;
  garageAssigned?: string;
  garageId?: string;
  bookingDateTime?: string;
  bookingHistory?: RescheduleHistoryEntry[];
  activityHistory?: CallActivity[];
  garageNotified: boolean;
  nextFollowUpDate: string;
  lastContactedDate: string;
  isVip: boolean;
  whatsappBroadcast: boolean;
  retargetTimeSlot?: 'morning' | 'evening' | null;
  detailsSharedAt?: string | null;
  serviceType?: ServiceType[];
  numberPlate?: string;
  fuelType?: string;
  customYear?: string;
  notes: string;
  rating?: number | null;
  feedbackNotes?: string | null;
  createdDate: string;
}

export type SujalStatus = 'Pending' | 'Answered' | 'Call Not Received' | 'Details Shared' | 'Retargeted' | 'Booked' | 'Completed' | 'Lost' | 'Not Interested';

export interface SujalCallListItem {
  id: string;
  salesIqTag: string;
  priority: string;
  status: SujalStatus;
  linkedLeadId?: string;
  dateAdded: string;
}

export interface Garage {
  id: string;
  name: string;
}

export interface CarBrandModel {
  brand: string;
  models: string[];
}

export interface LineItem {
  id?: string;
  billingId?: string;
  name: string;
  amount: number;
  splitEnabled: boolean;
  mechhelpPct: number;
  garagePct: number;
}

export interface BookingBilling {
  id: string;
  bookingId: string;
  leadId: string;
  garageId: string;
  totalAmount: number;
  discount?: number;
  paidTo: 'garage' | 'mechhelp';
  status: 'draft' | 'finalized';
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  lineItems?: LineItem[];
}

export interface GarageSettlement {
  id: string;
  garageId: string;
  billingId: string;
  leadId: string;
  netAmount: number;
  settled: boolean;
  settledAt?: string;
  settledBy?: string;
  createdAt: string;
  customerName?: string;
  bookingDate?: string;
  carBrand?: string;
  carModel?: string;
  numberPlate?: string;
}

export interface GarageWithBalance {
  id: string;
  name: string;
  contactPhone?: string;
  address?: string;
  balance: number;
}

// Daily Garage Board
export type DailyGarageEntryStatus = 'pending' | 'picked_up' | 'arrived' | 'done';
export type DailyGarageEntrySource = 'salesiq' | 'custom';

export interface DailyGarageEntry {
  id: string;
  garageId: string;
  customerName: string;
  carName: string;
  numberPlate?: string;
  notes: string;
  status: DailyGarageEntryStatus;
  source: DailyGarageEntrySource;
  leadId?: string;
  createdDate: string; // ISO date string YYYY-MM-DD
  createdAt: string;
}


