import { describe, expect, it } from 'vitest';
import * as path from 'path';
import { loadProjectContext, dependenciesToApplications } from '../src/context/projectContext';

const fixture = path.join(__dirname, 'fixtures', 'uipath-sample');
const plain = path.join(__dirname, 'fixtures', 'plain');

describe('loadProjectContext', () => {
  it('loads and parses the AGENTS.md PROJECT-CONTEXT block', () => {
    const ctx = loadProjectContext(fixture);
    expect(ctx).toBeDefined();
    expect(ctx!.source).toBe('AGENTS.md');
    expect(ctx!.overview?.expressionLanguage).toBe('VisualBasic');
    expect(ctx!.overview?.description).toMatch(/invoices/i);

    expect(ctx!.dependencies.map((d) => d.package)).toEqual(
      expect.arrayContaining([
        'UiPath.Excel.Activities',
        'UiPath.Mail.Activities',
        'UiPath.System.Activities',
      ])
    );
    expect(ctx!.entryPoints[0].file).toBe('Main.xaml');
    expect(ctx!.keyWorkflows.map((w) => w.workflow)).toContain('PostToFinance.xaml');
    expect(ctx!.conventions.length).toBeGreaterThan(0);
    expect(ctx!.architecture).toMatch(/dispatcher/i);
  });

  it('returns undefined when no context document exists', () => {
    expect(loadProjectContext(plain)).toBeUndefined();
  });
});

describe('dependenciesToApplications', () => {
  it('maps UiPath packages to business applications', () => {
    const apps = dependenciesToApplications([
      { package: 'UiPath.Excel.Activities' },
      { package: 'UiPath.Mail.Activities' },
      { package: 'UiPath.System.Activities' },
    ]);
    expect(apps).toEqual(expect.arrayContaining(['MS Excel', 'Email (Outlook/SMTP)']));
  });
});
