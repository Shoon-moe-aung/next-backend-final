import { requireRole } from "@/lib/auth";
import corsHeaders from "@/lib/cors";
import { getClientPromise } from "@/lib/mongodb";
import { NextResponse } from "next/server";

const DB_NAME = process.env.DB_NAME || "library_management";
const BOOK_COLLECTION = "books";

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function GET(req) {
  const { user, errorResponse } = await requireRole(req, ["ADMIN", "USER"]);
  if (errorResponse) return errorResponse;

  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title")?.trim();
  const author = searchParams.get("author")?.trim();
  const includeDeleted = searchParams.get("includeDeleted") === "true";

  const query = {};

  if (title) {
    query.title = { $regex: title, $options: "i" };
  }

  if (author) {
    query.author = { $regex: author, $options: "i" };
  }

  if (!(user.role === "ADMIN" && includeDeleted)) {
    query.status = "ACTIVE";
  }

  const client = await getClientPromise();
  const db = client.db(DB_NAME);
  const books = await db.collection(BOOK_COLLECTION).find(query).sort({ createdAt: -1 }).toArray();

  return NextResponse.json(books, { status: 200, headers: corsHeaders });
}

export async function POST(req) {
  const { errorResponse } = await requireRole(req, ["ADMIN"]);
  if (errorResponse) return errorResponse;

  const payload = await req.json();
  const title = payload.title?.trim();
  const author = payload.author?.trim();
  const location = payload.location?.trim();
  const quantity = Number(payload.quantity);

  if (!title || !author || !location || Number.isNaN(quantity) || quantity < 0) {
    return NextResponse.json(
      { message: "Invalid book payload" },
      { status: 400, headers: corsHeaders }
    );
  }

  const now = new Date();
  const doc = {
    title,
    author,
    quantity,
    location,
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  };

  const client = await getClientPromise();
  const db = client.db(DB_NAME);
  const result = await db.collection(BOOK_COLLECTION).insertOne(doc);

  return NextResponse.json(
    { ...doc, _id: result.insertedId },
    { status: 201, headers: corsHeaders }
  );
}
