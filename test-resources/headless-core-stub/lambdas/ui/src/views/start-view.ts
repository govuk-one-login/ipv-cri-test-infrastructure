import { DEFAULT_SHARED_CLAIMS } from "../../../../utils/src/constants";
import { errorModel } from "./error-summary";

export const START_TEMPLATE = "start.njk";

export type StartFormValues = {
    clientId: string;
    authoriseBaseUrl: string;
};

export type FieldErrors = Partial<Record<keyof StartFormValues | "form", string>>;

const FIELD_IDS: Record<string, string> = {
    clientId: "client_id",
    authoriseBaseUrl: "authorise_base_url",
};

const namePart = (type: string): string =>
    DEFAULT_SHARED_CLAIMS.name?.[0]?.nameParts?.find((part) => part.type === type)?.value ?? "";

const name = {
    givenName: namePart("GivenName"),
    familyName: namePart("FamilyName"),
};

export const startModel = ({ values, errors = {} }: { values: StartFormValues; errors?: FieldErrors }) => ({
    title: "Start a journey",
    values,
    name,
    ...errorModel(errors, FIELD_IDS),
});
