import type { IncomingMessage, ServerResponse } from "node:http";
export declare const attachedCliConnectionBodyLimitBytes: number;
export declare const attachedCliRunBodyLimitBytes: number;
export declare const attachedCliSessionCookieName = "senda_devtools_cli_session";
export declare const attachedCliCsrfHeaderName = "x-senda-csrf";
export declare function attachedCliSecurityHeaders(): Readonly<Record<string, string>>;
export declare function sendAttachedCliJson(response: ServerResponse, status: number, body: unknown, headers?: Readonly<Record<string, string>>): void;
export declare function sendAttachedCliError(response: ServerResponse, status: number, code: string, message: string): void;
export declare function sendAttachedCliErrorBeforeBodyConsumption(request: IncomingMessage, response: ServerResponse, status: number, code: string, message: string): void;
export declare function oneAttachedCliRawHeader(request: IncomingMessage, name: string): string | undefined;
export declare function equalAttachedCliOpaqueToken(actual: string | undefined, expected: string): boolean;
export declare function parseAttachedCliSessionCookie(value: string): string | undefined;
export declare function isAttachedCliRecord(value: unknown): value is Readonly<Record<string, unknown>>;
export declare function readAttachedCliJsonMutation(request: IncomingMessage, response: ServerResponse, limitBytes: number, tooLargeMessage: string): Promise<unknown | undefined>;
export declare function sendAttachedCliControllerError(response: ServerResponse, error: unknown): void;
//# sourceMappingURL=cli-attached-http.d.ts.map