// Project: DOMIsh
// Author:  Sebastien Pierre
// License: Revised BSD License
// Created: 2022-04-21

// Module: markish
// Converts HTML/XML DOM nodes to Markdown format. Supports common elements
// like headings, lists, links, images, tables, and code blocks. Processes
// element tree recursively with context tracking for nested structures.
//
// Example:
// ```typescript
// const md = markdown(doc.body);
// console.log(md); // "# Heading\n\nParagraph text"
// ```

const Space = Symbol.for("Space");
const LineBreak = Symbol.for("LineBreak");

// ----------------------------------------------------------------------------
//
// INTERNAL FUNCTIONS
//
// ----------------------------------------------------------------------------
// ============================================================================
// SUBSECTION: Text Processing
// ============================================================================

// Function: strip
// Normalizes whitespace in `text` by replacing all whitespace sequences with
// a single space and trimming.
function strip(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}

// Function: derive
// Creates a new object that inherits from `object` with `data` as own properties.
// Used for creating context objects that inherit from parent contexts.
function derive(object: any, data: any = {}): any {
	return Object.assign(Object.create(object), data);
}

// ----------------------------------------------------------------------------
//
// MARKDOWN GENERATOR
//
// ----------------------------------------------------------------------------
// ============================================================================
// SUBSECTION: imarkdown
// ============================================================================

// Function: imarkdown
// Generator that yields markdown tokens from a DOM node. Handles element types
// like headings, lists, links, code blocks, and tables. Yields Space and LineBreak
// symbols for formatting control.
//
// Parameters:
// - node: any - the DOM node to convert
// - context: any - optional context object for tracking nested structure state
function* imarkdown(node: any, context: any = {}): Generator<any> {
	if (!node) {
		// Nothing
	} else if (Array.isArray(node)) {
		for (const _ of node) {
			yield* imarkdown(_, context);
		}
	} else {
		let suffix: string | undefined;
		let children = node.childNodes;
		const name = (node.nodeName ?? "").toLowerCase();
		const prefix = Array((context?.indent ?? 0) + 1).join("  ");
		switch (node.nodeType) {
			case node.constructor.ELEMENT_NODE:
				switch (name) {
					case "ul":
						yield LineBreak;
						context = derive(context, {
							container: "ul",
							index: 0,
							indent: 1 + (context?.indent ?? 0),
						});
						suffix = "\n";
						break;
					case "ol":
						yield LineBreak;
						context = derive(context, {
							container: "ol",
							index: 0,
							indent: 1 + (context?.indent ?? 0),
						});
						yield LineBreak;
						suffix = "\n";
						break;
					case "li": {
						const is_ol = context?.container === "ol";
						const index = is_ol ? `${context.index + 1}.` : "-";
						yield `${prefix}${index} `;
						context = derive(context, { index: context.index + 1 });
						break;
					}
					case "p":
						yield LineBreak;
						suffix = "\n";
						break;
					case "br":
						yield LineBreak;
						break;
					case "strong":
					case "b":
						yield "**";
						suffix = "**";
						break;
					case "em":
					case "i":
						yield "_";
						suffix = "_";
						break;
					case "code":
						yield "`";
						suffix = "`";
						break;
					case "pre":
						yield "```";
						yield LineBreak;
						suffix = "```";
						break;
					case "blockquote":
						yield "> ";
						suffix = "\n";
						break;
					case "h1":
						yield "# ";
						suffix = "\n";
						break;
					case "h2":
						yield "## ";
						suffix = "\n";
						break;
					case "h3":
						yield "### ";
						suffix = "\n";
						break;
					case "h4":
						yield "#### ";
						suffix = "\n";
						break;
					case "h5":
						yield "##### ";
						suffix = "\n";
						break;
					case "h6":
						yield "###### ";
						suffix = "\n";
						break;
					case "a":
						yield "[";
						suffix = `](${node.getAttribute("href")})`;
						break;
					case "img":
						yield `![${node.getAttribute("alt")}](${node.getAttribute("src")})`;
						break;
					case "table":
						yield LineBreak;
						context = derive(context, {
							container: "table",
							rows: [],
						});
						suffix = "\n";
						break;
					case "thead":
					case "tbody":
					case "tfoot":
						// These container elements don't need special handling,
						// just process their children
						break;
					case "tr":
						if (context?.container === "table") {
							context.rows.push([]);
						}
						break;
					case "td":
					case "th":
						if (context?.container === "table") {
							// Recursively process children to preserve nested elements (images, links, etc.)
							const cellContent: string[] = [];
							for (const child of children) {
								// Collect all yielded values and filter out symbols
								for (const yielded of imarkdown(child, context)) {
									if (yielded !== Space && yielded !== LineBreak && typeof yielded === "string") {
										cellContent.push(yielded);
									}
								}
							}
							context.rows[context.rows.length - 1].push(cellContent.join(" ").trim());
						}
						children = []; // Prevent default processing since we handled it manually
						break;
					default:
						break;
				}
				for (const _ of children) {
					yield* imarkdown(_, context);
				}

				if (name === "table" && context?.rows?.length) {
					// Render table rows as markdown
					const rows = context.rows as string[][];
					const maxCols = Math.max(...rows.map((r: string[]) => r.length));
					for (let i = 0; i < rows.length; i++) {
						const row = rows[i];
						// Pad shorter rows with empty cells to match maxCols
						while (row.length < maxCols) {
							row.push("");
						}
						yield "| " + row.join(" | ") + " |\n";
						// Add header separator after first row
						if (i === 0) {
							yield "|" + " --- |".repeat(maxCols) + "\n";
						}
					}
				}

				if (suffix) {
					yield suffix;
				}
				break;
			case node.constructor.TEXT_NODE: {
				const text = strip(node.textContent);
				if (text) {
					yield text;
					yield Space;
				}
				break;
			}
			case node.constructor.COMMENT_NODE:
				// Skip comments
				break;
		}
	}
}

// ============================================================================
// SUBSECTION: markdown
// ============================================================================

// Function: markdown
// Converts a DOM node to a Markdown string. Handles all standard HTML elements
// and produces clean, normalized Markdown output.
//
// Parameters:
// - node: any - the DOM node to convert (Element, Document, or DocumentFragment)
//
// Returns:
// string - the Markdown representation
//
// Example:
// ```typescript
// const html = '<h1>Title</h1><p>Hello <strong>world</strong></p>';
// const doc = parse(html);
// const md = markdown(doc.body);
// // Returns: "# Title\n\nHello **world**"
// ```
function markdown(node: any): string {
	const res: string[] = [];
	let last: unknown;

	for (const _ of imarkdown(node)) {
		if (_ === LineBreak) {
			res.push("\n");
		} else if (_ === Space) {
			// Skip space if last was space or linebreak
			if (last !== Space && last !== LineBreak && last !== "\n") {
				res.push(" ");
			}
		} else {
			res.push(_);
		}
		last = _;
	}
	return res
		.join("")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

export { markdown };
export default { markdown };

// EOF
