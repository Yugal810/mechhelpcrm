const express = require("express");
const aiSensyService = require("../services/aiSensyService");

const router = express.Router();

function extractParams(req) {
  let bodyObj = {};
  if (typeof req.body === "object" && req.body !== null) {
    bodyObj = req.body;
  } else if (typeof req.body === "string" && req.body.trim()) {
    try {
      bodyObj = JSON.parse(req.body);
    } catch (e1) {
      try {
        const parsed = new URLSearchParams(req.body);
        for (const [k, v] of parsed.entries()) {
          bodyObj[k] = v;
        }
      } catch (e2) {
        bodyObj = { rawText: req.body };
      }
    }
  }
  return { ...req.query, ...bodyObj };
}

/**
 * Endpoint for AiSensy WhatsApp Bot to fetch car service plans
 */
async function handleServicePlans(req, res) {
  try {
    const params = extractParams(req);
    console.log("📥 AiSensy Service Plans Request Params:", JSON.stringify(params));
    const result = await aiSensyService.getServicePlans(params);

    // Auto-create a Fresh Lead in Supabase if phone number is provided
    const customerPhone = params.phone || params.wa_number || params.identifier;
    if (result.found !== false && customerPhone) {
      const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
      if (SUPABASE_URL && SUPABASE_KEY) {
        fetch(`${SUPABASE_URL}/rest/v1/leads`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            customer_name: params.name || 'AiSensy Customer',
            identifier: customerPhone,
            lead_source: 'WhatsApp Bot',
            car_brand: result.brand || 'Unknown',
            car_model: result.model || 'Unknown',
            priority: 'Medium',
            lead_type: 'Fresh Lead',
            salesperson: 'Choice',
            notes: `Requested service plan for ${result.brand} ${result.model}`
          })
        }).catch(err => console.error('Failed to auto-create lead:', err.message));
      }
    }

    if (result.found === false) {
      return res.status(404).json(result);
    }
    if (result.is_bs6 === "True") {
      return res.status(201).json(result);
    }
    return res.status(200).json(result);
  } catch (err) {
    console.error("Error in AiSensy service-plans endpoint:", err.message);
    res.status(500).json({
      found: false,
      whatsapp_text:
        "Sorry, an error occurred while fetching service plans. Please try again later.",
    });
  }
}

/**
 * Endpoint for AiSensy WhatsApp Bot to fetch top 3 nearest garages
 */
async function handleNearestGarages(req, res) {
  try {
    const params = extractParams(req);
    console.log("📥 AiSensy Nearest Garages Request Params:", JSON.stringify(params));
    const result = await aiSensyService.getNearestGarages(params);
    res.json(result);
  } catch (err) {
    console.error("Error in AiSensy nearest-garages endpoint:", err.message);
    res.status(500).json({
      whatsapp_text:
        "Sorry, an error occurred while calculating nearest garages. Our team will contact you shortly.",
    });
  }
}

router.get("/service-plans", handleServicePlans);
router.post("/service-plans", handleServicePlans);

router.get("/nearest-garages", handleNearestGarages);
router.post("/nearest-garages", handleNearestGarages);
router.get("/garages", handleNearestGarages);
router.post("/garages", handleNearestGarages);

// Direct root routes for convenience if AiSensy points directly to /api/aisensy
router.get("/", handleServicePlans);
router.post("/", handleServicePlans);

module.exports = router;
