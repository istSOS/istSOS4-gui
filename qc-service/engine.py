"""Read-only QC previews using istSOS4's historical-buffer semantics."""

import math
import re
import warnings
from importlib.metadata import version

import numpy as np
import pandas as pd
from historical import newest_bad, run

NO_DATA = {999.9, -999, -9999, -999.9, -999.99}
ALLOWED = {
    "flagRange": {"min", "max"},
    "flagConstants": {"window", "thresh", "min_periods"},
    "flagZScore": {
        "window",
        "thresh",
        "method",
        "center",
        "min_periods",
        "min_residuals",
    },
    "flagNAN": set(),
    "flagJumps": {"window", "thresh", "min_periods"},
    "flagByVariance": {"window", "thresh", "maxna", "maxna_group"},
}
WINDOW = re.compile(r"^\s*(\d+)\s*(s|min|h|d)\s*$", re.I)


def duration(value):
    if not isinstance(value, str) or not WINDOW.fullmatch(value):
        raise ValueError(
            "window must be a positive duration, e.g. 30min or 3h (not 3m)"
        )
    result = pd.Timedelta(value)
    if result <= pd.Timedelta(0):
        raise ValueError("window must be positive")
    return result


def sampling_duration(value):
    if not isinstance(value, str) or not re.fullmatch(
        r"P(?:\d+(?:\.\d+)?D)?(?:T(?:\d+(?:\.\d+)?H)?(?:\d+(?:\.\d+)?M)?(?:\d+(?:\.\d+)?S)?)?",
        value,
    ):
        return None
    try:
        step = pd.Timedelta(value)
        return step if step > pd.Timedelta(0) else None
    except ValueError:
        return None


def number(value):
    if value is None or isinstance(value, (bool, list, dict)):
        return np.nan
    try:
        value = float(value)
        return value if np.isfinite(value) and value not in NO_DATA else np.nan
    except (ValueError, TypeError):
        return np.nan


def mask(value, checks=4):
    if value is None:
        return 0
    if isinstance(value, bool) or not isinstance(value, (str, int, float)):
        raise ValueError(
            "Quality is not an istSOS two-bit mask; structured values cannot be converted automatically"
        )
    try:
        parsed = float(value)
    except (ValueError, TypeError) as error:
        raise ValueError("Quality is not an istSOS two-bit mask") from error
    maximum = (1 << (2 * (checks + 2))) - 1
    if (
        not np.isfinite(parsed)
        or not parsed.is_integer()
        or not 0 <= parsed <= maximum
    ):
        raise ValueError(
            f"Quality must fit {checks} checks plus data and human review (0..{maximum})"
        )
    return int(parsed)


def set_slot(value, slot, state):
    return (int(value) & ~(3 << (2 * slot))) | (state << (2 * slot))


def validate_constraint(constraint):
    kind = constraint.get("type")
    if kind not in ALLOWED:
        raise ValueError(f"Unsupported check: {kind}")
    extra = set(constraint) - ALLOWED[kind] - {"type", "column"}
    if extra:
        raise ValueError("Unknown parameters: " + ", ".join(sorted(extra)))
    if constraint.get("column", "result") != "result":
        raise ValueError("Only the result column is supported")
    for key in ("min", "max", "thresh", "min_residuals"):
        value = constraint.get(key)
        if value is not None and (
            isinstance(value, bool)
            or not isinstance(value, (int, float))
            or not math.isfinite(value)
        ):
            raise ValueError(f"{key} must be a finite number")
    if (
        constraint.get("min") is not None
        and constraint.get("max") is not None
        and constraint["min"] > constraint["max"]
    ):
        raise ValueError("min must not exceed max")
    if (
        kind in ("flagConstants", "flagJumps", "flagByVariance")
        and constraint.get("window") is None
    ):
        raise ValueError(f"{kind} requires a window")
    for key in ("maxna", "maxna_group"):
        if constraint.get(key) is not None and (
            type(constraint[key]) is not int or constraint[key] < 0
        ):
            raise ValueError(f"{key} must be a non-negative integer")
    if constraint.get("window") is not None:
        duration(constraint["window"])
    if constraint.get("min_periods") is not None and (
        type(constraint["min_periods"]) is not int
        or constraint["min_periods"] < (0 if kind == "flagJumps" else 1)
    ):
        raise ValueError(
            "min_periods must be an integer with sufficient coverage"
        )
    if kind == "flagZScore":
        if constraint.get("method", "standard") not in (
            "standard",
            "modified",
        ):
            raise ValueError("method must be standard or modified")
        if constraint.get("center", True) is not False:
            raise ValueError(
                "center must be false to match historical/streaming QC"
            )
    if (
        constraint.get("thresh", 0) is not None
        and constraint.get("thresh", 0) < 0
    ):
        raise ValueError("thresh must not be negative")


