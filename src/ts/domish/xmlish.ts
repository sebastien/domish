// Project: DOMIsh
// Author:  Sebastien Pierre
// License: Revised BSD License
// Created: 2022-04-21

// Module: xmlish
// A simple HTML/XML parser supporting both SAX and DOM-style parsing.
// Parses text into a Document with proper handling of HTML void elements,
// CDATA sections, comments, and entity expansion.
//
// Example:
// ```typescript
// const doc = parse('<div class="test">Hello <b>World</b></div>');
// console.log(doc.body.innerHTML);
// ```

import { Document } from "./domish.js";

// HTML void/empty elements that don't need closing tags
const HTML_VOID_ELEMENTS = new Set([
	"area",
	"base",
	"basefont",
	"br",
	"col",
	"frame",
	"hr",
	"img",
	"input",
	"isindex",
	"link",
	"meta",
	"param",
]);

// ----------------------------------------------------------------------------
//
// FRAGMENTS
//
// ----------------------------------------------------------------------------
// ============================================================================
// SUBSECTION: Fragment
// ============================================================================

// Class: Fragment
// Represents a substring fragment within a source text.
// Used for parsing and position tracking.
//
// Properties:
// - source: string - the original source text
// - start: number - start index in source
// - end: number - end index in source
class Fragment {
	source: string;
	start: number;
	end: number;

