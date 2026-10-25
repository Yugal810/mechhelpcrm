import mongoose from "mongoose";

const leadMetaSchema = new mongoose.Schema(
  {
    leadId: { type: String, index: true },
    identifier: { type: String, required: true, index: true },
    fuelType: { type: String, default: "" },
    customYear: { type: String, default: "" },
  },
  { timestamps: true }
);

const LeadMeta = mongoose.models.LeadMeta || mongoose.model("LeadMeta", leadMetaSchema);
export default LeadMeta;
