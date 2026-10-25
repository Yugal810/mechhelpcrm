import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import LeadMeta from "../models/LeadMeta.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const supabaseUrl =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://odwsohmlwukrkacvqfso.supabase.co";
const supabaseKey =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kd3NvaG1sd3VrcmthY3ZxZnNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0NzExNDgsImV4cCI6MjEwNTA0NzE0OH0.lbg_q5wjc5zxpdf30Nhj02t6-ps4KNZ6uLiMR-AxTBM";

const supabase = createClient(supabaseUrl, supabaseKey);

const PREMIUM_BRANDS = [
  "mercedes-benz",
  "mercedes",
  "bmw",
  "audi",
  "volvo",
  "land rover",
  "porsche",
  "jaguar",
  "lexus",
  "ferrari",
  "lamborghini",
  "rolls-royce",
  "bentley",
  "maserati",
  "aston martin",
];

export function checkIsPremium(brandStr, modelStr) {
  const bLower = (brandStr || "").trim().toLowerCase();
  const mLower = (modelStr || "").trim().toLowerCase();
  if (PREMIUM_BRANDS.some((pb) => bLower.includes(pb))) return true;
  return false;
}

export function getTomorrowYmd() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function createOrUpdateLeadFromSearch(data = {}) {
  const {
    customerName,
    customerPhone,
    car,
    modelQuery,
    year,
    fuelType,
  } = data;

  const tag = (customerPhone || "").trim();
  const name = (customerName || "").trim() || (tag ? `Customer ${tag}` : "Customer");

  // Determine car brand and model (without year in model name)
  let carBrand = car?.brand || "";
  let carModel = "";
  if (car) {
    carModel = String(car.model || "").trim();
  } else if (modelQuery) {
    const words = modelQuery.trim().split(" ");
    carBrand = words[0] || "Unknown";
    carModel = words.slice(1).join(" ").trim();
    if (!carModel.trim()) carModel = modelQuery.trim();
  } else {
    carBrand = "Unknown";
    carModel = "Unknown";
  }
  // Strip any 4-digit years from carModel so year is never inserted inside model name
  carModel = carModel.replace(/\b(19\d{2}|20\d{2})\b/g, "").replace(/\s+/g, " ").trim();

  const isVip = checkIsPremium(carBrand, carModel);
  const nextFollowUpDate = getTomorrowYmd();
  const createdDate = new Date().toISOString();
  const identifier = tag || `aisensy-${Date.now()}`;
  const effectiveFuelType = fuelType || car?.fuelType || null;

  try {
    if (tag) {
      // Check if lead already exists for this SalesIQ tag
      const { data: existingLead, error: findError } = await supabase
        .from("leads")
        .select("id")
        .eq("identifier", tag)
        .eq("lead_source", "SalesIQ")
        .maybeSingle();

      if (findError) {
        console.warn("⚠️ Error checking existing lead in Supabase:", findError.message);
      }

      if (existingLead) {
        console.log(`📝 Updating existing lead ${existingLead.id} for SalesIQ tag: ${tag}`);

        const updatePayload = {
          customer_name: name,
          car_brand: carBrand,
          car_model: carModel,
          next_follow_up_date: nextFollowUpDate,
          priority: isVip ? "High" : "Medium",
          is_vip: isVip,
          number_plate: null, // No number plate inserted from referral
          fuel_type: effectiveFuelType,
        };

        let { error: updateError } = await supabase
          .from("leads")
          .update(updatePayload)
          .eq("id", existingLead.id);

        if (updateError && updateError.message && updateError.message.includes("fuel_type")) {
          // Fallback if fuel_type column is not in DB table
          delete updatePayload.fuel_type;
          const retry = await supabase
            .from("leads")
            .update(updatePayload)
            .eq("id", existingLead.id);
          updateError = retry.error;
        }

        if (updateError) {
          console.error("⚠️ Failed to update existing lead:", updateError.message);
        } else {
          console.log(`✅ Successfully updated lead ${existingLead.id}`);
        }

        if (effectiveFuelType && (tag || existingLead.id)) {
          try {
            await LeadMeta.findOneAndUpdate(
              { $or: [{ leadId: existingLead.id }, { identifier: tag }] },
              { leadId: existingLead.id, identifier: tag, fuelType: effectiveFuelType, customYear: year || "" },
              { upsert: true, new: true }
            );
          } catch (mErr) {
            console.warn("⚠️ Failed to update LeadMeta in Mongo:", mErr.message);
          }
        }

        return { success: true, leadId: existingLead.id, action: "updated" };
      }
    }

    // Insert brand new lead without any notes, and with number_plate as null
    const newLeadId = uuidv4();
    const newLead = {
      id: newLeadId,
      customer_name: name,
      lead_source: "SalesIQ",
      salesperson: "Nothing",
      identifier: identifier,
      car_brand: carBrand,
      car_model: carModel,
      priority: isVip ? "High" : "Medium",
      lead_type: "Fresh Lead",
      booking_type: null,
      garage_assigned: null,
      garage_id: null,
      booking_date_time: null,
      garage_notified: false,
      next_follow_up_date: nextFollowUpDate,
      last_contacted_date: createdDate,
      is_vip: isVip,
      whatsapp_broadcast: false,
      retarget_time_slot: null,
      details_shared_at: null,
      number_plate: null, // No number plate inserted from referral
      service_type: ["Service"],
      notes: null, // No notes added through this search as requested
      created_date: createdDate,
      fuel_type: effectiveFuelType,
    };

    let { data: insertedData, error: insertError } = await supabase
      .from("leads")
      .insert([newLead])
      .select("id")
      .single();

    if (insertError && insertError.message && insertError.message.includes("fuel_type")) {
      // Fallback if fuel_type column is not in DB table
      delete newLead.fuel_type;
      const retry = await supabase
        .from("leads")
        .insert([newLead])
        .select("id")
        .single();
      insertedData = retry.data;
      insertError = retry.error;
    }

    if (insertError) {
      console.error("⚠️ Failed to insert new lead in Supabase:", insertError.message);
      return { success: false, error: insertError.message };
    }

    if (effectiveFuelType) {
      try {
        await LeadMeta.findOneAndUpdate(
          { $or: [{ leadId: newLeadId }, { identifier: identifier }] },
          { leadId: newLeadId, identifier: identifier, fuelType: effectiveFuelType, customYear: year || "" },
          { upsert: true, new: true }
        );
      } catch (mErr) {
        console.warn("⚠️ Failed to save LeadMeta in Mongo:", mErr.message);
      }
    }

    console.log(`✅ Successfully created new lead ${newLeadId} for customer "${name}" (${identifier})`);
    return { success: true, leadId: newLeadId, action: "created" };
  } catch (err) {
    console.error("⚠️ Exception in createOrUpdateLeadFromSearch:", err.message);
    return { success: false, error: err.message };
  }
}

