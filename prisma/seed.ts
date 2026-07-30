import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import argon2 from "argon2";

import {
  AccountType,
  AppRole,
  ExpenseStatus,
  LedgerDirection,
  LedgerEntryType,
  PaymentStatus,
  Prisma,
  PrismaClient,
  PurchaseStatus,
  SalePaymentMethod,
  SaleStatus,
  SettlementStatus,
  StockMovementType,
  StockOwnershipType,
  TransferStatus,
} from "../generated/prisma/client";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run the seed script.");
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });
const EXISTING_BRANCH_ID = "cmn26hvg10000m4vy9cbk94j7";
const EXISTING_BRANCH_CODE = "METEBABE";
const EXISTING_BRANCH_NAME = "Metebaber";
const EXISTING_BRANCH_LOCATION = "Megenagna";
const REQUIRED_USERNAMES = ["admin", "sales"] as const;
const CLEAR_ONLY = process.argv.includes("--clear-only");

type BranchRef = { id: string; code: string; name: string };
type UserRef = { id: string; username: string; name: string };
type AccountRef = {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  branchId: string | null;
};
type ProductRef = { id: string; sku: string; name: string; minimumStockAlert: number };
type SupplierRef = { id: string; name: string };
type CustomerRef = { id: string; name: string };
type SellerRef = { id: string; name: string };
type PurchaseRef = {
  id: string;
  purchaseNumber: string;
  branchId: string;
  supplierId: string | null;
  amountPaid: number;
  amountDue: number;
};
type SaleRef = {
  id: string;
  saleNumber: string;
  branchId: string;
  customerId: string | null;
  amountPaid: number;
  amountDue: number;
};
type PurchaseBatchRef = {
  kind: "purchase";
  id: string;
  reference: string;
  branchId: string;
  productId: string;
  sku: string;
  quantity: number;
  quantityTransferred: number;
  unitCost: number;
  sellingPrice: number;
};
type TransferBatchRef = {
  kind: "transfer";
  id: string;
  reference: string;
  branchId: string;
  productId: string;
  sku: string;
  quantity: number;
  quantityTransferred: number;
  unitCost: number;
  sellingPrice: number;
};
type OwnedBatchRef = PurchaseBatchRef | TransferBatchRef;
type SellerIntakeItemRef = {
  kind: "sellerIntake";
  id: string;
  reference: string;
  branchId: string;
  sellerId: string;
  sku: string;
  productId: string;
  quantityBrought: number;
  quantityAssigned: number;
  quantitySold: number;
  quantityReturned: number;
  sellerFixedPrice: number;
};
type SellerAssignmentItemRef = {
  kind: "sellerAssignment";
  id: string;
  reference: string;
  branchId: string;
  sellerId: string;
  sku: string;
  productId: string;
  quantityAssigned: number;
  quantitySold: number;
  quantityReturned: number;
  unitCost: number;
  sellingPrice: number;
  purchaseItemId?: string;
  transferItemId?: string;
  sellerIntakeItemId?: string;
};
type SaleAllocationRef = {
  id: string;
  saleNumber: string;
  branchId: string;
  sku: string;
  quantity: number;
  sourceType: StockOwnershipType;
  sellerId: string | undefined;
  sellerAmount: number | undefined;
  unitCost: number | undefined;
  sellerAssignmentItemId: string | undefined;
  sellerIntakeItemId: string | undefined;
};
type ProductSeed = {
  sku: string;
  name: string;
  category: string;
  brand: string;
  model: string;
  variant?: string;
  description?: string;
  minimumStockAlert: number;
  compatibilityNote?: string;
  connectorType?: string;
  color?: string;
  warrantyDays?: number;
};
type PurchaseSeedItem = {
  sku: string;
  quantity: number;
  unitCost: number;
  sellingPrice: number;
};
type PurchaseSeed = {
  branchCode: string;
  supplierName: string;
  createdByUsername: string;
  purchasedAt: Date;
  invoiceNumber: string;
  items: PurchaseSeedItem[];
  initialPaid: number;
  paymentAccountCode?: string;
  note?: string;
};
type TransferSeedItem = {
  sku: string;
  quantity: number;
  sourceBatch: OwnedBatchRef;
};
type SellerIntakeSeedItem = {
  sku: string;
  quantityBrought: number;
  sellerFixedPrice: number;
  targetSellingPrice?: number;
};
type SellerAssignmentSeedItem = {
  sku: string;
  quantityAssigned: number;
  sellingPrice: number;
  sourceBatch: OwnedBatchRef;
};
type SaleLineSeed = {
  sku: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  source: PurchaseBatchRef | TransferBatchRef | SellerIntakeItemRef | SellerAssignmentItemRef;
};

const branchesByCode = new Map<string, BranchRef>();
const usersByUsername = new Map<string, UserRef>();
const accountsByCode = new Map<string, AccountRef>();
const productsBySku = new Map<string, ProductRef>();
const suppliersByName = new Map<string, SupplierRef>();
const customersByName = new Map<string, CustomerRef>();
const sellersByName = new Map<string, SellerRef>();
const documentCounters = new Map<string, number>();

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function money(value: number) {
  return new Prisma.Decimal(roundMoney(value).toFixed(2));
}

function must<T>(value: T | null | undefined, message: string): T {
  if (value === undefined || value === null) {
    throw new Error(message);
  }

  return value;
}

function nullable<T>(value: T | undefined | null) {
  return value ?? null;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function localDateKey(value: Date) {
  return `${value.getFullYear()}${pad(value.getMonth() + 1)}${pad(value.getDate())}`;
}

function nextDocumentNumber(prefix: string, value: Date) {
  const current = (documentCounters.get(prefix) ?? 0) + 1;
  documentCounters.set(prefix, current);
  return `${prefix}-${localDateKey(value)}-${String(current).padStart(3, "0")}`;
}

function lineReference(documentNumber: string, sku: string) {
  return `${documentNumber}/${sku}`;
}

function paymentStatusFromAmounts(total: number, amountPaid: number) {
  const safePaid = Math.max(0, roundMoney(amountPaid));
  const amountDue = Math.max(0, roundMoney(total - safePaid));

  if (safePaid <= 0) {
    return { paymentStatus: PaymentStatus.UNPAID, amountPaid: safePaid, amountDue };
  }

  if (amountDue === 0) {
    return { paymentStatus: PaymentStatus.PAID, amountPaid: safePaid, amountDue };
  }

  return { paymentStatus: PaymentStatus.PARTIAL, amountPaid: safePaid, amountDue };
}

function buildDate(base: Date, offsetDays: number, hour: number, minute = 0) {
  const value = new Date(base);
  value.setDate(value.getDate() + offsetDays);
  value.setHours(hour, minute, 0, 0);
  return value;
}

async function clearDatabase() {
  const legacyTables = [
    "sales_exchange_items",
    "sales_return_items",
    "sales_returns",
    "delivery_order_items",
    "delivery_orders",
    "cheques",
    "price_adjustment_history",
    "price_adjustment_batches",
    "product_location_prices",
    "exchange_rate_history",
  ] as const;

  for (const table of legacyTables) {
    const result = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
      `SELECT to_regclass('public."${table}"') IS NOT NULL AS "exists"`,
    );

    if (result[0]?.exists) {
      await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
    }
  }

  await prisma.sellerSettlementAllocation.deleteMany();
  await prisma.sellerCollectionAllocation.deleteMany();
  await prisma.saleItemAllocation.deleteMany();
  await prisma.customerPayment.deleteMany();
  await prisma.supplierPayment.deleteMany();
  await prisma.sellerReturnItem.deleteMany();
  await prisma.sellerReturn.deleteMany();
  await prisma.sellerSettlement.deleteMany();
  await prisma.sellerCollection.deleteMany();
  await prisma.sellerAssignmentItem.deleteMany();
  await prisma.sellerAssignment.deleteMany();
  await prisma.sellerIntakeItem.deleteMany();
  await prisma.sellerIntake.deleteMany();
  await prisma.transferItem.deleteMany();
  await prisma.transfer.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.purchaseItem.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.expenseCategory.deleteMany();
  await prisma.stockBalanceSnapshot.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.alertRecord.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.financeAccount.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.seller.deleteMany();
  await prisma.product.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.category.deleteMany();
  await prisma.session.deleteMany();
  await prisma.userBranch.deleteMany();
  await prisma.user.updateMany({
    where: { defaultBranchId: { not: null } },
    data: { defaultBranchId: null },
  });
  await prisma.branch.deleteMany();
}

async function ensureRequiredUsers() {
  const passwordHash = await argon2.hash("1234");
  const requiredUsers = [
    {
      username: "admin",
      name: "Sam Tech Admin",
      role: AppRole.ADMIN,
    },
    {
      username: "sales",
      name: "Sam Tech Sales",
      role: AppRole.SALES,
    },
  ] as const;

  for (const required of requiredUsers) {
    const user = await prisma.user.upsert({
      where: { username: required.username },
      create: {
        username: required.username,
        displayUsername: required.username,
        name: required.name,
        displayName: required.name,
        role: required.role,
        isActive: true,
      },
      update: {
        displayUsername: required.username,
        name: required.name,
        displayName: required.name,
        role: required.role,
        isActive: true,
        defaultBranchId: null,
      },
      select: { id: true },
    });
    const credential = await prisma.account.findFirst({
      where: { userId: user.id, providerId: "credential" },
      select: { id: true },
    });

    if (credential) {
      await prisma.account.update({
        where: { id: credential.id },
        data: { accountId: user.id, password: passwordHash },
      });
    } else {
      await prisma.account.create({
        data: {
          accountId: user.id,
          providerId: "credential",
          userId: user.id,
          password: passwordHash,
        },
      });
    }
  }
}

async function loadExistingCoreRecords() {
  const branch = await prisma.branch.create({
    data: {
      id: EXISTING_BRANCH_ID,
      code: EXISTING_BRANCH_CODE,
      name: EXISTING_BRANCH_NAME,
      location: EXISTING_BRANCH_LOCATION,
      isActive: true,
    },
    select: { id: true, code: true, name: true },
  });

  branchesByCode.set(branch.code, branch);

  const users = await prisma.user.findMany({
    where: { username: { in: [...REQUIRED_USERNAMES] } },
    select: { id: true, username: true, name: true },
  });

  if (users.length !== REQUIRED_USERNAMES.length) {
    const found = new Set(users.map((user) => user.username));
    const missing = REQUIRED_USERNAMES.filter((username) => !found.has(username));
    throw new Error(`Missing required seeded users: ${missing.join(", ")}.`);
  }

  await prisma.userBranch.createMany({
    data: users.map((user) => ({
      userId: user.id,
      branchId: branch.id,
      isDefault: true,
      isActive: true,
    })),
    skipDuplicates: true,
  });

  for (const user of users) {
    await prisma.user.update({
      where: { id: user.id },
      data: { defaultBranchId: branch.id, isActive: true },
    });

    await prisma.userBranch.updateMany({
      where: { userId: user.id, branchId: branch.id },
      data: { isDefault: true, isActive: true },
    });

    usersByUsername.set(user.username, user);
  }
}

async function createOpeningBalance(args: {
  accountCode: string;
  amount: number;
  entryDate: Date;
}) {
  const account = must(
    accountsByCode.get(args.accountCode),
    `Missing finance account ${args.accountCode}.`,
  );

  await prisma.ledgerEntry.create({
    data: {
      entryDate: args.entryDate,
      branchId: account.branchId,
      financeAccountId: account.id,
      direction: LedgerDirection.DEBIT,
      amount: money(args.amount),
      entryType: LedgerEntryType.OPENING_BALANCE,
      referenceType: "FinanceAccount",
      referenceId: account.code,
      description: `Opening balance for ${account.name}`,
    },
  });
}

