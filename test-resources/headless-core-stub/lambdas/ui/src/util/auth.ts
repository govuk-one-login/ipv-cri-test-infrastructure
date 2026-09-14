import { getParameter } from "@aws-lambda-powertools/parameters/ssm";
import type { NextFunction, Request, Response } from "express";
import { getIronSession } from "iron-session";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { SIGN_IN_PATH, UI_ROOT } from "../paths";
import { logger } from "./logger";

const COOKIE_NAME = "ui_session";
const SESSION_LIFETIME_SECONDS = 8 * 60 * 60;

export class MissingCredentialsError extends Error {}

export const getConfiguredCredentials = async (): Promise<string> => {
    const fromEnvironment = process.env.UI_CREDENTIALS;
    if (fromEnvironment) {
        return fromEnvironment;
    }

    const parameterName = process.env.CREDENTIALS_PARAM_NAME;
    if (!parameterName) {
        throw new MissingCredentialsError("CREDENTIALS_PARAM_NAME is not configured");
    }

    const credentials = await getParameter(parameterName, { decrypt: true, maxAge: 300 });
    if (!credentials) {
        throw new MissingCredentialsError(`No credentials at SSM parameter ${parameterName}`);
    }

    return credentials;
};

const comparisonKey = randomBytes(32);

export const credentialsMatch = (supplied: string, expected: string): boolean =>
    timingSafeEqual(
        createHmac("sha256", comparisonKey).update(supplied).digest(),
        createHmac("sha256", comparisonKey).update(expected).digest(),
    );

const getSessionKey = async (): Promise<Uint8Array> => {
    const fromEnvironment = process.env.UI_SESSION_KEY;
    if (fromEnvironment) {
        return Buffer.from(fromEnvironment, "base64");
    }

    const parameterName = process.env.SESSION_KEY_PARAM_NAME;
    if (!parameterName) {
        throw new MissingCredentialsError("SESSION_KEY_PARAM_NAME is not configured");
    }

    const key = await getParameter(parameterName, { decrypt: true, maxAge: 300 });
    if (!key) {
        throw new MissingCredentialsError(`No session signing key at SSM parameter ${parameterName}`);
    }

    return Buffer.from(key, "base64");
};

type SessionData = {
    username?: string;
};

const sessionOptions = async (req: Request) => ({
    password: Buffer.from(await getSessionKey()).toString("base64"),
    cookieName: COOKIE_NAME,
    ttl: SESSION_LIFETIME_SECONDS,
    cookieOptions: {
        httpOnly: true,
        secure: req.protocol === "https",
        sameSite: "lax" as const,
        path: UI_ROOT,
        maxAge: SESSION_LIFETIME_SECONDS,
    },
});

export const startSession = async (req: Request, res: Response, credentials: string): Promise<void> => {
    const session = await getIronSession<SessionData>(req, res, await sessionOptions(req));

    session.username = credentials.split(":")[0];
    await session.save();
};

const hasValidSession = async (req: Request, res: Response): Promise<boolean> => {
    const session = await getIronSession<SessionData>(req, res, await sessionOptions(req));

    return !!session.username;
};

export const notConfiguredResponse = (res: Response, error: unknown): void => {
    logger.error("Function is not configured", error as Error);
    res.status(503)
        .type("text/plain")
        .send("not configured for access, see CREDENTIALS_PARAM_NAME and SESSION_KEY_PARAM_NAME");
};

export const requireSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (await hasValidSession(req, res)) {
            next();
            return;
        }
    } catch (error) {
        if (!(error instanceof MissingCredentialsError)) {
            throw error;
        }
        notConfiguredResponse(res, error);
        return;
    }

    logger.info("No valid session, redirecting to sign in", { path: req.path });
    res.redirect(302, SIGN_IN_PATH);
};
