# ISTSO4 GUI

## 1. Clone the Repository

```bash
git clone https://github.com/istSOS/istSOS4-gui.git

cd istSOS4-gui
```

## 2. Install dependencies

For Docker development, skip this step: the image generates its lockfile and
installs dependencies during the build. For running Next.js directly:

```bash
cd ui

npm install
```

## 3. Start Development Environment

### Start the development services:

```bash
docker compose -f dev-docker-compose.yaml up -d
```

### Stop the development services:

```bash
docker compose -f dev-docker-compose.yaml down
```

### Development through a VPN (Linux)

If the API works from the host but times out inside Docker, use the host-network
override. This lets the services use the host's VPN routes:

```bash
docker compose -f dev-docker-compose.yaml -f dev-docker-compose.vpn.yaml up -d
```

The GUI stays on port `2000`. When enabled, SaQC is reached at
`http://127.0.0.1:8000` and listens only on the host's loopback interface.
Keep `SAQC_SERVICE_URL=http://saqc:8000` in `.env`; the override translates it
for host networking. An unset or empty value still disables the editor. Enable
the worker with `COMPOSE_PROFILES=saqc` in `.env` or `--profile saqc`.

Use the same two `-f` arguments with `down` to stop this setup. To return to
bridge networking, run the normal development `up -d` command above.

## 4. Access the Application

- **Dashboards (Docker development)**: http://localhost:2000/gui

### Optional version history

Set `NEXT_PUBLIC_VERSIONING_ENABLED=false` (the default when unset) in `.env`
to use only current backend data. This hides the snapshot picker, entity
history buttons, timelines, comparisons, and version commit fields. History
pages and the `/api/as-of/*` and `/api/from-to/*` routes return 404. Observation
charts use current data and do not request commit metadata. No demo stations
or mock history are injected.

Set it to `true` to enable these features against a backend with versioning
support. The setting controls the GUI; it does not change backend history
storage. SaQC editing, quality masks, draft undo/redo, and its audit log remain
available independently. Entity writes still send an automatic commit message
when the field is hidden, since an authenticated backend may require it even
without versioning.

Recreate the development GUI container after changing the setting:

```bash
docker compose -f dev-docker-compose.yaml up -d --force-recreate istsos4-gui
```

If using the VPN override, include `-f dev-docker-compose.vpn.yaml` too.
Production Docker images built from this source accept the setting at container
startup. For a direct Next.js production deployment, set it before `npm run build`.


### Optional SaQC editor

The **Edit & QC** page (`/qc`, under the configured GUI base path) fills the
available page with a graph and an editable observation table. Draft edits and
SaQC previews are kept separately from the observations on the server.

To enable it, add this server-only setting to `.env`:

```dotenv
SAQC_SERVICE_URL=http://saqc:8000
```

Start the optional Python container together with the development GUI:

```bash
docker compose -f dev-docker-compose.yaml --profile saqc up -d --build
```

For production, build the GUI with these changes and run the same `saqc` profile
with `docker-compose.yml`. An external deployment of `qc-service` can also be
used by setting `SAQC_SERVICE_URL` to its URL. The service exposes `POST /preview`
and retains `GET /hello` as a connection diagnostic.

Without `SAQC_SERVICE_URL`, the navigation entry is hidden and both `/qc` and
`/api/qc/hello` return 404. With authorization enabled, the demo is limited to
the primary source's `administrator`, `editor`, and `obs_manager` roles. Each
data request also verifies editing-role authentication against the selected
source's authenticated `/Users` route and reads observations with that source's
token. Source-specific logins can be managed on the Data sources page. With
authorization disabled, access follows the GUI's unrestricted editing mode.
Observation reads remain subject to upstream access policies.

The Python port is internal to the Docker network; its URL and istSOS tokens
are never passed between Python and the browser. Python receives observations
from Next.js and has no database credentials or write operations.