async function createPurchase(seed: PurchaseSeed) {
  const branch = must(branchesByCode.get(seed.branchCode), `Missing branch ${seed.branchCode}.`);
  const supplier = must(
    suppliersByName.get(seed.supplierName),
    `Missing supplier ${seed.supplierName}.`,
  );
  const createdBy = must(
    usersByUsername.get(seed.createdByUsername),
    `Missing user ${seed.createdByUsername}.`,
  );
  const paymentAccount = seed.paymentAccountCode
    ? must(
        accountsByCode.get(seed.paymentAccountCode),
        `Missing finance account ${seed.paymentAccountCode}.`,
      )
    : undefined;

  const purchaseNumber = nextDocumentNumber("PUR", seed.purchasedAt);
  const subtotal = roundMoney(
    seed.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0),
  );
  const paymentMeta = paymentStatusFromAmounts(subtotal, seed.initialPaid);

  const purchase = await prisma.purchase.create({
    data: {
      purchaseNumber,
      invoiceNumber: seed.invoiceNumber,
      branchId: branch.id,
      supplierId: supplier.id,
      createdById: createdBy.id,
      paymentAccountId: paymentMeta.amountPaid > 0 ? paymentAccount?.id ?? null : null,
      status: PurchaseStatus.POSTED,
      paymentStatus: paymentMeta.paymentStatus,
      subtotal: money(subtotal),
      discount: money(0),
      tax: money(0),
      total: money(subtotal),
      amountPaid: money(paymentMeta.amountPaid),
      amountDue: money(paymentMeta.amountDue),
      purchasedAt: seed.purchasedAt,
      note: seed.note ?? null,
    },
    select: { id: true },
  });

  const purchaseRef: PurchaseRef = {
    id: purchase.id,
    purchaseNumber,
    branchId: branch.id,
    supplierId: supplier.id,
    amountPaid: paymentMeta.amountPaid,
    amountDue: paymentMeta.amountDue,
  };

  const itemsBySku = new Map<string, PurchaseBatchRef>();

  for (const item of seed.items) {
    const product = must(productsBySku.get(item.sku), `Missing product ${item.sku}.`);

    const purchaseItem = await prisma.purchaseItem.create({
      data: {
        purchaseId: purchase.id,
        productId: product.id,
        quantity: item.quantity,
        unitCost: money(item.unitCost),
        sellingPrice: money(item.sellingPrice),
        lineTotal: money(item.quantity * item.unitCost),
      },
      select: { id: true },
    });

    await prisma.stockMovement.create({
      data: {
        branchId: branch.id,
        productId: product.id,
        movementType: StockMovementType.PURCHASE,
        ownershipType: StockOwnershipType.OWNED,
        quantity: item.quantity,
        unitCost: money(item.unitCost),
        unitValue: money(item.sellingPrice),
        movementDate: seed.purchasedAt,
        sourceType: "Purchase",
        sourceId: purchaseNumber,
        sourceLineId: lineReference(purchaseNumber, item.sku),
        counterpartyType: "Supplier",
        counterpartyId: supplier.id,
      },
    });

    itemsBySku.set(item.sku, {
      kind: "purchase",
      id: purchaseItem.id,
      reference: purchaseNumber,
      branchId: branch.id,
      productId: product.id,
      sku: item.sku,
      quantity: item.quantity,
      quantityTransferred: 0,
      unitCost: item.unitCost,
      sellingPrice: item.sellingPrice,
    });
  }

  if (paymentMeta.amountPaid > 0 && paymentAccount) {
    const paymentNumber = nextDocumentNumber("SPM", seed.purchasedAt);

    await prisma.supplierPayment.create({
      data: {
        paymentNumber,
        supplierId: supplier.id,
        purchaseId: purchase.id,
        branchId: branch.id,
        financeAccountId: paymentAccount.id,
        recordedById: createdBy.id,
        amount: money(paymentMeta.amountPaid),
        paymentDate: seed.purchasedAt,
        note: `Initial payment for ${purchaseNumber}`,
      },
    });

    await prisma.ledgerEntry.create({
      data: {
        entryDate: seed.purchasedAt,
        branchId: branch.id,
        financeAccountId: paymentAccount.id,
        direction: LedgerDirection.CREDIT,
        amount: money(paymentMeta.amountPaid),
        entryType: LedgerEntryType.SUPPLIER_PAYMENT,
        referenceType: "SupplierPayment",
        referenceId: paymentNumber,
        description: `Supplier payment ${paymentNumber} for ${purchaseNumber}`,
      },
    });
  }

  return { purchase: purchaseRef, itemsBySku };
}

async function createSupplierPayment(args: {
  purchase: PurchaseRef;
  supplierName: string;
  branchCode: string;
  recordedByUsername: string;
  paymentDate: Date;
  financeAccountCode: string;
  amount: number;
  note?: string;
}) {
  const supplier = must(
    suppliersByName.get(args.supplierName),
    `Missing supplier ${args.supplierName}.`,
  );
  const branch = must(branchesByCode.get(args.branchCode), `Missing branch ${args.branchCode}.`);
  const recordedBy = must(
    usersByUsername.get(args.recordedByUsername),
    `Missing user ${args.recordedByUsername}.`,
  );
  const financeAccount = must(
    accountsByCode.get(args.financeAccountCode),
    `Missing finance account ${args.financeAccountCode}.`,
  );

  const nextAmounts = paymentStatusFromAmounts(
    args.purchase.amountPaid + args.purchase.amountDue,
    args.purchase.amountPaid + args.amount,
  );
  const paymentNumber = nextDocumentNumber("SPM", args.paymentDate);

  await prisma.supplierPayment.create({
    data: {
      paymentNumber,
      supplierId: supplier.id,
      purchaseId: args.purchase.id,
      branchId: branch.id,
      financeAccountId: financeAccount.id,
      recordedById: recordedBy.id,
      amount: money(args.amount),
      paymentDate: args.paymentDate,
      note: args.note ?? null,
    },
  });

  await prisma.purchase.update({
    where: { id: args.purchase.id },
    data: {
      amountPaid: money(nextAmounts.amountPaid),
      amountDue: money(nextAmounts.amountDue),
      paymentStatus: nextAmounts.paymentStatus,
    },
  });

  await prisma.ledgerEntry.create({
    data: {
      entryDate: args.paymentDate,
      branchId: branch.id,
      financeAccountId: financeAccount.id,
      direction: LedgerDirection.CREDIT,
      amount: money(args.amount),
      entryType: LedgerEntryType.SUPPLIER_PAYMENT,
      referenceType: "SupplierPayment",
      referenceId: paymentNumber,
      description: `Supplier payment ${paymentNumber} for ${args.purchase.purchaseNumber}`,
    },
  });

  args.purchase.amountPaid = nextAmounts.amountPaid;
  args.purchase.amountDue = nextAmounts.amountDue;
}

async function createTransfer(args: {
  sourceBranchCode: string;
  destinationBranchCode: string;
  sentByUsername: string;
  receivedByUsername: string;
  transferAt: Date;
  items: TransferSeedItem[];
  note?: string;
}) {
  const sourceBranch = must(
    branchesByCode.get(args.sourceBranchCode),
    `Missing branch ${args.sourceBranchCode}.`,
  );
  const destinationBranch = must(
    branchesByCode.get(args.destinationBranchCode),
    `Missing branch ${args.destinationBranchCode}.`,
  );
  const sentBy = must(usersByUsername.get(args.sentByUsername), `Missing user ${args.sentByUsername}.`);
  const receivedBy = must(
    usersByUsername.get(args.receivedByUsername),
    `Missing user ${args.receivedByUsername}.`,
  );

  const transferNumber = nextDocumentNumber("TRN", args.transferAt);
  const transfer = await prisma.transfer.create({
    data: {
      transferNumber,
      sourceBranchId: sourceBranch.id,
      destinationBranchId: destinationBranch.id,
      status: TransferStatus.RECEIVED,
      note: args.note ?? null,
      sentById: sentBy.id,
      receivedById: receivedBy.id,
      sentAt: args.transferAt,
      receivedAt: args.transferAt,
    },
    select: { id: true },
  });

  const itemsBySku = new Map<string, TransferBatchRef>();

  for (const item of args.items) {
    const product = must(productsBySku.get(item.sku), `Missing product ${item.sku}.`);

    const transferItem = await prisma.transferItem.create({
      data: {
        transferId: transfer.id,
        productId: product.id,
        quantity: item.quantity,
        unitCost: money(item.sourceBatch.unitCost),
        sellingPrice: money(item.sourceBatch.sellingPrice),
      },
      select: { id: true },
    });

    if (item.sourceBatch.kind === "purchase") {
      await prisma.purchaseItem.update({
        where: { id: item.sourceBatch.id },
        data: {
          quantityTransferred: { increment: item.quantity },
        },
      });
    } else {
      await prisma.transferItem.update({
        where: { id: item.sourceBatch.id },
        data: {
          quantityTransferred: { increment: item.quantity },
        },
      });
    }

    item.sourceBatch.quantityTransferred += item.quantity;

    await prisma.stockMovement.createMany({
      data: [
        {
          branchId: sourceBranch.id,
          productId: product.id,
          movementType: StockMovementType.TRANSFER_OUT,
          ownershipType: StockOwnershipType.OWNED,
          quantity: -item.quantity,
          unitCost: money(item.sourceBatch.unitCost),
          unitValue: money(item.sourceBatch.sellingPrice),
          movementDate: args.transferAt,
          sourceType: "Transfer",
          sourceId: transferNumber,
          sourceLineId: lineReference(transferNumber, item.sku),
          counterpartyType: "Branch",
          counterpartyId: destinationBranch.id,
        },
        {
          branchId: destinationBranch.id,
          productId: product.id,
          movementType: StockMovementType.TRANSFER_IN,
          ownershipType: StockOwnershipType.OWNED,
          quantity: item.quantity,
          unitCost: money(item.sourceBatch.unitCost),
          unitValue: money(item.sourceBatch.sellingPrice),
          movementDate: args.transferAt,
          sourceType: "Transfer",
          sourceId: transferNumber,
          sourceLineId: lineReference(transferNumber, item.sku),
          counterpartyType: "Branch",
          counterpartyId: sourceBranch.id,
        },
      ],
    });

    itemsBySku.set(item.sku, {
      kind: "transfer",
      id: transferItem.id,
      reference: transferNumber,
      branchId: destinationBranch.id,
      productId: product.id,
      sku: item.sku,
      quantity: item.quantity,
      quantityTransferred: 0,
      unitCost: item.sourceBatch.unitCost,
      sellingPrice: item.sourceBatch.sellingPrice,
    });
  }

  return { transferId: transfer.id, transferNumber, itemsBySku };
}

async function createSellerIntake(args: {
  sellerName: string;
  branchCode: string;
  createdByUsername: string;
  bringingDate: Date;
  items: SellerIntakeSeedItem[];
  note?: string;
}) {
  const seller = must(sellersByName.get(args.sellerName), `Missing seller ${args.sellerName}.`);
  const branch = must(branchesByCode.get(args.branchCode), `Missing branch ${args.branchCode}.`);
  const createdBy = must(
    usersByUsername.get(args.createdByUsername),
    `Missing user ${args.createdByUsername}.`,
  );

  const intakeNumber = nextDocumentNumber("SIN", args.bringingDate);
  const intake = await prisma.sellerIntake.create({
    data: {
      intakeNumber,
      sellerId: seller.id,
      branchId: branch.id,
      createdById: createdBy.id,
      bringingDate: args.bringingDate,
      note: args.note ?? null,
    },
    select: { id: true },
  });

  const itemsBySku = new Map<string, SellerIntakeItemRef>();

  for (const item of args.items) {
    const product = must(productsBySku.get(item.sku), `Missing product ${item.sku}.`);

    const intakeItem = await prisma.sellerIntakeItem.create({
      data: {
        sellerIntakeId: intake.id,
        productId: product.id,
        quantityBrought: item.quantityBrought,
        sellerFixedPrice: money(item.sellerFixedPrice),
        targetSellingPrice:
          item.targetSellingPrice !== undefined ? money(item.targetSellingPrice) : null,
        bringingDate: args.bringingDate,
      },
      select: { id: true },
    });

    await prisma.stockMovement.create({
      data: {
        branchId: branch.id,
        productId: product.id,
        movementType: StockMovementType.SELLER_INTAKE,
        ownershipType: StockOwnershipType.SELLER_CONSIGNMENT,
        quantity: item.quantityBrought,
        unitCost: money(item.sellerFixedPrice),
        unitValue:
          item.targetSellingPrice !== undefined ? money(item.targetSellingPrice) : null,
        movementDate: args.bringingDate,
        sourceType: "SellerIntake",
        sourceId: intakeNumber,
        sourceLineId: lineReference(intakeNumber, item.sku),
        counterpartyType: "Seller",
        counterpartyId: seller.id,
      },
    });

    itemsBySku.set(item.sku, {
      kind: "sellerIntake",
      id: intakeItem.id,
      reference: intakeNumber,
      branchId: branch.id,
      sellerId: seller.id,
      sku: item.sku,
      productId: product.id,
      quantityBrought: item.quantityBrought,
      quantityAssigned: 0,
      quantitySold: 0,
      quantityReturned: 0,
      sellerFixedPrice: item.sellerFixedPrice,
    });
  }

  return { intakeId: intake.id, intakeNumber, itemsBySku };
}

