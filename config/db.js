import mongoose from "mongoose";

let dbStatus = { state: "disconnected", host: null, name: null };
let lifecycleHandlersRegistered = false;

const maskMongoUri = (uri) =>
  uri.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)([^@]*)(@)/i, "$1***$3");

const classifyMongoError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  const name = String(error?.name || "").toLowerCase();

  if (
    message.includes("authentication") ||
    message.includes("auth") ||
    name.includes("auth") ||
    error?.code === 18
  ) {
    return "Authentication";
  }

  if (
    message.includes("timed out") ||
    message.includes("network") ||
    message.includes("server selection") ||
    message.includes("topology") ||
    message.includes("econn") ||
    message.includes("ip") ||
    message.includes("whitelist") ||
    message.includes("timeout") ||
    name.includes("network") ||
    name.includes("serverselection")
  ) {
    return "Network/IP Whitelist";
  }

  return "Unknown";
};

const registerConnectionLifecycleHandlers = () => {
  if (lifecycleHandlersRegistered) return;
  lifecycleHandlersRegistered = true;

  mongoose.connection.on("connecting", () => {
    dbStatus.state = "connecting";
  });

  mongoose.connection.on("error", (err) => {
    const errorType = classifyMongoError(err);
    console.error(`MongoDB Runtime Error (${errorType}):`, err.message);
    dbStatus.state = "error";
  });

  mongoose.connection.on("disconnected", () => {
    dbStatus.state = "disconnected";
  });

  mongoose.connection.on("reconnected", () => {
    dbStatus.state = "connected";
  });

  process.once("SIGINT", async () => {
    await mongoose.connection.close();
    process.exit(0);
  });
};

const connectDB = async (explicitUri) => {
  try {
    const rawMongoUri = explicitUri ?? process.env.MONGODB_URI;

    if (typeof rawMongoUri !== "string" || !rawMongoUri.trim()) {
      console.error(
        "[DB] FATAL: MONGODB_URI is missing, empty, or invalid. Expected mongodb:// or mongodb+srv://",
      );
      dbStatus.state = "error";
      return null;
    }

    const mongoUri = rawMongoUri.trim();

    if (!/^mongodb(?:\+srv)?:\/\//i.test(mongoUri)) {
      console.error(
        "[DB] FATAL: MONGODB_URI must start with mongodb:// or mongodb+srv://",
      );
      dbStatus.state = "error";
      return null;
    }

    console.log(`[DB] Connecting with MongoDB URI: ${maskMongoUri(mongoUri)}`);

    registerConnectionLifecycleHandlers();

    const conn = await mongoose.connect(mongoUri, {
      dbName: "shipwise",
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });

    dbStatus = {
      state: "connected",
      host: conn.connection.host,
      name: conn.connection.name,
    };

    return conn;
  } catch (error) {
    dbStatus.state = "error";
    const errorType = classifyMongoError(error);
    console.error(`Database connection failed (${errorType}):`, error.message);
    throw error;
  }
};

export const getDBStatus = () => ({
  ...dbStatus,
  state: ["disconnected", "connected", "connecting", "disconnecting"][
    mongoose.connection.readyState
  ] ?? "disconnected",
});

export default connectDB;
