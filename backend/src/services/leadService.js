import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

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

export function broadcastLeadChange(payload = {}) {
  try {
    const channel = supabase.channel("crm-realtime-leads");
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        channel
          .send({
            type: "broadcast",
            event: "new_lead",
            payload,
          })
          .then(() => {
            setTimeout(() => {
              supabase.removeChannel(channel);
            }, 2000);
          })
          .catch(() => {});
      }
    });
  } catch (e) {
    // Non-blocking
  }
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
    carBrand = words[0] || "";
    carModel = words.slice(1).join(" ").trim();
    if (!carModel.trim() && words.length === 1) {
      carModel = words[0];
    }
  } else {
    carBrand = "";
    carModel = "";
  }
  // Strip any 4-digit years from carModel so year is never inserted inside model name
  if (carModel) {
    carModel = carModel.replace(/\b(19\d{2}|20\d{2})\b/g, "").replace(/\s+/g, " ").trim();
  }

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
          next_follow_up_date: nextFollowUpDate,
          priority: isVip ? "High" : "Medium",
          is_vip: isVip,
          number_plate: null, // No number plate inserted from referral
          last_contacted_date: createdDate,
        };

        if (carBrand) updatePayload.car_brand = carBrand;
        if (carModel) updatePayload.car_model = carModel;
        if (effectiveFuelType) updatePayload.fuel_type = effectiveFuelType;
        if (year) updatePayload.custom_year = year;

        let { error: updateError } = await supabase
          .from("leads")
          .update(updatePayload)
          .eq("id", existingLead.id);

        if (updateError) {
          console.error("⚠️ Failed to update existing lead:", updateError.message);
        } else {
          console.log(`✅ Successfully updated lead ${existingLead.id}`);
          broadcastLeadChange({ id: existingLead.id, name, identifier: tag, carBrand, carModel, action: "updated" });
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
      fuel_type: effectiveFuelType || null,
      custom_year: year || null,
    };

    let { data: insertedData, error: insertError } = await supabase
      .from("leads")
      .insert([newLead])
      .select("id")
      .single();

    if (insertError) {
      console.error("⚠️ Failed to insert new lead in Supabase:", insertError.message);
      return { success: false, error: insertError.message };
    }

    console.log(`✅ Successfully created new lead ${newLeadId} for customer "${name}" (${identifier})`);
    broadcastLeadChange({ id: newLeadId, name, identifier, carBrand, carModel, action: "created" });
    return { success: true, leadId: newLeadId, action: "created" };
  } catch (err) {
    console.error("⚠️ Exception in createOrUpdateLeadFromSearch:", err.message);
    return { success: false, error: err.message };
  }
}