async function createSellerAssignment(args: {
  sellerName: string;
  branchCode: string;
  createdByUsername: string;
  assignmentDate: Date;
  items: SellerAssignmentSeedItem[];
  note?: string;
}) {
  const seller = must(sellersByName.get(args.sellerName), `Missing seller ${args.sellerName}.`);
  const branch = must(branchesByCode.get(args.branchCode), `Missing branch ${args.branchCode}.`);
  const createdBy = must(
    usersByUsername.get(args.createdByUsername),
    `Missing user ${args.createdByUsername}.`,
  );

  const assignmentNumber = nextDocumentNumber("SAN", args.assignmentDate);
  const assignment = await prisma.sellerAssignment.create({
    data: {
      assignmentNumber,
      sellerId: seller.id,
      branchId: branch.id,
      createdById: createdBy.id,
      assignmentDate: args.assignmentDate,
      note: args.note ?? null,
    },
    select: { id: true },
  });

  const itemsBySku = new Map<string, SellerAssignmentItemRef>();

  for (const item of args.items) {
    const product = must(productsBySku.get(item.sku), `Missing product ${item.sku}.`);

    const assignmentItem = await prisma.sellerAssignmentItem.create({
      data: {
        sellerAssignmentId: assignment.id,
        productId: product.id,
        quantityAssigned: item.quantityAssigned,
        unitCost: money(item.sourceBatch.unitCost),
        sellingPrice: money(item.sellingPrice),
        assignmentDate: args.assignmentDate,
        ...(item.sourceBatch.kind === "purchase"
          ? { purchaseItemId: item.sourceBatch.id }
          : { transferItemId: item.sourceBatch.id }),
      },
      select: { id: true },
    });

    if (item.sourceBatch.kind === "purchase") {
      await prisma.purchaseItem.update({
        where: { id: item.sourceBatch.id },
        data: {
          quantityTransferred: { increment: item.quantityAssigned },
        },
      });
    } else {
      await prisma.transferItem.update({
        where: { id: item.sourceBatch.id },
        data: {
          quantityTransferred: { increment: item.quantityAssigned },
        },
      });
    }

    item.sourceBatch.quantityTransferred += item.quantityAssigned;

    await prisma.stockMovement.createMany({
      data: [
        {
          branchId: branch.id,
          productId: product.id,
          movementType: StockMovementType.SELLER_ASSIGNMENT,
          ownershipType: StockOwnershipType.OWNED,
          quantity: -item.quantityAssigned,
          unitCost: money(item.sourceBatch.unitCost),
          unitValue: money(item.sellingPrice),
          movementDate: args.assignmentDate,
          sourceType: "SellerAssignment",
          sourceId: assignmentNumber,
          sourceLineId: lineReference(assignmentNumber, item.sku),
          counterpartyType: "Seller",
          counterpartyId: seller.id,
        },
        {
          branchId: branch.id,
          productId: product.id,
          movementType: StockMovementType.SELLER_ASSIGNMENT,
          ownershipType: StockOwnershipType.SELLER_ASSIGNED,
          quantity: item.quantityAssigned,
          unitCost: money(item.sourceBatch.unitCost),
          unitValue: money(item.sellingPrice),
          movementDate: args.assignmentDate,
          sourceType: "SellerAssignment",
          sourceId: assignmentNumber,
          sourceLineId: lineReference(assignmentNumber, item.sku),
          counterpartyType: "Seller",
          counterpartyId: seller.id,
        },
      ],
    });

    itemsBySku.set(item.sku, {
      kind: "sellerAssignment",
      id: assignmentItem.id,
      reference: assignmentNumber,
      branchId: branch.id,
      sellerId: seller.id,
      sku: item.sku,
      productId: product.id,
      quantityAssigned: item.quantityAssigned,
      quantitySold: 0,
      quantityReturned: 0,
      unitCost: item.sourceBatch.unitCost,
      sellingPrice: item.sellingPrice,
      ...(item.sourceBatch.kind === "purchase"
        ? { purchaseItemId: item.sourceBatch.id }
        : { transferItemId: item.sourceBatch.id }),
    });
  }

  return { assignmentId: assignment.id, assignmentNumber, itemsBySku };
}

async function createSale(args: {
  branchCode: string;
  createdByUsername: string;
  soldAt: Date;
  customerName?: string;
  paymentMethod: SalePaymentMethod;
  financeAccountCode?: string;
  items: SaleLineSeed[];
  note?: string;
}) {
  const branch = must(branchesByCode.get(args.branchCode), `Missing branch ${args.branchCode}.`);
  const createdBy = must(
    usersByUsername.get(args.createdByUsername),
    `Missing user ${args.createdByUsername}.`,
  );
  const customer = args.customerName
    ? must(customersByName.get(args.customerName), `Missing customer ${args.customerName}.`)
    : undefined;
  const financeAccount = args.financeAccountCode
    ? must(
        accountsByCode.get(args.financeAccountCode),
        `Missing finance account ${args.financeAccountCode}.`,
      )
    : undefined;

  const saleNumber = nextDocumentNumber("SAL", args.soldAt);
  const subtotal = roundMoney(
    args.items.reduce((sum, item) => {
      const discount = item.discount ?? 0;
      return sum + item.quantity * (item.unitPrice - discount);
    }, 0),
  );
  const isCredit = args.paymentMethod === SalePaymentMethod.CREDIT;

  const sale = await prisma.sale.create({
    data: {
      saleNumber,
      branchId: branch.id,
      customerId: customer?.id ?? null,
      createdById: createdBy.id,
      status: SaleStatus.COMPLETED,
      paymentMethod: args.paymentMethod,
      paymentStatus: isCredit ? PaymentStatus.UNPAID : PaymentStatus.PAID,
      subtotal: money(subtotal),
      discountTotal: money(
        args.items.reduce((sum, item) => sum + item.quantity * (item.discount ?? 0), 0),
      ),
      total: money(subtotal),
      amountPaid: money(isCredit ? 0 : subtotal),
      amountDue: money(isCredit ? subtotal : 0),
      soldAt: args.soldAt,
      note: args.note ?? null,
    },
    select: { id: true },
  });

  const saleRef: SaleRef = {
    id: sale.id,
    saleNumber,
    branchId: branch.id,
    customerId: customer?.id ?? null,
    amountPaid: isCredit ? 0 : subtotal,
    amountDue: isCredit ? subtotal : 0,
  };

  const allocations: SaleAllocationRef[] = [];

  for (const item of args.items) {
    const product = must(productsBySku.get(item.sku), `Missing product ${item.sku}.`);
    const discount = item.discount ?? 0;
    const netUnitPrice = item.unitPrice - discount;
    const lineTotal = roundMoney(item.quantity * netUnitPrice);

    const saleItem = await prisma.saleItem.create({
      data: {
        saleId: sale.id,
        productId: product.id,
        quantity: item.quantity,
        unitPrice: money(item.unitPrice),
        discount: money(discount),
        lineTotal: money(lineTotal),
      },
      select: { id: true },
    });

    const allocationData: Prisma.SaleItemAllocationUncheckedCreateInput = {
      saleItemId: saleItem.id,
      quantity: item.quantity,
      sourceType:
        item.source.kind === "purchase" || item.source.kind === "transfer"
          ? StockOwnershipType.OWNED
          : item.source.kind === "sellerIntake"
            ? StockOwnershipType.SELLER_CONSIGNMENT
            : StockOwnershipType.SELLER_ASSIGNED,
    };

    let stockMovementCost: number | undefined;
    let sellerId: string | undefined;

    if (item.source.kind === "purchase") {
      allocationData.purchaseItemId = item.source.id;
      allocationData.unitCost = money(item.source.unitCost);
      stockMovementCost = item.source.unitCost;
    }

    if (item.source.kind === "transfer") {
      allocationData.transferItemId = item.source.id;
      allocationData.unitCost = money(item.source.unitCost);
      stockMovementCost = item.source.unitCost;
    }

    if (item.source.kind === "sellerIntake") {
      allocationData.sellerIntakeItemId = item.source.id;
      allocationData.sellerAmount = money(item.source.sellerFixedPrice);
      stockMovementCost = item.source.sellerFixedPrice;
      sellerId = item.source.sellerId;

      await prisma.sellerIntakeItem.update({
        where: { id: item.source.id },
        data: {
          quantitySold: { increment: item.quantity },
        },
      });

      item.source.quantitySold += item.quantity;
    }

    if (item.source.kind === "sellerAssignment") {
      allocationData.sellerAssignmentItemId = item.source.id;
      allocationData.sellerAmount = money(item.source.sellingPrice);
      allocationData.unitCost = money(item.source.unitCost);
      stockMovementCost = item.source.unitCost;
      sellerId = item.source.sellerId;

      await prisma.sellerAssignmentItem.update({
        where: { id: item.source.id },
        data: {
          quantitySold: { increment: item.quantity },
        },
      });

      item.source.quantitySold += item.quantity;
    }

    const allocation = await prisma.saleItemAllocation.create({
      data: allocationData,
      select: { id: true },
    });

    await prisma.stockMovement.create({
      data: {
        branchId: branch.id,
        productId: product.id,
        movementType: StockMovementType.SALE,
        ownershipType: allocationData.sourceType,
        quantity: -item.quantity,
        unitCost: stockMovementCost !== undefined ? money(stockMovementCost) : null,
        unitValue: money(netUnitPrice),
        movementDate: args.soldAt,
        sourceType: "Sale",
        sourceId: saleNumber,
        sourceLineId: lineReference(saleNumber, item.sku),
        counterpartyType: customer ? "Customer" : "WalkIn",
        counterpartyId: customer?.id ?? null,
      },
    });

    allocations.push({
      id: allocation.id,
      saleNumber,
      branchId: branch.id,
      sku: item.sku,
      quantity: item.quantity,
      sourceType: allocationData.sourceType,
      sellerId,
      sellerAmount:
        item.source.kind === "sellerIntake"
          ? item.source.sellerFixedPrice
          : item.source.kind === "sellerAssignment"
            ? item.source.sellingPrice
            : undefined,
      unitCost:
        item.source.kind === "purchase" || item.source.kind === "transfer"
          ? item.source.unitCost
          : item.source.kind === "sellerAssignment"
            ? item.source.unitCost
            : undefined,
      sellerAssignmentItemId:
        item.source.kind === "sellerAssignment" ? item.source.id : undefined,
      sellerIntakeItemId: item.source.kind === "sellerIntake" ? item.source.id : undefined,
    });
  }

  if (!isCredit && financeAccount) {
    await prisma.ledgerEntry.create({
      data: {
        entryDate: args.soldAt,
        branchId: branch.id,
        financeAccountId: financeAccount.id,
        direction: LedgerDirection.DEBIT,
        amount: money(subtotal),
        entryType: LedgerEntryType.SALE,
        referenceType: "Sale",
        referenceId: saleNumber,
        description: `Sale receipt for ${saleNumber} (${args.paymentMethod})`,
      },
    });
  }

  return { sale: saleRef, allocations };
}

