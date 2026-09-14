import { getParameter } from "@aws-lambda-powertools/parameters/ssm";
import { createHash, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { logger } from "./logger";

const REALM = "CRI Journey Builder";

export class MissingCredentialsError extends Error {}

export const getConfiguredCredentials = async (): Promise<string> => {
    const fromEnvironment = process.env.UI_BASIC_AUTH_CREDENTIALS;
    if (fromEnvironment) {
        return fromEnvironment;
    }

    const parameterName = process.env.BASIC_AUTH_PARAM_NAME;
    if (!parameterName) {
        throw new MissingCredentialsError("BASIC_AUTH_PARAM_NAME is not configured");
    }

    const credentials = await getParameter(parameterName, { decrypt: true, maxAge: 300 });
    if (!credentials) {
        throw new MissingCredentialsError(`No credentials at SSM parameter ${parameterName}`);
    }

    return credentials;
};

const matches = (supplied: string, expected: string): boolean =>
    timingSafeEqual(createHash("sha256").update(supplied).digest(), createHash("sha256").update(expected).digest());

export const basicAuth = async (req: Request, res: Response, next: NextFunction) => {
    let expected: string;
    try {
        expected = await getConfiguredCredentials();
    } catch (error) {
        logger.error("Basic auth is not configured", error as Error);
        res.status(503)
            .type("text/plain")
            .send("not configured for access, create `username:password` at BASIC_AUTH_PARAM_NAME");
        return;
    }

    const header = req.get("authorization") ?? "";
    const [scheme, encoded] = header.split(" ");

    if (scheme?.toLowerCase() === "basic" && encoded) {
        const supplied = Buffer.from(encoded, "base64").toString("utf8");
        if (matches(supplied, expected)) {
            next();
            return;
        }
    }

    res.status(401)
        .set("WWW-Authenticate", `Basic realm="${REALM}", charset="UTF-8"`)
        .type("text/plain")
        .send("Unauthorised");
};
