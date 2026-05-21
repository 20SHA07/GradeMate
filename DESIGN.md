---
name: "GradeMate"
description: "A deep black premium student workspace for GPA, course grades, contextual syllabus extraction, and KU course templates."
colors:
  app-bg: "#060809"
  sidebar: "#0d1214"
  surface: "#0b0f10"
  surface-muted: "#101617"
  panel: "#080c0d"
  border: "#1f282a"
  border-strong: "#344044"
  text-primary: "#f8fafc"
  text-secondary: "#a6afbb"
  text-muted: "#7f8996"
  teal-primary: "#14b8a6"
  teal-hover: "#2dd4bf"
  teal-soft: "#062f2c"
  teal-text: "#5eead4"
  warning: "#fbbf24"
  warning-soft: "#451a03"
  success: "#bef264"
  success-soft: "#1a2e05"
  danger: "#fda4af"
  danger-soft: "#4c0519"
  light-bg: "#f7f8fb"
  light-surface: "#ffffff"
typography:
  chosenFont: "Plus Jakarta Sans"
  fallbackStack: "var(--font-app), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
  display:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "2.625rem"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "normal"
  headline:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1.625rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "normal"
  title:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "normal"
  body:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  label:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "normal"
  button:
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "normal"
  table:
    bodySize: "0.8125rem"
    headerSize: "0.6875rem"
    headerTracking: "0.06em"
    bodyWeight: 500
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "10px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.teal-primary}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.teal-hover}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
    height: "40px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "20px"
  badge:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.xs}"
    padding: "4px 10px"
  sidebar-item-active:
    backgroundColor: "{colors.teal-primary}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
---

# Design System: GradeMate

## 1. Canonical Reference

The Student Workspace Dashboard is now the master GradeMate design system. Treat it as the source of truth for every route, including public, auth, admin, calculator, library, and review flows.

The older Stitch screenshots remain useful as page-specific structure references, but the dashboard screenshot wins when there is a conflict. A page is successful only when it feels like it belongs beside the dashboard without changing products.

### Dashboard Source Of Truth

- Deep black app canvas with a slightly lifted left sidebar.
- GradeMate logo in teal at the top-left, with a small uppercase university label below it.
- Compact sidebar navigation with teal active state, gray inactive icons, and no clipped labels.
- Content area with roomy horizontal margins, dense vertical rhythm, and thin bordered panels.
- Teal primary buttons, dark secondary buttons, and quiet ghost actions.
- Dashboard cards that are almost flat: border first, shadow never decorative.
- Small uppercase labels for metrics and stat captions.
- Crisp page title around 28px to 32px, with a short one-line description.
- Empty states inside real panels, never oversized marketing cards.
- Privacy and unofficial disclaimers as small trust notes.

### Density And Rhythm Rule

Do not make a page feel premium by adding empty space. Improve hierarchy through tighter grouping, aligned edges, compact table-like rows, clearer section order, and deliberate contrast between primary panels and supporting details.

## 2. Overview

**Creative North Star: "The Student Workspace Console"**

GradeMate is a focused student workspace, not a decorative product demo. It should follow the dashboard language everywhere: black workspace canvas, compact charcoal sidebar, teal active states, square thin-bordered cards, dense readable tables, and dedicated review surfaces for syllabus extraction.

The system should feel calm by default and powerful on demand. Students should see the next useful action without being surrounded by every tool at once. Advanced workflows belong behind tabs, modals, accordions, or secondary buttons.

The visual language rejects generic SaaS dashboards, AI slop, random gradients, huge cards, clutter, truncated labels, and technical copy. Trust comes from restraint, clarity, and review-before-save moments.

**Key Characteristics:**

- Deep black premium student workspace.
- Teal as the only primary accent.
- Compact sidebar and dense but readable content.
- Mostly square panels with thin borders over heavy shadows.
- Public and auth pages should feel like entry points into the same workspace, not separate marketing sites.
- Clear review states for syllabus extraction.
- Privacy-first copy and behavior.

