import type { Request, Response } from "express";
import { UI_ROOT } from "../paths";
import {
    credentialsMatch,
    getConfiguredCredentials,
    MissingCredentialsError,
    notConfiguredResponse,
    startSession,
} from "../util/auth";
import { logger } from "../util/logger";
import { SIGN_IN_TEMPLATE, signInModel } from "../views/sign-in-view";

const trimmed = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

const get = (_req: Request, res: Response): void => {
    res.render(SIGN_IN_TEMPLATE, signInModel());
};

const post = async (req: Request, res: Response): Promise<void> => {
    const username = trimmed(req.body?.username);
    const password = typeof req.body?.password === "string" ? req.body.password : ""; // pragma: allowlist secret

    try {
        const credentials = await getConfiguredCredentials();

        if (!credentialsMatch(`${username}:${password}`, credentials)) {
            logger.info("Rejected sign in", { username });
            res.status(401).render(
                SIGN_IN_TEMPLATE,
                signInModel({ username, errors: { form: "Incorrect username or password" } }),
            );
            return;
        }

        await startSession(req, res, credentials);
        res.redirect(302, UI_ROOT);
    } catch (error) {
        if (!(error instanceof MissingCredentialsError)) {
            throw error;
        }
        notConfiguredResponse(res, error);
    }
};

export { get, post };
