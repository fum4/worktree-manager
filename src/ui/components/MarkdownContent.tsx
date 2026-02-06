import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

import { text } from '../theme';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

function preserveBlankLines(src: string): string {
  return src.replace(/\n{3,}/g, (m) => '\n\n' + '&nbsp;\n\n'.repeat(m.length - 2));
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          h1: ({ children }) => (
            <h1 className={`text-base font-semibold ${text.primary} mb-3 mt-4 first:mt-0`}>{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className={`text-sm font-semibold ${text.primary} mb-2 mt-3 first:mt-0`}>{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className={`text-xs font-semibold ${text.primary} mb-2 mt-3 first:mt-0`}>{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className={`text-xs font-medium ${text.primary} mb-1.5 mt-2 first:mt-0`}>{children}</h4>
          ),
          h5: ({ children }) => (
            <h5 className={`text-xs font-medium ${text.secondary} mb-1 mt-2 first:mt-0`}>{children}</h5>
          ),
          h6: ({ children }) => (
            <h6 className={`text-xs font-medium ${text.muted} mb-1 mt-2 first:mt-0`}>{children}</h6>
          ),
          p: ({ children }) => (
            <p className={`text-xs ${text.secondary} leading-relaxed mb-2 last:mb-0`}>{children}</p>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:text-accent-muted underline underline-offset-2"
            >
              {children}
            </a>
          ),
          code: ({ className: codeClassName, children }) => {
            const isBlock = codeClassName?.startsWith('language-');
            if (isBlock) {
              return (
                <code className={`text-[11px] ${text.secondary}`}>
                  {children}
                </code>
              );
            }
            return (
              <code className={`text-[11px] ${text.primary} bg-white/[0.08] px-1 py-0.5 rounded`}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="bg-white/[0.04] border border-white/[0.06] rounded-md px-3 py-2 overflow-x-auto mb-2 last:mb-0">
              {children}
            </pre>
          ),
          ul: ({ children }) => (
            <ul className={`text-xs ${text.secondary} list-disc list-outside ml-4 mb-2 last:mb-0 space-y-0.5`}>
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className={`text-xs ${text.secondary} list-decimal list-outside ml-4 mb-2 last:mb-0 space-y-0.5`}>
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed">{children}</li>
          ),
          blockquote: ({ children }) => (
            <blockquote className={`border-l-2 border-white/[0.15] pl-3 ${text.muted} mb-2 last:mb-0`}>
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto mb-2 last:mb-0">
              <table className="text-xs border-collapse border border-white/[0.08] w-full">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-white/[0.04]">{children}</thead>
          ),
          th: ({ children }) => (
            <th className={`text-left px-2 py-1.5 border border-white/[0.08] ${text.primary} font-medium text-[11px]`}>
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className={`px-2 py-1.5 border border-white/[0.08] ${text.secondary} text-[11px]`}>
              {children}
            </td>
          ),
          hr: () => (
            <hr className="border-white/[0.08] my-3" />
          ),
          strong: ({ children }) => (
            <strong className={`font-semibold ${text.primary}`}>{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic">{children}</em>
          ),
          img: ({ src, alt }) => (
            <img src={src} alt={alt ?? ''} className="max-w-full rounded my-1" loading="lazy" />
          ),
        }}
      >
        {preserveBlankLines(content)}
      </ReactMarkdown>
    </div>
  );
}
