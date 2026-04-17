import { beforeEach, describe, expect, test } from "bun:test";
import {
	AttributeNode,
	Comment,
	Document,
	DocumentFragment,
	document,
	Element,
	HTML_EMPTY,
	install,
	Node,
	NodeFilter,
	StyleSheet,
	TemplateElement,
	TextNode,
	TokenList,
	TreeWalker,
} from "../src/ts/domish/domish.js";
import { Event } from "../src/ts/domish/events.js";

describe("Node constants", () => {
	test("nodeType constants are defined", () => {
		expect(Node.ELEMENT_NODE).toBe(1);
		expect(Node.ATTRIBUTE_NODE).toBe(2);
		expect(Node.TEXT_NODE).toBe(3);
		expect(Node.COMMENT_NODE).toBe(8);
		expect(Node.DOCUMENT_NODE).toBe(9);
		expect(Node.DOCUMENT_FRAGMENT_NODE).toBe(11);
	});

	test("NodeNamespaces are defined", () => {
		expect(Node.Namespaces.svg).toBe("http://www.w3.org/2000/svg");
		expect(Node.Namespaces.xlink).toBe("http://www.w3.org/1999/xlink");
	});
});

describe("Node class", () => {
	let node: Node;

	beforeEach(() => {
		node = new Node("test", Node.ELEMENT_NODE);
	});

	test("creates with correct properties", () => {
		expect(node.nodeName).toBe("test");
		expect(node.nodeType).toBe(Node.ELEMENT_NODE);
		expect(node.childNodes).toEqual([]);
		expect(node.parentNode).toBeNull();
		expect(node.data).toBe("");
	});

	test("children getter returns element children only", () => {
		const parent = new Element("parent");
		const child = new Element("child");
		const text = new TextNode("text");
		parent.appendChild(text);
		parent.appendChild(child);
		expect(parent.children).toEqual([child]);
	});

	test("firstChild and lastChild", () => {
		const parent = new Element("parent");
		const child1 = new Element("child1");
		const child2 = new Element("child2");
		parent.appendChild(child1);
		parent.appendChild(child2);
		expect(parent.firstChild).toBe(child1);
		expect(parent.lastChild).toBe(child2);
	});

	test("hasChildNodes", () => {
		const parent = new Element("parent");
		expect(parent.hasChildNodes()).toBe(false);
		parent.appendChild(new Element("child"));
		expect(parent.hasChildNodes()).toBe(true);
	});

	test("textContent getter", () => {
		const parent = new Element("parent");
		parent.appendChild(new TextNode("hello"));
		parent.appendChild(new TextNode(" world"));
		expect(parent.textContent).toBe("hello world");
	});
});

describe("Element class", () => {
	let element: Element;

	beforeEach(() => {
		element = new Element("div");
	});

	test("creates element with correct properties", () => {
		expect(element.nodeName).toBe("div");
		expect(element.nodeType).toBe(Node.ELEMENT_NODE);
		expect(element.namespace).toBeNull();
		expect(element.style).toEqual({});
	});

	test("setAttribute and getAttribute", () => {
		element.setAttribute("id", "test-id");
		element.setAttribute("class", "test-class");
		expect(element.getAttribute("id")).toBe("test-id");
		expect(element.getAttribute("class")).toBe("test-class");
		expect(element.getAttribute("nonexistent")).toBeNull();
	});

	test("hasAttribute", () => {
		element.setAttribute("id", "test");
		expect(element.hasAttribute("id")).toBe(true);
		expect(element.hasAttribute("class")).toBe(false);
	});

	test("removeAttribute", () => {
		element.setAttribute("id", "test");
		element.removeAttribute("id");
		expect(element.hasAttribute("id")).toBe(false);
		expect(element.getAttribute("id")).toBeNull();
	});

	test("attributes getter returns all attributes", () => {
		element.setAttribute("id", "test");
		element.setAttribute("class", "test");
		const attrs = element.attributes;
		expect(attrs.length).toBe(2);
		expect(attrs.map((a) => a.name)).toContain("id");
		expect(attrs.map((a) => a.name)).toContain("class");
	});

	test("namespace support with setAttributeNS", () => {
		element.setAttributeNS("http://www.w3.org/1999/xlink", "href", "http://example.com");
		expect(element.getAttributeNS("http://www.w3.org/1999/xlink", "href")).toBe(
			"http://example.com",
		);
		expect(element.hasAttributeNS("http://www.w3.org/1999/xlink", "href")).toBe(true);
	});

	test("id getter", () => {
		element.setAttribute("id", "my-id");
		expect(element.id).toBe("my-id");
	});

	test("style object", () => {
		element.style.color = "red";
		element.style.backgroundColor = "blue";
		expect(element.style.color).toBe("red");
		expect(element.style.backgroundColor).toBe("blue");
	});

	test("classList", () => {
		element.classList.add("active");
		element.classList.add("hidden");
		expect(element.classList.contains("active")).toBe(true);
		expect(element.classList.contains("hidden")).toBe(true);
		expect(element.classList.contains("nonexistent")).toBe(false);
		element.classList.remove("active");
		expect(element.classList.contains("active")).toBe(false);
		expect(element.classList.toggle("visible")).toBe(true);
		expect(element.classList.toggle("visible")).toBe(false);
	});

	test("dataset proxy exists", () => {
		expect(element.dataset).toBeDefined();
	});
});

