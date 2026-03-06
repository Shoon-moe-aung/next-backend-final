import corsHeaders from "@/lib/cors";
import { getClientPromise } from "@/lib/mongodb";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";

const JWT_SECRET = process.env.JWT_SECRET || "myjwtsecret";
const DB_NAME = process.env.DB_NAME || "library_management";
const USER_COLLECTION = "users";

function readBearerToken(req) {
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
  return authHeader.slice(7);
}

function readTokenFromRequest(req) {
  const cookieToken = req.cookies.get("token")?.value;
  return cookieToken || readBearerToken(req);
}

export function unauthorized(message = "Unauthorized") {
  return NextResponse.json({ message }, { status: 401, headers: corsHeaders });
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json({ message }, { status: 403, headers: corsHeaders });
}

export async function getAuthUser(req) {
  const token = readTokenFromRequest(req);
  if (!token) {
    return { errorResponse: unauthorized("Unauthorized") };
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const client = await getClientPromise();
    const db = client.db(DB_NAME);
    const user = await db.collection(USER_COLLECTION).findOne(
      { email: decoded.email, status: "ACTIVE" },
      { projection: { password: 0 } }
    );

    if (!user) {
      return { errorResponse: unauthorized("Unauthorized") };
    }

    return { user };
  } catch {
    return { errorResponse: unauthorized("Unauthorized") };
  }
}

export async function requireRole(req, allowedRoles = []) {
  const { user, errorResponse } = await getAuthUser(req);
  if (errorResponse) return { errorResponse };

  if (!allowedRoles.includes(user.role)) {
    return { errorResponse: forbidden("You are not allowed to perform this action") };
  }

  return { user };
}
