import { format } from "date-fns";

import { toNumber } from "@/lib/data-runtime-utils";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";

/**
 * Sends a daily sales summary for each branch to Telegram.
 *
 * Throws when Telegram is not configured or a delivery fails so the cron
 * endpoint can return a truthful failure response.
 */
export async function sendDailySalesReports() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    throw new Error(
      "Telegram credentials are missing (TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID).",
    );
  }

  // Ethiopia uses UTC+3. Calculate local midnight and convert it back to UTC.
  const now = new Date();
  const etOffset = 3 * 60 * 60 * 1000;
  const etNow = new Date(now.getTime() + etOffset);
  const todayStart = new Date(
    new Date(etNow).setHours(0, 0, 0, 0) - etOffset,
  );
  const todayEnd = now;
  const dateLabel = format(etNow, "EEEE, dd MMM yyyy");

  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    select: { id: true, name: true, code: true },
  });

  let reportsSent = 0;

  for (const branch of branches) {
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
      continue;
    }

    const totalSales = sales.reduce((sum, sale) => sum + toNumber(sale.total), 0);
    const cashSales = sales
      .filter((sale) => sale.paymentMethod === "CASH")
      .reduce((sum, sale) => sum + toNumber(sale.total), 0);
    const bankSales = sales
      .filter((sale) => sale.paymentMethod === "BANK")
      .reduce((sum, sale) => sum + toNumber(sale.total), 0);
    const creditSales = sales
      .filter((sale) => sale.paymentMethod === "CREDIT")
      .reduce((sum, sale) => sum + toNumber(sale.total), 0);

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
        bankBreakdown.set(
          entry.financeAccount.name,
          current + toNumber(entry.amount),
        );
      }
    }

    const itemMap = new Map<string, number>();
    for (const sale of sales) {
      for (const item of sale.items) {
        const current = itemMap.get(item.product.name) ?? 0;
        itemMap.set(item.product.name, current + item.quantity);
      }
    }

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

    let message = `Daily Sales Report - ${branch.name} (${branch.code})\n`;
    message += `${dateLabel}\n\n`;
    message += "Financial Summary\n";
    message += `- Total Sales: ${formatCurrency(totalSales)}\n`;
    message += `- Cash: ${formatCurrency(cashSales)}\n`;
    message += `- Bank: ${formatCurrency(bankSales)}\n`;
    message += `- Credit: ${formatCurrency(creditSales)}\n\n`;

    if (bankBreakdown.size > 0) {
      message += "Bank Breakdown\n";
      for (const [bankName, amount] of bankBreakdown) {
        message += `- ${bankName}: ${formatCurrency(amount)}\n`;
      }
      message += "\n";
    }

    message += "Sold Items\n";
    for (const [productName, quantity] of itemMap) {
      message += `- ${productName}: ${quantity} pcs\n`;
    }
    message += "\n";

    if (totalExpenses > 0) {
      message += `Expenses Today: ${formatCurrency(totalExpenses)}\n\n`;
    }

    message += `End of report for ${branch.code}`;

    await sendToTelegram(botToken, chatId, message);
    reportsSent += 1;
  }

  return { reportsSent };
}

async function sendToTelegram(token: string, chatId: string, text: string) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Telegram API request failed with status ${response.status}.`,
      );
    }
  } catch (error) {
    throw new Error("Failed to send the Telegram report.", { cause: error });
  }
}
