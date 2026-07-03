"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsers = void 0;
exports.parseProject = parseProject;
const uipath_1 = require("./uipath");
const powerAutomate_1 = require("./powerAutomate");
const blueprism_1 = require("./blueprism");
const automationAnywhere_1 = require("./automationAnywhere");
/** Parser registry keyed by platform. */
exports.parsers = {
    uipath: uipath_1.parseUiPath,
    powerAutomate: powerAutomate_1.parsePowerAutomate,
    blueprism: blueprism_1.parseBluePrism,
    automationAnywhere: automationAnywhere_1.parseAutomationAnywhere,
};
async function parseProject(platform, workingDir) {
    if (platform === 'unknown') {
        throw new Error('Could not detect the automation platform for this project. ' +
            'Point InstaDocs at the folder that contains the automation project files.');
    }
    return exports.parsers[platform](workingDir);
}
//# sourceMappingURL=index.js.map