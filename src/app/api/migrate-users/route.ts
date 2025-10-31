import { NextResponse } from "next/server";
import { handleMigrationRequest } from "@/lib/migrate-users";

/**
 * API route to manually trigger migration of existing Clerk users
 * POST /api/migrate-users
 * 
 * This should only be used once after setting up the webhook
 * Consider adding authentication/authorization for production use
 */
export async function POST() {
  try {
    // Optional: Add authentication check here
    // const { userId } = auth();
    // if (!userId) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    console.log("Manual migration triggered");
    const result = await handleMigrationRequest();

    if (result.success) {
      return NextResponse.json(result, { status: 200 });
    } else {
      return NextResponse.json(result, { status: 500 });
    }
  } catch (error) {
    console.error("Migration API error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Optional: Add GET method to check migration status or get user count
export async function GET() {
  return NextResponse.json({
    message: "Migration endpoint ready. Use POST to trigger migration.",
    endpoint: "/api/migrate-users",
    method: "POST",
  });
}
