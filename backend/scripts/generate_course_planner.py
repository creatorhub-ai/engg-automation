#!/usr/bin/env python3
"""
Course Planner Generator
========================

Fills a domain-specific Course Planner *template* with the batch metadata
(domain, session timings, batch no, lab access timings) chosen in the UI,
stamps working-day dates down the grid starting from a batch start date,
and marks company holidays (from the Holiday list) and weekends.

The template is picked *dynamically* by domain: the first workbook in the
template directory whose filename contains the domain token AND the words
"Course Planner Template" is used (e.g. domain "PD" -> "PD Course Planner
Template.xlsx", "DV" -> "DV Course Planner Template.xlsx").  Adding a new
"DFT Course Planner Template.xlsx" later works with no code change.

Input  : a JSON object on stdin (see KEYS below)
Output : writes the filled .xlsx to <out_path>; prints a small JSON summary
         to stdout.

JSON keys
---------
    domain        "PD" | "DV" | "DFT" ...
    batch_no      free text, e.g. "PDFT19"
    session1      e.g. "7.30AM to 9.00AM"
    session2      e.g. "9.30AM to 11.00AM"
    session3      e.g. "11.15AM to 1.15PM"   (optional; PD only)
    lab_timings   e.g. "11.30AM to 1.30PM"
    start_date    "YYYY-MM-DD"  (optional; defaults handled by caller)
    template_dir  folder holding the *.xlsx templates + holiday file
    holiday_file  path to the holiday workbook (optional)
    out_path      where to write the generated workbook

Requires:  pip install openpyxl
"""

import datetime
import glob
import json
import os
import re
import sys

try:
    import openpyxl
    from openpyxl.styles import PatternFill
except ImportError:
    sys.exit("openpyxl is required.  Install it with:  pip install openpyxl")


HOLIDAY_FILL = PatternFill(start_color="FFF2CC", end_color="FFF2CC", fill_type="solid")

# columns (1-based) scanned to decide whether a row is a "working-day" row
TOPIC_COLS = range(3, 10)          # C..I  (covers both PD and DV layouts)
DATE_COL = 2                       # column B holds the date
WEEKEND_RE = re.compile(r"weekend|saturday\s*&\s*sunday", re.I)


# --------------------------------------------------------------------------- #
# Template discovery
# --------------------------------------------------------------------------- #

def find_template(template_dir, domain):
    """First *.xlsx whose name contains the domain token and 'Course Planner
    Template' (case-insensitive).  Dynamic so new domains need no code edit."""
    dom = domain.strip().lower()
    candidates = glob.glob(os.path.join(template_dir, "*.xlsx"))
    for path in sorted(candidates):
        name = os.path.basename(path).lower()
        if "course planner template" in name and re.search(rf"\b{re.escape(dom)}\b", name):
            return path
    # looser fallback: domain token anywhere in the name
    for path in sorted(candidates):
        name = os.path.basename(path).lower()
        if "template" in name and dom in name:
            return path
    raise FileNotFoundError(
        f"No template found for domain '{domain}' in {template_dir}")


# --------------------------------------------------------------------------- #
# Holiday list
# --------------------------------------------------------------------------- #

def load_holidays(holiday_file):
    """Return {date: name} for rows whose 'Type of Holiday' == 'Holiday'
    (exact, so 'Restricted Holiday' is treated as a normal working day)."""
    holidays = {}
    if not holiday_file or not os.path.exists(holiday_file):
        return holidays
    wb = openpyxl.load_workbook(holiday_file, data_only=True)
    ws = wb.active
    # locate columns from the header row
    header = {str(ws.cell(1, c).value).strip().lower(): c
              for c in range(1, ws.max_column + 1) if ws.cell(1, c).value}
    date_c = header.get("date", 1)
    name_c = header.get("holiday", 3)
    type_c = header.get("type of holiday", 4)
    for r in range(2, ws.max_row + 1):
        d = ws.cell(r, date_c).value
        t = ws.cell(r, type_c).value
        if isinstance(d, datetime.datetime):
            d = d.date()
        if not isinstance(d, datetime.date):
            continue
        if str(t).strip().lower() == "holiday":
            holidays[d] = str(ws.cell(r, name_c).value or "Holiday").strip()
    return holidays


# --------------------------------------------------------------------------- #
# Merge-aware helpers
# --------------------------------------------------------------------------- #

def build_resolvers(ws):
    """value(r,c) inherits merge anchors; span(r,c) = merge column width."""
    anchor, width = {}, {}
    for m in ws.merged_cells.ranges:
        a = ws.cell(m.min_row, m.min_col).value
        for r in range(m.min_row, m.max_row + 1):
            for c in range(m.min_col, m.max_col + 1):
                anchor[(r, c)] = a
                width[(r, c)] = m.max_col - m.min_col
    value = lambda r, c: anchor.get((r, c), ws.cell(r, c).value)   # noqa: E731
    span = lambda r, c: width.get((r, c), 0)                       # noqa: E731
    return value, span


def set_cell(ws, r, c, val):
    """Write to (r,c) honouring merges (write to the merge anchor)."""
    for m in ws.merged_cells.ranges:
        if m.min_row <= r <= m.max_row and m.min_col <= c <= m.max_col:
            ws.cell(m.min_row, m.min_col).value = val
            return
    ws.cell(r, c).value = val


# --------------------------------------------------------------------------- #
# Metadata fill
# --------------------------------------------------------------------------- #

