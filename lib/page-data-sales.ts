import { endOfDay, parseISO } from "date-fns";

import { formatFinanceAccountLabel } from "@/lib/finance-account-utils";
import { prisma } from "@/lib/prisma";
import type { RowActionConfig, SimpleRow } from "@/lib/table";
import { toNumber, sumRows } from "@/lib/data-runtime-utils";

type SalesFilters = {
  customerId?: string;
  sellerId?: string;
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
  type?: "PARTNER" | "WALK_IN";
};

function getSoldAtRangeFilter(filters: Pick<SalesFilters, "dateFrom" | "dateTo">) {
  if (!filters.dateFrom && !filters.dateTo) {
    return undefined;
  }

  const soldAt: {
    gte?: Date;
    lte?: Date;
  } = {};

  if (filters.dateFrom) {
    const parsedDate = parseISO(filters.dateFrom);

    if (!Number.isNaN(parsedDate.getTime())) {
      soldAt.gte = parsedDate;
    }
  }

  if (filters.dateTo) {
    const parsedDate = parseISO(filters.dateTo);

    if (!Number.isNaN(parsedDate.getTime())) {
      soldAt.lte = endOfDay(parsedDate);
    }
  }

  return Object.keys(soldAt).length > 0 ? soldAt : undefined;
}

function withFilter(path: string, params: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
}

function createRowAction(action: RowActionConfig) {
  return action;
}

export async function getCustomerMetrics(customerId: string, branchId?: string) {
  const stats = await prisma.sale.aggregate({
    where: {
      customerId,
      ...(branchId ? { branchId } : {}),
      status: "COMPLETED",
    },
    _sum: {
      total: true,
      amountPaid: true,
      amountDue: true,
    },
    _max: {
      soldAt: true,
    },
  });

  return {
    totalPurchases: toNumber(stats._sum.total),
    totalPaid: toNumber(stats._sum.amountPaid),
    creditBalance: toNumber(stats._sum.amountDue),
    lastPurchaseAt: stats._max.soldAt,
  };
}

export async function getSalesRows(filters: SalesFilters = {}) {
  const soldAt = getSoldAtRangeFilter(filters);

  const sales = await prisma.sale.findMany({
    where: {
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
      ...(soldAt ? { soldAt } : {}),
      ...(filters.type === "PARTNER" ? { customerId: { not: null } } : {}),
      ...(filters.type === "WALK_IN" ? { customerId: null } : {}),
    },
    orderBy: {
      soldAt: "desc",
    },
    include: {
      branch: {
        select: {
          name: true,
        },
      },
      customer: {
        select: {
          name: true,
        },
      },
    },
  });

  return sales.map(
    (sale) =>
      ({
        id: sale.id,
        saleNumber: sale.saleNumber,
        branch: sale.branch.name,
        customer: sale.customer?.name ?? "Walk-in",
        paymentMethod: sale.paymentMethod,
        total: toNumber(sale.total),
        amountDue: toNumber(sale.amountDue),
        soldAt: sale.soldAt.toISOString(),
        __actions: [
          createRowAction({
            key: "view",
            label: "View",
            href: `/sales/sales-list/${sale.id}`,
            icon: "view",
          }),
          createRowAction({
            key: "print",
            label: "Print",
            href: `/print/sale/${sale.id}`,
            icon: "print",
          }),
        ],
      }) satisfies SimpleRow,
  );
}

