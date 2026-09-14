import type { Request, Response } from "express";
import { DEFAULT_CLIENT_ID } from "../../../../utils/src/constants";
import { buildClaimsSetOverrides, startJourney, StartFunctionError } from "../client/start-client";
import { buildAuthoriseUrl, InvalidAuthoriseBaseError, parseAuthoriseBase } from "../util/authorise-url";
import { logger } from "../util/logger";
import { type FieldErrors, START_TEMPLATE, startModel, type StartFormValues } from "../views/start-view";

type ValidatedForm = {
    values: StartFormValues;
    errors: FieldErrors;
    authoriseBase?: URL;
};

const trimmed = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

export const validateStartForm = (body: Record<string, unknown>): ValidatedForm => {
    const values: StartFormValues = {
        clientId: trimmed(body.client_id),
        authoriseBaseUrl: trimmed(body.authorise_base_url),
    };
    const errors: FieldErrors = {};

    if (!values.clientId) {
        errors.clientId = "Enter an OAuth Client ID";
    }

    if (!values.authoriseBaseUrl) {
        errors.authoriseBaseUrl = "Enter the CRI front URL";
        return { values, errors };
    }

    try {
        const authoriseBase = parseAuthoriseBase(values.authoriseBaseUrl, process.env.CRI_FRONTEND_URL);
        return { values, errors, authoriseBase };
    } catch (error) {
        if (!(error instanceof InvalidAuthoriseBaseError)) {
            throw error;
        }
        errors.authoriseBaseUrl = error.message;
        return { values, errors };
    }
};

const get = (_req: Request, res: Response): void => {
    res.render(
        START_TEMPLATE,
        startModel({
            values: {
                clientId: DEFAULT_CLIENT_ID,
                authoriseBaseUrl: process.env.CRI_FRONTEND_URL ?? "",
            },
        }),
    );
};

const post = async (req: Request, res: Response): Promise<void> => {
    const { values, errors, authoriseBase } = validateStartForm(req.body ?? {});

    if (!authoriseBase || Object.keys(errors).length) {
        res.status(400).render(START_TEMPLATE, startModel({ values, errors }));
        return;
    }

    try {
        const { client_id, request } = await startJourney(buildClaimsSetOverrides(values));
        const authoriseUrl = buildAuthoriseUrl({ base: authoriseBase, clientId: client_id, request });

        logger.info("Starting journey", { clientId: client_id, authoriseOrigin: authoriseUrl.origin });
        res.redirect(302, authoriseUrl.toString());
    } catch (error) {
        logger.error("Problem starting journey", error as Error);
        const message = error instanceof StartFunctionError ? error.message : "Problem starting journey";
        res.status(502).render(START_TEMPLATE, startModel({ values, errors: { form: message } }));
    }
};

export { get, post };