async function createCustomerPayment(args: {
  sale: SaleRef;
  customerName: string;
  recordedByUsername: string;
  branchCode: string;
  paymentDate: Date;
  financeAccountCode: string;
  amount: number;
  note?: string;
}) {
  const customer = must(
    customersByName.get(args.customerName),
    `Missing customer ${args.customerName}.`,
  );
  const branch = must(branchesByCode.get(args.branchCode), `Missing branch ${args.branchCode}.`);
  const recordedBy = must(
    usersByUsername.get(args.recordedByUsername),
    `Missing user ${args.recordedByUsername}.`,
  );
  const financeAccount = must(
    accountsByCode.get(args.financeAccountCode),
    `Missing finance account ${args.financeAccountCode}.`,
  );

  const nextAmounts = paymentStatusFromAmounts(
    args.sale.amountPaid + args.sale.amountDue,
    args.sale.amountPaid + args.amount,
  );
  const paymentNumber = nextDocumentNumber("CPM", args.paymentDate);

  await prisma.customerPayment.create({
    data: {
      paymentNumber,
      customerId: customer.id,
      saleId: args.sale.id,
      branchId: branch.id,
      financeAccountId: financeAccount.id,
      recordedById: recordedBy.id,
      amount: money(args.amount),
      paymentDate: args.paymentDate,
      note: args.note ?? null,
    },
  });

  await prisma.sale.update({
    where: { id: args.sale.id },
    data: {
      amountPaid: money(nextAmounts.amountPaid),
      amountDue: money(nextAmounts.amountDue),
      paymentStatus: nextAmounts.paymentStatus,
    },
  });

  await prisma.ledgerEntry.create({
    data: {
      entryDate: args.paymentDate,
      branchId: branch.id,
      financeAccountId: financeAccount.id,
      direction: LedgerDirection.DEBIT,
      amount: money(args.amount),
      entryType: LedgerEntryType.CUSTOMER_PAYMENT,
      referenceType: "CustomerPayment",
      referenceId: paymentNumber,
      description: `Customer payment ${paymentNumber} for ${args.sale.saleNumber}`,
    },
  });

  args.sale.amountPaid = nextAmounts.amountPaid;
  args.sale.amountDue = nextAmounts.amountDue;
}

async function createSellerReturn(args: {
  sellerName: string;
  branchCode: string;
  createdByUsername: string;
  returnDate: Date;
  items: Array<
    | { sku: string; quantity: number; source: SellerIntakeItemRef }
    | { sku: string; quantity: number; source: SellerAssignmentItemRef }
  >;
  note?: string;
}) {
  const seller = must(sellersByName.get(args.sellerName), `Missing seller ${args.sellerName}.`);
  const branch = must(branchesByCode.get(args.branchCode), `Missing branch ${args.branchCode}.`);
  const createdBy = must(
    usersByUsername.get(args.createdByUsername),
    `Missing user ${args.createdByUsername}.`,
  );

  const returnNumber = nextDocumentNumber("SRT", args.returnDate);
  const sellerReturn = await prisma.sellerReturn.create({
    data: {
      returnNumber,
      sellerId: seller.id,
      branchId: branch.id,
      createdById: createdBy.id,
      returnDate: args.returnDate,
      note: args.note ?? null,
    },
    select: { id: true },
  });

  for (const item of args.items) {
    const product = must(productsBySku.get(item.sku), `Missing product ${item.sku}.`);

    if (item.source.kind === "sellerIntake") {
      await prisma.sellerReturnItem.create({
        data: {
          sellerReturnId: sellerReturn.id,
          sellerIntakeItemId: item.source.id,
          productId: product.id,
          quantity: item.quantity,
          note: "Returned back to partner",
        },
      });

      await prisma.sellerIntakeItem.update({
        where: { id: item.source.id },
        data: {
          quantityReturned: { increment: item.quantity },
        },
      });

      item.source.quantityReturned += item.quantity;

      await prisma.stockMovement.create({
        data: {
          branchId: branch.id,
          productId: product.id,
          movementType: StockMovementType.SELLER_RETURN,
          ownershipType: StockOwnershipType.SELLER_CONSIGNMENT,
          quantity: -item.quantity,
          unitCost: money(item.source.sellerFixedPrice),
          movementDate: args.returnDate,
          sourceType: "SellerReturn",
          sourceId: returnNumber,
          sourceLineId: lineReference(returnNumber, item.sku),
          counterpartyType: "Seller",
          counterpartyId: seller.id,
        },
      });

      continue;
    }

    await prisma.sellerReturnItem.create({
      data: {
        sellerReturnId: sellerReturn.id,
        sellerAssignmentItemId: item.source.id,
        productId: product.id,
        quantity: item.quantity,
        note: "Returned back into branch stock",
      },
    });

    await prisma.sellerAssignmentItem.update({
      where: { id: item.source.id },
      data: {
        quantityReturned: { increment: item.quantity },
      },
    });

    item.source.quantityReturned += item.quantity;

    if (item.source.purchaseItemId) {
      await prisma.purchaseItem.update({
        where: { id: item.source.purchaseItemId },
        data: {
          quantityTransferred: { decrement: item.quantity },
        },
      });
    } else if (item.source.transferItemId) {
      await prisma.transferItem.update({
        where: { id: item.source.transferItemId },
        data: {
          quantityTransferred: { decrement: item.quantity },
        },
      });
    }

    await prisma.stockMovement.createMany({
      data: [
        {
          branchId: branch.id,
          productId: product.id,
          movementType: StockMovementType.SELLER_RETURN,
          ownershipType: StockOwnershipType.SELLER_ASSIGNED,
          quantity: -item.quantity,
          unitCost: money(item.source.unitCost),
          movementDate: args.returnDate,
          sourceType: "SellerReturn",
          sourceId: returnNumber,
          sourceLineId: lineReference(returnNumber, item.sku),
          counterpartyType: "Seller",
          counterpartyId: seller.id,
        },
        {
          branchId: branch.id,
          productId: product.id,
          movementType: StockMovementType.SELLER_RETURN,
          ownershipType: StockOwnershipType.OWNED,
          quantity: item.quantity,
          unitCost: money(item.source.unitCost),
          movementDate: args.returnDate,
          sourceType: "SellerReturn",
          sourceId: returnNumber,
          sourceLineId: lineReference(returnNumber, item.sku),
          counterpartyType: "Seller",
          counterpartyId: seller.id,
        },
      ],
    });
  }

  return returnNumber;
}

async function createSellerSettlement(args: {
  sellerName: string;
  branchCode: string;
  createdByUsername: string;
  settlementDate: Date;
  financeAccountCode: string;
  allocations: Array<{ allocation: SaleAllocationRef; amount: number }>;
  note?: string;
}) {
  const seller = must(sellersByName.get(args.sellerName), `Missing seller ${args.sellerName}.`);
  const branch = must(branchesByCode.get(args.branchCode), `Missing branch ${args.branchCode}.`);
  const createdBy = must(
    usersByUsername.get(args.createdByUsername),
    `Missing user ${args.createdByUsername}.`,
  );
  const financeAccount = must(
    accountsByCode.get(args.financeAccountCode),
    `Missing finance account ${args.financeAccountCode}.`,
  );

  const amount = roundMoney(args.allocations.reduce((sum, item) => sum + item.amount, 0));
  const settlementNumber = nextDocumentNumber("SST", args.settlementDate);

  const settlement = await prisma.sellerSettlement.create({
    data: {
      settlementNumber,
      sellerId: seller.id,
      branchId: branch.id,
      createdById: createdBy.id,
      financeAccountId: financeAccount.id,
      settlementDate: args.settlementDate,
      paymentMethod: financeAccount.type,
      status: SettlementStatus.POSTED,
      amount: money(amount),
      note: args.note ?? null,
    },
    select: { id: true },
  });

  for (const item of args.allocations) {
    await prisma.sellerSettlementAllocation.create({
      data: {
        sellerSettlementId: settlement.id,
        saleItemAllocationId: item.allocation.id,
        amount: money(item.amount),
      },
    });
  }

  await prisma.ledgerEntry.create({
    data: {
      entryDate: args.settlementDate,
      branchId: branch.id,
      financeAccountId: financeAccount.id,
      direction: LedgerDirection.CREDIT,
      amount: money(amount),
      entryType: LedgerEntryType.SELLER_SETTLEMENT,
      referenceType: "SellerSettlement",
      referenceId: settlementNumber,
      description: `Partner settlement ${settlementNumber} for ${seller.name}`,
    },
  });

  return settlementNumber;
}

async function createSellerCollection(args: {
  sellerName: string;
  branchCode: string;
  createdByUsername: string;
  collectionDate: Date;
  financeAccountCode: string;
  allocations: Array<{ allocation: SaleAllocationRef; amount: number }>;
  note?: string;
}) {
  const seller = must(sellersByName.get(args.sellerName), `Missing seller ${args.sellerName}.`);
  const branch = must(branchesByCode.get(args.branchCode), `Missing branch ${args.branchCode}.`);
  const createdBy = must(
    usersByUsername.get(args.createdByUsername),
    `Missing user ${args.createdByUsername}.`,
  );
  const financeAccount = must(
    accountsByCode.get(args.financeAccountCode),
    `Missing finance account ${args.financeAccountCode}.`,
  );

  const amount = roundMoney(args.allocations.reduce((sum, item) => sum + item.amount, 0));
  const collectionNumber = nextDocumentNumber("SCL", args.collectionDate);

  const collection = await prisma.sellerCollection.create({
    data: {
      collectionNumber,
      sellerId: seller.id,
      branchId: branch.id,
      createdById: createdBy.id,
      financeAccountId: financeAccount.id,
      collectionDate: args.collectionDate,
      paymentMethod: financeAccount.type,
      status: SettlementStatus.POSTED,
      amount: money(amount),
      note: args.note ?? null,
    },
    select: { id: true },
  });

  for (const item of args.allocations) {
    await prisma.sellerCollectionAllocation.create({
      data: {
        sellerCollectionId: collection.id,
        saleItemAllocationId: item.allocation.id,
        amount: money(item.amount),
      },
    });
  }

  await prisma.ledgerEntry.create({
    data: {
      entryDate: args.collectionDate,
      branchId: branch.id,
      financeAccountId: financeAccount.id,
      direction: LedgerDirection.DEBIT,
      amount: money(amount),
      entryType: LedgerEntryType.SELLER_COLLECTION,
      referenceType: "SellerCollection",
      referenceId: collectionNumber,
      description: `Partner collection ${collectionNumber} from ${seller.name}`,
    },
  });

  return collectionNumber;
}

async function createExpense(args: {
  branchCode: string;
  financeAccountCode: string;
  expenseCategoryName: string;
  createdByUsername: string;
  name: string;
  amount: number;
  expenseDate: Date;
  note?: string;
}) {
  const branch = must(branchesByCode.get(args.branchCode), `Missing branch ${args.branchCode}.`);
  const financeAccount = must(
    accountsByCode.get(args.financeAccountCode),
    `Missing finance account ${args.financeAccountCode}.`,
  );
  const createdBy = must(
    usersByUsername.get(args.createdByUsername),
    `Missing user ${args.createdByUsername}.`,
  );
  const expenseCategory = await prisma.expenseCategory.findUnique({
    where: { name: args.expenseCategoryName },
    select: { id: true },
  });
  const resolvedCategory = must(
    expenseCategory,
    `Missing expense category ${args.expenseCategoryName}.`,
  );

  const expenseNumber = nextDocumentNumber("EXP", args.expenseDate);
  const expense = await prisma.expense.create({
    data: {
      expenseNumber,
      branchId: branch.id,
      financeAccountId: financeAccount.id,
      expenseCategoryId: resolvedCategory.id,
      createdById: createdBy.id,
      name: args.name,
      amount: money(args.amount),
      expenseDate: args.expenseDate,
      note: args.note ?? null,
      status: ExpenseStatus.POSTED,
    },
    select: { id: true },
  });

  await prisma.ledgerEntry.create({
    data: {
      entryDate: args.expenseDate,
      branchId: branch.id,
      financeAccountId: financeAccount.id,
      direction: LedgerDirection.CREDIT,
      amount: money(args.amount),
      entryType: LedgerEntryType.EXPENSE,
      referenceType: "Expense",
      referenceId: expenseNumber,
      description: `Expense ${expenseNumber} - ${args.name}`,
    },
  });

  return expense.id;
}

