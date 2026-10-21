import "dotenv/config";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import { connectDB } from "../src/lib/db.js";
import Property from "../src/models/Property.js";
import { demoProperties } from "./demo-properties.js";

function readOption(name) {
  const prefix = `--${name}=`;
  const argument = process.argv.find((value) => value.startsWith(prefix));
  return argument?.slice(prefix.length);
}

function printUsage() {
  console.log(`Preview the configured database and current property count:
  node scripts/reset-properties-to-demo.js

Replace every property record with 15 unpublished demo drafts:
  node scripts/reset-properties-to-demo.js --apply --confirm-db=<database-name> --backup-file=<secure-path>

The apply command requires MONGODB_URI, a backup path that does not already
exist, and an exact database-name confirmation. The replacement runs in a
MongoDB transaction so it either completes fully or leaves the collection
unchanged.`);
}

function getConfiguredDatabaseName() {
  const configuredUri = process.env.MONGODB_URI?.trim();
  if (!configuredUri) {
    throw new Error("MONGODB_URI is not configured.");
  }

  const url = new URL(configuredUri);
  if (!["mongodb:", "mongodb+srv:"].includes(url.protocol)) {
    throw new Error("MONGODB_URI must use mongodb:// or mongodb+srv://.");
  }

  const databaseName = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  if (!databaseName) {
    throw new Error("MONGODB_URI must include an explicit database name.");
  }

  return databaseName;
}

async function main() {
  if (process.argv.includes("--help")) {
    printUsage();
    return;
  }

  const configuredDatabaseName = getConfiguredDatabaseName();
  await connectDB();

  const connectedDatabaseName = mongoose.connection.db.databaseName;
  if (connectedDatabaseName !== configuredDatabaseName) {
    throw new Error(
      `Configured database mismatch: URI names "${configuredDatabaseName}" but connection selected "${connectedDatabaseName}".`,
    );
  }

  const currentCount = await Property.countDocuments({});
  console.log(`Connected database: ${connectedDatabaseName}`);
  console.log(`Current property records: ${currentCount}`);
  console.log(`Replacement demo drafts: ${demoProperties.length}`);

  if (!process.argv.includes("--apply")) {
    console.log("Dry run only. No database records were changed.");
    return;
  }

  if (readOption("confirm-db") !== connectedDatabaseName) {
    throw new Error(
      `Refusing to replace records. Pass --confirm-db=${connectedDatabaseName} to confirm this exact database.`,
    );
  }

  const backupFile = readOption("backup-file");
  if (!backupFile) {
    throw new Error(
      "A backup file is required. Pass --backup-file=<secure-path> before applying changes.",
    );
  }

  const resolvedBackupFile = path.resolve(backupFile);
  if (existsSync(resolvedBackupFile)) {
    throw new Error(`Backup file already exists: ${resolvedBackupFile}`);
  }

  for (const property of demoProperties) {
    await new Property(property).validate();
  }

  const backup = {
    database: connectedDatabaseName,
    collection: Property.collection.collectionName,
    exportedAt: new Date().toISOString(),
    count: currentCount,
    records: await Property.find({}).lean(),
  };

  await writeFile(resolvedBackupFile, JSON.stringify(backup, null, 2), {
    flag: "wx",
    mode: 0o600,
  });

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await Property.deleteMany({}, { session });
      await Property.insertMany(demoProperties, { session, ordered: true });
    });
  } finally {
    await session.endSession();
  }

  const finalCount = await Property.countDocuments({});
  const finalDemoDraftCount = await Property.countDocuments({
    status: "draft",
    title: /^\[DEMO ONLY\]/,
  });
  if (
    finalCount !== demoProperties.length ||
    finalDemoDraftCount !== demoProperties.length
  ) {
    throw new Error(
      `Replacement verification failed: found ${finalCount} total records and ${finalDemoDraftCount} labeled drafts.`,
    );
  }

  console.log(
    `Replaced ${currentCount} property records with ${finalDemoDraftCount} unpublished demo drafts.`,
  );
  console.log(`Backup saved to: ${resolvedBackupFile}`);
}

main()
  .catch((error) => {
    console.error("Property demo reset failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
