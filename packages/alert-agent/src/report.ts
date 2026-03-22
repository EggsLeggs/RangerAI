import fs from "node:fs/promises";
import path from "node:path";
import { generateText } from "ai";
import { openai as aiSdkOpenai } from "@ai-sdk/openai";
import OpenAI from "openai";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { type ScoredSighting, ThreatLevel } from "@rangerai/shared";

// Vercel's filesystem is read-only outside /tmp; fall back to /tmp/reports when deployed
const REPORTS_DIR = process.env.VERCEL
  ? "/tmp/reports"
  : path.resolve(process.cwd(), "reports");

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
  mostAnomalous: ScoredSighting | null;
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

  const mostAnomalous =
    sightings.length === 0
      ? null
      : [...sightings].sort((a, b) => b.anomalyScore - a.anomalyScore)[0];

  return { total, byThreatLevel, speciesFrequency, mostAnomalous };
}

export async function generateIllustration(species: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    console.warn(`[alert-agent] OPENAI_API_KEY not set — skipping illustration`);
    return `data:image/svg+xml;utf8,${encodeURIComponent(PAWPRINT_SVG)}`;
  }

  try {
    const client = new OpenAI({ apiKey });
    const response = await client.images.generate({
      model: "dall-e-3",
      prompt: `detailed scientific field illustration of ${species}, naturalist sketchbook style, black ink on cream paper`,
      size: "1024x1024",
      quality: "standard",
      n: 1,
      response_format: "b64_json",
    });
    const b64 = response.data?.[0]?.b64_json;
    if (!b64) throw new Error("no b64_json in DALL-E response");
    return `data:image/png;base64,${b64}`;
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
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    console.warn(`[alert-agent] OPENAI_API_KEY not set — using narrative fallback`);
    return buildNarrativeFallback(sightings);
  }

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
    return buildNarrativeFallback(sightings);
  }
}

