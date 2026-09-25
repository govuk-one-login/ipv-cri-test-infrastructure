import { getParametersByName } from "@aws-lambda-powertools/parameters/ssm";

export const getParametersValues = async (parameterPaths: string[]): Promise<Record<string, string>> => {
    const { _errors: errors, ...parameters } = await getParametersByName<string>(
        Object.fromEntries(parameterPaths.map((path) => [path, {}])),
        { maxAge: 300, throwOnError: false },
    );

    if (errors?.length) {
        const errorMessage = `Following SSM parameters do not exist: ${errors.join(", ")}`;
        throw new Error(errorMessage);
    }

    return Object.fromEntries(
        parameterPaths.map((path) => {
            return [path.split("/").pop()!, String(parameters[path])];
        }),
    );
};

export const getOptionalParameterValue = async (parameterPath: string): Promise<string | undefined> => {
    try {
        const { _errors: errors, ...parameters } = await getParametersByName<string>(
            { [parameterPath]: {} },
            { maxAge: 300, throwOnError: false },
        );

        if (errors?.length) {
            return undefined;
        } else {
            return String(parameters[parameterPath]);
        }
    } catch {
        return undefined;
    }
};