describe("Document class", () => {
	let doc: Document;

	beforeEach(() => {
		doc = new Document();
	});

	test("createElement", () => {
		const el = doc.createElement("div");
		expect(el.nodeName).toBe("div");
		expect(el.nodeType).toBe(Node.ELEMENT_NODE);
	});

	test("createTextNode", () => {
		const text = doc.createTextNode("hello");
		expect(text.nodeName).toBe("#text");
		expect(text.nodeType).toBe(Node.TEXT_NODE);
		expect(text.data).toBe("hello");
	});

	test("createComment", () => {
		const comment = doc.createComment("test comment");
		expect(comment.nodeName).toBe("#comment");
		expect(comment.nodeType).toBe(Node.COMMENT_NODE);
		expect(comment.data).toBe("test comment");
	});

	test("createDocumentFragment", () => {
		const fragment = doc.createDocumentFragment();
		expect(fragment.nodeType).toBe(Node.DOCUMENT_FRAGMENT_NODE);
	});

	test("getElementById", () => {
		const el = doc.createElement("div");
		el.setAttribute("id", "test-id");
		doc.createElement("div");
		doc.createElement("div");
		expect(doc.getElementById("test-id")).toBe(el);
		expect(doc.getElementById("nonexistent")).toBeNull();
	});

	test("createElement with template", () => {
		const template = doc.createElement("template") as TemplateElement;
		expect(template).toBeInstanceOf(TemplateElement);
		expect(template.content).toBeInstanceOf(DocumentFragment);
	});

	test("createTreeWalker", () => {
		const root = doc.createElement("root");
		const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
		expect(walker).toBeInstanceOf(TreeWalker);
		expect(walker.root).toBe(root);
	});
});

describe("TreeWalker", () => {
	test("creates with root and filter", () => {
		const doc = new Document();
		const root = doc.createElement("root");
		const child = doc.createElement("child");
		root.appendChild(child);

		const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
		expect(walker.root).toBe(root);
		expect(walker.currentNode).toBe(root);
	});

	test("filters by node type", () => {
		const doc = new Document();
		const root = doc.createElement("root");
		root.appendChild(doc.createTextNode("text"));
		root.appendChild(doc.createElement("child"));

		const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
		const nodes: string[] = [];
		let node = walker.nextNode();
		while (node) {
			nodes.push(node.nodeName);
			node = walker.nextNode();
		}
		expect(nodes).toEqual(["#text"]);
	});
});

