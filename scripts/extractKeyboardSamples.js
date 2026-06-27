#!/usr/bin/env node

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const sourceDir = getOption("--source") ?? process.argv[2] ?? path.join(projectRoot, "Sound Pack");
const outputDir = getOption("--output") ?? path.join(projectRoot, "public/sounds/keyboard/candidates");
const clipMs = Number(getOption("--clip-ms") ?? 70);
const maxCandidatesPerFile = Number(getOption("--max-candidates") ?? 35);
const minGapMs = Number(getOption("--min-gap-ms") ?? 28);
const preRollMs = Number(getOption("--pre-roll-ms") ?? 8);
const sampleRate = 48000;
const reportPath = path.join(outputDir, "extraction-report.md");
const indexPath = path.join(outputDir, "index.html");

function main() {
  fs.mkdirSync(outputDir, { recursive: true });

  const ffmpeg = findExecutable("ffmpeg");
  const ffprobe = findExecutable("ffprobe");
  if (!ffmpeg || !ffprobe) {
    writeReport([
      "# Keyboard Candidate Extraction Report",
      "",
      "Extraction did not run because `ffmpeg` and/or `ffprobe` were not found on PATH.",
      "",
      `- ffmpeg: ${ffmpeg || "not found"}`,
      `- ffprobe: ${ffprobe || "not found"}`,
      `- Source directory: ${path.resolve(sourceDir)}`,
      `- Output directory: ${path.resolve(outputDir)}`,
      "",
      "Install ffmpeg, then rerun:",
      "",
      "```sh",
      "node scripts/extractKeyboardSamples.js --source \"Sound Pack\"",
      "```",
      ""
    ]);
    console.error("ffmpeg and ffprobe are required to extract candidates. Report written to:", reportPath);
    process.exitCode = 1;
    return;
  }

  const sources = fs
    .readdirSync(sourceDir)
    .filter((filename) => /\.(mp3|wav|m4a|aac|flac)$/i.test(filename))
    .map((filename) => path.join(sourceDir, filename))
    .sort((left, right) => path.basename(left).localeCompare(path.basename(right)));

  const reportRows = [];
  const groups = [];
  const summary = [];

  for (const source of sources) {
    const sourceName = path.basename(source, path.extname(source));
    const groupName = slugify(sourceName);
    const groupDir = path.join(outputDir, groupName);
    fs.rmSync(groupDir, { force: true, recursive: true });
    fs.mkdirSync(groupDir, { recursive: true });

    const audio = decodeMonoPcm(ffmpeg, source);
    const candidates = selectCandidates(detectTransients(audio), maxCandidatesPerFile);
    const files = [];

    candidates.forEach((candidate, index) => {
      const filename = `candidate-${String(index + 1).padStart(3, "0")}.wav`;
      const target = path.join(groupDir, filename);
      const start = Math.max(0, candidate.time - preRollMs / 1000);
      const end = start + clipMs / 1000;
      extractClip(ffmpeg, source, target, start, end);
      const duration = probeDuration(ffprobe, target);

      files.push({
        filename,
        href: `/sounds/keyboard/candidates/${groupName}/${filename}`,
        timestamp: candidate.time,
        peak: candidate.peak,
        duration
      });
      reportRows.push(
        `| ${escapeMarkdown(path.basename(source))} | ${groupName}/${filename} | ${candidate.time.toFixed(4)}s | ${candidate.peak.toFixed(4)} | ${duration.toFixed(4)}s |`
      );
    });

    groups.push({ source: path.basename(source), groupName, files });
    summary.push({ source: path.basename(source), count: files.length });
  }

  writeReport([
    "# Keyboard Candidate Extraction Report",
    "",
    `Source directory: \`${path.resolve(sourceDir)}\``,
    `Output directory: \`${path.resolve(outputDir)}\``,
    "",
    `Clip length: ${clipMs}ms`,
    `Pre-roll: ${preRollMs}ms`,
    `Minimum transient gap: ${minGapMs}ms`,
    `Maximum candidates per source file: ${maxCandidatesPerFile}`,
    "",
    "| Source file | Candidate file | Timestamp | Peak level | Duration |",
    "|---|---|---:|---:|---:|",
    ...reportRows,
    ""
  ]);
  writeAuditionIndex(groups);

  console.log("Keyboard candidate extraction complete.");
  for (const item of summary) {
    console.log(`${item.source}: ${item.count} candidates`);
  }
  console.log("Report:", reportPath);
  console.log("Audition index:", indexPath);
}