def preview(
    rows,
    constraints,
    slots,
    sampling_frequency=None,
    edited_keys=(),
    target_keys=None,
    quality_mode="existing",
    include_affected=True,
    repair_unknown_quality=False,
):
    if quality_mode not in ("existing", "converted"):
        raise ValueError("Invalid quality encoding mode")
    maximum_checks = 3 if quality_mode == "converted" else 4
    if len(constraints) > maximum_checks:
        raise ValueError(
            f"A maximum of {maximum_checks} constraints is supported for this quality mode"
        )
    if any(
        type(slot) is not int or not 1 <= slot <= len(constraints)
        for slot in slots
    ):
        raise ValueError("Selected slots do not match configured constraints")
    if not rows:
        return {
            "results": [],
            "warnings": [],
            "engineVersion": version("saqc"),
        }
    ordered = sorted(rows, key=lambda row: row["ts"])
    times = (
        pd.to_datetime(
            [row["time"].split("/")[0] for row in ordered],
            utc=True,
            format="ISO8601",
        )
        .tz_localize(None)
        .to_numpy()
    )
    if (
        len(set(row["key"] for row in ordered)) != len(ordered)
        or (np.diff(times) <= np.timedelta64(0, "ns")).any()
    ):
        raise ValueError(
            "Duplicate observation identities or timestamps: resolve these before checking"
        )
    values = np.array([number(row["result"]) for row in ordered])
    sampling = sampling_duration(sampling_frequency)
    windows = [
        duration(c["window"])
        for c in constraints
        if isinstance(c.get("window"), str) and WINDOW.fullmatch(c["window"])
    ]
    n = math.ceil(max(windows) / sampling) + 3 if windows and sampling else 50
    if n > 20000:
        raise ValueError(
            "The configured windows require more than 20,000 context observations"
        )
    edit_set = set(edited_keys)
    edited = {i for i, row in enumerate(ordered) if row["key"] in edit_set}
    edit_positions = np.array(sorted(edited), dtype=int)
    nearest = (
        np.searchsorted(edit_positions, np.arange(len(ordered)), side="right")
        - 1
    )
    check_windows = [
        (
            duration(c["window"])
            if isinstance(c.get("window"), str)
            and WINDOW.fullmatch(c["window"])
            else None
        )
        for c in constraints
    ]
    invalid = {}
    for i, row in enumerate(ordered):
        affected = set(row.get("staleSlots", []))
        for slot, constraint in enumerate(constraints, 1):
            # Only the nearest preceding edit needs testing: every older edit
            # is farther outside both the time window and observation buffer.
            if nearest[i] < 0:
                continue
            j = edit_positions[nearest[i]]
            window = check_windows[slot - 1]
            if i - j < n and (
                j == i
                or (
                    constraint["type"] not in ("flagRange", "flagNAN")
                    and (
                        window is None
                        or times[i] - times[j] < window.to_timedelta64()
                    )
                )
            ):
                if slot not in row.get("resolvedSlots", []):
                    affected.add(slot)
        if i in edited:
            affected.add(0)
        invalid[i] = affected
    requested = (
        set(target_keys)
        if target_keys is not None
        else {row["key"] for row in ordered if row["scope"] == "window"}
    )
    targets = np.array(
        [
            i
            for i, row in enumerate(ordered)
            if row["key"] in requested or (include_affected and invalid[i])
        ],
        dtype=int,
    )
    if len(targets) > 20000:
        raise ValueError(
            "Preview is limited to 20,000 affected observations; choose a shorter period"
        )
    masks = []
    repaired = 0
    outcomes = [[] for _ in targets]
    for k, i in enumerate(targets):
        rebuilt = False
        try:
            value = mask(ordered[i].get("resultQuality"), len(constraints))
        except ValueError:
            if not repair_unknown_quality:
                raise
            # Unknown input cannot establish any automatic or human verdict.
            value = 0
            invalid[i].update(range(1, len(constraints) + 1))
            rebuilt = True
        if repair_unknown_quality:
            for slot in range(1, len(constraints) + 2):
                if (value >> (2 * slot)) & 3 == 1:
                    value = set_slot(value, slot, 0)
                    if slot <= len(constraints):
                        invalid[i].add(slot)
                    rebuilt = True
        repaired += int(rebuilt)
        if np.isnan(values[i]):
            value &= 3 << (
                2 * (len(constraints) + 1)
            )  # retain an explicit human verdict
        else:
            if i in edited:
                value = set_slot(value, 0, 2)  # corrected/recalculated data
            elif value & 3 not in (1, 2, 3):
                value = set_slot(value, 0, 3)
            for slot in invalid[i]:
                if slot > 0:
                    value = set_slot(value, slot, 0)
        masks.append(value)
        outcomes[k].append(
            {
                "slot": 0,
                "state": value & 3,
                "reason": "No data" if np.isnan(values[i]) else "Data present",
            }
        )
    messages = []
    if repaired:
        messages.append(
            f"Rebuilt {repaired} unknown quality flags using the stored layout. "
            "Unrun checks remain pending; no human approval was inferred."
        )
    series = pd.Series(values, index=times)
    for slot in sorted(set(slots)):
        constraint = constraints[slot - 1]
        valid = np.ones(len(targets), dtype=bool)
        reasons = [""] * len(targets)
        try:
            validate_constraint(constraint)
            # Parameter errors must not silently become passing results.
            run(
                constraint,
                np.array(["2000-01-01T00", "2000-01-01T01"], "datetime64[ns]"),
                np.array([1.0, 2.0]),
            )
            if isinstance(constraint.get("window"), str):
                window = duration(constraint["window"])
                required = constraint.get("min_periods") or (
                    math.ceil(0.8 * window / sampling) if sampling else 1
                )
                count = series.rolling(window).count().to_numpy()[targets]
                history = (
                    times[targets] - times[np.maximum(targets - n + 1, 0)]
                )
                valid = (count >= required) & (
                    history >= window.to_timedelta64()
                )
                for k in range(len(targets)):
                    if not valid[k]:
                        reasons[k] = (
                            "Insufficient history"
                            if history[k] < window.to_timedelta64()
                            else f"Insufficient coverage: {int(count[k])}/{required} values"
                        )
            bad = np.zeros(len(targets), dtype=bool)
            eligible = np.flatnonzero(valid & ~np.isnan(values[targets]))
            if len(eligible):
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore", FutureWarning)
                    flagged, ran = newest_bad(
                        constraint, times, values, targets[eligible], n
                    )
                bad[eligible] = flagged
                for k in eligible[~ran]:
                    valid[k] = False
                    reasons[k] = "SaQC could not evaluate this buffer"
        except Exception as error:
            reason = str(error).partition("\n")[0][:240]
            messages.append(
                f"Slot {slot} ({constraint.get('type')}): {reason}"
            )
            valid[:] = False
            bad = np.zeros(len(targets), dtype=bool)
            reasons = [reason] * len(targets)
        for k, i in enumerate(targets):
            state = (
                (2 if bad[k] else 3)
                if valid[k] and not np.isnan(values[i])
                else 0
            )
            if masks[k] != 0:
                masks[k] = set_slot(masks[k], slot, state)
            outcomes[k].append(
                {
                    "slot": slot,
                    "state": state,
                    "reason": (
                        "No data"
                        if np.isnan(values[i])
                        else (
                            reasons[k]
                            or ("Failed" if state == 2 else "Passed")
                        )
                    ),
                }
            )
    return {
        "results": [
            {
                "key": ordered[i]["key"],
                "resultQuality": int(masks[k]),
                "outcomes": outcomes[k],
                "staleSlots": sorted(invalid[i] - set(slots) - {0}),
            }
            for k, i in enumerate(targets)
        ],
        "warnings": messages,
        "engineVersion": version("saqc"),
    }
