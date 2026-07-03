import { describe, expect, it } from 'vitest';
import * as path from 'path';
import { detectPlatform } from '../src/detect';

const uipathFixture = path.join(__dirname, 'fixtures', 'uipath-sample');

describe('detectPlatform', () => {
  it('detects UiPath with high confidence', () => {
    const result = detectPlatform(uipathFixture);
    expect(result.platform).toBe('uipath');
    expect(result.confidence).toBeGreaterThan(0.8);
    expect(result.evidence.join(' ')).toMatch(/UiPath/);
  });

  it('returns unknown for a folder with no automation files', () => {
    const result = detectPlatform(path.join(__dirname, 'fixtures', 'plain'));
    expect(result.platform).toBe('unknown');
    expect(result.confidence).toBe(0);
  });
});
