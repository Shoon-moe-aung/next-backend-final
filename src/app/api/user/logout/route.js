
// REFERENCE: This file is provided as a user logout example.
// Students must implement authentication and role-based logic as required in the exam.
import { requireRole } from "@/lib/auth";
import corsHeaders from "@/lib/cors";
import { NextResponse } from "next/server";

export async function OPTIONS(req) {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function POST(req) {
  const { errorResponse } = await requireRole(req, ["ADMIN", "USER"]);
  if (errorResponse) return errorResponse;

  // Clear the JWT cookie by setting it to empty and expired
  const response = NextResponse.json({
    message: "Logout successful"
  }, {
    status: 200,
    headers: corsHeaders
  });
  response.cookies.set("token", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure: process.env.NODE_ENV === "production"
  });
  return response;
}
