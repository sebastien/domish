import { describe, test, expect } from "bun:test";
import { parse } from "../src/ts/domish/xmlish.js";

describe("parse", () => {
  test("simple parse", () => {
    const doc = parse("<div>test</div>");
    expect(doc.body.childNodes.length).toBe(1);
  });

  test("nested elements", () => {
    const doc = parse("<div><span>nested</span></div>");
    const div = doc.body.firstChild;
    expect(div?.childNodes.length).toBe(1);
  });

  test("self-closing tags", () => {
    const doc = parse("<img src='test.png' />");
    expect(doc.body.childNodes.length).toBe(1);
  });

  test("multiple root elements", () => {
    const doc = parse("<div>one</div><span>two</span>");
    expect(doc.body.childNodes.length).toBe(2);
  });

  describe("void elements", () => {
    test("br element without closing tag", () => {
      const doc = parse("<div><br>text</div>");
      expect(doc.body.childNodes.length).toBe(1);
      const div = doc.body.firstChild;
      expect(div?.childNodes.length).toBe(2);
      expect(div?.childNodes[0]?.nodeName).toBe("br");
      expect(div?.childNodes[1]?.nodeType).toBe(3); // TEXT_NODE
    });

    test("img element without closing tag", () => {
      const doc = parse("<img src='image.png' alt='test'>");
      expect(doc.body.childNodes.length).toBe(1);
      const img = doc.body.firstChild;
      expect(img?.nodeName).toBe("img");
      expect((img as any).getAttribute("src")).toBe("image.png");
      expect((img as any).getAttribute("alt")).toBe("test");
    });

    test("hr element without closing tag", () => {
      const doc = parse("<p>before</p><hr><p>after</p>");
      expect(doc.body.childNodes.length).toBe(3);
      expect(doc.body.childNodes[1]?.nodeName).toBe("hr");
    });

    test("input element without closing tag", () => {
      const doc = parse("<form><input type='text' name='field'></form>");
      const form = doc.body.firstChild;
      expect(form?.childNodes.length).toBe(1);
      expect(form?.childNodes[0]?.nodeName).toBe("input");
    });

    test("multiple void elements", () => {
      const doc = parse("<br><hr><img src='x.png'>");
      expect(doc.body.childNodes.length).toBe(3);
      expect(doc.body.childNodes[0]?.nodeName).toBe("br");
      expect(doc.body.childNodes[1]?.nodeName).toBe("hr");
      expect(doc.body.childNodes[2]?.nodeName).toBe("img");
    });

    test("br in table cell", () => {
      const doc = parse("<table><tr><td><br>Knocky</td><td>Flor</td></tr></table>");
      const table = doc.body.firstChild;
      const tr = table?.childNodes[0]; // No tbody in this parsed HTML
      expect(tr?.nodeName).toBe("tr");
      expect(tr?.childNodes.length).toBe(2);
      const td1 = tr?.childNodes[0];
      expect(td1?.nodeName).toBe("td");
      expect(td1?.childNodes.length).toBeGreaterThanOrEqual(1);
      // The br should be parsed as a child element of td
      expect(td1?.textContent?.trim()).toBe("Knocky");
      const td2 = tr?.childNodes[1];
      expect(td2?.nodeName).toBe("td");
      expect(td2?.textContent?.trim()).toBe("Flor");
    });

    test("void element siblings maintain correct parent", () => {
      const doc = parse("<td><br>Knocky</td><td>Flor</td>");
      expect(doc.body.childNodes.length).toBe(2);
      const td1 = doc.body.childNodes[0];
      const td2 = doc.body.childNodes[1];
      expect(td1?.nodeName).toBe("td");
      expect(td2?.nodeName).toBe("td");
      expect(td1?.textContent?.trim()).toBe("Knocky");
      expect(td2?.textContent?.trim()).toBe("Flor");
    });
  });

  describe("tables", () => {
    test("simple table", () => {
      const doc = parse("<table><tr><td>A</td><td>B</td></tr></table>");
      expect(doc.body.childNodes.length).toBe(1);
      const table = doc.body.firstChild;
      expect(table?.nodeName).toBe("table");
    });

    test("table with tbody", () => {
      const doc = parse("<table><tbody><tr><td>A</td></tr></tbody></table>");
      const table = doc.body.firstChild;
      expect(table?.childNodes.length).toBe(1);
      expect(table?.childNodes[0]?.nodeName).toBe("tbody");
    });

    test("table with thead and tbody", () => {
      const doc = parse("<table><thead><tr><th>Header</th></tr></thead><tbody><tr><td>Data</td></tr></tbody></table>");
      const table = doc.body.firstChild;
      expect(table?.childNodes.length).toBe(2);
      expect(table?.childNodes[0]?.nodeName).toBe("thead");
      expect(table?.childNodes[1]?.nodeName).toBe("tbody");
    });
  });
});
