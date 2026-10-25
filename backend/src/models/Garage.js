import mongoose from "mongoose";

const garageSchema = new mongoose.Schema(
  {
    garage_name: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    contact: { type: String, default: "", trim: true },
    lat: { type: Number, required: true },
    lon: { type: Number, required: true },
    is_enabled: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

const Garage = mongoose.models.Garage || mongoose.model("Garage", garageSchema);
export default Garage;
