import express from "express";
import distanceService from "../services/distanceService.js";

const router = express.Router();

router.get("/", async (_req, res) => {
  try {
    const garages = await distanceService.getGarages();
    res.json(garages);
  } catch (err) {
    console.error("Error fetching garages:", err);
    res.status(500).json({ detail: "Failed to fetch garages" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { garage_name, address, contact, lat, lon } = req.body;
    const newGarage = await distanceService.addGarage({
      garage_name,
      address,
      contact,
      lat,
      lon,
    });
    res.status(201).json(newGarage);
  } catch (err) {
    console.error("Error adding garage:", err.message);
    res.status(400).json({ detail: err.message });
  }
});

router.patch("/:id/toggle", async (req, res) => {
  try {
    const { id } = req.params;
    const updatedGarage = await distanceService.toggleGarage(id);
    res.json(updatedGarage);
  } catch (err) {
    console.error("Error toggling garage:", err.message);
    res.status(400).json({ detail: err.message });
  }
});

router.post("/geocode", async (req, res) => {
  try {
    const { address } = req.body;
    if (!address || !String(address).trim()) {
      return res.status(422).json({ detail: "Address is required." });
    }
    const [lat, lon] = await distanceService.geocodeLocation(address);
    res.json({ lat, lon });
  } catch (err) {
    console.error("Error geocoding garage address:", err.message);
    res.status(400).json({ detail: err.message });
  }
});

export default router;
