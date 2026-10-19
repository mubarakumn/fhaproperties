import readline from "node:readline";
import { createInterface } from "node:readline/promises";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import AdminAccount from "../src/models/AdminAccount.js";
import { connectDB } from "../src/lib/db.js";

function ask(question) {
  const prompt = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return prompt.question(question).finally(() => prompt.close());
}

function askHidden(question) {
  const input = process.stdin;

  if (!input.isTTY || typeof input.setRawMode !== "function") {
    throw new Error("Run this command in an interactive terminal.");
  }

  readline.emitKeypressEvents(input);
  input.setRawMode(true);
  input.resume();
  process.stdout.write(question);

  return new Promise((resolve, reject) => {
    let value = "";

    const finish = (error) => {
      input.off("keypress", onKeypress);
      input.setRawMode(false);
      input.pause();
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    };

    const onKeypress = (character, key = {}) => {
      if (key.ctrl && key.name === "c") {
        finish(new Error("Cancelled."));
      } else if (key.name === "return" || key.name === "enter") {
        finish();
      } else if (key.name === "backspace") {
        value = Array.from(value).slice(0, -1).join("");
        process.stdout.write("\b \b");
      } else if (character && !key.ctrl && !key.meta) {
        value += character;
        process.stdout.write("*");
      }
    };

    input.on("keypress", onKeypress);
  });
}

async function readNewPassword() {
  const password = await askHidden("New password: ");

  if (password.length < 12 || password.length > 128) {
    throw new Error("Password must be between 12 and 128 characters.");
  }

  const confirmation = await askHidden("Confirm password: ");

  if (password !== confirmation) {
    throw new Error("Passwords do not match.");
  }

  return password;
}

async function main() {
  const command = process.argv[2];

  if (command !== "create" && command !== "password") {
    throw new Error("Usage: npm run admin:create | npm run admin:password");
  }

  await connectDB();

  if (command === "create") {
    if (await AdminAccount.exists({})) {
      throw new Error(
        "An admin account already exists. Use admin:password to change its password.",
      );
    }

    const username = (await ask("Admin username: ")).trim();

    if (!username || username.length > 100) {
      throw new Error("Username must be between 1 and 100 characters.");
    }

    const password = await readNewPassword();
    await AdminAccount.create({
      username,
      passwordHash: await bcrypt.hash(password, 12),
      sessionVersion: 0,
    });
    console.log("Admin account created.");
    return;
  }

  const username = (await ask("Admin username: ")).trim();
  const account = await AdminAccount.findOne({ username });

  if (!account) {
    throw new Error("No admin account exists with that username.");
  }

  const password = await readNewPassword();
  const result = await AdminAccount.updateOne(
    { _id: account._id, sessionVersion: account.sessionVersion },
    {
      $set: { passwordHash: await bcrypt.hash(password, 12) },
      $inc: { sessionVersion: 1 },
    },
  );

  if (result.modifiedCount !== 1) {
    throw new Error(
      "The admin account changed during the password update. Try again.",
    );
  }

  console.log("Admin password updated. All existing sessions are invalidated.");
}

try {
  await main();
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Admin account operation failed.",
  );
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
