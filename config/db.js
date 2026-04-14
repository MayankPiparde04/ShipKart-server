import mongoose from "mongoose";

let dbStatus = { state: "disconnected", host: null, name: null };
const MAX_RETRIES = 5;
let retryCount = 0;

const connectDB = async () => {
  try {
    const mongoUri = (process.env.MONGO_URI || process.env.MONGODB_URI || "")
      .trim()
      .replace(/^["']|["']$/g, "");

    if (!mongoUri) {
      console.error("[DB] FATAL: MONGO_URI is not set in environment variables.");
      process.exit(1);
    }

    const conn = await mongoose.connect(mongoUri, {
      dbName: "shipwise",
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useCreateIndex: true,
      useFindAndModify: false,
    });

    dbStatus = { state: "connected", host: conn.connection.host, name: conn.connection.name };
    retryCount = 0;

    console.log(`🗄️  MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);

    mongoose.connection.on("error", (err) => {
      console.error("MongoDB error:", err.message);
      dbStatus.state = "error";
    });

    mongoose.connection.on("disconnected", () => {
      dbStatus.state = "disconnected";
    });

    mongoose.connection.on("reconnected", () => {
      dbStatus.state = "connected";
    });

    process.on("SIGINT", async () => {
      await mongoose.connection.close();
      process.exit(0);
    });

    return conn;
  } catch (error) {
    dbStatus.state = "error";
    console.error("Database connection failed:", error.message);

    if (retryCount < MAX_RETRIES) {
      retryCount++;
      console.log(`Retrying (${retryCount}/${MAX_RETRIES}) in 5 seconds...`);
      setTimeout(connectDB, 5000);
    } else {
      console.error("Max DB retries reached. Giving up.");
    }
  }
};

export const getDBStatus = () => ({
  ...dbStatus,
  state: ["disconnected", "connected", "connecting", "disconnecting"][
    mongoose.connection.readyState
  ] ?? "disconnected",
});

export default connectDB;
