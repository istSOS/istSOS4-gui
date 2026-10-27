"""Buffer evaluation extracted from istSOS4/utils/jobs/qc_historical.

Each target is checked as the newest of its own historical buffer. Large
batches use separated time axes, checked against individual-buffer samples.
"""
import numpy as np
import pandas as pd
from saqc import SaQC

BAD = 255.0
ROWS_PER_CALL = 2_000_000
EPOCH = np.datetime64("1970-01-01", "ns")
AXIS_LENGTH = np.timedelta64(250 * 365, "D")
SAMPLE = 50

def run(c, times, values):
    """IstsosQC's SaQC call for constraint c: which values it flags BAD."""
    index = pd.DatetimeIndex(times).tz_localize("UTC")
    data = pd.DataFrame(
        {"result": values, "resultQuality": 0, "phenomenonTime": index},
        index=index,
    )
    args = {
        k: v
        for k, v in c.items()
        if k not in ("type", "column") and v is not None
    }
    qc = getattr(SaQC(data, scheme="float"), c["type"])(
        c.get("column", "result"), **args
    )
    return qc.flags["result"].to_numpy() == BAD

def newest_bad(c, times, values, targets, n):
    """For each target as the newest of its buffer (the n-1 values before it
    plus itself): whether SaQC flags it BAD, and whether the call ran. As in
    Flink, a call that fails leaves only that observation's slot 00.

    Buffers go end to end, a gap apart, so no window reaches the next one. A
    sample of buffers also runs on its own: if it disagrees (the check looks
    at all the data, or counts values instead of time), every buffer runs on
    its own, as in Flink. So do the buffers of a stacked call that fails."""
    first = np.maximum(targets - n + 1, 0)

    def alone(k):  # Flink: one SaQC call on the buffer, None if it fails
        own = slice(first[k], targets[k] + 1)
        try:
            return run(c, times[own], values[own])
        except Exception:
            return None

    def each(ks):  # (bad, ran) of these buffers, each run on its own
        flags = [alone(k) for k in ks]
        ran = np.array([f is not None for f in flags], bool)
        return np.array([f is not None and f[-1] for f in flags], bool), ran

    texts = [v for v in c.values() if isinstance(v, str)] + ["0s"]
    span = pd.to_timedelta(texts, errors="coerce").max().to_timedelta64()
    gap = np.timedelta64(1, "D") + 2 * span
    per_call = max(1, min(ROWS_PER_CALL, AXIS_LENGTH // gap) // n)
    spread = np.linspace(0, len(targets) - 1, SAMPLE).astype(int)
    sample = set(spread) | set(range(min(n, len(targets))))

    bad, ran = np.zeros(len(targets), bool), np.ones(len(targets), bool)
    for start in range(0, len(targets), per_call):
        part = slice(start, start + per_call)
        rows = targets[part, None] - np.arange(n - 1, -1, -1)
        inside = rows >= 0
        buffer, rows = np.nonzero(inside)[0], rows[inside]
        step = np.minimum(np.diff(times[rows]), gap)  # capped real steps
        step[np.diff(buffer) != 0] = gap
        axis = EPOCH + np.concatenate(
            [[np.timedelta64(0, "ns")], np.cumsum(step)]
        )
        newest = np.cumsum(inside.sum(axis=1)) - 1
        try:
            flags = run(c, axis, values[rows])
        except Exception:  # some buffer breaks it
            bad[part], ran[part] = each(range(start, start + len(newest)))
            continue
        bad[part] = flags[newest]

        for k in sample & set(range(start, start + len(newest))):
            single, own = alone(k), times[first[k] : targets[k] + 1]
            end = newest[k - start] + 1
            stacked = flags[end - len(own) : end]
            far = own >= own[0] + span  # past SaQC start-up effects
            if single is None or (single[far] != stacked[far]).any():
                print(f"  {c['type']} runs one buffer at a time")
                return each(range(len(targets)))
    return bad, ran
