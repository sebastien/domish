// Project: DOMIsh
// Author:  Sebastien Pierre
// License: Revised BSD License
// Created: 2022-04-21

// Module: domish
// A pure TypeScript implementation of the DOM for server-side environments.
// Provides core DOM classes including Node, Element, Document, and supporting
// utilities like TreeWalker, TokenList, and StyleSheet. Implements standard
// DOM operations for element creation, traversal, manipulation, and serialization.
//
// Example:
// ```typescript
// const doc = new Document();
// const div = doc.createElement("div");
// div.setAttribute("class", "container");
// doc.body.appendChild(div);
// console.log(doc.toHTML());
// ```

import {
	createFocusEvent,
	createInputEvent,
	createKeyboardEvent,
	createMouseEvent,
	type Event,
	Event as EventClass,
	type EventListener,
	SubmitEvent,
} from "./events";

const tags = (...tags: string[]): Map<string, boolean> =>
	tags.reduce((r, v) => {
		r.set(v, true);
		r.set(v.toLowerCase(), true);
		r.set(v.toUpperCase(), true);
		return r;
	}, new Map<string, boolean>());

const HTML_EMPTY = tags(
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
);

const HTML_NOEMPTY = tags("slot");

// ----------------------------------------------------------------------------
//
// QUERY SUPPORT
//
// ----------------------------------------------------------------------------
// ============================================================================
// SUBSECTION: Selectors and Matching
// ============================================================================

