import type { AppRole } from "@/lib/rbac";

export type BranchOption = {
  id: string;
  code: string;
  name: string;
};

export type NamedOption = {
  id: string;
  name: string;
};

export type ProductOption = {
  id: string;
  name: string;
};

export type TaxFormSettings = {
  vatEnabled: boolean;
  salesVatEnabled: boolean;
  purchaseVatEnabled: boolean;
  defaultSalesVatRate: number;
  defaultPurchaseVatRate: number;
  salesPriceMode: "EXCLUSIVE" | "INCLUSIVE";
  purchasePriceMode: "EXCLUSIVE" | "INCLUSIVE";
  purchaseVatTreatment: "RECOVERABLE" | "NON_RECOVERABLE";
  businessTaxId: string;
};

export type PurchaseFormOptions = {
  branches: BranchOption[];
  suppliers: NamedOption[];
  products: ProductOption[];
  accounts: FinanceAccountOption[];
  taxSettings: TaxFormSettings;
};

export type OwnedStockBatchOption = {
  id: string;
  branchId: string;
  branchName: string;
  productId: string;
  productName: string;
  sourceType: "PURCHASE" | "TRANSFER" | "SELLER_CONSIGNMENT" | "SELLER_ASSIGNED";
  referenceNumber: string;
  sourceName: string;
  receivedAt: string;
  quantity: number;
  quantityAdjustment: number;
  adjustedQuantity: number;
  soldQuantity: number;
  transferredQuantity: number;
  remainingQuantity: number;
  unitCost: number;
  sellingPrice: number;
};

export type SaleFormOptions = {
  branches: BranchOption[];
  customers: NamedOption[];
  products: ProductOption[];
  branchStock: SaleBranchStockOption[];
  ownedBatches: OwnedStockBatchOption[];
  accounts: FinanceAccountOption[];
  taxSettings: TaxFormSettings;
};

export type TransferFormOptions = {
  branches: BranchOption[];
  products: ProductOption[];
  ownedBatches: OwnedStockBatchOption[];
};

export type SellerIntakeFormOptions = {
  branches: BranchOption[];
  sellers: NamedOption[];
  products: ProductOption[];
};

export type SellerAssignmentFormOptions = {
  branches: BranchOption[];
  sellers: NamedOption[];
  ownedBatches: OwnedStockBatchOption[];
};

export type SaleBranchStockOption = {
  branchId: string;
  productId: string;
  availableQty: number;
  defaultUnitPrice: number;
};

export type UserFormOptions = {
  branches: BranchOption[];
};

export type FinanceAccountOption = {
  id: string;
  name: string;
  type: "CASH" | "BANK";
  branchId: string | null;
  branchName: string | null;
  bankName: string | null;
  accountNumber: string | null;
};

export type OutstandingSaleOption = {
  id: string;
  saleNumber: string;
  customerId: string;
  customerName: string;
  branchId: string;
  branchName: string;
  amountDue: number;
  soldAt: string;
};

export type CustomerPaymentFormOptions = {
  customers: NamedOption[];
  accounts: FinanceAccountOption[];
  outstandingSales: OutstandingSaleOption[];
};

export type OutstandingPurchaseOption = {
  id: string;
  purchaseNumber: string;
  supplierId: string;
  supplierName: string;
  branchId: string;
  branchName: string;
  amountDue: number;
  purchasedAt: string;
};

export type SupplierPaymentFormOptions = {
  suppliers: NamedOption[];
  accounts: FinanceAccountOption[];
  outstandingPurchases: OutstandingPurchaseOption[];
};

export type FinanceAccountFormOptions = {
  branches: BranchOption[];
  cashBranchIds: string[];
  hasGlobalCash: boolean;
};

export type CashTransferAccountOption = FinanceAccountOption & {
  balance: number;
};

export type CashTransferFormOptions = {
  branches: BranchOption[];
  cashAccounts: CashTransferAccountOption[];
  bankAccounts: CashTransferAccountOption[];
};

export type ExpenseFormOptions = {
  branches: BranchOption[];
  accounts: FinanceAccountOption[];
  categoryNames: string[];
};

export type OutstandingSellerBalanceOption = {
  sellerId: string;
  sellerName: string;
  branchId: string;
  branchName: string;
  amountDue: number;
};

export type SellerSettlementLineOption = {
  id: string;
  sellerId: string;
  sellerName: string;
  branchId: string;
  branchName: string;
  productName: string;
  saleNumber: string;
  soldAt: string;
  quantity: number;
  amountDue: number;
};

export type SellerSettlementFormOptions = {
  sellers: NamedOption[];
  accounts: FinanceAccountOption[];
  outstandingBalances: OutstandingSellerBalanceOption[];
  lines: SellerSettlementLineOption[];
};

export type SellerCollectionLineOption = {
  id: string;
  sellerId: string;
  sellerName: string;
  branchId: string;
  branchName: string;
  productId: string;
  productName: string;
  saleNumber: string;
  soldAt: string;
  quantity: number;
  amountDue: number;
};

