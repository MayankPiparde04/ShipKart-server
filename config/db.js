import mongoose from "mongoose";

let dbStatus = { state: "disconnected", host: null, name: null };
const MAX_RETRIES = 5;
let retryCount = 0;

const normalizeMongoUri = (inputUri) => {
  const raw = (inputUri || "").trim();
  const cleaned =
    (raw.startsWith("\"") && raw.endsWith("\"")) ||
    (raw.startsWith("'") && raw.endsWith("'"))
      ? raw.slice(1, -1)
      : raw;

  if (!cleaned) return "";
  if (!/^mongodb(\+srv)?:\/\//i.test(cleaned)) {
    throw new Error("Mongo URI must start with mongodb:// or mongodb+srv://");
  }

  const schemeMatch = cleaned.match(/^(mongodb(?:\+srv)?:\/\/)(.*)$/i);
  if (!schemeMatch) return cleaned;

  const scheme = schemeMatch[1];
  const remainder = schemeMatch[2];
  const slashIndex = remainder.indexOf("/");
  const authority = slashIndex === -1 ? remainder : remainder.slice(0, slashIndex);
  const pathAndQuery = slashIndex === -1 ? "" : remainder.slice(slashIndex);

  // No credentials present.
  if (!authority.includes("@") || !authority.includes(":")) {
    return cleaned;
  }

  const atIndex = authority.lastIndexOf("@");
  if (atIndex <= 0) return cleaned;

  const credentials = authority.slice(0, atIndex);
  const host = authority.slice(atIndex + 1);
  const colonIndex = credentials.indexOf(":");

  if (colonIndex <= 0) return cleaned;

  const username = credentials.slice(0, colonIndex);
  const rawPassword = credentials.slice(colonIndex + 1);

  if (!rawPassword) {
    return `${scheme}${credentials}@${host}${pathAndQuery}`;
  }

  let decodedPassword = rawPassword;
  try {
    decodedPassword = decodeURIComponent(rawPassword);
  } catch {
    decodedPassword = rawPassword;
  }

  const encodedPassword = encodeURIComponent(decodedPassword);
  return `${scheme}${username}:${encodedPassword}@${host}${pathAndQuery}`;
};

const connectDB = async () => {
  try {
    const mongoUri = normalizeMongoUri(
      process.env.MONGO_URI || process.env.MONGODB_URI || "",
    );

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
