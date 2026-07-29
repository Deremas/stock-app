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

  if (!cronSecret) {
    console.error("CRON_SECRET is not configured.");
    return NextResponse.json(
      { success: false, message: "Cron service is not configured" },
      { status: 503 },
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sendDailySalesReports();
    return NextResponse.json({
      success: true,
      message: "Reports processed successfully",
      reportsSent: result.reportsSent,
    });
  } catch (error) {
    console.error("Failed to send daily sales reports:", error);
    return NextResponse.json({ success: false, message: "Failed to send reports" }, { status: 500 });
  }
}