## 3. Colors

The palette is a restrained dark product system: black foundations, charcoal surfaces, off-white text, muted gray-blue metadata, and rare teal actions. The dashboard sets the contrast target: the page should read black first, teal second, content third.

### Primary

- **Campus Teal** (#14b8a6): Primary actions, active navigation, selected tabs, progress accents, and trusted success moments.
- **Teal Hover** (#2dd4bf): Hover and active interaction states for primary controls.
- **Local Review Teal** (#5eead4): High-contrast teal text in dark mode, especially for links, badges, and detected-from-syllabus states.

### Secondary

- **Academic Amber** (#fbbf24): Warnings, needs-review states, and extraction split confirmations. Use sparingly so warnings remain meaningful.
- **Feedback Lime** (#bef264): Correct, ready, or verified states where teal would conflict with primary action.
- **Soft Rose** (#fda4af): Errors, destructive actions, and failed states only.

### Neutral

- **Study Black** (#060809): App background and page canvas.
- **Sidebar Black** (#0d1214): Left sidebar, mobile footer, and persistent chrome.
- **Panel Black** (#080c0d): Main working panels and table bodies.
- **Charcoal Surface** (#0b0f10): Cards, inputs, and modals.
- **Muted Surface** (#101617): Table headers, nested utility areas, and collapsed details.
- **Quiet Border** (#1f282a): Default card, table, input, and sidebar borders.
- **Strong Border** (#344044): Hover, focus-adjacent, or higher-emphasis separators.
- **Primary Text** (#f8fafc): Page titles, metric values, course names, and primary labels.
- **Secondary Text** (#a6afbb): Descriptions and helper text.
- **Muted Text** (#7f8996): Metadata, timestamps, low-emphasis hints, and disabled copy.

### Named Rules

**The One Accent Rule.** Teal is the only dominant accent. Do not introduce purple, blue gradients, rainbow status systems, or decorative color lanes.

**The Trust Contrast Rule.** Any text that explains grades, weights, authentication, privacy, or saving must meet strong contrast against the dark surface. Muted text is for context, never for critical status.

## 4. Typography

**Display Font:** Plus Jakarta Sans via `next/font/google`.
**Body Font:** Plus Jakarta Sans via `--font-app`, falling back to system UI.
**Label/Mono Font:** Plus Jakarta Sans for labels; use monospace only for code-like debug output or imported data previews.

**Character:** Clear, compact, geometric, and product-native. The Stitch references use rounded modern sans forms, tiny crisp labels, and a slightly technical study-console feel. GradeMate should read like a serious student tool, not a magazine, not a marketing page, and not a terminal.

### Hierarchy

- **Display** (700, 2.25rem mobile to 2.625rem desktop, 1.12 line-height): Landing headline only. Controlled, never generic SaaS oversized.
- **Headline** (700, 1.75rem to 2rem, 1.15 line-height): Page headers such as Student Workspace, Course Library, and Review Extraction.
- **Title** (600, 0.9375rem to 1rem, 1.35 line-height): Card titles, course names, modal titles, and section headings.
- **Body** (400, 0.875rem, 1.55 line-height): Descriptions, helper text, workflow copy, table descriptions, and privacy notes. Dense support copy can use 0.8125rem.
- **Label** (600-700, 0.6875rem to 0.75rem, 1.25 line-height): Badges, table headers, metadata, field captions, and compact stat labels.
- **Button** (600, 0.78125rem to 0.875rem, 1 line-height): Compact utility buttons. Do not use oversized text.
- **Table** (500, 0.8125rem body; 700, 0.6875rem header): Tight rows with restrained uppercase header tracking.

### Named Rules

**The No Chopped Labels Rule.** Sidebar labels, mode switch labels, target grade pills, and action buttons must remain readable. Shorten the copy before truncating the UI.

**The Product Scale Rule.** App screens use compact fixed type sizes. Large marketing type is allowed on the landing page only.

**The Tracking Rule.** Body, headings, buttons, and nav labels use normal letter spacing. Uppercase labels may use `0.06em` to `0.08em`; avoid wider tracking because it makes the UI feel synthetic.

## 5. Elevation

GradeMate uses tonal layering and borders first, shadows second. Stitch surfaces are nearly flat: hierarchy comes from black canvas, charcoal surfaces, hairline borders, and tight spacing. Shadows are rare and structural, not decorative.

### Shadow Vocabulary

- **Soft Surface Shadow** (`0 18px 50px rgba(23, 29, 40, 0.08)`): Default Card shadow. It adds polish without making the UI float.
- **Teal Action Shadow** (`0 1px 2px rgba(15, 23, 42, 0.2)` with teal-tinted variants): Used only on primary buttons or active navigation when extra separation is needed.

### Named Rules

**The Flat-By-Default Rule.** Cards, tables, and sidebars are mostly flat. Do not use heavy elevation, glassmorphism, blurred panels, or glow effects as decoration.

**The Border Carries Structure Rule.** Thin gray borders define groups. Avoid colored side stripes, thick dividers, and nested boxes that make the page feel busy.

## 6. Components

### Buttons

- **Shape:** Compact rectangle with 4px to 6px radius. Stitch buttons are squared-off and utility-like.
- **Primary:** Campus Teal background, off-white text, 40px default height, 10px vertical and 16px horizontal padding.
- **Hover / Focus:** Teal Hover on hover. Focus ring is teal and visible, with a dark background offset.
- **Secondary:** Charcoal or translucent surface with Quiet Border and Primary Text. Use for alternate paths like Import, Cancel, or Re-upload.
- **Ghost:** Transparent surface for low-emphasis utilities like theme toggle, close, or account actions.
- **Danger:** Rose-tinted surface and text, reserved for deletion or destructive choices.

### Chips

- **Style:** Rectangular, compact, 4px radius, 4px vertical and 10px horizontal padding.
- **State:** Teal for ready or active, amber for needs review, rose for errors, muted ink for metadata.
- **Usage:** Course code, assessment count, total weight, confidence, status, and source labels.

### Cards / Containers

- **Corner Style:** 4px to 8px radius. Most Stitch panels read almost square.
- **Background:** Charcoal Surface in dark mode, Light Surface in light mode.
- **Shadow Strategy:** Use Soft Surface Shadow only at the outer card level.
- **Border:** Quiet Border by default, stronger border on hover only when the card is interactive.
- **Internal Padding:** 16px for compact cards, 20px for standard panels, 24px for main review or modal bodies.

Cards should group real units: course cards, template cards, stat cards, review panels, auth forms, and extraction results. Do not put cards inside cards unless the inner element is a table, alert, or explicit form group.

### Inputs / Fields

- **Style:** 8px radius, Quiet Border, Charcoal Surface, Primary Text, compact 40px height for single-line controls.
- **Focus:** Border shifts to teal and receives a 2px teal focus ring.
- **Error / Disabled:** Rose for error messages, reduced opacity for disabled controls, never raw technical messages.
- **File Inputs:** Dashed border, muted surface, teal file button.

### Sidebar And Navigation

- **Sidebar:** 224px to 240px desktop width, solid Sidebar Black, thin right border, GradeMate identity at top, uppercase university label, nav list in the middle, account actions at bottom. Primary nav is Dashboard, Course Library, GPA Calculator, and Semesters; syllabus review stays contextual inside calculator/course flows.
- **Active State:** Teal background with off-white text.
- **Inactive State:** Muted text, hover on muted surface.
- **Mode Switch:** Two-option segmented control with full labels: Quick and Workspace. Icons can assist, but text must not truncate.
- **Mobile Treatment:** Sidebar collapses into top navigation. Primary actions remain visible, but secondary actions can move into page content.

### Page Headers

- Use one shared rhythm: title, one short description, optional right-aligned actions.
- Titles should feel like the dashboard title: compact, bold, and clean.
- Eyebrows are rare and uppercase. Use teal only when it helps orientation.
- Avoid introductory paragraphs that repeat the title.

### Empty States

- Empty states live inside thin-bordered panels with the same dark card treatment.
- Use one small teal icon tile, a short title, one sentence, and a single primary action when possible.
- Do not create oversized friendly illustrations, huge blank cards, or marketing copy inside task screens.

### Tables

- **Style:** Dense rows, muted table header, thin row dividers, readable cell padding. The Stitch tables use dark row bodies, square editable cells, and compact numeric columns.
- **Mobile:** Horizontal scroll stays inside the table container, never on the whole page.
- **Usage:** Assessment review, course assessment lists, admin review rows, and import preview data.
- **Editing:** Inline fields should keep table rhythm and not inflate row height excessively.

### Extraction Review

- **Style:** Contextual confirmation modal/page launched from GPA Calculator or course detail, not a separate primary sidebar destination. Match the Stitch extraction reference: large title, success banner, single editable table, footer total check, and right-aligned actions.
- **Header:** "Review extraction" with a calm success message: "Syllabus processed locally. Review before saving."
- **Sections:** Course info suggestions, editable assessment table, total weight check, warnings, privacy note.
- **Actions:** Re-upload, Cancel when relevant, Confirm & Save or Confirm & Add to Workspace.
- **Privacy:** Always include "PDFs are read locally and not stored" on normal extraction flows.

### Page Layouts

- **Landing:** Public entry version of the dashboard: dark nav, compact centered hero, two CTAs, dashboard-style feature cards, subtle trust/disclaimer notes.
- **Workspace Dashboard:** Sidebar shell, overview stats, smart extraction panel, current courses, compact actions.
- **Simple Mode:** Sidebar-style calculator, term summary, dense course rows, planner access in the header, and scan/review tools behind course modals.
- **Course Library:** Sidebar shell, search and filters at top, dense 3-column card grid below, ready templates only for normal users.
- **Course Detail:** Header and stats first, then tabs: Assessments, Planner, Syllabus, Details.
- **Admin / Contribution:** Same dark product shell, clear review actions, no raw extraction JSON in normal view.

## 7. Do's and Don'ts

### Do:

- **Do** use the Stitch screenshots as the visual north star: dark shell, compact sidebar, teal active states, thin borders, and focused content.
- **Do** keep the main screen calm by default and move power tools behind tabs, modals, accordions, or secondary buttons.
- **Do** use Campus Teal (#0d9488) for primary actions, selected states, and progress accents.
- **Do** keep course rows, assessment tables, and Course Library cards dense but readable.
- **Do** show extraction as a review-before-save confirmation experience.
- **Do** keep PDF privacy visible: normal PDFs are read locally and not stored.
- **Do** use friendly errors and recovery steps for auth, Supabase, storage, and offline states.
- **Do** make mobile behavior structural: stacked cards, internal table scroll, no horizontal page overflow.

### Don't:

- **Don't** make GradeMate look like a generic SaaS dashboard.
- **Don't** add AI slop: vague magic copy, decorative automation panels, or fake intelligence language.
- **Don't** use huge cards, oversized app panels, random gradients, decorative blobs, glassmorphism, or neon effects.
- **Don't** show raw technical copy such as Edge Function, PKCE code verifier, invalid API key, Gemini, Ollama, or stack traces.
- **Don't** truncate sidebar labels, mode switch labels, course codes, or primary action text.
- **Don't** show planner, extractor, add form, and details all at once on course detail pages.
- **Don't** store normal syllabus PDFs or imply that PDFs are uploaded during ordinary extraction.
- **Don't** use colored side-stripe borders, heavy shadows, or nested card stacks to create hierarchy.
