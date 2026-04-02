import { jsx as _jsx } from "react/jsx-runtime";
import { Providers } from "@/components/app-shell/providers";
import "@/app/globals.css";
export const metadata = {
    title: "Stock Management App",
    description: "Multi-branch stock management app for electronics accessories",
};
export default function RootLayout({ children, }) {
    return (_jsx("html", { lang: "en", className: "light", suppressHydrationWarning: true, "data-scroll-behavior": "smooth", children: _jsx("body", { suppressHydrationWarning: true, children: _jsx(Providers, { children: children }) }) }));
}