The editor is a five-step workflow. Moving backward retains the active draft,
selection and chart; further value edits invalidate affected validations.
Step-specific actions sit above a full-width plot, with the observation table
visible underneath by default. The table shows 25 rows per page in a limited-height
scroll area, with sticky headings and pagination outside the scroll area. It can
still be hidden. Its header checkbox selects/unselects every observation in the
current filter across all pages and shows a partial state for mixed selections.
Selections outside that filter are retained. Changing selection in the table
removes an earlier plot brush cover so only the current selected points remain
highlighted. Back/Next navigation stays fixed at the bottom of the viewport
throughout the workflow; page padding follows the bar's height so it cannot cover
the last controls. **Stored quality checks** is collapsed by default and shows
defined/selected counts when closed;
opening it or changing its selection never runs checks. Run/Recheck actions
remain visible above the plot. The review and export form sits below the table.

The fixed navigation bar includes **Workload and memory** information. Counts
cover loaded observations and context, changed observations, selected runnable
checks and estimated targets, including pending dependent rows. Before loading,
an observation estimate is available when sampling metadata exists; it assumes
continuous regular data and is not treated as a measured count. The indicator
shares the API's configured 20,000-observation and history-buffer limits and the
service's 60,000-row preview limit. **Heavy** is an advisory estimate when buffer
work exceeds the engine's 2,000,000-value processing-batch budget, or sampling
suggests that a requested period may exceed the observation limit. It is not a
percentage of free RAM or a prediction of execution time.

**Measure page memory** is available only when the browser exposes
`performance.measureUserAgentSpecificMemory()` in a secure, cross-origin-isolated
page. Other environments explicitly report memory measurement as unavailable;
the indicator never substitutes deprecated heap counters, device capacity, or a
fabricated memory estimate. Measurements happen on demand and retain only the
first/latest numeric readings in component memory, with their times and delta.
They measure the page, including supported frames/workers, rather than free RAM
or QC-server memory. No readings are persisted and no background sampling runs.
The indicator includes current Undo/Redo and audit counts for the active session.

1. **Choose data** selects a source, datastream, period and UTC offset. Only
   datastreams with non-empty, structurally valid `properties.constraints` are
   offered; JSON-encoded constraint lists are supported. The browser's current
   offset is the default for each new editing session. Date shortcuts cover
   the last day, week and month. Failed pagination aborts the entire load.
2. **Inspect quality** interprets recorded quality as an **istSOS bitmask** using
   the current stored checks, without asking for a quality mode. Historical
   parameter provenance cannot be inferred from flags alone. Original values and
   flags, including missing flags and numeric strings, stay unchanged. No checks
   run and no quality values are initialized merely by loading observations.
   Rerunning stored checks is optional and explicit. The selection action requires
   selected observations and displays their count. A separate action checks all
   observations in the loaded period, regardless of table filters or selection.
   Both actions update flags only within their stated scope; neighbouring data
   can be read as context. Dependent observations remain pending until explicitly
   rechecked in the validation step. Test types, positions
   and parameters are read-only; the preview API rejects modified definitions.
   Incompatible flags stay visible as unknown raw values and do not block QC.
   Running checks rebuilds unknown draft flags for the requested observations
   from their actual values and stored tests. Original flags remain unchanged
   in the graph, table and audit; unselected observations retain their flags.
   Unrun tests remain pending, and no human approval is inferred from an unknown
   code. Streams with more than four checks remain available for inspection only.
3. **Correct values** selects exact observations or an explicit inclusive interval.
   Replace values, apply an offset, mark missing, or fill/interpolate existing
   records. The chart and a before/after table preview changes. A correction reason
   is required. **Set up correction** expands a horizontal form above the plot;
   applying a correction collapses it and clears the proposed preview. Each interval
   operation is one Undo step. For cell edits, enter their reason above the
   observation table first. Corrections use data state `10`, clear the affected
   value's human decision, and automatically rerun supported stored checks on
   corrected and dependent observations. A correction and its automatic QC remain
   one Undo step; if QC fails, the correction is retained with checks pending for
   a manual retry. Arithmetic and
   interpolation never imply Digital (`01`). Clicking an observation filter also
   replaces the selection with every matching row across all table pages, keeping
   the chart selection synchronized. An empty filter clears the selection.
