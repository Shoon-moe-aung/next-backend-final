import corsHeaders from "@/lib/cors";
import { requireRole } from "@/lib/auth";
import { getClientPromise } from "@/lib/mongodb";
import bcrypt from "bcrypt";
import { NextResponse } from "next/server";

const DB_NAME = process.env.DB_NAME || "library_management";
const USER_COLLECTION = "users";

export async function POST(req) {
  const { errorResponse } = await requireRole(req, ["ADMIN"]);
  if (errorResponse) return errorResponse;

  const data = await req.json();
  const username = data.username?.trim();
  const email = data.email?.trim();
  const password = data.password;

  if (!username || !email || !password) {
    return NextResponse.json(
      { message: "Missing mandatory data" },
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    const client = await getClientPromise();
    const db = client.db(DB_NAME);
    const result = await db.collection(USER_COLLECTION).insertOne({
      username,
      email,
      password: await bcrypt.hash(password, 10),
      role: "USER",
      status: "ACTIVE",
      createdAt: new Date(),
    });

    return NextResponse.json({ id: result.insertedId }, { status: 200, headers: corsHeaders });
  } catch (exception) {
    const errorMsg = exception.toString().toLowerCase();
    let displayErrorMsg = "Registration failed";

    if (errorMsg.includes("duplicate")) {
      if (errorMsg.includes("username")) {
        displayErrorMsg = "Duplicate Username";
      } else if (errorMsg.includes("email")) {
        displayErrorMsg = "Duplicate Email";
      }
    }

    return NextResponse.json(
      { message: displayErrorMsg },
      { status: 400, headers: corsHeaders }
    );
  }
}