export function parseBookingDate(rawDate) {
  if (!rawDate) return new Date().toISOString().split("T")[0];
  const s = String(rawDate).trim().toLowerCase();
  const now = new Date();

  if (s === "today") {
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  if (s === "tomorrow") {
    const tmrw = new Date(now);
    tmrw.setDate(tmrw.getDate() + 1);
    const yyyy = tmrw.getFullYear();
    const mm = String(tmrw.getMonth() + 1).padStart(2, "0");
    const dd = String(tmrw.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  // Check DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const dmyMatch = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dmyMatch) {
    const dd = String(parseInt(dmyMatch[1], 10)).padStart(2, "0");
    const mm = String(parseInt(dmyMatch[2], 10)).padStart(2, "0");
    let yyyy = dmyMatch[3];
    if (yyyy.length === 2) {
      yyyy = "20" + yyyy;
    }
    return `${yyyy}-${mm}-${dd}`;
  }

  // Check DD-MM or DD/MM
  const dmMatch = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})$/);
  if (dmMatch) {
    const dd = String(parseInt(dmMatch[1], 10)).padStart(2, "0");
    const mm = String(parseInt(dmMatch[2], 10)).padStart(2, "0");
    const yyyy = now.getFullYear();
    return `${yyyy}-${mm}-${dd}`;
  }

  // Check YYYY-MM-DD
  const ymdMatch = s.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (ymdMatch) {
    const yyyy = ymdMatch[1];
    const mm = String(parseInt(ymdMatch[2], 10)).padStart(2, "0");
    const dd = String(parseInt(ymdMatch[3], 10)).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  const parsed = new Date(rawDate);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }

  return now.toISOString().split("T")[0];
}