4. **Human review** reruns affected stored tests with unchanged
   parameters, including dependent context observations. Unsupported definitions
   are unavailable for rerunning; incomplete history or failed execution is never
   a pass. Human review is optional, requires a scope and reason, and never happens
   merely by proceeding. Review updates the separate human pair and preserves
   automatic failures.
5. **Import & Export** summarizes corrections, failures and outstanding decisions.
   Inspect original/draft values and the audit log, return to earlier steps, or
   export observations as `.xlsx`. The observation workbook follows the supplied
   station-file layout: one sheet per datastream, with `time`, `result`,
   `resultQuality`, and `commitMessage` columns. Export all loaded observations
   (the default) or changed observations from the current editing session only. Pending draft checks or quality
   decisions must be completed before exporting observations. **Export detailed
   draft backup** preserves originals, changes, pending decisions and the audit
   log for the active datastream. Upload and custom draft test configurations are
   outside this workflow.

The review step stores one planned commit message per datastream batch alongside
the browser draft. A message is required for observation export when
`NEXT_PUBLIC_VERSIONING_ENABLED=true`, and optional otherwise. It is repeated on
each exported row; it is metadata for a future upload, not a server commit. The
existing istSOS API accepts the message in the `commit-message` HTTP header, not
as an observation property. The current `xlsx2istsos` utility reads only the first
three columns and uses its `--commit-message` argument; it does not read the new
fourth column. Changed-only exports can be irregular and are not suitable for
that utility's regular-series import checks. Filenames use the station name and
last exported timestamp, for example `TIC_7500_20260604040000+0100.xlsx`.

Supported historical check functions are `flagRange`, `flagConstants`,
`flagZScore`, `flagNAN`, `flagJumps` and `flagByVariance`. Z-score requires a
stored `center=false`; parameters are never adjusted to make a definition run.
Each target is the newest point in its historical buffer, using the production
QC calculation and 80% default coverage rule. SaQC is pinned to `2.7.0.post3`
and pandas to `2.3.3`.

QC editing state lives only in page memory. Undo/Redo and the current audit log
remain available during the active process. Changing source/datastream, leaving
Edit & QC, or refreshing drops the active workspace; returning starts fresh.
There is no automatic browser saving, draft recovery, or retained per-datastream
cache. Obsolete QC recovery copies are removed from browser session storage when
the editor opens. Export files explicitly to keep work outside the active session.

The QC **Time zone (UTC offset)** selector uses fixed numeric offsets such as
`+01:00`, `-04:00` and `+05:30`, with quarter-hour choices from `-12:00` to
`+14:00`. Date inputs, edit intervals, graph ticks/tooltips and observation times
use the selected offset. Switching offset preserves the selected instants;
requests still use UTC. The preference survives reloads in this browser tab.
Offsets do not change automatically for daylight saving. Audit event times stay
in UTC. Detailed draft backups retain original observation timestamps; compact
observation workbooks express the same instants in the selected offset, preserving
fractional precision and using the example's `+0100` offset notation.

The plot initially shows the whole loaded series. Clicking a plotted point or
checking table rows focuses their time range with surrounding context. Removing
selections adjusts the range; clearing the selection restores the whole series.
The plot's **Clear Selections** tool clears plotted selections, table checkboxes
and brush covers together, including any active box zoom. It preserves draft
values and quality and does not run checks.
Unrelated edits and quality explanations preserve the current manual zoom.
Each plot update explicitly removes the previous rendered series before drawing
the current original, draft, selection, preview and quality layers. Earlier draft
curves and closed previews do not remain in the plot.
The **Reset zoom** button above the plot restores the whole series after any zoom
operation while retaining the selected observations. The chart's **Previous box
zoom** arrow only steps through box-zoom history.

