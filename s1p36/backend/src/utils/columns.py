import re
import difflib
import config.settings as S


class SchemaError(Exception):
    pass


def _norm(s):
    return re.sub(r"[^a-z0-9]", "", str(s).lower())


def resolve_columns(df, verbose=True):
    # exact, then normalised, then fuzzy; the frame is renamed to the client's exact names
    actual = list(df.columns)
    by_norm = {_norm(c): c for c in actual}
    mapping, missing_req, missing_opt, notes = {}, [], [], []
    for key, (name, required) in S.COLUMNS.items():
        if name in actual:
            mapping[name] = name
            continue
        n = _norm(name)
        if n in by_norm:
            mapping[by_norm[n]] = name
            continue
        close = difflib.get_close_matches(n, list(by_norm), n=1, cutoff=0.85)
        if close:
            mapping[by_norm[close[0]]] = name
            notes.append(by_norm[close[0]] + " -> " + name)
            continue
        (missing_req if required else missing_opt).append(name)
    if missing_req:
        hints = {m: difflib.get_close_matches(_norm(m), list(by_norm), n=3, cutoff=0.4) for m in missing_req}
        raise SchemaError("Missing required columns: " + ", ".join(missing_req) +
                          "\nClosest headers: " + str(hints) + "\nHeaders found: " + ", ".join(actual))
    df = df.rename(columns={a: b for a, b in mapping.items() if a != b})
    if verbose:
        for n in notes:
            print("Column matched by similarity:", n)
        for m in missing_opt:
            print("Optional column not found, dependent features skipped:", m)
    return df, {"renamed": notes, "missing_optional": missing_opt}
