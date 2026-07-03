import { describe, expect, it } from 'vitest';
import * as path from 'path';
import { detectPlatform } from '../src/detect';
import { detectDocType } from '../src/detect/docType';
import { discoverProjects, isSolution } from '../src/detect/solution';

const uipathFixture = path.join(__dirname, 'fixtures', 'uipath-sample');
const agentFixture = path.join(__dirname, 'fixtures', 'uipath-agent');
const solutionFixture = path.join(__dirname, 'fixtures', 'uipath-solution');

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

describe('detectDocType', () => {
  it('classifies a classic RPA project as an SDD', () => {
    expect(detectDocType(uipathFixture).docType).toBe('sdd');
  });

  it('classifies an agent.json project as an ADD (agentic)', () => {
    const result = detectDocType(agentFixture);
    expect(result.docType).toBe('add');
    expect(result.evidence.join(' ')).toMatch(/agent\.json/i);
  });
});

describe('discoverProjects (solution)', () => {
  it('returns a single project for a plain project folder', () => {
    const projects = discoverProjects(uipathFixture);
    expect(projects).toHaveLength(1);
    expect(isSolution(uipathFixture)).toBe(false);
  });

  it('discovers Dispatcher + Performer in a solution folder, Dispatcher first', () => {
    const projects = discoverProjects(solutionFixture);
    expect(projects).toHaveLength(2);
    expect(isSolution(solutionFixture)).toBe(true);
    expect(projects[0].name).toBe('Dispatcher'); // folder-name role wins, ordered first
    expect(projects[1].name).toBe('Performer');
  });
});
