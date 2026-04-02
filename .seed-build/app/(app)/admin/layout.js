import { Fragment as _Fragment, jsx as _jsx } from "react/jsx-runtime";
import { requireRole } from "@/lib/auth/session";
export default async function AdminLayout({ children, }) {
    await requireRole(["ADMIN"]);
    return _jsx(_Fragment, { children: children });
}
