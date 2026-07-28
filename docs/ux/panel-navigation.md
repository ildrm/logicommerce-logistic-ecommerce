# Panel navigation

Public, consumer, C2C seller, business seller, supplier, B2B buyer, warehouse,
carrier, control tower, service, finance, compliance, tenant admin, platform admin,
and developer surfaces use role-specific navigation. Hidden navigation is not an
authorization control; every route and API action is permission checked.

Current primary routes are `/dashboard`, `/storefront`, `/freight`, `/account`,
`/operations`, `/operations/freight`, `/operations/dispatch`, and
`/operations/billing`. `/freight` is the customer request, quote, invoice,
payment, booking, and milestone workspace. The three operations routes separate
demand/quotation, dispatch/check-ins, and receivables/payment duties.
