# Web

Next.js App Router application for storefront and role-aware panels. Server
Components are the default; business data is obtained through the typed API
client.

The `/account` client surface covers tenant-controlled customer registration,
Phase 1 password/MFA sign-in, generic reset requests, active-session management,
TOTP enrollment, one-time recovery-code display, tenant role creation and
permission grants, tenant user creation, and user-role assignment. It is
covered in Chromium desktop and Pixel 7 viewports.

Primary workspaces are `/dashboard`, `/storefront`, `/freight`, `/account`,
`/operations`, `/operations/freight`, `/operations/dispatch`, and
`/operations/billing`. The customer freight workspace renders a chronological
milestone timeline for each booking. It does not render a live GPS trail or a
single combined quote/payment/travel audit timeline.

Phase 13 adds `/postal`, `/operations/network`, `/operations/insurance`, and
`/operations/postal`. `/freight` also shows insurance quotes, certificates,
premium invoices, and owned claims. `/dashboard` summarizes physical handling,
consolidation, insurance, customs, and postal process risks.
