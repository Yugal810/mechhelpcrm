/**
 * aiSensyService.js
 *
 * Handles WhatsApp bot requests for service plans and nearest garage lookup.
 *
 * Vehicle data is served entirely from in-memory VehicleStore — zero MongoDB
 * queries at runtime. Referral lookups (low volume, event-triggered) still use
 * MongoDB directly since they are rare and require real-time accuracy.
 */

const vehicleStore = require('./vehicleStore');
const carService = require('./carService');
const distanceService = require('./distanceService');
const referralService = require('./referralService');
const { calculateCarConfidence, DEFAULT_CONFIDENCE_THRESHOLD } = require('../utils/fuzzyMatch');

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

class AISensyService {
  /**
   * Parse user query string and parameters to extract fuelType, year, car model query,
   * selected plan, referral code, and referral flag.
   */
  parseInput(params = {}) {
    if (typeof params === 'string') {
      params = { vname: params };
    }

    let rawQuery = params.vname || params.vehicle || params.query || '';
    let rawFuel = params.fuelType || params.fuel_type || params.fuel || '';
    let rawYear = params.year || '';
    let selectedPlan = params.selectedPlan || params.selected_plan || params.plan || '';
    let referralCode = params.referralCode || params.referral_code || params.referral || params.code || '';
    let customerPhone = params.phone || params.customerPhone || params.customer_phone || params.wa_number || '';
    let referralFlag =
      params.referral !== undefined
        ? params.referral
        : params.referral_applied !== undefined
        ? params.referral_applied
        : params.is_referral_valid !== undefined
        ? params.is_referral_valid
        : params.apply_referral !== undefined
        ? params.apply_referral
        : params.has_referral !== undefined
        ? params.has_referral
        : null;

    // Clean any leftover {{ }} or $ template wrappers from AiSensy
    rawQuery = String(rawQuery).replace(/[{}$]/g, '').trim();
    rawFuel = String(rawFuel).replace(/[{}$]/g, '').trim();
    rawYear = String(rawYear).replace(/[{}$]/g, '').trim();
    selectedPlan = String(selectedPlan).replace(/[{}$]/g, '').trim();
    referralCode = String(referralCode).replace(/[{}$]/g, '').trim();
    customerPhone = String(customerPhone).replace(/[{}$]/g, '').trim();
    if (referralFlag !== null) {
      referralFlag = String(referralFlag).replace(/[{}$]/g, '').trim();
    }

    // Extract referral code (vehicle plate format) from query string if not passed explicitly
    if (!referralCode) {
      const extractedPlate = referralService.extractPlateNumber(rawQuery);
      if (extractedPlate) {
        referralCode = extractedPlate;
        const plateRegex = new RegExp(`\\b${escapeRegExp(extractedPlate)}\\b`, 'gi');
        rawQuery = rawQuery.replace(plateRegex, '').trim();
      }
    }

    // Extract fuel type from query string if not passed explicitly
    if (!rawFuel) {
      if (/\bpetrol\b/i.test(rawQuery)) {
        rawFuel = 'Petrol';
        rawQuery = rawQuery.replace(/\bpetrol\b/gi, '').trim();
      } else if (/\bdiesel\b/i.test(rawQuery)) {
        rawFuel = 'Diesel';
        rawQuery = rawQuery.replace(/\bdiesel\b/gi, '').trim();
      }
    }

    // Extract 4-digit year from query string if not passed explicitly
    if (!rawYear) {
      const yearMatch = rawQuery.match(/\b(19\d{2}|20\d{2})\b/);
      if (yearMatch) {
        rawYear = yearMatch[1];
        rawQuery = rawQuery.replace(/\b(19\d{2}|20\d{2})\b/gi, '').trim();
      }
    }

    return {
      modelQuery: rawQuery.replace(/\s+/g, ' ').trim(),
      fuelType: rawFuel,
      year: rawYear,
      selectedPlan,
      referralCode: referralService.normalizePlate(referralCode),
      customerPhone,
      referralFlag,
    };
  }

