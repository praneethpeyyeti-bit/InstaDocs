"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePdd = generatePdd;
const doc_1 = require("../model/doc");
/**
 * Build a complete Process Design Document (doc AST) from the analysis.
 *
 * Every section is populated *only* from the parsed source code / enrichment —
 * no template sample data is carried over. Sections of a classic PDD that
 * require human/business input (sign-off, contacts, ROI, SLAs, reporting, risk)
 * cannot be derived from code, so instead of fabricating values we list them
 * explicitly under "Sections requiring business input".
 */
function generatePdd(model, graph, generatedOn) {
    const blocks = [];
    // 1. Document Control — auto-generated provenance, not template placeholders.
    blocks.push((0, doc_1.h2)('1. Document Control'));
    blocks.push((0, doc_1.table)(['Version', 'Description', 'Author', 'Date'], [['1.0', 'Initial draft auto-generated from source code', 'InstaDocs', generatedOn]]));
    // 2. References — the actual source artifacts.
    blocks.push((0, doc_1.h2)('2. References'));
    blocks.push(referencesTable(graph));
    // 3. Introduction
    blocks.push((0, doc_1.h2)('3. Introduction'));
    blocks.push((0, doc_1.h3)('3.1 Purpose of the Document'));
    blocks.push((0, doc_1.p)(`This Process Design Document describes the automated process "${model.projectName}", ` +
        `implemented on ${model.platformLabel}. It was generated directly from the automation ` +
        `source code and reflects the process steps, business rules, inputs, outputs, and ` +
        `exceptions as implemented.`));
    blocks.push((0, doc_1.h3)('3.2 Objectives'));
    blocks.push((0, doc_1.p)(model.businessObjective));
    // 4. As-Is Process Overview
    blocks.push((0, doc_1.h2)('4. Process Overview'));
    blocks.push((0, doc_1.p)(model.summary));
    blocks.push((0, doc_1.h3)('4.1 Applications & Systems'));
    blocks.push(model.applications.length ? (0, doc_1.ul)(model.applications) : (0, doc_1.p)('No external applications were detected in the source.'));
    blocks.push((0, doc_1.h3)('4.2 Prerequisites'));
    blocks.push(prerequisites(graph));
    // 5. Detailed Process Steps
    blocks.push((0, doc_1.h2)('5. Detailed Process Steps'));
    blocks.push(model.steps.length
        ? (0, doc_1.table)(['#', 'Step', 'Description', 'Systems'], model.steps.map((s) => [String(s.order), s.title, s.description, s.systems.join(', ')]))
        : (0, doc_1.p)('No discrete steps were extracted from the source.'));
    // 6. Process Flow — ordered activity sequence straight from the graph.
    blocks.push((0, doc_1.h2)('6. Process Flow'));
    blocks.push(processFlow(graph));
    // 7. Inputs & Outputs
    blocks.push((0, doc_1.h2)('7. Inputs & Outputs'));
    blocks.push((0, doc_1.h3)('7.1 Inputs'));
    blocks.push(ioTable(model.inputs));
    blocks.push((0, doc_1.h3)('7.2 Outputs'));
    blocks.push(ioTable(model.outputs));
    // 8. Business Rules
    blocks.push((0, doc_1.h2)('8. Business Rules'));
    blocks.push(model.businessRules.length
        ? (0, doc_1.table)(['ID', 'Rule', 'Applies to'], model.businessRules.map((r) => [r.id, r.description, r.appliesTo ?? '—']))
        : (0, doc_1.p)('No explicit business rules (conditional branches) were found in the source.'));
    // 9. Exception Handling
    blocks.push((0, doc_1.h2)('9. Exception Handling'));
    blocks.push((0, doc_1.h3)('9.1 Business Exceptions'));
    blocks.push(exceptionTable(model.exceptions.filter((e) => e.category === 'business')));
    blocks.push((0, doc_1.h3)('9.2 System Exceptions'));
    blocks.push(exceptionTable(model.exceptions.filter((e) => e.category === 'system')));
    // 10. Assumptions
    blocks.push((0, doc_1.h2)('10. Assumptions'));
    blocks.push(model.assumptions.length ? (0, doc_1.ul)(model.assumptions) : (0, doc_1.p)('None.'));
    // 11. Scope
    blocks.push((0, doc_1.h2)('11. Scope'));
    blocks.push((0, doc_1.h3)('11.1 In Scope'));
    blocks.push(model.inScope.length ? (0, doc_1.ul)(model.inScope) : (0, doc_1.p)('Not specified in source.'));
    blocks.push((0, doc_1.h3)('11.2 Out of Scope'));
    blocks.push(model.outOfScope.length ? (0, doc_1.ul)(model.outOfScope) : (0, doc_1.p)('Not specified in source.'));
    // 12. Observations — parser diagnostics (unsupported activities, warnings).
    blocks.push((0, doc_1.h2)('12. Observations'));
    blocks.push(graph.warnings && graph.warnings.length ? (0, doc_1.ul)(graph.warnings) : (0, doc_1.p)('No parsing issues were reported.'));
    // 13. Transparency: what code cannot provide.
    blocks.push((0, doc_1.h2)('13. Sections Requiring Business Input'));
    blocks.push((0, doc_1.p)('The following standard PDD sections cannot be derived from source code and have been ' +
        'intentionally left out rather than populated with placeholder data. They require input ' +
        'from the Process Owner / SME:'));
    blocks.push((0, doc_1.ul)([
        'Sign-Off & Approvals',
        'Key Roles & Contacts',
        'Business Case & ROI (AHT, volumes, FTEs, value)',
        'Scheduling Requirements & SLAs',
        'Reporting Requirements',
        'Risk Mitigation Plan',
    ]));
    void doc_1.ol; // reserved for future ordered sections
    return {
        title: `Process Design Document — ${model.projectName}`,
        subtitle: `${model.platformLabel} automation`,
        meta: {
            Project: model.projectName,
            Platform: model.platformLabel,
            'Document version': '1.0',
            Status: 'Auto-generated draft',
            'Generated on': generatedOn,
            'Generated by': 'InstaDocs (from source code)',
        },
        blocks,
    };
}
function referencesTable(graph) {
    const rows = [];
    let n = 1;
    for (const e of graph.entryPoints)
        rows.push([String(n++), e, 'Entry point / main workflow']);
    const invoked = [...new Set(graph.invocations.map((i) => i.target))];
    for (const t of invoked)
        rows.push([String(n++), t, 'Invoked sub-workflow']);
    if (!rows.length)
        return (0, doc_1.p)('No source workflow files were identified.');
    return (0, doc_1.table)(['#', 'Artifact', 'Type'], rows);
}
function prerequisites(graph) {
    const items = [];
    items.push(`Platform runtime: ${graph.platform}`);
    if (graph.arguments.length)
        items.push(`${graph.arguments.length} process argument(s) must be supplied`);
    if (graph.variables.length)
        items.push(`${graph.variables.length} internal variable(s) used`);
    const invoked = new Set(graph.invocations.map((i) => i.target));
    if (invoked.size)
        items.push(`${invoked.size} dependent sub-workflow(s): ${[...invoked].join(', ')}`);
    return items.length ? (0, doc_1.ul)(items) : (0, doc_1.p)('No prerequisites were detected in the source.');
}
function processFlow(graph) {
    const meaningful = graph.nodes.filter((n) => ['assign', 'if', 'switch', 'loop', 'invoke', 'io', 'ui', 'throw', 'log'].includes(n.kind));
    const source = meaningful.length ? meaningful : graph.nodes;
    if (!source.length)
        return (0, doc_1.p)('No activities were extracted.');
    const items = source.slice(0, 80).map((n) => `(${n.kind}) ${n.displayName}`);
    if (source.length > 80)
        items.push(`… ${source.length - 80} more activities`);
    return (0, doc_1.ol)(items);
}
function ioTable(items) {
    if (!items.length)
        return (0, doc_1.p)('None.');
    return (0, doc_1.table)(['Name', 'Type', 'Description', 'Source/Destination'], items.map((i) => [i.name, i.type ?? '—', i.description, i.source ?? '—']));
}
function exceptionTable(items) {
    if (!items.length)
        return (0, doc_1.p)('None identified.');
    return (0, doc_1.table)(['Name', 'Trigger', 'Handling'], items.map((e) => [e.name, e.trigger, e.handling]));
}
//# sourceMappingURL=pdd.js.map