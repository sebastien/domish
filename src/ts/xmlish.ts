// This is a Bard-assisted port of my Python's XMLish module. It's a simple HTML/XML
// parser that can be used in both SAX/DOM style.

// Main code
let Document: any, HTML_EMPTY: any;

// Explicit imports at the end
import { Document as Document_, HTML_EMPTY as HTML_EMPTY_ } from "./domish.js";

Document = Document_;
HTML_EMPTY = HTML_EMPTY_;

class Fragment {
	/** Represents a text fragment. */
	source: string;
	start: number;
	end: number;

	static *IterMatches(pattern: RegExp, text: string): Generator<MatchFragment> {
		let offset = 0;
		if (text) {
			const n = text.length;
			let match: RegExpExecArray | null;
			while ((match = pattern.exec(text))) {
				// Yield a fragment for unmatched text before the match
				if (offset !== match.index) {
					yield new MatchFragment(
						null,
						new Fragment(text, offset, match.index),
					);
				}

				// Yield a fragment for the matched text
				yield new MatchFragment(
					match,
					new Fragment(
						text,
						match.index,
						match.index + match[0].length,
					),
				);

				offset = Math.max(offset + 1, match.index + match[0].length);
			}

			// Yield a fragment for any remaining unmatched text
			if (offset < n) {
				yield new MatchFragment(null, new Fragment(text, offset, n));
			}
		}
	}

	constructor(source: string, start: number, end: number) {
		this.source = source;
		this.start = start;
		this.end = end;
	}

	slice(start = 0, end: number | null = null): Fragment {
		const i = start >= 0 ? this.start + start : this.end + start;
		const j = end && end >= 0 ? this.start + end : this.end + (end || 0);
		return new Fragment(this.source, Math.min(i, j), Math.max(i, j));
	}

	get text(): string {
		// Return raw text as-is since entities are handled separately
		return this.rawtext;
	}

	get rawtext(): string {
		return this.source.substring(this.start, this.end);
	}

	get length(): number {
		return this.end - this.start;
	}

	toString(): string {
		return `<Fragment ${this.start}:${this.end}=${this.text}>`;
	}
}

// Define the MatchFragment class
class MatchFragment {
	match: RegExpExecArray | null;
	fragment: Fragment;

	constructor(match: RegExpExecArray | null, fragment: Fragment) {
		this.match = match;
		this.fragment = fragment;
	}
}

// Define the Marker class
class Marker {
	type: string;
	fragment: Fragment;
	name: string | null;
	attributes: { [key: string]: string };

	constructor(type: string, fragment: Fragment, name: string | null = null, attributes: { [key: string]: string } | null = null) {
		this.type = type;
		this.fragment = fragment;
		this.name = name;
		this.attributes = attributes || {}; // Ensure attributes is a dictionary
	}

	get text(): string {
		return this.fragment.text;
	}
}

// Define the MarkerType enum
const MarkerType = Object.freeze({
	Content: "Content",
	Start: "Start",
	End: "End",
	Inline: "Inline",
});

const RE_ENTITY = /&(?:#(?<code>\d+)|(?<name>[a-z]+));/gi;
const ENTITIES: { [key: string]: string } = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
};

function* iexpandEntities(text: string): Generator<string> {
	if (!text) {
		return;
	}
	if (text.length < 3) {
		yield text;
		return;
	}
	let match: RegExpExecArray | null = null;
	let o = 0;
	while ((match = RE_ENTITY.exec(text)) !== null) {
		const start = match.index;
		const end = start + match[0].length;
		const groups = match.groups as any;
		const { code, name } = groups;
		if (start > o) {
			yield text.substring(o, start);
		}
		if (name) {
			yield ENTITIES[name.toLowerCase()] || match[0];
		} else {
			const c = Number(code);
			// Invalid code point → leave entity as-is
			yield !Number.isFinite(c) || c < 0x0 || c > 0x10ffff
				? match[0]
				: String.fromCodePoint(c);
		}
		o = end;
	}
	if (o < text.length) {
		yield text.substring(o);
	}
}

function expandEntities(text: string): string {
	return [...iexpandEntities(text)].join("");
}

// TODO: We need to manage `<path shape-rendering="geometricPrecision"/>`
// where the end is />

const RE_TAG = new RegExp(
	[
		"(?<DOCTYPE>\\<\\!DOCTYPE\\s+(?<doctype>[^\\>]+)\\>\r?\n)|",
		"(?<COMMENT>\\<\\!--(?<comment>([\r\n]|.)*?)--\\>)|",
		"(?<CDATA><\\!\\[CDATA\\[(?<cdata>([\r\n]|.)*?)\\]\\]\\>)|",
		`\\<(?<closing>/)?(?<qualname>((((?<ns>\\w+[\d\w_-]*):)?(?<name>[\d\w_\-]+)))(?<attrs>\\s+[^\\>]*)?\\s*/?\\>`,
	].join(""),
	"mg",
);

const RE_ATTR_SEP = /[=\s]/;

