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

const VALID_STATUS = new Set(Object.values(STATUS));

function parseId(id) {
  if (!ObjectId.isValid(id)) return null;
  return new ObjectId(id);
}

function isTransitionAllowed(currentStatus, nextStatus) {
  // Modified: disallow no-op transitions to avoid repeated ACCEPTED updates.
  if (currentStatus === nextStatus) return false;

  const transitions = {
    [STATUS.INIT]: new Set([STATUS.ACCEPTED, STATUS.CANCEL_ADMIN, STATUS.CLOSE_NO_AVAILABLE_BOOK]),
    [STATUS.ACCEPTED]: new Set([STATUS.CANCEL_ADMIN]),
    [STATUS.CLOSE_NO_AVAILABLE_BOOK]: new Set([STATUS.ACCEPTED, STATUS.CANCEL_ADMIN]),
    [STATUS.CANCEL_ADMIN]: new Set(),
    [STATUS.CANCEL_USER]: new Set(),
  };

  return transitions[currentStatus]?.has(nextStatus) || false;
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function PATCH(req, { params }) {
  const { user, errorResponse } = await requireRole(req, ["ADMIN", "USER"]);
  if (errorResponse) return errorResponse;

  const id = parseId((await params).id);
  if (!id) {
    return NextResponse.json({ message: "Invalid id" }, { status: 400, headers: corsHeaders });
  }

  const payload = await req.json();
  const nextStatus = payload.requestStatus;

  if (!VALID_STATUS.has(nextStatus)) {
    return NextResponse.json({ message: "Invalid request status" }, { status: 400, headers: corsHeaders });
  }

  const client = await getClientPromise();
  const db = client.db(DB_NAME);
  const borrowRequest = await db.collection(BORROW_COLLECTION).findOne({ _id: id });

  if (!borrowRequest) {
    return NextResponse.json({ message: "Borrow request not found" }, { status: 404, headers: corsHeaders });
  }

  if (user.role === "USER") {
    if (borrowRequest.userId !== user._id.toString()) {
      return NextResponse.json({ message: "You are not allowed to perform this action" }, { status: 403, headers: corsHeaders });
    }

    if (nextStatus !== STATUS.CANCEL_USER || borrowRequest.requestStatus !== STATUS.INIT) {
      return NextResponse.json({ message: "Invalid operation" }, { status: 400, headers: corsHeaders });
    }
  }

  if (user.role === "ADMIN") {
    if (!isTransitionAllowed(borrowRequest.requestStatus, nextStatus)) {
      return NextResponse.json({ message: "Invalid status transition" }, { status: 400, headers: corsHeaders });
    }

    const bookId = parseId(borrowRequest.bookId);
    if (!bookId) {
      return NextResponse.json({ message: "Book not found" }, { status: 404, headers: corsHeaders });
    }

    if (nextStatus === STATUS.ACCEPTED) {
      // Atomic stock decrement prevents race conditions and negative quantity.
      const stockUpdated = await db.collection(BOOK_COLLECTION).updateOne(
        { _id: bookId, status: "ACTIVE", quantity: { $gt: 0 } },
        { $inc: { quantity: -1 }, $set: { updatedAt: new Date() } }
      );

      if (stockUpdated.modifiedCount === 0) {
        return NextResponse.json(
          { message: "No available quantity for this book" },
          { status: 400, headers: corsHeaders }
        );
      }
    }

    // If an already accepted request is canceled by admin, return the stock.
    if (borrowRequest.requestStatus === STATUS.ACCEPTED && nextStatus === STATUS.CANCEL_ADMIN) {
      await db.collection(BOOK_COLLECTION).updateOne(
        { _id: bookId, status: "ACTIVE" },
        { $inc: { quantity: 1 }, $set: { updatedAt: new Date() } }
      );
    }
  }

  const updated = await db.collection(BORROW_COLLECTION).findOneAndUpdate(
    { _id: id },
    {
      $set: {
        requestStatus: nextStatus,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  );

  return NextResponse.json(updated, { status: 200, headers: corsHeaders });
}
