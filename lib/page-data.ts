import { getCurrentUser } from "@/lib/auth/session";
import { getDashboardSnapshot } from "@/lib/dashboard-data";
import {
  getAlertRecordRows,
  getLowStockRows,
  getOutOfStockRows,
  getProductRows,
  getStockMovementRows,
  getStockOverviewMetrics,
  getStockOverviewRows,
  getTransferRows,
} from "@/lib/page-data-inventory";
import {
  getCustomerCreditRows,
  getCustomerPaymentRows,
  getCustomerRows,
  getSalesProfitRows,
  getSalesRows,
  getSoldItemRows,
} from "@/lib/page-data-sales";
import {
  getBranchRows,
  getCashAccountRows,
  getExpenseCategorySummaryRows,
  getExpenseRows,
  getExpenseKpis,
  getFinanceAccountRows,
  getLedgerRows,
  getPurchaseRows,
  getRoleRows,
  getSupplierPaymentRows,
  getSupplierRows,
  getUserRows,
  getAuditLogRows,
  getCashTransferRows,
} from "@/lib/page-data-purchases-finance-admin";
import {
  getSellerAssignedRows,
  getSellerAssignCandidateRows,
  getSellerCollectionRows,
  getSellerIntakeRows,
  getSellerMetrics,
  getSellerReturnRows,
  getSellerRows,
  getSellerSettlementRows,
} from "@/lib/page-data-sellers";
import { hasPermission } from "@/lib/rbac";
import type { TablePageConfig } from "@/lib/table";

type TablePageFilters = {
  productId?: string | undefined;
  customerId?: string | undefined;
  supplierId?: string | undefined;
  sellerId?: string | undefined;
  branchId?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  flow?: string | undefined;
  type?: string | undefined;
};

export type TablePageKey =
  | "inventoryProducts"
  | "inventoryStockOverview"
  | "inventoryLowStock"
  | "inventoryOutOfStock"
  | "inventoryAlertRecords"
  | "inventoryStockMovements"
  | "inventoryTransfers"
  | "salesSoldItems"
  | "salesList"
  | "salesCustomers"
  | "salesCustomerCredit"
  | "salesCustomerPayments"
  | "purchasesList"
  | "purchasesSuppliers"
  | "purchasesSupplierPayments"
  | "sellersList"
  | "sellersIntakeRecords"
  | "sellersAssignItems"
  | "sellersAssignedItems"
  | "sellersReturns"
  | "sellersSettlements"
  | "sellersCollections"
  | "financeAccounts"
  | "financeCash"
  | "financeCashTransfers"
  | "financeExpenses"
  | "financeLedger"
  | "reportsInventory"
  | "reportsSales"
  | "reportsPurchases"
  | "reportsSellers"
  | "reportsFinance"
  | "adminUsers"
  | "adminRoles"
  | "adminBranches"
  | "adminAuditLogs"
  | "adminSettings";

function emptyReportConfig(
  title: string,
  description: string,
): TablePageConfig {
  return {
    eyebrow: "Reports",
    title,
    description,
    actionLabel: "Run report",
    exportFileName: title.toLowerCase().replaceAll(" ", "-"),
    columns: [
      { key: "name", header: "Report" },
      { key: "description", header: "Description" },
      { key: "updatedAt", header: "Updated", type: "dateTime" },
    ],
    rows: [],
  };
}