export function parseBookingDate(rawDate) {
  if (!rawDate) return new Date().toISOString().split("T")[0];
  const s = String(rawDate).trim().toLowerCase().replace(/[\{\}\$]/g, "");
  const now = new Date();

  // 1. Check for relative day keywords anywhere in string (e.g. "Today at 12:00 PM-2.00", "Tomorrow at...")
  if (/\btoday\b/i.test(s)) {
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  if (/\btomorrow\b/i.test(s)) {
    const tmrw = new Date(now);
    tmrw.setDate(tmrw.getDate() + 1);
    const yyyy = tmrw.getFullYear();
    const mm = String(tmrw.getMonth() + 1).padStart(2, "0");
    const dd = String(tmrw.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  // 2. Check 4-digit year format: YYYY-MM-DD or YYYY/MM/DD anywhere in string
  const ymdMatch = s.match(/\b(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})\b/);
  if (ymdMatch) {
    const yyyy = ymdMatch[1];
    const mm = String(parseInt(ymdMatch[2], 10)).padStart(2, "0");
    const dd = String(parseInt(ymdMatch[3], 10)).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  // 3. Check full DD-MM-YYYY or DD/MM/YYYY anywhere in string
  const dmyFullMatch = s.match(/\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})\b/);
  if (dmyFullMatch) {
    const dd = String(parseInt(dmyFullMatch[1], 10)).padStart(2, "0");
    const mm = String(parseInt(dmyFullMatch[2], 10)).padStart(2, "0");
    const yyyy = dmyFullMatch[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  // 4. Check DD-MM-YY or DD/MM/YY (2-digit year, e.g. 26-11-26 or 26/11/26) anywhere in string
  const dmyShortMatch = s.match(/\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})\b/);
  if (dmyShortMatch) {
    const dd = String(parseInt(dmyShortMatch[1], 10)).padStart(2, "0");
    const mm = String(parseInt(dmyShortMatch[2], 10)).padStart(2, "0");
    const yyyy = `20${dmyShortMatch[3]}`;
    return `${yyyy}-${mm}-${dd}`;
  }

  // 5. Check DD-MM or DD/MM (no year, e.g. 5/11, 26-11, 28/11) anywhere in string
  const dmMatch = s.match(/\b(\d{1,2})[\/\-\.](\d{1,2})\b/);
  if (dmMatch) {
    const dd = String(parseInt(dmMatch[1], 10)).padStart(2, "0");
    const mm = String(parseInt(dmMatch[2], 10)).padStart(2, "0");
    let yyyy = now.getFullYear();
    if (parseInt(mm, 10) < (now.getMonth() + 1) - 6) {
      yyyy += 1;
    }
    return `${yyyy}-${mm}-${dd}`;
  }

  // 6. Native parse fallback
  const parsed = new Date(rawDate);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }

  return now.toISOString().split("T")[0];
}

export function parseBookingTimeSlot(rawDate) {
  if (!rawDate) return "";
  const s = String(rawDate).trim();
  const afterAt = s.match(/(?:at\s+)+(.+)$/i);
  if (afterAt && afterAt[1]) {
    return afterAt[1].trim();
  }
  const timeMatch = s.match(/(\d{1,2}(?::\d{2}|\.\d{2})?\s*(?:am|pm)\s*[-–—to]?\s*(?:\d{1,2}(?::\d{2}|\.\d{2})?\s*(?:am|pm)?)?|\d{1,2}:\d{2}\s*[-–—to]?\s*\d{1,2}:\d{2})/i);
  if (timeMatch) {
    return timeMatch[0].trim();
  }
  return "";
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
  const slot = parseBookingTimeSlot(rawDate);
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

  let { notes, extractedBrand, extractedModel, extractedFuel } = parsePlanText(plan || selectedPlan || "");
  if (slot) {
    notes = notes ? `${notes}\nSlot - *${slot}*` : `Slot - *${slot}*`;
  }

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

      if (updateError) {
        console.error("⚠️ Failed to update lead to Booked:", updateError.message);
        return { success: false, error: updateError.message };
      }

      console.log(`✅ Successfully updated lead ${existingLead.id} to Booked!`);
      broadcastLeadChange({
        id: existingLead.id,
        action: "booked",
        leadType: "Booked",
        garage: garageAssigned,
        bookingDate: bookingYmd,
        bookingType,
        carBrand: existingLead.car_brand,
        carModel: existingLead.car_model,
        customerName: existingLead.customer_name,
      });
      return {
        success: true,
        leadId: existingLead.id,
        bookingDate: bookingYmd,
        slot,
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

      if (insertError) {
        console.error("⚠️ Failed to insert new Booked lead:", insertError.message);
        return { success: false, error: insertError.message };
      }

      console.log(`✅ Successfully created new Booked lead ${newLeadId}!`);
      broadcastLeadChange({
        id: newLeadId,
        action: "booked",
        leadType: "Booked",
        garage: garageAssigned,
        bookingDate: bookingYmd,
        bookingType,
        carBrand: extractedBrand,
        carModel: extractedModel,
        customerName: newLead.customer_name,
      });
      return {
        success: true,
        leadId: newLeadId,
        bookingDate: bookingYmd,
        slot,
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