describe("DOM tree operations", () => {
	let doc: Document;

	beforeEach(() => {
		doc = new Document();
	});

	test("appendChild", () => {
		const parent = doc.createElement("parent");
		const child = doc.createElement("child");
		parent.appendChild(child);
		expect(parent.childNodes).toContain(child);
		expect(child.parentNode).toBe(parent);
	});

	test("appendChild moves node from existing parent", () => {
		const parent1 = doc.createElement("parent1");
		const parent2 = doc.createElement("parent2");
		const child = doc.createElement("child");
		parent1.appendChild(child);
		parent2.appendChild(child);
		expect(parent1.childNodes).not.toContain(child);
		expect(parent2.childNodes).toContain(child);
		expect(child.parentNode).toBe(parent2);
	});

	test("insertBefore", () => {
		const parent = doc.createElement("parent");
		const child1 = doc.createElement("child1");
		const child2 = doc.createElement("child2");
		parent.appendChild(child1);
		parent.insertBefore(child2, child1);
		expect(parent.childNodes[0]).toBe(child2);
		expect(parent.childNodes[1]).toBe(child1);
	});

	test("insertBefore with null inserts at end", () => {
		const parent = doc.createElement("parent");
		const child1 = doc.createElement("child1");
		parent.appendChild(child1);
		const child2 = doc.createElement("child2");
		parent.insertBefore(child2, null);
		expect(parent.childNodes[1]).toBe(child2);
	});

	test("removeChild", () => {
		const parent = doc.createElement("parent");
		const child = doc.createElement("child");
		parent.appendChild(child);
		parent.removeChild(child);
		expect(parent.childNodes).not.toContain(child);
		expect(child.parentNode).toBeNull();
	});

	test("replaceChild", () => {
		const parent = doc.createElement("parent");
		const oldChild = doc.createElement("old");
		const newChild = doc.createElement("new");
		parent.appendChild(oldChild);
		parent.replaceChild(newChild, oldChild);
		expect(parent.childNodes[0]).toBe(newChild);
		expect(oldChild.parentNode).toBeNull();
	});

	test("DocumentFragment appendChild", () => {
		const fragment = new DocumentFragment();
		const child1 = new Element("child1");
		const child2 = new Element("child2");
		fragment.appendChild(child1);
		fragment.appendChild(child2);
		expect(fragment.childNodes.length).toBe(2);

		const parent = new Element("parent");
		parent.appendChild(fragment);
		expect(parent.childNodes.length).toBe(2);
		expect(fragment.childNodes.length).toBe(0);
	});

	test("after inserts after node", () => {
		const parent = doc.createElement("parent");
		const child1 = doc.createElement("child1");
		const child2 = doc.createElement("child2");
		parent.appendChild(child1);
		child1.after(child2);
		expect(parent.childNodes[0]).toBe(child1);
		expect(parent.childNodes[1]).toBe(child2);
	});
});

describe("cloneNode", () => {
	test("shallow clone", () => {
		const doc = new Document();
		const original = doc.createElement("div");
		original.setAttribute("id", "test");
		original.appendChild(doc.createTextNode("text"));
		const clone = original.cloneNode(false);
		expect(clone.nodeName).toBe("div");
		expect(clone.getAttribute("id")).toBe("test");
		expect(clone.childNodes.length).toBe(0);
		expect(clone.parentNode).toBeNull();
	});

	test("deep clone", () => {
		const doc = new Document();
		const original = doc.createElement("div");
		original.setAttribute("id", "test");
		const child = doc.createElement("span");
		original.appendChild(child);
		const clone = original.cloneNode(true);
		expect(clone.childNodes.length).toBe(1);
		expect(clone.getAttribute("id")).toBe("test");
		expect(clone.childNodes[0]).not.toBe(child);
	});
});

describe("querySelector/querySelectorAll", () => {
	test("iterWalk traverses tree", () => {
		const doc = new Document();
		const root = doc.createElement("root");
		const child = doc.createElement("child");
		root.appendChild(child);
		const visited: string[] = [];
		root.iterWalk((n) => {
			visited.push(n.nodeName);
			return undefined;
		});
		expect(visited).toContain("root");
		expect(visited).toContain("child");
	});
});

