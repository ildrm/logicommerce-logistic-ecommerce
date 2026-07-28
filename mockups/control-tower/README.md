# Northstar Control Tower mockup

Open `index.html` directly in any modern browser. No build step, server, external fonts, images, or packages are required.

This is a retained visual reference, not a connected product dashboard. The
implemented analytical surface is `/dashboard`; freight operations use
`/operations/freight`, `/operations/dispatch`, and `/operations/billing`.

## Interactions

- Filter the exception queue by **All**, **Critical**, or **Watch**, and select individual exception rows.
- Open the Rotterdam → Istanbul recommendation with **Review decision**. Approve it to resolve the exception and update the live count, or keep the current plan without changing data. The drawer supports Escape-to-close and keyboard focus trapping.
- Switch the schematic map between **Network**, **Shipments**, and **Weather** layers, then select any map node for local context.
- Use **Refresh** to simulate a network sync and timestamp update.
- Select navigation items or use the command affordance (`Cmd/Ctrl + K`) for contextual feedback.

The layout is optimized for a 1440 × 1000 review canvas and adapts down to a 375 px mobile viewport with a bottom navigation dock and full-height decision panel.
