import mongoose from "mongoose";

const carSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, enum: ["normal", "premium"], index: true },
    brand: { type: String, required: true, index: true },
    model: { type: String, required: true, index: true },
    variant: { type: String, default: "" },
    year: { type: String, default: "-" },
    fuelType: { type: String, default: "", index: true },
    oilCapacity: { type: String, default: "" },
    pricingCategory: { type: String, default: "" },
    mechLite: { type: String, default: "" },
    mechBasic: { type: String, default: "" },
    mechPro: { type: String, default: "" },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

carSchema.index({ brand: "text", model: "text", variant: "text" });

const Car = mongoose.models.Car || mongoose.model("Car", carSchema);
export default Car;
