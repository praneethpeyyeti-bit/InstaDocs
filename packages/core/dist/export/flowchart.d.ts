import { ProcessGraph, StateMachineIR } from '../model/ir';
import { AgentSpec } from '../model/agent';
/**
 * Render the process as a colored flowchart image (PNG) straight from the
 * ProcessGraph. Each activity becomes a colored shape (process rectangle,
 * decision diamond, start/end terminator) connected top-to-bottom by arrows.
 *
 * We draw an SVG we fully control, then rasterize to PNG with resvg (no
 * browser). The same image is used for the As-Is high-level and To-Be
 * functional process-map sections.
 */
export interface FlowchartImage {
    png: Buffer;
    /** Logical size in px — used to size the picture in the Word document. */
    width: number;
    height: number;
}
/** Convert a technical activity name to a business-readable label. */
export declare function businessLabel(text: string): string;
/**
 * THE single decision point for a project's process-design diagram. Both the SDD
 * exporter and any test call this, so a project always renders the same way with
 * no per-project tuning:
 *   1. real parsed StateMachine  -> code-derived state chart
 *   2. REFramework (by layout/keyword) -> state swimlane from high-level steps
 *   3. everything else (Flowchart/Sequence) -> high-level technical flow
 * `steps` are the project's high-level business steps (LLM or derived); only the
 * REFramework-without-a-parsed-machine branch needs them.
 */
export declare function renderEntryDiagram(projectName: string, graph: ProcessGraph, steps?: string[]): FlowchartImage;
/** True when the project is built on the UiPath REFramework (state machine). */
export declare function isReframework(graph: ProcessGraph): boolean;
/**
 * Render the four REFramework states (Initialize, Get Transaction Data, Process
 * Transaction, End Process) as a labelled state-machine diagram — the standard
 * technical process-design view for a REFramework solution.
 */
export declare function renderReframeworkStates(): FlowchartImage;
export interface ArchSystem {
    name: string;
    method?: string;
}
/**
 * Render a component/architecture diagram: the automation (centre) connected to
 * the Orchestrator (top) and each external system (right column), with the
 * access method labelled on the connector.
 */
export declare function renderArchitecture(projectName: string, systems: ArchSystem[]): FlowchartImage;
/**
 * Render the high-level AI Agent lifecycle: an Orchestrator/Maestro band on top,
 * a vertical spine (Trigger → Agent → Guardrails → Output), the agent's tools
 * and knowledge as a reasoning loop on the right, and a human-in-the-loop
 * escalation branch. Content is grounded in the parsed AgentSpec.
 */
export declare function renderAgenticFlow(agentName: string, spec?: AgentSpec): FlowchartImage;
/**
 * Render the agentic ecosystem: the AI Agent at the centre, connected to the
 * Orchestrator/Maestro (top) and the tools, knowledge sources, escalation
 * targets and RPA/API integrations it collaborates with (right column).
 */
export declare function renderAgenticEcosystem(agentName: string, spec?: AgentSpec): FlowchartImage;
export declare function renderProcessFlow(graph: ProcessGraph): FlowchartImage;
/** True when we have enough high-level steps to draw a meaningful flow. */
export declare function hasHighLevelSteps(steps: string[] | undefined): boolean;
/**
 * Render a clean, numbered high-level process flow (Start → business steps →
 * End). Deliberately concise — one box per high-level step, labels wrap.
 */
export declare function renderHighLevelFlow(title: string, stepsIn: string[]): FlowchartImage;
/**
 * Render a high-level technical flow of the entry workflow: Start → categorized
 * steps (UI action, data I/O, decision, loop, sub-process, notify) → End, with
 * an "error handling" band when the workflow is wrapped in Try/Catch. This is the
 * readable alternative to a per-activity flowchart full of datatype noise.
 */
export declare function renderTechnicalFlow(title: string, graph: ProcessGraph): FlowchartImage;
/** Render the real parsed state machine of a project as a diagram. */
export declare function renderStateMachine(title: string, sm: StateMachineIR): FlowchartImage;
/** One REFramework project's high-level flow as a 4-column state swimlane. */
export declare function renderPartitionedFlow(title: string, steps: string[]): FlowchartImage;
/**
 * Two+ projects (dispatcher/performer): one high-level diagram per project,
 * stacked. REFramework projects render as a 4-column state swimlane; plain
 * Flowchart/Sequence projects render as a linear high-level flow.
 */
export declare function renderPartitionedFlows(flows: {
    project: string;
    steps: string[];
    reframework?: boolean;
    stateMachine?: StateMachineIR;
}[]): FlowchartImage;
