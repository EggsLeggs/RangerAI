import fs from "node:fs/promises";
import path from "node:path";
import { generateText } from "ai";
import { openai as aiSdkOpenai } from "@ai-sdk/openai";
import OpenAI from "openai";
import { type ScoredSighting, ThreatLevel } from "@rangerai/shared";
import { env } from "@rangerai/shared/env";

const REPORTS_DIR = path.resolve(process.cwd(), "reports");

const PAWPRINT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="200" height="200">
  <ellipse cx="50" cy="65" rx="22" ry="16" fill="#5a8a6a" opacity="0.4"/>
  <ellipse cx="28" cy="48" rx="9" ry="11" fill="#5a8a6a" opacity="0.4"/>
  <ellipse cx="72" cy="48" rx="9" ry="11" fill="#5a8a6a" opacity="0.4"/>
  <ellipse cx="38" cy="36" rx="7" ry="9" fill="#5a8a6a" opacity="0.4"/>
  <ellipse cx="62" cy="36" rx="7" ry="9" fill="#5a8a6a" opacity="0.4"/>
</svg>`;

interface ReportStats {
  total: number;
  byThreatLevel: Record<ThreatLevel, number>;
  speciesFrequency: Array<{ species: string; count: number }>;
  mostAnomalous: ScoredSighting;
}

export function buildStats(sightings: ScoredSighting[]): ReportStats {
  const total = sightings.length;

  const byThreatLevel: Record<ThreatLevel, number> = {
    [ThreatLevel.CRITICAL]: 0,
    [ThreatLevel.WARNING]: 0,
    [ThreatLevel.INFO]: 0,
    [ThreatLevel.NEEDS_REVIEW]: 0,
  };
  for (const s of sightings) {
    byThreatLevel[s.threatLevel]++;
  }

  const freqMap = new Map<string, number>();
  for (const s of sightings) {
    freqMap.set(s.species, (freqMap.get(s.species) ?? 0) + 1);
  }
  const speciesFrequency = Array.from(freqMap.entries())
    .map(([species, count]) => ({ species, count }))
    .sort((a, b) => b.count - a.count);

  const mostAnomalous = [...sightings].sort(
    (a, b) => b.anomalyScore - a.anomalyScore
  )[0];

  return { total, byThreatLevel, speciesFrequency, mostAnomalous };
}

export async function generateIllustration(species: string): Promise<string> {
  try {
    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    const response = await client.images.generate({
      model: "dall-e-3",
      prompt: `detailed scientific field illustration of ${species}, naturalist sketchbook style, black ink on cream paper`,
      size: "1024x1024",
      quality: "standard",
      n: 1,
    });
    const url = response.data[0]?.url;
    if (!url) throw new Error("no image URL in DALL-E response");
    return url;
  } catch (err) {
    console.warn(
      `[alert-agent] DALL-E 3 illustration failed for "${species}": ${String(err)}`
    );
    return `data:image/svg+xml;utf8,${encodeURIComponent(PAWPRINT_SVG)}`;
  }
}

export async function generateNarrative(
  sightings: ScoredSighting[]
): Promise<string> {
  try {
    const summary = sightings
      .map(
        (s) =>
          `${s.species} (${s.threatLevel}, score ${s.anomalyScore}, IUCN: ${s.iucnStatus}, in-range: ${s.inRange})`
      )
      .join("; ");

    const { text } = await generateText({
      model: aiSdkOpenai("gpt-4o"),
      prompt:
        `You are a wildlife conservation officer writing a field log. ` +
        `Summarise the following sightings into a 2-paragraph field report. ` +
        `Include species observed, threat levels, anomalies detected, and recommended follow-up actions.\n\n` +
        `Sightings: ${summary}`,
    });

    return text;
  } catch (err) {
    console.warn(
      `[alert-agent] GPT-4o narrative failed: ${String(err)} — using fallback`
    );
    const lines = sightings.map(
      (s) =>
        `${s.species}: threat=${s.threatLevel}, anomaly score=${s.anomalyScore}/100, IUCN status=${s.iucnStatus}, in-range=${s.inRange}`
    );
    return (
      `Field report — ${sightings.length} sighting(s) recorded.\n\n` +
      lines.join("\n")
    );
  }
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function threatBadgeColor(level: ThreatLevel): string {
  switch (level) {
    case ThreatLevel.CRITICAL:
      return "#c85a3a";
    case ThreatLevel.WARNING:
      return "#d4820a";
    case ThreatLevel.INFO:
      return "#2d5a3d";
    case ThreatLevel.NEEDS_REVIEW:
      return "#5a5a8a";
  }
}

function renderStatsTable(stats: ReportStats): string {
  const speciesRows = stats.speciesFrequency
    .map(
      ({ species, count }) =>
        `<tr><td>${escHtml(species)}</td><td>${count}</td></tr>`
    )
    .join("\n");

  const threatRows = (
    Object.entries(stats.byThreatLevel) as [ThreatLevel, number][]
  )
    .filter(([, count]) => count > 0)
    .map(
      ([level, count]) =>
        `<tr><td><span class="badge" style="background:${threatBadgeColor(level)}">${level}</span></td><td>${count}</td></tr>`
    )
    .join("\n");

  return `
    <section class="stats">
      <h2>Sighting Statistics</h2>
      <p class="stat-total">Total sightings: <strong>${stats.total}</strong></p>

      <h3>By Threat Level</h3>
      <table>
        <thead><tr><th>Level</th><th>Count</th></tr></thead>
        <tbody>${threatRows}</tbody>
      </table>

      <h3>Species Frequency</h3>
      <table>
        <thead><tr><th>Species</th><th>Sightings</th></tr></thead>
        <tbody>${speciesRows}</tbody>
      </table>

      <h3>Most Anomalous Sighting</h3>
      <table>
        <thead><tr><th>Field</th><th>Value</th></tr></thead>
        <tbody>
          <tr><td>Species</td><td>${escHtml(stats.mostAnomalous.species)}</td></tr>
          <tr><td>Anomaly Score</td><td>${stats.mostAnomalous.anomalyScore}/100</td></tr>
          <tr><td>Threat Level</td><td><span class="badge" style="background:${threatBadgeColor(stats.mostAnomalous.threatLevel)}">${stats.mostAnomalous.threatLevel}</span></td></tr>
          <tr><td>IUCN Status</td><td>${escHtml(stats.mostAnomalous.iucnStatus)}</td></tr>
          <tr><td>Location</td><td>${stats.mostAnomalous.lat.toFixed(4)}, ${stats.mostAnomalous.lng.toFixed(4)}</td></tr>
          <tr><td>In Range</td><td>${stats.mostAnomalous.inRange ? "Yes" : "No — out of expected range"}</td></tr>
          <tr><td>Observed</td><td>${stats.mostAnomalous.observedAt.toISOString()}</td></tr>
        </tbody>
      </table>
    </section>`;
}

function buildHtml(params: {
  illustrationUrl: string;
  narrative: string;
  stats: ReportStats;
  primarySpecies: string;
  timestamp: string;
}): string {
  const { illustrationUrl, narrative, stats, primarySpecies, timestamp } =
    params;

  const illustrationEl = illustrationUrl.startsWith("data:")
    ? `<div class="illustration-placeholder">${PAWPRINT_SVG}<p class="placeholder-label">Illustration unavailable</p></div>`
    : `<img src="${escHtml(illustrationUrl)}" alt="Scientific field illustration of ${escHtml(primarySpecies)}" class="illustration" />`;

  const narrativeHtml = narrative
    .split("\n\n")
    .map((p) => `<p>${escHtml(p)}</p>`)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Conservation Field Report — ${escHtml(primarySpecies)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Caveat:wght@400;600&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Space Grotesk', sans-serif;
      background: #faf7f2;
      color: #1a2a1e;
      line-height: 1.6;
      padding: 0;
    }

    .page {
      max-width: 860px;
      margin: 0 auto;
      padding: 48px 32px;
    }

    header {
      border-bottom: 2px solid #1a3a2a;
      padding-bottom: 24px;
      margin-bottom: 40px;
    }

    .report-label {
      font-family: 'Caveat', cursive;
      font-size: 14px;
      color: #5a8a6a;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 6px;
    }

    h1 {
      font-size: 32px;
      font-weight: 700;
      color: #1a3a2a;
      line-height: 1.2;
    }

    .meta {
      margin-top: 10px;
      font-size: 13px;
      color: #5a7a5a;
    }

    .two-col {
      display: grid;
      grid-template-columns: 280px 1fr;
      gap: 40px;
      margin-bottom: 48px;
      align-items: start;
    }

    .illustration {
      width: 100%;
      border-radius: 6px;
      border: 1px solid #d4cfc6;
      display: block;
    }

    .illustration-placeholder {
      width: 100%;
      background: #f0ece3;
      border: 1px solid #d4cfc6;
      border-radius: 6px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 32px;
      min-height: 200px;
    }

    .placeholder-label {
      font-family: 'Caveat', cursive;
      color: #8a9a8a;
      margin-top: 12px;
      font-size: 14px;
    }

    .narrative h2 {
      font-size: 18px;
      color: #1a3a2a;
      margin-bottom: 16px;
      font-weight: 600;
    }

    .narrative p {
      font-size: 15px;
      color: #2a3a2e;
      margin-bottom: 14px;
    }

    .stats {
      margin-bottom: 48px;
    }

    h2 {
      font-size: 20px;
      color: #1a3a2a;
      font-weight: 600;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid #d4cfc6;
    }

    h3 {
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #5a7a5a;
      margin: 24px 0 10px;
      font-weight: 500;
    }

    .stat-total {
      font-size: 15px;
      color: #2a3a2e;
      margin-bottom: 8px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }

    thead tr {
      background: #edeae2;
    }

    th {
      text-align: left;
      padding: 8px 12px;
      font-weight: 600;
      color: #1a3a2a;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    td {
      padding: 8px 12px;
      border-bottom: 1px solid #e8e4da;
      color: #2a3a2e;
    }

    tbody tr:last-child td {
      border-bottom: none;
    }

    tbody tr:nth-child(even) {
      background: #f5f2eb;
    }

    .badge {
      display: inline-block;
      padding: 2px 9px;
      border-radius: 4px;
      color: #fff;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.5px;
    }

    footer {
      border-top: 1px solid #d4cfc6;
      padding-top: 20px;
      font-size: 12px;
      color: #8a9a8a;
      font-family: 'Caveat', cursive;
      font-size: 14px;
    }

    @media print {
      body { background: #fff; }
      .page { padding: 24px 16px; max-width: 100%; }
      header { page-break-after: avoid; }
      .two-col { grid-template-columns: 220px 1fr; gap: 24px; }
      .stats { page-break-before: always; }
      table { page-break-inside: avoid; }
      footer { page-break-before: avoid; }
      a { color: inherit; text-decoration: none; }
    }
  </style>
</head>
<body>
  <div class="page">
    <header>
      <p class="report-label">Conservation Field Report</p>
      <h1>${escHtml(primarySpecies)}</h1>
      <p class="meta">Generated ${timestamp}</p>
    </header>

    <div class="two-col">
      <div class="illustration-col">
        ${illustrationEl}
      </div>
      <div class="narrative">
        <h2>Field Officer Notes</h2>
        ${narrativeHtml}
      </div>
    </div>

    ${renderStatsTable(stats)}

    <footer>Generated by RangerWatch &middot; ${escHtml(timestamp)}</footer>
  </div>
</body>
</html>`;
}

export async function generateReport(
  sightings: ScoredSighting[]
): Promise<string> {
  if (sightings.length === 0) {
    throw new Error("generateReport requires at least one sighting");
  }

  const stats = buildStats(sightings);
  const primarySpecies = stats.speciesFrequency[0].species;

  const [illustrationUrl, narrative] = await Promise.all([
    generateIllustration(primarySpecies),
    generateNarrative(sightings),
  ]);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const humanTimestamp = new Date().toUTCString();

  const html = buildHtml({
    illustrationUrl,
    narrative,
    stats,
    primarySpecies,
    timestamp: humanTimestamp,
  });

  await fs.mkdir(REPORTS_DIR, { recursive: true });

  const filename = `${timestamp}-report.html`;
  const filePath = path.join(REPORTS_DIR, filename);

  await Bun.write(filePath, html);

  console.log(`[alert-agent] report saved to ${filePath}`);
  return filePath;
}