function buildNarrativeFallback(sightings: ScoredSighting[]): string {
  const lines = sightings.map(
    (s) =>
      `${s.species}: threat=${s.threatLevel}, anomaly score=${s.anomalyScore}/100, IUCN status=${s.iucnStatus}, in-range=${s.inRange}`
  );
  return (
    `Field report — ${sightings.length} sighting(s) recorded.\n\n` +
    lines.join("\n")
  );
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

function renderFrequencyChart(
  speciesFrequency: Array<{ species: string; count: number }>
): string {
  if (speciesFrequency.length === 0) return "";

  const BAR_HEIGHT = 28;
  const BAR_GAP = 8;
  const LABEL_WIDTH = 200;
  const MAX_BAR_WIDTH = 300;
  const CHART_PADDING = 16;

  const maxCount = speciesFrequency[0].count;
  const svgHeight =
    speciesFrequency.length * (BAR_HEIGHT + BAR_GAP) - BAR_GAP + CHART_PADDING * 2;
  const svgWidth = LABEL_WIDTH + MAX_BAR_WIDTH + 48;

  const bars = speciesFrequency
    .map(({ species, count }, i) => {
      const barWidth = maxCount > 0 ? (count / maxCount) * MAX_BAR_WIDTH : 0;
      const y = CHART_PADDING + i * (BAR_HEIGHT + BAR_GAP);
      return `
      <text x="${LABEL_WIDTH - 8}" y="${y + BAR_HEIGHT / 2 + 5}" text-anchor="end" fill="#2a3a2e" font-size="12" font-family="Space Grotesk, sans-serif">${escHtml(species)}</text>
      <rect x="${LABEL_WIDTH}" y="${y}" width="${barWidth}" height="${BAR_HEIGHT}" rx="3" fill="#2d5a3d" opacity="0.75"/>
      <text x="${LABEL_WIDTH + barWidth + 6}" y="${y + BAR_HEIGHT / 2 + 5}" fill="#5a7a5a" font-size="12" font-family="Space Grotesk, sans-serif">${count}</text>`;
    })
    .join("\n");

  return `
    <section class="chart-section">
      <h3>Species Frequency</h3>
      <svg viewBox="0 0 ${svgWidth} ${svgHeight}" width="100%" style="max-width:${svgWidth}px;display:block;">
        ${bars}
      </svg>
    </section>`;
}

function renderMapSection(mostAnomalous: ScoredSighting): string {
  const lat = mostAnomalous.lat.toFixed(6);
  const lng = mostAnomalous.lng.toFixed(6);
  const zoom = 8;
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${mostAnomalous.lng - 2},${mostAnomalous.lat - 2},${mostAnomalous.lng + 2},${mostAnomalous.lat + 2}&layer=mapnik&marker=${lat},${lng}`;

  return `
    <section class="map-section">
      <h3>Most Anomalous Sighting — Location</h3>
      <p class="map-label">${escHtml(mostAnomalous.species)} &middot; ${lat}, ${lng} &middot; anomaly score ${mostAnomalous.anomalyScore}/100</p>
      <div class="map-frame">
        <iframe
          src="${mapUrl}"
          width="100%"
          height="300"
          frameborder="0"
          scrolling="no"
          marginheight="0"
          marginwidth="0"
          title="Sighting location map"
          loading="lazy"
        ></iframe>
      </div>
      <p class="map-credit"><a href="https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}" target="_blank" rel="noopener">View larger map</a></p>
    </section>`;
}

function renderStatsTable(stats: ReportStats): string {
  const threatRows = (
    Object.entries(stats.byThreatLevel) as [ThreatLevel, number][]
  )
    .filter(([, count]) => count > 0)
    .map(
      ([level, count]) =>
        `<tr><td><span class="badge" style="background:${threatBadgeColor(level)}">${level}</span></td><td>${count}</td></tr>`
    )
    .join("\n");

  const speciesTableRows = stats.speciesFrequency
    .map(
      ({ species, count }) =>
        `<tr><td>${escHtml(species)}</td><td>${count}</td></tr>`
    )
    .join("\n");

  const mostAnomalousSection =
    stats.mostAnomalous !== null
      ? `
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
      </table>`
      : "";

  const mapSection =
    stats.mostAnomalous !== null ? renderMapSection(stats.mostAnomalous) : "";

  return `
    <section class="stats">
      <h2>Sighting Statistics</h2>
      <p class="stat-total">Total sightings: <strong>${stats.total}</strong></p>

      <h3>By Threat Level</h3>
      <table>
        <thead><tr><th>Level</th><th>Count</th></tr></thead>
        <tbody>${threatRows}</tbody>
      </table>

      ${renderFrequencyChart(stats.speciesFrequency)}

      <h3>Species Breakdown</h3>
      <table>
        <thead><tr><th>Species</th><th>Sightings</th></tr></thead>
        <tbody>${speciesTableRows}</tbody>
      </table>

      ${mostAnomalousSection}

      ${mapSection}
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

  const illustrationEl = illustrationUrl.startsWith("data:image/svg")
    ? `<div class="illustration-placeholder">${PAWPRINT_SVG}<p class="placeholder-label">Illustration unavailable</p></div>`
    : `<img src="${illustrationUrl}" alt="Scientific field illustration of ${escHtml(primarySpecies)}" class="illustration" />`;

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

    .chart-section {
      margin: 24px 0;
    }

    .map-section {
      margin: 24px 0;
    }

    .map-label {
      font-size: 13px;
      color: #5a7a5a;
      margin-bottom: 10px;
      font-family: 'Caveat', cursive;
      font-size: 15px;
    }

    .map-frame {
      border: 1px solid #d4cfc6;
      border-radius: 6px;
      overflow: hidden;
    }

    .map-frame iframe {
      display: block;
    }

    .map-credit {
      font-size: 11px;
      color: #8a9a8a;
      margin-top: 6px;
    }

    .map-credit a {
      color: #5a8a6a;
    }

    footer {
      border-top: 1px solid #d4cfc6;
      padding-top: 20px;
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
      .map-frame { display: none; }
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

    <footer>Generated by RangerAI &middot; ${escHtml(timestamp)}</footer>
  </div>
</body>
</html>`;
}

async function uploadReportToS3(filename: string, html: string): Promise<boolean> {
  const endpoint = process.env.S3_ENDPOINT?.trim();
  const region = process.env.S3_REGION?.trim() ?? "auto";
  const bucket = process.env.S3_BUCKET?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    return false;
  }

  try {
    const client = new S3Client({
      endpoint,
      region,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });

    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: filename,
      Body: html,
      ContentType: "text/html; charset=utf-8",
    }));

    console.log(`[alert-agent] report uploaded to S3: ${filename}`);
    return true;
  } catch (err) {
    console.warn(`[alert-agent] S3 upload failed for "${filename}": ${String(err)}`);
    return false;
  }
}

export async function generateReport(
  sightings: ScoredSighting[]
): Promise<{ filePath: string; uploadedToS3: boolean }> {
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

  await fs.writeFile(filePath, html, "utf8");
  console.log(`[alert-agent] report saved to ${filePath}`);

  const uploadedToS3 = await uploadReportToS3(filename, html);

  return { filePath, uploadedToS3 };
}
