import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const mongoUri = process.env.MONGODB_URI || "mongodb+srv://sonparatey_db_user:yugal080105@mechhelpcluster.hrzzmkp.mongodb.net/mechhelp?appName=MechHelpCluster";

const garagesData = [
  { garage_name: "Umar Automobiles", address: "Patel Nagar, Uppalwadi, Nagpur", contact: "9145171826", lat: 21.1944401031109, lon: 79.1256085846862 },
  { garage_name: "V.S Car Care", address: "Beside INDIAN OIL Petrol Pump, Besa Nagpur", contact: "9881723837", lat: 21.0863235070533, lon: 79.0931820402447 },
  { garage_name: "Sarkar Garage", address: "Naka no. 10, Amarvati Rd, Nagpur", contact: "9673549249", lat: 21.1536080687808, lon: 79.0146788430178 },
  { garage_name: "The Engine Room", address: "Khadgaon Road Nagpur", contact: "9403369705", lat: 21.1633618020736, lon: 78.9941389 },
  { garage_name: "Car Hub", address: "Plot No. 18, Near H.P Petrol Pump Last Bus stop, Jaitala, Nagpur", contact: "7276331203", lat: 21.1103217239018, lon: 79.0242496879793 },
  { garage_name: "D & G Auto Care", address: "K.T Nagar, Opposite Dominos, Nagpur", contact: "7020068816", lat: 21.1761518866787, lon: 79.0498163792431 },
  { garage_name: "B.S Autopoint", address: "Plot No. 1, Uppalwadi Nagpur", contact: "9226245313", lat: 21.1948857410721, lon: 79.1279209644177 },
  { garage_name: "The Mechanic", address: "Mankapur Chowk, Nagpur", contact: "8956555665", lat: 21.1829744132576, lon: 79.0794182784883 },
  { garage_name: "Car Way Motors", address: "Rani Durgawati Chowk Opposite Bank of Baroda Nagpur", contact: "8055536633", lat: 21.1717865093584, lon: 79.1168234883969 },
  { garage_name: "Good Luck Automobile", address: "Baba Santosh Ashirvad, Awde Baba Chowk, Lashkaribagh, Nagpur", contact: "8928973747", lat: 21.1662662335745, lon: 79.0970650865062 },
  { garage_name: "New Friends Automobiles and Auto Eelctrics", address: "Near Taj Tiles Kamptee Road, Naka no. 2, Bhilgaon, Amna Town, Napur", contact: "9326042797", lat: 21.199617876223, lon: 79.1383234124537 },
  { garage_name: "Shivaji Motors", address: "Ittabhati Chowk, Near CNG Pump Nagpur", contact: "7066995351", lat: 21.1763116102928, lon: 79.1264600247829 },
  { garage_name: "Fulsunge Automobiles", address: "Hingna Road Subhash Nagra, Besides Shitla Mata Mandir Nagpur", contact: "7775986701", lat: 21.1232036504556, lon: 79.0417280423291 },
  { garage_name: "Moving Wheels Car Garage", address: "Plot No. 47, Saket Nagar, Suyog Nagar Square, near TVS Showroom, BabulKheda, Parvati Nagar", contact: "8855009688", lat: 21.1073429961326, lon: 79.0839208308546 },
  { garage_name: "Taj Automobiles", address: "Umred Road Naka No. 7", contact: "9823873041", lat: 21.1063532407773, lon: 79.1419424576708 },
  { garage_name: "Rathi Autoworks", address: "Plot No.1, Shri RAm Sq, near Mahalaxmi Sabhagrauh, Wathoda Nagpur", contact: "7020804417", lat: 21.1420349234928, lon: 79.1424145 }
];

async function main() {
  await mongoose.connect(mongoUri);
  console.log("✅ Connected to MongoDB Atlas.");

  const db = mongoose.connection.db;
  const col = db.collection("garages");

  // 1. Remove opening_balance and opening balance field from all documents in garages collection
  const unsetResult = await col.updateMany({}, { $unset: { opening_balance: "", "opening balance": "" } });
  console.log(`Unset opening_balance on ${unsetResult.modifiedCount} documents.`);

  // 2. Clear old collection and insert fresh partner garage data from excel
  await col.deleteMany({});
  console.log("Cleared old garages collection.");

  const docs = garagesData.map((g) => ({
    garage_name: g.garage_name,
    address: g.address,
    contact: g.contact,
    lat: g.lat,
    lon: g.lon,
    is_enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  const insertResult = await col.insertMany(docs);
  console.log(`✅ Successfully inserted ${insertResult.insertedCount} partner garages into database!`);

  const sampleDoc = await col.findOne({});
  console.log("\nSample Document in Database (No opening_balance field):");
  console.log(sampleDoc);

  process.exit(0);
}

main().catch((err) => {
  console.error("Error in migration script:", err);
  process.exit(1);
});
