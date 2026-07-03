import { Platform, ProcessGraph } from '../model/ir';
import { parseUiPath } from './uipath';
import { parsePowerAutomate } from './powerAutomate';
import { parseBluePrism } from './blueprism';
import { parseAutomationAnywhere } from './automationAnywhere';

export type Parser = (workingDir: string) => Promise<ProcessGraph>;

/** Parser registry keyed by platform. */
export const parsers: Record<Exclude<Platform, 'unknown'>, Parser> = {
  uipath: parseUiPath,
  powerAutomate: parsePowerAutomate,
  blueprism: parseBluePrism,
  automationAnywhere: parseAutomationAnywhere,
};

export async function parseProject(
  platform: Platform,
  workingDir: string
): Promise<ProcessGraph> {
  if (platform === 'unknown') {
    throw new Error(
      'Could not detect the automation platform for this project. ' +
        'Point InstaDocs at the folder that contains the automation project files.'
    );
  }
  return parsers[platform](workingDir);
}
