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
exports.defaultPddTemplatePath = defaultPddTemplatePath;
exports.fillPddDocx = fillPddDocx;
const fs = __importStar(require("fs"));
const pizzip_1 = __importDefault(require("pizzip"));
const docxtemplater_1 = __importDefault(require("docxtemplater"));
const projectContext_1 = require("../context/projectContext");
const flowchart_1 = require("./flowchart");
const assets_1 = require("./assets");
const FLOWCHART_MARKER = 'INSTADOCS_FLOWCHART';
const EMU_PER_PX = 9525;
const MAX_IMG_WIDTH_PX = 600; // ~6.25in content width
/**
 * Fill the branded PDD Word template with code-derived data and return a .docx
 * buffer.
 *
 * `assets/pdd-template.docx` is a tagged + scrubbed copy of the corporate
 * `Templates/PDD.docx` (see `scripts/tag-pdd-template.js`): the code-derivable
 * tables carry `[[ ]]` loops, every other section's sample data is cleared, and
 * template guidance/emails are removed — so the output keeps the original
 * structure and styling while containing only source-derived content.
 */
function defaultPddTemplatePath() {
    return (0, assets_1.resolveAsset)('pdd-template.docx');
}
function fillPddDocx(model, graph, generatedOn, templatePath = defaultPddTemplatePath()) {
    const zip = new pizzip_1.default(fs.readFileSync(templatePath));
    const doc = new docxtemplater_1.default(zip, {
        delimiters: { start: '[[', end: ']]' },
        paragraphLoop: true,
        linebreaks: true,
        nullGetter: () => '',
    });
    const data = buildData(model, graph, generatedOn);
    doc.render(data);
    // Embed the two process-map images directly into the rendered zip (reliable
    // OOXML, no third-party image module).
    const outZip = doc.getZip();
    ensurePngContentType(outZip);
    // Both process maps use the same swimlane (application-segregated) format.
    const swimlane = (0, flowchart_1.renderSwimlane)(graph);
    embedImage(outZip, `${FLOWCHART_MARKER}_ASIS`, 'instadocs-asis.png', swimlane, 9001);
    embedImage(outZip, `${FLOWCHART_MARKER}_TOBE`, 'instadocs-tobe.png', swimlane, 9101);
    // Embed any UI screenshots referenced by keystroke steps.
    embedScreenshots(outZip, data.__screenshots);
    return outZip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}
