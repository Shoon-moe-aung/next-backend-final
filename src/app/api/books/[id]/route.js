import { requireRole } from "@/lib/auth";
import corsHeaders from "@/lib/cors";
import { getClientPromise } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

const DB_NAME = process.env.DB_NAME || "library_management";
const BOOK_COLLECTION = "books";

function parseId(id) {
  if (!ObjectId.isValid(id)) return null;
  return new ObjectId(id);
}

function parseBookFields(payload, { requireAll = false } = {}) {
  const update = {};
  const hasTitle = payload.title !== undefined;
  const hasAuthor = payload.author !== undefined;
  const hasLocation = payload.location !== undefined;
  const hasQuantity = payload.quantity !== undefined;

  if (requireAll && (!hasTitle || !hasAuthor || !hasLocation || !hasQuantity)) {
    return { error: "Missing mandatory fields" };
  }

  if (hasTitle) {
    const title = payload.title?.trim();
    if (!title) return { error: "Invalid title" };
    update.title = title;
  }

  if (hasAuthor) {
    const author = payload.author?.trim();
    if (!author) return { error: "Invalid author" };
    update.author = author;
  }

  if (hasLocation) {
    const location = payload.location?.trim();
    if (!location) return { error: "Invalid location" };
    update.location = location;
  }

  if (hasQuantity) {
    const quantity = Number(payload.quantity);
    if (Number.isNaN(quantity) || quantity < 0) return { error: "Invalid quantity" };
    update.quantity = quantity;
  }

  if (Object.keys(update).length === 0) {
    return { error: "No valid fields to update" };
  }

  return { update };
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function GET(req, { params }) {
  const { user, errorResponse } = await requireRole(req, ["ADMIN", "USER"]);
  if (errorResponse) return errorResponse;

  const id = parseId((await params).id);
  if (!id) {
    return NextResponse.json({ message: "Invalid id" }, { status: 400, headers: corsHeaders });
  }

  const client = await getClientPromise();
  const db = client.db(DB_NAME);
  const book = await db.collection(BOOK_COLLECTION).findOne({ _id: id });

  if (!book || (book.status === "DELETED" && user.role !== "ADMIN")) {
    return NextResponse.json({ message: "Book not found" }, { status: 404, headers: corsHeaders });
  }

  return NextResponse.json(book, { status: 200, headers: corsHeaders });
}

export async function PATCH(req, { params }) {
  const { errorResponse } = await requireRole(req, ["ADMIN"]);
  if (errorResponse) return errorResponse;

  const id = parseId((await params).id);
  if (!id) {
    return NextResponse.json({ message: "Invalid id" }, { status: 400, headers: corsHeaders });
  }

  const payload = await req.json();
  const { update, error } = parseBookFields(payload);
  if (error) {
    return NextResponse.json({ message: error }, { status: 400, headers: corsHeaders });
  }

  update.updatedAt = new Date();

  const client = await getClientPromise();
  const db = client.db(DB_NAME);
  const result = await db.collection(BOOK_COLLECTION).findOneAndUpdate(
    { _id: id },
    { $set: update },
    { returnDocument: "after" }
  );

  if (!result) {
    return NextResponse.json({ message: "Book not found" }, { status: 404, headers: corsHeaders });
  }

  return NextResponse.json(result, { status: 200, headers: corsHeaders });
}

export async function PUT(req, { params }) {
  const { errorResponse } = await requireRole(req, ["ADMIN"]);
  if (errorResponse) return errorResponse;

  const id = parseId((await params).id);
  if (!id) {
    return NextResponse.json({ message: "Invalid id" }, { status: 400, headers: corsHeaders });
  }

  const payload = await req.json();
  const { update, error } = parseBookFields(payload, { requireAll: true });
  if (error) {
    return NextResponse.json({ message: error }, { status: 400, headers: corsHeaders });
  }

  update.updatedAt = new Date();

  const client = await getClientPromise();
  const db = client.db(DB_NAME);
  const result = await db.collection(BOOK_COLLECTION).findOneAndUpdate(
    { _id: id },
    { $set: update },
    { returnDocument: "after" }
  );

  if (!result) {
    return NextResponse.json({ message: "Book not found" }, { status: 404, headers: corsHeaders });
  }

  return NextResponse.json(result, { status: 200, headers: corsHeaders });
}

export async function DELETE(req, { params }) {
  const { errorResponse } = await requireRole(req, ["ADMIN"]);
  if (errorResponse) return errorResponse;

  const id = parseId((await params).id);
  if (!id) {
    return NextResponse.json({ message: "Invalid id" }, { status: 400, headers: corsHeaders });
  }

  const client = await getClientPromise();
  const db = client.db(DB_NAME);

  const result = await db.collection(BOOK_COLLECTION).findOneAndUpdate(
    { _id: id, status: { $ne: "DELETED" } },
    {
      $set: {
        status: "DELETED",
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  );

  if (!result) {
    return NextResponse.json({ message: "Book not found" }, { status: 404, headers: corsHeaders });
  }

  return NextResponse.json(result, { status: 200, headers: corsHeaders });
}
