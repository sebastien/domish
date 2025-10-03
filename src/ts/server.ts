import DOM from "./domish.js";
import XML from "./xmlish.js";
export default Object.assign(globalThis, { ...DOM, ...XML });