  /**
   * Fetch service plans for AiSensy WhatsApp bot based on user input parameters.
   * Vehicle lookup is 100% in-memory — no MongoDB queries.
   */
  async getServicePlans(params = {}) {
    const {
      modelQuery,
      fuelType,
      year,
      selectedPlan,
      referralCode,
      customerPhone,
      referralFlag,
    } = this.parseInput(params);

    if (!modelQuery && !fuelType && !year) {
      return {
        found: false,
        whatsapp_text: 'Please provide your vehicle model and year (e.g. *Honda Amaze 2018*).',
      };
    }

    // ── Referral validation (MongoDB, but rare — only when user provides a code) ──
    let referralValidation = null;
    let isReferralValid = false;
    let discountVal = 0;

    const flagStr = String(referralFlag || '').toLowerCase().trim();
    const isFlagExplicitFalse = flagStr === 'false' || flagStr === '0' || flagStr === 'no';
    const isFlagExplicitTrue = flagStr === 'true' || flagStr === '1' || flagStr === 'yes';

    if (!isFlagExplicitFalse) {
      if (referralCode) {
        referralValidation = await referralService.validateReferralCode(referralCode, customerPhone);
        if (referralValidation && referralValidation.valid) {
          isReferralValid = true;
          discountVal = referralValidation.discountValue || 200;
        }
      }
      if (!isReferralValid && isFlagExplicitTrue) {
        isReferralValid = true;
        discountVal = 200;
      }
    }

    // ── Vehicle search — purely in-memory, zero MongoDB ──
    let cars = vehicleStore.all();

    // Fuel type filter
    if (fuelType) {
      const re = new RegExp('^' + escapeRegExp(fuelType), 'i');
      cars = cars.filter(c => re.test(c.fuelType));
    }

    let bestConfidenceScore = 1.0;
    let topSuggestions = [];

    if (modelQuery) {
      const words = modelQuery.split(' ').filter(Boolean);
      const wordRegs = words.map(w => new RegExp(escapeRegExp(w), 'i'));

      // Try: all words must appear in brand OR model OR variant
      let matched = cars.filter(c =>
        wordRegs.every(re =>
          re.test(c.brand) || re.test(c.model) || re.test(c.variant || '')
        )
      );

      // Fallback: partial phrase match
      if (matched.length === 0 && words.length > 1) {
        const phraseRe = new RegExp(escapeRegExp(modelQuery), 'i');
        matched = cars.filter(c =>
          phraseRe.test(c.brand) || phraseRe.test(c.model) || phraseRe.test(c.variant || '')
        );
      }

      // Fallback: fuzzy confidence score
      if (matched.length === 0) {
        const scored = cars.map(c => ({
          car: c,
          score: calculateCarConfidence(modelQuery, c),
        }));
        scored.sort((a, b) => b.score - a.score);

        const threshold = DEFAULT_CONFIDENCE_THRESHOLD;
        const aboveThreshold = scored.filter(item => item.score >= threshold);

        if (aboveThreshold.length > 0) {
          const topScore = aboveThreshold[0].score;
          matched = aboveThreshold
            .filter(item => item.score >= topScore - 0.05)
            .map(item => {
              item.car.confidenceScore = item.score;
              return item.car;
            });
          bestConfidenceScore = topScore;
        } else {
          topSuggestions = [
            ...new Set(
              scored
                .filter(item => item.score > 0.35)
                .slice(0, 3)
                .map(item => `${item.car.brand} ${item.car.model}`)
            ),
          ];
          matched = [];
        }
      }

      cars = matched;
    }

    // ── Year filter (in-memory) ──
    let yearMismatchRanges = [];
    if (year && cars.length > 0) {
      const yearFiltered = cars.filter(car =>
        carService._rowMatchesYearFilter(car.year, null, year)
      );
      if (yearFiltered.length > 0) {
        cars = yearFiltered;
      } else {
        yearMismatchRanges = [...new Set(cars.map(c => c.year).filter(Boolean))];
        cars = [];
      }
    }

    // ── Sort: prefer exact model name match ──
    if (cars.length > 1 && modelQuery) {
      const qLower = modelQuery.toLowerCase().trim();
      cars.sort((a, b) => {
        const aModel = String(a.model || '').toLowerCase().trim();
        const bModel = String(b.model || '').toLowerCase().trim();
        if (aModel === qLower && bModel !== qLower) return -1;
        if (bModel === qLower && aModel !== qLower) return 1;
        if (aModel.startsWith(qLower) && !bModel.startsWith(qLower)) return -1;
        if (bModel.startsWith(qLower) && !aModel.startsWith(qLower)) return 1;
        return aModel.length - bModel.length;
      });
    }

    // ── Not found ──
    if (!cars || cars.length === 0) {
      const fullSearchTerm = `${modelQuery || 'your vehicle'}${year ? ' ' + year : ''}`.trim();
      let notFoundMsg = `Sorry, we couldn't find service plan details for *${fullSearchTerm}* (${fuelType || 'Any fuel'}).`;

      if (yearMismatchRanges.length > 0) {
        const rangesStr = yearMismatchRanges.map(r => `*${r}*`).join(', ');
        notFoundMsg += `\n\nThe available model years in our database for *${modelQuery}* are: ${rangesStr}.\n\nPlease re-enter your request with a valid model year!`;
      } else if (topSuggestions.length > 0) {
        const suggestionsStr = topSuggestions.map(s => `*${s}*`).join(', ');
        notFoundMsg += `\n\nDid you mean: ${suggestionsStr}?\n\nPlease check the spelling or enter a valid vehicle model year.`;
      } else {
        notFoundMsg += `\n\nPlease check the spelling or type a different model (e.g. *Honda Amaze 2018*).`;
      }

      return { found: false, whatsapp_text: notFoundMsg };
    }

    // ── Build response from top match ──
    const car = cars[0];

    const formatPrice = (val) => {
      if (!val || val === '-' || String(val).toLowerCase() === 'n/a') return 'N/A';
      const cleaned = String(val).replace(/[^0-9]/g, '');
      if (!cleaned) return String(val);
      let num = parseInt(cleaned, 10);
      if (isReferralValid) num = Math.max(0, num - discountVal);
      return `₹${num.toLocaleString('en-IN')}`;
    };

    const rawOilCap = String(car.oilCapacity || '').trim();
    const oilNumMatch = rawOilCap.match(/\d+(\.\d+)?/);
    const oilNum = oilNumMatch ? parseFloat(oilNumMatch[0]) : null;
    const isAbove3_7 = oilNum !== null && oilNum >= 3.7;

    const pricingCat = String(car.pricingCategory || '').toUpperCase().trim();
    const isBS6 = pricingCat.includes('BS6') || rawOilCap.toUpperCase().includes('BS6');

    const vehicleFullName = `${car.brand} ${car.model} ${car.variant || ''}`.trim();
    const fullVehicleNameWithYear = year ? `${vehicleFullName} ${year}` : vehicleFullName;

    let oilCapText = rawOilCap;
    if (rawOilCap && !/l$/i.test(rawOilCap)) oilCapText = `${rawOilCap}L`;
    if (!oilCapText) oilCapText = 'Standard';
    if (isBS6 && !oilCapText.toUpperCase().includes('BS6')) oilCapText = `${oilCapText} BS6`;

    let headerMessage = '';
    if (isAbove3_7 && rawOilCap) {
      headerMessage = `The *${fullVehicleNameWithYear}* (${car.fuelType || fuelType || 'Petrol'}) has an engine oil capacity of *${oilCapText}*.`;
    } else {
      headerMessage = `*Vehicle:* ${fullVehicleNameWithYear}\n*Fuel Type:* ${car.fuelType || fuelType || 'Petrol'}\n*Engine Oil Capacity:* ${oilCapText}`;
    }

    const mechLitePrice = formatPrice(car.mechLite);
    const mechBasicPrice = formatPrice(car.mechBasic);
    const mechProPrice = formatPrice(car.mechPro);

    const planLower = String(selectedPlan).toLowerCase();
    let chosenPlanLine = null;
    let otherPlansLines = [];

    if (planLower.includes('lite')) {
      chosenPlanLine = `*Chosen Plan (Mech Lite):* ${mechLitePrice}`;
      otherPlansLines = [`*Mech Basic:* ${mechBasicPrice}`, `*Mech Pro:* ${mechProPrice}`];
    } else if (planLower.includes('pro')) {
      chosenPlanLine = `*Chosen Plan (Mech Pro):* ${mechProPrice}`;
      otherPlansLines = [`*Mech Lite:* ${mechLitePrice}`, `*Mech Basic:* ${mechBasicPrice}`];
    } else if (planLower.includes('basic')) {
      chosenPlanLine = `*Chosen Plan (Mech Basic):* ${mechBasicPrice}`;
      otherPlansLines = [`*Mech Lite:* ${mechLitePrice}`, `*Mech Pro:* ${mechProPrice}`];
    } else {
      otherPlansLines = [
        `*Mech Lite:* ${mechLitePrice}`,
        `*Mech Basic:* ${mechBasicPrice}`,
        `*Mech Pro:* ${mechProPrice}`,
      ];
    }

    const divider = '━━━━━━━━━━━━━━━━━━━━';
    const referralHeader = isReferralValid
      ? `🎁 *Referral Discount Applied (-₹${discountVal})*\nCode: *${referralValidation.referralCode}*\n\n`
      : '';

    let whatsappMessage = '';

    if (isAbove3_7) {
      let chosenPlanHighlight = `💰 *Mech Basic - ${mechBasicPrice}*`;
      let otherOptionsList = [`Mech Lite - ${mechLitePrice}`, `Mech Pro - ${mechProPrice}`];
      if (planLower.includes('lite')) {
        chosenPlanHighlight = `💰 *Mech Lite - ${mechLitePrice}*`;
        otherOptionsList = [`Mech Basic - ${mechBasicPrice}`, `Mech Pro - ${mechProPrice}`];
      } else if (planLower.includes('pro')) {
        chosenPlanHighlight = `💰 *Mech Pro - ${mechProPrice}*`;
        otherOptionsList = [`Mech Lite - ${mechLitePrice}`, `Mech Basic - ${mechBasicPrice}`];
      }
      whatsappMessage = [
        `${referralHeader}⚠️ *Pricing Revised*`,
        ``,
        `Your ${fullVehicleNameWithYear} (${car.fuelType || fuelType || 'Petrol'}) needs *${oilCapText}* engine oil — a bit more than our standard 3.6L plans, so pricing is adjusted accordingly.`,
        ``,
        chosenPlanHighlight,
        ``,
        `Other options:`,
        ...otherOptionsList,
        ``,
        `Choose an option below 👇`,
      ].join('\n');
    } else if (isBS6) {
      let chosenPlanHighlight = `💰 *Mech Basic - ${mechBasicPrice}*`;
      let otherOptionsList = [`Mech Lite - ${mechLitePrice}`, `Mech Pro - ${mechProPrice}`];
      if (planLower.includes('lite')) {
        chosenPlanHighlight = `💰 *Mech Lite - ${mechLitePrice}*`;
        otherOptionsList = [`Mech Basic - ${mechBasicPrice}`, `Mech Pro - ${mechProPrice}`];
      } else if (planLower.includes('pro')) {
        chosenPlanHighlight = `💰 *Mech Pro - ${mechProPrice}*`;
        otherOptionsList = [`Mech Lite - ${mechLitePrice}`, `Mech Basic - ${mechBasicPrice}`];
      }
      const displayOilNum = oilNum ? `${oilNum}L` : oilCapText;
      whatsappMessage = [
        `${referralHeader}⚠️ *Pricing Revised*`,
        ``,
        `Your ${fullVehicleNameWithYear} (${car.fuelType || fuelType || 'Petrol'}) needs *${displayOilNum}* of BS6-compliant engine oil.`,
        `Because BS6-grade oil requires specialized formulations, our standard plan pricing has been adjusted accordingly.`,
        ``,
        chosenPlanHighlight,
        ``,
        `Other options:`,
        ...otherOptionsList,
        ``,
        `Choose an option below 👇`,
      ].join('\n');
    } else {
      whatsappMessage = [
        `${referralHeader}*MECHHELP Service Quote*`,
        headerMessage,
        `Based on your vehicle's oil capacity, here is your updated plan pricing:`,
        divider,
        chosenPlanLine ? chosenPlanLine : null,
        divider,
        otherPlansLines.length > 0 ? `More Plan Pricing for Your Vehicle:` : null,
        ...otherPlansLines,
        divider,
        `Please click *Proceed* below to continue with your chosen plan or select a different plan!`,
      ]
        .filter(Boolean)
        .join('\n');
    }

    let chosenPlanName = 'Mech Basic';
    let chosenPrice = mechBasicPrice;
    if (planLower.includes('lite')) { chosenPlanName = 'Mech Lite'; chosenPrice = mechLitePrice; }
    else if (planLower.includes('pro')) { chosenPlanName = 'Mech Pro'; chosenPrice = mechProPrice; }

    const confirmationMessage = [
      `*✅ Booking Confirmed*`,
      ``,
      `🚗 Booked For - *${fullVehicleNameWithYear} (${car.fuelType || fuelType || 'Petrol'})*`,
      `🔧 Plan Selected - *${chosenPlanName}*`,
      `💰 Final Price - *${chosenPrice}*${isReferralValid ? ` (Referral Code ${referralValidation.referralCode} Applied)` : ''}`,
    ].join('\n');

    return {
      found: true,
      brand: car.brand,
      model: car.model,
      confidence_score: car.confidenceScore !== undefined ? car.confidenceScore : bestConfidenceScore,
      matched_model: fullVehicleNameWithYear,
      whatsapp_text: whatsappMessage,
      confirmation_text: confirmationMessage,
      is_above_3_7: isAbove3_7 ? 'True' : 'False',
      is_bs6: isBS6 ? 'True' : 'False',
      referral_applied: isReferralValid,
      referral_code: isReferralValid ? referralValidation.referralCode : null,
      discount_amount: isReferralValid ? discountVal : 0,
    };
  }

