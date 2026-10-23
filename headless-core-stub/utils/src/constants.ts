import { PersonExtendedMatchingClass } from "@govuk-one-login/data-vocab/credentials";

export const CORE_STUB_SIGNING_PUBLIC_JWK = {
    kty: "EC",
    use: "sig",
    crv: "P-256",
    kid: "ipv-core-stub-2-from-mkjwk.org",
    x: "k39uKacSukQBrMZrHDTBUZslivpXKDNZTg6inCHwrLc",
    y: "8F8LnQ7wG9hxsT4ax0Aty7iMGIyiY_YGp3_qIZzKo1A",
    alg: "ES256",
};
export const DEFAULT_CLIENT_ID = "ipv-core-stub-aws-headless";

export const DEFAULT_SHARED_CLAIMS: PersonExtendedMatchingClass = {
    name: [
        {
            nameParts: [
                {
                    type: "GivenName",
                    value: "KENNETH",
                },
                {
                    type: "FamilyName",
                    value: "DECERQUEIRA",
                },
            ],
        },
    ],
    birthDate: [
        {
            value: "1965-07-08",
        },
    ],
    address: [
        {
            buildingNumber: "8",
            streetName: "HADLEY ROAD",
            addressLocality: "BATH",
            postalCode: "BA2 5AA",
            validFrom: "2021-01-01",
        },
    ],
};
