import { Command } from "@aws-sdk/types";
import { SmithyResolvedConfiguration } from "@smithy/core/client";
import { Client, HttpHandlerOptions, MetadataBearer } from "@smithy/types";

type AWSServiceClient<Input extends object, Output extends MetadataBearer> = Client<
    Input,
    Output,
    SmithyResolvedConfiguration<HttpHandlerOptions>
>;

type AWSServiceClientCommand<
    Input extends object,
    InputType extends Input,
    Output extends MetadataBearer,
    OutputType extends Output,
> = Command<Input, InputType, Output, OutputType, SmithyResolvedConfiguration<HttpHandlerOptions>>;

export function createSendCommandWithClient<
    Input extends object,
    InputType extends Input,
    Output extends MetadataBearer,
    OutputType extends Output,
>(client: AWSServiceClient<Input, Output>) {
    return function <CommandInputType extends Input = InputType, CommandOutputType extends Output = OutputType>(
        commandConstructor: new (
            input: CommandInputType,
        ) => AWSServiceClientCommand<Input, CommandInputType, Output, CommandOutputType>,
        commandInput: CommandInputType,
    ) {
        return client.send(new commandConstructor(commandInput));
    };
}

export function createSendCommand<Input extends object, Output extends MetadataBearer>(
    clientConstructor: () => AWSServiceClient<Input, Output>,
) {
    return createSendCommandWithClient(clientConstructor());
}