def fill_metadata(ws, cfg):
    """Fill batch no, domain, session timings and lab timings into the header.
    Robust to layout differences between templates: we edit the label cells
    themselves and replace text placeholders rather than guessing value cells."""
    s1, s2, s3 = cfg.get("session1", ""), cfg.get("session2", ""), cfg.get("session3", "")
    batch, dom, lab = cfg["batch_no"], cfg["domain"], cfg.get("lab_timings", "")

    for row in ws.iter_rows():
        for cell in row:
            v = cell.value
            if not isinstance(v, str):
                continue
            new = v

            # A1 title placeholder: "... Course (batch_no)"
            new = new.replace("(batch_no)", batch)

            # header timing placeholders (PD template)
            new = new.replace("(session1_timings)", s1)
            new = new.replace("(session2_timinigs)", s2)   # note: template typo
            new = new.replace("(session2_timings)", s2)
            new = new.replace("(session3_timings)", s3)

            # A2 session label lines: "Session1 :" -> "Session1 : 7.30AM to 9.00AM"
            # ([ \t]* not \s*, so we don't swallow the newline between lines)
            new = re.sub(r"(Session\s*1\s*:)[ \t]*", rf"\g<1> {s1}", new)
            new = re.sub(r"(Session\s*2\s*:)[ \t]*", rf"\g<1> {s2}", new)
            if s3:
                new = re.sub(r"(Session\s*3\s*:)[ \t]*", rf"\g<1> {s3}", new)

            # label cells (append the chosen value once)
            low = v.lower()
            if low.strip().rstrip(":") == "domain" or low.startswith("domain:"):
                new = f"Domain: {dom}"
            elif low.strip().rstrip(":") == "batch no" or low.startswith("batch no:"):
                new = f"Batch No: {batch}"
            elif low.startswith("lab access timings") and lab and lab not in v:
                new = f"{v.rstrip()}\n{lab}"

            # DV header: hard-coded timing on 2nd line of "Module Name - S1\n...."
            if s1 and re.match(r"module name\s*-\s*s1", low):
                new = re.sub(r"(Module Name\s*-\s*S1\s*\n).*", rf"\g<1>{s1}", new,
                             flags=re.I | re.S)
            if s2 and re.match(r"module name\s*-\s*s2", low):
                new = re.sub(r"(Module Name\s*-\s*S2\s*\n).*", rf"\g<1>{s2}", new,
                             flags=re.I | re.S)
            if s3 and re.match(r"module name\s*-\s*s3", low):
                new = re.sub(r"(Module Name\s*-\s*S3\s*\n).*", rf"\g<1>{s3}", new,
                             flags=re.I | re.S)

            if new != v:
                cell.value = new


# --------------------------------------------------------------------------- #
# Date + holiday fill
# --------------------------------------------------------------------------- #

def is_day_row(ws, value, span, r):
    """A working-day row: has *its own* topic content and is not a
    weekend/banner row.  Content is checked on RAW cells (ws.cell) not the
    merge-resolved value(), so a merge that leaks a value into a blank spacer
    row (e.g. E10:E11) does not falsely count that spacer as a day."""
    b = value(r, DATE_COL)
    if isinstance(b, str) and WEEKEND_RE.search(b):
        return False
    # full-width banner (e.g. "Foundation Courses") spans many columns -> skip
    if isinstance(b, str) and span(r, DATE_COL) >= 5:
        return False
    for c in TOPIC_COLS:
        v = ws.cell(r, c).value                       # RAW, not merge-inherited
        if v is not None and str(v).strip():
            return True
    return False


def fill_dates(ws, start_date, holidays):
    """Stamp weekday dates down the day-rows; mark company holidays; weekend
    rows already carry a label in the template."""
    value, span = build_resolvers(ws)
    current = start_date
    marked = 0
    # data begins at the first week-number row (col A integer); this sits below
    # single- *and* two-row headers (DV has a 'Course/Topic Planned' sub-header)
    data_start = next(
        (r for r in range(1, ws.max_row + 1)
         if isinstance(ws.cell(r, 1).value, (int, float))
         and not isinstance(ws.cell(r, 1).value, bool)),
        5,
    )
    header_row = data_start - 1
    note_col = ws.max_column + 1        # fixed "Remarks" column, computed once
    last_col = note_col
    ws.cell(header_row, note_col).value = "Remarks"
    for r in range(data_start, ws.max_row + 1):
        if not is_day_row(ws, value, span, r):
            continue
        # topics run Monday-Friday; roll past weekends
        while current.weekday() >= 5:                      # 5=Sat, 6=Sun
            current += datetime.timedelta(days=1)
        set_cell(ws, r, DATE_COL, current)
        ws.cell(r, DATE_COL).number_format = "m/d/yyyy"
        if current in holidays:
            # mark in place: note in the fixed trailing column + shade the row
            ws.cell(r, note_col).value = f"Holiday - {holidays[current]}"
            for c in range(1, last_col + 1):
                ws.cell(r, c).fill = HOLIDAY_FILL
            marked += 1
        current += datetime.timedelta(days=1)
    return marked


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #

def main():
    cfg = json.load(sys.stdin)
    template = find_template(cfg["template_dir"], cfg["domain"])
    holidays = load_holidays(cfg.get("holiday_file"))

    start = cfg.get("start_date")
    if start:
        start_date = datetime.datetime.strptime(start, "%Y-%m-%d").date()
    else:
        start_date = None

    wb = openpyxl.load_workbook(template)
    ws = wb.active

    fill_metadata(ws, cfg)
    holidays_marked = 0
    if start_date:
        holidays_marked = fill_dates(ws, start_date, holidays)

    out_path = cfg["out_path"]
    wb.save(out_path)

    print(json.dumps({
        "ok": True,
        "template": os.path.basename(template),
        "out_path": out_path,
        "holidays_marked": holidays_marked,
        "start_date": start,
    }))


if __name__ == "__main__":
    main()
