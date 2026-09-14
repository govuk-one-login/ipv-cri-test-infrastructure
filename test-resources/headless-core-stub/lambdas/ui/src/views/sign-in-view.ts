import { errorModel } from "./error-summary";

export const SIGN_IN_TEMPLATE = "sign-in.njk";

export type SignInErrors = Partial<Record<"username" | "password" | "form", string>>;

const FIELD_IDS: Record<string, string> = {
    username: "username",
    password: "password", // pragma: allowlist secret
};

export const signInModel = ({ username = "", errors = {} }: { username?: string; errors?: SignInErrors } = {}) => ({
    title: "Sign in",
    values: { username },
    ...errorModel(errors, FIELD_IDS),
});
