import { describe, expect, test } from "bun:test";
import { Document, Element, TextNode } from "../src/ts/domish/domish.js";
import { markdown } from "../src/ts/domish/markish.js";

function createElement(name: string): Element {
	return new Element(name);
}

function createTextNode(text: string): TextNode {
	return new TextNode(text);
}

describe("markdown conversion", () => {
	test("converts h1", () => {
		const doc = new Document();
		const h1 = createElement("h1");
		h1.appendChild(createTextNode("Heading 1"));
		doc.body.appendChild(h1);
		expect(markdown(doc.body)).toBe("# Heading 1");
	});

	test("converts h2", () => {
		const doc = new Document();
		const h2 = createElement("h2");
		h2.appendChild(createTextNode("Heading 2"));
		doc.body.appendChild(h2);
		expect(markdown(doc.body)).toBe("## Heading 2");
	});

	test("converts h3", () => {
		const doc = new Document();
		const h3 = createElement("h3");
		h3.appendChild(createTextNode("Heading 3"));
		doc.body.appendChild(h3);
		expect(markdown(doc.body)).toBe("### Heading 3");
	});

	test("converts h4", () => {
		const doc = new Document();
		const h4 = createElement("h4");
		h4.appendChild(createTextNode("Heading 4"));
		doc.body.appendChild(h4);
		expect(markdown(doc.body)).toBe("#### Heading 4");
	});

	test("converts h5", () => {
		const doc = new Document();
		const h5 = createElement("h5");
		h5.appendChild(createTextNode("Heading 5"));
		doc.body.appendChild(h5);
		expect(markdown(doc.body)).toBe("##### Heading 5");
	});

	test("converts h6", () => {
		const doc = new Document();
		const h6 = createElement("h6");
		h6.appendChild(createTextNode("Heading 6"));
		doc.body.appendChild(h6);
		expect(markdown(doc.body)).toBe("###### Heading 6");
	});

	test("converts bold (strong)", () => {
		const doc = new Document();
		const p = createElement("p");
		const strong = createElement("strong");
		strong.appendChild(createTextNode("bold text"));
		p.appendChild(strong);
		doc.body.appendChild(p);
		expect(markdown(doc.body)).toBe("**bold text **");
	});

	test("converts italic (em)", () => {
		const doc = new Document();
		const p = createElement("p");
		const em = createElement("em");
		em.appendChild(createTextNode("italic text"));
		p.appendChild(em);
		doc.body.appendChild(p);
		expect(markdown(doc.body)).toBe("_italic text _");
	});

	test("converts inline code", () => {
		const doc = new Document();
		const p = createElement("p");
		const code = createElement("code");
		code.appendChild(createTextNode("inline code"));
		p.appendChild(code);
		doc.body.appendChild(p);
		expect(markdown(doc.body)).toBe("`inline code `");
	});

	test("converts code block (pre)", () => {
		const doc = new Document();
		const pre = createElement("pre");
		pre.appendChild(createTextNode("code block"));
		doc.body.appendChild(pre);
		const result = markdown(doc.body);
		expect(result.startsWith("```")).toBe(true);
		expect(result.endsWith("```")).toBe(true);
	});

	test("converts blockquote", () => {
		const doc = new Document();
		const blockquote = createElement("blockquote");
		blockquote.appendChild(createTextNode("quoted text"));
		doc.body.appendChild(blockquote);
		expect(markdown(doc.body)).toBe("> quoted text");
	});

	test("converts unordered list", () => {
		const doc = new Document();
		const ul = createElement("ul");
		const li1 = createElement("li");
		li1.appendChild(createTextNode("item 1"));
		const li2 = createElement("li");
		li2.appendChild(createTextNode("item 2"));
		ul.appendChild(li1);
		ul.appendChild(li2);
		doc.body.appendChild(ul);
		expect(markdown(doc.body)).toBe("- item 1   - item 2");
	});

	test("converts ordered list", () => {
		const doc = new Document();
		const ol = createElement("ol");
		const li1 = createElement("li");
		li1.appendChild(createTextNode("first"));
		const li2 = createElement("li");
		li2.appendChild(createTextNode("second"));
		ol.appendChild(li1);
		ol.appendChild(li2);
		doc.body.appendChild(ol);
		expect(markdown(doc.body)).toBe("1. first   1. second");
	});

	test("converts link", () => {
		const doc = new Document();
		const p = createElement("p");
		const a = createElement("a");
		a.setAttribute("href", "http://example.com");
		a.appendChild(createTextNode("link text"));
		p.appendChild(a);
		doc.body.appendChild(p);
		expect(markdown(doc.body)).toBe("[link text ](http://example.com)");
	});

	test("converts image", () => {
		const doc = new Document();
		const p = createElement("p");
		const img = createElement("img");
		img.setAttribute("src", "image.png");
		img.setAttribute("alt", "alt text");
		p.appendChild(img);
		doc.body.appendChild(p);
		expect(markdown(doc.body)).toBe("![alt text](image.png)");
	});

	test("converts paragraph", () => {
		const doc = new Document();
		const p = createElement("p");
		p.appendChild(createTextNode("This is a paragraph."));
		doc.body.appendChild(p);
		expect(markdown(doc.body)).toBe("This is a paragraph.");
	});

	test("converts br tag", () => {
		const doc = new Document();
		const p = createElement("p");
		p.appendChild(createTextNode("line one"));
		p.appendChild(createElement("br"));
		p.appendChild(createTextNode("line two"));
		doc.body.appendChild(p);
		expect(markdown(doc.body)).toBe("line one \nline two");
	});

	test("multiple paragraphs", () => {
		const doc = new Document();
		const p1 = createElement("p");
		p1.appendChild(createTextNode("First paragraph"));
		const p2 = createElement("p");
		p2.appendChild(createTextNode("Second paragraph"));
		doc.body.appendChild(p1);
		doc.body.appendChild(p2);
		const result = markdown(doc.body);
		expect(result.includes("First paragraph")).toBe(true);
		expect(result.includes("Second paragraph")).toBe(true);
	});

	test("trims output", () => {
		const doc = new Document();
		const p = createElement("p");
		p.appendChild(createTextNode("  spaced  "));
		doc.body.appendChild(p);
		expect(markdown(doc.body)).toBe("spaced");
	});

	describe("tables", () => {
		test("converts simple table with thead and tbody", () => {
			const doc = new Document();
			const table = createElement("table");
			const thead = createElement("thead");
			const tbody = createElement("tbody");

			// Header row
			const headerRow = createElement("tr");
			const th1 = createElement("th");
			th1.appendChild(createTextNode("Name"));
			const th2 = createElement("th");
			th2.appendChild(createTextNode("Age"));
			headerRow.appendChild(th1);
			headerRow.appendChild(th2);
			thead.appendChild(headerRow);

			// Data row
			const dataRow = createElement("tr");
			const td1 = createElement("td");
			td1.appendChild(createTextNode("John"));
			const td2 = createElement("td");
			td2.appendChild(createTextNode("30"));
			dataRow.appendChild(td1);
			dataRow.appendChild(td2);
			tbody.appendChild(dataRow);

			table.appendChild(thead);
			table.appendChild(tbody);
			doc.body.appendChild(table);

			const result = markdown(doc.body);
			expect(result).toContain("Name");
			expect(result).toContain("Age");
			expect(result).toContain("John");
			expect(result).toContain("30");
		});

		test("converts table with only tbody", () => {
			const doc = new Document();
			const table = createElement("table");
			const tbody = createElement("tbody");

			const row = createElement("tr");
			const td1 = createElement("td");
			td1.appendChild(createTextNode("Cell 1"));
			const td2 = createElement("td");
			td2.appendChild(createTextNode("Cell 2"));
			row.appendChild(td1);
			row.appendChild(td2);
			tbody.appendChild(row);

			table.appendChild(tbody);
			doc.body.appendChild(table);

			const result = markdown(doc.body);
			expect(result).toContain("Cell 1");
			expect(result).toContain("Cell 2");
		});

		test("converts table with multiple rows", () => {
			const doc = new Document();
			const table = createElement("table");
			const tbody = createElement("tbody");

			// First row
			const row1 = createElement("tr");
			const td1a = createElement("td");
			td1a.appendChild(createTextNode("Row 1 Col 1"));
			const td1b = createElement("td");
			td1b.appendChild(createTextNode("Row 1 Col 2"));
			row1.appendChild(td1a);
			row1.appendChild(td1b);
			tbody.appendChild(row1);

			// Second row
			const row2 = createElement("tr");
			const td2a = createElement("td");
			td2a.appendChild(createTextNode("Row 2 Col 1"));
			const td2b = createElement("td");
			td2b.appendChild(createTextNode("Row 2 Col 2"));
			row2.appendChild(td2a);
			row2.appendChild(td2b);
			tbody.appendChild(row2);

			table.appendChild(tbody);
			doc.body.appendChild(table);

			const result = markdown(doc.body);
			expect(result).toContain("Row 1 Col 1");
			expect(result).toContain("Row 1 Col 2");
			expect(result).toContain("Row 2 Col 1");
			expect(result).toContain("Row 2 Col 2");
		});

		test("converts table with three columns", () => {
			const doc = new Document();
			const table = createElement("table");
			const tbody = createElement("tbody");

			const row = createElement("tr");
			const td1 = createElement("td");
			td1.appendChild(createTextNode("A"));
			const td2 = createElement("td");
			td2.appendChild(createTextNode("B"));
			const td3 = createElement("td");
			td3.appendChild(createTextNode("C"));
			row.appendChild(td1);
			row.appendChild(td2);
			row.appendChild(td3);
			tbody.appendChild(row);

			table.appendChild(tbody);
			doc.body.appendChild(table);

			const result = markdown(doc.body);
			expect(result).toContain("A");
			expect(result).toContain("B");
			expect(result).toContain("C");
		});

		test("table cells are stripped of extra whitespace", () => {
			const doc = new Document();
			const table = createElement("table");
			const tbody = createElement("tbody");

			const row = createElement("tr");
			const td = createElement("td");
			td.appendChild(createTextNode("  extra   spaces  "));
			row.appendChild(td);
			tbody.appendChild(row);

			table.appendChild(tbody);
			doc.body.appendChild(table);

			const result = markdown(doc.body);
			expect(result).toContain("extra spaces");
			expect(result).not.toContain("  extra   spaces  ");
		});

		test("converts table with th elements in tbody", () => {
			const doc = new Document();
			const table = createElement("table");
			const tbody = createElement("tbody");

			const row = createElement("tr");
			const th = createElement("th");
			th.appendChild(createTextNode("Header"));
			const td = createElement("td");
			td.appendChild(createTextNode("Data"));
			row.appendChild(th);
			row.appendChild(td);
			tbody.appendChild(row);

			table.appendChild(tbody);
			doc.body.appendChild(table);

			const result = markdown(doc.body);
			expect(result).toContain("Header");
			expect(result).toContain("Data");
		});

		test("converts table with void elements (br) in cells", () => {
			const doc = new Document();
			const table = createElement("table");
			const tbody = createElement("tbody");

			const row = createElement("tr");
			const td1 = createElement("td");
			const br = createElement("br");
			td1.appendChild(br);
			td1.appendChild(createTextNode("Knocky"));
			const td2 = createElement("td");
			td2.appendChild(createTextNode("Flor"));
			row.appendChild(td1);
			row.appendChild(td2);
			tbody.appendChild(row);

			table.appendChild(tbody);
			doc.body.appendChild(table);

			const result = markdown(doc.body);
			expect(result).toContain("Knocky");
			expect(result).toContain("Flor");
			expect(result).toContain("|");
		});

		test("converts table with proper markdown pipe formatting", () => {
			const doc = new Document();
			const table = createElement("table");
			const tbody = createElement("tbody");

			const row = createElement("tr");
			const td1 = createElement("td");
			td1.appendChild(createTextNode("A"));
			const td2 = createElement("td");
			td2.appendChild(createTextNode("B"));
			row.appendChild(td1);
			row.appendChild(td2);
			tbody.appendChild(row);

			table.appendChild(tbody);
			doc.body.appendChild(table);

			const result = markdown(doc.body);
			// Should have pipe characters for table formatting
			expect(result).toMatch(/\| A \| B \|/);
			// Should have separator line
			expect(result).toMatch(/\| --- \|/);
		});

		test("converts table with multiple rows and proper separator", () => {
			const doc = new Document();
			const table = createElement("table");
			const tbody = createElement("tbody");

			// First row
			const row1 = createElement("tr");
			const td1a = createElement("td");
			td1a.appendChild(createTextNode("Name"));
			const td1b = createElement("td");
			td1b.appendChild(createTextNode("Age"));
			row1.appendChild(td1a);
			row1.appendChild(td1b);
			tbody.appendChild(row1);

			// Second row
			const row2 = createElement("tr");
			const td2a = createElement("td");
			td2a.appendChild(createTextNode("John"));
			const td2b = createElement("td");
			td2b.appendChild(createTextNode("30"));
			row2.appendChild(td2a);
			row2.appendChild(td2b);
			tbody.appendChild(row2);

			table.appendChild(tbody);
			doc.body.appendChild(table);

			const result = markdown(doc.body);
			const lines = result.split("\n").filter((line) => line.includes("|"));
			expect(lines.length).toBe(3); // header row, separator, data row
			expect(lines[0]).toMatch(/\| Name \| Age \|/);
			expect(lines[1]).toMatch(/\| --- \| --- \|/);
			expect(lines[2]).toMatch(/\| John \| 30 \|/);
		});

		test("converts image with empty alt attribute", () => {
			const doc = new Document();
			const p = createElement("p");
			const img = createElement("img");
			img.setAttribute("src", "image.png");
			img.setAttribute("alt", "");
			p.appendChild(img);
			doc.body.appendChild(p);
			expect(markdown(doc.body)).toBe("![](image.png)");
		});

		test("converts image without alt attribute", () => {
			const doc = new Document();
			const p = createElement("p");
			const img = createElement("img");
			img.setAttribute("src", "image.png");
			p.appendChild(img);
			doc.body.appendChild(p);
			expect(markdown(doc.body)).toBe("![null](image.png)");
		});

		test("converts image with src only", () => {
			const doc = new Document();
			const img = createElement("img");
			img.setAttribute("src", "https://example.com/image.jpg");
			doc.body.appendChild(img);
			expect(markdown(doc.body)).toBe("![null](https://example.com/image.jpg)");
		});

		test("converts table with four columns", () => {
			const doc = new Document();
			const table = createElement("table");
			const tbody = createElement("tbody");

			const row = createElement("tr");
			const td1 = createElement("td");
			td1.appendChild(createTextNode("Knocky"));
			const td2 = createElement("td");
			td2.appendChild(createTextNode("Flor"));
			const td3 = createElement("td");
			td3.appendChild(createTextNode("Ella"));
			const td4 = createElement("td");
			td4.appendChild(createTextNode("Juan"));
			row.appendChild(td1);
			row.appendChild(td2);
			row.appendChild(td3);
			row.appendChild(td4);
			tbody.appendChild(row);

			table.appendChild(tbody);
			doc.body.appendChild(table);

			const result = markdown(doc.body);
			expect(result).toMatch(/\| Knocky \| Flor \| Ella \| Juan \|/);
		});

		test("converts table with different column counts per row", () => {
			const doc = new Document();
			const table = createElement("table");
			const tbody = createElement("tbody");

			// Row with 4 columns
			const row1 = createElement("tr");
			for (let i = 1; i <= 4; i++) {
				const td = createElement("td");
				td.appendChild(createTextNode(`Col${i}`));
				row1.appendChild(td);
			}
			tbody.appendChild(row1);

			// Row with 5 columns
			const row2 = createElement("tr");
			for (let i = 1; i <= 5; i++) {
				const td = createElement("td");
				td.appendChild(createTextNode(`Data${i}`));
				row2.appendChild(td);
			}
			tbody.appendChild(row2);

			table.appendChild(tbody);
			doc.body.appendChild(table);

			const result = markdown(doc.body);
			const lines = result.split("\n").filter((line) => line.includes("|"));
			expect(lines.length).toBe(3); // header, separator (5 cols), data row
			// Separator should contain 5 "---" patterns
			const separator = lines[1];
			const separatorCount = (separator.match(/ --- /g) || []).length;
			expect(separatorCount).toBeGreaterThanOrEqual(4); // At least 4 separators for 5 columns
		});

		test("converts empty table", () => {
			const doc = new Document();
			const table = createElement("table");
			doc.body.appendChild(table);
			const result = markdown(doc.body);
			// Empty table should produce minimal output
			expect(result).toBe("");
		});
	});

	describe("nested elements", () => {
		test("converts bold inside italic", () => {
			const doc = new Document();
			const p = createElement("p");
			const em = createElement("em");
			const strong = createElement("strong");
			strong.appendChild(createTextNode("bold and italic"));
			em.appendChild(strong);
			p.appendChild(em);
			doc.body.appendChild(p);
			expect(markdown(doc.body)).toBe("_**bold and italic **_");
		});

		test("converts italic inside bold", () => {
			const doc = new Document();
			const p = createElement("p");
			const strong = createElement("strong");
			const em = createElement("em");
			em.appendChild(createTextNode("italic and bold"));
			strong.appendChild(em);
			p.appendChild(strong);
			doc.body.appendChild(p);
			expect(markdown(doc.body)).toBe("**_italic and bold _**");
		});

		test("converts link inside list item", () => {
			const doc = new Document();
			const ul = createElement("ul");
			const li = createElement("li");
			const a = createElement("a");
			a.setAttribute("href", "http://example.com");
			a.appendChild(createTextNode("link"));
			li.appendChild(a);
			ul.appendChild(li);
			doc.body.appendChild(ul);
			const result = markdown(doc.body);
			expect(result).toContain("-");
			expect(result).toContain("[link");
			expect(result).toContain("](http://example.com)");
		});

		test("converts code inside link", () => {
			const doc = new Document();
			const p = createElement("p");
			const a = createElement("a");
			a.setAttribute("href", "http://example.com");
			const code = createElement("code");
			code.appendChild(createTextNode("code link"));
			a.appendChild(code);
			p.appendChild(a);
			doc.body.appendChild(p);
			expect(markdown(doc.body)).toBe("[`code link `](http://example.com)");
		});

		test("converts nested lists", () => {
			const doc = new Document();
			const ul = createElement("ul");
			const li = createElement("li");
			li.appendChild(createTextNode("outer"));
			const nestedUl = createElement("ul");
			const nestedLi = createElement("li");
			nestedLi.appendChild(createTextNode("nested"));
			nestedUl.appendChild(nestedLi);
			li.appendChild(nestedUl);
			ul.appendChild(li);
			doc.body.appendChild(ul);
			const result = markdown(doc.body);
			expect(result).toContain("outer");
			expect(result).toContain("nested");
		});
	});

	describe("edge cases", () => {
		test("handles null node", () => {
			expect(markdown(null)).toBe("");
		});

		test("handles undefined node", () => {
			expect(markdown(undefined)).toBe("");
		});

		test("handles empty document", () => {
			const doc = new Document();
			expect(markdown(doc.body)).toBe("");
		});

		test("handles empty element", () => {
			const doc = new Document();
			const p = createElement("p");
			doc.body.appendChild(p);
			expect(markdown(doc.body)).toBe("");
		});

		test("handles whitespace-only text", () => {
			const doc = new Document();
			const p = createElement("p");
			p.appendChild(createTextNode("   \n\t   "));
			doc.body.appendChild(p);
			expect(markdown(doc.body)).toBe("");
		});

		test("handles multiple consecutive br tags", () => {
			const doc = new Document();
			const p = createElement("p");
			p.appendChild(createTextNode("line1"));
			p.appendChild(createElement("br"));
			p.appendChild(createElement("br"));
			p.appendChild(createTextNode("line2"));
			doc.body.appendChild(p);
			const result = markdown(doc.body);
			expect(result).toContain("line1");
			expect(result).toContain("line2");
			expect(result).toContain("\n");
		});

		test("handles link without href", () => {
			const doc = new Document();
			const p = createElement("p");
			const a = createElement("a");
			a.appendChild(createTextNode("text"));
			p.appendChild(a);
			doc.body.appendChild(p);
			expect(markdown(doc.body)).toBe("[text ](null)");
		});

		test("handles image without src", () => {
			const doc = new Document();
			const img = createElement("img");
			img.setAttribute("alt", "description");
			doc.body.appendChild(img);
			expect(markdown(doc.body)).toBe("![description](null)");
		});

		test("handles mixed content in paragraph", () => {
			const doc = new Document();
			const p = createElement("p");
			p.appendChild(createTextNode("normal "));
			const strong = createElement("strong");
			strong.appendChild(createTextNode("bold"));
			p.appendChild(strong);
			p.appendChild(createTextNode(" more "));
			const em = createElement("em");
			em.appendChild(createTextNode("italic"));
			p.appendChild(em);
			doc.body.appendChild(p);
			const result = markdown(doc.body);
			expect(result).toContain("normal");
			expect(result).toContain("**bold");
			expect(result).toContain("more");
			expect(result).toContain("_italic");
		});

		test("handles deeply nested structure", () => {
			const doc = new Document();
			const blockquote = createElement("blockquote");
			const p = createElement("p");
			const strong = createElement("strong");
			strong.appendChild(createTextNode("deep"));
			p.appendChild(strong);
			blockquote.appendChild(p);
			doc.body.appendChild(blockquote);
			const result = markdown(doc.body);
			expect(result).toContain(">");
			expect(result).toContain("**deep");
		});

		test("handles heading with nested formatting", () => {
			const doc = new Document();
			const h2 = createElement("h2");
			h2.appendChild(createTextNode("Title with "));
			const em = createElement("em");
			em.appendChild(createTextNode("emphasis"));
			h2.appendChild(em);
			doc.body.appendChild(h2);
			const result = markdown(doc.body);
			expect(result).toContain("## Title with");
			expect(result).toContain("_emphasis _");
		});

		test("handles blockquote with multiple paragraphs", () => {
			const doc = new Document();
			const blockquote = createElement("blockquote");
			const p1 = createElement("p");
			p1.appendChild(createTextNode("First quoted paragraph"));
			const p2 = createElement("p");
			p2.appendChild(createTextNode("Second quoted paragraph"));
			blockquote.appendChild(p1);
			blockquote.appendChild(p2);
			doc.body.appendChild(blockquote);
			const result = markdown(doc.body);
			expect(result).toContain(">");
			expect(result).toContain("First quoted paragraph");
			expect(result).toContain("Second quoted paragraph");
		});

		test("handles ordered list with many items", () => {
			const doc = new Document();
			const ol = createElement("ol");
			for (let i = 1; i <= 5; i++) {
				const li = createElement("li");
				li.appendChild(createTextNode(`Item ${i}`));
				ol.appendChild(li);
			}
			doc.body.appendChild(ol);
			const result = markdown(doc.body);
			expect(result).toContain("1. Item 1");
			expect(result).toContain("1. Item 2");
			expect(result).toContain("1. Item 5");
		});

		test("handles pre with code-like content", () => {
			const doc = new Document();
			const pre = createElement("pre");
			pre.appendChild(createTextNode("function test() {\n  return true;\n}"));
			doc.body.appendChild(pre);
			const result = markdown(doc.body);
			expect(result.startsWith("```")).toBe(true);
			expect(result.endsWith("```")).toBe(true);
			expect(result).toContain("function test()");
		});

		test("handles text nodes between elements", () => {
			const doc = new Document();
			const div = createElement("div");
			div.appendChild(createTextNode("before"));
			const span = createElement("span");
			span.appendChild(createTextNode("middle"));
			div.appendChild(span);
			div.appendChild(createTextNode("after"));
			doc.body.appendChild(div);
			const result = markdown(doc.body);
			expect(result).toContain("before");
			expect(result).toContain("middle");
			expect(result).toContain("after");
		});
	});

	describe("text stripping", () => {
		test("collapses multiple spaces", () => {
			const doc = new Document();
			const p = createElement("p");
			p.appendChild(createTextNode("word1    word2"));
			doc.body.appendChild(p);
			expect(markdown(doc.body)).toBe("word1 word2");
		});

		test("collapses tabs and newlines", () => {
			const doc = new Document();
			const p = createElement("p");
			p.appendChild(createTextNode("word1\n\n\nword2"));
			doc.body.appendChild(p);
			expect(markdown(doc.body)).toBe("word1 word2");
		});

		test("trims leading and trailing whitespace", () => {
			const doc = new Document();
			const p = createElement("p");
			p.appendChild(createTextNode("\n\t  text  \t\n"));
			doc.body.appendChild(p);
			expect(markdown(doc.body)).toBe("text");
		});
	});

	describe("unknown elements", () => {
		test("handles custom elements gracefully", () => {
			const doc = new Document();
			const custom = createElement("custom-element");
			custom.appendChild(createTextNode("content"));
			doc.body.appendChild(custom);
			// Should not throw and should still process children
			expect(() => markdown(doc.body)).not.toThrow();
			const result = markdown(doc.body);
			expect(result).toContain("content");
		});

		test("handles custom inline elements", () => {
			const doc = new Document();
			const p = createElement("p");
			p.appendChild(createTextNode("before "));
			const custom = createElement("my-span");
			custom.appendChild(createTextNode("custom"));
			p.appendChild(custom);
			p.appendChild(createTextNode(" after"));
			doc.body.appendChild(p);
			const result = markdown(doc.body);
			expect(result).toContain("before");
			expect(result).toContain("custom");
			expect(result).toContain("after");
		});
	});
});
