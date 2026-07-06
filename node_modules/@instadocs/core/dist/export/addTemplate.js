"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultAddTemplatePath = defaultAddTemplatePath;
exports.fillAddDocx = fillAddDocx;
const fs = __importStar(require("fs"));
const pizzip_1 = __importDefault(require("pizzip"));
const docxtemplater_1 = __importDefault(require("docxtemplater"));
const flowchart_1 = require("./flowchart");
const assets_1 = require("./assets");
const FLOW_MARKER = 'INSTADOCS_AGENT_FLOW';
const ECO_MARKER = 'INSTADOCS_AGENT_ECO';
const EMU_PER_PX = 9525;
const MAX_IMG_WIDTH_PX = 600;
/**
 * Fill the branded Agentic Design Document (ADD) Word template with LLM/source-
 * derived data and return a .docx buffer.
 *
 * `assets/add-template.docx` is a tagged + scrubbed copy of the corporate
 * `Templates/ADD.docx` (see `scripts/tag-add-template.js`): control tables carry
 * `[[ ]]` loops, prose sections are `[[ ]]` fields, and two diagram markers
 * (agentic ecosystem + agent lifecycle) are embedded from the parsed AgentSpec.
 */
function defaultAddTemplatePath() {
    return (0, assets_1.resolveAsset)('add-template.docx');
}
function fillAddDocx(model, graph, generatedOn, templatePath = defaultAddTemplatePath()) {
    const zip = new pizzip_1.default(fs.readFileSync(templatePath));
    const doc = new docxtemplater_1.default(zip, {
        delimiters: { start: '[[', end: ']]' },
        paragraphLoop: true,
        linebreaks: true,
        nullGetter: () => '',
    });
    doc.render(buildData(model, generatedOn));
    const outZip = doc.getZip();
    ensurePngContentType(outZip);
    const agentName = model.agentName || graph.agent?.name || model.projectName;
    embedImage(outZip, ECO_MARKER, 'instadocs-agent-eco.png', (0, flowchart_1.renderAgenticEcosystem)(agentName, graph.agent), 9401);
    embedImage(outZip, FLOW_MARKER, 'instadocs-agent-flow.png', (0, flowchart_1.renderAgenticFlow)(agentName, graph.agent), 9501);
    return outZip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}
function buildData(model, generatedOn) {
    const orDash = (arr, make) => (arr.length ? arr : [make()]);
    const withNum = (rows) => rows.map((r, i) => ({ ...r, num: i + 1 }));
    return {
        projectName: model.projectName,
        agentName: model.agentName,
        platformLabel: model.platformLabel,
        generatedOn,
        // Control tables.
        versionHistory: orDash(model.versionHistory.length
            ? model.versionHistory
            : [{ version: '0.1', description: 'Initial draft auto-generated from source', status: 'Draft', changedBy: 'InstaDocs', approvedBy: '', date: generatedOn }], () => ({ version: '', description: '', status: '', changedBy: '', approvedBy: '', date: '' })),
        signOff: withNum(orDash(model.signOff, () => ({ role: '', nameEmail: 'To be completed by SME', department: 'To be completed by SME', signature: '', date: '' }))),
        abbreviations: withNum(orDash(model.abbreviations, () => ({ term: '', description: '', remarks: '' }))),
        // Prose sections.
        introOverview: model.introOverview,
        purposeScope: model.purposeScope,
        objectives: model.objectives,
        constraintsAssumptions: model.constraintsAssumptions,
        architectureOverview: model.architectureOverview,
        agenticEcosystem: model.agenticEcosystem,
        highLevelFlow: model.highLevelFlow,
        designSpecOverview: model.designSpecOverview,
        agentRoleGoals: model.agentRoleGoals,
        ioSchema: model.ioSchema,
        toolsIntegrations: model.toolsIntegrations,
        contextKnowledge: model.contextKnowledge,
        humanInLoop: model.humanInLoop,
        modelConfigOverview: model.modelConfigOverview,
        llmModels: model.llmModels,
        guardrails: model.guardrails,
        evaluationSettings: model.evaluationSettings,
        devOverview: model.devOverview,
        studioWebOverview: model.studioWebOverview,
        workspacePanels: model.workspacePanels,
        testingPlayground: model.testingPlayground,
        evalOverview: model.evalOverview,
        evalSets: model.evalSets,
        agentScoring: model.agentScoring,
        autopilot: model.autopilot,
        monitoringTracing: model.monitoringTracing,
        deployOverview: model.deployOverview,
        environments: model.environments,
        maestroIntegration: model.maestroIntegration,
        securityGovernance: model.securityGovernance,
        opsOverview: model.opsOverview,
        monitoringHealth: model.monitoringHealth,
        selfHealing: model.selfHealing,
        versioningUpdates: model.versioningUpdates,
        complianceOverview: model.complianceOverview,
        dataResidency: model.dataResidency,
        trustLayer: model.trustLayer,
        escalationControls: model.escalationControls,
        nfrOverview: model.nfrOverview,
        performance: model.performance,
        scalability: model.scalability,
        reliability: model.reliability,
        maintainability: model.maintainability,
        usability: model.usability,
        references: model.references,
        appendix: model.appendix,
    };
}
function ensurePngContentType(zip) {
    const ctPath = '[Content_Types].xml';
    const ct = zip.file(ctPath).asText();
    if (!/Extension="png"/i.test(ct)) {
        zip.file(ctPath, ct.replace('</Types>', '<Default Extension="png" ContentType="image/png"/></Types>'));
    }
}
function embedImage(zip, marker, mediaName, image, idBase, maxWidthPx = MAX_IMG_WIDTH_PX) {
    let docXml = zip.file('word/document.xml').asText();
    if (!docXml.includes(marker))
        return;
    const [wPx, hPx] = fitToPage(image.width, image.height, maxWidthPx);
    const cx = Math.round(wPx * EMU_PER_PX);
    const cy = Math.round(hPx * EMU_PER_PX);
    zip.file(`word/media/${mediaName}`, image.png);
    const relsPath = 'word/_rels/document.xml.rels';
    const rId = `rIdInsta_${mediaName.replace(/[^a-z0-9]/gi, '')}`;
    let rels = zip.file(relsPath).asText();
    if (!rels.includes(rId)) {
        rels = rels.replace('</Relationships>', `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${mediaName}"/></Relationships>`);
        zip.file(relsPath, rels);
    }
    let n = 0;
    docXml = docXml.replace(new RegExp(`<w:t[^>]*>${marker}</w:t>`, 'g'), () => drawingXml(rId, cx, cy, idBase + n++));
    zip.file('word/document.xml', docXml);
}
function drawingXml(rId, cx, cy, id) {
    return (`<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0" ` +
        `xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">` +
        `<wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>` +
        `<wp:docPr id="${id}" name="AgentDiagram${id}"/>` +
        `<wp:cNvGraphicFramePr><a:graphicFrameLocks ` +
        `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
        `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
        `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
        `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
        `<pic:nvPicPr><pic:cNvPr id="${id}" name="AgentDiagram${id}"/><pic:cNvPicPr/></pic:nvPicPr>` +
        `<pic:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
        `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
        `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
        `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>`);
}
function fitToPage(width, height, maxW = MAX_IMG_WIDTH_PX) {
    if (width <= maxW)
        return [width, height];
    const scale = maxW / width;
    return [Math.round(width * scale), Math.round(height * scale)];
}
//# sourceMappingURL=addTemplate.js.map