/**
 * Insert text around selection in a textarea.
 * Returns new content string and new cursor range.
 */
export function insertAroundSelection(
  content: string,
  selStart: number,
  selEnd: number,
  before: string,
  after = '',
  placeholder = '',
): { content: string; newStart: number; newEnd: number } {
  const selected = content.slice(selStart, selEnd) || placeholder;
  const newContent =
    content.slice(0, selStart) + before + selected + after + content.slice(selEnd);
  const newStart = selStart + before.length;
  const newEnd = newStart + selected.length;
  return { content: newContent, newStart, newEnd };
}

/**
 * Insert a line-level prefix (e.g., "# ", "- ", "> ") on each selected line.
 */
export function insertLinePrefix(
  content: string,
  selStart: number,
  selEnd: number,
  prefix: string,
): { content: string; newStart: number; newEnd: number } {
  const before = content.slice(0, selStart);
  const selection = content.slice(selStart, selEnd);
  const after = content.slice(selEnd);

  const lineStart = before.lastIndexOf('\n') + 1;
  const prefixed = content
    .slice(lineStart, selEnd)
    .split('\n')
    .map(line => {
      if (line.startsWith(prefix)) return line.slice(prefix.length);
      return prefix + line;
    })
    .join('\n');

  const newContent = content.slice(0, lineStart) + prefixed + after;
  const offset = prefixed.length - (selEnd - lineStart);
  return {
    content: newContent,
    newStart: selStart + (lineStart < selStart ? (selection.startsWith(prefix) ? -prefix.length : prefix.length) : 0),
    newEnd: selEnd + offset,
  };
}
