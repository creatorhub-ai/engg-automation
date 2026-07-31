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
    batch_type    "Offline" | "Online"  (picks the matching template; Online
                  stamps weekend-only dates and fills "(current_weekend)")
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

# Prefer the vendored openpyxl/et_xmlfile shipped in ./vendor so the tool works
# on hosts (e.g. Render) with no pip-installed openpyxl. Pure-Python, no build.
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "vendor"))

try:
    import openpyxl
    from openpyxl.styles import PatternFill, Font
except ImportError:
    sys.exit("openpyxl is required.  Install it with:  pip install openpyxl")


HOLIDAY_FILL = PatternFill(start_color="FFF2CC", end_color="FFF2CC", fill_type="solid")
HOLIDAY_FONT = Font(bold=True, color="FFC00000")   # dark-red, bold banner text

# columns (1-based) scanned to decide whether a row is a "working-day" row
TOPIC_COLS = range(3, 10)          # C..I  (covers both PD and DV layouts)
DATE_COL = 2                       # column B holds the date
WEEKEND_RE = re.compile(r"weekend|saturday\s*&\s*sunday", re.I)
SATURDAY, SUNDAY = 5, 6            # datetime.date.weekday() values


# --------------------------------------------------------------------------- #
# Template discovery
# --------------------------------------------------------------------------- #

def find_template(template_dir, domain, batch_type=""):
    """Pick the template workbook for the chosen domain + batch type.

    Selection rules (all case-insensitive):
      * batch type "Offline" -> filename must START WITH "offline"
      * batch type "Online"  -> filename must START WITH "online"
      * the domain token (PD / DV / DFT) must appear in the filename
      * the words "Course Planner Template" must appear in the filename

    e.g. domain "DV" + "Online"  -> "Online - DV Course Planner Template.xlsx"
         domain "PD" + "Offline" -> "Offline - PD Course Planner Template.xlsx"

    Dynamic so new domains/batch types need no code edit."""
    dom = domain.strip().lower()
    bt = (batch_type or "").strip().lower()          # "online" | "offline" | ""
    candidates = sorted(glob.glob(os.path.join(template_dir, "*.xlsx")))

    def domain_ok(name):
        return re.search(rf"\b{re.escape(dom)}\b", name) is not None

    # 1) Preferred: name starts with the batch type + has domain + is a template.
    if bt:
        for path in candidates:
            name = os.path.basename(path).lower()
            if name.startswith(bt) and "course planner template" in name and domain_ok(name):
                return path

    # 2) Back-compat / no batch type: domain + "course planner template",
    #    still respecting the batch-type prefix when one was given.
    for path in candidates:
        name = os.path.basename(path).lower()
        if "course planner template" in name and domain_ok(name) and (not bt or name.startswith(bt)):
            return path

    # 3) Loosest fallback: any template with the domain token (honour batch type).
    for path in candidates:
        name = os.path.basename(path).lower()
        if "template" in name and dom in name and (not bt or name.startswith(bt)):
            return path

    available = sorted(
        os.path.basename(p) for p in candidates
        if "course planner template" in os.path.basename(p).lower()
    )
    raise FileNotFoundError(
        f"No {batch_type or ''} {domain} course planner template is available. "
        f"Add a workbook named \"{batch_type or '<Offline|Online>'} - {domain} Course Planner "
        f"Template.xlsx\". Templates found: {', '.join(available) or 'none'}")


def _header_text(v):
    """Normalise a header cell for comparison (templates use NBSPs / stray space)."""
    return v.replace("\xa0", " ").strip().lower() if isinstance(v, str) else ""


def find_header_column(ws, data_start, names, default=0):
    """Locate a column by its header label, scanning the rows above the data."""
    limit = min(ws.max_row, max(data_start + 2, 15))
    for r in range(1, limit + 1):
        for c in range(1, ws.max_column + 1):
            if _header_text(ws.cell(r, c).value) in names:
                return c
    return default


def find_date_column(ws, data_start):
    """Locate the 'Date' column by scanning the header rows above the data.
    Templates differ: Offline/Online-PD keep Date in column B, while Online
    DV/DFT put it in column C.  Falls back to column B."""
    return find_header_column(ws, data_start, {"date"}, DATE_COL)


