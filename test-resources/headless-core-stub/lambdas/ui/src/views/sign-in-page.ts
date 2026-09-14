import { render } from "./render";

export type SignInErrors = Partial<Record<"username" | "password" | "form", string>>;

const FIELD_IDS: Record<string, string> = {
    username: "username",
    password: "password", // pragma: allowlist secret
};

export const signInPage = ({ username = "", errors = {} }: { username?: string; errors?: SignInErrors } = {}): string =>
    render("sign-in.njk", {
        title: "Sign in",
        values: { username },
        errors: Object.fromEntries(Object.entries(errors).map(([field, text]) => [field, { text }])),
        errorList: Object.entries(errors).map(([field, text]) => {
            const id = FIELD_IDS[field];
            return { text, href: id ? `#${id}` : undefined };
        }),
    });
