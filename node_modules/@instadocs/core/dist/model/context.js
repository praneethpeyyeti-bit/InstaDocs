"use strict";
/**
 * ProjectContext — the parsed output of the UiPath `uipath-project-discovery-agent`.
 *
 * The discovery agent (part of the `uipath-rpa` skill) returns a ≤200-line
 * markdown "Project Context" document which the skill writes to `AGENTS.md`
 * (between PROJECT-CONTEXT markers) and `.claude/rules/project-context.md`.
 * InstaDocs *consumes* that artifact to enrich the PDD with authoritative,
 * code-derived project context it cannot infer from XAML alone.
 */
Object.defineProperty(exports, "__esModule", { value: true });
//# sourceMappingURL=context.js.map