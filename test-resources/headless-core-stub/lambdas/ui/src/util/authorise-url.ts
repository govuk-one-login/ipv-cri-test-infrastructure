const LOCAL_HOSTNAMES = ["localhost", "127.0.0.1", "[::1]"];

export class InvalidAuthoriseBaseError extends Error {}

export const isAllowedAuthoriseBase = (candidate: URL, criFrontendUrl?: string): boolean => {
    if (LOCAL_HOSTNAMES.includes(candidate.hostname)) {
        return true;
    }

    if (!criFrontendUrl) {
        return false;
    }

    try {
        return candidate.origin === new URL(criFrontendUrl).origin;
    } catch {
        return false;
    }
};

export const parseAuthoriseBase = (base: string, criFrontendUrl?: string): URL => {
    let parsed: URL;
    try {
        parsed = new URL(base);
    } catch {
        throw new InvalidAuthoriseBaseError("Enter a complete URL, including http:// or https://");
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new InvalidAuthoriseBaseError("Enter a complete URL, including http:// or https://");
    }

    if (!isAllowedAuthoriseBase(parsed, criFrontendUrl)) {
        throw new InvalidAuthoriseBaseError(`Enter either ${criFrontendUrl} or a localhost address`);
    }

    return parsed;
};

export const buildAuthoriseUrl = ({
    base,
    clientId,
    request,
}: {
    base: URL;
    clientId: string;
    request: string;
}): URL => {
    const authoriseUrl = new URL("/oauth2/authorize", base);
    authoriseUrl.search = new URLSearchParams({
        client_id: clientId,
        request,
        response_type: "code",
    }).toString();

    return authoriseUrl;
};