def find_theory_lab_column(ws, data_start):
    """Locate the 'Theory/Lab' column of the Online templates (0 when absent).
    Online batches run Theory on Saturday and Lab on Sunday, so this column --
    not the row order -- is what anchors each row to a weekend day."""
    return find_header_column(ws, data_start, {"theory/lab", "theory / lab"}, 0)


def session_weekday(ws, value, r, tl_col):
    """Weekend day a row is pinned to: SATURDAY for a Theory row, SUNDAY for a
    Lab row, None when the row is neither (e.g. the orientation session)."""
    if not tl_col:
        return None
    t = _header_text(value(r, tl_col))
    if t.startswith("theory"):
        return SATURDAY
    if t.startswith("lab"):
        return SUNDAY
    return None


def on_or_after(d, weekday):
    """First date on/after `d` that falls on `weekday` (Mon=0 .. Sun=6)."""
    return d + datetime.timedelta(days=(weekday - d.weekday()) % 7)


def weekend_of(d):
    """Return (saturday, sunday) for the weekend the date `d` belongs to.
    Online dates are always Sat/Sun; the weekday branch is a safe fallback."""
    wd = d.weekday()                       # Mon=0 .. Sat=5, Sun=6
    if wd == 5:                            # Saturday
        return d, d + datetime.timedelta(days=1)
    if wd == 6:                            # Sunday
        return d - datetime.timedelta(days=1), d
    sat = d + datetime.timedelta(days=(5 - wd))
    return sat, sat + datetime.timedelta(days=1)


def replace_current_weekend(ws, r, last_stamped):
    """If row `r` carries the "(current_weekend)" placeholder (the Course Break
    banner in Online templates), replace it with the Saturday & Sunday dates of
    the previous stamped date's weekend.  Returns True when the row was a break
    row (handled), so the caller skips normal date stamping for it."""
    for c in range(1, ws.max_column + 1):
        tc = target_cell(ws, r, c)
        v = tc.value
        if isinstance(v, str) and "(current_weekend)" in v:
            if last_stamped is not None:
                sat, sun = weekend_of(last_stamped)
                label = f"{sat.strftime('%d-%b-%Y')} & {sun.strftime('%d-%b-%Y')}"
            else:
                label = ""
            tc.value = v.replace("(current_weekend)", label)
            return True
    return False


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


def target_cell(ws, r, c):
    """Return the writable cell for (r,c): the merge anchor if (r,c) is merged."""
    for m in ws.merged_cells.ranges:
        if m.min_row <= r <= m.max_row and m.min_col <= c <= m.max_col:
            return ws.cell(m.min_row, m.min_col)
    return ws.cell(r, c)


def set_cell(ws, r, c, val):
    """Write to (r,c) honouring merges (write to the merge anchor)."""
    target_cell(ws, r, c).value = val


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

def is_day_row(ws, value, span, r, date_col, topic_cols):
    """A working-day row: has *its own* topic content and is not a
    weekend/banner row.  Content is checked on RAW cells (ws.cell) not the
    merge-resolved value(), so a merge that leaks a value into a blank spacer
    row (e.g. E10:E11) does not falsely count that spacer as a day."""
    b = value(r, date_col)
    if isinstance(b, str) and WEEKEND_RE.search(b):
        return False
    # full-width banner (e.g. "Foundation Courses") spans many columns -> skip
    if isinstance(b, str) and span(r, date_col) >= 5:
        return False
    for c in topic_cols:
        v = ws.cell(r, c).value                       # RAW, not merge-inherited
        if v is not None and str(v).strip():
            return True
    return False