export function parseBookingMode(rawMode) {
  if (!rawMode) return "Garage Visit";
  const s = String(rawMode).toLowerCase();
  if (s.includes("pick") || s.includes("drop")) {
    return "Pickup";
  }
  return "Garage Visit";
}

export function parsePlanText(planRaw) {
  if (!planRaw) return { notes: "", extractedBrand: "", extractedModel: "", extractedFuel: "" };
  const rawStr = String(planRaw).replace(/\\n/g, "\n").trim();

  let extractedBrand = "";
  let extractedModel = "";
  let extractedFuel = "";

  const bookedForMatch = rawStr.match(/Booked For\s*-\s*\*?([^\n*]+)\*?/i);
  if (bookedForMatch) {
    const fullVeh = bookedForMatch[1].trim();
    const fuelMatch = fullVeh.match(/\((Petrol|Diesel|CNG|Electric|Hybrid)\)/i);
    if (fuelMatch) {
      extractedFuel = fuelMatch[1];
    }
    const cleanVeh = fullVeh.replace(/\([^)]*\)/g, "").replace(/\*/g, "").trim();
    const vehWithoutYear = cleanVeh.replace(/\b(19\d{2}|20\d{2})\b/g, "").replace(/\s+/g, " ").trim();
    const parts = vehWithoutYear.split(" ").filter(Boolean);
    if (parts.length > 0) {
      extractedBrand = parts[0];
      extractedModel = parts.slice(1).join(" ").trim();
    }
  }

  // Extract only Plan Selected and Final Price for the notes
  const planMatch = rawStr.match(/(?:🔧\s*)?(?:Plan Selected|Chosen Plan)\s*[-:]\s*\*?([^\n*]+)\*?/i);
  const priceMatch = rawStr.match(/(?:💰\s*)?(?:Final Price|Price)\s*[-:]\s*\*?([^\n*]+)\*?/i);

  let notes = "";
  if (planMatch && priceMatch) {
    notes = `Plan Selected - *${planMatch[1].trim()}*\nFinal Price - *${priceMatch[1].trim()}*`;
  } else if (planMatch) {
    notes = `Plan Selected - *${planMatch[1].trim()}*`;
  } else if (priceMatch) {
    notes = `Final Price - *${priceMatch[1].trim()}*`;
  } else {
    notes = rawStr;
  }

  return { notes, extractedBrand, extractedModel, extractedFuel };
}