export const parseAttributes = (text: string, attributes: { [key: string]: any } = {}): { [key: string]: any } => {
	// FIXME: We should not do trim or substring, we should
	// just parse the string as is.
	if (!text?.length) {
		return attributes;
	}
	const m = text.match(RE_ATTR_SEP);

	if (!m) {
		const spaceIndex = text.indexOf(" ");

		if (spaceIndex === -1) {
			const name = text.trim();
			if (name) {
				attributes[name] = null;
			}
		} else {
			const name = text.substring(0, spaceIndex).trim();
			if (name) {
				attributes[name] = null;
			}
			parseAttributes(text.substring(spaceIndex + 1).trim(), attributes);
		}
	} else if (m[0] === "=") {
		const name = text.substring(0, m.index!).trim();
		if (m.index! + m[0].length >= text.length) {
			attributes[name] = "";
			return attributes;
		}

		const chr = text[m.index! + 1];
		const end =
			chr === "'"
				? text.indexOf("'", m.index! + 2)
				: chr === '"'
					? text.indexOf('"', m.index! + 2)
					: text.indexOf(" ", m.index!);

		const value =
			end === -1
				? text.substring(m.index! + 1).trim()
				: text.substring(m.index! + 1, end + 1);

		if (!name) {
			// Nothing
		} else if ((value && value[0] === "'") || value[0] === '"') {
			attributes[name] = value.substring(1, value.length - 1);
		} else {
			attributes[name] = value.trim();
		}
		parseAttributes(text.substring(end + 1).trim(), attributes);
	} else {
		const name = text.substring(0, m.index!).trim();
		if (name) {
			attributes[name] = null;
		}
		parseAttributes(
			text.substring(m.index! + m[0].length).trim(),
			attributes,
		);
	}

	return attributes;
};

function* iterMarkers(text: string): Generator<Marker> {
	let name: string | undefined = undefined;
	// Use the Fragment.IterMatches function defined earlier
	for (const { match, fragment } of Fragment.IterMatches(RE_TAG, text)) {
		if (!match) {
			// TODO: Implement entity conversion
			yield new Marker(MarkerType.Content, fragment);
		} else if (match.groups?.CDATA) {
			// Handle CDATA sections
			yield new Marker(MarkerType.Start, fragment.slice(0, 9), "!CDATA");
			yield new Marker(MarkerType.Content, fragment.slice(9, -3));
			yield new Marker(MarkerType.End, fragment.slice(-3), "!CDATA");
		} else if (match.groups?.DOCTYPE) {
			// Handle DOCTYPE declarations
			yield new Marker(
				MarkerType.Start,
				fragment.slice(0, 10),
				"!DOCTYPE",
			);
			yield new Marker(MarkerType.Content, fragment.slice(10, -2));
			yield new Marker(MarkerType.End, fragment.slice(-2), "!DOCTYPE");
		} else if (match.groups?.COMMENT) {
			// Handle comments
			yield new Marker(MarkerType.Start, fragment.slice(0, 4), "!COMMENT");
			yield new Marker(MarkerType.Content, fragment.slice(4, -3));
			yield new Marker(MarkerType.End, fragment.slice(-3), "!COMMENT");
		} else {
			// Handle regular tags
			const { closing, qualname, ns, name, attrs } = match.groups as { closing?: string; qualname?: string; ns?: string; name?: string; attrs?: string };
			const is_closing = !!closing;
			const is_self_closing = match[0].endsWith("/>");
			const attrs_map: { [key: string]: any } = {};
			if (attrs) {
				parseAttributes(attrs, attrs_map);
			}
			if (is_closing) {
				yield new Marker(MarkerType.End, fragment, qualname, attrs_map);
			} else if (is_self_closing) {
				yield new Marker(MarkerType.Inline, fragment, qualname, attrs_map);
			} else {
				yield new Marker(MarkerType.Start, fragment, qualname, attrs_map);
			}
		}
	}
}

export function parse(text: string): Document {
	const doc = new Document();
	const stack: any[] = [doc];
	let current = doc;

	for (const marker of iterMarkers(text)) {
		switch (marker.type) {
			case MarkerType.Content:
				if (current) {
					const text = expandEntities(marker.text);
					if (text.trim()) {
						current.appendChild(doc.createTextNode(text));
					}
				}
				break;
			case MarkerType.Start:
				{
					const name = marker.name!;
					if (name.startsWith("!")) {
						const comment = doc.createComment(marker.fragment.rawtext);
						if (current) {
							current.appendChild(comment);
						}
					} else {
						const element = doc.createElement(name);
						for (const [k, v] of Object.entries(marker.attributes)) {
							if (v !== null) {
								element.setAttribute(k, v);
							} else {
								element.setAttribute(k, "");
							}
						}
						if (current) {
							current.appendChild(element);
						}
						stack.push(element);
						current = element as any;
					}
				}
				break;
			case MarkerType.End:
				if (stack.length > 1) {
					stack.pop();
					current = stack[stack.length - 1];
				}
				break;
			case MarkerType.Inline:
				{
					const name = marker.name!;
					const element = doc.createElement(name);
					for (const [k, v] of Object.entries(marker.attributes)) {
						if (v !== null) {
							element.setAttribute(k, v);
						} else {
							element.setAttribute(k, "");
						}
					}
					if (current) {
						current.appendChild(element);
					}
				}
				break;
		}
	}

	return doc;
}

export default { parse, parseAttributes };