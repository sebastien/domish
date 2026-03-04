// --
// ## Markish
//
// Makes it easier to convert between HTML/XML and Markdown

const Space = Symbol.for("Space");
const LineBreak = Symbol.for("LineBreak");

function strip(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}

function derive(object: any, data: any = {}): any {
	return Object.assign(Object.create(object), data);
}

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
		// DEBUG
		// console.error(`imarkdown: name=${name}, type=${node.nodeType}, children=${children?.length}`);
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
							const text = strip(node.textContent);
							context.rows[context.rows.length - 1].push(text);
						}
						children = [];
						break;
					default:
						break;
				}
			// DEBUG
			// console.error(`  Processing ${children?.length} children for ${name}`);
			for (const _ of children) {
				yield* imarkdown(_, context);
			}
				if (name === "table" && context?.rows?.length) {
					// Render table rows as markdown
					const rows = context.rows as string[][];
					const maxCols = Math.max(...rows.map((r: string[]) => r.length));
					for (let i = 0; i < rows.length; i++) {
						const row = rows[i];
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
