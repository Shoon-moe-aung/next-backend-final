import { getClientPromise } from "@/lib/mongodb";
import bcrypt from "bcrypt";

const DB_NAME = process.env.DB_NAME || "library_management";
const USER_COLLECTION = "users";
const BOOK_COLLECTION = "books";
const BORROW_COLLECTION = "borrow_requests";

async function upsertTestUser(db, { email, password, role, username }) {
  // Modified: exam requires fixed test users for grading.
  const passwordHash = await bcrypt.hash(password, 10);
  await db.collection(USER_COLLECTION).updateOne(
    { email },
    {
      $set: {
        email,
        username,
        role,
        password: passwordHash,
        status: "ACTIVE",
      },
    },
    { upsert: true }
  );
}

export async function ensureIndexes() {
  const client = await getClientPromise();
  const db = client.db(DB_NAME);

  const userCollection = db.collection(USER_COLLECTION);
  await userCollection.createIndex({ email: 1 }, { unique: true });
  await userCollection.createIndex({ role: 1 });

  const bookCollection = db.collection(BOOK_COLLECTION);
  await bookCollection.createIndex({ status: 1, title: 1 });
  await bookCollection.createIndex({ status: 1, author: 1 });

  const borrowCollection = db.collection(BORROW_COLLECTION);
  await borrowCollection.createIndex({ userId: 1, createdAt: -1 });
  await borrowCollection.createIndex({ bookId: 1, requestStatus: 1 });

  await upsertTestUser(db, {
    email: "admin@test.com",
    password: "admin123",
    role: "ADMIN",
    username: "admin",
  });

  await upsertTestUser(db, {
    email: "user@test.com",
    password: "user123",
    role: "USER",
    username: "user",
  });
}
