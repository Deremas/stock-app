import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ProfileSettingsForm } from "@/components/forms/profile-settings-form";
import { PageHeader } from "@/components/app-shell/page-header";
import { requireSession } from "@/lib/auth/session";
export default async function ProfilePage() {
    const user = await requireSession();
    return (_jsxs("div", { className: "space-y-6", children: [_jsx(PageHeader, { title: "Profile", description: "Update your own name and password here." }), _jsx(ProfileSettingsForm, { user: {
                    name: user.name,
                    username: user.username,
                    role: user.role,
                } })] }));
}
