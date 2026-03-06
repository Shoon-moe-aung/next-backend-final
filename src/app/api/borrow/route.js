import { requireRole } from "@/lib/auth";
import corsHeaders from "@/lib/cors";
import { getClientPromise } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

const DB_NAME = process.env.DB_NAME || "library_management";
const BOOK_COLLECTION = "books";
const BORROW_COLLECTION = "borrow_requests";

const STATUS = {
  INIT: "INIT",
  CLOSE_NO_AVAILABLE_BOOK: "CLOSE-NO-AVAILABLE-BOOK",
  ACCEPTED: "ACCEPTED",
  CANCEL_ADMIN: "CANCEL-ADMIN",
  CANCEL_USER: "CANCEL-USER",
};

function parseObjectId(value) {
  if (!ObjectId.isValid(value)) return null;
  return new ObjectId(value);
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function GET(req) {
  const { user, errorResponse } = await requireRole(req, ["ADMIN", "USER"]);
  if (errorResponse) return errorResponse;

  const query = user.role === "ADMIN" ? {} : { userId: user._id.toString() };

  const client = await getClientPromise();
  const db = client.db(DB_NAME);
  const requests = await db.collection(BORROW_COLLECTION).find(query).sort({ createdAt: -1 }).toArray();

  return NextResponse.json(requests, { status: 200, headers: corsHeaders });
}

export async function POST(req) {
  const { user, errorResponse } = await requireRole(req, ["USER"]);
  if (errorResponse) return errorResponse;

  const payload = await req.json();
  const bookId = parseObjectId(payload.bookId);
  const targetDate = payload.targetDate ? new Date(payload.targetDate) : null;

  if (!bookId || !targetDate || Number.isNaN(targetDate.getTime())) {
    return NextResponse.json(
      { message: "Invalid borrow request payload" },
      { status: 400, headers: corsHeaders }
    );
  }

  const client = await getClientPromise();
  const db = client.db(DB_NAME);
  const book = await db.collection(BOOK_COLLECTION).findOne({ _id: bookId, status: "ACTIVE" });

  if (!book) {
    return NextResponse.json({ message: "Book not found" }, { status: 404, headers: corsHeaders });
  }

  const status = book.quantity > 0 ? STATUS.INIT : STATUS.CLOSE_NO_AVAILABLE_BOOK;
  const now = new Date();

  const requestDoc = {
    bookId: bookId.toString(),
    userId: user._id.toString(),
    createdAt: now,
    targetDate,
    requestStatus: status,
  };

  const result = await db.collection(BORROW_COLLECTION).insertOne(requestDoc);

  return NextResponse.json(
    { ...requestDoc, _id: result.insertedId },
    { status: 201, headers: corsHeaders }
  );
}

export { STATUS };
