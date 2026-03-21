import { config } from "dotenv";
import { readMcpPort } from "./mcp-port.js";

config();

const DEFAULT_WEBHOOK_URL = "http://localhost:3000/api/alerts";
const DEFAULT_INATURALIST_MAX_RESULTS = 200;

const REQUIRED_ENV_KEYS = [
  "GBIF_TOKEN",
  "IUCN_TOKEN",
  "OPENAI_API_KEY",
  "CIVIC_API_KEY"
] as const;

const OPTIONAL_ENV_KEYS = [
  "INATURALIST_API_KEY",
  "RESEND_API_KEY",
  "ALERT_FROM_EMAIL",
  "ALERT_TO_EMAIL"
] as const;

type RequiredEnvKey = (typeof REQUIRED_ENV_KEYS)[number];
type OptionalEnvKey = (typeof OPTIONAL_ENV_KEYS)[number];

function readRequiredEnv(key: RequiredEnvKey): string {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(
      `missing required environment variable: ${key}. ` +
        "set it in your local .env file before starting RangerAI."
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

function readBooleanEnv(key: string, defaultValue: boolean): boolean {
  const value = process.env[key]?.trim().toLowerCase();
  if (!value) return defaultValue;
  return value === "true" || value === "1";
}

function readInaturalistMaxResults(): number {
  const raw = process.env.INATURALIST_MAX_RESULTS?.trim();
  if (!raw) return DEFAULT_INATURALIST_MAX_RESULTS;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_INATURALIST_MAX_RESULTS;
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
        "set them in your local .env file before starting RangerAI."
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
  RESEND_ENABLED: readBooleanEnv("RESEND_ENABLED", false),
  RESEND_API_KEY: readOptionalEnv("RESEND_API_KEY"),
  ALERT_FROM_EMAIL: readOptionalEnv("ALERT_FROM_EMAIL"),
  ALERT_TO_EMAIL: readOptionalEnv("ALERT_TO_EMAIL"),
  WEBHOOK_URL: readWebhookUrl(process.env.WEBHOOK_URL),
  INATURALIST_MAX_RESULTS: readInaturalistMaxResults()
} as const;

export type Env = typeof env;
export const OPTIONAL_AT_LOAD_KEYS = OPTIONAL_ENV_KEYS;
