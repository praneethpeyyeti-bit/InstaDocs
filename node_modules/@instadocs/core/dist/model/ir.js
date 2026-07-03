"use strict";
/**
 * The Intermediate Representation (IR) — the keystone of InstaDocs.
 *
 * Every platform parser reads its native files and emits a `ProcessGraph`.
 * Every downstream stage (analyze / generate / export) consumes a
 * `ProcessGraph` and NEVER touches raw platform files. This is what makes the
 * pipeline platform-agnostic.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLATFORM_LABELS = void 0;
exports.emptyGraph = emptyGraph;
exports.PLATFORM_LABELS = {
    uipath: 'UiPath',
    powerAutomate: 'Power Automate',
    blueprism: 'Blue Prism',
    automationAnywhere: 'Automation Anywhere',
    unknown: 'Unknown',
};
/** Convenience: an empty graph a parser can start populating. */
function emptyGraph(platform, projectName) {
    return {
        platform,
        projectName,
        entryPoints: [],
        nodes: [],
        edges: [],
        variables: [],
        arguments: [],
        invocations: [],
        tryCatches: [],
        warnings: [],
    };
}
//# sourceMappingURL=ir.js.map