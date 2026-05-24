---
name: design
description: Production UI design direction powered by GLM-5.1 — applies frontend-design-direction ECC skill through glm_design for purposeful, polished interfaces
user-invocable: true
---

# Design — GLM-5.1 + Frontend Design Direction

Combines the ECC `frontend-design-direction` skill with GLM-5.1 via `glm_design` for production-grade UI work.

## Usage
```
/design [description of UI to build or improve]
/design review [file or code to review]
/design styling [component or page]
/design direction [project context — establishes tone/palette/hierarchy]
```

## When to Use

- Building a web page, app, dashboard, component, or any web UI
- Making an interface more polished, distinctive, or less generic
- Need visual hierarchy, typography, color, motion, layout guidance
- Current UI feels flat, generic, templated, or mismatched to the audience
- Before starting frontend implementation — to establish design direction

## Instructions

When user invokes `/design [request]`:

### Step 1: Establish Design Direction

Before any code, determine:

1. **Purpose** — what job does this interface do?
2. **Audience** — who uses this daily, what do they scan first?
3. **Tone** — utilitarian, editorial, playful, industrial, refined, technical, minimal, dense, calm, or other explicit direction
4. **Memorable detail** — one design idea that makes it feel intentional
5. **Constraints** — framework, accessibility, performance, responsiveness, existing design system

Match tone to domain:
- SaaS ops tool → dense, quiet, scannable
- Portfolio / launch page → more expressive
- Dashboard → data-dense, restrained color
- Editorial → typographic hierarchy, whitespace

### Step 2: Call glm_design

Use `tachibot-mcp_glm_design` with the design direction as context:

```
query: "[the user's design request, enriched with direction from Step 1]"
task: "design-review" | "styling" | "design-to-code" | "accessibility" | "responsive" | "color-scheme" | "layout" | "general"
framework: "tailwind" | "css" | "vue" | "react" | "nuxt" | "next" | "svelte" | "html"
files: [relevant source files for context]
```

### Step 3: Apply Implementation Guidance

Enforce these rules on the output:

- Build the actual usable experience, not marketing copy (unless requested)
- Use existing project components, tokens, icon libraries before new systems
- Prefer contextual typography over generic oversized hero text
- Keep palettes multi-dimensional — no single-hue dominance
- Use CSS variables / design tokens for coherence
- Design responsive constraints explicitly (grids, aspect ratios, min/max)
- Use motion sparingly, high-signal transitions only
- Verify text fit on mobile and desktop

### Step 4: Anti-Pattern Check

Reject these patterns from generated output:

- Purple gradients, decorative blobs, oversized cards, vague hero copy
- Cards inside cards
- Single decorative style everywhere
- Hiding primary workflow behind marketing sections
- New dependencies for design flourishes
- UI describing its own features when controls speak for themselves

### Step 5: Review Checklist

Verify the result:

- [ ] First viewport communicates the product/workflow
- [ ] Visual hierarchy supports scanning and repeated use
- [ ] Typography fits containers without overlap
- [ ] Color has contrast, not one-note
- [ ] Icons for familiar tool actions
- [ ] Responsive layout has stable dimensions
- [ ] Assets carry subject matter, not filler
- [ ] Motion improves orientation
- [ ] Matches existing frontend conventions

## `/design` vs Other Skills

| Need | Use |
|------|-----|
| Design direction + implementation | `/design` (this skill) |
| Frontend code patterns (React/Next) | `frontend-patterns` ECC skill |
| Accessibility compliance | `wcag-2.2` skill |
| SEO optimization | `seo-optimization` skill |
| Nuxt/Vue specifics | `nuxt-vue-docs` skill |

## Integration with TachiBot Tools

| Task Type | Primary Tool | Fallback |
|-----------|-------------|----------|
| Design-to-code | `glm_design` (task: design-to-code) | `qwen_coder` |
| Styling review | `glm_design` (task: design-review) | `gemini_analyze_code` |
| Color/palette | `glm_design` (task: color-scheme) | — |
| Layout/responsive | `glm_design` (task: responsive) | — |
| Accessibility review | `glm_design` (task: accessibility) | `wcag-2.2` skill |

## Examples

```
/design "Build a SaaS dashboard for monitoring k3s cluster health"
→ Direction: dense, industrial, scannable
→ glm_design: layout + color-scheme
→ Output: Tailwind dashboard with status cards, charts, node list

/design review src/components/Header.vue
→ Direction: matches existing site tone
→ glm_design: design-review with file context
→ Output: Specific improvements with code diffs

/design direction "E-commerce product page for handmade ceramics shop"
→ Direction: editorial, warm, tactile
→ glm_design: color-scheme + typography guidance
→ Output: Design direction doc + CSS variables + component sketch

/design styling "Make the pricing section less generic"
→ glm_design: styling task
→ Output: Refined pricing section with anti-generic patterns
```
