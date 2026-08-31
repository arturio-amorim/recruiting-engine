/**
 * Authentication hook for the MCP HTTP composition root.
 *
 * The adapter calls authenticate() for every request that passes the Host and
 * Origin checks. Return the principal the credential proves, or null to answer
 * with an HTTP 401 Bearer challenge.
 */
import { createHash, timingSafeEqual } from "node:crypto";

import type { McpHttpAuthOptions } from "@invokta/mcp";

import { EngineStartupError } from "./env.js";

const tokenName = "RECRUITING_ENGINE_HTTP_TOKEN";

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function tokensMatch(presented: string, expected: string): boolean {
  return timingSafeEqual(digest(presented), digest(expected));
}

function readExpectedToken(): string {
  const value = process.env[tokenName];
  if (value === undefined || value === "") {
    throw new EngineStartupError(
      "A required environment variable is missing.",
      tokenName,
    );
  }
  return value;
}

export function createHttpAuth(
  expectedToken = readExpectedToken(),
): McpHttpAuthOptions {
  return {
    mode: "required",
    authenticate(request) {
      const header = request.headers.get("authorization");
      if (header === null) return null;
      const match = /^Bearer\s+(\S+)$/i.exec(header);
      const presented = match?.[1];
      if (presented === undefined || !tokensMatch(presented, expectedToken)) {
        return null;
      }
      return Object.freeze({ id: "http:recruiting-agent" });
    },
  };
}
