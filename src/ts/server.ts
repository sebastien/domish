// Main code
let DOM: any, XML: any;

export default Object.assign(globalThis, { ...DOM, ...XML });

// Explicit imports at the end
import DOM_ from "./domish.js";
import XML_ from "./xmlish.js";

DOM = DOM_;
XML = XML_;