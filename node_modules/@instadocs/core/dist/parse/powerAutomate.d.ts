import { ProcessGraph } from '../model/ir';
/**
 * Power Automate parser (initial depth).
 *
 * A cloud flow's `definition.json` holds `triggers` and `actions` objects; each
 * action's `runAfter` map defines control-flow edges. We map actions -> nodes
 * and runAfter -> edges. Desktop flows (.txt) are not yet parsed.
 */
export declare function parsePowerAutomate(workingDir: string): Promise<ProcessGraph>;
