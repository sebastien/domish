// --
// ## DOMish
//
// This is a quick-and-dirty pure TypeScript implementation of the DOM
// to be used in server-side environments that don't have the DOM API.
//
// It is by no means intending to implement the full standard, but should
// be compliant enough so that it can be used in most use cases. If it has
// shortcomings, it should be relatively simple to implement the missing
// bits of functionality.

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

export { HTML_EMPTY };

//
// ### Query Support
const RE_QUERY =
	/((?<type>[.#]?)(?<name>[\w\d_-]+))|(\[(?<attributes>[^\]]+)\])/g;
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

interface Event {
	type: string;
	target: Node | null;
	currentTarget: Node | null;
	defaultPrevented: boolean;
	preventDefault(): void;
}

type EventListener =
	| ((event: Event) => void)
	| { handleEvent(event: Event): void };

class Query {
	text: string;
	selectors: Selector[];

	constructor(query: string) {
		// TODO: We should support space to do level -2 matches
		// TODO: We should fail if the selector is not supported
		this.text = query;
		const matches = query.match(RE_QUERY);
		this.selectors = matches
			? matches.map((match: any) => {
					const g = (match as any).groups;
					const attrs = g?.attributes
						? g.attributes.match(RE_QUERY_ATTR)?.groups
						: null;
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
					if (
						node.nodeName !== name &&
						node.nodeName.toLowerCase() !== name.toLowerCase()
					) {
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
					throw new Error(
						`Unsupported type: ${type} in ${JSON.stringify(this.selectors[i])}`,
					);
			}
		}
		return true;
	}
}

// --
// ## The Node class
//
// This is the main class that defines most of the key operations.
export class Node {
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

	iterWalk(callback: (node: Node) => boolean | undefined): void {
		if (callback(this) !== false) {
			this.childNodes.forEach((_) => {
				_.iterWalk(callback);
			});
		}
	}

	get outerHTML(): string {
		return this.toXMLLines({ html: true }).join("");
	}

	get innerHTML(): string {
		return this.childNodes
			.map((_) => _.toXMLLines({ html: true }).join(""))
			.join("");
	}

	get innerText(): string {
		return this.toText();
	}

	querySelector(query: string): Node | undefined {
		return this.querySelectorAll(query)[0];
	}

	querySelectorAll(query: string): Node[] {
		let scope: Node[] = [this];
		for (const qs of query.split(/\s+/)) {
			if (qs) {
				const q = new Query(query);
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

	// --
	// ### Common accessors

	get children(): Node[] {
		return this.childNodes.filter((_) => _.nodeType === Node.ELEMENT_NODE);
	}

	get firstChild(): Node | null {
		return this.childNodes[0] ?? null;
	}

	get lastChild(): Node | null {
		const n = this.childNodes.length;
		return n > 0 ? (this.childNodes[n - 1] ?? null) : null;
	}

	get nextSibling(): Node | null {
		return this._getSiblingAt(this._index, 1);
	}

	get previousSibling(): Node | null {
		return this._getSiblingAt(this._index, -1);
	}

	get nodeValue(): string | null | undefined {
		return undefined;
	}

	get ownerDocument(): Document | undefined {
		return undefined;
	}

	get parentElement(): Node | null {
		return this.parentNode;
	}

	get textContent(): string {
		return this.childNodes.length
			? this.childNodes.map((_) => _.textContent).join("")
			: this.data;
	}

	// --
	// ### Less common accessors

	get isConnected(): boolean | undefined {
		return undefined;
	}

	// --
	// ### Common methods
	appendChild(node: Node): Node {
		if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
			// Create a copy of the children array to avoid modification during iteration
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

	before(...nodes: Node[]): Node {
		const parent = this.parentNode;
		for (const node of nodes) {
			if (parent) parent.insertBefore(node, this);
		}
		return this;
	}

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

	insertBefore(newNode: Node, referenceNode: Node | null): Node {
		// Handle null referenceNode - append to end
		if (referenceNode === null) {
			return this.appendChild(newNode);
		}
		// Check if referenceNode is a child of this node
		const i = this.childNodes.indexOf(referenceNode);
		if (i < 0) {
			throw new Error(
				"NotFoundError: The reference node is not a child of this node",
			);
		}

		// Handle DocumentFragment - insert all children
		if (newNode.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
			const fragment = newNode as DocumentFragment;
			const children = [...fragment.childNodes]; // Create a copy to avoid mutation issues
			for (const child of children) {
				this.insertBefore(child, referenceNode);
			}
			return newNode;
		}

		// Detach newNode from current parent if it has one
		if (newNode.parentNode) {
			newNode.parentNode.removeChild(newNode);
		}

		// Insert the node
		this.childNodes.splice(i, 0, newNode);
		newNode.parentNode = this;

		return newNode;
	}

	// --
	// ### Event methods

	addEventListener(type: string, listener: EventListener): void {
		if (!this._eventListeners.has(type)) {
			this._eventListeners.set(type, new Set());
		}
		this._eventListeners.get(type)?.add(listener);
	}

	removeEventListener(type: string, listener: EventListener): void {
		const listeners = this._eventListeners.get(type);
		if (listeners) {
			listeners.delete(listener);
			if (listeners.size === 0) {
				this._eventListeners.delete(type);
			}
		}
	}

	dispatchEvent(event: Event): boolean {
		const listeners = this._eventListeners.get(event.type);
		if (listeners) {
			for (const listener of listeners) {
				if (typeof listener === "function") {
					listener.call(this, event);
				} else {
					listener.handleEvent(event);
				}
			}
		}
		return !event.defaultPrevented;
	}

	// --
	// ### Less common methods

	getRootNode(): Node {
		let node: Node = this;
		while (node.parentNode) {
			node = node.parentNode;
		}
		return node;
	}

	hasChildNodes(): boolean {
		return this.childNodes.length > 0;
	}

	//   NOTE: Left as not implemented yet
	//   contains() {}
	//   isDefaultNamespace() {}
	//   isEqualNode() {}
	//   isSameNode() {}
	//   lookupPrefix() {}
	//   lookupNamespaceURI() {}
	//   normalize() {}
	//   compareDocumentPosition() {}

	// --
	// ### Serialization
	*iterText(options?: { [key: string]: any }): Generator<string> {
		switch (this.nodeType) {
			case Node.DOCUMENT_NODE:
			case Node.DOCUMENT_FRAGMENT_NODE:
			case Node.ELEMENT_NODE:
				// Handle <br> elements as newlines
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
				// FIXME: This is not the right way to do it
				yield this.data
					.replace(/&/g, "&amp;")
					.replace(/>/g, "&gt;")
					.replace(/</g, "&lt;");
				break;
		}
	}

	toText(options?: { [key: string]: any }): string {
		return [...this.iterText(options)].join("");
	}

	// TODO: iterXMLLines
	toXMLLines(options?: { [key: string]: any }): string[] {
		return [...this.iterXMLLines(options)];
	}

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
				// Document fragments should not output XML declarations
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
							styleValue = styleValue
								? `${styleValue};${inlineStyles}`
								: inlineStyles;
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
								yield v.value === null
									? ` ${attrName}`
									: ` ${attrName}="${v.value}"`;
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
				yield this.data
					.replace(/&/g, "&amp;")
					.replace(/>/g, "&gt;")
					.replace(/</g, "&lt;");
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

	get _index(): number {
		return this.parentNode ? this.parentNode.childNodes.indexOf(this) : -1;
	}

	_create(): Node {
		return new Node("", 0);
	}

	_detach(): Node {
		if (this.parentNode) this.parentNode.removeChild(this);
		return this;
	}

	_attach(parentNode: Node): Node {
		if (parentNode !== this.parentNode) {
			this._detach();
			this.parentNode = parentNode;
		}
		return this;
	}

	_getSiblingAt(index: number, offset = 0): Node | null {
		return this.parentNode?.childNodes[index + offset] || null;
	}
}

function getDataSet(target: Element, property: string | symbol): any {
	// TODO: We may need to do de-camel-case
	if (typeof property === "string") {
		const attr = target._attributes.get(`data-${property}`);
		return attr ? attr.value : undefined;
	}
	return (target as any)[property];
}

export class AttributeNode extends Node {
	name: string;
	namespace: string | null;
	ownerElement: Element | null;
	_value: string | undefined;

	constructor(
		name: string,
		namespace: string | null,
		ownerElement: Element | null,
	) {
		super(name, Node.ATTRIBUTE_NODE);
		this.name = name;
		this.namespace = namespace;
		this.ownerElement = ownerElement;
		this._value = undefined;
	}

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
				this.ownerElement._attributesNS
					.get(this.namespace)
					?.set(this.name, this);
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

export class Element extends Node {
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

	get id(): string | null {
		return this.getAttribute("id");
	}

	get attributes(): AttributeNode[] {
		const regularAttrs = Array.from(this._attributes.values());
		const namespacedAttrs: AttributeNode[] = [];
		for (const nsMap of this._attributesNS.values()) {
			namespacedAttrs.push(...Array.from(nsMap.values()));
		}
		return [...regularAttrs, ...namespacedAttrs];
	}

	removeAttribute(name: string): void {
		if (name === "style") {
			this.style = {};
		}
		// Remove from regular attributes
		this._attributes.delete(name);

		// Also remove from all namespace maps (DOM spec: removeAttribute should remove regardless of namespace)
		for (const [namespace, nsMap] of this._attributesNS.entries()) {
			nsMap.delete(name);
			// Clean up empty namespace maps
			if (nsMap.size === 0) {
				this._attributesNS.delete(namespace);
			}
		}
	}

	removeAttributeNS(namespace: string, name: string): void {
		if (this._attributesNS.has(namespace)) {
			this._attributesNS.get(namespace)?.delete(name);
		}
	}

	setAttribute(name: string, value: string): void {
		const attrNode = new AttributeNode(name, null, this);
		attrNode.value = value;
		this._attributes.set(name, attrNode);
	}

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

	getAttributeNode(name: string): AttributeNode | null {
		return this._attributes.get(name) || null;
	}

	setAttributeNS(ns: string, name: string, value: string): void {
		if (!this._attributesNS.has(ns)) {
			this._attributesNS.set(ns, new Map());
		}
		const attrNode = new AttributeNode(name, ns, this);
		attrNode.value = value;
		this._attributesNS.get(ns)?.set(name, attrNode);
	}

	hasAttribute(name: string): boolean {
		return this._attributes.has(name);
	}

	hasAttributeNS(namespace: string, name: string): boolean {
		return this._attributesNS.get(namespace)?.has(name) || false;
	}

	getAttribute(name: string): string | null {
		const attr = this._attributes.get(name);
		return attr ? attr.value : null;
	}

	getAttributeNS(ns: string, name: string): string | null {
		const nsMap = this._attributesNS.get(ns);
		if (nsMap) {
			const attr = nsMap.get(name);
			return attr ? attr.value : null;
		}
		return null;
	}

	getAttributeNodeNS(ns: string, name: string): AttributeNode | null {
		const nsMap = this._attributesNS.get(ns);
		return nsMap ? nsMap.get(name) || null : null;
	}

	removeAttributeNode(attributeNode: AttributeNode): AttributeNode {
		if (attributeNode.ownerElement !== this) {
			throw new Error(
				"NotFoundError: The attribute node is not owned by this element",
			);
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
			this._attributesNS
				.get(attributeNode.namespace)
				?.set(attributeNode.name, attributeNode);
		} else {
			this._attributes.set(attributeNode.name, attributeNode);
		}

		return existingNode;
	}

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
}

export class TemplateElement extends Element {
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

export class TextNode extends Node {
	constructor(data: string) {
		super("#text", Node.TEXT_NODE);
		this.data = data;
	}

	override _create(): Node {
		return new TextNode(this.data);
	}

	override get nodeValue(): string {
		return this.data;
	}

	override toJSON(): string {
		return this.data;
	}
}

export class Comment extends Node {
	constructor(data: string) {
		super("#comment", Node.COMMENT_NODE);
		this.data = data;
	}

	override _create(): Node {
		return new Comment(this.data);
	}

	override get nodeValue(): string {
		return this.data;
	}

	override toJSON(): undefined {
		return undefined;
	}
}

export class DocumentFragment extends Node {
	constructor() {
		super("document-fragment", Node.DOCUMENT_FRAGMENT_NODE);
	}
}

export class Document extends Node {
	body: Element;
	_elements: Element[];

	constructor(nodes?: Node[]) {
		super("#document", Node.DOCUMENT_NODE);
		this.body = new Element("body");
		this._elements = [];
		// Non standard
		if (nodes) {
			for (const node of nodes) {
				if (node) this.appendChild(node);
			}
		}
	}

	getElementById(id: string): Element | null {
		for (const i in this._elements) {
			const n = this._elements[i];
			if (n && n.id === id) {
				return n;
			}
		}
		return null;
	}

	createTreeWalker(node: Node, nodeFilter: number): TreeWalker {
		return new TreeWalker(node, nodeFilter);
	}

	createTextNode(value: string): TextNode {
		return new TextNode(value);
	}

	createAttribute(name: string): AttributeNode {
		return new AttributeNode(name, null, null);
	}

	createComment(value: string): Comment {
		return new Comment(value);
	}

	createDocumentFragment(): DocumentFragment {
		return new DocumentFragment();
	}

	createElement(name: string): Element {
		let element: Element | null = null;
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

	createElementNS(namespace: string, name: string): Element {
		return this._register(new Element(name, namespace));
	}

	_register(element: Element): Element {
		this._elements.push(element);
		return element;
	}

	override _create(): Document {
		return new Document();
	}
}

export const NodeFilter = {
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

export class TreeWalker {
	root: Node;
	currentNode: Node;
	nodeFilter: number;
	predicate?: (node: Node) => boolean;

	constructor(
		root: Node,
		nodeFilter: number,
		predicate?: (node: Node) => boolean,
	) {
		this.root = root;
		this.currentNode = root;
		this.nodeFilter = nodeFilter;
		this.predicate = predicate;
		// TODO: Support attributes
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

	nextNode(): Node | null {
		let next = this._nextNode(this.currentNode);
		while (next && !this._acceptNode(next)) {
			next = this._nextNode(next);
		}
		this.currentNode = next as Node;
		return next;
	}
}

// --
// ## Token List
//
// This is used to work with `classList`, for instance.
//
export class TokenList {
	element: Element;
	attribute: string;

	constructor(element: Element, attribute = "class") {
		this.element = element;
		this.attribute = attribute;
	}

	add(value: string): void {
		if (!this.contains(value)) {
			const v = this._get();
			this._set(v ? `${v} ${value}` : value);
		}
	}

	contains(value: string): boolean {
		return this._get().split(" ").indexOf(value) >= 0;
	}

	remove(value: string): void {
		this._set(
			this._get()
				.split(" ")
				.filter((_) => _ !== value)
				.join(" "),
		);
	}

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

export class StyleSheet {
	cssRules: string[];

	constructor() {
		this.cssRules = [];
	}

	deleteRule(index: number): StyleSheet {
		this.cssRules.splice(index, 1);
		return this;
	}

	insertRule(rule: string, index = 0): StyleSheet {
		this.cssRules.splice(index, 0, rule);
		return this;
	}
}

const toCSSPropertyName = (name: string): string => {
	const property = /[A-Za-z][a-z]*/g;
	const res: string[] = [];
	let match: RegExpExecArray | null = null;

	do {
		match = property.exec(name);
		if (match !== null) {
			res.push(match[0].toLowerCase());
		}
	} while (match !== null);

	return res.join("-");
};

// --
// ## References
//
// - DOM API Reference at [DevDocs](https://devdocs.io/dom/node).
// - DOM.js, by Andreas Gal on [Github](https://github.com/andreasgal/dom.js),
//   which aims to be an IDL-compliant DOM implementation. We don't really
//   want to go there.
// - Deno DOM, by b-fuze on [Github](https://github.com/b-fuze/deno-dom), which
//   is a Deno-specific, Rust-based implementation
//

export const NodeList = Array;
export const StyleSheetList = Array;
export const document = new Document();
// Alias HTMLElement to Element for compatibility
export const HTMLElement = Element;

const DOM = {
	Node,
	Element,
	HTMLElement,
	Document,
	NodeList,
	NodeFilter,
	StyleSheetList,
	document,
};

export function install(
	target: typeof globalThis = globalThis,
): typeof globalThis {
	return Object.assign(target, DOM);
}

export default DOM;
// EOF