export async function getTablePageConfig(
  key: TablePageKey,
  filters: TablePageFilters = {},
): Promise<TablePageConfig> {
  const currentUser = await getCurrentUser();
  const canViewAll = currentUser && hasPermission(currentUser.role, "branch:view-all");
  const activeBranchId = canViewAll ? (filters.branchId ?? currentUser?.activeBranchId) : currentUser?.activeBranchId;

  switch (key) {
    case "inventoryProducts":
      return {
        eyebrow: "Inventory",
        title: "Items",
        description: "Create and manage item records here.",
        actionLabel: "New item",
        exportFileName: "items",
        columns: [
          { key: "name", header: "Item" },
          { key: "unit", header: "Unit" },
          { key: "currentStock", header: "Stock", type: "number" },
          {
            key: "minimumStockAlert",
            header: "Low Stock Alert",
            type: "number",
          },
          { key: "status", header: "Status", type: "status" },
        ],
        rows: await getProductRows(activeBranchId),
      };
      case "inventoryStockOverview":
        return {
          eyebrow: "Inventory",
          title: "Current Stock",
          description:
            "Stock on hand by ownership. Open an item action for movements, batches, transfers, or selling.",
          exportFileName: "current-stock",
        columns: [
          { key: "branch", header: "Branch", defaultHidden: true },
          { key: "product", header: "Item", size: 280 },
          { key: "ownedBatches", header: "Item Details", type: "multiline", defaultHidden: true },
          { key: "ownedQty", header: "Owned", type: "number", size: 82, compact: true },
          { key: "sellerQty", header: "Seller", type: "number", size: 82, compact: true },
          { key: "assignedQty", header: "Assigned", type: "number", size: 92, compact: true, hideOnMobile: true },
          { key: "totalQty", header: "Total", type: "number", size: 82, compact: true },
          { key: "stockValue", header: "Value", type: "currency", size: 118, compact: true, hideOnMobile: true },
        ],
        rows: await getStockOverviewRows(activeBranchId, currentUser?.role ?? "SALES"),
        kpis: await getStockOverviewMetrics(activeBranchId),
      };
    case "inventoryLowStock":
      return {
        eyebrow: "Inventory",
        title: "Low Stock",
        description:
          "Items that have reached or fallen below the configured minimum stock level.",
        exportFileName: "low-stock",
        columns: [
          { key: "branch", header: "Branch", defaultHidden: true },
          { key: "name", header: "Item" },
          { key: "currentStock", header: "Current", type: "number" },
          { key: "minimumStockAlert", header: "Threshold", type: "number" },
          { key: "status", header: "Severity", type: "status" },
        ],
        rows: await getLowStockRows(activeBranchId),
      };
    case "inventoryOutOfStock":
      return {
        eyebrow: "Inventory",
        title: "Out Of Stock",
        description:
          "Finished items by branch that are currently unavailable and ready for replenishment.",
        exportFileName: "out-of-stock",
        columns: [
          { key: "branch", header: "Branch", defaultHidden: true },
          { key: "name", header: "Item" },
          { key: "currentStock", header: "Current", type: "number" },
          { key: "minimumStockAlert", header: "Threshold", type: "number" },
          { key: "status", header: "Status", type: "status" },
        ],
        rows: await getOutOfStockRows(activeBranchId),
      };
    case "inventoryAlertRecords":
      return {
        eyebrow: "Inventory",
        title: "Alert Records",
        description: "Low-stock alert history raised by the inventory ledger.",
        exportFileName: "alert-records",
        columns: [
          { key: "branch", header: "Branch", defaultHidden: true },
          { key: "product", header: "Product" },
          { key: "threshold", header: "Threshold", type: "number" },
          { key: "quantityAtAlert", header: "Qty At Alert", type: "number" },
          { key: "status", header: "Status", type: "status" },
          { key: "createdAt", header: "Created", type: "dateTime" },
        ],
        rows: await getAlertRecordRows(activeBranchId),
      };
    case "inventoryStockMovements":
      return {
        eyebrow: "Inventory",
        title: "Stock Movements",
        description:
          "Ledger-style item movement history with source traceability across stock flows.",
        exportFileName: "stock-movements",
        columns: [
          { key: "branch", header: "Branch", defaultHidden: true },
          { key: "product", header: "Product" },
          { key: "type", header: "Movement Type", type: "status" },
          { key: "ownership", header: "Ownership", defaultHidden: true },
          { key: "quantity", header: "Qty", type: "status" },
          { key: "reference", header: "Reference", defaultHidden: true },
          { key: "notes", header: "Notes" },
          { key: "movementDate", header: "Movement Date", type: "dateTime" },
        ],
        rows: await getStockMovementRows({
          ...(filters.productId ? { productId: filters.productId } : {}),
          ...(activeBranchId ? { branchId: activeBranchId } : {}),
        }),
      };
    case "inventoryTransfers":
      return {
        eyebrow: "Inventory",
        title: "Transfers",
        description:
          "Posted stock movements between branches with source and destination balances kept in sync.",
        actionLabel: "New transfer",
        exportFileName: "transfers",
        columns: [
          { key: "transferNumber", header: "Transfer No.", defaultHidden: true },
          { key: "sourceBranch", header: "From" },
          { key: "destinationBranch", header: "To" },
          { key: "itemCount", header: "Items", type: "number" },
          { key: "totalQuantity", header: "Quantity", type: "number" },
          { key: "status", header: "Status", type: "status" },
          { key: "transferDate", header: "Transfer Date", type: "dateTime" },
        ],
        rows: await getTransferRows(activeBranchId),
      };
    case "salesSoldItems":
      return {
        eyebrow: "Sales",
        title: "Sold Items",
        description:
          "Line-level sold item history showing source ownership, seller linkage, and pricing.",
        exportFileName: "sold-items",
        columns: [
          { key: "saleNumber", header: "Sale No." },
          { key: "branch", header: "Branch", defaultHidden: true },
          { key: "product", header: "Product" },
          { key: "batchNumber", header: "Batch No." },
          { key: "quantity", header: "Qty", type: "number" },
          { key: "source", header: "Source", type: "status" },
          { key: "seller", header: "Seller" },
          { key: "customer", header: "Customer", hideOnMobile: true },
          { key: "unitPrice", header: "Unit Price", type: "currency" },
          { key: "discount", header: "Disc/Qty", type: "currency" },
          { key: "fixedDiscount", header: "Fixed Disc", type: "currency" },
          { key: "total", header: "Total", type: "currency" },
          { key: "soldAt", header: "Sold At", type: "dateTime", hideOnMobile: true },
        ],
        rows: await getSoldItemRows({
          ...(filters.customerId ? { customerId: filters.customerId } : {}),
          ...(filters.sellerId ? { sellerId: filters.sellerId } : {}),
          ...(activeBranchId ? { branchId: activeBranchId } : {}),
          ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
          ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
        }),
      };
    case "salesList":
      return {
        eyebrow: "Sales",
        title: "Sales List",
        description:
          "Branch sales ledger with payment mode, outstanding balance, and posting timestamps.",
        actionLabel: "New sale",
        actionHref: "/sales/new",
        exportFileName: "sales-list",
        tabs: [
          { key: "ALL", label: "All Sales" },
          { key: "PARTNER", label: "Partner Sales" },
          { key: "WALK_IN", label: "Walk-in" },
        ],
        activeTab: filters.type || "ALL",
        tabParam: "type",
        columns: [
          { key: "saleNumber", header: "Sale No.", defaultHidden: true },
          { key: "branch", header: "Branch", defaultHidden: true },
          { key: "customer", header: "Customer" },
          { key: "paymentMethod", header: "Payment", type: "status" },
          { key: "total", header: "Total", type: "currency" },
          { key: "amountDue", header: "Amount Due", type: "currency" },
          { key: "soldAt", header: "Sold At", type: "dateTime" },
        ],
        rows: await getSalesRows({
          ...(filters.customerId ? { customerId: filters.customerId } : {}),
          ...(activeBranchId ? { branchId: activeBranchId } : {}),
          ...(filters.type && filters.type !== "ALL" ? { type: filters.type as any } : {}),
        }),
      };
    case "salesCustomers":
      return {
        eyebrow: "Sales",
        title: "Customers",
        description:
          "Registered customer directory with purchase totals and outstanding credit.",
        actionLabel: "New customer",
        exportFileName: "customers",
        columns: [
          { key: "name", header: "Customer" },
          { key: "phone", header: "Phone" },
          { key: "location", header: "Location" },
          { key: "note", header: "Note" },
          {
            key: "totalPurchases",
            header: "Total Purchases",
            type: "currency",
          },
          { key: "creditBalance", header: "Credit Balance", type: "currency" },
          { key: "lastPurchaseAt", header: "Last Purchase", type: "dateTime" },
          { key: "status", header: "Status", type: "status" },
        ],
        rows: await getCustomerRows({
          ...(activeBranchId ? { branchId: activeBranchId } : {}),
        }),
      };
    case "salesCustomerCredit":
      return {
        eyebrow: "Sales",
        title: "Customer Credit",
        description: "Outstanding customer balances derived from posted sales.",
        exportFileName: "customer-credit",
        columns: [
          { key: "customer", header: "Customer" },
          { key: "phone", header: "Phone" },
          { key: "outstanding", header: "Outstanding", type: "currency" },
          { key: "agingBucket", header: "Aging", type: "status" },
          { key: "lastPurchaseAt", header: "Last Purchase", type: "dateTime" },
          { key: "status", header: "Status", type: "status" },
        ],
        rows: await getCustomerCreditRows({
          ...(filters.customerId ? { customerId: filters.customerId } : {}),
          ...(activeBranchId ? { branchId: activeBranchId } : {}),
        }),
      };
    case "salesCustomerPayments":
      return {
        eyebrow: "Sales",
        title: "Customer Payments",
        description: "Collected customer receipts posted against receivables.",
        actionLabel: "Record payment",
        exportFileName: "customer-payments",
        columns: [
          { key: "receiptNumber", header: "Receipt No." },
          { key: "customer", header: "Customer" },
          { key: "branch", header: "Branch" },
          { key: "paymentMethod", header: "Method" },
          { key: "amount", header: "Amount", type: "currency" },
          { key: "appliedTo", header: "Applied To" },
          { key: "paidAt", header: "Paid At", type: "dateTime" },
          { key: "status", header: "Status", type: "status" },
        ],
        rows: await getCustomerPaymentRows({
          ...(filters.customerId ? { customerId: filters.customerId } : {}),
          ...(activeBranchId ? { branchId: activeBranchId } : {}),
        }),
      };
    case "purchasesList":
      return {
        eyebrow: "Purchases",
        title: "Purchase List",
        description:
          "Purchase history with branch context, optional supplier linkage, totals, and payable status.",
        actionLabel: "New purchase",
        actionHref: "/purchases/new",
        exportFileName: "purchase-list",
        columns: [
          { key: "purchaseNumber", header: "Purchase No.", defaultHidden: true },
          { key: "branch", header: "Branch" },
          { key: "supplier", header: "Supplier" },
          { key: "itemsPurchased", header: "Items Purchased", type: "multiline" },
          { key: "total", header: "Total", type: "currency" },
          { key: "amountDue", header: "Amount Due", type: "currency" },
          { key: "paymentStatus", header: "Status", type: "status" },
          { key: "purchasedAt", header: "Purchased At", type: "dateTime" },
        ],
        rows: await getPurchaseRows({
          ...(filters.supplierId ? { supplierId: filters.supplierId } : {}),
          ...(activeBranchId ? { branchId: activeBranchId } : {}),
        }),
      };
    case "purchasesSuppliers":
      return {
        eyebrow: "Purchases",
        title: "Suppliers",
        description:
          "Supplier master data with payable balances and purchase counts.",
        actionLabel: "New supplier",
        exportFileName: "suppliers",
        columns: [
          { key: "name", header: "Supplier" },
          { key: "phone", header: "Phone" },
          { key: "location", header: "Location" },
          { key: "note", header: "Note" },
          { key: "payableBalance", header: "Payable", type: "currency" },
          { key: "purchasesCount", header: "Purchases", type: "number" },
          { key: "status", header: "Status", type: "status" },
        ],
        rows: await getSupplierRows(activeBranchId),
      };
    case "purchasesSupplierPayments":
      return {
        eyebrow: "Purchases",
        title: "Supplier Payments",
        description:
          "Supplier payment history posted against purchase liabilities.",
        actionLabel: "Record payment",
        exportFileName: "supplier-payments",
        columns: [
          { key: "paymentNumber", header: "Payment No." },
          { key: "supplier", header: "Supplier" },
          { key: "branch", header: "Branch" },
          { key: "account", header: "Account" },
          { key: "amount", header: "Amount", type: "currency" },
          { key: "appliedTo", header: "Applied To" },
          { key: "paidAt", header: "Paid At", type: "dateTime" },
          { key: "status", header: "Status", type: "status" },
        ],
        rows: await getSupplierPaymentRows({
          ...(filters.supplierId ? { supplierId: filters.supplierId } : {}),
          ...(activeBranchId ? { branchId: activeBranchId } : {}),
        }),
      };
    case "sellersList":
      return {
        eyebrow: "Sellers",
        title: "Sellers",
        description:
          "Seller list showing received-stock payables separately from assigned-stock receivables.",
        actionLabel: "New seller",
        exportFileName: "sellers",
        columns: [
          { key: "fullName", header: "Seller" },
          { key: "phone", header: "Phone" },
          { key: "location", header: "Location" },
          { key: "note", header: "Note", defaultHidden: true },
          { key: "receivedOnHandQty", header: "Received On Hand", type: "number" },
          { key: "assignedOutQty", header: "Assigned Out", type: "number" },
          { key: "payableAmount", header: "Received Payable", type: "currency", hideOnMobile: true },
          { key: "receivableAmount", header: "Assigned Receivable", type: "currency", hideOnMobile: true },
          { key: "lastIntakeAt", header: "Last Intake", type: "dateTime", hideOnMobile: true },
          { key: "status", header: "Status", type: "status" },
        ],
        rows: await getSellerRows(activeBranchId),
        kpis: await getSellerMetrics(activeBranchId),
      };
    case "sellersIntakeRecords":
      return {
        eyebrow: "Sellers",
        title: "Received Records",
        description:
          "Items received from sellers with sold, returned, and remaining quantities.",
        actionLabel: "Receive items",
        actionHref: "/sellers/new-intake",
        exportFileName: "seller-intakes",
        columns: [
          { key: "intakeNumber", header: "Record No." },
          { key: "seller", header: "Seller" },
          { key: "branch", header: "Branch" },
          { key: "product", header: "Item" },
          { key: "quantityBrought", header: "Brought", type: "number" },
          { key: "quantitySold", header: "Sold", type: "number" },
          { key: "quantityReturned", header: "Returned", type: "number" },
          { key: "quantityRemaining", header: "Remaining", type: "number" },
          { key: "bringingDate", header: "Bringing Date", type: "dateTime" },
          { key: "status", header: "Status", type: "status" },
        ],
        rows: await getSellerIntakeRows({
          ...(filters.sellerId ? { sellerId: filters.sellerId } : {}),
          ...(activeBranchId ? { branchId: activeBranchId } : {}),
          ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
          ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
        }),
      };
    case "sellersAssignItems":
      return {
        eyebrow: "Sellers",
        title: "Assign Items",
        description:
          "Available owned items that can be issued to sellers. Sold quantity is settled later, while unsold quantity can be returned into branch stock.",
        actionLabel: "New assignment",
        exportFileName: "seller-assign-items",
        columns: [
          { key: "branch", header: "Branch", defaultHidden: true },
          { key: "product", header: "Product" },
          { key: "referenceNumber", header: "Item Ref", defaultHidden: true },
          { key: "source", header: "Source", type: "status", hideOnMobile: true },
          { key: "sourceName", header: "From", defaultHidden: true },
          { key: "availableQty", header: "Available", type: "number" },
          { key: "unitCost", header: "Buying Price", type: "currency", hideOnMobile: true },
          { key: "sellingPrice", header: "Current Sell", type: "currency" },
          { key: "status", header: "Status", type: "status", hideOnMobile: true },
        ],
        rows: await getSellerAssignCandidateRows(activeBranchId, currentUser?.role ?? "SALES"),
      };
    case "sellersAssignedItems":
      return {
        eyebrow: "Sellers",
        title: "Assigned Items",
        description:
          "Assignment history showing issued quantities, sold quantities, returned-to-stock quantities, and what is still out with the seller.",
        exportFileName: "seller-assigned-items",
        columns: [
          { key: "assignmentNumber", header: "Assignment No.", defaultHidden: true },
          { key: "seller", header: "Seller" },
          { key: "branch", header: "Branch", defaultHidden: true },
          { key: "product", header: "Product", hideOnMobile: true },
          { key: "sourceBatch", header: "Source Batch", defaultHidden: true },
          { key: "assignedPrice", header: "Seller Pays", type: "currency" },
          { key: "unitCost", header: "Buying Price", type: "currency" },
          { key: "assignedQty", header: "Assigned", type: "number" },
          { key: "soldQty", header: "Sold", type: "number" },
          { key: "returnedQty", header: "Returned", type: "number" },
          { key: "remainingQty", header: "Remaining", type: "number" },
          { key: "assignedAt", header: "Assigned At", type: "dateTime" },
          { key: "status", header: "Status", type: "status" },
        ],
        rows: await getSellerAssignedRows({
          ...(filters.sellerId ? { sellerId: filters.sellerId } : {}),
          ...(activeBranchId ? { branchId: activeBranchId } : {}),
        }, currentUser?.role ?? "SALES"),
      };
    case "sellersReturns":
      return {
        eyebrow: "Sellers",
        title: "Returns",
        description:
          "Posted returns of unsold received items back to the seller, and unsold assigned items back into branch stock.",
        actionLabel: "Record return",
        exportFileName: "seller-returns",
        tabs: [
          { key: "ALL", label: "All Returns" },
          { key: "BACK_TO_PARTNER", label: "To Partner" },
          { key: "BACK_TO_BRANCH", label: "Back to Branch" },
        ],
        activeTab: filters.flow || "ALL",
        tabParam: "flow",
        columns: [
          { key: "returnNumber", header: "Return No.", defaultHidden: true },
          { key: "seller", header: "Seller" },
          { key: "branch", header: "Branch" },
          { key: "product", header: "Product" },
          { key: "flow", header: "Flow", type: "status" },
          { key: "sourceRef", header: "Source Ref", defaultHidden: true },
          { key: "quantity", header: "Qty", type: "number", align: "center" },
          { key: "sourceDate", header: "Source Date", type: "dateTime", defaultHidden: true },
          { key: "returnDate", header: "Return Date", type: "dateTime" },
          { key: "status", header: "Status", type: "status" },
        ],
        rows: await getSellerReturnRows({
          ...(filters.sellerId ? { sellerId: filters.sellerId } : {}),
          ...(activeBranchId ? { branchId: activeBranchId } : {}),
          ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
          ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
          ...(filters.flow ? { flow: filters.flow } : {}),
        }),
      };
    case "sellersSettlements":
      return {
        eyebrow: "Sellers",
        title: "Pay Sellers",
        description:
          "Pay exact sold received-seller lines with payment-account traceability. Assigned-from-us items are collected separately.",
        actionLabel: "New payment",
        exportFileName: "seller-settlements",
        columns: [
          { key: "settlementNumber", header: "Settlement No.", defaultHidden: true },
          { key: "seller", header: "Seller" },
          { key: "branch", header: "Branch" },
          { key: "paymentMethod", header: "Method", type: "status" },
          { key: "account", header: "Account" },
          { key: "appliedTo", header: "Applied To" },
          { key: "amount", header: "Amount", type: "currency" },
          { key: "settledAt", header: "Settled At", type: "dateTime" },
          { key: "status", header: "Status", type: "status" },
        ],
        rows: await getSellerSettlementRows({
          ...(filters.sellerId ? { sellerId: filters.sellerId } : {}),
          ...(activeBranchId ? { branchId: activeBranchId } : {}),
          ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
          ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
        }),
      };
    case "sellersCollections":
      return {
        eyebrow: "Sellers",
        title: "Collect From Sellers",
        description:
          "Receive cash or bank collection for sold items previously assigned from branch stock.",
        actionLabel: "New collection",
        exportFileName: "seller-collections",
        columns: [
          { key: "collectionNumber", header: "Collection No.", defaultHidden: true },
          { key: "seller", header: "Seller" },
          { key: "branch", header: "Branch" },
          { key: "paymentMethod", header: "Method", type: "status" },
          { key: "account", header: "Account" },
          { key: "appliedTo", header: "Applied To" },
          { key: "amount", header: "Amount", type: "currency" },
          { key: "collectedAt", header: "Collected At", type: "dateTime" },
          { key: "status", header: "Status", type: "status" },
        ],
        rows: await getSellerCollectionRows({
          ...(filters.sellerId ? { sellerId: filters.sellerId } : {}),
          ...(activeBranchId ? { branchId: activeBranchId } : {}),
          ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
          ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
        }),
      };
    case "financeAccounts":
      return {
        eyebrow: "Finance",
        title: "Accounts",
        description:
          "Branch bank and cash accounts with ledger-derived balances and posting controls.",
        actionLabel: "New account",
        exportFileName: "finance-accounts",
        columns: [
          { key: "code", header: "Code" },
          { key: "name", header: "Account / Person" },
          { key: "type", header: "Type", type: "status" },
          { key: "bankName", header: "Bank" },
          { key: "accountNumber", header: "Account No." },
          { key: "branch", header: "Branch" },
          { key: "balance", header: "Balance", type: "currency" },
          { key: "status", header: "Status", type: "status" },
        ],
        rows: await getFinanceAccountRows({
          ...(activeBranchId ? { branchId: activeBranchId } : {}),
        }),
      };
    case "financeCash":
      return {
        eyebrow: "Finance",
        title: "Cash to Bank",
        description:
          "Review available shop cash and deposit it into a bank account.",
        actionLabel: "Deposit cash",
        exportFileName: "cash-accounts",
        columns: [
          { key: "code", header: "Code" },
          { key: "name", header: "Cash Account" },
          { key: "branch", header: "Branch" },
          { key: "balance", header: "Balance", type: "currency" },
          { key: "status", header: "Status", type: "status" },
        ],
        rows: await getCashAccountRows(activeBranchId),
      };
    case "financeCashTransfers":
      return {
        eyebrow: "Finance",
        title: "Cash Transfers",
        description: "Cash transfer entries posted to the ledger.",
        actionLabel: "New transfer",
        exportFileName: "cash-transfers",
        columns: [
          { key: "transferNumber", header: "Transfer No." },
          { key: "fromAccount", header: "From Account" },
          { key: "toAccount", header: "To Account" },
          { key: "branch", header: "Branch" },
          { key: "amount", header: "Amount", type: "currency" },
          { key: "transferDate", header: "Transfer Date", type: "dateTime" },
          { key: "status", header: "Status", type: "status" },
        ],
        rows: await getCashTransferRows(activeBranchId),
      };
    case "financeExpenses":
      return {
        eyebrow: "Finance",
        title: "Expenses",
        description:
          "Expense records tied to payment accounts, categories, and branches.",
        actionLabel: "New expense",
        exportFileName: "expenses",
        kpis: await getExpenseKpis(activeBranchId),
        columns: [
          { key: "expenseNumber", header: "Expense No." },
          { key: "branch", header: "Branch" },
          { key: "category", header: "Category" },
          { key: "name", header: "Expense" },
          { key: "account", header: "Account" },
          { key: "amount", header: "Amount", type: "currency" },
          { key: "expenseDate", header: "Expense Date", type: "dateTime" },
        ],
        rows: await getExpenseRows(activeBranchId),
      };
    case "financeLedger":
      return {
        eyebrow: "Finance",
        title: "Ledger",
        description:
          "Combined account transaction feed for sales, purchases, and finance flows.",
        exportFileName: "ledger",
        columns: [
          { key: "entryDate", header: "Entry Date", type: "dateTime" },
          { key: "branch", header: "Branch" },
          { key: "account", header: "Account" },
          { key: "type", header: "Type", type: "status" },
          { key: "direction", header: "Direction", type: "status" },
          { key: "amount", header: "Amount", type: "currency" },
          { key: "reference", header: "Reference" },
        ],
        rows: await getLedgerRows(activeBranchId),
      };
    case "reportsInventory":
      return emptyReportConfig(
        "Inventory Reports",
        "Report execution surfaces will populate here from real data filters.",
      );
    case "reportsSales":
      return {
        eyebrow: "Reports",
        title: "Sales Profit",
        description:
          "Daily sale lines with revenue, cost or partner payable, and gross profit.",
        exportFileName: "sales-profit",
        columns: [
          { key: "soldAt", header: "Sold At", type: "dateTime" },
          { key: "saleNumber", header: "Sale No." },
          { key: "branch", header: "Branch" },
          { key: "product", header: "Product" },
          { key: "source", header: "Source", type: "status" },
          { key: "seller", header: "Seller" },
          { key: "quantity", header: "Qty", type: "number" },
          { key: "saleTotal", header: "Sales", type: "currency" },
          { key: "costTotal", header: "Cost / Payable", type: "currency" },
          { key: "sellerPayable", header: "Seller Payable", type: "currency" },
          { key: "grossProfit", header: "Gross Profit", type: "currency" },
        ],
        rows: await getSalesProfitRows({
          ...(activeBranchId ? { branchId: activeBranchId } : {}),
          ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
          ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
        }),
      };
    case "reportsPurchases":
      return emptyReportConfig(
        "Purchase Reports",
        "Report execution surfaces will populate here from real data filters.",
      );
    case "reportsSellers":
      return {
        eyebrow: "Sellers",
        title: "Seller Exposure",
        description:
          "Open received-stock quantities, assigned-out quantities, unpaid seller payables, and uncollected seller receivables grouped per seller, with row actions to drill into each seller history.",
        exportFileName: "seller-exposure",
        columns: [
          { key: "fullName", header: "Seller" },
          { key: "phone", header: "Phone" },
          { key: "location", header: "Location" },
          { key: "note", header: "Note" },
          { key: "receivedOnHandQty", header: "Received On Hand", type: "number" },
          { key: "assignedOutQty", header: "Assigned Out", type: "number" },
          { key: "payableAmount", header: "Unpaid Payable", type: "currency" },
          { key: "receivableAmount", header: "Uncollected Receivable", type: "currency" },
          { key: "lastIntakeAt", header: "Last Intake", type: "dateTime" },
          { key: "status", header: "Status", type: "status" },
        ],
        rows: await getSellerRows(activeBranchId),
      };
    case "reportsFinance":
      return {
        eyebrow: "Reports",
        title: "Expense Summary",
        description:
          "Expense totals by category and branch for the selected reporting window.",
        exportFileName: "expense-summary",
        columns: [
          { key: "category", header: "Category" },
          { key: "branch", header: "Branch" },
          { key: "entries", header: "Entries", type: "number" },
          { key: "totalAmount", header: "Total Amount", type: "currency" },
          { key: "lastExpenseAt", header: "Last Expense", type: "dateTime" },
        ],
        rows: await getExpenseCategorySummaryRows({
          ...(activeBranchId ? { branchId: activeBranchId } : {}),
          ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
          ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
        }),
      };
    case "adminUsers":
      return {
        eyebrow: "Administration",
        title: "Users",
        description:
          "User accounts with branch assignment, role, and active state visibility.",
        actionLabel: "New user",
        exportFileName: "users",
        columns: [
          { key: "name", header: "Name" },
          { key: "username", header: "Login ID" },
          { key: "role", header: "Role", type: "status" },
          { key: "defaultBranch", header: "Default Branch" },
          { key: "branches", header: "Assigned Branches" },
          { key: "status", header: "Status", type: "status" },
        ],
        rows: await getUserRows(),
      };
    case "adminRoles":
      return {
        eyebrow: "Administration",
        title: "Roles",
        description: "Role registry and actual assigned user counts.",
        exportFileName: "roles",
        columns: [
          { key: "role", header: "Role", type: "status" },
          { key: "userCount", header: "Users", type: "number" },
          { key: "scope", header: "Scope" },
          { key: "status", header: "Status", type: "status" },
        ],
        rows: await getRoleRows(),
      };
    case "adminBranches":
      return {
        eyebrow: "Administration",
        title: "Branches",
        description: "Branch master data with live stock valuation totals.",
        actionLabel: "New branch",
        exportFileName: "branches",
        columns: [
          { key: "code", header: "Code" },
          { key: "name", header: "Branch" },
          { key: "location", header: "Location" },
          { key: "stockValue", header: "Stock Value", type: "currency" },
          { key: "status", header: "Status", type: "status" },
        ],
        rows: await getBranchRows(),
      };
    case "adminAuditLogs":
      return {
        eyebrow: "Administration",
        title: "Audit Logs",
        description:
          "High-level audit events for stock, finance, and admin activity.",
        exportFileName: "audit-logs",
        columns: [
          { key: "action", header: "Action", type: "status" },
          { key: "entityType", header: "Entity" },
          { key: "entityId", header: "Reference" },
          { key: "actor", header: "Actor" },
          { key: "branch", header: "Branch" },
          { key: "createdAt", header: "Created At", type: "dateTime" },
        ],
        rows: await getAuditLogRows(activeBranchId),
      };
    case "adminSettings":
      return {
        eyebrow: "Administration",
        title: "Settings",
        description:
          "Settings will appear here once persisted system configuration is implemented.",
        exportFileName: "settings",
        columns: [
          { key: "category", header: "Category", type: "status" },
          { key: "setting", header: "Setting" },
          { key: "value", header: "Value" },
          { key: "updatedAt", header: "Updated", type: "dateTime" },
          { key: "status", header: "Status", type: "status" },
        ],
        rows: [],
      };
    default:
      return {
        title: "Records",
        description: "No data configuration found for this page.",
        columns: [],
        rows: [],
      };
  }
}

export { getDashboardSnapshot };
