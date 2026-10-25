import express from "express";
import aiSensyService from "../services/aiSensyService.js";

const router = express.Router();

function robustParseBody(raw) {
  if (!raw || typeof raw !== "string") return {};
  const trimmed = raw.trim();
  if (!trimmed) return {};

  try {
    return JSON.parse(trimmed);
  } catch (e) {
    try {
      let repaired = trimmed;
      // Fix misplaced closing brace before keys like `}, "name":` or `},"name":`
      repaired = repaired.replace(/}\s*,\s*("?[a-zA-Z0-9_$]+"?)\s*:/gi, ', "$1":');
      // Wrap unquoted template tags like `: {{$Name}}` in quotes
      repaired = repaired.replace(/:\s*(\{\{[^}]+\}\})/g, ': "$1"');
      // Ensure enclosing braces
      if (repaired.startsWith("{") && !repaired.endsWith("}")) {
        repaired = repaired + "}";
      }
      return JSON.parse(repaired);
    } catch (e2) {
      // Regex extraction fallback for key-value pairs
      const extracted = {};
      const keyValRegex = /"?([a-zA-Z0-9_$]+)"?\s*:\s*("([^"]*)"|'([^']*)'|(\{\{[^}]+\}\})|([^,{}]+))/g;
      let match;
      while ((match = keyValRegex.exec(trimmed)) !== null) {
        const key = match[1];
        const val = match[3] ?? match[4] ?? match[5] ?? match[6] ?? "";
        extracted[key] = val.trim();
      }
      if (Object.keys(extracted).length > 0) {
        return extracted;
      }
      try {
        const parsed = new URLSearchParams(trimmed);
        const obj = {};
        for (const [k, v] of parsed.entries()) {
          obj[k] = v;
        }
        return obj;
      } catch (e3) {
        return { rawText: trimmed };
      }
    }
  }
}

function extractParams(req) {
  let bodyObj = {};
  if (typeof req.body === "object" && req.body !== null) {
    bodyObj = req.body;
  } else if (typeof req.body === "string" && req.body.trim()) {
    bodyObj = robustParseBody(req.body);
  }
  return { ...req.query, ...bodyObj };
}

async function handleServicePlans(req, res) {
  try {
    const params = extractParams(req);
    console.log("📥 AiSensy Service Plans Request Params:", JSON.stringify(params));
    const result = await aiSensyService.getServicePlans(params);
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

router.get("/lead-meta", async (_req, res) => {
  res.json({});
});

router.get("/nearest-garages", handleNearestGarages);
router.post("/nearest-garages", handleNearestGarages);
router.get("/garages", handleNearestGarages);
router.post("/garages", handleNearestGarages);

router.get("/", handleServicePlans);
router.post("/", handleServicePlans);

export default router;