function getOption(name) {
  const prefix = `${name}=`;
  const direct = process.argv.find((argument) => argument.startsWith(prefix));
  if (direct) {
    return direct.slice(prefix.length);
  }

  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function findExecutable(name) {
  for (const directory of (process.env.PATH || "").split(path.delimiter)) {
    const executable = path.join(directory, name);
    try {
      fs.accessSync(executable, fs.constants.X_OK);
      return executable;
    } catch {
      // Keep searching PATH.
    }
  }
  return "";
}

function decodeMonoPcm(ffmpeg, source) {
  const result = spawnSync(
    ffmpeg,
    ["-hide_banner", "-loglevel", "error", "-i", source, "-ac", "1", "-ar", String(sampleRate), "-f", "f32le", "pipe:1"],
    { encoding: "buffer", maxBuffer: 1024 * 1024 * 300 }
  );

  if (result.status !== 0) {
    throw new Error(`ffmpeg decode failed for ${source}: ${result.stderr.toString()}`);
  }

  const samples = new Float32Array(result.stdout.buffer, result.stdout.byteOffset, Math.floor(result.stdout.byteLength / 4));
  return { samples, source };
}

function detectTransients({ samples, source }) {
  const windowSize = Math.max(1, Math.floor(sampleRate * 0.003));
  const hopSize = Math.max(1, Math.floor(sampleRate * 0.0015));
  const envelopes = [];
  let maxEnvelope = 0;

  for (let start = 0; start + windowSize < samples.length; start += hopSize) {
    let sum = 0;
    let peak = 0;
    for (let index = start; index < start + windowSize; index += 1) {
      const value = Math.abs(samples[index]);
      sum += value * value;
      peak = Math.max(peak, value);
    }

    const rms = Math.sqrt(sum / windowSize);
    maxEnvelope = Math.max(maxEnvelope, rms);
    envelopes.push({ index: start, rms, peak });
  }

  const threshold = Math.max(0.004, maxEnvelope * 0.1);
  const minGap = Math.floor(sampleRate * (minGapMs / 1000));
  const candidates = [];
  let lastIndex = -Infinity;

  for (let i = 1; i < envelopes.length - 1; i += 1) {
    const previous = envelopes[i - 1];
    const current = envelopes[i];
    const next = envelopes[i + 1];
    const rise = current.rms - previous.rms;
    const isLocalPeak = current.rms >= previous.rms && current.rms >= next.rms;

    if (!isLocalPeak || current.rms < threshold || rise < threshold * 0.05 || current.index - lastIndex < minGap) {
      continue;
    }

    candidates.push({
      source,
      time: current.index / sampleRate,
      peak: current.peak,
      rms: current.rms,
      score: current.rms + rise * 0.75 + current.peak * 0.08
    });
    lastIndex = current.index;
  }

  return candidates;
}

function selectCandidates(candidates, limit) {
  return candidates
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .sort((left, right) => left.time - right.time);
}

function extractClip(ffmpeg, source, target, start, end) {
  const filter = [
    `atrim=start=${start.toFixed(5)}:end=${end.toFixed(5)}`,
    "asetpts=PTS-STARTPTS",
    "silenceremove=start_periods=1:start_threshold=-58dB:start_silence=0.004",
    "loudnorm=I=-25:TP=-3:LRA=18"
  ].join(",");
  const result = spawnSync(
    ffmpeg,
    ["-hide_banner", "-loglevel", "error", "-y", "-i", source, "-af", filter, "-ar", "44100", "-ac", "1", target],
    { encoding: "utf8" }
  );

  if (result.status !== 0) {
    throw new Error(`ffmpeg extraction failed for ${target}: ${result.stderr}`);
  }
}

function probeDuration(ffprobe, target) {
  const result = spawnSync(
    ffprobe,
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", target],
    { encoding: "utf8" }
  );

  const duration = Number(result.stdout.trim());
  return Number.isFinite(duration) ? duration : 0;
}

function writeReport(lines) {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(reportPath, lines.join("\n"));
}

function writeAuditionIndex(groups) {
  const body = groups
    .map((group) => {
      const rows = group.files
        .map(
          (file) => `
            <tr>
              <td>${escapeHtml(file.filename)}</td>
              <td>${file.timestamp.toFixed(3)}s</td>
              <td>${file.peak.toFixed(4)}</td>
              <td>${file.duration.toFixed(3)}s</td>
              <td><audio controls preload="none" src="${escapeHtml(file.href)}"></audio></td>
            </tr>`
        )
        .join("");

      return `
        <section>
          <h2>${escapeHtml(group.source)}</h2>
          <p>${group.files.length} candidates</p>
          <table>
            <thead><tr><th>File</th><th>Timestamp</th><th>Peak</th><th>Duration</th><th>Audition</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </section>`;
    })
    .join("");

  fs.writeFileSync(
    indexPath,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Keyboard Candidate Audition</title>
  <style>
    :root { color-scheme: dark; background: #10100f; color: #f0e7d0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    body { margin: 0; padding: 32px; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    h2 { margin: 0; color: #dda74b; font-size: 16px; }
    section { margin-top: 28px; border-top: 1px solid rgba(240,231,208,.14); padding-top: 18px; }
    p { color: rgba(240,231,208,.55); }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border-bottom: 1px solid rgba(240,231,208,.1); padding: 8px; text-align: left; font-size: 12px; }
    audio { width: 260px; max-width: 100%; height: 32px; }
  </style>
</head>
<body>
  <h1>Keyboard Candidate Audition</h1>
  <p>Generated from local source recordings. Use these controls to quickly audition candidate key clicks.</p>
  ${body}
</body>
</html>
`
  );
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 90);
}

function escapeMarkdown(value) {
  return value.replace(/[|\\]/g, "\\$&");
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

main();
