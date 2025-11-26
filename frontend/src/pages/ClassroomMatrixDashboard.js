import React, { useEffect, useState } from 'react';

const months = [
  { name: 'November', year: 2025 },
  { name: 'December', year: 2025 },
  { name: 'January', year: 2026 },
  { name: 'Febrauary', year: 2026 },
  { name: 'March', year: 2026 },
  { name: 'April', year: 2026 },
];

function weeksOfMonths() {
  return months.flatMap(({ name, year }) =>
    [1, 2, 3, 4].map((week) => ({ month: name, year, week }))
  );
}

export default function ClassroomMatrixDashboard() {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetch('/api/classroom-matrix')
      .then((res) => res.json())
      .then(setData);
  }, []);

  const classrooms = [...new Set(data.map((d) => d.classroom_name))];
  const slots = ['morning', 'evening'];
  const table = [];
  classrooms.forEach((room) => {
    slots.forEach((slot) => {
      const row = [room, slot];
      weeksOfMonths().forEach(({ month, year, week }) => {
        // Calculate week range
        const weekStart = new Date(year, months.findIndex((m) => m.name === month), 1 + (week - 1) * 7);
        const weekEnd = new Date(year, months.findIndex((m) => m.name === month), 1 + (week - 1) * 7 + 6);
        // Show all batch_no overlapping this week/slot/classroom
        const cellOccupancies = data.filter(
          (o) =>
            o.classroom_name === room &&
            o.slot === slot &&
            new Date(o.occupancy_start) <= weekEnd &&
            new Date(o.occupancy_end) >= weekStart
        );
        row.push(cellOccupancies.map((c) => c.batch_no).join('\n'));
      });
      table.push(row);
    });
  });

  return (
    <div>
      <h2>Classroom Occupancy Matrix</h2>
      <table border="1" style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th>Classroom</th>
            <th>Slot</th>
            {weeksOfMonths().map(({ month, week }, idx) => (
              <th key={idx}>{month} W{week}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.map((row, idx) => (
            <tr key={idx}>
              {row.map((cell, jdx) => (
                <td key={jdx} style={{ whiteSpace: 'pre-wrap', minWidth: 90 }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