export type SellerCollectionFormOptions = {
  sellers: NamedOption[];
  accounts: FinanceAccountOption[];
  lines: SellerCollectionLineOption[];
};

export type SellerReturnLineDirection = "TO_PARTNER" | "BACK_TO_BRANCH";

export type SellerReturnLineOption = {
  id: string;
  sellerId: string;
  sellerName: string;
  branchId: string;
  branchName: string;
  productId: string;
  productName: string;
  sourceLabel: string;
  sourceDate: string;
  availableQty: number;
  direction: SellerReturnLineDirection;
  intakeItemId?: string;
  assignmentItemId?: string;
};

export type SellerReturnFormOptions = {
  branches: BranchOption[];
  sellers: NamedOption[];
  lines: SellerReturnLineOption[];
};

export type TopProductCardItem = {
  id: string;
  name: string;
  currentStock: number;
  value: number;
};

export type CurrentUser = {
  id: string;
  name: string;
  username: string;
  role: AppRole;
  activeBranchId: string;
  branches: BranchOption[];
};

export type MetricCard = {
  title: string;
  value: string;
  tone?: "default" | "success" | "warning" | "danger";
  meta?: string;
};

export type TrendPoint = {
  label: string;
  value: number;
};

export type RecentTransaction = {
  id: string;
  type: string;
  reference: string;
  amount: number;
  branch: string;
  createdAt: string;
};

export type ProductRow = {
  id: string;
  name: string;
  minimumStockAlert: number;
  currentStock: number;
  status: "ACTIVE" | "INACTIVE";
};

export type StockOverviewRow = {
  id: string;
  branch: string;
  product: string;
  ownedBatches: string;
  ownedQty: number;
  sellerQty: number;
  assignedQty: number;
  totalQty: number;
  stockValue: number;
};

export type AlertRecordRow = {
  id: string;
  branch: string;
  product: string;
  threshold: number;
  quantityAtAlert: number;
  status: "OPEN" | "RESOLVED";
  createdAt: string;
};

export type StockMovementRow = {
  id: string;
  branch: string;
  product: string;
  type: string;
  ownership: string;
  quantity: number;
  reference: string;
  movementDate: string;
};

export type PurchaseRow = {
  id: string;
  purchaseNumber: string;
  branch: string;
  supplier: string;
  total: number;
  amountDue: number;
  paymentStatus: "UNPAID" | "PARTIAL" | "PAID";
  purchasedAt: string;
};

export type SaleRow = {
  id: string;
  saleNumber: string;
  branch: string;
  customer: string;
  paymentMethod: "CASH" | "BANK" | "MIXED" | "CREDIT";
  total: number;
  amountDue: number;
  soldAt: string;
};

export type SoldItemRow = {
  id: string;
  saleNumber: string;
  branch: string;
  product: string;
  quantity: number;
  source: "OWNED" | "SELLER_CONSIGNMENT" | "SELLER_ASSIGNED";
  seller: string;
  customer: string;
  unitPrice: number;
  total: number;
  soldAt: string;
};

export type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  totalPurchases: number;
  creditBalance: number;
  lastPurchaseAt: string;
  status: "ACTIVE" | "INACTIVE";
};

export type SupplierRow = {
  id: string;
  name: string;
  phone: string;
  payableBalance: number;
  purchasesCount: number;
  status: "ACTIVE" | "INACTIVE";
};

export type SellerRow = {
  id: string;
  fullName: string;
  phone: string;
  receivedOnHandQty: number;
  assignedOutQty: number;
  payableAmount: number;
  receivableAmount: number;
  lastIntakeAt: string;
  status: "ACTIVE" | "INACTIVE";
};

export type UserRow = {
  id: string;
  name: string;
  username: string;
  role: AppRole;
  defaultBranch: string;
  branches: string;
  status: "ACTIVE" | "INACTIVE";
};

export type BranchRow = {
  id: string;
  code: string;
  name: string;
  location: string;
  stockValue: number;
  status: "ACTIVE" | "INACTIVE";
};

export type FinanceAccountRow = {
  id: string;
  code: string;
  name: string;
  type: "CASH" | "BANK";
  bankName: string;
  accountNumber: string;
  branch: string;
  balance: number;
  status: "ACTIVE" | "INACTIVE";
};

export type CashAccountRow = {
  id: string;
  code: string;
  name: string;
  branch: string;
  balance: number;
  status: "ACTIVE" | "INACTIVE";
};

export type ExpenseRow = {
  id: string;
  expenseNumber: string;
  branch: string;
  category: string;
  name: string;
  amount: number;
  account: string;
  expenseDate: string;
};

export type LedgerRow = {
  id: string;
  entryDate: string;
  branch: string;
  account: string;
  type: string;
  direction: "DEBIT" | "CREDIT";
  amount: number;
  reference: string;
};

export type AuditLogRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actor: string;
  branch: string;
  createdAt: string;
};

export type ReportRow = {
  id: string;
  name: string;
  description: string;
  updatedAt: string;
};
