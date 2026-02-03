interface AdfNode {
  type: string;
  content?: AdfNode[];
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  attrs?: Record<string, unknown>;
}

export function adfToMarkdown(adf: unknown): string {
  if (!adf || typeof adf !== 'object') return '';
  const doc = adf as AdfNode;
  if (doc.type !== 'doc' || !doc.content) return '';
  return convertNodes(doc.content).trim();
}

function convertNodes(nodes: AdfNode[], listDepth = 0): string {
  return nodes.map((node) => convertNode(node, listDepth)).join('');
}

function convertNode(node: AdfNode, listDepth: number): string {
  switch (node.type) {
    case 'paragraph':
      return convertInline(node.content) + '\n\n';

    case 'heading': {
      const level = (node.attrs?.level as number) ?? 1;
      const prefix = '#'.repeat(Math.min(level, 6));
      return `${prefix} ${convertInline(node.content)}\n\n`;
    }

    case 'text':
      return applyMarks(node.text ?? '', node.marks);

    case 'hardBreak':
      return '\n';

    case 'rule':
      return '---\n\n';

    case 'codeBlock': {
      const lang = (node.attrs?.language as string) ?? '';
      const code = node.content?.map((c) => c.text ?? '').join('') ?? '';
      return `\`\`\`${lang}\n${code}\n\`\`\`\n\n`;
    }

    case 'blockquote': {
      const inner = convertNodes(node.content ?? [], listDepth)
        .trim()
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n');
      return inner + '\n\n';
    }

    case 'bulletList':
      return (
        (node.content ?? [])
          .map((item) => convertListItem(item, listDepth, '- '))
          .join('') + (listDepth === 0 ? '\n' : '')
      );

    case 'orderedList':
      return (
        (node.content ?? [])
          .map((item, i) => convertListItem(item, listDepth, `${i + 1}. `))
          .join('') + (listDepth === 0 ? '\n' : '')
      );

    case 'listItem': {
      // Handled by bulletList/orderedList via convertListItem
      return convertNodes(node.content ?? [], listDepth);
    }

    case 'mention': {
      const name = (node.attrs?.text as string) ?? (node.attrs?.displayName as string) ?? 'someone';
      return `@${name.replace(/^@/, '')}`;
    }

    case 'mediaSingle':
    case 'mediaGroup':
      return (node.content ?? []).map((child) => convertNode(child, listDepth)).join('');

    case 'media': {
      const filename = (node.attrs?.alt as string) ?? (node.attrs?.id as string) ?? 'file';
      return `[attachment: ${filename}]`;
    }

    case 'inlineCard': {
      const url = (node.attrs?.url as string) ?? '';
      return url ? `[${url}](${url})` : '';
    }

    default:
      // Unknown node — recurse into children if present
      if (node.content) {
        return convertNodes(node.content, listDepth);
      }
      return '';
  }
}

function convertListItem(item: AdfNode, depth: number, prefix: string): string {
  const indent = '  '.repeat(depth);
  const inner = convertNodes(item.content ?? [], depth + 1).replace(/\n\n$/, '\n');
  // First line gets the bullet/number, subsequent lines get indented
  const lines = inner.split('\n');
  return lines
    .map((line, i) => {
      if (i === 0) return `${indent}${prefix}${line}`;
      if (line.trim() === '') return '';
      return `${indent}  ${line}`;
    })
    .filter((line, i, arr) => !(i === arr.length - 1 && line === ''))
    .join('\n') + '\n';
}

function convertInline(nodes?: AdfNode[]): string {
  if (!nodes) return '';
  return nodes.map((n) => convertNode(n, 0)).join('');
}

function applyMarks(text: string, marks?: AdfNode['marks']): string {
  if (!marks || marks.length === 0) return text;

  let result = text;
  for (const mark of marks) {
    switch (mark.type) {
      case 'strong':
        result = `**${result}**`;
        break;
      case 'em':
        result = `*${result}*`;
        break;
      case 'code':
        result = `\`${result}\``;
        break;
      case 'strike':
        result = `~~${result}~~`;
        break;
      case 'link': {
        const href = (mark.attrs?.href as string) ?? '';
        result = `[${result}](${href})`;
        break;
      }
    }
  }
  return result;
}
