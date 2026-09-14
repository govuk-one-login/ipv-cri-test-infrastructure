import express, { type Express } from "express";
import { DEFAULT_CLIENT_ID } from "../../../utils/src/constants";
import { govukFavicon, govukStylesheet } from "./assets/govuk";
import { buildAuthoriseUrl, InvalidAuthoriseBaseError, parseAuthoriseBase } from "./util/authorise-url";
import {
    credentialsMatch,
    getConfiguredCredentials,
    MissingCredentialsError,
    requireSession,
    notConfiguredResponse,
    startSession,
    SIGN_IN_PATH,
} from "./util/auth";
import { logger } from "./util/logger";
import { buildClaimsSetOverrides, startJourney, StartFunctionError } from "./client/start-client";
import { FAVICON_PATH, STYLESHEET_PATH } from "./views/render";
import { signInPage } from "./views/sign-in-page";
import { type FieldErrors, startPage, type StartFormValues } from "./views/start-page";

const IMMUTABLE = "public, max-age=31536000, immutable";

const trimmed = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

export const createApp = (): Express => {
    const app = express();

    app.set("trust proxy", true); // required when sat behind api gateway to make Secure cookies work properly

    const form = express.urlencoded({ extended: false });

    app.get(STYLESHEET_PATH, (_req, res) => {
        res.type("text/css").set("Cache-Control", IMMUTABLE).send(govukStylesheet);
    });

    app.get(FAVICON_PATH, (_req, res) => {
        res.type("image/svg+xml").set("Cache-Control", IMMUTABLE).send(govukFavicon);
    });

    app.get(SIGN_IN_PATH, (_req, res) => {
        res.type("html").send(signInPage());
    });

    app.post(SIGN_IN_PATH, form, async (req, res) => {
        const username = trimmed(req.body?.username);
        const password = typeof req.body?.password === "string" ? req.body.password : ""; // pragma: allowlist secret

        try {
            const credentials = await getConfiguredCredentials();

            if (!credentialsMatch(`${username}:${password}`, credentials)) {
                logger.info("Rejected sign in", { username });
                res.status(401)
                    .type("html")
                    .send(signInPage({ username, errors: { form: "Incorrect username or password" } }));
                return;
            }

            await startSession(req, res, credentials);
            res.redirect(302, "/ui");
        } catch (error) {
            if (!(error instanceof MissingCredentialsError)) {
                throw error;
            }
            notConfiguredResponse(res, error);
        }
    });

    app.get("/ui", requireSession, (_req, res) => {
        res.type("html").send(
            startPage({
                values: {
                    clientId: DEFAULT_CLIENT_ID,
                    authoriseBaseUrl: process.env.CRI_FRONTEND_URL ?? "",
                },
            }),
        );
    });

    app.post("/ui/start", requireSession, form, async (req, res) => {
        const body = req.body ?? {};
        const values: StartFormValues = {
            clientId: trimmed(body.client_id),
            authoriseBaseUrl: trimmed(body.authorise_base_url),
        };

        const errors: FieldErrors = {};
        if (!values.clientId) {
            errors.clientId = "Enter an OAuth Client ID";
        }

        let authoriseBase: URL | undefined;
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

        if (Object.keys(errors).length || !authoriseBase) {
            res.status(400).type("html").send(startPage({ values, errors }));
            return;
        }

        try {
            const { client_id, request } = await startJourney(buildClaimsSetOverrides(values));
            const authoriseUrl = buildAuthoriseUrl({ base: authoriseBase, clientId: client_id, request });

            logger.info("Starting journey", { clientId: client_id, authoriseOrigin: authoriseUrl.origin });
            res.redirect(302, authoriseUrl.toString());
        } catch (error) {
            logger.error("Could not start journey", error as Error);
            const message = error instanceof StartFunctionError ? error.message : "Problem starting journey";
            res.status(502)
                .type("html")
                .send(startPage({ values, errors: { form: message } }));
        }
    });

    return app;
};