	// Method: IterMatches
	// Static generator that yields MatchFragment instances for all regex matches
	// and non-matching text segments in `text`.
	static *IterMatches(pattern: RegExp, text: string): Generator<MatchFragment> {
		let offset = 0;
		if (text) {
			const n = text.length;
			let match: RegExpExecArray | null;
			while (true) {
				match = pattern.exec(text);
				if (!match) break;
				if (offset !== match.index) {
					yield new MatchFragment(null, new Fragment(text, offset, match.index));
				}
				yield new MatchFragment(
					match,
					new Fragment(text, match.index, match.index + match[0].length),
				);
				offset = Math.max(offset + 1, match.index + match[0].length);
			}
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

	// Method: slice
	// Returns a new Fragment representing a slice of this fragment.
	slice(start = 0, end: number | null = null): Fragment {
		const i = start >= 0 ? this.start + start : this.end + start;
		const j = end && end >= 0 ? this.start + end : this.end + (end || 0);
		return new Fragment(this.source, Math.min(i, j), Math.max(i, j));
	}

	// Property: text
	// Returns the text content (same as rawtext, entities handled separately).
	get text(): string {
		return this.rawtext;
	}

	// Property: rawtext
	// Returns the raw substring from source between start and end indices.
	get rawtext(): string {
		return this.source.substring(this.start, this.end);
	}

	// Property: length
	// Returns the length of this fragment in characters.
	get length(): number {
		return this.end - this.start;
	}

	// Method: toString
	// Returns a debug string representation.
	toString(): string {
		return `<Fragment ${this.start}:${this.end}=${this.text}>`;
	}
}

// ============================================================================
// SUBSECTION: Match Fragment
// ============================================================================

// Class: MatchFragment
// Combines a RegExp match result with its corresponding text Fragment.
//
// Properties:
// - match: RegExpExecArray | null - regex match result or null for non-matches
// - fragment: Fragment - the text fragment for this match
class MatchFragment {
	match: RegExpExecArray | null;
	fragment: Fragment;

	constructor(match: RegExpExecArray | null, fragment: Fragment) {
		this.match = match;
		this.fragment = fragment;
	}
}

// ============================================================================
// SUBSECTION: Marker
// ============================================================================

// Class: Marker
// Represents a parsed token from HTML/XML markup (start tag, end tag, content, etc.).
//
// Properties:
// - type: string - marker type (Content, Start, End, Inline)
// - fragment: Fragment - source text fragment for this marker
// - name: string | null - tag name or special marker name
// - attributes: { [key: string]: string } - parsed attributes for tag markers
class Marker {
	type: string;
	fragment: Fragment;
	name: string | null;
	attributes: { [key: string]: string };

	constructor(
		type: string,
		fragment: Fragment,
		name: string | null = null,
		attributes: { [key: string]: string } | null = null,
	) {
		this.type = type;
		this.fragment = fragment;
		this.name = name;
		this.attributes = attributes || {};
	}

	// Property: text
	// Returns the text content of this marker's fragment.
	get text(): string {
		return this.fragment.text;
	}
}

// ============================================================================
// SUBSECTION: Marker Types
// ============================================================================

// Constant: MarkerType
// Enum-like object defining marker type constants.
const MarkerType = Object.freeze({
	Content: "Content",
	Start: "Start",
	End: "End",
	Inline: "Inline",
});

// ----------------------------------------------------------------------------
//
// ENTITY EXPANSION
//
// ----------------------------------------------------------------------------
// ============================================================================
// SUBSECTION: Entity Handling
// ============================================================================

const RE_ENTITY = /&(?:#(?<code>\d+)|(?<name>[a-z]+));/gi;
const ENTITIES: { [key: string]: string } = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
};

// Function: iexpandEntities
// Generator that yields text with HTML entities expanded to their character equivalents.
// Supports named entities (amp, lt, gt, quot, apos) and numeric character references.
function* iexpandEntities(text: string): Generator<string> {
	if (!text) {
		return;
	}
	if (text.length < 3) {
		yield text;
		return;
	}
	let match: RegExpExecArray | null;
	let o = 0;
	while (true) {
		match = RE_ENTITY.exec(text);
		if (match === null) {
			break;
		}
		const start = match.index;
		const end = start + match[0].length;
		const groups = match.groups as unknown as Record<string, string>;
		const { code, name } = groups;
		if (start > o) {
			yield text.substring(o, start);
		}
		if (name) {
			yield ENTITIES[name.toLowerCase()] || match[0];
		} else {
			const c = Number(code);
			// Invalid code point → leave entity as-is
			yield !Number.isFinite(c) || c < 0x0 || c > 0x10ffff ? match[0] : String.fromCodePoint(c);
		}
		o = end;
	}
	if (o < text.length) {
		yield text.substring(o);
	}
}

// Function: expandEntities
// Returns `text` with all HTML entities expanded to their character equivalents.
function expandEntities(text: string): string {
	return [...iexpandEntities(text)].join("");
}

// ----------------------------------------------------------------------------
//
// PARSING
//
// ----------------------------------------------------------------------------
// ============================================================================
// SUBSECTION: Tag Parsing
// ============================================================================

const RE_TAG = new RegExp(
	[
		"(?<DOCTYPE>\\<!DOCTYPE\\s+(?<doctype>[^>]+)>\\r?\\n)|",
		"(?<COMMENT>\\<!--(?<comment>([\\r\\n]|.)*?)-->)|",
		"(?<CDATA><!\\[CDATA\\[(?<cdata>([\\r\\n]|.)*?)\\]\\]>)|",
		`\\<(?<closing>/)?(?<qualname>(?:(?:(?<ns>\\w+[\\w_-]*):)?(?<name>[\\w_-]+)))(?<attrs>\\s+[^>]*)?\\s*/?\\>`,
	].join(""),
	"mg",
);

const RE_ATTR_SEP = /[=\s]/;

// Function: parseAttributes
// Parses an attribute string like `class="test" id="foo"` into an object.
// Returns an object mapping attribute names to values (null for boolean attributes).
const parseAttributes = (
	text: string,
	attributes: { [key: string]: any } = {},
): { [key: string]: any } => {
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
		const name = text.substring(0, m.index ?? 0).trim();
		if ((m.index ?? 0) + m[0].length >= text.length) {
			attributes[name] = "";
			return attributes;
		}

		const chr = text[(m.index ?? 0) + 1];
		const end =
			chr === "'"
				? text.indexOf("'", (m.index ?? 0) + 2)
				: chr === '"'
					? text.indexOf('"', (m.index ?? 0) + 2)
					: text.indexOf(" ", m.index ?? 0);

		const value =
			end === -1
				? text.substring((m.index ?? 0) + 1).trim()
				: text.substring((m.index ?? 0) + 1, end + 1);

		if (!name) {
			// Nothing
		} else if ((value && value[0] === "'") || value[0] === '"') {
			attributes[name] = value.substring(1, value.length - 1);
		} else {
			attributes[name] = value.trim();
		}
		parseAttributes(text.substring(end + 1).trim(), attributes);
	} else {
		const name = text.substring(0, m.index ?? 0).trim();
		if (name) {
			attributes[name] = null;
		}
		parseAttributes(text.substring((m.index ?? 0) + m[0].length).trim(), attributes);
	}

	return attributes;
};

function* iterMarkers(text: string): Generator<Marker> {
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
			yield new Marker(MarkerType.Start, fragment.slice(0, 10), "!DOCTYPE");
			yield new Marker(MarkerType.Content, fragment.slice(10, -2));
			yield new Marker(MarkerType.End, fragment.slice(-2), "!DOCTYPE");
		} else if (match.groups?.COMMENT) {
			// Handle comments
			yield new Marker(MarkerType.Start, fragment.slice(0, 4), "!COMMENT");
			yield new Marker(MarkerType.Content, fragment.slice(4, -3));
			yield new Marker(MarkerType.End, fragment.slice(-3), "!COMMENT");
		} else {
			// Handle regular tags
			const { closing, qualname, attrs } = match.groups as {
				closing?: string;
				qualname?: string;
				ns?: string;
				name?: string;
				attrs?: string;
			};
			const is_closing = !!closing;
			const is_self_closing = match[0].endsWith("/>");
			const is_void_element = HTML_VOID_ELEMENTS.has((qualname || "").toLowerCase());

			const attrs_map: { [key: string]: any } = {};
			if (attrs) {
				parseAttributes(attrs, attrs_map);
			}
			if (is_closing) {
				yield new Marker(MarkerType.End, fragment, qualname, attrs_map);
			} else if (is_self_closing || is_void_element) {
				yield new Marker(MarkerType.Inline, fragment, qualname, attrs_map);
			} else {
				yield new Marker(MarkerType.Start, fragment, qualname, attrs_map);
			}
		}
	}
}

