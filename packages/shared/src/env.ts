import { config } from "dotenv";
import { readMcpPort } from "./mcp-port.js";

config();

const DEFAULT_WEBHOOK_URL = "http://localhost:3000/api/alerts";

const REQUIRED_ENV_KEYS = [
  "GBIF_TOKEN",
  "IUCN_TOKEN",
  "OPENAI_API_KEY",
  "CIVIC_API_KEY"
] as const;

const OPTIONAL_ENV_KEYS = [
  "INATURALIST_API_KEY",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_FROM_NUMBER",
  "TWILIO_TO_NUMBER"
] as const;

type RequiredEnvKey = (typeof REQUIRED_ENV_KEYS)[number];
type OptionalEnvKey = (typeof OPTIONAL_ENV_KEYS)[number];

function readRequiredEnv(key: RequiredEnvKey): string {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(
      `missing required environment variable: ${key}. ` +
        "set it in your local .env file before starting RangerWatch."
    );
  }

  return value;
}

function readOptionalEnv(key: OptionalEnvKey): string | undefined {
  const value = process.env[key]?.trim();
  if (!value) {
    return undefined;
  }

  return value;
}

function readWebhookUrl(value: string | undefined): string {
  const raw = value?.trim();
  if (!raw) {
    return DEFAULT_WEBHOOK_URL;
  }

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error();
    }
    return parsed.toString();
  } catch {
    throw new Error(`invalid WEBHOOK_URL "${raw}". expected a valid URL.`);
  }
}

export function validateRequiredEnv(): void {
  const missing = REQUIRED_ENV_KEYS.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `missing required environment variables: ${missing.join(", ")}. ` +
        "set them in your local .env file before starting RangerWatch."
    );
  }
}

export const env = {
  INATURALIST_API_KEY: readOptionalEnv("INATURALIST_API_KEY"),
  GBIF_TOKEN: readRequiredEnv("GBIF_TOKEN"),
  IUCN_TOKEN: readRequiredEnv("IUCN_TOKEN"),
  OPENAI_API_KEY: readRequiredEnv("OPENAI_API_KEY"),
  CIVIC_API_KEY: readRequiredEnv("CIVIC_API_KEY"),
  MCP_PORT: readMcpPort(),
  TWILIO_ACCOUNT_SID: readOptionalEnv("TWILIO_ACCOUNT_SID"),
  TWILIO_AUTH_TOKEN: readOptionalEnv("TWILIO_AUTH_TOKEN"),
  TWILIO_FROM_NUMBER: readOptionalEnv("TWILIO_FROM_NUMBER"),
  TWILIO_TO_NUMBER: readOptionalEnv("TWILIO_TO_NUMBER"),
  WEBHOOK_URL: readWebhookUrl(process.env.WEBHOOK_URL)
} as const;

export type Env = typeof env;
export const OPTIONAL_AT_LOAD_KEYS = OPTIONAL_ENV_KEYS;