describe("serialization", () => {
	let doc: Document;

	beforeEach(() => {
		doc = new Document();
	});

	test("toXML basic element", () => {
		const el = doc.createElement("div");
		expect(el.toXML()).toBe("<div />");
	});

	test("toXML with attributes", () => {
		const el = doc.createElement("div");
		el.setAttribute("id", "test");
		expect(el.toXML()).toBe('<div id="test" />');
	});

	test("toXML with children", () => {
		const parent = doc.createElement("parent");
		const child = doc.createElement("child");
		parent.appendChild(child);
		expect(parent.toXML()).toBe("<parent><child /></parent>");
	});

	test("toXML with text content", () => {
		const el = doc.createElement("p");
		el.appendChild(doc.createTextNode("Hello"));
		expect(el.toXML()).toBe("<p>Hello</p>");
	});

	test("toHTML self-closing tags", () => {
		const br = doc.createElement("br");
		expect(br.toHTML()).toBe("<br >");
		const img = doc.createElement("img");
		img.setAttribute("src", "test.png");
		expect(img.toHTML()).toBe('<img src="test.png" >');
	});

	test("outerHTML", () => {
		const el = doc.createElement("div");
		el.setAttribute("id", "test");
		expect(el.outerHTML).toBe('<div id="test" />');
	});

	test("innerHTML", () => {
		const parent = doc.createElement("div");
		parent.appendChild(doc.createTextNode("text"));
		const child = doc.createElement("span");
		parent.appendChild(child);
		expect(parent.innerHTML).toBe("text<span />");
	});

	test("innerText", () => {
		const parent = doc.createElement("div");
		parent.appendChild(doc.createTextNode("Hello"));
		parent.appendChild(doc.createTextNode(" World"));
		expect(parent.innerText).toBe("Hello World");
	});
});

describe("events", () => {
	test("addEventListener and dispatchEvent", () => {
		const el = new Element("div");
		let called = false;
		el.addEventListener("click", () => {
			called = true;
		});
		el.dispatchEvent(new Event("click"));
		expect(called).toBe(true);
	});

	test("removeEventListener", () => {
		const el = new Element("div");
		let count = 0;
		const handler = () => count++;
		el.addEventListener("click", handler);
		el.dispatchEvent(new Event("click"));
		el.removeEventListener("click", handler);
		el.dispatchEvent(new Event("click"));
		expect(count).toBe(1);
	});

	test("dispatchEvent returns false if defaultPrevented", () => {
		const el = new Element("div");
		const event = new Event("test", { cancelable: true });
		event.preventDefault();
		const result = el.dispatchEvent(event);
		expect(result).toBe(false);
	});
});

describe("StyleSheet", () => {
	test("insertRule and deleteRule", () => {
		const sheet = new StyleSheet();
		sheet.insertRule(".test { color: red; }");
		expect(sheet.cssRules.length).toBe(1);
		expect(sheet.cssRules[0]).toBe(".test { color: red; }");
		sheet.deleteRule(0);
		expect(sheet.cssRules.length).toBe(0);
	});

	test("insertRule at index", () => {
		const sheet = new StyleSheet();
		sheet.insertRule(".a {}");
		sheet.insertRule(".b {}", 0);
		expect(sheet.cssRules[0]).toBe(".b {}");
	});
});

describe("HTML_EMPTY tags", () => {
	test("br serializes as self-closing in HTML", () => {
		const br = new Element("br");
		expect(br.toHTML()).toBe("<br >");
	});

	test("img serializes as self-closing in HTML", () => {
		const img = new Element("img");
		img.setAttribute("src", "test.png");
		expect(img.toHTML()).toBe('<img src="test.png" >');
	});
});

describe("global document", () => {
	test("document exists and is a Document", () => {
		expect(document).toBeDefined();
		expect(document.nodeType).toBe(Node.DOCUMENT_NODE);
	});

	test("document can create elements", () => {
		const el = document.createElement("div");
		expect(el.nodeName).toBe("div");
	});
});

