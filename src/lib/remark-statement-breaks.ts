import type { Nodes, PhrasingContent, Root } from "mdast";

function preserveStatementLines(children: PhrasingContent[]): PhrasingContent[] {
  return children.flatMap((node, index): PhrasingContent[] => {
    if (node.type === "text") {
      const lines = node.value.split(/(?:\r\n|\r|\n)(?=[ \t]*Statement[ \t]+(?:[IVXLCDM]+|\d+)[ \t]*:)/i);
      const next = children[index + 1];
      const afterNext = children[index + 2];
      if (next?.type === "strong" || next?.type === "emphasis") {
        const first = next.children[0];
        // Markdown puts a bold label in a separate node, sometimes leaving its colon outside.
        const label = first?.type === "text"
          ? first.value + (next.children.length === 1 && afterNext?.type === "text" ? afterNext.value : "")
          : "";
        if (/^[ \t]*Statement[ \t]+(?:[IVXLCDM]+|\d+)[ \t]*:/i.test(label)) {
          const last = lines.length - 1;
          lines.splice(last, 1, ...lines[last].split(/(?:\r\n|\r|\n)(?=[ \t]*$)/));
        }
      }
      if (lines.length === 1) return [node];

      return lines.flatMap((value, index): PhrasingContent[] => (
        index === 0
          ? [{ type: "text", value }]
          : [{ type: "break" }, { type: "text", value }]
      ));
    }
    if ("children" in node) node.children = preserveStatementLines(node.children);
    return [node];
  });
}

/** Preserve labelled statement lines without changing ordinary Markdown soft breaks. */
export function remarkStatementBreaks() {
  return (tree: Root): void => {
    function visit(node: Nodes): void {
      if (node.type === "paragraph" || node.type === "heading") {
        node.children = preserveStatementLines(node.children);
      } else if ("children" in node) {
        for (const child of node.children) visit(child);
      }
    }
    visit(tree);
  };
}
