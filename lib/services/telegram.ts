import { startOfDay, endOfDay, format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { toNumber, sumRows } from "@/lib/data-runtime-utils";

/**
 * Sends a daily sales summary for each branch to Telegram.
 */
export async function sendDailySalesReports() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.error("Telegram credentials missing (TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID)");
    return;
  }

  // Ethiopia is UTC+3. We need to calculate the start of the day in ET.
  const now = new Date();
  const etOffset = 3 * 60 * 60 * 1000;
  const etNow = new Date(now.getTime() + etOffset);
  
  // Start of day in Ethiopia (00:00:00 ET) converted back to UTC for Prisma
  const todayStart = new Date(new Date(etNow).setHours(0, 0, 0, 0) - etOffset);
  const todayEnd = now;
  
  const dateLabel = format(etNow, "EEEE, dd MMM yyyy");

  // Get all active branches
  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    select: { id: true, name: true, code: true },
  });

  for (const branch of branches) {
    // 1. Fetch Sales Data
    const sales = await prisma.sale.findMany({
      where: {
        branchId: branch.id,
        status: "COMPLETED",
        soldAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
      include: {
        items: {
          include: {
            product: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (sales.length === 0) {
      // Optional: Skip branches with no sales or send a "No sales" message
      continue;
    }

    // 2. Aggregate Financials
    const totalSales = sales.reduce((sum, s) => sum + toNumber(s.total), 0);
    const cashSales = sales
      .filter((s) => s.paymentMethod === "CASH")
      .reduce((sum, s) => sum + toNumber(s.total), 0);
    const bankSales = sales
      .filter((s) => s.paymentMethod === "BANK")
      .reduce((sum, s) => sum + toNumber(s.total), 0);
    const creditSales = sales
      .filter((s) => s.paymentMethod === "CREDIT")
      .reduce((sum, s) => sum + toNumber(s.total), 0);

    // 3. Bank Breakdown
    const bankLedgerEntries = await prisma.ledgerEntry.findMany({
      where: {
        branchId: branch.id,
        entryType: "SALE",
        entryDate: {
          gte: todayStart,
          lte: todayEnd,
        },
        financeAccount: {
          type: "BANK",
        },
      },
      include: {
        financeAccount: {
          select: { name: true },
        },
      },
    });

    const bankBreakdown = new Map<string, number>();
    for (const entry of bankLedgerEntries) {
      if (entry.financeAccount) {
        const current = bankBreakdown.get(entry.financeAccount.name) ?? 0;
        bankBreakdown.set(entry.financeAccount.name, current + toNumber(entry.amount));
      }
    }

    // 4. Itemized Sales
    const itemMap = new Map<string, number>();
    for (const sale of sales) {
      for (const item of sale.items) {
        const current = itemMap.get(item.product.name) ?? 0;
        itemMap.set(item.product.name, current + item.quantity);
      }
    }

    // 5. Expenses
    const expenseAggregate = await prisma.expense.aggregate({
      where: {
        branchId: branch.id,
        status: "POSTED",
        expenseDate: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
      _sum: {
        amount: true,
      },
    });
    const totalExpenses = toNumber(expenseAggregate._sum.amount);

    // 6. Format Message
    let message = `📊 *Daily Sales Report - ${branch.name} (${branch.code})*\n`;
    message += `📅 _${dateLabel}_\n\n`;

    message += `💰 *Financial Summary*\n`;
    message += `• *Total Sales:* ${formatCurrency(totalSales)}\n`;
    message += `• *Cash:* ${formatCurrency(cashSales)}\n`;
    message += `• *Bank:* ${formatCurrency(bankSales)}\n`;
    message += `• *Credit:* ${formatCurrency(creditSales)}\n\n`;

    if (bankBreakdown.size > 0) {
      message += `🏦 *Bank Breakdown*\n`;
      for (const [bankName, amount] of bankBreakdown) {
        message += `• ${bankName}: ${formatCurrency(amount)}\n`;
      }
      message += `\n`;
    }

    message += `📦 *Sold Items*\n`;
    if (itemMap.size > 0) {
      for (const [productName, qty] of itemMap) {
        message += `• ${productName}: ${qty} pcs\n`;
      }
    } else {
      message += `• No items recorded.\n`;
    }
    message += `\n`;

    if (totalExpenses > 0) {
      message += `💸 *Expenses Today:* ${formatCurrency(totalExpenses)}\n\n`;
    }

    message += `✅ _End of report for ${branch.code}_`;

    // 7. Send to Telegram
    await sendToTelegram(botToken, chatId, message);
  }
}

async function sendToTelegram(token: string, chatId: string, text: string) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: "Markdown",
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Telegram API Error:", error);
    }
  } catch (error) {
    console.error("Failed to send Telegram message:", error);
  }
}
