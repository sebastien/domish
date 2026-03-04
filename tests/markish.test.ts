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
			const lines = result.split("\n").filter(line => line.includes("|"));
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
			const lines = result.split("\n").filter(line => line.includes("|"));
			expect(lines.length).toBe(3); // header, separator (5 cols), data row
			// Separator should contain 5 "---" patterns
			const separator = lines[1];
			const separatorCount = (separator.match(/ --- /g) || []).length;
			expect(separatorCount).toBeGreaterThanOrEqual(4); // At least 4 separators for 5 columns
		});

		test("converts complex table like Freshdesk example", () => {
			const doc = new Document();
			const table = createElement("table");
			const tbody = createElement("tbody");

			// Header row with br element
			const row1 = createElement("tr");
			const td1 = createElement("td");
			const br = createElement("br");
			td1.appendChild(br);
			td1.appendChild(createTextNode("Knocky"));
			row1.appendChild(td1);
			const td2 = createElement("td");
			td2.appendChild(createTextNode("Flor"));
			row1.appendChild(td2);
			const td3 = createElement("td");
			td3.appendChild(createTextNode("Ella"));
			row1.appendChild(td3);
			const td4 = createElement("td");
			td4.appendChild(createTextNode("Juan"));
			row1.appendChild(td4);
			tbody.appendChild(row1);

			// Data row
			const row2 = createElement("tr");
			const tdBreed1 = createElement("td");
			tdBreed1.appendChild(createTextNode("Breed"));
			row2.appendChild(tdBreed1);
			const tdBreed2 = createElement("td");
			tdBreed2.appendChild(createTextNode("Jack Russell"));
			row2.appendChild(tdBreed2);
			const tdBreed3 = createElement("td");
			tdBreed3.appendChild(createTextNode("Poodle"));
			row2.appendChild(tdBreed3);
			const tdBreed4 = createElement("td");
			tdBreed4.appendChild(createTextNode("Streetdog"));
			row2.appendChild(tdBreed4);
			const tdBreed5 = createElement("td");
			tdBreed5.appendChild(createTextNode("Cocker Spaniel"));
			row2.appendChild(tdBreed5);
			tbody.appendChild(row2);

			table.appendChild(tbody);
			doc.body.appendChild(table);

			const result = markdown(doc.body);
			expect(result).toContain("Knocky");
			expect(result).toContain("Flor");
			expect(result).toContain("Breed");
			expect(result).toContain("Jack Russell");
			expect(result).toMatch(/\| Knocky \| Flor \| Ella \| Juan \|/);
		});
	});
});
