// --
// ## DOMish
//
// This is a quick-and-dirty pure JavaScript implementation of the DOM
// to be used in server-side environments that don't have the DOM API.
//
// It is by no means intending to implement the full standard, but should
// be compliant enough so that it can be used in most use cases. If it has
// shortcomings, it should be relatively simple to implement the missing
// bits of functionality.

const tags = (...tags) =>
	tags.reduce(
		(r, v) => (
			r.set(v, true),
			r.set(v.toLowerCase(), true),
			r.set(v.toUpperCase(), true),
			r
		),
		new Map(),
	);

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

class Query {
	constructor(query) {
		// TODO: We should support space to do level -2 matches
		// TODO: We should fail if the selector is not supported
		this.text = query;
		this.selectors = [...query.matchAll(RE_QUERY)].map((_) => {
			const attrs = _.groups.attributes
				? _.groups.attributes.match(RE_QUERY_ATTR)?.groups
				: null;
			return {
				type: _.groups.attributes ? "@" : _.groups.type,
				name: _.groups.name,
				attributes: attrs
					? {
							...attrs,
							value:
								attrs.value_0 || attrs.value_1 || attrs.value_2,
						}
					: null,
			};
		});
	}
	match(node) {
		for (let i = 0; i < this.selectors.length; i++) {
			const { type, name, attributes } = this.selectors[i];
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
					if (!node.classList.contains(name)) {
						return false;
					}
					break;
				case "#":
					if (!(node.getAttribute("id") !== name)) {
						return false;
					}
					break;
				case "@":
					if (attributes) {
						if (!node.hasAttribute(attributes.name)) {
							return false;
						}
						// TODO: Support operator
					}
					return true;
				default:
					throw new Error(
						`Unsupported type: ${type} in ${this.selectors[i]}`,
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
	constructor(name, type) {
		this.nodeName = name;
		this.nodeType = type;
		this.childNodes = [];
		this.parentNode = null;
		this.data = "";
	}

	iterWalk(callback) {
		if (callback(this) !== false) {
			this.childNodes.forEach((_) => _.iterWalk(callback));
		}
	}

	get outerHTML() {
		return this.toXMLLines({ html: true }).join("");
	}

	get innerHTML() {
		return this.childNodes
			.flatMap((_) => _.toXMLLines({ html: true }))
			.join("");
	}

	get innerText() {
		return this.toText();
	}

	querySelector(query) {
		return this.querySelectorAll(query)[0];
	}

	querySelectorAll(query) {
		let scope = [this];
		for (const qs of query.split(/\s+/)) {
			if (qs) {
				const q = new Query(query);
				const matched = [];
				for (const n of scope) {
					n.iterWalk((_) => {
						if (q.match(_)) matched.push(_);
					});
				}
				scope = matched;
			}
			if (scope.length == 0) {
				return scope;
			}
		}
		return query ? scope : [];
	}

	matches(query) {
		return new Query(query).match(this);
	}

	// --
	// ### Common accessors

	get children() {
		return this.childNodes.filter((_) => _.nodeType === Node.ELEMENT_NODE);
	}

	get firstChild() {
		return this.childNodes[0];
	}

	get lastChild() {
		const n = this.childNodes.length;
		return n > 0 ? this.childNodes[n - 1] : null;
	}
	get nextSibling() {
		return this._getSiblingAt(this._index, 1);
	}

	get previousSibling() {
		return this._getSiblingAt(this._index, -1);
	}

	get nodeValue() {}
	get ownerDocument() {}
	get parentElement() {
		return this.parentNode;
	}
	get textContent() {
		return this.childNodes.length
			? this.childNodes.map((_) => _.textContent).join("")
			: this.data;
	}

	// --
	// ### Less common accessors
	get isConnected() {}

	// --
	// ### Common methods
	appendChild(node) {
		if (node === this) {
			throw new Error("Cannot append node to itself");
		}
		if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
			for (const n of node.childNodes) {
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

	after(...nodes) {
		const parent = this.parentNode;
		const next = this.nextSibling;
		for (let i = 0; i < nodes.length; i++) {
			const node = nodes[i];
			if (next) {
				parent.insertBefore(node, next);
			} else {
				parent.appendChild(node);
			}
		}
		return this;
	}

	before(...nodes) {
		const parent = this.parentNode;
		for (let i = 0; i < nodes.length; i++) {
			const node = nodes[i];
			parent.insertBefore(node, this);
		}
		return this;
	}

	cloneNode(deep = false) {
		const n = this._create();
		n.nodeName = this.nodeName;
		n.nodeType = this.nodeType;
		n.data = this.data;
		n.parentNode = null;
		n.childNodes = deep
			? this.childNodes.map((_) => {
					const r = _.cloneNode(deep);
					r.parentNode = n;
					return r;
				})
			: [];
		return n;
	}

	removeChild(child) {
		const i = this.childNodes.indexOf(child);
		if (i >= 0) {
			const child = this.childNodes[i];
			this.childNodes.splice(i, 1);
			child.parentNode = null;
		}
		return this;
	}

	replaceChild(newChild, oldChild) {
		if (newChild === this) {
			throw new Error("Cannot append node to itself");
		}
		if (oldChild.parentNode !== this) {
			throw new Error("Old child is not what is expected");
		}
		const i = this.childNodes.indexOf(oldChild);
		if (i >= 0) {
			oldChild.parentNode = null;
			newChild._detach();
			newChild.parentNode = this;
			this.childNodes[i] = newChild;
		}
		return this;
	}

	insertBefore(newNode, referenceNode) {
		const i = this.childNodes.indexOf(referenceNode);
		if (i >= 0) {
			this.childNodes.splice(i, 0, newNode._attach(this));
		}
		return this;
	}

	// --
	// ### Less common methods

	getRootNode() {
		let node = this;
		while (node.parentNode) {
			node = node.parentNode;
		}
		return node;
	}

	hasChildNodes() {
		return this.childNodes.length;
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
	*iterText(options) {
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
					.replaceAll("&", "&amp;")
					.replaceAll(">", "&gt;")
					.replaceAll("<", "&lt;");
				break;
		}
	}

	toText(options) {
		return [...this.iterText(options)].join("");
	}

	// TODO: iterXMLLines
	toXMLLines(options) {
		return [...this.iterXMLLines(options)];
	}

	*iterXMLLines(options) {
		const has_comments =
			options && options.comments === false ? false : true;
		const has_doctype = options && options.docytpe === false ? false : true;

		switch (this.nodeType) {
			case Node.DOCUMENT_NODE:
			case Node.DOCUMENT_FRAGMENT_NODE:
				if (has_doctype) {
					yield "<?xml version='1.0' charset='utf-8' ?>\n";
				}
				for (const n of this.childNodes) {
					for (const l of n.iterXMLLines(options)) {
						yield l;
					}
				}
				break;
			case Node.ELEMENT_NODE:
				{
					const name = this.namespace
						? `${this.namespace}:${this.nodeName}`
						: `${this.nodeName}`;
					const empty = !options.html
						? undefined
						: HTML_NOEMPTY.has(name)
							? false
							: HTML_EMPTY.has(name)
								? true
								: undefined;
					yield `<${name}`;
					// Handle style attribute
					let styleAttr = null;
					for (let [k, v] of this._attributes.entries()) {
						if (k === "style") {
							styleAttr = v;
						} else if (v && v.value !== undefined) {
							yield v.value === null
								? ` ${k}`
								: ` ${k}="${v.value}"`;
						}
					}

					// Handle style attribute with inline styles
					if (styleAttr || Object.keys(this.style).length > 0) {
						let styleValue = styleAttr ? styleAttr.value : "";
						const inlineStyles = Object.entries(this.style)
							.map(([k, v]) => `${toCSSPropertyName(k)}: ${v}`)
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

					for (const [ns, attrs] of this._attributesNS.entries()) {
						for (let [k, v] of attrs.entries()) {
							if (v && v.value !== undefined) {
								// Map common namespace URIs to their prefixes
								const prefix =
									ns === "http://www.w3.org/1999/xlink"
										? "xlink"
										: ns === "http://www.w3.org/2000/svg"
											? "svg"
											: ns ===
												  "http://www.w3.org/XML/1998/namespace"
												? "xml"
												: null;
								const attrName = prefix ? `${prefix}:${k}` : k;
								yield v.value === null
									? ` ${attrName}`
									: ` ${attrName}="${v.value}"`;
							}
						}
					}
					if (options.html && empty === true) {
						yield " >";
					} else if (this.childNodes.length == 0 && empty !== false) {
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
					.replaceAll("&", "&amp;")
					.replaceAll(">", "&gt;")
					.replaceAll("<", "&lt;");
				break;
			case Node.COMMENT_NODE:
				if (has_comments) {
					yield `<!--${
						this.data ? this.data.replaceAll(">", "&gt;") : ""
					}-->`;
				}
				break;
		}
	}

	toXML(options = {}) {
		return this.toXMLLines(options).join("");
	}

	toHTML(options = {}) {
		return this.toXMLLines({ ...options, html: true }).join("");
	}

	toJSON() {
		return {
			name: this.nodeName,
			children: this.childNodes.map((_) => _.toJSON()),
		};
	}

	// --
	// ### Helpers

	get _index() {
		return this.parentNode ? this.parentNode.childNodes.indexOf(this) : -1;
	}

	_create() {
		return new Node();
	}

	_detach() {
		if (this.parentNode) this.parentNode.removeChild(this);
		return this;
	}

	_attach(parentNode) {
		if (parentNode === this) {
			throw new Error("Cannot append node to itself");
		}
		if (parentNode !== this.parentNode) {
			this._detach();
			this.parentNode = parentNode;
		}
		return this;
	}

	_getSiblingAt(index, offset = 0) {
		return this.parentNode?.childNodes[index + offset] || null;
	}
}

class DataSetProxy {
	static get(target, property) {
		// TODO: We may need to do de-camel-case
		if (typeof property === "string") {
			const attr = target._attributes.get(`data-${property}`);
			return attr ? attr.value : undefined;
		}
		return target[property];
	}
}

export class AttributeNode extends Node {
	constructor(name, namespace, ownerElement) {
		super(name, Node.ATTRIBUTE_NODE);
		this.name = name;
		this.namespace = namespace;
		this.ownerElement = ownerElement;
		this._value = undefined;
	}

	get value() {
		if (this.ownerElement) {
			if (this.namespace) {
				const nsMap = this.ownerElement._attributesNS.get(
					this.namespace,
				);
				const attr = nsMap ? nsMap.get(this.name) : null;
				return attr ? attr._value : "";
			} else {
				const attr = this.ownerElement._attributes.get(this.name);
				return attr ? attr._value : "";
			}
		}
		return this._value || "";
	}

	set value(value) {
		this._value = value;
		if (this.ownerElement) {
			if (this.namespace) {
				// For namespaced attributes, set directly in the map to avoid recursion
				if (!this.ownerElement._attributesNS.has(this.namespace)) {
					this.ownerElement._attributesNS.set(
						this.namespace,
						new Map(),
					);
				}
				this.ownerElement._attributesNS
					.get(this.namespace)
					.set(this.name, this);
			} else {
				// For regular attributes, set directly in the map to avoid recursion
				this.ownerElement._attributes.set(this.name, this);
			}
		}
	}

	get nodeValue() {
		return this.value;
	}

	setNodeValue(value) {
		this.value = value;
	}
}

export class Element extends Node {
	constructor(name, namespace) {
		super(name, Node.ELEMENT_NODE);
		this.namespace = namespace;
		this.style = {};
		this._attributes = new Map();
		this._attributesNS = new Map();
		this.classList = new TokenList(this, "class");
		this.sheet = name === "style" ? new StyleSheet() : null;
		this.dataset = new Proxy(this, DataSetProxy);
	}

	get id() {
		return this.getAttribute("id");
	}

	get attributes() {
		return [...this._attributes.values()].concat(
			[...this._attributesNS.values()].flatMap((nsMap) => [
				...nsMap.values(),
			]),
		);
	}

	removeAttribute(name) {
		if (name === "style") {
			this.style = {};
		}
		this._attributes.delete(name);
	}

	removeAttributeNS(namespace, name) {
		if (this._attributesNS.has(namespace)) {
			this._attributesNS.get(namespace).delete(name);
		}
	}

	setAttribute(name, value) {
		const attrNode = new AttributeNode(name, null, this);
		attrNode.value = value;
		this._attributes.set(name, attrNode);
	}

	setAttributeNode(node) {
		node.ownerElement = this;
		if (node.namespace) {
			if (!this._attributesNS.has(node.namespace)) {
				this._attributesNS.set(node.namespace, new Map());
			}
			this._attributesNS.get(node.namespace).set(node.name, node);
		} else {
			this._attributes.set(node.name, node);
		}
	}

	getAttributeNode(name) {
		return this._attributes.get(name) || null;
	}

	setAttributeNS(ns, name, value) {
		if (!this._attributesNS.has(ns)) {
			this._attributesNS.set(ns, new Map());
		}
		const attrNode = new AttributeNode(name, ns, this);
		attrNode.value = value;
		this._attributesNS.get(ns).set(name, attrNode);
	}

	hasAttribute(name) {
		return this._attributes.has(name);
	}
	hasAttributeNS(namespace, name) {
		return this._attributesNS.get(namespace)?.has(name) || false;
	}

	getAttribute(name) {
		const attr = this._attributes.get(name);
		return attr ? attr.value : null;
	}

	getAttributeNS(ns, name) {
		const nsMap = this._attributesNS.get(ns);
		if (nsMap) {
			const attr = nsMap.get(name);
			return attr ? attr.value : null;
		}
		return null;
	}

	getAttributeNodeNS(ns, name) {
		const nsMap = this._attributesNS.get(ns);
		return nsMap ? nsMap.get(name) || null : null;
	}

	cloneNode(deep) {
		const res = super.cloneNode(deep);
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

	_create() {
		return new Element(this.name, this.namespace);
	}
	toJSON() {
		const res = super.toJSON();
		const attr = {};
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
	constructor(name, namespace) {
		super(name, namespace);
		this.content = new DocumentFragment();
	}
	appendChild(node) {
		this.content.appendChild(node);
		return this;
	}
}
export class TextNode extends Node {
	constructor(data) {
		super("#text", Node.TEXT_NODE);
		this.data = data;
	}

	_create() {
		return new TextNode(this.data);
	}
	get nodeValue() {
		return this.data;
	}
	toJSON() {
		return this.data;
	}
}

export class Comment extends Node {
	constructor(data) {
		super("#comment", Node.COMMENT_NODE);
		this.data = data;
	}
	_create() {
		return new Comment(this.data);
	}
	get nodeValue() {
		return this.data;
	}
	toJSON() {
		return undefined;
	}
}
export class DocumentFragment extends Node {
	constructor() {
		super("document-fragment", Node.DOCUMENT_FRAGMENT_NODE);
	}
}

export class Document extends Node {
	constructor(nodes) {
		super("#document", Node.DOCUMENT_NODE);
		this.body = new Element("body");
		this._elements = new Array();
		// Non standard
		if (nodes) {
			for (const node of nodes) {
				node && this.appendChild(node);
			}
		}
	}

	getElementById(id) {
		for (let i in this._elements) {
			const n = this._elements[i];
			if (n.id === id) {
				return n;
			}
		}
		return null;
	}

	createTreeWalker(node, nodeFilter) {
		return new TreeWalker(node, nodeFilter);
	}

	createTextNode(value) {
		return new TextNode(value);
	}

	createAttribute(name) {
		return new AttributeNode(name, null, null);
	}

	createComment(value) {
		return new Comment(value);
	}

	createDocumentFragment() {
		return new DocumentFragment();
	}

	createElement(name) {
		let element = null;
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

	createElementNS(namespace, name) {
		return this._register(new Element(name, namespace));
	}
	_register(element) {
		this._elements.push(element);
		return element;
	}
	_create() {
		return new Document();
	}
}

export class NodeFilter {
	static SHOW_ALL = 4294967295;
	static SHOW_ATTRIBUTE = 2;
	static SHOW_CDATA_SECTION = 8;
	static SHOW_COMMENT = 128;
	static SHOW_DOCUMENT = 256;
	static SHOW_DOCUMENT_FRAGMENT = 1024;
	static SHOW_DOCUMENT_TYPE = 512;
	static SHOW_ELEMENT = 1;
	static SHOW_ENTITY_REFERENCE = 16;
	static SHOW_ENTITY = 32;
	static SHOW_PROCESSING = 64;
	static SHOW_NOTATION = 2048;
	static SHOW_TEXT = 4;
}

export class TreeWalker {
	constructor(root, nodeFilter, predicate) {
		this.root = root;
		this.currentNode = root;
		this.nodeFilter = nodeFilter;
		this.predicate = predicate;
		// TODO: Support attributes
	}
	_nextNode(node) {
		if (!node) {
			return null;
		} else if (node.childNodes) {
			return node.childNodes[0];
		} else if (node.nextSibling) {
			return node.nextSibling;
		} else {
			let node = this.currentNode.parentNode;
			while (node.parentNode) {
				node = node.parentNode;
				if (node.nextSibling) {
					return node.nextSibling;
				}
			}
			return null;
		}
	}
	_acceptNode(node) {
		switch (node.nodeType) {
			case Node.ELEMENT_NODE:
				return this.nodeFilter & NodeFilter.SHOW_ELEMENT;
			case Node.ATTRIBUTE_NODE:
				return this.nodeFilter & NodeFilter.SHOW_ATTRIBUTE;
			case Node.CDATA_SECTION_NODE:
				return this.nodeFilter & NodeFilter.SHOW_CDATA_SECTION;
			case Node.PROCESSING_INSTRUCTION_NODE:
				return this.nodeFilter & NodeFilter.SHOW_PROCESSING;
			case Node.DOCUMENT_NODE:
				return this.nodeFilter & NodeFilter.SHOW_DOCUMENT;
			case Node.DOCUMENT_TYPE_NODE:
				return this.nodeFilter & NodeFilter.SHOW_DOCUMENT_TYPE;
			case Node.DOCUMENT_FRAGMENT_NODE:
				return this.nodeFilter & NodeFilter.SHOW_DOCUMENT_FRAGMENT;
			case Node.TEXT_NODE:
				return this.nodeFilter & NodeFilter.SHOW_TEXT;
			case Node.COMMENT_NODE:
				return this.nodeFilter & NodeFilter.SHOW_COMMENT;
			default:
				return false;
		}
	}
	nextNode() {
		let next = this._nextNode(this.currentNode);
		while (next && !this._acceptNode(next)) {
			next = this._nextNode(next);
		}
		this.currentNode = next;
		return next;
	}
}
// --
// ## Token List
//
// This is used to work with `classList`, for instance.
//
export class TokenList {
	constructor(element, attribute = "class") {
		this.element = element;
		this.attribute = attribute;
	}

	add(value) {
		if (!this.contains(value)) {
			const v = this._get();
			this._set(v ? `${v} ${value}` : value);
		}
	}
	contains(value) {
		return this._get().split(" ").indexOf(value) >= 0;
	}
	remove(value) {
		this._set(
			this._get()
				.split(" ")
				.filter((_) => _ == value)
				.join(" "),
		);
	}
	toggle(value) {
		return this.contains(value)
			? this.remove(value) && false
			: this.add(value) || true;
	}
	_get() {
		return this.element.getAttribute(this.attribute) || "";
	}
	_set(value) {
		this.element.setAttribute(this.attribute, value);
	}
}

export class StyleSheet {
	constructor() {
		this.cssRules = [];
	}
	deleteRule(index) {
		this.cssRules.splice(index, 1);
		return this;
	}
	insertRule(rule, index = 0) {
		this.cssRules.splice(index, 0, rule);
		return this;
	}
}

const toCSSPropertyName = (name) => {
	const property = /[A-Za-z][a-z]*/g;
	const res = [];
	let match = null;
	while ((match = property.exec(name)) !== null) {
		res.push(match[0].toLowerCase());
	}
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

const DOM = {
	Node,
	Element,
	Document,
	NodeList,
	NodeFilter,
	StyleSheetList,
	document,
};

export function install(target = globalThis) {
	return Object.assign(target, DOM);
}

export default DOM;

// EOF
