// Project: DOMIsh
// Author:  Sebastien Pierre
// License: Revised BSD License
// Created: 2022-04-21

// Module: server
// Server-side entry point for DOMIsh. Imports and re-exports all DOM and XML
// functionality, then assigns them to globalThis to provide a browser-like
// environment in Node.js or other server-side JavaScript environments.
//
// Example:
// ```typescript
// import "@littleworkshop/domish/server";
// // Now globalThis.document and all DOM classes are available
// const div = document.createElement("div");
// ```

import DOM from "./domish.js";
import XML from "./xmlish.js";

// Main code
export default Object.assign(globalThis, { ...DOM, ...XML });

// EOF