async function createCashTransfer(args: {
  branchCode: string;
  fromAccountCode: string;
  toAccountCode: string;
  transferDate: Date;
  amount: number;
  note?: string;
}) {
  const branch = must(branchesByCode.get(args.branchCode), `Missing branch ${args.branchCode}.`);
  const fromAccount = must(
    accountsByCode.get(args.fromAccountCode),
    `Missing finance account ${args.fromAccountCode}.`,
  );
  const toAccount = must(
    accountsByCode.get(args.toAccountCode),
    `Missing finance account ${args.toAccountCode}.`,
  );

  const transferNumber = nextDocumentNumber("CSH", args.transferDate);
  const description = `Cash deposit ${transferNumber} from ${fromAccount.name} to ${toAccount.name}`;

  await prisma.ledgerEntry.createMany({
    data: [
      {
        entryDate: args.transferDate,
        branchId: branch.id,
        financeAccountId: fromAccount.id,
        direction: LedgerDirection.CREDIT,
        amount: money(args.amount),
        entryType: LedgerEntryType.CASH_TRANSFER,
        referenceType: "CashTransfer",
        referenceId: transferNumber,
        description,
        ...(args.note ? { metadata: { note: args.note } } : {}),
      },
      {
        entryDate: args.transferDate,
        branchId: branch.id,
        financeAccountId: toAccount.id,
        direction: LedgerDirection.DEBIT,
        amount: money(args.amount),
        entryType: LedgerEntryType.CASH_TRANSFER,
        referenceType: "CashTransfer",
        referenceId: transferNumber,
        description,
        ...(args.note ? { metadata: { note: args.note } } : {}),
      },
    ],
  });

  return transferNumber;
}

async function createInventoryArtifacts(args: {
  branches: BranchRef[];
  products: ProductRef[];
  snapshotDate: Date;
  resolvedAlertCreatedAt: Date;
  resolvedAlertAt: Date;
}) {
  const movements = await prisma.stockMovement.findMany({
    select: {
      branchId: true,
      productId: true,
      ownershipType: true,
      quantity: true,
      unitCost: true,
    },
  });

  const quantityByOwnership = new Map<
    string,
    {
      branchId: string;
      productId: string;
      ownershipType: StockOwnershipType;
      quantity: number;
      stockValue: number;
    }
  >();
  const totalByProduct = new Map<string, number>();

  for (const movement of movements) {
    const ownershipKey = `${movement.branchId}:${movement.productId}:${movement.ownershipType}`;
    const ownershipEntry = quantityByOwnership.get(ownershipKey) ?? {
      branchId: movement.branchId,
      productId: movement.productId,
      ownershipType: movement.ownershipType,
      quantity: 0,
      stockValue: 0,
    };

    ownershipEntry.quantity += movement.quantity;
    ownershipEntry.stockValue = roundMoney(
      ownershipEntry.stockValue + movement.quantity * Number(movement.unitCost ?? 0),
    );
    quantityByOwnership.set(ownershipKey, ownershipEntry);

    const totalKey = `${movement.branchId}:${movement.productId}`;
    totalByProduct.set(totalKey, (totalByProduct.get(totalKey) ?? 0) + movement.quantity);
  }

  const snapshotRows = [...quantityByOwnership.values()]
    .filter((entry) => entry.quantity !== 0)
    .map((entry) => ({
      branchId: entry.branchId,
      productId: entry.productId,
      ownershipType: entry.ownershipType,
      quantity: entry.quantity,
      averageCost: entry.quantity !== 0 ? money(entry.stockValue / entry.quantity) : null,
      stockValue: money(entry.stockValue),
      snapshotDate: args.snapshotDate,
      sourceKey: "SEED-CURRENT",
    }));

  if (snapshotRows.length > 0) {
    await prisma.stockBalanceSnapshot.createMany({ data: snapshotRows });
  }

  const alertRows = args.branches.flatMap((branch) =>
    args.products.flatMap((product) => {
      const totalQuantity = totalByProduct.get(`${branch.id}:${product.id}`) ?? 0;

      if (product.minimumStockAlert <= 0 || totalQuantity > product.minimumStockAlert) {
        return [];
      }

      return [
        {
          branchId: branch.id,
          productId: product.id,
          alertType: "LOW_STOCK",
          threshold: product.minimumStockAlert,
          quantityAtAlert: totalQuantity,
          createdAt: args.snapshotDate,
        },
      ];
    }),
  );

  if (alertRows.length > 0) {
    await prisma.alertRecord.createMany({ data: alertRows });
  }

  const metebabe = must(
    branchesByCode.get(EXISTING_BRANCH_CODE),
    `Missing ${EXISTING_BRANCH_CODE} branch.`,
  );
  const a15Screen = must(productsBySku.get("SCR-SAM-A15-4G"), "Missing A15 screen.");

  await prisma.alertRecord.create({
    data: {
      branchId: metebabe.id,
      productId: a15Screen.id,
      alertType: "LOW_STOCK",
      threshold: a15Screen.minimumStockAlert,
      quantityAtAlert: 4,
      isResolved: true,
      resolvedAt: args.resolvedAlertAt,
      createdAt: args.resolvedAlertCreatedAt,
    },
  });
}

async function createAuditEntry(args: {
  actorUsername: string;
  action: string;
  entityType: string;
  entityId: string;
  branchCode?: string;
  createdAt: Date;
  after?: Prisma.InputJsonValue;
}) {
  const actor = must(
    usersByUsername.get(args.actorUsername),
    `Missing user ${args.actorUsername}.`,
  );
  const branchId = args.branchCode
    ? must(branchesByCode.get(args.branchCode), `Missing branch ${args.branchCode}.`).id
    : undefined;

  await prisma.auditLog.create({
    data: {
      actorUserId: actor.id,
      action: args.action,
      entityType: args.entityType,
      entityId: args.entityId,
      branchId: branchId ?? null,
      after: args.after ?? Prisma.JsonNull,
      createdAt: args.createdAt,
    },
  });
}

