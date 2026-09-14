export const trimmedFormValue = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
