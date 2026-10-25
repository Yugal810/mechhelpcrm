import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const BACKEND_DIR = path.resolve(__dirname, "..");
const ROOT_DIR = path.resolve(__dirname, "../..");

export const PREMIUM_CARS_EXCEL_PATH = path.join(BACKEND_DIR, "data", "cars.xlsx");
export const NORMAL_CARS_EXCEL_PATH = path.join(BACKEND_DIR, "data", "cars_normal.xlsx");
export const EXCEL_FILE_PATH = path.join(BACKEND_DIR, "data", "cars.xlsx");
export const GARAGES_EXCEL_PATH = path.join(BACKEND_DIR, "data", "garages.xlsx");
export const FRONTEND_DIST = path.join(ROOT_DIR, "frontend", "dist");
export const PORT = process.env.PORT || 8000;
export const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || "";

export default {
  PREMIUM_CARS_EXCEL_PATH,
  NORMAL_CARS_EXCEL_PATH,
  EXCEL_FILE_PATH,
  GARAGES_EXCEL_PATH,
  FRONTEND_DIST,
  PORT,
  GOOGLE_MAPS_API_KEY,
};
