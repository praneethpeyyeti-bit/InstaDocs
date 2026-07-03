import * as path from 'path';
import { Platform } from '../model/ir';
import { exists, readText, walkFiles } from '../util/files';

export interface DetectionResult {
  platform: Platform;
  confidence: number; // 0..1
  scores: Record<Platform, number>;
  /** Human-readable evidence for why this platform was picked. */
  evidence: string[];
}

/**
 * Signature-based platform detection. Fast and deterministic: score each
 * platform by the presence of characteristic files/markers, pick the winner.
 */
export function detectPlatform(workingDir: string): DetectionResult {
  const files = walkFiles(workingDir, { maxFiles: 5000 });
  const byExt = (ext: string) => files.filter((f) => f.toLowerCase().endsWith(ext));
  const evidence: string[] = [];

  const scores: Record<Platform, number> = {
    uipath: 0,
    powerAutomate: 0,
    blueprism: 0,
    automationAnywhere: 0,
    unknown: 0,
  };

  // ---- UiPath ----
  const projectJson = path.join(workingDir, 'project.json');
  if (exists(projectJson) && safeIncludes(projectJson, '"main"')) {
    scores.uipath += 5;
    evidence.push('project.json with "main" entry (UiPath)');
  }
  const xaml = byExt('.xaml');
  if (xaml.length) {
    scores.uipath += 3 + Math.min(xaml.length, 5);
    evidence.push(`${xaml.length} .xaml workflow file(s) (UiPath)`);
  }

  // ---- Power Automate ----
  const paFlows = files.filter(
    (f) =>
      /definition\.json$/i.test(f) &&
      safeIncludes(f, '"actions"') &&
      (safeIncludes(f, '"$connections"') || safeIncludes(f, '"triggers"'))
  );
  if (paFlows.length) {
    scores.powerAutomate += 6;
    evidence.push(`${paFlows.length} Power Automate flow definition(s)`);
  }

  // ---- Blue Prism ----
  const bp = byExt('.bprelease');
  if (bp.length) {
    scores.blueprism += 6;
    evidence.push(`${bp.length} .bprelease file(s) (Blue Prism)`);
  }
  const bpXml = byExt('.xml').filter(
    (f) => safeIncludes(f, '<process ') || safeIncludes(f, '<object ')
  );
  if (bpXml.length) {
    scores.blueprism += 3;
    evidence.push(`${bpXml.length} Blue Prism process/object XML file(s)`);
  }

  // ---- Automation Anywhere ----
  const atmx = byExt('.atmx');
  if (atmx.length) {
    scores.automationAnywhere += 6;
    evidence.push(`${atmx.length} .atmx file(s) (Automation Anywhere)`);
  }
  const aaBots = byExt('.json').filter(
    (f) => safeIncludes(f, '"commandType"') || safeIncludes(f, '"botVariables"')
  );
  if (aaBots.length) {
    scores.automationAnywhere += 4;
    evidence.push(`${aaBots.length} Automation Anywhere bot JSON file(s)`);
  }

  const ranked = (Object.entries(scores) as [Platform, number][])
    .filter(([p]) => p !== 'unknown')
    .sort((a, b) => b[1] - a[1]);

  const [topPlatform, topScore] = ranked[0];
  const total = ranked.reduce((s, [, v]) => s + v, 0);

  if (topScore === 0) {
    return { platform: 'unknown', confidence: 0, scores, evidence };
  }
  return {
    platform: topPlatform,
    confidence: total ? topScore / total : 0,
    scores,
    evidence,
  };
}

/** Read a file and test for a substring, tolerating read errors. */
function safeIncludes(file: string, needle: string): boolean {
  try {
    return readText(file).includes(needle);
  } catch {
    return false;
  }
}
