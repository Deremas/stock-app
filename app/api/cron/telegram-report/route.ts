import { NextRequest, NextResponse } from "next/server";
import { sendDailySalesReports } from "@/lib/services/telegram";

export const dynamic = "force-dynamic";

/**
 * API route to trigger daily sales reports via Telegram.
 * Protected by CRON_SECRET environment variable.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // Basic security check for the cron job
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    await sendDailySalesReports();
    return NextResponse.json({ success: true, message: "Reports sent successfully" });
  } catch (error) {
    console.error("Failed to send daily sales reports:", error);
    return NextResponse.json({ success: false, message: "Failed to send reports" }, { status: 500 });
  }
}