  /**
   * Fetch top 3 nearest garages for AiSensy WhatsApp bot based on user location/address.
   */
  async getNearestGarages(params = {}) {
    let rawAddress =
      params.address || params.location || params.vname || params.query || params.c1 || '';
    rawAddress = String(rawAddress).trim();

    let address = rawAddress.replace(/[{}$]/g, '').trim();

    const lower = address.toLowerCase();
    if (!address || ['address', 'location', 'c1', 'addr', 'customer_address'].includes(lower)) {
      address = 'Nagpur';
    }

    let nearestList = [];
    try {
      nearestList = await distanceService.getNearestGarages(address);
    } catch (err) {
      console.warn('Distance service geocoding warning:', err.message);
      const allGarages = await distanceService.getGarages();
      nearestList = allGarages.filter(g => g.is_enabled);
    }

    const top3 = nearestList.slice(0, 3);
    const garageLines = top3.map((g, idx) => {
      const distStr = g.distance_km || g.distance || 'Nearby';
      return [`${idx + 1}. *${g.garage_name}*`, `Distance: ${distStr}`].join('\n');
    });

    const whatsappMessage = [
      `*Nearest MECHHELP Partner Garages*`,
      ``,
      `Here are the top 3 partner garages closest to your location (*${address}*):`,
      ``,
      garageLines.join('\n\n'),
      ``,
      `Our customer support executive will call you shortly to confirm your pickup time!`,
    ].join('\n');

    return {
      whatsapp_text: whatsappMessage,
      garage_1: top3[0] ? top3[0].garage_name.substring(0, 20) : '',
      garage_2: top3[1] ? top3[1].garage_name.substring(0, 20) : '',
      garage_3: top3[2] ? top3[2].garage_name.substring(0, 20) : '',
    };
  }
}

module.exports = new AISensyService();
