import { getAuthUser } from "@/lib/auth";
import corsHeaders from "@/lib/cors";
import { NextResponse } from "next/server";

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function GET(req) {
  const { user, errorResponse } = await getAuthUser(req);
  if (errorResponse) return errorResponse;

  return NextResponse.json(
    {
      id: user._id,
      email: user.email,
      username: user.username,
      role: user.role,
    },
    { status: 200, headers: corsHeaders }
  );
}
