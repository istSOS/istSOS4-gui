# UI organization

The UI uses the Next.js App Router with feature folders outside `app`.

| Folder | Responsibility |
| --- | --- |
| `app/` | Route pages, layouts, providers, and API route handlers. Pages compose feature components and handle route parameters, authentication redirects, and initial server reads. |
| `features/` | Domain UI, hooks, and supporting logic. Each feature uses `components/`, `hooks/`, and `lib/` as needed. |
| `components/` | Shared UI such as the navbar, icons, and generic table. Feature-specific components stay with their feature. |
| `config/` | Deployment settings and shared configuration, including browser-facing base paths in `paths.ts`. |
| `context/` | Application-wide React state providers. |
| `services/` | Existing Server Actions for authentication, entity reads, and CRUD operations, plus their shared fetch transport. Client features can invoke these actions through Next.js. |
| `server/` | Server-side implementation behind API routes and services: upstream endpoint validation, configuration files, quality-control services, and historical reads. Existing entity reader modules also live here. |
| `lib/` | Helpers shared by multiple features, including authorization, source tokens, commit metadata, deletion rules, and validity intervals. |
| `types/` | Shared domain and application types. Feature-local types stay with their feature. |
| `locales/`, `styles/`, `public/` | Translations, global styles, and static assets. |

## Home

`app/page.tsx` loads the initial data and renders
`features/home/components/HomePage.tsx`. The Home feature coordinates the map,
datastream table, charts, and entity forms:

- `components/HomePage.tsx` composes the page UI.
- `hooks/useChartState.ts` manages chart selection and observation loading.
- `hooks/useDataSourcesSync.ts` refreshes the data from configured sources.
- `lib/` contains Home's form preparation, workbook exports, source metadata,
  and helpers.

The homepage datastream table scrolls continuously across groups of 25 rows.
Its page indicator follows the scroll position, and page buttons jump directly
to each group. HeroUI virtualizes the rows; search, sorting, map focus, pinned
streams, column selection and row actions continue to use the complete list.

Login's client component belongs to `features/auth/components/`; the entity
history page component belongs to `features/from-to/components/`. Their public
routes remain in `app/login/` and `app/history/[...entity]/`.

## Datastream Details

Details opens a read-only plot with an observation table below it. Its compact
toolbar places the period controls and close button on the first row, followed
by station/datastream chips and Add datastream. The dialog title is available
to screen readers without a visible heading. Opening a
row loads only that datastream. **Add datastream** searches names, stations,
observed properties and sources. Added streams stay in the list above the plot;
only A and B are plotted. Choosing a grey entry fills or replaces B, preserving
A. Hidden entries can be shown again or removed from the list. Streams are
identified by source and ID, including when different sources reuse IDs.

Each stream has a style menu for line or bar display. Line options include solid,
dashed, dotted or points-only display and point visibility. Both displays support
preset/custom colours and Reset style. Bars use a zero baseline and retain every
recorded value without aggregation or line downsampling. Choices persist in this
browser per source and datastream. These settings affect series appearance;
quality colours and interpretation remain shared with Edit/QC.

Graph clicks and brushing select and reveal matching table rows without
opening a side panel or changing the plot layout. Table
selections highlight corresponding points in magenta with a white outline,
without changing the view. The Details and Edit/QC tables scroll continuously across page
boundaries; page buttons jump to the same scroll positions and the active page
follows scrolling. Only nearby rows are rendered, while headers and pagination
remain visible and selections persist across pages. In both plots, Select
observations is grey when inactive and green when active. Clear selection
removes selected points and brush ranges, then exits range-selection mode so
individual point clicks work immediately. **Zoom to
selection** and **Reset zoom** are plot toolbox icons alongside Download. The
first focuses selected readings; the second restores the selected date range,
including empty margins. Both/A/B filters restrict the combined
table without changing the plot or clearing selections. Hiding the table keeps
selection. Streams with matching units share a value axis; different units use
labelled left/right axes. Plots retain only faint horizontal grid lines.
The date axis targets seven ticks with horizontal labels that adapt to the
visible period as the user zooms; tooltips retain precise ISO8601 timestamps.

Date changes and snapshot refreshes load only the active streams. Snapshot
comparisons keep rows separate and show real timestamps even on an aligned
plot. Quality info icons use the Edit/QC explanation inside the modal's focus
scope so Escape closes the explanation without closing Details.

Hover tooltips show the datastream name, the observation's ISO8601 timestamp
and value, then a compact quality code with an info icon. The table uses the
same quality display. Recognized bitmasks include a short coloured status;
unrecognized flags retain their raw code and explain the interpretation limit
through the info icon. Missing quality displays a dash.

From/To datetime controls and the fixed UTC offset selector are shared with
Edit/QC Step 1. Both views default to the browser’s current local UTC offset
(including its current daylight-saving adjustment), and users can choose a
different fixed offset. The chosen offset applies to observation timestamps in the
plot, tooltip and table. Changing it preserves the UTC period, zoom and
selection. **Apply period** loads edited bounds; **Default period** restores
the default window.

`ObservationTable` supplies selection, column visibility, continuous scrolling,
and pagination to both
Details and `QcTable`. The views also share quality badges, explanations,
bitmask decoding, magenta selection markers, selection zoom, and brush-range
handling. Scrolling an edited QC row out of the rendered window commits its
cell value through the existing blur behaviour. Details has no
quality customization or editing workflow. Exports retain stored quality flags.

## Dependencies

Features and shared helpers must not import implementation from `app/`.
Shared configuration belongs in `config/`, shared UI in `components/`, and
cross-feature helpers in `lib/`. Route files import features to compose screens.

Keep Server Action entry points in `services/` marked with `'use server'`.
Request handling, file access, and upstream service credentials belong in
server-side code. Preserve that boundary when moving modules; changing a folder
name does not establish a server/client boundary by itself.

Keep route-specific URL parsing and validation with the route. Move reusable
or substantial page UI into the owning feature. Moving files does not require
changing URLs or introducing a `src/` directory.

Regression checks are available through `test:map`, `test:observations`,
`test:versioning`, `test:data-sources`, and `test:qc` in `package.json`.

## Snapshot request diagnostics

Map and station snapshot requests (`/api/as-of/things` and `/api/as-of/thing`)
cancel obsolete browser fetches when the date or station changes, snapshot mode
ends, or the view unmounts. The routes forward their request abort signal to
upstream reads, including pagination and the missing-station history fallback.
The optional readings timeout remains separate from cancellation: it can omit
readings, while cancellation stops the snapshot without substituting live data.

Inspect a snapshot request in browser DevTools → Network. `Server-Timing`
reports total server duration and upstream stages: `things`, `metadata`,
`readings`, `locations`, and `placement`. Map stages use `source0_`, `source1_`,
etc., matching configured source order. Stage durations sum the time spent
fetching and parsing their pages; parallel stages should not be added together
to estimate total latency. Descriptions include request and row counts.

`X-As-Of-Request-Id` matches one `[as-of]` JSON summary in GUI server logs.
Summaries also count upstream errors, cancellations and timeouts per stage;
cancelled requests use status 499. Tokens, upstream URLs and response data are
excluded. These measurements cover snapshot map/panel reads; chart observation
Server Actions and timeline commit requests are separate paths. Run
`npm run test:versioning` for timing and cancellation regression checks.