Click or tap the info icons beside original/draft quality, data state and human
review for readable explanations. Hovering or focusing an icon does not open it;
Enter/Space also activates it. Row values and individual test outcomes are plain
text. Test headers retain their hover/focus explanations. Quality cards decode
bitmasks into named data/test/human states or show the supplied service catalog.
Expand **Parameters and explanation** under a check in a quality card for its
stored parameters and the details previously shown on result hover. These details
distinguish recorded results, explicit draft runs and invalidated outcomes.
Reasons such as insufficient history are shown only when a draft run reported
them; original flags do not imply a reason. Use Enter/Arrow Down to enter a focused
card, and Close, Escape or an outside click to dismiss an info panel. Binary
pairs and raw values remain available under **Technical details**.

**Edit values** applies a constant or offset, marks values missing, fills missing values
with a constant or linear interpolation, or replaces an interval by a straight
line between exterior anchors. For selected observations, anchors are taken from
outside the first and last selected timestamps, rather than the full loaded
period. Choose an inclusive UTC interval directly or
choose exact graph/table selections without expanding them to intervening records. The preview shows affected
values before applying; the whole operation is one Undo step. Only existing
observation records in the loaded period are modified. No timestamps are added.

Interpolation uses elapsed time, requires bounding numeric observations, and
never extrapolates. Gap filling measures the complete gap, including context
outside the selection, and skips runs exceeding the maximum duration or cut off
by the loaded context. Interpolation also limits the distance between anchors
(60 minutes by default). If that limit is exceeded, the preview reports the
actual anchor span separately from unavailable bounding observations.
Failed, unknown-quality and edited-but-pending anchors are excluded by default;
an explicit option permits them. Unchanged bounding values with checks pending
solely because of an earlier edit can still anchor interpolation unless they
had a known failure. Filled, interpolated and manually corrected values use data pair `10`. All affected
check slots become pending and supported checks are rerun automatically after
applying the correction, including dependent observations.

**Audit log** records UTC event time, the current source user, source/datastream,
action, correction/review reason, parameters, interpolation anchors, and
per-observation before/after values, masks and check state. Cell edits, manual
reviews, check runs, Undo/Redo and discard are recorded.
Undo and discard retain earlier events during the current editing session.
Detailed exports include **Audit log**, **Audit changes** and **Audit parameters**
worksheets. Leaving the editor clears this in-memory history.
This browser history is not a permanent or tamper-proof server audit trail;
server commit auditing will accompany the later save workflow.

Mask decoding follows `istsos4_client.quality`: pair 0 is data state
(`11` raw, `10` filled/corrected, `00` missing, `01` digital), pairs 1..N
are ordered automatic checks, and pair N+1 is human review. Check/human states
are `11` passed/accepted, `10` failed/rejected, `00` not executed/reviewed,
`01` unused. With three tests this uses ten bits (0..1023); existing four-test
masks need twelve bits (0..4095). The human pair moves with the *schema*, never
with the selection of checks to execute. With three checks, mask `239` records
an automatic failure, `1007` adds human acceptance, and `751` adds rejection.
OASI 10/6 are derived human-quality scores, not replacement mask values.
SaQC's internal BAD value `255` is translated per check, never copied as a mask.
Exports retain the stored check definitions per row. Modified parameters and new
recipes are not offered, so draft check results retain the stored interpretation.

No observations or stored constraints are written to istSOS4. Interactive loads
and previews are limited to 20,000 observations/affected targets and a maximum
20,000-observation context buffer; shorten the date range for larger records.
Editing is available in live mode; leave snapshot mode before editing.

The QC-specific checks can be run with:

```bash
cd ui
npm run test:qc
cd ..
docker compose -f dev-docker-compose.yaml run --rm \
  -v "$PWD/qc-service:/app:ro" saqc python -m unittest -v test_engine
```

## 5. Build and Publish Docker Images

### Build the UI Image

```bash
docker build -t ghcr.io/istsos/istsos4/gui:0.0.1 ui
```

### Push the Image to the Registry

```bash
docker push ghcr.io/istsos/istsos4/gui:0.0.1
```

## 6. Start the Production Environment

### Start the production services:

```bash
docker compose up -d
```

### Stop the production services:

```bash
docker compose down
```
