import type { Request, Response } from "express";
import { DEFAULT_CLIENT_ID } from "../../../../utils/src/constants";
import { invokeStartFunction, StartFunctionError } from "../client/start-function";
import { buildAuthoriseUrl, InvalidAuthoriseBaseError, parseAuthoriseBase } from "../util/authorise-url";
import { trimmedFormValue } from "../util/form-values";
import { logger } from "../util/logger";
import { type FieldErrors, START_TEMPLATE, startModel, type StartFormValues } from "../views/start-view";

type ValidatedForm = { values: StartFormValues; authoriseBase: URL } | { values: StartFormValues; errors: FieldErrors };

export const validateForm = (body: Record<string, unknown>): ValidatedForm => {
    const values: StartFormValues = {
        clientId: trimmedFormValue(body.client_id),
        authoriseBaseUrl: trimmedFormValue(body.authorise_base_url),
    };
    const errors: FieldErrors = {};
    let authoriseBase: URL | undefined;

    if (!values.clientId) {
        errors.clientId = "Enter an OAuth Client ID";
    }

    if (!values.authoriseBaseUrl) {
        errors.authoriseBaseUrl = "Enter the CRI front URL";
    } else {
        try {
            authoriseBase = parseAuthoriseBase(values.authoriseBaseUrl, process.env.CRI_FRONTEND_URL);
        } catch (error) {
            if (!(error instanceof InvalidAuthoriseBaseError)) {
                throw error;
            }
            errors.authoriseBaseUrl = error.message;
        }
    }

    if (!authoriseBase || Object.keys(errors).length) {
        return { values, errors };
    }

    return { values, authoriseBase };
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
    const form = validateForm(req.body ?? {});

    if ("errors" in form) {
        res.status(400).render(START_TEMPLATE, startModel({ values: form.values, errors: form.errors }));
        return;
    }

    try {
        const { client_id, request } = await invokeStartFunction(form.values.clientId);
        const authoriseUrl = buildAuthoriseUrl({ base: form.authoriseBase, clientId: client_id, request });

        logger.info("Starting journey", { clientId: client_id, authoriseOrigin: authoriseUrl.origin });
        res.redirect(302, authoriseUrl.toString());
    } catch (error) {
        logger.error("Problem starting journey", error as Error);
        const message = error instanceof StartFunctionError ? error.message : "Problem starting journey";
        res.status(502).render(START_TEMPLATE, startModel({ values: form.values, errors: { form: message } }));
    }
};

export { get, post };
