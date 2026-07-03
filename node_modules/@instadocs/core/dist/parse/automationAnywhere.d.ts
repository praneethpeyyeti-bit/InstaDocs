import { ProcessGraph } from '../model/ir';
/**
 * Automation Anywhere parser (initial depth).
 *
 * A11 bots (.json in A360) contain a `nodes`/`commands` list where each command
 * has a `commandName`/`packagePkg`. We map commands -> nodes sequentially.
 * Legacy .atmx (XML) is detected but not yet parsed in depth.
 */
export declare function parseAutomationAnywhere(workingDir: string): Promise<ProcessGraph>;