export async function updateLeadToBooked(bookingData = {}) {
  const {
    phone,
    MobileNumber,
    customerPhone,
    plan,
    selectedPlan,
    garage,
    date,
    C4,
    c4,
    Mode,
    mode,
  } = bookingData;

  const rawPhone = phone || MobileNumber || customerPhone || "";
  const tag = String(rawPhone).replace(/[\{\}\$]/g, "").trim();

  const rawDate = date || C4 || c4 || "";
  const bookingYmd = parseBookingDate(rawDate);
  const bookingDateTime = `${bookingYmd}T00:00:00.000Z`;

  const rawMode = Mode || mode || "";
  const bookingType = parseBookingMode(rawMode);

  const rawGarage = String(garage || "").replace(/[\{\}\$]/g, "").trim();
  let garageAssigned = rawGarage;
  let garageId = null;

  if (rawGarage) {
    try {
      const { data: gMatch } = await supabase
        .from("garages")
        .select("id, name")
        .ilike("name", rawGarage)
        .maybeSingle();

      if (gMatch) {
        garageId = gMatch.id;
        garageAssigned = gMatch.name;
      }
    } catch (gErr) {
      console.warn("⚠️ Garage lookup error:", gErr.message);
    }
  }

  const { notes, extractedBrand, extractedModel, extractedFuel } = parsePlanText(plan || selectedPlan || "");

  try {
    let existingLead = null;
    if (tag) {
      const { data: leadMatch } = await supabase
        .from("leads")
        .select("*")
        .eq("identifier", tag)
        .eq("lead_source", "SalesIQ")
        .order("created_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      existingLead = leadMatch;
    }

    if (existingLead) {
      console.log(`📝 Updating lead ${existingLead.id} (${tag}) to Booked`);
      const updatePayload = {
        lead_type: "Booked",
        booking_type: bookingType,
        garage_assigned: garageAssigned || existingLead.garage_assigned,
        garage_id: garageId || existingLead.garage_id,
        booking_date_time: bookingDateTime,
        next_follow_up_date: bookingYmd,
        notes: notes || existingLead.notes,
        last_contacted_date: new Date().toISOString(),
      };

      if (extractedBrand && (!existingLead.car_brand || existingLead.car_brand === "Unknown")) {
        updatePayload.car_brand = extractedBrand;
      }
      if (extractedModel && (!existingLead.car_model || existingLead.car_model === "Unknown")) {
        updatePayload.car_model = extractedModel;
      }
      if (extractedFuel) {
        updatePayload.fuel_type = extractedFuel;
      }

      let { error: updateError } = await supabase
        .from("leads")
        .update(updatePayload)
        .eq("id", existingLead.id);

      if (updateError && updateError.message && updateError.message.includes("fuel_type")) {
        delete updatePayload.fuel_type;
        const retry = await supabase
          .from("leads")
          .update(updatePayload)
          .eq("id", existingLead.id);
        updateError = retry.error;
      }

      if (updateError) {
        console.error("⚠️ Failed to update lead to Booked:", updateError.message);
        return { success: false, error: updateError.message };
      }

      console.log(`✅ Successfully updated lead ${existingLead.id} to Booked!`);
      return {
        success: true,
        leadId: existingLead.id,
        bookingDate: bookingYmd,
        bookingType,
        garageAssigned,
        notes,
      };
    } else {
      // If no lead existed, create a new one as Booked
      const newLeadId = uuidv4();
      const newLead = {
        id: newLeadId,
        customer_name: tag ? `Customer ${tag}` : "Customer",
        lead_source: "SalesIQ",
        salesperson: "Nothing",
        identifier: tag || `booking-${Date.now()}`,
        car_brand: extractedBrand || "Unknown",
        car_model: extractedModel || "Unknown",
        priority: "Medium",
        lead_type: "Booked",
        booking_type: bookingType,
        garage_assigned: garageAssigned || null,
        garage_id: garageId || null,
        booking_date_time: bookingDateTime,
        garage_notified: false,
        next_follow_up_date: bookingYmd,
        last_contacted_date: new Date().toISOString(),
        is_vip: false,
        whatsapp_broadcast: false,
        retarget_time_slot: null,
        details_shared_at: null,
        number_plate: null,
        service_type: ["Service"],
        notes: notes || null,
        created_date: new Date().toISOString(),
        fuel_type: extractedFuel || null,
      };

      let { error: insertError } = await supabase.from("leads").insert([newLead]);
      if (insertError && insertError.message && insertError.message.includes("fuel_type")) {
        delete newLead.fuel_type;
        const retry = await supabase.from("leads").insert([newLead]);
        insertError = retry.error;
      }

      if (insertError) {
        console.error("⚠️ Failed to insert new Booked lead:", insertError.message);
        return { success: false, error: insertError.message };
      }

      console.log(`✅ Successfully created new Booked lead ${newLeadId}!`);
      return {
        success: true,
        leadId: newLeadId,
        bookingDate: bookingYmd,
        bookingType,
        garageAssigned,
        notes,
      };
    }
  } catch (err) {
    console.error("⚠️ Exception in updateLeadToBooked:", err.message);
    return { success: false, error: err.message };
  }
}

export default {
  createOrUpdateLeadFromSearch,
  updateLeadToBooked,
  checkIsPremium,
  getTomorrowYmd,
  parseBookingDate,
  parseBookingMode,
};
