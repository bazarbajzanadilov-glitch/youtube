# Design QA — Analytics KPI strips

## Scope

Compared Analytics → Overview, Content, and Audience with the supplied YouTube
Studio references. Channel identity, videos, and metric values remain the
project's Supabase data.

## Reference evidence

- Overview: `C:\Users\oatmeal\AppData\Local\Temp\codex-clipboard-e91d95bc-6d09-4891-a27e-b560b66bd8dd.png`
- Content: `C:\Users\oatmeal\AppData\Local\Temp\codex-clipboard-6a4e672a-2361-4d0e-b688-b22f672c2b63.png`
- Audience: `C:\Users\oatmeal\AppData\Local\Temp\codex-clipboard-9adec45e-01cc-4606-bcd3-f623f6094552.png`
- Compact subscriber value: `C:\Users\oatmeal\AppData\Local\Temp\codex-clipboard-d2eba075-50b3-4bae-bd50-13558ab80c9b.png`

## Implementation evidence

- Overview: `C:\Users\oatmeal\Documents\youtube\.codex\qa\analytics-overview-after.png`
- Browser: the user's open Chrome localhost tab
- Theme: dark
- Periods checked: 7, 28, and 365 days

## Findings and fixes

- Positive Views, Watch time, and Subscriber comparisons now use percentages
  against the preceding equal-length period.
- Below-usual values now use `Значение ниже обычного (на X)`.
- Views, Watch time, and Subscribers use signed compact KPI values such as
  `+6,3 тыс.` and `+89,5 тыс.`.
- Revenue remains without comparison text.
- The selected Content KPI still switches the chart.
- Overview, Content, and Audience show the same subscriber result.
- The Supabase subscriber history now has a slow monthly regime plus small
  daily variation, without a last-day spike.

## Data checks

- Stored history: 365 days.
- Stored total: 80,143, equal to `channels.subscriber_count`.
- Current 28 days: 6,365.
- Previous 28 days: 3,769.
- Period change: +68.9%.
- Daily range: 119–362.
- Largest adjacent-day change: 25.

## Verification

- `npm run lint`
- `npm run verify:analytics`
- `npm run build`
- `git diff --check`
- No new browser console errors after a clean reload.

final result: passed
