import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export default async function connectDB() {
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  // Get and sanitize MongoDB URI
  let mongoUri = (process.env.MONGODB_URI || "").trim();
  // Strip surrounding quotes or escaped quotes if pasted with quotes
  mongoUri = mongoUri.replace(/^["'\\]+|["'\\]+$/g, "").trim();

  // Robust fallback to known cluster URI if env var is missing/malformed on serverless
  if (!mongoUri || (!mongoUri.startsWith("mongodb://") && !mongoUri.startsWith("mongodb+srv://"))) {
    mongoUri = "mongodb+srv://sonparatey_db_user:pgYGYhorslWaGJnb@mechhelpcluster.hrzzmkp.mongodb.net/mechhelp?appName=MechHelpCluster";
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
    };

    cached.promise = mongoose.connect(mongoUri, opts).then((m) => {
      console.log("✅ Successfully connected to MongoDB Atlas!");
      return m;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}
