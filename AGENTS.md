# Fretwork

- Start with [README.md](README.md). Use [web/README.md](web/README.md) for Rails.
- Edit the sources in `examples/wam/` (Play and Studio), `src/` (WAM and DSP),
  or `web/` (Rails). Distribution assets are generated.
- Read the contract and tests for the affected domain. Flag divergences
  between the active contract and current behavior before changing behavior.
- Keep input monitoring explicit. Preserve existing takes on failure and keep
  allocations, network access and DOM work out of steady-state audio rendering.
- Run focused tests. The broader suites are `npm test` and `bin/rails test`
  from `web/`. Report the checks that actually ran.
- Update a changed durable contract and its regression check in the same PR.
  Keep open decisions and task status in the ticket or PR.
