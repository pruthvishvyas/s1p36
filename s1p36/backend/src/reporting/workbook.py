import datetime as dt
import numpy as np
import pandas as pd
import config.settings as S
from src.utils import io_utils as io
from src.utils.paths import FILES

BAD = '[]:*?/\\'


def _sheet(name):
    for ch in BAD:
        name = name.replace(ch, " ")
    return name[:31]


def _guard(df):
    df = df.copy()
    for c in df.columns:
        if df[c].dtype == object:
            df[c] = df[c].map(lambda v: "'" + v if isinstance(v, str) and v[:1] in ("=", "+", "-", "@") else v)
    return df


def _scrub_app(path):
    import zipfile, shutil, re as _re
    tmp = path.with_suffix(".tmp")
    with zipfile.ZipFile(path) as zin, zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            if item.filename == "docProps/app.xml":
                data = _re.sub(rb"<Application>.*?</Application>", b"<Application>Microsoft Excel</Application>", data)
            zout.writestr(item, data)
    shutil.move(str(tmp), str(path))


def _note(msg):
    return pd.DataFrame({"Note": [msg]})


def run(df, verbose=True):
    from openpyxl import load_workbook
    C, F = S.C, S.F
    summary = df.groupby(C["month"]).agg(Net_Revenue=(C["net_rev"], "sum"), Target=(C["rev_target"], "sum"),
                                         Contribution=(C["contrib"], "sum"), Orders=(C["orders"], "sum"), Sessions=(C["sessions"], "sum")).reset_index()
    summary[C["month"]] = summary[C["month"]].dt.strftime("%Y-%m")
    catp = df.groupby(C["category"]).agg(Net_Revenue=(C["net_rev"], "sum"), Target=(C["rev_target"], "sum"), Contribution=(C["contrib"], "sum"),
                                         Avg_Return_Rate=(C["return_rate"], "mean"), Avg_Conversion=(C["conv"], "mean"), At_Risk_Rate=(F["target"], "mean")).reset_index()
    sheets = {"Revenue Summary": summary, "Category Performance": catp}
    seg = FILES["segments"]
    if seg.exists():
        j = df.merge(pd.read_csv(seg), on=F["row_id"])
        sheets["Segment Summary"] = j.groupby("segment").agg(Category_Months=(F["row_id"], "count"), Avg_Health=(F["health"], "mean"),
                                                             Net_Revenue=(C["net_rev"], "sum"), Unusual=("is_anomaly", "sum")).reset_index()
    else:
        sheets["Segment Summary"] = _note("Not available: segmentation did not run")
    act = FILES["business_actions"]
    if act.exists():
        a = pd.read_csv(act)
        j = df[[F["row_id"], C["category"], C["month"]]].merge(a, on=F["row_id"])
        j = j[j["is_latest"] == 1].sort_values("priority")
        j[C["month"]] = j[C["month"]].dt.strftime("%Y-%m")
        sheets["Action List"] = j[[C["category"], C["month"], "priority", "alerts", "recommendations"]]
    else:
        sheets["Action List"] = _note("Not available: business rules did not run")
    allrec = df.copy()
    allrec[C["month"]] = allrec[C["month"]].dt.strftime("%Y-%m")
    if len(allrec) > 1048500:
        allrec = allrec.head(1048500)
    sheets["All Records"] = allrec

    path = FILES["workbook"]
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with pd.ExcelWriter(path, engine="openpyxl") as xw:
            for nme, frame in sheets.items():
                _guard(frame).to_excel(xw, sheet_name=_sheet(nme), index=False)
    except PermissionError:
        path = path.with_name(path.stem + "_" + dt.datetime.now().strftime("%H%M%S") + path.suffix)
        with pd.ExcelWriter(path, engine="openpyxl") as xw:
            for nme, frame in sheets.items():
                _guard(frame).to_excel(xw, sheet_name=_sheet(nme), index=False)
    wb = load_workbook(path)
    wb.properties.creator = ""
    wb.properties.lastModifiedBy = ""
    wb.properties.title = S.PROJECT_NAME
    wb.save(path)
    _scrub_app(path)
    if verbose:
        print("Workbook sheets:", [_sheet(n) for n in sheets])
        print("Saved:", path.name)
    return path
