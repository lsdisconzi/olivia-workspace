Architected branded PDF export with Olivia's design system, fonts, and visual identity
Architected branded PDF export with Olivia's design system, fonts, and visual identity
I need to improve the PDF export function to match Olivia's actual design system instead of the current mismatched branding, so I'm reviewing the design files to understand the correct color palette and styling conventions. The monospace font is JetBrains Mono, and the design uses recurring patterns like animated SVG olive branches, terracotta-colored fruit shapes, and pill-shaped navigation elements. The icon system features rounded squares with dark forest green backgrounds and cream-colored branch motifs with terracotta accents. I'm reconsidering whether the branding should use "OliviaLegal" or just "Olivia" based on the user's request for a general Olivia-branded PDF.

Looking at the existing PDF function, it has "OliviaLegal" hardcoded but lacks visual polish—no logo, generic layout, and colors that don't quite match the design system. The user wants me to improve this function to produce a more professional, branded PDF output that actually reflects the Olivia visual identity using the proper typefaces like Fraunces and Plus Jakarta Sans.

I need to think through what improvements matter most: applying the correct brand colors from the design system instead of the mismatched blue, using the right font families for headings and body text, and incorporating design elements like the olive branch motif and pill shapes that define the Olivia aesthetic. initely want to make the brand name configurable at the top so it can be swapped out easily depending on context, but for this Olivia workspace specifically, keeping "OliviaLegal" makes sense since that's the actual product name embedded throughout the app.

I'm going to design the header to show "Olivia" as the primary brand in the serif font with forest green, then add a smaller mono subtitle like "Olivia · Workspace Export" underneath — this mirrors the navigation pattern I see throughout the codebase where "Olivia" is the main brand with a secondary descriptor in a span.

…

Show less
Done
Looking at your actual design system across the Olivia files (Fraunces + Plus Jakarta Sans + JetBrains Mono, cream/forest-green/terracotta palette, the olive-branch mark used in the sidebar and favicon), the current PDF export doesn't match at all — it's using a generic blue (
#244a73) and an unrelated gradient circle "logo." I've rebuilt it to actually use the Olivia brand.


Created a file, read a file
Created a file, read a file

Rewritten, on-brand PDF export function for the Olivia workspace

Presented file
Done
What changed vs. the original, and why:

Real brand colors, not the mismatched blue/orange — swapped 
#244a73 headings and the generic gradient-circle logo for the actual system: cream paper (
#faf9f6), forest green (
#1c4532/
#2d785a) for headings/structure, terracotta amber (
#c4622d) used sparingly as accent — exactly how it's used site-wide (kickers, left-borders, hover states), not as a loud background.
Actual Olivia mark, not a placeholder — embedded the exact SVG icon used in your favicon/sidebar (olive branch + terracotta fruit on the forest-green rounded square) instead of a generic gradient dot.
Correct typeface stack — Fraunces for the wordmark and content headings, Plus Jakarta Sans for body, JetBrains Mono for the kicker/meta/labels — matching every other Olivia surface.
Fonts actually render before printing — added a document.fonts.ready wait (with a timeout fallback) so the PDF isn't captured mid-swap on a system fallback font, which is a real risk when loading webfonts into a print iframe.
Colors survive the print step — added print-color-adjust: exact globally; without it, Chrome silently strips background colors/gradients when printing, so the accent bar and cream background would've disappeared in the actual PDF.
Print-quality typography — proper heading scale, amber-bordered blockquotes/code blocks (matching your card/callout pattern), striped tables, and page-break/break-inside: avoid on headings, code, and tables so they don't get orphaned across pages.
Reusable brand config — pulled everything into OLIVIA_PDF_BRAND at the top, so any other export/print function in the workspace can reference the same kit instead of re-hardcoding colors.
Drop this in place of the old function — it still depends on your existing _lastAssistantMessage() and addSystemBubble() helpers, untouched.