export async function getSoldItemRows(filters: SalesFilters = {}) {
  const soldAt = getSoldAtRangeFilter(filters);
  const saleFilter =
    filters.branchId || filters.customerId || soldAt
      ? {
          ...(filters.branchId ? { branchId: filters.branchId } : {}),
          ...(filters.customerId ? { customerId: filters.customerId } : {}),
          ...(soldAt ? { soldAt } : {}),
        }
      : null;

  const saleItems = await prisma.saleItem.findMany({
    where: {
      ...(saleFilter ? { sale: saleFilter } : {}),
      ...(filters.sellerId
        ? {
            allocations: {
              some: {
                OR: [
                  {
                    sellerIntakeItem: {
                      sellerIntake: {
                        sellerId: filters.sellerId,
                      },
                    },
                  },
                  {
                    sellerAssignmentItem: {
                      sellerAssignment: {
                        sellerId: filters.sellerId,
                      },
                    },
                  },
                ],
              },
            },
          }
        : {}),
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      product: {
        select: {
          name: true,
        },
      },
      sale: {
        select: {
          saleNumber: true,
          soldAt: true,
          customer: {
            select: {
              name: true,
            },
          },
          branch: {
            select: {
              name: true,
            },
          },
        },
      },
      allocations: {
        select: {
          sourceType: true,
          sellerIntakeItem: {
            select: {
              sellerIntake: {
                select: {
                  intakeNumber: true,
                  seller: {
                    select: {
                      fullName: true,
                    },
                  },
                },
              },
            },
          },
          sellerAssignmentItem: {
            select: {
              sellerAssignment: {
                select: {
                  assignmentNumber: true,
                  seller: {
                    select: {
                      fullName: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return saleItems.map((saleItem) => {
    const sources = [...new Set(saleItem.allocations.map((item) => item.sourceType))];
    const sourceNumbers = [
      ...new Set(
        saleItem.allocations
          .map(
            (item) =>
              item.sellerAssignmentItem?.sellerAssignment.assignmentNumber ??
              item.sellerIntakeItem?.sellerIntake.intakeNumber,
          )
          .filter(Boolean),
      ),
    ];
    const sellers = [
      ...new Set(
        saleItem.allocations
          .map(
            (item) =>
              item.sellerAssignmentItem?.sellerAssignment.seller.fullName ??
              item.sellerIntakeItem?.sellerIntake.seller.fullName,
          )
          .filter(Boolean),
      ),
    ];

    return {
      id: saleItem.id,
      saleNumber: saleItem.sale.saleNumber,
      branch: saleItem.sale.branch.name,
      product: saleItem.product.name,
      quantity: saleItem.quantity,
      source: sources.length === 1 ? sources[0] : sources.join(" / "),
      batchNumber: sourceNumbers.length > 0 ? sourceNumbers.join(", ") : "-",
      seller: sellers.length > 0 ? sellers.join(", ") : "-",
      customer: saleItem.sale.customer?.name ?? "Walk-in",
      unitPrice: toNumber(saleItem.unitPrice),
      discount: toNumber((saleItem as any).discount ?? 0),
      fixedDiscount: toNumber((saleItem as any).fixedDiscount ?? 0),
      total: toNumber(saleItem.lineTotal),
      soldAt: saleItem.sale.soldAt.toISOString(),
    } satisfies SimpleRow;
  });
}

export async function getSalesProfitRows(filters: SalesFilters = {}) {
  const soldAt = getSoldAtRangeFilter(filters);

  const saleItems = await prisma.saleItem.findMany({
    where: {
      sale: {
        ...(filters.branchId ? { branchId: filters.branchId } : {}),
        ...(soldAt ? { soldAt } : {}),
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      product: {
        select: {
          name: true,
        },
      },
      sale: {
        select: {
          saleNumber: true,
          soldAt: true,
          branch: {
            select: {
              name: true,
            },
          },
        },
      },
      allocations: {
        select: {
          quantity: true,
          sourceType: true,
          unitCost: true,
          sellerAmount: true,
          sellerIntakeItem: {
            select: {
              sellerIntake: {
                select: {
                  seller: {
                    select: {
                      fullName: true,
                    },
                  },
                },
              },
            },
          },
          sellerAssignmentItem: {
            select: {
              sellerIntakeItemId: true,
              sellerAssignment: {
                select: {
                  seller: {
                    select: {
                      fullName: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return saleItems.map((saleItem) => {
    const sources = [...new Set(saleItem.allocations.map((item) => item.sourceType))];
    const partners = [
      ...new Set(
        saleItem.allocations
          .map(
            (item) =>
              item.sellerAssignmentItem?.sellerAssignment.seller.fullName ??
              item.sellerIntakeItem?.sellerIntake.seller.fullName,
          )
          .filter(Boolean),
      ),
    ];
    const isPartnerOwnedAllocation = (allocation: (typeof saleItem.allocations)[number]) =>
      allocation.sourceType === "SELLER_CONSIGNMENT" ||
      (allocation.sourceType === "SELLER_ASSIGNED" &&
        Boolean(allocation.sellerAssignmentItem?.sellerIntakeItemId));
    const partnerPayable = Number(
      saleItem.allocations
        .reduce((sum, allocation) => {
          if (!isPartnerOwnedAllocation(allocation)) {
            return sum;
          }

          return sum + toNumber(allocation.sellerAmount) * allocation.quantity;
        }, 0)
        .toFixed(2),
    );
    const costTotal = Number(
      saleItem.allocations
        .reduce((sum, allocation) => {
          if (!isPartnerOwnedAllocation(allocation)) {
            return sum + toNumber(allocation.unitCost) * allocation.quantity;
          }

          return sum + toNumber(allocation.sellerAmount) * allocation.quantity;
        }, 0)
        .toFixed(2),
    );
    const saleTotal = toNumber(saleItem.lineTotal);

    return {
      id: saleItem.id,
      soldAt: saleItem.sale.soldAt.toISOString(),
      saleNumber: saleItem.sale.saleNumber,
      branch: saleItem.sale.branch.name,
      product: saleItem.product.name,
      source: sources.length === 1 ? sources[0] : sources.join(" / "),
      partner: partners.length > 0 ? partners.join(", ") : "-",
      quantity: saleItem.quantity,
      saleTotal,
      costTotal,
      partnerPayable,
      grossProfit: Number((saleTotal - costTotal).toFixed(2)),
    } satisfies SimpleRow;
  });
}

export async function getCustomerRows(
  filters: Pick<SalesFilters, "branchId" | "customerId"> = {},
) {
  const customers = await prisma.customer.findMany({
    where: {
      isActive: true,
      ...(filters.customerId ? { id: filters.customerId } : {}),
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
      phone: true,
      address: true,
      note: true,
      isActive: true,
      sales: {
        where: {
          ...(filters.branchId ? { branchId: filters.branchId } : {}),
        },
        select: {
          total: true,
          amountDue: true,
          soldAt: true,
        },
      },
    },
  });

  return customers.map((customer) => {
    const totalPurchases = sumRows(customer.sales.map((sale) => toNumber(sale.total)));
    const creditBalance = sumRows(customer.sales.map((sale) => toNumber(sale.amountDue)));
    const lastSale = customer.sales
      .map((sale) => sale.soldAt)
      .sort((left, right) => right.getTime() - left.getTime())[0];

    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone ?? "-",
      location: customer.address ?? "-",
      note: customer.note ?? "-",
      totalPurchases,
      creditBalance,
      lastPurchaseAt: lastSale?.toISOString() ?? "",
      status: customer.isActive ? "ACTIVE" : "INACTIVE",
      __actions: [
        createRowAction({
          key: "sales",
          label: "Sales",
          href: withFilter("/sales/sales-list", {
            customerId: customer.id,
            q: customer.name,
          }),
          icon: "salesList",
        }),
        ...(creditBalance > 0
          ? [
              createRowAction({
                key: "settle-full",
                label: "Settle Full",
                href: withFilter("/sales/customer-payments", {
                  customerId: customer.id,
                  q: customer.name,
                  open: "1",
                  settlementMode: "FULL",
                }),
                icon: "customerPayments",
              }),
              createRowAction({
                key: "settle-partial",
                label: "Settle Partial",
                href: withFilter("/sales/customer-payments", {
                  customerId: customer.id,
                  q: customer.name,
                  open: "1",
                  settlementMode: "PARTIAL",
                }),
                icon: "customerPayments",
              }),
              createRowAction({
                key: "credit",
                label: "Credit",
                href: withFilter("/sales/customer-credit", {
                  customerId: customer.id,
                  q: customer.name,
                }),
                icon: "customerCredit",
              }),
            ]
          : []),
        createRowAction({
          key: "payments",
          label: "Payments",
          href: withFilter("/sales/customer-payments", {
            customerId: customer.id,
            q: customer.name,
          }),
          icon: "customerPayments",
        }),
        createRowAction({
          key: "sold-items",
          label: "Sold Items",
          href: withFilter("/sales/sold-items", {
            customerId: customer.id,
            q: customer.name,
          }),
          icon: "soldItems",
        }),
      ],
    } satisfies SimpleRow;
  });
}

export async function getCustomerCreditRows(
  filters: Pick<SalesFilters, "branchId" | "customerId"> = {},
) {
  const customers = await getCustomerRows(filters);

  return customers
    .filter((customer) => toNumber(customer.creditBalance) > 0)
    .map((customer) => ({
      id: customer.id,
      customer: String(customer.name),
      phone: String(customer.phone),
      outstanding: toNumber(customer.creditBalance),
      agingBucket: customer.lastPurchaseAt ? "OUTSTANDING" : "CURRENT",
      lastPurchaseAt: String(customer.lastPurchaseAt),
      status: String(customer.status),
      __actions: customer.__actions,
    })) satisfies SimpleRow[];
}

export async function getCustomerPaymentRows(
  filters: Pick<SalesFilters, "branchId" | "customerId"> = {},
) {
  const rows = await prisma.customerPayment.findMany({
    where: {
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
    },
    orderBy: {
      paymentDate: "desc",
    },
    include: {
      customer: {
        select: {
          name: true,
        },
      },
      sale: {
        select: {
          saleNumber: true,
        },
      },
      branch: {
        select: {
          name: true,
        },
      },
      financeAccount: {
        select: {
          name: true,
          type: true,
          bankName: true,
          accountNumber: true,
        },
      },
    },
  });

  return rows.map(
    (row) =>
      ({
        id: row.id,
        receiptNumber: row.paymentNumber,
        customer: row.customer.name,
        branch: row.branch.name,
        paymentMethod: formatFinanceAccountLabel(row.financeAccount),
        amount: toNumber(row.amount),
        appliedTo: row.sale?.saleNumber ?? "-",
        paidAt: row.paymentDate.toISOString(),
        status: "POSTED",
      }) satisfies SimpleRow,
  );
}