const RE_QUERY = /((?<type>[.#]?)(?<name>[\w\d_-]+))|(\[(?<attributes>[^\]]+)\])/g;
const RE_QUERY_ATTR =
	/^(?<name>\w+)((?<operator>[~|^$*]?=)("(?<value_0>[^"]+)"|'(?<value_1>[^']+)'|(?<value_2>[^\]]+)))?$/;

interface Selector {
	type: string;
	name: string;
	attributes: {
		name: string;
		operator?: string;
		value?: string;
		value_0?: string;
		value_1?: string;
		value_2?: string;
	} | null;
}

// Class: Query
// Parses CSS selectors and matches them against DOM nodes. Supports element
// selectors, class selectors (.class), ID selectors (#id), and attribute
// selectors ([attr]).
//
// Attributes:
// - text: string - the raw selector string
// - selectors: Selector[] - parsed selector components
class Query {
	text: string;
	selectors: Selector[];

	constructor(query: string) {
		this.text = query;
		const matches = [...query.matchAll(RE_QUERY)];
		this.selectors = matches
			? matches.map((match: any) => {
					const g = (match as any).groups;
					const attrs = g?.attributes ? g.attributes.match(RE_QUERY_ATTR)?.groups : null;
					return {
						type: match.groups?.attributes ? "@" : match.groups?.type || "",
						name: match.groups?.name || "",
						attributes: attrs
							? {
									...attrs,
									value: attrs.value_0 || attrs.value_1 || attrs.value_2,
								}
							: null,
					};
				})
			: [];
	}

	// Method: match
	// Returns `true` if `node` matches all selectors in this query.
	match(node: Node): boolean {
		for (let i = 0; i < this.selectors.length; i++) {
			const selector = this.selectors[i];
			if (!selector) continue;
			const { type, name, attributes } = selector;
			if (node.nodeType !== Node.ELEMENT_NODE) {
				return false;
			}
			switch (type) {
				case "":
					if (node.nodeName !== name && node.nodeName.toLowerCase() !== name.toLowerCase()) {
						return false;
					}
					break;
				case ".":
					if (!(node as Element).classList.contains(name)) {
						return false;
					}
					break;
				case "#":
					if ((node as Element).getAttribute("id") !== name) {
						return false;
					}
					break;
				case "@":
					if (attributes) {
						if (!(node as Element).hasAttribute(attributes.name)) {
							return false;
						}
						// TODO: Support operator
					}
					return true;
				default:
					throw new Error(`Unsupported type: ${type} in ${JSON.stringify(this.selectors[i])}`);
			}
		}
		return true;
	}
}

// ----------------------------------------------------------------------------
//
// NODE
//
// ----------------------------------------------------------------------------
// ============================================================================
// SUBSECTION: Node Class
// ============================================================================

// Class: Node
// The base class for all DOM nodes. Defines standard node operations including
// traversal, manipulation, serialization, and event handling. All other node
// types extend this class.
//
// Static Properties:
// - ELEMENT_NODE: number = 1
// - ATTRIBUTE_NODE: number = 2
// - TEXT_NODE: number = 3
// - CDATA_SECTION_NODE: number = 4
// - PROCESSING_INSTRUCTION_NODE: number = 7
// - COMMENT_NODE: number = 8
// - DOCUMENT_NODE: number = 9
// - DOCUMENT_TYPE_NODE: number = 10
// - DOCUMENT_FRAGMENT_NODE: number = 11
// - Namespaces: object - SVG and XLink namespace URIs
//
// Instance Properties:
// - nodeName: string - tag name or node type identifier
// - nodeType: number - one of the static node type constants
// - childNodes: Node[] - array of child nodes
// - parentNode: Node | null - parent node or null if detached
// - data: string - text data for text/comment nodes
// - _eventListeners: Map<string, Set<EventListener>> - internal event storage
class Node {
	static Namespaces = {
		svg: "http://www.w3.org/2000/svg",
		xlink: "http://www.w3.org/1999/xlink",
	};
	static ELEMENT_NODE = 1;
	static ATTRIBUTE_NODE = 2;
	static TEXT_NODE = 3;
	static CDATA_SECTION_NODE = 4;
	static PROCESSING_INSTRUCTION_NODE = 7;
	static COMMENT_NODE = 8;
	static DOCUMENT_NODE = 9;
	static DOCUMENT_TYPE_NODE = 10;
	static DOCUMENT_FRAGMENT_NODE = 11;

	nodeName: string;
	nodeType: number;
	childNodes: Node[];
	parentNode: Node | null;
	data: string;
	_eventListeners: Map<string, Set<EventListener>>;

	constructor(name: string, type: number) {
		this.nodeName = name;
		this.nodeType = type;
		this.childNodes = [];
		this.parentNode = null;
		this.data = "";
		this._eventListeners = new Map();
	}

	// Method: iterWalk
	// Recursively traverses the node tree, calling `callback` for each node.
	// Stop iteration by returning `false` from the callback.
	iterWalk(callback: (node: Node) => boolean | undefined): void {
		if (callback(this) !== false) {
			this.childNodes.forEach((_) => {
				_.iterWalk(callback);
			});
		}
	}

	// Property: outerHTML
	// Returns the HTML serialization of this node including its descendants.
	get outerHTML(): string {
		return this.toXMLLines({ html: true }).join("");
	}

	// Property: innerHTML
	// Returns the HTML serialization of this node's children only.
	get innerHTML(): string {
		return this.childNodes.map((_) => _.toXMLLines({ html: true }).join("")).join("");
	}

	// Property: innerText
	// Returns the text content of this node and its descendants.
	get innerText(): string {
		return this.toText();
	}

	// Method: querySelector
	// Returns the first descendant node matching `query`, or undefined if none found.
	querySelector(query: string): Node | undefined {
		return this.querySelectorAll(query)[0];
	}

	// Method: querySelectorAll
	// Returns all descendant nodes matching `query` as an array.
	querySelectorAll(query: string): Node[] {
		let scope: Node[] = [this];
		for (const qs of query.split(/\s+/)) {
			if (qs) {
				const q = new Query(qs);
				const matched: Node[] = [];
				for (const n of scope) {
					n.iterWalk((_) => {
						if (q.match(_)) matched.push(_);
						// We need to return boolean | undefined here to satisfy the type
						// Although iterWalk in our implementation only checks for `false`
						// to stop iteration, the type definition expects a specific return type.
						// Returning undefined is safe as it's not false.
						return undefined;
					});
				}
				scope = matched;
			}
			if (scope.length === 0) {
				return scope;
			}
		}
		return query ? scope : [];
	}

	matches(query: string): boolean {
		return new Query(query).match(this);
	}

	// ============================================================================
	// SUBSECTION: Common Accessors
	// ============================================================================

	// Property: children
	// Returns an array of element children (excludes text and comment nodes).
	get children(): Node[] {
		return this.childNodes.filter((_) => _.nodeType === Node.ELEMENT_NODE);
	}

	// Property: firstChild
	// Returns the first child node, or null if there are no children.
	get firstChild(): Node | null {
		return this.childNodes[0] ?? null;
	}

	// Property: lastChild
	// Returns the last child node, or null if there are no children.
	get lastChild(): Node | null {
		const n = this.childNodes.length;
		return n > 0 ? (this.childNodes[n - 1] ?? null) : null;
	}

	// Property: nextSibling
	// Returns the next sibling node in the parent's children array.
	get nextSibling(): Node | null {
		return this._getSiblingAt(this._index, 1);
	}

	// Property: previousSibling
	// Returns the previous sibling node in the parent's children array.
	get previousSibling(): Node | null {
		return this._getSiblingAt(this._index, -1);
	}

	// Property: nodeValue
	// Returns the text content for text nodes, undefined for other node types.
	get nodeValue(): string | null | undefined {
		return undefined;
	}

	// Property: ownerDocument
	// Returns the Document this node belongs to, or undefined.
	get ownerDocument(): Document | undefined {
		return undefined;
	}

	// Property: parentElement
	// Returns the parent node as an Element, or null if not attached.
	get parentElement(): Node | null {
		return this.parentNode;
	}

	// Property: textContent
	// Returns the concatenated text content of this node and all descendants.
	get textContent(): string {
		return this.childNodes.length ? this.childNodes.map((_) => _.textContent).join("") : this.data;
	}

	// ============================================================================
	// SUBSECTION: Less Common Accessors
	// ============================================================================

	// Property: isConnected
	// Returns true if this node is attached to a document, false otherwise.
	get isConnected(): boolean | undefined {
		return undefined;
	}

	// ============================================================================
	// SUBSECTION: Common Methods
	// ============================================================================

	// Method: appendChild
	// Appends `node` as the last child of this node. If `node` already has a
	// parent, it is first removed from that parent.
	appendChild(node: Node): Node {
		if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
			const children = [...(node as DocumentFragment).childNodes];
			for (const n of children) {
				this.appendChild(n);
			}
		} else {
			if (node.parentNode) {
				node.parentNode.removeChild(node);
				node.parentNode = null;
			}
			this.childNodes.push(node);
			node.parentNode = this;
		}
		return this;
	}

	// Method: after
	// Inserts `nodes` after this node in the parent's children.
	after(...nodes: Node[]): Node {
		const parent = this.parentNode;
		const next = this.nextSibling;
		for (const node of nodes) {
			if (next) {
				if (parent) parent.insertBefore(node, next);
			} else {
				if (parent) parent.appendChild(node);
			}
		}
		return this;
	}

	// Method: before
	// Inserts `nodes` before this node in the parent's children.
	before(...nodes: Node[]): Node {
		const parent = this.parentNode;
		for (const node of nodes) {
			if (parent) parent.insertBefore(node, this);
		}
		return this;
	}

	// Method: cloneNode
	// Returns a copy of this node. If `deep` is true, recursively clones all
	// descendants and copies event listeners.
	cloneNode(deep = false): Node {
		const n = this._create();
		n.nodeName = this.nodeName;
		n.nodeType = this.nodeType;
		n.data = this.data;
		n.parentNode = null;
		n._eventListeners = new Map();
		for (const [type, listeners] of this._eventListeners.entries()) {
			n._eventListeners.set(type, new Set(listeners));
		}
		n.childNodes = deep
			? this.childNodes.map((_) => {
					const r = _.cloneNode(deep);
					r.parentNode = n;
					return r;
				})
			: [];
		return n;
	}

	// Method: removeChild
	// Removes `child` from this node's children and returns this node.
	removeChild(child: Node): Node {
		const i = this.childNodes.indexOf(child);
		if (i >= 0) {
			const c = this.childNodes[i];
			if (c) {
				this.childNodes.splice(i, 1);
				c.parentNode = null;
			}
		}
		return this;
	}

	// Method: replaceChild
	// Replaces `oldChild` with `newChild` in this node's children.
	replaceChild(newChild: Node, oldChild: Node): Node {
		const i = this.childNodes.indexOf(oldChild);
		if (i >= 0) {
			oldChild.parentNode = null;
			newChild._detach();
			newChild.parentNode = this;
			this.childNodes[i] = newChild;
		}
		return this;
	}

	// Method: insertBefore
	// Inserts `newNode` before `referenceNode` in this node's children. If
	// `referenceNode` is null, appends to the end.
	insertBefore(newNode: Node, referenceNode: Node | null): Node {
		if (referenceNode === null) {
			return this.appendChild(newNode);
		}

		if (newNode.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
			const fragment = newNode as DocumentFragment;
			const children = [...fragment.childNodes];
			for (const child of children) {
				this.insertBefore(child, referenceNode);
			}
			return newNode;
		}

		if (newNode.parentNode) {
			newNode.parentNode.removeChild(newNode);
		}

		// Find the reference index AFTER removing the node, since
		// removeChild may have shifted indices in this same parent.
		const i = this.childNodes.indexOf(referenceNode);
		if (i < 0) {
			throw new Error("NotFoundError: The reference node is not a child of this node");
		}

		this.childNodes.splice(i, 0, newNode);
		newNode.parentNode = this;

		return newNode;
	}

	// ============================================================================
	// SUBSECTION: Event Methods
	// ============================================================================

	// Method: addEventListener
	// Registers `listener` to be called when events of `type` are dispatched.
	addEventListener(type: string, listener: EventListener): void {
		if (!this._eventListeners.has(type)) {
			this._eventListeners.set(type, new Set());
		}
		this._eventListeners.get(type)?.add(listener);
	}

	// Method: removeEventListener
	// Removes `listener` from the set of listeners for events of `type`.
	removeEventListener(type: string, listener: EventListener): void {
		const listeners = this._eventListeners.get(type);
		if (listeners) {
			listeners.delete(listener);
			if (listeners.size === 0) {
				this._eventListeners.delete(type);
			}
		}
	}

	// Method: dispatchEvent
	// Dispatches `event` to this node and all ancestors (bubbling). Returns `true`
	// if the event was not prevented.
	dispatchEvent(event: Event): boolean {
		// Build the event path (bubbling phase only, no capture)
		const path: Node[] = [];
		let current: Node | null = this;

		// Build path from target up to root
		while (current) {
			path.push(current);
			current = current.parentNode;
		}

		// Set event path
		event._setPath(path as unknown as EventTarget[]);

		// Set target
		event._setTarget(this as unknown as EventTarget);

		// Dispatch at target and bubble up
		for (let i = 0; i < path.length; i++) {
			const node = path[i];

			if (i === 0) {
				event._setEventPhase(2); // AT_TARGET
			} else {
				event._setEventPhase(3); // BUBBLING_PHASE
			}

			event._setCurrentTarget(node as unknown as EventTarget);

			const listeners = node._eventListeners.get(event.type);
			if (listeners) {
				for (const listener of listeners) {
					if (event._isImmediatePropagationStopped) {
						break;
					}

					if (typeof listener === "function") {
						listener.call(node, event);
					} else {
						listener.handleEvent(event);
					}
				}
			}

			if (event._isPropagationStopped) {
				break;
			}

			// Don't bubble if event doesn't bubble
			if (i === 0 && !event.bubbles) {
				break;
			}
		}

		return !event.defaultPrevented;
	}

	// ============================================================================
	// SUBSECTION: Less Common Methods
	// ============================================================================

	// Method: getRootNode
	// Returns the root node of the tree (the topmost ancestor of this node).
	getRootNode(): Node {
		let node: Node = this;
		while (node.parentNode) {
			node = node.parentNode;
		}
		return node;
	}

	// Method: hasChildNodes
	// Returns true if this node has one or more children.
	hasChildNodes(): boolean {
		return this.childNodes.length > 0;
	}

	// ============================================================================
	// SUBSECTION: Serialization
	// ============================================================================

	// Method: iterText
	// Generator that yields text content from this node and its descendants.
	// Handles <br> elements as newlines and escapes HTML entities in text nodes.
	*iterText(options?: { [key: string]: any }): Generator<string> {
		switch (this.nodeType) {
			case Node.DOCUMENT_NODE:
			case Node.DOCUMENT_FRAGMENT_NODE:
			case Node.ELEMENT_NODE:
				if (this.nodeName && this.nodeName.toLowerCase() === "br") {
					yield "\n";
					return;
				}
				for (const n of this.childNodes) {
					for (const l of n.iterText(options)) {
						yield l;
					}
				}
				break;
			case Node.TEXT_NODE:
				yield this.data.replace(/&/g, "&amp;").replace(/>/g, "&gt;").replace(/</g, "&lt;");
				break;
		}
	}

	// Method: toText
	// Returns all text content from this node and its descendants as a single string.
	toText(options?: { [key: string]: any }): string {
		return [...this.iterText(options)].join("");
	}

	// Method: toXMLLines
	// Returns an array of XML serialization lines for this node.
	toXMLLines(options?: { [key: string]: any }): string[] {
		return [...this.iterXMLLines(options)];
	}

	// Method: iterXMLLines
	// Generator that yields XML serialization lines for this node and its descendants.
	*iterXMLLines(options?: { [key: string]: any }): Generator<string> {
		const has_comments = !(options && options.comments === false);
		const has_doctype = !(options && options.doctype === false);

		switch (this.nodeType) {
			case Node.DOCUMENT_NODE:
				if (has_doctype) {
					yield "<?xml version='1.0' charset='utf-8' ?>\n";
				}
				for (const n of this.childNodes) {
					for (const l of n.iterXMLLines(options)) {
						yield l;
					}
				}
				break;
			case Node.DOCUMENT_FRAGMENT_NODE:
				for (const n of this.childNodes) {
					for (const l of n.iterXMLLines(options)) {
						yield l;
					}
				}
				break;
			case Node.ELEMENT_NODE:
				{
					const element = this as unknown as Element;
					const name = element.namespace
						? `${element.namespace}:${this.nodeName}`
						: `${this.nodeName}`;
					const empty =
						!options || !options.html
							? undefined
							: HTML_NOEMPTY.has(name)
								? false
								: HTML_EMPTY.has(name)
									? true
									: undefined;
					yield `<${name}`;
					// Handle style attribute
					let styleAttr: AttributeNode | null = null;
					for (const [k, v] of element._attributes.entries()) {
						if (k === "style") {
							styleAttr = v;
						} else if (v && v.value !== undefined) {
							yield v.value === null ? ` ${k}` : ` ${k}="${v.value || ""}"`;
						}
					}

					// Handle style attribute with inline styles
					if (styleAttr || Object.keys(element.style).length > 0) {
						let styleValue = styleAttr ? styleAttr.value : "";
						const inlineStyles = Object.keys(element.style)
							.map((k) => `${toCSSPropertyName(k)}: ${element.style[k]}`)
							.join(";");
						if (inlineStyles) {
							styleValue = styleValue ? `${styleValue};${inlineStyles}` : inlineStyles;
						}
						if (styleValue) {
							yield ` style="${styleValue}"`;
						}
					}

					for (const [ns, attrs] of element._attributesNS.entries()) {
						for (const [k, v] of attrs.entries()) {
							if (v && v.value !== undefined) {
								// Map common namespace URIs to their prefixes
								const prefix =
									ns === "http://www.w3.org/1999/xlink"
										? "xlink"
										: ns === "http://www.w3.org/2000/svg"
											? "svg"
											: ns === "http://www.w3.org/XML/1998/namespace"
												? "xml"
												: null;
								const attrName = prefix ? `${prefix}:${k}` : k;
								yield v.value === null ? ` ${attrName}` : ` ${attrName}="${v.value}"`;
							}
						}
					}
					if (options?.html && empty === true) {
						yield " >";
					} else if (this.childNodes.length === 0 && empty !== false) {
						yield " />";
					} else {
						yield ">";
						for (const n of this.childNodes) {
							for (const l of n.iterXMLLines(options)) {
								yield l;
							}
						}
						yield `</${name}>`;
					}
				}
				break;
			case Node.TEXT_NODE:
				// FIXME: This is not the right way to do it
				yield this.data.replace(/&/g, "&amp;").replace(/>/g, "&gt;").replace(/</g, "&lt;");
				break;
			case Node.COMMENT_NODE:
				if (has_comments) {
					yield `<!--${this.data ? this.data.replace(/>/g, "&gt;") : ""}-->`;
				}
				break;
		}
	}

	toXML(options: { [key: string]: any } = {}): string {
		return this.toXMLLines(options).join("");
	}

	toHTML(options: { [key: string]: any } = {}): string {
		return this.toXMLLines({ ...options, html: true }).join("");
	}

	toJSON(): any {
		return {
			name: this.nodeName,
			children: this.childNodes.map((_) => _.toJSON()),
		};
	}

	// --
	// ### Helpers

	// Property: _index
	// Returns the index of this node in its parent's children array, or -1.
	get _index(): number {
		return this.parentNode ? this.parentNode.childNodes.indexOf(this) : -1;
	}

	// Method: _create
	// Creates a new blank Node instance for cloning. Override in subclasses.
	_create(): Node {
		return new Node("", 0);
	}

	// Method: _detach
	// Removes this node from its parent if attached. Returns this node.
	_detach(): Node {
		if (this.parentNode) this.parentNode.removeChild(this);
		return this;
	}

	// Method: _attach
	// Attaches this node to `parentNode`, detaching from current parent first.
	_attach(parentNode: Node): Node {
		if (parentNode !== this.parentNode) {
			this._detach();
			this.parentNode = parentNode;
		}
		return this;
	}

	// Method: _getSiblingAt
	// Returns the sibling at `index + offset` in the parent's children.
	_getSiblingAt(index: number, offset = 0): Node | null {
		return this.parentNode?.childNodes[index + offset] || null;
	}
}

// ----------------------------------------------------------------------------
//
// ATTRIBUTES
//
// ----------------------------------------------------------------------------
// ============================================================================
// SUBSECTION: Attribute Node
// ============================================================================

// Function: getDataSet
// Helper for dataset proxy. Returns data-* attribute value by property name.
function getDataSet(target: Element, property: string | symbol): any {
	// TODO: We may need to do de-camel-case
	if (typeof property === "string") {
		const attr = target._attributes.get(`data-${property}`);
		return attr ? attr.value : undefined;
	}
	return (target as any)[property];
}

// Class: AttributeNode
// Represents an element attribute with name, value, and optional namespace.
//
// Properties:
// - name: string - attribute name
// - namespace: string | null - namespace URI or null
// - ownerElement: Element | null - element this attribute belongs to
// - _value: string | undefined - internal value storage
class AttributeNode extends Node {
	name: string;
	namespace: string | null;
	ownerElement: Element | null;
	_value: string | undefined;

	constructor(name: string, namespace: string | null, ownerElement: Element | null) {
		super(name, Node.ATTRIBUTE_NODE);
		this.name = name;
		this.namespace = namespace;
		this.ownerElement = ownerElement;
		this._value = undefined;
	}

	// Property: value
	// Returns the attribute value. Looks up from ownerElement if attached.
	get value(): string {
		if (this.ownerElement) {
			if (this.namespace) {
				const nsMap = this.ownerElement._attributesNS.get(this.namespace);
				const attr = nsMap ? nsMap.get(this.name) : null;
				return attr ? attr._value || "" : "";
			} else {
				const attr = this.ownerElement._attributes.get(this.name);
				return attr ? attr._value || "" : "";
			}
		}
		return this._value || "";
	}

	set value(value: string) {
		this._value = value;
		if (this.ownerElement) {
			if (this.namespace) {
				// For namespaced attributes, set directly in the map to avoid recursion
				if (!this.ownerElement._attributesNS.has(this.namespace)) {
					this.ownerElement._attributesNS.set(this.namespace, new Map());
				}
				this.ownerElement._attributesNS.get(this.namespace)?.set(this.name, this);
			} else {
				// For regular attributes, set directly in the map to avoid recursion
				this.ownerElement._attributes.set(this.name, this);
			}
		}
	}

	override get nodeValue(): string {
		return this.value;
	}

	setNodeValue(value: string): void {
		this.value = value;
	}
}

// ----------------------------------------------------------------------------
//
// ELEMENTS
//
// ----------------------------------------------------------------------------
// ============================================================================
// SUBSECTION: Element Class
// ============================================================================

// Class: Element
// Represents an HTML or XML element with attributes, styles, and children.
// Extends Node with element-specific functionality like attribute management,
// classList, and CSS style manipulation.
//
// Properties:
// - namespace: string | null - element namespace URI or null for HTML
// - style: { [key: string]: string } - inline CSS styles as key-value pairs
// - _attributes: Map<string, AttributeNode> - regular attributes storage
// - _attributesNS: Map<string, Map<string, AttributeNode>> - namespaced attributes
// - classList: TokenList - class attribute manipulation interface
// - sheet: StyleSheet | null - stylesheet for <style> elements, null otherwise
// - dataset: any - data-* attribute access via proxy
//
// Example:
// ```typescript
// const el = doc.createElement("div");
// el.setAttribute("class", "container");
// el.classList.add("active");
// el.style.backgroundColor = "blue";
// ```
class Element extends Node {
	namespace: string | null;
	style: { [key: string]: string };
	_attributes: Map<string, AttributeNode>;
	_attributesNS: Map<string, Map<string, AttributeNode>>;
	classList: TokenList;
	sheet: StyleSheet | null;

	dataset: any;

	constructor(name: string, namespace: string | null = null) {
		super(name, Node.ELEMENT_NODE);
		this.namespace = namespace;
		this.style = {};
		this._attributes = new Map();
		this._attributesNS = new Map();
		this.classList = new TokenList(this, "class");
		this.sheet = name === "style" ? new StyleSheet() : null;

		this.dataset = new Proxy(this, { get: getDataSet });
	}

	// Property: id
	// Returns the value of the id attribute, or null if not set.
	get id(): string | null {
		return this.getAttribute("id");
	}

	// Property: attributes
	// Returns an array of all AttributeNode instances on this element.
	get attributes(): AttributeNode[] {
		const regularAttrs = Array.from(this._attributes.values());
		const namespacedAttrs: AttributeNode[] = [];
		for (const nsMap of this._attributesNS.values()) {
			namespacedAttrs.push(...Array.from(nsMap.values()));
		}
		return [...regularAttrs, ...namespacedAttrs];
	}

	// Method: removeAttribute
	// Removes the attribute with `name` from this element, including from any namespace.
	removeAttribute(name: string): void {
		if (name === "style") {
			this.style = {};
		}
		this._attributes.delete(name);
		for (const [namespace, nsMap] of this._attributesNS.entries()) {
			nsMap.delete(name);
			if (nsMap.size === 0) {
				this._attributesNS.delete(namespace);
			}
		}
	}

	// Method: removeAttributeNS
	// Removes the namespaced attribute with `name` from `namespace`.
	removeAttributeNS(namespace: string, name: string): void {
		if (this._attributesNS.has(namespace)) {
			this._attributesNS.get(namespace)?.delete(name);
		}
	}

	// Method: setAttribute
	// Sets the attribute `name` to `value` on this element.
	setAttribute(name: string, value: string): void {
		const attrNode = new AttributeNode(name, null, this);
		attrNode.value = value;
		this._attributes.set(name, attrNode);
	}

	// Method: setAttributeNode
	// Adds an AttributeNode directly to this element.
	setAttributeNode(node: AttributeNode): void {
		node.ownerElement = this;
		if (node.namespace) {
			if (!this._attributesNS.has(node.namespace)) {
				this._attributesNS.set(node.namespace, new Map());
			}
			this._attributesNS.get(node.namespace)?.set(node.name, node);
		} else {
			this._attributes.set(node.name, node);
		}
	}

	// Method: getAttributeNode
	// Returns the AttributeNode for `name`, or null if not set.
	getAttributeNode(name: string): AttributeNode | null {
		return this._attributes.get(name) || null;
	}

	// Method: setAttributeNS
	// Sets the namespaced attribute `name` in `ns` to `value`.
	setAttributeNS(ns: string, name: string, value: string): void {
		if (!this._attributesNS.has(ns)) {
			this._attributesNS.set(ns, new Map());
		}
		const attrNode = new AttributeNode(name, ns, this);
		attrNode.value = value;
		this._attributesNS.get(ns)?.set(name, attrNode);
	}

	// Method: hasAttribute
	// Returns true if this element has an attribute named `name`.
	hasAttribute(name: string): boolean {
		return this._attributes.has(name);
	}

	// Method: hasAttributeNS
	// Returns true if this element has attribute `name` in `namespace`.
	hasAttributeNS(namespace: string, name: string): boolean {
		return this._attributesNS.get(namespace)?.has(name) || false;
	}

	// Method: getAttribute
	// Returns the value of attribute `name`, or null if not set.
	getAttribute(name: string): string | null {
		const attr = this._attributes.get(name);
		return attr ? attr.value : null;
	}

	// Method: getAttributeNS
	// Returns the value of namespaced attribute `name` in `ns`, or null.
	getAttributeNS(ns: string, name: string): string | null {
		const nsMap = this._attributesNS.get(ns);
		if (nsMap) {
			const attr = nsMap.get(name);
			return attr ? attr.value : null;
		}
		return null;
	}

	// Method: getAttributeNodeNS
	// Returns the AttributeNode for namespaced attribute `name` in `ns`, or null.
	getAttributeNodeNS(ns: string, name: string): AttributeNode | null {
		const nsMap = this._attributesNS.get(ns);
		return nsMap ? nsMap.get(name) || null : null;
	}

	removeAttributeNode(attributeNode: AttributeNode): AttributeNode {
		if (attributeNode.ownerElement !== this) {
			throw new Error("NotFoundError: The attribute node is not owned by this element");
		}

		if (attributeNode.namespace) {
			const nsMap = this._attributesNS.get(attributeNode.namespace);
			if (nsMap?.has(attributeNode.name)) {
				nsMap.delete(attributeNode.name);
				if (nsMap.size === 0) {
					this._attributesNS.delete(attributeNode.namespace);
				}
			}
		} else {
			this._attributes.delete(attributeNode.name);
		}

		attributeNode.ownerElement = null;
		return attributeNode;
	}

	addAttributeNode(attributeNode: AttributeNode): AttributeNode | null {
		if (attributeNode.ownerElement && attributeNode.ownerElement !== this) {
			throw new Error(
				"InUseAttributeError: The attribute node is already in use by another element",
			);
		}

		const existingNode = attributeNode.namespace
			? this.getAttributeNodeNS(attributeNode.namespace, attributeNode.name)
			: this.getAttributeNode(attributeNode.name);

		attributeNode.ownerElement = this;

		if (attributeNode.namespace) {
			if (!this._attributesNS.has(attributeNode.namespace)) {
				this._attributesNS.set(attributeNode.namespace, new Map());
			}
			this._attributesNS.get(attributeNode.namespace)?.set(attributeNode.name, attributeNode);
		} else {
			this._attributes.set(attributeNode.name, attributeNode);
		}

		return existingNode;
	}

	// Method: cloneNode
	// Returns a copy of this element with all attributes. If `deep` is true,
	// also clones all descendants.
	override cloneNode(deep?: boolean): Element {
		const res = super.cloneNode(deep) as Element;
		for (const [k, v] of this._attributes.entries()) {
			if (v) {
				const clonedAttr = new AttributeNode(k, null, res);
				clonedAttr.value = v.value;
				res._attributes.set(k, clonedAttr);
			}
		}
		for (const [ns, attrs] of this._attributesNS.entries()) {
			const clonedNsMap = new Map();
			for (const [k, v] of attrs.entries()) {
				if (v) {
					const clonedAttr = new AttributeNode(k, ns, res);
					clonedAttr.value = v.value;
					clonedNsMap.set(k, clonedAttr);
				}
			}
			res._attributesNS.set(ns, clonedNsMap);
		}
		return res;
	}

	override _create(): Element {
		return new Element(this.nodeName, this.namespace);
	}

	// Method: toJSON
	// Returns a JSON representation including element name, children, and all attributes.
	override toJSON(): {
		name: string;
		children: any[];
		attributes?: { [key: string]: string };
	} {
		const res = super.toJSON();
		const attr: { [key: string]: string } = {};
		for (const [k, v] of this._attributes.entries()) {
			if (v && v.value !== undefined) {
				attr[k] = v.value;
			}
		}
		for (const [ns, attrs] of this._attributesNS.entries()) {
			for (const [k, v] of attrs.entries()) {
				if (v && v.value !== undefined) {
					attr[ns ? `${ns}:${k}` : k] = v.value;
				}
			}
		}
		res.attributes = attr;
		return res;
	}

	// ============================================================================
	// SUBSECTION: Interaction Methods
	// ============================================================================

	// Method: click
	// Dispatches a click event on this element. Returns true if not prevented.
	// `options.x` and `options.y` set client coordinates, `options.button` sets button (0=left).
	click(options?: { x?: number; y?: number; button?: number }): boolean {
		const event = createMouseEvent("click", {
			clientX: options?.x ?? 0,
			clientY: options?.y ?? 0,
			button: options?.button ?? 0,
		});
		return this.dispatchEvent(event as unknown as import("./events").Event);
	}

	// Method: dblclick
	// Dispatches a double-click event on this element.
	dblclick(options?: { x?: number; y?: number }): boolean {
		const event = createMouseEvent("dblclick", {
			clientX: options?.x ?? 0,
			clientY: options?.y ?? 0,
		});
		return this.dispatchEvent(event as unknown as import("./events").Event);
	}

	// Method: contextMenu
	// Dispatches a context menu (right-click) event on this element.
	contextMenu(options?: { x?: number; y?: number }): boolean {
		const event = createMouseEvent("contextmenu", {
			clientX: options?.x ?? 0,
			clientY: options?.y ?? 0,
			button: 2,
		});
		return this.dispatchEvent(event as unknown as import("./events").Event);
	}

	// Method: focus
	// Dispatches a focus event on this element.
	focus(): boolean {
		const event = createFocusEvent("focus");
		return this.dispatchEvent(event as unknown as import("./events").Event);
	}

	// Method: blur
	// Dispatches a blur event on this element.
	blur(): boolean {
		const event = createFocusEvent("blur");
		return this.dispatchEvent(event as unknown as import("./events").Event);
	}

	// Method: keyDown
	// Dispatches a keydown event with `key` and optional modifier flags.
	keyDown(
		key: string,
		options?: { ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; metaKey?: boolean },
	): boolean {
		const event = createKeyboardEvent("keydown", {
			key,
			ctrlKey: options?.ctrlKey,
			shiftKey: options?.shiftKey,
			altKey: options?.altKey,
			metaKey: options?.metaKey,
		});
		return this.dispatchEvent(event as unknown as import("./events").Event);
	}

	// Method: keyUp
	// Dispatches a keyup event with `key` and optional modifier flags.
	keyUp(
		key: string,
		options?: { ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; metaKey?: boolean },
	): boolean {
		const event = createKeyboardEvent("keyup", {
			key,
			ctrlKey: options?.ctrlKey,
			shiftKey: options?.shiftKey,
			altKey: options?.altKey,
			metaKey: options?.metaKey,
		});
		return this.dispatchEvent(event as unknown as import("./events").Event);
	}

	// Method: input
	// Sets the value attribute for input/textarea elements and dispatches
	// an input event with `value` as the data.
	input(value: string): boolean {
		if (this.nodeName.toLowerCase() === "input" || this.nodeName.toLowerCase() === "textarea") {
			this.setAttribute("value", value);
		}
		const event = createInputEvent("input", { data: value });
		return this.dispatchEvent(event as unknown as import("./events").Event);
	}

	// Method: change
	// Sets the value attribute and dispatches a change event on input/select elements.
	change(value: string): boolean {
		if (
			this.nodeName.toLowerCase() === "input" ||
			this.nodeName.toLowerCase() === "textarea" ||
			this.nodeName.toLowerCase() === "select"
		) {
			this.setAttribute("value", value);
		}
		const event = new EventClass("change", { bubbles: true });
		return this.dispatchEvent(event as unknown as import("./events").Event);
	}

	// Method: submit
	// Dispatches a submit event on form elements.
	submit(): boolean {
		const event = new SubmitEvent("submit", {
			bubbles: true,
			cancelable: true,
		});
		return this.dispatchEvent(event as unknown as import("./events").Event);
	}
}

// ============================================================================
// SUBSECTION: Template Element
// ============================================================================

// Class: TemplateElement
// Represents a <template> element with a DocumentFragment content.
// Children are appended to the content fragment, not the element itself.
//
// Properties:
// - content: DocumentFragment - the document fragment holding template content
class TemplateElement extends Element {
	content: DocumentFragment;

	constructor(name: string, namespace: string | null = null) {
		super(name, namespace);
		this.content = new DocumentFragment();
	}

	override appendChild(node: Node): TemplateElement {
		this.content.appendChild(node);
		return this;
	}
}

// ----------------------------------------------------------------------------
//
// TEXT AND COMMENT NODES
//
// ----------------------------------------------------------------------------
// ============================================================================
// SUBSECTION: Text Node
// ============================================================================

// Class: TextNode
// Represents a text node containing character data.
//
// Properties:
// - data: string - the text content of this node
class TextNode extends Node {
	constructor(data: string) {
		super("#text", Node.TEXT_NODE);
		this.data = data;
	}

	override _create(): Node {
		return new TextNode(this.data);
	}

	// Property: nodeValue
	// Returns the text data of this node.
	override get nodeValue(): string {
		return this.data;
	}

	override toJSON(): string {
		return this.data;
	}
}

// ============================================================================
// SUBSECTION: Comment Node
// ============================================================================

// Class: Comment
// Represents an HTML/XML comment node.
//
// Properties:
// - data: string - the comment text content
class Comment extends Node {
	constructor(data: string) {
		super("#comment", Node.COMMENT_NODE);
		this.data = data;
	}

	override _create(): Node {
		return new Comment(this.data);
	}

	// Property: nodeValue
	// Returns the comment text.
	override get nodeValue(): string {
		return this.data;
	}

	override toJSON(): undefined {
		return undefined;
	}
}

// ============================================================================
// SUBSECTION: Document Fragment
// ============================================================================

// Class: DocumentFragment
// Represents a lightweight container for nodes. Can be used to append multiple
// nodes at once without a wrapper element.
class DocumentFragment extends Node {
	constructor() {
		super("document-fragment", Node.DOCUMENT_FRAGMENT_NODE);
	}
}

// ----------------------------------------------------------------------------
//
// DOCUMENT
//
// ----------------------------------------------------------------------------
// ============================================================================
// SUBSECTION: Document Class
// ============================================================================

// Class: Document
// The root of the DOM tree. Factory for creating elements and text nodes.
// Maintains a body element and a registry of elements with IDs.
//
// Properties:
// - body: Element - the document body element
// - _elements: Element[] - internal registry of created elements
//
// Example:
// ```typescript
// const doc = new Document();
// const div = doc.createElement("div");
// doc.body.appendChild(div);
// ```
class Document extends Node {
	body: Element;
	_elements: Element[];

	constructor(nodes?: Node[]) {
		super("#document", Node.DOCUMENT_NODE);
		this.body = new Element("body");
		this._elements = [];
		// Non standard: optionally append initial nodes
		if (nodes) {
			for (const node of nodes) {
				if (node) this.appendChild(node);
			}
		}
	}

	// Method: getElementById
	// Returns the element with `id`, or null if not found.
	getElementById(id: string): Element | null {
		for (const n of this._elements) {
			if (n && n.id === id) {
				return n;
			}
		}
		return null;
	}

	// Method: querySelectorAll
	// Overrides Node.querySelectorAll to also search through `document.body`
	// which may not be in the document's child node list (matching browser
	// behaviour where `document.querySelector` always searches the full tree).
	querySelectorAll(query: string): Node[] {
		const results = super.querySelectorAll(query);
		if (results.length > 0) {
			return results;
		}
		// Fallback: search through body if not already in childNodes.
		if (this.body && !this.childNodes.includes(this.body)) {
			return this.body.querySelectorAll(query);
		}
		return results;
	}

	// Method: createTreeWalker
	// Creates a TreeWalker for traversing the DOM starting at `node`.
	createTreeWalker(node: Node, nodeFilter: number): TreeWalker {
		return new TreeWalker(node, nodeFilter);
	}

	// Method: createTextNode
	// Creates a new TextNode with `value`.
	createTextNode(value: string): TextNode {
		return new TextNode(value);
	}

	// Method: createAttribute
	// Creates a new AttributeNode with `name` (not attached to any element).
	createAttribute(name: string): AttributeNode {
		return new AttributeNode(name, null, null);
	}

	// Method: createComment
	// Creates a new Comment node with `value`.
	createComment(value: string): Comment {
		return new Comment(value);
	}

	// Method: createDocumentFragment
	// Creates a new empty DocumentFragment.
	createDocumentFragment(): DocumentFragment {
		return new DocumentFragment();
	}

	// Method: createElement
	// Creates a new Element with `name`. Returns TemplateElement for "template".
	// Automatically registers the element for getElementById lookups.
	createElement(name: string): Element {
		let element: Element;
		switch (name) {
			case "template":
			case "TEMPLATE":
				element = new TemplateElement(name);
				break;
			default:
				element = new Element(name);
		}
		return this._register(element);
	}

	// Method: createElementNS
	// Creates a new Element with `name` in `namespace`.
	createElementNS(namespace: string, name: string): Element {
		return this._register(new Element(name, namespace));
	}

	// Method: _register
	// Internal method to register an element for getElementById lookups.
	_register(element: Element): Element {
		this._elements.push(element);
		return element;
	}

	override _create(): Document {
		return new Document();
	}
}

// ----------------------------------------------------------------------------
//
// TREE WALKER
//
// ----------------------------------------------------------------------------
// ============================================================================
// SUBSECTION: Node Filter
// ============================================================================

// Constant: NodeFilter
// Bitmask constants for filtering node types in TreeWalker.
const NodeFilter = {
	SHOW_ALL: 4294967295,
	SHOW_ATTRIBUTE: 2,
	SHOW_CDATA_SECTION: 8,
	SHOW_COMMENT: 128,
	SHOW_DOCUMENT: 256,
	SHOW_DOCUMENT_FRAGMENT: 1024,
	SHOW_DOCUMENT_TYPE: 512,
	SHOW_ELEMENT: 1,
	SHOW_ENTITY_REFERENCE: 16,
	SHOW_ENTITY: 32,
	SHOW_PROCESSING: 64,
	SHOW_NOTATION: 2048,
	SHOW_TEXT: 4,
};

// ============================================================================
// SUBSECTION: Tree Walker
// ============================================================================

// Class: TreeWalker
// Iterates through a DOM tree, filtering nodes by type. Uses depth-first
// traversal and can optionally apply a custom predicate filter.
//
// Properties:
// - root: Node - the starting node for the walk
// - currentNode: Node - current position in the iteration
// - nodeFilter: number - bitmask of NodeFilter constants
// - predicate: (node: Node) => boolean - optional custom filter function
class TreeWalker {
	root: Node;
	currentNode: Node;
	nodeFilter: number;
	predicate?: (node: Node) => boolean;

	constructor(root: Node, nodeFilter: number, predicate?: (node: Node) => boolean) {
		this.root = root;
		this.currentNode = root;
		this.nodeFilter = nodeFilter;
		this.predicate = predicate;
	}

	_nextNode(node: Node | null): Node | null {
		if (!node) {
			return null;
		} else if (node.childNodes && node.childNodes.length > 0) {
			return node.childNodes[0] ?? null;
		} else if (node.nextSibling) {
			return node.nextSibling;
		} else {
			let n: Node | null = this.currentNode.parentNode;
			while (n?.parentNode) {
				n = n.parentNode;
				if (n.nextSibling) {
					return n.nextSibling;
				}
			}
			return null;
		}
	}

	_acceptNode(node: Node): boolean {
		switch (node.nodeType) {
			case Node.ELEMENT_NODE:
				return !!(this.nodeFilter & NodeFilter.SHOW_ELEMENT);
			case Node.ATTRIBUTE_NODE:
				return !!(this.nodeFilter & NodeFilter.SHOW_ATTRIBUTE);
			case Node.CDATA_SECTION_NODE:
				return !!(this.nodeFilter & NodeFilter.SHOW_CDATA_SECTION);
			case Node.PROCESSING_INSTRUCTION_NODE:
				return !!(this.nodeFilter & NodeFilter.SHOW_PROCESSING);
			case Node.DOCUMENT_NODE:
				return !!(this.nodeFilter & NodeFilter.SHOW_DOCUMENT);
			case Node.DOCUMENT_TYPE_NODE:
				return !!(this.nodeFilter & NodeFilter.SHOW_DOCUMENT_TYPE);
			case Node.DOCUMENT_FRAGMENT_NODE:
				return !!(this.nodeFilter & NodeFilter.SHOW_DOCUMENT_FRAGMENT);
			case Node.TEXT_NODE:
				return !!(this.nodeFilter & NodeFilter.SHOW_TEXT);
			case Node.COMMENT_NODE:
				return !!(this.nodeFilter & NodeFilter.SHOW_COMMENT);
			default:
				return false;
		}
	}

	// Method: nextNode
	// Advances to the next node matching the filter and returns it, or null.
	nextNode(): Node | null {
		let next = this._nextNode(this.currentNode);
		while (next && !this._acceptNode(next)) {
			next = this._nextNode(next);
		}
		this.currentNode = next as Node;
		return next;
	}
}

// ----------------------------------------------------------------------------
//
// TOKEN LIST
//
// ----------------------------------------------------------------------------
// ============================================================================
// SUBSECTION: Token List
// ============================================================================

// Class: TokenList
// Manages a space-separated token attribute (like classList). Provides methods
// to add, remove, toggle, and check for token membership.
//
// Properties:
// - element: Element - the element whose attribute this list manages
// - attribute: string - the attribute name (default: "class")
//
// Example:
// ```typescript
// el.classList.add("active");
// el.classList.remove("hidden");
// if (el.classList.contains("visible")) { ... }
// ```
class TokenList {
	element: Element;
	attribute: string;

	constructor(element: Element, attribute = "class") {
		this.element = element;
		this.attribute = attribute;
	}

	// Method: add
	// Adds `value` to the token list if not already present.
	add(value: string): void {
		if (!this.contains(value)) {
			const v = this._get();
			this._set(v ? `${v} ${value}` : value);
		}
	}

	// Method: contains
	// Returns true if `value` is in the token list.
	contains(value: string): boolean {
		return this._get().split(" ").indexOf(value) >= 0;
	}

	// Method: remove
	// Removes `value` from the token list if present.
	remove(value: string): void {
		this._set(
			this._get()
				.split(" ")
				.filter((_) => _ !== value)
				.join(" "),
		);
	}

	// Method: toggle
	// Adds `value` if not present, removes it if present. Returns true if added.
	toggle(value: string): boolean {
		if (this.contains(value)) {
			this.remove(value);
			return false;
		} else {
			this.add(value);
			return true;
		}
	}

	_get(): string {
		return this.element.getAttribute(this.attribute) || "";
	}

	_set(value: string): void {
		this.element.setAttribute(this.attribute, value);
	}
}

// ----------------------------------------------------------------------------
//
// STYLESHEET
//
// ----------------------------------------------------------------------------
// ============================================================================
// SUBSECTION: StyleSheet
// ============================================================================

// Class: StyleSheet
// Manages a list of CSS rules for <style> elements. Provides methods to
// insert and delete rules by index.
//
// Properties:
// - cssRules: string[] - array of CSS rule strings
class StyleSheet {
	cssRules: string[];

	constructor() {
		this.cssRules = [];
	}

	// Method: deleteRule
	// Removes the CSS rule at `index`.
	deleteRule(index: number): StyleSheet {
		this.cssRules.splice(index, 1);
		return this;
	}

	// Method: insertRule
	// Inserts `rule` at `index` (default 0). Returns this for chaining.
	insertRule(rule: string, index = 0): StyleSheet {
		this.cssRules.splice(index, 0, rule);
		return this;
	}
}

// ============================================================================
// SUBSECTION: CSS Property Name Conversion
// ============================================================================

// Function: toCSSPropertyName
// Converts camelCase property names to kebab-case CSS property names.
const toCSSPropertyName = (name: string): string => {
	const property = /[A-Za-z][a-z]*/g;
	const res: string[] = [];
	let match: RegExpExecArray | null;

	do {
		match = property.exec(name);
		if (match !== null) {
			res.push(match[0].toLowerCase());
		}
	} while (match !== null);

	return res.join("-");
};

// ----------------------------------------------------------------------------
//
// REFERENCES
//
// ----------------------------------------------------------------------------
// - DOM API Reference at [DevDocs](https://devdocs.io/dom/node)
// - DOM.js by Andreas Gal: https://github.com/andreasgal/dom.js
// - Deno DOM by b-fuze: https://github.com/b-fuze/deno-dom

const NodeList = Array;
const StyleSheetList = Array;
let document = new Document();
// Alias HTMLElement to Element for compatibility
const HTMLElement = Element;

const DOM = {
	Node,
	Element,
	HTMLElement,
	Document,
	NodeList,
	NodeFilter,
	StyleSheetList,
	document,
	Event: EventClass,
};

// Function: install
// Installs DOM globals (document, DOM classes) into `target` (default: globalThis).
// Creates a fresh Document on each call so that repeated installs (e.g. in test
// `beforeEach` hooks) start with a clean DOM tree.
// Returns the modified target object.
function install(target: typeof globalThis = globalThis): typeof globalThis {
	if (globalThis.window) {
		return target;
	}
	document = new Document();
	DOM.document = document;
	return Object.assign(target, DOM);
}

export {
	HTML_EMPTY,
	Node,
	AttributeNode,
	Element,
	TemplateElement,
	TextNode,
	Comment,
	DocumentFragment,
	Document,
	NodeFilter,
	TreeWalker,
	TokenList,
	StyleSheet,
	NodeList,
	StyleSheetList,
	document,
	HTMLElement,
	install,
};

export default DOM;

// EOF
