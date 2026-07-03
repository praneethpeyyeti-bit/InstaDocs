import { Platform } from '../model/ir';
export interface DetectionResult {
    platform: Platform;
    confidence: number;
    scores: Record<Platform, number>;
    /** Human-readable evidence for why this platform was picked. */
    evidence: string[];
}
/**
 * Signature-based platform detection. Fast and deterministic: score each
 * platform by the presence of characteristic files/markers, pick the winner.
 */
export declare function detectPlatform(workingDir: string): DetectionResult;
