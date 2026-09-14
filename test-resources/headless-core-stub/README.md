# Headless Core Stub

## /ui

A tiny serverless frontend for starting a CRI journey from a browser.

The `CRI front URL` field is useful when working on a front end locally, point it at something like
`http://localhost:4501` and the journey starts against your own locally running front

The app invokes the `/start` function described below.

### Access

The frontend is behind a sign-in page. 

Create both of these params in the account it is deployed to, or it won't work:

```shell
aws ssm put-parameter \
  --name /test-resources/ui/credentials \
  --type SecureString \
  --value 'username:password' # change these

aws ssm put-parameter \
  --name /test-resources/ui/sessionSigningKey \
  --type SecureString \
  --value "$(openssl rand -base64 32)"
```

The paths are configurable with the `UiCredentialsParameterName` and `UiSessionKeyParameterName` stack
params.

Rotating the session key signs everyone out.

### Running locally

```shell
cd test-resources
AWS_PROFILE=blah \
START_FUNCTION_NAME=<stack-name>-StartFunction:live \
CRI_FRONTEND_URL=https://review-xx.dev.account.gov.uk \
  npm run ui:dev
```

Serves the app on <http://localhost:3000/ui> by default and targets a stack deployed `StartFunction`. 

Active AWS credentials are required for the account managing the stack. 

Basic auth defaults to `dev:dev` (only in local dev).

## /start

This endpoint will generate an encrypted JWT that can be used to start a session in a CRI. You can pass in a JSON body
to override the values of the JWT Claims Set, or if you pass in an empty JSON object it will generate with default
values.

A full example of top level field overrides can be seen below. For shared_claims and evidence_requested there are more
nested fields you can provide.

It is recommended to not provide overwrites for most fields. For example, time based fields - These should only be
overridden if you want to test how a CRI handles expired JWTs etc.

```
{
    "iss": "https://localhost.gov.uk",
    "sub": "urn:fdc:gov.uk:abcdevg",
    "aud": "https://review-a.dev.account.gov.uk",
    "iat": 1,
    "exp": 2,
    "nbf": 1,
    "response_type": "code",
    "client_id": "ipv-core-stub-aws-headless",
    "redirect_uri": "https://localhost.gov.uk/callback",
    "state": "abc",
    "govuk_signin_journey_id": "abc",
    "shared_claims": {
        "address": [
            {
                "addressLocality": "LONDON",
                "buildingNumber": "10",
                "postalCode": "SW1A 2AA",
                "streetName": "DOWNING STREET",
                "validFrom": "2020-01-01"
            }
        ],
        "birthDate": [
            {
                "value": "1990-01-01"
            }
        ],
        "name": [
            {
                "nameParts": [
                    {
                        "type": "GivenName",
                        "value": "JOE"
                    },
                    {
                        "type": "FamilyName",
                        "value": "BLOGGS"
                    }
                ]
            }
        ]
    },
    "evidence_requested": {
        "scoringPolicy": "gpg45",
        "strengthScore": 2,
        "verificationScore": 2
    },
    "context": "cri_context"
}
```

If shared_claims is not overridden, the default will be;

```
{
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
```

### Configuration

This stack will need to be deployed into an account with a 'core-infrastructure' stack, as it requires the
`core-infrastructure-CriDecryptionKey1Id`

It requires a (test) JWK private key as stored in an SSM param at
`/test-resources/ipv-core-stub-aws-headless/privateSigningKey`

If you are planning to use default values for `aud`, `iss`, `redirect_uri`, all of these will need SSM parameters at;   
`/${COMMON_LAMBDAS_STACK_NAME}/clients/ipv-core-stub-aws-headless/jwtAuthentication/audience`  
`/${COMMON_LAMBDAS_STACK_NAME}/clients/ipv-core-stub-aws-headless/jwtAuthentication/issuer`   
`/${COMMON_LAMBDAS_STACK_NAME}/clients/ipv-core-stub-aws-headless/jwtAuthentication/redirectUri`   