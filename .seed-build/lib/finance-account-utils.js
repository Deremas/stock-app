export function dedupeCashAccountsPerBranch(accounts) {
    const seenCashBranches = new Set();
    return accounts.filter((account) => {
        if (account.type !== "CASH") {
            return true;
        }
        const branchKey = account.branchId ?? "__global_cash__";
        if (seenCashBranches.has(branchKey)) {
            return false;
        }
        seenCashBranches.add(branchKey);
        return true;
    });
}
export function toFinanceAccountOption(account) {
    return {
        id: account.id,
        name: account.name,
        type: account.type,
        branchId: account.branchId,
        branchName: account.branch?.name ?? null,
        bankName: account.bankName ?? null,
        accountNumber: account.accountNumber ?? null,
    };
}
export function formatFinanceAccountLabel(account, options = {}) {
    if (account.type === "CASH") {
        return options.includeBranch && account.branchName
            ? `Cash | ${account.branchName}`
            : "Cash";
    }
    const parts = [account.bankName || "Bank", account.name];
    if (account.accountNumber) {
        parts.push(account.accountNumber);
    }
    if (options.includeBranch && account.branchName) {
        parts.push(account.branchName);
    }
    return parts.join(" | ");
}
