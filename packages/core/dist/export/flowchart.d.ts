import { ProcessGraph, ProcessNode } from '../model/ir';
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
export declare function renderFlowchart(graph: ProcessGraph): FlowchartImage;
/** Convert a technical activity name to a business-readable label. */
export declare function businessLabel(text: string): string;
/** Group a node under the application/system swimlane it belongs to. */
export declare function laneOf(n: ProcessNode): string;
export declare function renderSwimlane(graph: ProcessGraph): FlowchartImage;
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
