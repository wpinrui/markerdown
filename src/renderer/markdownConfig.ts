import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'

export const REMARK_PLUGINS = [remarkGfm, remarkMath]
export const REHYPE_PLUGINS = [rehypeKatex]
