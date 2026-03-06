import corsHeaders from "@/lib/cors";
import { ensureIndexes } from "@/lib/ensureIndexes";
import { getClientPromise } from "@/lib/mongodb";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";

const JWT_SECRET = process.env.JWT_SECRET || "myjwtsecret";
const DB_NAME = process.env.DB_NAME || "library_management";
const USER_COLLECTION = "users";

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function POST(req) {
  const data = await req.json();
  const { email, password } = data;

  if (!email || !password) {
    return NextResponse.json(
      { message: "Missing email or password" },
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    await ensureIndexes();

    const client = await getClientPromise();
    const db = client.db(DB_NAME);

    const user = await db.collection(USER_COLLECTION).findOne({ email, status: "ACTIVE" });
    if (!user) {
      return NextResponse.json(
        { message: "Invalid email or password" },
        { status: 401, headers: corsHeaders }
      );
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return NextResponse.json(
        { message: "Invalid email or password" },
        { status: 401, headers: corsHeaders }
      );
    }

    const token = jwt.sign(
      {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    const response = NextResponse.json(
      {
        message: "Login successful",
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          role: user.role,
        },
      },
      { status: 200, headers: corsHeaders }
    );

    response.cookies.set("token", token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch {
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
