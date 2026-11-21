import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Safe Markdown renderer for admin-authored content. Raw HTML is NOT rendered
 * (no rehype-raw), and only http(s)/mailto/tel/relative links are kept.
 */
export function Markdown({ children, className = "prose-ms" }: { children: string; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        urlTransform={(url) => (/^(https?:|mailto:|tel:|\/|#)/i.test(url) ? url : "")}
        components={{
          a: ({ href, children: c }) =>
            href?.startsWith("http") ? (
              <a href={href} rel="noopener noreferrer" target="_blank">
                {c}
              </a>
            ) : (
              <a href={href}>{c}</a>
            ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