describe("querySelector/querySelectorAll matching", () => {
	let doc: Document;

	beforeEach(() => {
		doc = new Document();
	});

	test("matches element by tag name", () => {
		const el = doc.createElement("div");
		expect(el.matches("div")).toBe(true);
		expect(el.matches("span")).toBe(false);
	});

	test("matches element by class name", () => {
		const el = doc.createElement("div");
		el.setAttribute("class", "foo bar");
		expect(el.matches(".foo")).toBe(true);
		expect(el.matches(".bar")).toBe(true);
		expect(el.matches(".baz")).toBe(false);
	});

	test("matches element by id", () => {
		const el = doc.createElement("div");
		el.setAttribute("id", "main");
		expect(el.matches("#main")).toBe(true);
		expect(el.matches("#other")).toBe(false);
	});

	test("querySelectorAll finds elements by tag name", () => {
		const root = doc.createElement("div");
		const child1 = doc.createElement("span");
		const child2 = doc.createElement("span");
		const other = doc.createElement("p");
		root.appendChild(child1);
		root.appendChild(other);
		other.appendChild(child2);

		const results = root.querySelectorAll("span");
		expect(results.length).toBe(2);
		expect(results).toContain(child1);
		expect(results).toContain(child2);
	});

	test("querySelectorAll finds nested elements", () => {
		const root = doc.createElement("table");
		const tbody = doc.createElement("tbody");
		const tr = doc.createElement("tr");
		const td = doc.createElement("td");
		root.appendChild(tbody);
		tbody.appendChild(tr);
		tr.appendChild(td);

		expect(root.querySelectorAll("tbody").length).toBe(1);
		expect(root.querySelectorAll("tr").length).toBe(1);
		expect(root.querySelectorAll("td").length).toBe(1);
		expect(root.querySelector("td")).toBe(td);
	});

	test("querySelectorAll finds elements by class", () => {
		const root = doc.createElement("div");
		const a = doc.createElement("span");
		a.setAttribute("class", "highlight");
		const b = doc.createElement("span");
		root.appendChild(a);
		root.appendChild(b);

		const results = root.querySelectorAll(".highlight");
		expect(results.length).toBe(1);
		expect(results[0]).toBe(a);
	});

	test("querySelectorAll with descendant combinator", () => {
		const root = doc.createElement("div");
		const ul = doc.createElement("ul");
		const li = doc.createElement("li");
		root.appendChild(ul);
		ul.appendChild(li);

		// "ul li" should match li elements inside ul
		const results = root.querySelectorAll("ul li");
		expect(results.length).toBe(1);
		expect(results[0]).toBe(li);
	});

	test("querySelector returns undefined when no match", () => {
		const root = doc.createElement("div");
		expect(root.querySelector("span")).toBeUndefined();
	});
});

describe("document.querySelector searches through body", () => {
	test("document.querySelector finds elements appended to body", () => {
		const doc = new Document();
		const div = doc.createElement("div");
		doc.body.appendChild(div);
		const table = doc.createElement("table");
		div.appendChild(table);
		const tbody = doc.createElement("tbody");
		table.appendChild(tbody);

		// document.querySelector should find tbody even though body
		// is not in the document's childNodes list.
		expect(doc.querySelector("tbody")).toBe(tbody);
	});

	test("document.querySelectorAll finds multiple elements through body", () => {
		const doc = new Document();
		const tr1 = doc.createElement("tr");
		const tr2 = doc.createElement("tr");
		const tbody = doc.createElement("tbody");
		tbody.appendChild(tr1);
		tbody.appendChild(tr2);
		doc.body.appendChild(tbody);

		const results = doc.querySelectorAll("tr");
		expect(results.length).toBe(2);
		expect(results).toContain(tr1);
		expect(results).toContain(tr2);
	});

	test("document.querySelector prefers childNodes over body fallback", () => {
		const doc = new Document();
		const direct = doc.createElement("section");
		doc.appendChild(direct);
		const inBody = doc.createElement("section");
		doc.body.appendChild(inBody);

		// Should find the directly-appended one first
		expect(doc.querySelector("section")).toBe(direct);
	});
});

describe("install creates fresh document", () => {
	test("install resets document between calls", () => {
		install();
		const div = globalThis.document.createElement("div");
		globalThis.document.body.appendChild(div);
		expect(globalThis.document.body.childNodes.length).toBe(1);

		// Second install should give a fresh document with empty body
		install();
		expect(globalThis.document.body.childNodes.length).toBe(0);
	});

	test("install produces a working document", () => {
		install();
		const el = globalThis.document.createElement("span");
		globalThis.document.body.appendChild(el);
		expect(globalThis.document.body.querySelector("span")).toBe(el);
	});
});
