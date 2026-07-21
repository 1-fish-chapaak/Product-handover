import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// Design-system guardrails. See DESIGN.md §3 (rem rule), §4 (elevation), §5 (cards).
// Each selector below is at zero occurrences in src/ — keep it that way.
const RADIUS_RE = String.raw`rounded(-(t|b|l|r|tl|tr|bl|br))?-\[\d`
const PX_TEXT_RE = String.raw`text-\[\d+(\.\d+)?px\]`
const GRAY_RE = String.raw`(text|bg|border|ring|divide)-gray-\d`

const restrict = (re, message) => [
  { selector: `Literal[value=/${re}/]`, message },
  { selector: `TemplateElement[value.raw=/${re}/]`, message },
]

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      'no-restricted-syntax': [
        'error',
        ...restrict(
          RADIUS_RE,
          'Arbitrary corner radius. Use the scale: rounded-xs|sm|md|lg|xl|2xl (4/6/8/12/16/20px). Cards are rounded-lg. (DESIGN.md §5)',
        ),
        ...restrict(
          PX_TEXT_RE,
          'Font size in px does not scale with the browser setting. Author in rem: text-[0.75rem], not text-[12px]. (DESIGN.md §3, The rem Rule)',
        ),
        ...restrict(
          GRAY_RE,
          'Tailwind gray-* is a second, cooler neutral ramp. Use the tinted ink-*/canvas-* tokens. (DESIGN.md §2)',
        ),
        // Not yet enforced: ~587 pre-existing hex literals in className.
        // Tokenize as you touch files, then add:
        //   ...restrict(String.raw`#[0-9a-fA-F]{3,8}`, 'Hardcoded hex. Use a token.')
      ],
    },
  },
])