// Function: parse
// Parses HTML/XML text and returns a Document. Handles standard HTML elements,
// void elements, comments, CDATA sections, and DOCTYPE declarations.
//
// Example:
// ```typescript
// const doc = parse('<div class="greeting">Hello World</div>');
// const div = doc.querySelector('.greeting');
// ```
function parse(text: string): Document {
	const doc = new Document();

	const stack: any[] = [doc.body];
	let current = doc.body;
	let debugCount = 0;

	for (const marker of iterMarkers(text)) {
		debugCount++;
		// DEBUG - disabled
		// if (debugCount <= 10) {
		// 	console.error(`Marker ${debugCount}: type=${marker.type}, name=${marker.name}, text=${marker.fragment?.rawtext?.substring(0, 20)}`);
		// }
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
					const name = marker.name ?? "";
					// DEBUG - disabled
					// console.error(`  Start ${name}: current=${current?.nodeName}, stack=${stack.map(s => s.nodeName).join(',')}`);
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
							// DEBUG - disabled
							// console.error(`  Appending ${name} to ${current.nodeName}`);
							current.appendChild(element);
						}
						stack.push(element);

						current = element as any;
						// DEBUG - disabled
						// console.error(`  After push: current=${current?.nodeName}, stack=${stack.map(s => s.nodeName).join(',')}`);
					}
				}
				break;
			case MarkerType.End:
				// DEBUG - disabled
				// console.error(`  End ${marker.name}: current=${current?.nodeName}, stack=${stack.map(s => s.nodeName).join(',')}`);
				if (stack.length > 1) {
					stack.pop();
					current = stack[stack.length - 1];
					// DEBUG - disabled
					// console.error(`  After pop: current=${current?.nodeName}, stack=${stack.map(s => s.nodeName).join(',')}`);
				}
				break;
			case MarkerType.Inline:
				{
					const name = marker.name ?? "";
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

export { parse, parseAttributes };
export default { parse, parseAttributes };

// EOF
