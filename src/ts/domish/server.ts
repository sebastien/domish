// Explicit imports at the top to avoid temporal dead zone issues
import DOM from "./domish.js";
import XML from "./xmlish.js";

// Main code
export default Object.assign(globalThis, { ...DOM, ...XML });

// EOF
