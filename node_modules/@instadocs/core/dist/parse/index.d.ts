import { Platform, ProcessGraph } from '../model/ir';
export type Parser = (workingDir: string) => Promise<ProcessGraph>;
/** Parser registry keyed by platform. */
export declare const parsers: Record<Exclude<Platform, 'unknown'>, Parser>;
export declare function parseProject(platform: Platform, workingDir: string): Promise<ProcessGraph>;
