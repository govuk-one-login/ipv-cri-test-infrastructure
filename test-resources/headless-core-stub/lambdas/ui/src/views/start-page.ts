import { DEFAULT_SHARED_CLAIMS } from "../../../../utils/src/constants";
import { render } from "./render";

export type StartFormValues = {
    clientId: string;
    authoriseBaseUrl: string;
};

export type FieldErrors = Partial<Record<keyof StartFormValues | "form", string>>;

const FIELD_IDS: Record<keyof StartFormValues, string> = {
    clientId: "client_id",
    authoriseBaseUrl: "authorise_base_url",
};

const namePart = (type: string): string =>
    DEFAULT_SHARED_CLAIMS.name?.[0]?.nameParts?.find((part) => part.type === type)?.value ?? "";

const name = {
    givenName: namePart("GivenName"),
    familyName: namePart("FamilyName"),
};

const errorMessages = (errors: FieldErrors): Record<string, { text: string }> =>
    Object.fromEntries(Object.entries(errors).map(([field, text]) => [field, { text }]));

export const startPage = ({ values, errors = {} }: { values: StartFormValues; errors?: FieldErrors }): string =>
    render("start.njk", {
        title: "Start a journey",
        values,
        name,
        errors: errorMessages(errors),
        errorList: Object.entries(errors).map(([field, text]) => {
            const id = FIELD_IDS[field as keyof StartFormValues];
            return { text, href: id ? `#${id}` : undefined };
        }),
    });
