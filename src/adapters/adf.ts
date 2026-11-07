/** Minimal Atlassian Document Format -> plain text, with acceptance-criteria splitting. */

interface AdfNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: AdfNode[];
}

function inline(n: AdfNode): string {
  if (n.type === 'text') return n.text ?? '';
  if (n.type === 'hardBreak') return '\n';
  if (n.type === 'mention') return String(n.attrs?.text ?? '');
  if (n.type === 'inlineCard') return String(n.attrs?.url ?? '');
  return (n.content ?? []).map(inline).join('');
}

/** Returns blocks as { heading?: string; text: string } in document order. */
function blocks(nodes: AdfNode[], out: Array<{ heading?: string; text: string }>, prefix = '') {
  for (const n of nodes) {
    switch (n.type) {
      case 'heading':
        out.push({ heading: inline(n), text: '' });
        break;
      case 'paragraph':
        out.push({ text: prefix + inline(n) });
        break;
      case 'bulletList':
      case 'orderedList':
        for (const li of n.content ?? []) blocks(li.content ?? [], out, '- ');
        break;
      case 'codeBlock':
        out.push({ text: inline(n) });
        break;
      default:
        if (n.content) blocks(n.content, out, prefix);
    }
  }
}

const AC_HEADING = /acceptance\s+criteria|definition\s+of\s+done/i;

export function adfToText(doc: unknown): { description: string; acceptanceCriteria: string } {
  if (!doc || typeof doc !== 'object') return { description: typeof doc === 'string' ? doc : '', acceptanceCriteria: '' };
  const out: Array<{ heading?: string; text: string }> = [];
  blocks((doc as AdfNode).content ?? [], out);
  const desc: string[] = [];
  const ac: string[] = [];
  let inAc = false;
  for (const b of out) {
    if (b.heading !== undefined) {
      inAc = AC_HEADING.test(b.heading);
      if (!inAc) desc.push(b.heading);
      continue;
    }
    (inAc ? ac : desc).push(b.text);
  }
  return { description: desc.join('\n').trim(), acceptanceCriteria: ac.join('\n').trim() };
}

/** Plain text -> ADF paragraphs (for issue descriptions Tether creates). */
export function textToAdf(text: string) {
  return {
    type: 'doc',
    version: 1,
    content: text.split(/\n{2,}/).map((para) => ({
      type: 'paragraph',
      content: para
        .split('\n')
        .flatMap((line, i) => (i === 0 ? [{ type: 'text', text: line }] : [{ type: 'hardBreak' }, { type: 'text', text: line }]))
        .filter((n) => n.type !== 'text' || (n as { text: string }).text.length > 0),
    })),
  };
}
