# Finfy Auth UX Benchmark & Principles

Finfy’s authentication should feel lightweight, trustworthy, and fast: collect only what is essential, communicate clearly, and keep users focused on entering the product. The following benchmark-derived principles translate modern SaaS patterns into actionable guidance for Finfy’s login, sign-up, and immediate post-sign-up moments, with attention to GDPR/LGPD data minimization and future scalability.

## Reference Sources
- Ethereum.org and L2 ecosystem sites (clean hero + concise forms)
- Notion, Linear, Figma, Vercel, Stripe, GitHub auth flows (minimal fields, strong social login CTAs, progressive disclosure)
- Google/Apple OAuth entry points (one-tap/continue patterns)
- Adam Silver – *Form Design Patterns*; Steve Krug – *Don’t Make Me Think, Revisited*
- Nielsen Norman Group, Baymard Institute articles on form clarity, error handling, accessibility, and mobile-first patterns

## Core Auth UX Principles for Finfy
- **Minimize First-Contact Fields**: Ask only for email and password (or social login) at first contact; defer profile details to onboarding. This reduces cognitive load, speeds conversion, and aligns with GDPR/LGPD data minimization.
- **Clear Login vs Create Account Split**: Visually separate primary actions (“Entrar” vs “Criar conta”) with distinct headers and CTAs. Reduces mis-clicks, sets expectations, and lowers friction for returning users.
- **Prominent Social/Passkey Options**: Place “Continuar com Google” above the form or inline with equal weight; keep a primary email option visible. Shortens time-to-first-session and builds trust via recognizable identity providers.
- **Progressive Profiling**: Collect optional data (name, currency preferences) after initial authentication, not in the core sign-up form. Maintains momentum and keeps initial PII collection minimal for compliance.
- **Persistent Labels & Inline Hints**: Use floating or always-visible labels (not placeholders alone) plus concise helper text for password rules. Improves accessibility, reduces input errors, and supports screen readers.
- **Network vs Credential Error Clarity**: Distinguish connectivity errors (“Não foi possível conectar, tente novamente”) from invalid credentials (“Email ou senha incorretos”). Prevents confusion, aids support, and respects user trust.
- **Accessible Focus & Keyboard Flow**: Ensure tab order, focus rings, aria-live regions for errors, and sufficient contrast. Critical for inclusivity, WCAG compliance, and mobile/desktop parity.
- **Mobile-First, Single-Column Forms**: Use a single-column layout with generous tap targets and sticky primary action on small screens. Reduces reach and scrolling, improving mobile completion rates.
- **Visible Password Controls**: Provide show/hide toggle, password manager-friendly fields, and guidance on password strength without blocking submission. Balances security expectations with usability.
- **Explicit Consent & Transparency**: If terms/privacidade consent is needed, keep it short, with links and clear wording; avoid pre-checked boxes. Supports GDPR/LGPD transparency and informed consent.
- **Session Feedback & Loading States**: Show button spinners and disable duplicate submissions; confirm successful login/registration with brief feedback. Prevents duplicate requests and perceived slowness.
- **Safe Default Redirects**: After auth, route to a stable landing (e.g., dashboard welcome) with clear next step; avoid “dead” screens. Maintains momentum and clarifies what to do next.
- **Recovery & Support Paths**: Provide “Esqueci a senha” and “Problemas para entrar?” links with non-blocking flows. Reduces abandonment for users with credential issues.
- **Privacy-First Copy**: Reinforce that data is stored securely (httpOnly cookies, minimal fields) and that email may be used for verification. Builds trust and sets expectations about upcoming confirmation steps.

## Applying Principles to Finfy Auth Screens
### Login
- Keep a single-column form with email + password, plus a prominent “Continuar com Google” option above or beside the form.
- Separate headings and CTAs for “Entrar” vs “Criar conta”; make the secondary link understated but visible.
- Use precise error messages: credential errors inline under the password field; network/server issues in a non-field alert.
- Provide “Esqueci a senha” and “Problemas para entrar?” links, ensuring keyboard focus and aria-live for messages.
- Show loading state on submit and prevent double-clicks; ensure responsive spacing for mobile.

### Sign-up
- Only request email and password; include a short checkbox for consent to terms/privacidade with links. Defer name/currency until onboarding.
- Offer Google sign-up at parity with email; keep both options visible without burying the email path.
- Place password guidance beneath the field (e.g., “mín. 8 caracteres”) and allow show/hide toggle.
- Keep the layout calm: concise hero text plus small trust cues (secure cookies, privacy-first); no lengthy marketing copy.
- Prepare for email confirmation: after submit, state that verification may be required and resend is available later.

### Immediate Post-sign-up (pre-onboarding)
- Route to a lightweight welcome with one primary CTA (“Começar configuração”); avoid empty dashboard with no guidance.
- Offer to resend verification if email confirmation is pending; show banner status without blocking exploration when possible.
- Collect deferred fields (name, preferred currency/locale) in a short stepper; allow skip/continue later to respect momentum.
- Provide a small checklist (connect bank later, set budgets) to set expectations without overwhelming; keep all actions reversible.
- Maintain consistent header/footer/actions with login/sign-up for recognizability across micro frontends.

## Notes for Future Micro Frontends / BFF
- Shared auth shell (layout, focus styles, error patterns) ensures consistency across independently deployed modules.
- Centralized design tokens for spacing, buttons, focus rings, and form states keep login/sign-up UIs aligned across services.
- Clear UX contracts (field order, error copy, consent wording) allow BFFs to evolve separately without fragmenting the experience.
- Progressive profiling supports feature teams: onboarding steps can be extended per micro frontend while keeping initial sign-up minimal.
- Standardized empty/loading states and redirect rules reduce edge-case divergence during independent releases.
