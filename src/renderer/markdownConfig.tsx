import Markdown, { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeRaw from 'rehype-raw'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { LOCAL_IMAGE_PROTOCOL } from './utils/imageUtils'

const REMARK_PLUGINS = [remarkGfm, remarkMath]
const REHYPE_PLUGINS = [rehypeRaw, rehypeKatex]

interface StyledMarkdownProps {
  content: string
}

// Allow local-image: protocol (default urlTransform strips unknown protocols)
function allowLocalImageProtocol(url: string): string {
  if (url.startsWith(LOCAL_IMAGE_PROTOCOL)) {
    return url
  }
  // Default behavior: allow http, https, mailto, tel
  if (/^(https?|mailto|tel):/.test(url)) {
    return url
  }
  // Allow relative URLs
  if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) {
    return url
  }
  return ''
}

// Custom link component that opens external URLs in the default browser
const ExternalLink: Components['a'] = ({ href, children, ...props }) => {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
      e.preventDefault()
      window.electronAPI.openExternal(href)
    }
  }

  return (
    <a href={href} onClick={handleClick} {...props}>
      {children}
    </a>
  )
}

const MARKDOWN_COMPONENTS: Components = {
  a: ExternalLink,
}

export function StyledMarkdown({ content }: StyledMarkdownProps) {
  return (
    <Markdown
      remarkPlugins={REMARK_PLUGINS}
      rehypePlugins={REHYPE_PLUGINS}
      urlTransform={allowLocalImageProtocol}
      components={MARKDOWN_COMPONENTS}
    >
      {content}
    </Markdown>
  )
}
