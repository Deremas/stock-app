import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
export function PageHeader({ title, description, }) {
    return (_jsxs(_Fragment, { children: [_jsx("h1", { className: "sr-only", children: title }), _jsx("p", { className: "max-w-full break-words text-sm text-muted-foreground", children: description })] }));
}