async function main() {
  await clearDatabase();

  if (CLEAR_ONLY) {
    console.log("Business data cleared; users and credentials were preserved.");
    return;
  }

  await ensureRequiredUsers();
  branchesByCode.clear();
  usersByUsername.clear();
  accountsByCode.clear();
  productsBySku.clear();
  suppliersByName.clear();
  customersByName.clear();
  sellersByName.clear();

  await loadExistingCoreRecords();

  const branchCode = EXISTING_BRANCH_CODE;
  const adminUsername = "admin";
  const salesUsername = "sales";
  const cashAccountCode = "METEBABE-CASH";
  const cbeAccountCode = "METEBABE-CBE";
  const awashAccountCode = "METEBABE-AWASH";
  const base = new Date();
  base.setHours(9, 0, 0, 0);

  const openingBalanceDate = buildDate(base, -30, 9, 0);
  const purchase1Date = buildDate(base, -12, 10, 15);
  const purchase2Date = buildDate(base, -9, 11, 0);
  const purchase3Date = buildDate(base, -7, 12, 10);
  const sale1Date = buildDate(base, -6, 15, 30);
  const purchase4Date = buildDate(base, -5, 10, 0);
  const sale2Date = buildDate(base, -5, 17, 20);
  const purchase5Date = buildDate(base, -4, 10, 30);
  const intakeBirukDate = buildDate(base, -4, 11, 45);
  const sale3Date = buildDate(base, -4, 16, 10);
  const purchase6Date = buildDate(base, -3, 11, 40);
  const assignmentMekdesDate = buildDate(base, -3, 13, 10);
  const sale4Date = buildDate(base, -3, 18, 0);
  const assignmentBirukDate = buildDate(base, -2, 9, 30);
  const sale5Date = buildDate(base, -2, 14, 20);
  const expenseRentDate = buildDate(base, -4, 18, 0);
  const expenseMaintenanceDate = buildDate(base, -2, 17, 0);
  const cashTransferBoleDate = buildDate(base, -2, 18, 30);
  const sale6Date = buildDate(base, -1, 13, 15);
  const customerPaymentHanaDate = buildDate(base, -1, 15, 0);
  const supplierPaymentP1Date = buildDate(base, -1, 16, 0);
  const returnMekdesDate = buildDate(base, -1, 17, 30);
  const settlementBirukDate = buildDate(base, -1, 18, 15);
  const intakeRahelDate = buildDate(base, 0, 9, 15);
  const assignmentNahomDate = buildDate(base, 0, 9, 40);
  const sale8Date = buildDate(base, 0, 11, 20);
  const sale9Date = buildDate(base, 0, 12, 10);
  const sale10Date = buildDate(base, 0, 14, 0);
  const customerPaymentEyerusalemDate = buildDate(base, 0, 14, 30);
  const supplierPaymentP2Date = buildDate(base, 0, 15, 0);
  const supplierPaymentP4Date = buildDate(base, 0, 15, 10);
  const collectionMekdesDate = buildDate(base, 0, 15, 30);
  const settlementRahelDate = buildDate(base, 0, 16, 10);
  const returnBirukDate = buildDate(base, 0, 16, 45);
  const expenseDeliveryDate = buildDate(base, 0, 17, 15);
  const expenseUtilitiesDate = buildDate(base, 0, 17, 20);
  const cashTransferAwashDate = buildDate(base, 0, 17, 40);
  const inventorySnapshotDate = buildDate(base, 0, 18, 45);
  const resolvedAlertCreatedAt = buildDate(base, -6, 9, 30);
  const resolvedAlertAt = buildDate(base, -2, 18, 5);

  const categoryNames = [
    "Replacement Screen",
    "Cover",
    "Tempered Glass",
    "Privacy Glass",
    "Charger",
    "Cable",
    "Earbuds",
  ];

  for (const name of categoryNames) {
    await prisma.category.create({ data: { name, isActive: true } });
  }

  for (const name of ["Samsung", "Apple", "OnePlus", "Infinix", "Oraimo", "Generic"]) {
    await prisma.brand.create({ data: { name, isActive: true } });
  }

  const categories = await prisma.category.findMany({ select: { id: true, name: true } });
  const brands = await prisma.brand.findMany({ select: { id: true, name: true } });
  const categoryIds = new Map(categories.map((item) => [item.name, item.id]));
  const brandIds = new Map(brands.map((item) => [item.name, item.id]));

  const productSeeds: ProductSeed[] = [
    { sku: "SCR-SAM-A15-4G", name: "Samsung Galaxy A15 4G Service Pack Screen", category: "Replacement Screen", brand: "Samsung", model: "Galaxy A15 4G", variant: "A155 Service Pack", description: "Factory-grade replacement screen for Samsung Galaxy A15 4G.", minimumStockAlert: 4, compatibilityNote: "Fits A155F and A155M models.", warrantyDays: 30 },
    { sku: "SCR-SAM-A24-AMOLED", name: "Samsung Galaxy A24 AMOLED Screen", category: "Replacement Screen", brand: "Samsung", model: "Galaxy A24", variant: "AMOLED", description: "Bright AMOLED assembly for Samsung Galaxy A24 repairs.", minimumStockAlert: 6, compatibilityNote: "Fits A245F and A245M models.", warrantyDays: 30 },
    { sku: "SCR-IPH-11-INCELL", name: "iPhone 11 Incell Screen", category: "Replacement Screen", brand: "Apple", model: "iPhone 11", variant: "Incell", description: "Quality incell panel for iPhone 11 replacement jobs.", minimumStockAlert: 3, warrantyDays: 30 },
    { sku: "SCR-IPH-14P-OLED", name: "iPhone 14 Pro OLED Screen", category: "Replacement Screen", brand: "Apple", model: "iPhone 14 Pro", variant: "OLED", description: "Premium OLED display assembly for iPhone 14 Pro.", minimumStockAlert: 2, warrantyDays: 30 },
    { sku: "SCR-1P-NORDCE3L", name: "OnePlus Nord CE 3 Lite Screen", category: "Replacement Screen", brand: "OnePlus", model: "Nord CE 3 Lite", description: "Replacement screen assembly for OnePlus Nord CE 3 Lite.", minimumStockAlert: 3, warrantyDays: 30 },
    { sku: "SCR-INF-HOT30", name: "Infinix Hot 30 Screen", category: "Replacement Screen", brand: "Infinix", model: "Hot 30", description: "Replacement LCD set for Infinix Hot 30 repairs.", minimumStockAlert: 4, warrantyDays: 30 },
    { sku: "COV-SAM-A15-MATTE", name: "Samsung Galaxy A15 Matte Cover", category: "Cover", brand: "Samsung", model: "Galaxy A15", color: "Black", description: "Matte protective cover for Samsung Galaxy A15.", minimumStockAlert: 8 },
    { sku: "COV-IPH-13-SIL", name: "iPhone 13 Silicone Cover", category: "Cover", brand: "Apple", model: "iPhone 13", color: "Midnight", description: "Soft-touch silicone case for iPhone 13.", minimumStockAlert: 5 },
    { sku: "COV-1P-NORDCE3L", name: "OnePlus Nord CE 3 Lite Frost Cover", category: "Cover", brand: "OnePlus", model: "Nord CE 3 Lite", color: "Clear", description: "Slim frost back cover for OnePlus Nord CE 3 Lite.", minimumStockAlert: 4 },
    { sku: "COV-INF-SMART8", name: "Infinix Smart 8 Shockproof Cover", category: "Cover", brand: "Infinix", model: "Smart 8", color: "Blue", description: "Shockproof back cover for Infinix Smart 8.", minimumStockAlert: 6 },
    { sku: "PGL-SAM-A34", name: "Samsung Galaxy A34 Privacy Glass", category: "Privacy Glass", brand: "Samsung", model: "Galaxy A34", description: "Full-screen privacy glass for Samsung Galaxy A34.", minimumStockAlert: 8 },
    { sku: "PGL-IPH-13", name: "iPhone 13 Privacy Glass", category: "Privacy Glass", brand: "Apple", model: "iPhone 13", description: "Edge-to-edge privacy glass for iPhone 13.", minimumStockAlert: 10 },
    { sku: "TGL-1P-11-5D", name: "OnePlus 11 5D Glass", category: "Tempered Glass", brand: "OnePlus", model: "OnePlus 11", description: "5D full glue tempered glass for OnePlus 11.", minimumStockAlert: 4 },
    { sku: "TGL-INF-NOTE30", name: "Infinix Note 30 Tempered Glass", category: "Tempered Glass", brand: "Infinix", model: "Note 30", description: "Standard tempered glass for Infinix Note 30.", minimumStockAlert: 6 },
    { sku: "CHG-SAM-25W", name: "Samsung 25W USB-C Fast Charger", category: "Charger", brand: "Samsung", model: "25W Adapter", connectorType: "USB-C", description: "Samsung 25W super fast charging adapter.", minimumStockAlert: 7, warrantyDays: 60 },
    { sku: "CHG-APL-20W", name: "Apple 20W USB-C Power Adapter", category: "Charger", brand: "Apple", model: "20W Adapter", connectorType: "USB-C", description: "Apple-style 20W USB-C charging adapter.", minimumStockAlert: 5, warrantyDays: 60 },
    { sku: "CBL-USBC-1M", name: "USB-C Fast Charging Cable 1m", category: "Cable", brand: "Generic", model: "USB-C Cable", connectorType: "USB-A to USB-C", color: "White", description: "Fast charging USB-C cable for Android devices.", minimumStockAlert: 10, warrantyDays: 30 },
    { sku: "CBL-LTG-1M", name: "Lightning Charging Cable 1m", category: "Cable", brand: "Apple", model: "Lightning Cable", connectorType: "USB-A to Lightning", color: "White", description: "Lightning charging cable for iPhone and iPad.", minimumStockAlert: 8, warrantyDays: 30 },
    { sku: "CBL-USBC-USBC-60W", name: "USB-C to USB-C 60W Cable", category: "Cable", brand: "Generic", model: "USB-C to USB-C", connectorType: "USB-C to USB-C", color: "Black", description: "60W cable for fast-charging newer USB-C devices.", minimumStockAlert: 6, warrantyDays: 30 },
    { sku: "EAR-ORA-NEO", name: "Oraimo Airbuds Neo", category: "Earbuds", brand: "Oraimo", model: "Airbuds Neo", color: "White", description: "Wireless earbuds with charging case.", minimumStockAlert: 4, warrantyDays: 90 },
  ];

  for (const productSeed of productSeeds) {
    const product = await prisma.product.create({
      data: {
        name: productSeed.name,
        sku: productSeed.sku,
        categoryId: must(categoryIds.get(productSeed.category), `Missing category ${productSeed.category}.`),
        brandId: must(brandIds.get(productSeed.brand), `Missing brand ${productSeed.brand}.`),
        model: productSeed.model,
        variant: productSeed.variant ?? null,
        description: productSeed.description ?? null,
        minimumStockAlert: productSeed.minimumStockAlert,
        unit: "pcs",
        compatibilityNote: productSeed.compatibilityNote ?? null,
        connectorType: productSeed.connectorType ?? null,
        color: productSeed.color ?? null,
        warrantyDays: productSeed.warrantyDays ?? null,
        isActive: true,
      },
      select: { id: true, sku: true, name: true, minimumStockAlert: true },
    });

    productsBySku.set(product.sku, product);
  }

  const supplierSeeds = [
    { name: "Abebe Mobile Accessories", phone: "+251911210001", email: "abebe@abebemobile.et", address: "Addis Ababa, Merkato", note: "Strong on Samsung stock and daily fast movers." },
    { name: "Lulit Telecom Supply", phone: "+251911210002", email: "lulit@lulittelecom.et", address: "Addis Ababa, Megenagna", note: "Premium iPhone parts and chargers." },
    { name: "Hidar Digital Imports", phone: "+251911210003", email: "hidar@hidardigital.et", address: "Addis Ababa, Bole Medhanealem", note: "Cables, glass, and Infinix accessories." },
    { name: "Selam Parts Center", phone: "+251911210004", email: "selam@selamparts.et", address: "Addis Ababa, Mexico", note: "Privacy glass, lightning cables, and earbuds." },
    { name: "Megenagna Device Hub", phone: "+251911210005", email: "megenagna@devicehub.et", address: "Addis Ababa, Megenagna", note: "OnePlus screens and harder-to-find models." },
  ];

  for (const supplierSeed of supplierSeeds) {
    const supplier = await prisma.supplier.create({
      data: {
        name: supplierSeed.name,
        phone: supplierSeed.phone,
        email: supplierSeed.email,
        address: supplierSeed.address,
        note: supplierSeed.note,
        isActive: true,
      },
      select: { id: true, name: true },
    });

    suppliersByName.set(supplier.name, supplier);
  }

  const customerSeeds = [
    { name: "Hana Bekele", phone: "+251911310001", address: "Addis Ababa, Bole", note: "Repeat customer for Apple screens." },
    { name: "Robel Getachew", phone: "+251911310002", address: "Addis Ababa, Sarbet", note: "Prefers bank transfers." },
    { name: "Mimi Tadesse", phone: "+251911310003", address: "Addis Ababa, Kazanchis", note: "Frequent cover and cable buyer." },
    { name: "Abel Mamo", phone: "+251911310004", address: "Addis Ababa, Ayat", note: "Buys chargers in small batches." },
    { name: "Samrawit Fikru", phone: "+251911310005", address: "Addis Ababa, Summit", note: "OnePlus and Infinix repair customer." },
    { name: "Lensa Diriba", phone: "+251911310006", address: "Addis Ababa, Piassa", note: "Piassa branch customer." },
    { name: "Eyerusalem Kebede", phone: "+251911310007", address: "Addis Ababa, Arat Kilo", note: "Uses branch credit for repair orders." },
    { name: "Yonatan Girma", phone: "+251911310008", address: "Addis Ababa, Gerji", note: "Walks in for premium accessories." },
  ];

  for (const customerSeed of customerSeeds) {
    const customer = await prisma.customer.create({
      data: {
        name: customerSeed.name,
        phone: customerSeed.phone,
        address: customerSeed.address,
        note: customerSeed.note,
        isActive: true,
      },
      select: { id: true, name: true },
    });

    customersByName.set(customer.name, customer);
  }

  const sellerSeeds = [
    { name: "Biruk Alemayehu", phone: "+251911410001", address: "Addis Ababa, Merkato", note: "Brings privacy glass and small cover batches on consignment." },
    { name: "Mekdes Tesfaye", phone: "+251911410002", address: "Addis Ababa, Piassa", note: "Takes branch-owned accessories and remits weekly." },
    { name: "Nahom Bekele", phone: "+251911410003", address: "Addis Ababa, Piazza Taxi Tera", note: "Handles branch-issued fast-moving cables." },
    { name: "Rahel Kebede", phone: "+251911410004", address: "Addis Ababa, Bole", note: "Consignment partner for earbuds and Apple chargers." },
  ];

  for (const sellerSeed of sellerSeeds) {
    const seller = await prisma.seller.create({
      data: {
        fullName: sellerSeed.name,
        phone: sellerSeed.phone,
        address: sellerSeed.address,
        note: sellerSeed.note,
        isActive: true,
      },
      select: { id: true, fullName: true },
    });

    sellersByName.set(seller.fullName, { id: seller.id, name: seller.fullName });
  }

  const financeAccountSeeds = [
    {
      code: cashAccountCode,
      name: `${EXISTING_BRANCH_NAME} Cash Drawer`,
      type: AccountType.CASH,
      branchCode,
    },
    {
      code: cbeAccountCode,
      name: `${EXISTING_BRANCH_NAME} CBE Collection`,
      type: AccountType.BANK,
      bankName: "Commercial Bank of Ethiopia",
      accountNumber: "1000198765432",
      branchCode,
    },
    {
      code: awashAccountCode,
      name: `${EXISTING_BRANCH_NAME} Awash Collection`,
      type: AccountType.BANK,
      bankName: "Awash Bank",
      accountNumber: "0112300456677",
      branchCode,
    },
  ];

  for (const accountSeed of financeAccountSeeds) {
    const branch = must(
      branchesByCode.get(accountSeed.branchCode),
      `Missing branch ${accountSeed.branchCode}.`,
    );
    const account = await prisma.financeAccount.create({
      data: {
        branchId: branch.id,
        code: accountSeed.code,
        name: accountSeed.name,
        type: accountSeed.type,
        bankName: "bankName" in accountSeed ? accountSeed.bankName : null,
        accountNumber: "accountNumber" in accountSeed ? accountSeed.accountNumber : null,
        isActive: true,
      },
      select: { id: true, code: true, name: true, type: true, branchId: true },
    });

    accountsByCode.set(account.code, account);
  }

  await createOpeningBalance({ accountCode: cashAccountCode, amount: 150000, entryDate: openingBalanceDate });
  await createOpeningBalance({ accountCode: cbeAccountCode, amount: 220000, entryDate: openingBalanceDate });
  await createOpeningBalance({ accountCode: awashAccountCode, amount: 90000, entryDate: openingBalanceDate });

  for (const name of ["Rent", "Utilities", "Delivery", "Store Maintenance", "Staff Welfare"]) {
    await prisma.expenseCategory.create({ data: { name, isActive: true } });
  }

  const purchase1 = await createPurchase({
    branchCode,
    supplierName: "Abebe Mobile Accessories",
    createdByUsername: adminUsername,
    purchasedAt: purchase1Date,
    invoiceNumber: "INV-ABE-1101",
    initialPaid: 30000,
    paymentAccountCode: cbeAccountCode,
    note: "Samsung screens, covers, and chargers for Metebaber branch.",
    items: [
      { sku: "SCR-SAM-A15-4G", quantity: 8, unitCost: 2600, sellingPrice: 3300 },
      { sku: "SCR-SAM-A24-AMOLED", quantity: 6, unitCost: 3200, sellingPrice: 4100 },
      { sku: "COV-SAM-A15-MATTE", quantity: 20, unitCost: 140, sellingPrice: 290 },
      { sku: "CHG-SAM-25W", quantity: 18, unitCost: 380, sellingPrice: 650 },
    ],
  });

  const purchase2 = await createPurchase({
    branchCode,
    supplierName: "Lulit Telecom Supply",
    createdByUsername: adminUsername,
    purchasedAt: purchase2Date,
    invoiceNumber: "INV-LUL-2205",
    initialPaid: 0,
    note: "Higher-value Apple parts ordered on credit.",
    items: [
      { sku: "SCR-IPH-11-INCELL", quantity: 5, unitCost: 4200, sellingPrice: 5900 },
      { sku: "SCR-IPH-14P-OLED", quantity: 2, unitCost: 9200, sellingPrice: 12300 },
      { sku: "COV-IPH-13-SIL", quantity: 15, unitCost: 220, sellingPrice: 450 },
      { sku: "CHG-APL-20W", quantity: 10, unitCost: 760, sellingPrice: 1350 },
    ],
  });

  const purchase3 = await createPurchase({
    branchCode,
    supplierName: "Hidar Digital Imports",
    createdByUsername: adminUsername,
    purchasedAt: purchase3Date,
    invoiceNumber: "INV-HID-3307",
    initialPaid: 20070,
    paymentAccountCode: cbeAccountCode,
    note: "Infinix accessories and cables.",
    items: [
      { sku: "SCR-INF-HOT30", quantity: 6, unitCost: 2100, sellingPrice: 3100 },
      { sku: "COV-INF-SMART8", quantity: 25, unitCost: 120, sellingPrice: 240 },
      { sku: "TGL-INF-NOTE30", quantity: 18, unitCost: 90, sellingPrice: 200 },
      { sku: "CBL-USBC-1M", quantity: 30, unitCost: 95, sellingPrice: 180 },
    ],
  });

  const purchase4 = await createPurchase({
    branchCode,
    supplierName: "Selam Parts Center",
    createdByUsername: adminUsername,
    purchasedAt: purchase4Date,
    invoiceNumber: "INV-SEL-4419",
    initialPaid: 10000,
    paymentAccountCode: cashAccountCode,
    note: "Privacy glass, lightning cables, and earbuds.",
    items: [
      { sku: "PGL-IPH-13", quantity: 30, unitCost: 130, sellingPrice: 320 },
      { sku: "PGL-SAM-A34", quantity: 10, unitCost: 120, sellingPrice: 300 },
      { sku: "CBL-LTG-1M", quantity: 25, unitCost: 110, sellingPrice: 220 },
      { sku: "EAR-ORA-NEO", quantity: 12, unitCost: 900, sellingPrice: 1500 },
    ],
  });

  const purchase5 = await createPurchase({
    branchCode,
    supplierName: "Megenagna Device Hub",
    createdByUsername: adminUsername,
    purchasedAt: purchase5Date,
    invoiceNumber: "INV-MEG-5504",
    initialPaid: 16780,
    paymentAccountCode: cbeAccountCode,
    note: "OnePlus models and USB-C to USB-C cables.",
    items: [
      { sku: "SCR-1P-NORDCE3L", quantity: 4, unitCost: 2800, sellingPrice: 3900 },
      { sku: "COV-1P-NORDCE3L", quantity: 12, unitCost: 180, sellingPrice: 320 },
      { sku: "TGL-1P-11-5D", quantity: 8, unitCost: 140, sellingPrice: 280 },
      { sku: "CBL-USBC-USBC-60W", quantity: 20, unitCost: 115, sellingPrice: 240 },
    ],
  });

  const intakeBiruk = await createSellerIntake({
    sellerName: "Biruk Alemayehu",
    branchCode,
    createdByUsername: salesUsername,
    bringingDate: intakeBirukDate,
    note: "Received mixed privacy glass and covers from Biruk.",
    items: [
      { sku: "PGL-IPH-13", quantityBrought: 20, sellerFixedPrice: 210, targetSellingPrice: 320 },
      { sku: "COV-SAM-A15-MATTE", quantityBrought: 12, sellerFixedPrice: 160, targetSellingPrice: 290 },
    ],
  });

  const sale1 = await createSale({
    branchCode,
    createdByUsername: salesUsername,
    soldAt: sale1Date,
    paymentMethod: SalePaymentMethod.CASH,
    financeAccountCode: cashAccountCode,
    note: "Walk-in repair sale.",
    items: [
      { sku: "SCR-SAM-A15-4G", quantity: 1, unitPrice: 3300, source: must(purchase1.itemsBySku.get("SCR-SAM-A15-4G"), "Missing A15 screen batch.") },
      { sku: "CHG-SAM-25W", quantity: 2, unitPrice: 650, source: must(purchase1.itemsBySku.get("CHG-SAM-25W"), "Missing Samsung charger batch.") },
    ],
  });

  const purchase6 = await createPurchase({
    branchCode,
    supplierName: "Abebe Mobile Accessories",
    createdByUsername: adminUsername,
    purchasedAt: purchase6Date,
    invoiceNumber: "INV-ABE-6602",
    initialPaid: 4000,
    paymentAccountCode: awashAccountCode,
    note: "Late-week replenishment for fast-moving accessories in Metebaber.",
    items: [
      { sku: "COV-SAM-A15-MATTE", quantity: 10, unitCost: 150, sellingPrice: 290 },
      { sku: "CHG-APL-20W", quantity: 4, unitCost: 770, sellingPrice: 1350 },
      { sku: "CBL-USBC-1M", quantity: 20, unitCost: 100, sellingPrice: 180 },
    ],
  });

  const sale2 = await createSale({
    branchCode,
    createdByUsername: salesUsername,
    soldAt: sale2Date,
    customerName: "Hana Bekele",
    paymentMethod: SalePaymentMethod.CREDIT,
    note: "Credit sale for recurring Apple repair customer.",
    items: [
      { sku: "SCR-IPH-11-INCELL", quantity: 1, unitPrice: 5900, source: must(purchase2.itemsBySku.get("SCR-IPH-11-INCELL"), "Missing iPhone 11 screen batch.") },
      { sku: "COV-IPH-13-SIL", quantity: 2, unitPrice: 450, source: must(purchase2.itemsBySku.get("COV-IPH-13-SIL"), "Missing iPhone 13 cover batch.") },
    ],
  });

  const assignmentMekdes = await createSellerAssignment({
    sellerName: "Mekdes Tesfaye",
    branchCode,
    createdByUsername: salesUsername,
    assignmentDate: assignmentMekdesDate,
    note: "Issued covers and cables to Mekdes for street-side resale.",
    items: [
      { sku: "COV-SAM-A15-MATTE", quantityAssigned: 10, sellingPrice: 220, sourceBatch: must(purchase1.itemsBySku.get("COV-SAM-A15-MATTE"), "Missing A15 cover batch.") },
      { sku: "CBL-LTG-1M", quantityAssigned: 8, sellingPrice: 170, sourceBatch: must(purchase4.itemsBySku.get("CBL-LTG-1M"), "Missing lightning cable batch.") },
    ],
  });

  const sale4 = await createSale({
    branchCode,
    createdByUsername: salesUsername,
    soldAt: sale4Date,
    customerName: "Mimi Tadesse",
    paymentMethod: SalePaymentMethod.CASH,
    financeAccountCode: cashAccountCode,
    note: "Partner-assigned accessories sold in cash.",
    items: [
      { sku: "COV-SAM-A15-MATTE", quantity: 4, unitPrice: 280, source: must(assignmentMekdes.itemsBySku.get("COV-SAM-A15-MATTE"), "Missing Mekdes A15 cover assignment.") },
      { sku: "CBL-LTG-1M", quantity: 3, unitPrice: 220, source: must(assignmentMekdes.itemsBySku.get("CBL-LTG-1M"), "Missing Mekdes lightning cable assignment.") },
    ],
  });

  const sale3 = await createSale({
    branchCode,
    createdByUsername: salesUsername,
    soldAt: sale3Date,
    customerName: "Robel Getachew",
    paymentMethod: SalePaymentMethod.BANK,
    financeAccountCode: cbeAccountCode,
    note: "Consignment items sold and settled through bank transfer.",
    items: [
      { sku: "PGL-IPH-13", quantity: 5, unitPrice: 320, source: must(intakeBiruk.itemsBySku.get("PGL-IPH-13"), "Missing Biruk privacy glass intake.") },
      { sku: "COV-SAM-A15-MATTE", quantity: 2, unitPrice: 290, source: must(intakeBiruk.itemsBySku.get("COV-SAM-A15-MATTE"), "Missing Biruk cover intake.") },
    ],
  });

  const assignmentBiruk = await createSellerAssignment({
    sellerName: "Biruk Alemayehu",
    branchCode,
    createdByUsername: salesUsername,
    assignmentDate: assignmentBirukDate,
    note: "Issued Samsung fast chargers to Biruk for resale.",
    items: [
      { sku: "CHG-SAM-25W", quantityAssigned: 6, sellingPrice: 520, sourceBatch: must(purchase1.itemsBySku.get("CHG-SAM-25W"), "Missing Samsung charger batch.") },
    ],
  });

  const sale5 = await createSale({
    branchCode,
    createdByUsername: salesUsername,
    soldAt: sale5Date,
    customerName: "Abel Mamo",
    paymentMethod: SalePaymentMethod.BANK,
    financeAccountCode: cbeAccountCode,
    note: "Mixed sale with one premium screen and partner-issued charger.",
    items: [
      { sku: "CHG-SAM-25W", quantity: 3, unitPrice: 650, source: must(assignmentBiruk.itemsBySku.get("CHG-SAM-25W"), "Missing Biruk charger assignment.") },
      { sku: "SCR-IPH-14P-OLED", quantity: 1, unitPrice: 12300, source: must(purchase2.itemsBySku.get("SCR-IPH-14P-OLED"), "Missing iPhone 14 Pro screen batch.") },
    ],
  });

  const sale7 = await createSale({
    branchCode,
    createdByUsername: salesUsername,
    soldAt: buildDate(base, -2, 16, 0),
    customerName: "Lensa Diriba",
    paymentMethod: SalePaymentMethod.CASH,
    financeAccountCode: awashAccountCode,
    note: "Walk-in accessory sale recorded through Awash collection.",
    items: [
      { sku: "COV-SAM-A15-MATTE", quantity: 2, unitPrice: 290, source: must(purchase6.itemsBySku.get("COV-SAM-A15-MATTE"), "Missing restocked A15 cover batch.") },
      { sku: "CBL-USBC-1M", quantity: 4, unitPrice: 180, source: must(purchase6.itemsBySku.get("CBL-USBC-1M"), "Missing restocked cable batch.") },
      { sku: "CHG-APL-20W", quantity: 1, unitPrice: 1350, source: must(purchase6.itemsBySku.get("CHG-APL-20W"), "Missing restocked Apple charger batch.") },
    ],
  });

  await createExpense({
    branchCode,
    financeAccountCode: cbeAccountCode,
    expenseCategoryName: "Rent",
    createdByUsername: adminUsername,
    name: "Metebaber shop rent",
    amount: 18000,
    expenseDate: expenseRentDate,
    note: "Monthly rent for the Metebaber branch.",
  });

  await createCashTransfer({
    branchCode,
    fromAccountCode: cbeAccountCode,
    toAccountCode: cashAccountCode,
    transferDate: cashTransferBoleDate,
    amount: 25000,
    note: "Moved bank funds into the cash drawer for same-day operations.",
  });

  const sale6 = await createSale({
    branchCode,
    createdByUsername: salesUsername,
    soldAt: sale6Date,
    customerName: "Samrawit Fikru",
    paymentMethod: SalePaymentMethod.BANK,
    financeAccountCode: cbeAccountCode,
    note: "OnePlus and Infinix repair bundle.",
    items: [
      { sku: "SCR-1P-NORDCE3L", quantity: 1, unitPrice: 3900, source: must(purchase5.itemsBySku.get("SCR-1P-NORDCE3L"), "Missing OnePlus screen batch.") },
      { sku: "TGL-1P-11-5D", quantity: 4, unitPrice: 280, source: must(purchase5.itemsBySku.get("TGL-1P-11-5D"), "Missing OnePlus glass batch.") },
      { sku: "SCR-INF-HOT30", quantity: 1, unitPrice: 3100, source: must(purchase3.itemsBySku.get("SCR-INF-HOT30"), "Missing Infinix Hot 30 batch.") },
      { sku: "TGL-INF-NOTE30", quantity: 3, unitPrice: 200, source: must(purchase3.itemsBySku.get("TGL-INF-NOTE30"), "Missing Infinix Note 30 glass batch.") },
    ],
  });

  await createCustomerPayment({
    sale: sale2.sale,
    customerName: "Hana Bekele",
    recordedByUsername: salesUsername,
    branchCode,
    paymentDate: customerPaymentHanaDate,
    financeAccountCode: cashAccountCode,
    amount: 3000,
    note: "Partial credit settlement.",
  });

  await createSupplierPayment({
    purchase: purchase1.purchase,
    supplierName: "Abebe Mobile Accessories",
    branchCode,
    recordedByUsername: adminUsername,
    paymentDate: supplierPaymentP1Date,
    financeAccountCode: cashAccountCode,
    amount: 10000,
    note: "Follow-up payment on Samsung stock invoice.",
  });

  await createExpense({
    branchCode,
    financeAccountCode: cashAccountCode,
    expenseCategoryName: "Store Maintenance",
    createdByUsername: adminUsername,
    name: "Display cabinet repair",
    amount: 3200,
    expenseDate: expenseMaintenanceDate,
    note: "Repaired front display lighting and shelving.",
  });

  await createSellerReturn({
    sellerName: "Mekdes Tesfaye",
    branchCode,
    createdByUsername: salesUsername,
    returnDate: returnMekdesDate,
    note: "Unsold assigned stock returned to branch.",
    items: [
      { sku: "COV-SAM-A15-MATTE", quantity: 2, source: must(assignmentMekdes.itemsBySku.get("COV-SAM-A15-MATTE"), "Missing Mekdes A15 cover assignment.") },
      { sku: "CBL-LTG-1M", quantity: 1, source: must(assignmentMekdes.itemsBySku.get("CBL-LTG-1M"), "Missing Mekdes lightning assignment.") },
    ],
  });

  await createSellerSettlement({
    sellerName: "Biruk Alemayehu",
    branchCode,
    createdByUsername: adminUsername,
    settlementDate: settlementBirukDate,
    financeAccountCode: cashAccountCode,
    note: "Partial payout for sold consignment stock.",
    allocations: [
      { allocation: must(sale3.allocations.find((allocation) => allocation.sku === "PGL-IPH-13"), "Missing Biruk privacy allocation."), amount: 800 },
      { allocation: must(sale3.allocations.find((allocation) => allocation.sku === "COV-SAM-A15-MATTE"), "Missing Biruk cover allocation."), amount: 200 },
    ],
  });

  const intakeRahel = await createSellerIntake({
    sellerName: "Rahel Kebede",
    branchCode,
    createdByUsername: salesUsername,
    bringingDate: intakeRahelDate,
    note: "Morning intake of earbuds and Apple chargers.",
    items: [
      { sku: "EAR-ORA-NEO", quantityBrought: 6, sellerFixedPrice: 980, targetSellingPrice: 1500 },
      { sku: "CHG-APL-20W", quantityBrought: 5, sellerFixedPrice: 850, targetSellingPrice: 1350 },
    ],
  });

  const assignmentNahom = await createSellerAssignment({
    sellerName: "Nahom Bekele",
    branchCode,
    createdByUsername: salesUsername,
    assignmentDate: assignmentNahomDate,
    note: "Issued cables for Nahom to sell around Megenagna.",
    items: [
      { sku: "CBL-USBC-1M", quantityAssigned: 12, sellingPrice: 150, sourceBatch: must(purchase6.itemsBySku.get("CBL-USBC-1M"), "Missing seller cable batch.") },
    ],
  });

  const sale8 = await createSale({
    branchCode,
    createdByUsername: salesUsername,
    soldAt: sale8Date,
    customerName: "Yonatan Girma",
    paymentMethod: SalePaymentMethod.CASH,
    financeAccountCode: cashAccountCode,
    note: "High-value mixed sale with partner and branch stock.",
    items: [
      { sku: "EAR-ORA-NEO", quantity: 2, unitPrice: 1500, source: must(intakeRahel.itemsBySku.get("EAR-ORA-NEO"), "Missing Rahel earbuds intake.") },
      { sku: "CHG-APL-20W", quantity: 2, unitPrice: 1350, source: must(intakeRahel.itemsBySku.get("CHG-APL-20W"), "Missing Rahel Apple charger intake.") },
      { sku: "CHG-SAM-25W", quantity: 1, unitPrice: 650, source: must(assignmentBiruk.itemsBySku.get("CHG-SAM-25W"), "Missing Biruk charger assignment.") },
      { sku: "PGL-SAM-A34", quantity: 7, unitPrice: 300, source: must(purchase4.itemsBySku.get("PGL-SAM-A34"), "Missing Samsung A34 privacy glass batch.") },
      { sku: "SCR-IPH-14P-OLED", quantity: 1, unitPrice: 12300, source: must(purchase2.itemsBySku.get("SCR-IPH-14P-OLED"), "Missing iPhone 14 Pro screen batch.") },
    ],
  });

  const sale9 = await createSale({
    branchCode,
    createdByUsername: salesUsername,
    soldAt: sale9Date,
    customerName: "Eyerusalem Kebede",
    paymentMethod: SalePaymentMethod.CREDIT,
    note: "Credit sale with branch-owned and seller-assigned stock.",
    items: [
      { sku: "SCR-SAM-A24-AMOLED", quantity: 1, unitPrice: 4100, source: must(purchase1.itemsBySku.get("SCR-SAM-A24-AMOLED"), "Missing A24 screen batch.") },
      { sku: "COV-IPH-13-SIL", quantity: 2, unitPrice: 450, source: must(purchase2.itemsBySku.get("COV-IPH-13-SIL"), "Missing iPhone 13 cover batch.") },
      { sku: "CBL-USBC-1M", quantity: 5, unitPrice: 180, source: must(assignmentNahom.itemsBySku.get("CBL-USBC-1M"), "Missing Nahom cable assignment.") },
      { sku: "SCR-1P-NORDCE3L", quantity: 1, unitPrice: 3900, source: must(purchase5.itemsBySku.get("SCR-1P-NORDCE3L"), "Missing OnePlus screen batch.") },
    ],
  });

  const sale10 = await createSale({
    branchCode,
    createdByUsername: salesUsername,
    soldAt: sale10Date,
    paymentMethod: SalePaymentMethod.BANK,
    financeAccountCode: cbeAccountCode,
    note: "Final OnePlus glass sale plus USB-C to USB-C cable.",
    items: [
      { sku: "TGL-1P-11-5D", quantity: 4, unitPrice: 280, source: must(purchase5.itemsBySku.get("TGL-1P-11-5D"), "Missing OnePlus glass batch.") },
      { sku: "CBL-USBC-USBC-60W", quantity: 2, unitPrice: 240, source: must(purchase5.itemsBySku.get("CBL-USBC-USBC-60W"), "Missing USB-C to USB-C cable batch.") },
    ],
  });

  await createCustomerPayment({
    sale: sale9.sale,
    customerName: "Eyerusalem Kebede",
    recordedByUsername: salesUsername,
    branchCode,
    paymentDate: customerPaymentEyerusalemDate,
    financeAccountCode: awashAccountCode,
    amount: 2000,
    note: "Initial payment against the branch credit sale.",
  });

  await createSupplierPayment({
    purchase: purchase2.purchase,
    supplierName: "Lulit Telecom Supply",
    branchCode,
    recordedByUsername: adminUsername,
    paymentDate: supplierPaymentP2Date,
    financeAccountCode: cbeAccountCode,
    amount: 15000,
    note: "Part-payment on premium iPhone screens.",
  });

  await createSupplierPayment({
    purchase: purchase4.purchase,
    supplierName: "Selam Parts Center",
    branchCode,
    recordedByUsername: adminUsername,
    paymentDate: supplierPaymentP4Date,
    financeAccountCode: cashAccountCode,
    amount: 4500,
    note: "Additional payment for privacy glass and earbuds stock.",
  });

  await createSellerCollection({
    sellerName: "Mekdes Tesfaye",
    branchCode,
    createdByUsername: adminUsername,
    collectionDate: collectionMekdesDate,
    financeAccountCode: cashAccountCode,
    note: "Partial collection on assigned covers and cables.",
    allocations: [
      { allocation: must(sale4.allocations.find((allocation) => allocation.sku === "COV-SAM-A15-MATTE"), "Missing Mekdes cover allocation."), amount: 700 },
      { allocation: must(sale4.allocations.find((allocation) => allocation.sku === "CBL-LTG-1M"), "Missing Mekdes cable allocation."), amount: 300 },
    ],
  });

  await createSellerSettlement({
    sellerName: "Rahel Kebede",
    branchCode,
    createdByUsername: adminUsername,
    settlementDate: settlementRahelDate,
    financeAccountCode: cbeAccountCode,
    note: "Partial payout for today's sold consignment stock.",
    allocations: [
      { allocation: must(sale8.allocations.find((allocation) => allocation.sku === "EAR-ORA-NEO"), "Missing Rahel earbuds allocation."), amount: 1500 },
      { allocation: must(sale8.allocations.find((allocation) => allocation.sku === "CHG-APL-20W"), "Missing Rahel Apple charger allocation."), amount: 1000 },
    ],
  });

  await createSellerReturn({
    sellerName: "Biruk Alemayehu",
    branchCode,
    createdByUsername: salesUsername,
    returnDate: returnBirukDate,
    note: "Unsold privacy glass returned back to Biruk.",
    items: [
      { sku: "PGL-IPH-13", quantity: 4, source: must(intakeBiruk.itemsBySku.get("PGL-IPH-13"), "Missing Biruk privacy glass intake.") },
    ],
  });

  await createExpense({
    branchCode,
    financeAccountCode: cashAccountCode,
    expenseCategoryName: "Delivery",
    createdByUsername: adminUsername,
    name: "Same-day courier for Metebaber customer orders",
    amount: 1200,
    expenseDate: expenseDeliveryDate,
    note: "Motorbike delivery for same-day orders.",
  });

  await createExpense({
    branchCode,
    financeAccountCode: awashAccountCode,
    expenseCategoryName: "Utilities",
    createdByUsername: adminUsername,
    name: "Metebaber internet and power",
    amount: 2500,
    expenseDate: expenseUtilitiesDate,
    note: "Combined monthly internet and backup power cost.",
  });

  await createCashTransfer({
    branchCode,
    fromAccountCode: awashAccountCode,
    toAccountCode: cashAccountCode,
    transferDate: cashTransferAwashDate,
    amount: 10000,
    note: "Pulled Awash funds into cash for walk-in operations.",
  });

  await createInventoryArtifacts({
    branches: [...branchesByCode.values()],
    products: [...productsBySku.values()],
    snapshotDate: inventorySnapshotDate,
    resolvedAlertCreatedAt,
    resolvedAlertAt,
  });

  await createAuditEntry({
    actorUsername: adminUsername,
    action: "REUSE_EXISTING_BRANCH",
    entityType: "Branch",
    entityId: EXISTING_BRANCH_ID,
    createdAt: openingBalanceDate,
    branchCode,
    after: { branchCode: EXISTING_BRANCH_CODE, branchName: EXISTING_BRANCH_NAME },
  });

  await createAuditEntry({
    actorUsername: adminUsername,
    action: "POST_PURCHASE",
    entityType: "Purchase",
    entityId: purchase1.purchase.purchaseNumber,
    branchCode,
    createdAt: purchase1Date,
    after: { supplier: "Abebe Mobile Accessories", total: 49640, amountDue: purchase1.purchase.amountDue },
  });

  await createAuditEntry({
    actorUsername: salesUsername,
    action: "RECORD_PARTNER_INTAKE",
    entityType: "SellerIntake",
    entityId: intakeBiruk.intakeNumber,
    branchCode,
    createdAt: intakeBirukDate,
    after: { seller: "Biruk Alemayehu", lines: 2 },
  });

  await createAuditEntry({
    actorUsername: salesUsername,
    action: "COMPLETE_SALE",
    entityType: "Sale",
    entityId: sale8.sale.saleNumber,
    branchCode,
    createdAt: sale8Date,
    after: { paymentMethod: SalePaymentMethod.CASH, total: 20750, customer: "Yonatan Girma" },
  });

  await createAuditEntry({
    actorUsername: adminUsername,
    action: "POST_SUPPLIER_PAYMENT",
    entityType: "SupplierPayment",
    entityId: purchase2.purchase.purchaseNumber,
    branchCode,
    createdAt: supplierPaymentP2Date,
    after: { supplier: "Lulit Telecom Supply", paymentAmount: 15000, remainingDue: purchase2.purchase.amountDue },
  });

  await createAuditEntry({
    actorUsername: adminUsername,
    action: "POST_SELLER_COLLECTION",
    entityType: "SellerCollection",
    entityId: "Mekdes Tesfaye",
    branchCode,
    createdAt: collectionMekdesDate,
    after: { seller: "Mekdes Tesfaye", amount: 1000 },
  });

  console.log(`Demo seed complete for existing branch ${EXISTING_BRANCH_CODE} (${EXISTING_BRANCH_NAME}).`);
  console.log(`Reused existing branch id: ${EXISTING_BRANCH_ID}`);
  console.log(`Reused existing users: ${REQUIRED_USERNAMES.join(", ")}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
