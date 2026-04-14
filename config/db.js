import mongoose from "mongoose";

let dbStatus = {
  state: "disconnected",
  host: null,
  name: null,
};

const MAX_RETRIES = 5;
let retryCount = 0;

const connectDB = async () => {
  try {
    if (process.env.NODE_ENV === "production") {
      mongoose.set("debug", false);
    }

    // Support both MONGO_URI and MONGODB_URI env var names (Render default uses MONGODB_URI)
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

    if (!mongoUri) {
      console.error(
        "[DB] FATAL: No MongoDB URI found. Set MONGO_URI or MONGODB_URI in your environment variables.",
      );
      process.exit(1);
    }

    const conn = await mongoose.connect(mongoUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useCreateIndex: true,
      useFindAndModify: false,
    });

    dbStatus = {
      state: "connected",
      host: conn.connection.host,
      name: conn.connection.name,
    };
    retryCount = 0;

    console.log(`🗄️  MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);

    mongoose.connection.on("error", (err) => {
      console.error("MongoDB connection error:", err.message);
      dbStatus.state = "error";
    });

    mongoose.connection.on("disconnected", () => {
      console.log("MongoDB disconnected");
      dbStatus.state = "disconnected";
    });

    mongoose.connection.on("reconnected", () => {
      console.log("MongoDB reconnected");
      dbStatus.state = "connected";
    });

    process.on("SIGINT", async () => {
      try {
        await mongoose.connection.close();
        console.log("MongoDB connection closed");
        process.exit(0);
      } catch (error) {
        console.error("Error closing MongoDB:", error.message);
        process.exit(1);
      }
    });

    return conn;
  } catch (error) {
    dbStatus.state = "error";
    console.error("Database connection failed:", error.message);

    if (retryCount < MAX_RETRIES) {
      retryCount++;
      console.log(
        `Retrying database connection (${retryCount}/${MAX_RETRIES}) in 5 seconds...`,
      );
      setTimeout(connectDB, 5000);
    } else {
      console.error("Max DB connection retries reached. Giving up.");
    }
  }
};

export const getDBStatus = () => ({
  ...dbStatus,
  state:
    mongoose.connection.readyState === 1
      ? "connected"
      : mongoose.connection.readyState === 2
        ? "connecting"
        : mongoose.connection.readyState === 3
          ? "disconnecting"
          : "disconnected",
});

export default connectDB;