def fill_dates(ws, start_date, holidays, date_col, online=False):
    """Stamp dates down the day-rows and mark company holidays.

    Offline (default): classes run Mon-Fri, so weekday dates are stamped and
    weekends are rolled past.
    Online: classes run on weekends, so ONLY Saturday/Sunday dates are stamped
    and weekdays are skipped.  Each row is pinned by its Theory/Lab column --
    Theory to Saturday, Lab to Sunday -- rather than by row order, so a
    template that carries an extra row inside the week grid (the DFT
    orientation session) cannot shift Theory onto Sunday.  The Course Break
    banner's "(current_weekend)" placeholder is filled with the Sat & Sun of
    the previous stamped weekend."""
    value, span = build_resolvers(ws)
    # topic columns sit to the right of the Date column; keep the original
    # 7-column scan width so offline behaviour is unchanged (date_col 2 -> C..I).
    topic_cols = range(date_col + 1, date_col + 8)
    current = start_date
    marked = 0
    last_stamped = None
    # data begins at the first week-number row (col A integer); this sits below
    # single- *and* two-row headers (DV has a 'Course/Topic Planned' sub-header)
    data_start = next(
        (r for r in range(1, ws.max_row + 1)
         if isinstance(ws.cell(r, 1).value, (int, float))
         and not isinstance(ws.cell(r, 1).value, bool)),
        5,
    )
    header_row = data_start - 1
    tl_col = find_theory_lab_column(ws, data_start) if online else 0
    note_col = ws.max_column + 1        # fixed "Remarks" column, computed once
    last_col = note_col
    banner_start = date_col + 1         # first topic/schedule column
    ws.cell(header_row, note_col).value = "Remarks"
    for r in range(data_start, ws.max_row + 1):
        # Online Course Break: fill "(current_weekend)" from the previous
        # weekend and skip normal date stamping for this banner row.
        if online and replace_current_weekend(ws, r, last_stamped):
            continue
        if not is_day_row(ws, value, span, r, date_col, topic_cols):
            continue
        if online:
            # Theory -> Saturday, Lab -> Sunday.  Rows that are neither (the
            # orientation session) just take the next weekend day available.
            want = session_weekday(ws, value, r, tl_col)
            if want is not None:
                current = on_or_after(current, want)
            else:
                while current.weekday() < SATURDAY:         # 0-4 = Mon-Fri
                    current += datetime.timedelta(days=1)
        else:
            # topics run Monday-Friday; roll past weekends
            while current.weekday() >= 5:                  # 5=Sat, 6=Sun
                current += datetime.timedelta(days=1)
        set_cell(ws, r, date_col, current)
        ws.cell(r, date_col).number_format = "m/d/yyyy"
        last_stamped = current
        if current in holidays:
            # Company holiday: this is a non-teaching day.  Drop the topic that
            # fell here and show a "HOLIDAY - <name>" banner across the topic
            # columns (shaded), so the day is clearly marked as a holiday.
            name = holidays[current]
            for c in range(banner_start, note_col):   # clear all topic/schedule cells
                set_cell(ws, r, c, None)
            banner = target_cell(ws, r, banner_start)
            banner.value = f"HOLIDAY - {name}"
            banner.font = HOLIDAY_FONT
            ws.cell(r, note_col).value = f"Holiday - {name}"   # keep the remark too
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
    batch_type = cfg.get("batch_type", "")
    online = batch_type.strip().lower() == "online"
    try:
        template = find_template(cfg["template_dir"], cfg["domain"], batch_type)
    except FileNotFoundError as e:
        # Config problem, not a crash: report the message alone (no traceback)
        # so the API can surface it to the user verbatim.
        sys.exit(str(e))
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
        # data begins at the first week-number row; use it to locate the Date
        # column (it moves between templates: B for Offline/Online-PD, C for
        # Online DV/DFT).
        data_start = next(
            (r for r in range(1, ws.max_row + 1)
             if isinstance(ws.cell(r, 1).value, (int, float))
             and not isinstance(ws.cell(r, 1).value, bool)),
            5,
        )
        date_col = find_date_column(ws, data_start)
        holidays_marked = fill_dates(ws, start_date, holidays, date_col, online)

    out_path = cfg["out_path"]
    wb.save(out_path)

    print(json.dumps({
        "ok": True,
        "template": os.path.basename(template),
        "out_path": out_path,
        "holidays_marked": holidays_marked,
        "start_date": start,
        "batch_type": batch_type,
        "online": online,
    }))


if __name__ == "__main__":
    main()
