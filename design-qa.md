# Design QA — Analytics KPI strips

## Scope

Compared the KPI strips on Analytics → Overview, Content, Audience, and Revenue against the supplied YouTube Studio references. Channel identity, media, and metric values remain project data and were not copied from the references.

## Reference evidence

- Overview: `C:\Users\oatmeal\AppData\Local\Temp\codex-clipboard-e91d95bc-6d09-4891-a27e-b560b66bd8dd.png`
- Content: `C:\Users\oatmeal\AppData\Local\Temp\codex-clipboard-6a4e672a-2361-4d0e-b688-b22f672c2b63.png`
- Audience: `C:\Users\oatmeal\AppData\Local\Temp\codex-clipboard-9adec45e-01cc-4606-bcd3-f623f6094552.png`
- Revenue: `C:\Users\oatmeal\AppData\Local\Temp\codex-clipboard-e3e0c997-6153-4d5f-af36-5dcfa8c0d0fb.png`

## Implementation evidence

- Overview: `C:\Users\oatmeal\AppData\Local\Temp\youtube-analytics-qa\overview-implementation.png`
- Content: `C:\Users\oatmeal\AppData\Local\Temp\youtube-analytics-qa\content-implementation-final-2.png`
- Audience: `C:\Users\oatmeal\AppData\Local\Temp\youtube-analytics-qa\audience-implementation.png`
- Revenue: `C:\Users\oatmeal\AppData\Local\Temp\youtube-analytics-qa\revenue-implementation.png`
- Focused Content source/implementation comparison: `C:\Users\oatmeal\AppData\Local\Temp\youtube-analytics-qa\content-kpi-comparison-final-2.png`
- Focused Revenue source/implementation comparison: `C:\Users\oatmeal\AppData\Local\Temp\youtube-analytics-qa\revenue-hero-comparison.png`

## State and viewport

- Theme: dark
- Period: last 28 days
- Content filter: All
- Selected metric: first KPI
- CSS viewport: 1920 × 1020
- Captured implementation: 2133 × 1133 physical pixels at device scale
- Focused Content strips normalized to 1537 × 138 pixels for direct comparison

## Findings and fixes

- P1: Content used the wrong KPI schema. Replaced it with Views, Engaged views, Likes, and Subscribers.
- P1: Period comparison text was not consistently calculated from the preceding equal-length period. It now recalculates for each selected period.
- P2: Active and inactive dark card backgrounds were reversed. The selected card is now black and inactive cards are gray.
- P2: Comparison copy was oversized. It is now one pixel smaller at 11px.
- P2: Engaged views and Likes shared the same synthetic daily shape. They now use independent deterministic distributions while reconciling exactly to their totals.
- P2: Daily metric allocation could exceed that day's views at the extreme. Engaged views and valid Likes data are now bounded by Views in every bucket.
- P2: Content-type subscriber cards and graphs could differ through repeated rounding. They now share one reconciled allocation.
- No remaining P0, P1, or P2 mismatch was found in the scoped KPI strips.

## Interaction checks

- All four Content KPI cards switch the graph.
- Seven-day and 28-day selections recalculate values and previous-period percentages.
- Overview and Audience show the same subscriber result for the same period.
- Revenue shows no percentage comparison.
- Browser console contains no errors.

## Verification

- `npm run lint`
- `npm run verify:analytics`
- `npm run build`
- `git diff --check`

## Result

passed
