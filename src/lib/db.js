import "dotenv/config";
import mongoose from "mongoose";

const cache =
  globalThis.__fhaMongooseCache ||
  (globalThis.__fhaMongooseCache = {
    connection: null,
    promise: null,
  });

export async function connectDB() {
  const configuredUri = process.env.MONGODB_URI?.trim();

  if (!configuredUri) {
    throw new Error("MONGODB_URI is not configured.");
  }

  let uri;

  try {
    const mongoUrl = new URL(configuredUri);

    if (!["mongodb:", "mongodb+srv:"].includes(mongoUrl.protocol)) {
      throw new Error();
    }

    if (mongoUrl.pathname.length > 1) {
      mongoUrl.pathname = mongoUrl.pathname.replace(/\/+$/, "");
    }

    uri = mongoUrl.toString();
  } catch {
    throw new Error("MONGODB_URI must be a valid MongoDB connection string.");
  }

  if (cache.connection) {
    return cache.connection;
  }

  if (!cache.promise) {
    cache.promise = mongoose
      .connect(uri, {
        serverSelectionTimeoutMS: 10000,
      })
      .then(() => mongoose)
      .catch((error) => {
        cache.promise = null;
        throw error;
      });
  }

  cache.connection = await cache.promise;

  return cache.connection;
}