function ensurePngContentType(zip) {
    const ctPath = '[Content_Types].xml';
    let ct = zip.file(ctPath).asText();
    if (!/Extension="png"/i.test(ct)) {
        ct = ct.replace('</Types>', '<Default Extension="png" ContentType="image/png"/></Types>');
        zip.file(ctPath, ct);
    }
}
/**
 * Swap every `marker` run for a picture <w:drawing> referencing `png`: add the
 * media file, a relationship, and the drawing XML (unique docPr ids from `idBase`).
 */
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
        `<wp:docPr id="${id}" name="ProcessFlowchart${id}"/>` +
        `<wp:cNvGraphicFramePr><a:graphicFrameLocks ` +
        `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
        `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
        `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
        `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
        `<pic:nvPicPr><pic:cNvPr id="${id}" name="ProcessFlowchart${id}"/><pic:cNvPicPr/></pic:nvPicPr>` +
        `<pic:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
        `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
        `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
        `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>`);
}
/** Scale an image to fit the given content width (px). */
function fitToPage(width, height, maxW = MAX_IMG_WIDTH_PX) {
    if (width <= maxW)
        return [width, height];
    const scale = maxW / width;
    return [Math.round(width * scale), Math.round(height * scale)];
}
/** Read PNG pixel dimensions from the IHDR chunk. */
function pngSize(buf) {
    if (buf.length < 24 || buf.toString('ascii', 12, 16) !== 'IHDR')
        return undefined;
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}
/** Embed each captured UI screenshot into its keystroke-step description cell. */
function embedScreenshots(zip, shots) {
    if (!shots || !shots.length)
        return;
    shots.forEach((s, i) => {
        const png = Buffer.from(s.base64, 'base64');
        const dim = pngSize(png) ?? { width: 260, height: 170 };
        embedImage(zip, s.marker, `instadocs-shot-${i}.png`, { png, width: dim.width, height: dim.height }, 9200 + i * 10, 260);
    });
}
function buildData(model, graph, generatedOn) {
    const ctx = graph.projectContext;
    // Map original activity display names to their UI screenshot (if any).
    const shotByName = new Map();
    for (const n of graph.nodes) {
        if (typeof n.raw?.screenshot === 'string')
            shotByName.set(n.displayName, n.raw.screenshot);
    }
    const screenshots = [];
    const steps = model.steps.map((s) => {
        let desc = s.description;
        const shot = shotByName.get(s.title); // s.title is the raw (un-humanized) name
        if (shot) {
            const marker = `INSTADOCS_SHOT_${screenshots.length}`;
            screenshots.push({ marker, base64: shot });
            desc = `${desc}\n${marker}`;
        }
        return { i: s.order, title: humanizeLabel(s.title), systems: s.systems.join(', '), desc };
    });
    return {
        __screenshots: screenshots,
        processName: model.projectName,
        functionArea: `${model.platformLabel} Automation`,
        businessObjective: ctx?.overview?.description
            ? `${model.businessObjective} ${ctx.overview.description}`
            : model.businessObjective,
        summary: model.summary,
        versions: [
            {
                version: '1.0',
                description: 'Initial draft auto-generated from source code',
                status: 'Draft',
                author: 'InstaDocs',
                date: generatedOn,
            },
        ],
        refs: buildReferences(),
        abbreviations: buildAbbreviations(model.platformLabel),
        prereqs: buildPrerequisites(ctx),
        businessCase: buildBusinessCase(model, ctx),
        asIs: buildAsIsOverview(model, graph, ctx),
        applications: buildApplications(model, ctx),
        io: buildProcessIO(model, graph),
        deliveryDocs: buildDeliveryDocs(model.projectName),
        steps,
        businessExc: buildBusinessExceptions(model, graph),
        systemExc: buildSystemExceptions(model, graph),
        libraries: buildLibraries(ctx),
        businessRules: model.businessRules.map((r) => ({
            id: r.id,
            description: r.appliesTo ? `${r.description} (applies to: ${r.appliesTo})` : r.description,
        })),
    };
}
// ---- References: external docs only (SOP, recordings) — never .xaml files ----
function buildReferences() {
    return [
        { num: 1, name: 'Process walkthrough recording', purpose: 'Link to the recorded process demo (attach if available).' },
        { num: 2, name: 'Standard Operating Procedure (SOP)', purpose: 'Existing SOP / work instruction for the manual process (attach if applicable).' },
    ];
}
function buildAbbreviations(platformLabel) {
    const base = [
        ['RPA', 'Robotic Process Automation'],
        ['PDD', 'Process Design Document'],
        ['SDD', 'Solution Design Document'],
        ['SME', 'Subject Matter Expert'],
        ['SLA', 'Service Level Agreement'],
        ['KPI', 'Key Performance Indicator'],
        ['AHT', 'Average Handling Time'],
        ['UAT', 'User Acceptance Testing'],
        ['UI', 'User Interface'],
        ['FTE', 'Full-Time Equivalent'],
    ];
    if (/uipath/i.test(platformLabel))
        base.push(['XAML', 'Workflow file format used by UiPath Studio']);
    return base.map(([term, desc], i) => ({ i: i + 1, term, desc, remark: '' }));
}
function buildPrerequisites(ctx) {
    const depList = ctx?.dependencies.length
        ? ctx.dependencies.map((d) => d.package).join(', ')
        : 'the applications listed under Applications Used';
    const rows = [
        ['Access for Developer on System', 'Access for the bot and developer to all in-scope applications must be provisioned before development starts.', 'RPA BA'],
        ['PDD Approvals', 'Sign-off on this PDD from the SME and Process Owner before development commences.', 'RPA BA'],
        ['Test Data', 'Representative test data available in Dev/Test covering the happy path and each exception path.', 'SME'],
        ['Environment & Application', `Applications, versions, file locations and access methods must match across Dev/Test/Prod. Required packages: ${depList}.`, 'IT'],
        ['Templates', 'Excel/Email templates the process depends on are finalized and available at the agreed location.', 'SME'],
        ['Potential Change', 'Any change to steps or applications must be notified to RPA support for maintenance of the automation.', 'Process Owner'],
    ];
    return rows.map(([category, desc, owner], i) => ({ i: i + 1, category, desc, owner }));
}
function capabilities(model) {
    const caps = new Set(['Core RPA']);
    for (const a of model.applications) {
        if (/excel/i.test(a))
            caps.add('Excel automation');
        else if (/email|mail|outlook/i.test(a))
            caps.add('Email');
        else if (/ui|desktop|web|browser/i.test(a))
            caps.add('UI automation');
        else if (/api|http/i.test(a))
            caps.add('API integration');
        else if (/database|sql/i.test(a))
            caps.add('Database');
    }
    return [...caps].join(', ');
}
function buildBusinessCase(model, ctx) {
    void ctx;
    const rows = [
        ['Avg. Handling Time (AHT)', 'Average manual time to complete one transaction', 'To be provided by SME'],
        ['Annual Volume', 'Number of transactions handled per year', 'To be provided by SME'],
        ['Automation Potential %', 'Proportion of the process that can be automated', ''],
        ['Potential Time Save (Annually)', 'Estimated hours saved after automation', ''],
        ['RPA Capabilities/Components Used', capabilities(model), 'Derived from source dependencies'],
    ];
    return rows.map(([item, desc, remark], i) => ({ i: i + 1, item, desc, pre: '', post: '', remark }));
}
function buildAsIsOverview(model, graph, ctx) {
    const desc = ctx?.overview?.description || model.summary;
    const apps = model.applications.join(', ') || 'See Applications Used';
    // Upstream/downstream automation dependencies are not derivable from the
    // workflow itself — leave blank for the SME (these are NOT sub-processes).
    const rows = [
        ['Process full name', model.projectName],
        ['Process area', ctx?.overview?.type || 'RPA-automated process'],
        ['Process short description', desc],
        ['Applications used', apps],
        ['Dependencies: Upstream (other automations feeding this process)', ''],
        ['Dependencies: Downstream (automations that consume this output)', ''],
        ['Input data', 'See Input and Output Data section'],
        ['Output data', 'See Input and Output Data section'],
        ['Process frequency', 'To be provided by SME'],
        ['Transaction volume', 'To be provided by SME'],
        ['Average handling time (AHT)', 'To be provided by SME'],
        ['Number of FTEs', 'To be provided by SME'],
        ['Process SLAs', 'To be provided by SME'],
    ];
    return rows.map(([item, d], i) => ({ i: i + 1, item, desc: d }));
}
function clientType(app) {
    if (/excel|outlook|email|mail|word|sap/i.test(app))
        return 'Thick';
    if (/web|api|http|browser|salesforce/i.test(app))
        return 'Thin';
    return '';
}
function readWrite(category) {
    if (!category)
        return 'Read/Write';
    if (/data/i.test(category))
        return 'Read/Write';
    if (/comm/i.test(category))
        return 'Write (send)';
    return 'Read';
}
function buildApplications(model, ctx) {
    const rows = [];
    const seen = new Set();
    for (const d of ctx?.dependencies ?? []) {
        const app = (0, projectContext_1.packageToApp)(d.package);
        if (!app || seen.has(app))
            continue;
        seen.add(app);
        rows.push({
            name: `${app} (${d.package}${d.version ? ` ${d.version}` : ''})`,
            description: d.description || readWrite(d.category),
            language: '',
            client: clientType(app),
            environment: '',
            poc: '',
        });
    }
    // Activity-inferred apps not already covered by dependencies.
    for (const a of model.applications) {
        if ([...seen].some((s) => s.toLowerCase().includes(a.toLowerCase())))
            continue;
        seen.add(a);
        rows.push({ name: a, description: 'Read/Write', language: '', client: clientType(a), environment: '', poc: '' });
    }
    return rows.map((r, i) => ({ i: i + 1, ...r }));
}
// Process-level inputs/outputs (daily run data), NOT workflow arguments.
function buildProcessIO(model, graph) {
    // Prefer the analyst-authored, process-level inputs/outputs when available
    // (these are run-data items, not workflow arguments — per the section rules).
    const authored = [
        ...model.inputs.map((x) => ({ source: x.source || x.name, direction: 'Input', desc: `${x.name} — ${x.description}` })),
        ...model.outputs.map((x) => ({ source: x.source || x.name, direction: 'Output', desc: `${x.name} — ${x.description}` })),
    ];
    if (authored.length)
        return authored.map((x, i) => ({ i: i + 1, ...x }));
    const names = graph.nodes.map((n) => n.displayName);
    const has = (re) => names.some((n) => re.test(n));
    const io = [];
    if (has(/read|get|excel|queue|input|fetch|download/i)) {
        io.push({ source: 'Input files / source system', direction: 'Input', desc: 'Records the process reads at the start of each run (e.g. the pending-items workbook or queue).' });
    }
    io.push({ source: 'Business applications', direction: 'Input', desc: 'Live data read from the applications used during processing.' });
    if (has(/mail|email|send|notif/i)) {
        io.push({ source: 'Email', direction: 'Output', desc: 'Confirmation and exception notification emails sent per transaction / run.' });
    }
    if (has(/write|report|export|save|output/i)) {
        io.push({ source: 'Output report', direction: 'Output', desc: 'Processed-item report produced by the run.' });
    }
    io.push({ source: 'Execution & exception log', direction: 'Output', desc: 'Per-run processing log and list of exceptions for monitoring.' });
    return io.map((x, i) => ({ i: i + 1, ...x }));
}
function buildDeliveryDocs(project) {
    const safe = project.replace(/[^a-z0-9._-]+/gi, '_');
    return [
        {
            i: 1,
            name: `${safe}-TestCases.xlsx`,
            location: 'Delivered in the same output folder as this PDD',
            desc: 'UAT test case document auto-generated by InstaDocs from the workflow logic.',
        },
    ];
}
function buildBusinessExceptions(model, graph) {
    const mail = graph.nodes.some((n) => /mail|email|send|notif/i.test(n.displayName))
        ? 'Notification email sent to the business (recipient per configuration).'
        : '';
    const rows = model.exceptions
        .filter((e) => e.category === 'business')
        .map((e) => ({ step: e.name, desc: `${e.trigger} ${e.handling}`.trim(), email: mail }));
    if (!rows.length) {
        rows.push({
            step: 'Business validation',
            desc: 'No explicit business exceptions were found in the source; business-rule violations should be defined by the SME.',
            email: '',
        });
    }
    return rows.map((r, i) => ({ i: i + 1, ...r }));
}
function buildSystemExceptions(model, graph) {
    const mail = graph.nodes.some((n) => /mail|email|send|notif/i.test(n.displayName))
        ? 'System-exception alert email sent to the support team.'
        : '';
    const apps = model.applications.join(', ') || 'the target applications';
    const rows = [
        { step: 'Application launch / login', desc: `${apps} did not respond or failed to launch. The robot retries; if unresolved it logs the error and raises a system exception.`, email: mail },
        { step: 'UI interaction', desc: 'A screen element / selector could not be found (application slow or UI changed). The transaction is marked failed and logged for review.', email: '' },
        { step: 'Input file access', desc: 'The input file was missing, locked, or in an unexpected format. The run stops with a logged system exception.', email: '' },
    ];
    for (const t of graph.tryCatches) {
        rows.push({
            step: (t.handlerSummary || 'Handled step')
                .replace(/^Try\/Catch in /, 'Protected step in ')
                .replace(/\.xaml/gi, '')
                .replace(/\bMain\b/, 'the main process'),
            desc: 'A protected step failed at runtime; the error is caught, logged, and the item is marked as a system exception for review.',
            email: '',
        });
    }
    return rows.map((r, i) => ({ i: i + 1, ...r }));
}
function buildLibraries(ctx) {
    if (!ctx?.dependencies.length)
        return [];
    return ctx.dependencies.map((d) => ({
        name: d.package,
        version: d.version ? ` (${d.version})` : '',
        purpose: d.description || d.category || 'UiPath activity package',
    }));
}
/** Convert technical activity names to business-readable phrasing. */
function humanizeLabel(text) {
    let t = text;
    // Strip framework wrappers first: "Invoke X workflow" -> "X", "... .xaml" -> "...".
    t = t.replace(/^Invoke\s+/i, '').replace(/\s+workflow$/i, '').replace(/\.xaml\b/i, '');
    // Generic API/technical activity names -> business phrasing.
    t = t.replace(/^HTTP\s*Request\b\s*(?:--|-)?\s*/i, (m, ...r) => /(?:--|-)/.test(m) ? 'Exchange data — ' : 'Exchange data with the connected system');
    t = t.replace(/\bcurrent[A-Za-z]*\b/g, 'record'); // "For each currentJToken" -> "For each record"
    t = t.replace(/^Type\s*Into\b/i, 'Enter data into').replace(/^Type\b/i, 'Enter');
    t = t.replace(/^Click\b/i, 'Select');
    t = t.replace(/^Get\s*Text\b/i, 'Capture').replace(/^GetText\b/i, 'Capture');
    t = t.replace(/^Read\s*Range\b/i, 'Retrieve records from').replace(/^Read\b/i, 'Retrieve');
    t = t.replace(/^Write\s*(Range|Line|Cell)?\b/i, 'Record');
    t = t.replace(/Send\s*Mail\b/i, 'Send notification').replace(/SendMail/i, 'Send notification');
    t = t.replace(/^Log\s*Message\b/i, 'Record log').replace(/^LogMessage/i, 'Record log');
    t = t.replace(/^For\s*Each\b/i, 'For each');
    t = t.replace(/^If\b/i, 'Check whether');
    t = t.replace(/^Throw\b/i, 'Raise exception:');
    return t.replace(/\s+/g, ' ').trim();
}
//# sourceMappingURL=pddTemplate.js.map