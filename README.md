      ._____ ________  ________ _____ _   _
      |  _  |  _  |  \/  |_   _/  ___| | | |
      | | | | | | | .  . | | | \ `--.| |_| |
      | | | | | | | |\/| | | |  `--. |  _  |
      | |/ /\ \_/ | |  | |_| |_/\__/ | | | |
      .___/  \___/\_|  |_/\___/\____/\_| |_/


*DOMish* is a simplified pure JavaScript implementation of the DOM
intended to be used in server-side JavaScript environments without a DOM
implementation.

*DOMish* has plenty of limitations, and is really designed to meet the
very minimum requirements for managing a virtual DOM, so it doesn't
support features like selectors, or events, for instance.

There is also a simple HTML/XML parser implementation called *xmlish*,
which can be used to parse strings.


## Supported APIs

- Document
  - createComment()
  - createElement()
  - createElementNS()
  - createTextNode()
  - getElementById()
- Element
  - attributes
  - cloneNode()
  - gasAttribute()
  - getAttribute()
  - getAttributeNS()
  - hasAttribute()
  - id
  - removeAttribute()
  - setAttribute()
  - setAttributeNS()
  - style
- Node
  - ATTRIBUTE_NODE
  - CDATA_SECTION_NODE
  - COMMENT_NODE
  - DOCUMENT_FRAGMENT_NODE
  - DOCUMENT_NODE
  - DOCUMENT_TYPE_NODE
  - ELEMENT_NODE
  - Namespaces
  - PROCESSING_INSTRUCTION_NODE
  - TEXT_NODE
  - after()
  - appendChild()
  - before()
  - childNodes
  - cloneNode()
  - firstChild
  - insertBefore()
  - isConnected
  - iterWalk()
  - lastChild
  - nextSibling
  - nodeValue
  - ownerDocument
  - parentElement
  - previousSibling
  - querySelectorAll()
  - removeChild()
  - replaceChild()
  - textContent
  - toXML()
  - toXMLLines()
- Query
  - match()
  - selectors
  - type
  - value
- StyleSheet
  - cssRules
  - deleteRule()
  - insertRule()
- TokenList
  - add()
  - contains()
  - remove()
  - toggle()

