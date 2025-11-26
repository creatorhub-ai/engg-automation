import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import dayjs from 'dayjs';

// Replace these with your actual Supabase project URL and service role key
const supabaseUrl = 'https://vngnfsvbcwjfilgkczsg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZuZ25mc3ZiY3dqZmlsZ2tjenNnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjIxNDkwOCwiZXhwIjoyMDY3NzkwOTA4fQ.3cW1nl0IKCkZd6cQspsdVuauRHIb7E2PynkEHY-U2h8';

const supabase = createClient(supabaseUrl, supabaseKey);

const monthYearMap = {
  'November': { month: 11, year: 2025 },
  'December': { month: 12, year: 2025 },
  'January': { month: 1, year: 2026 },
  'Febrauary': { month: 2, year: 2026 },
  'March': { month: 3, year: 2026 },
  'April': { month: 4, year: 2026 }
};

function getWeekDateStartEnd(month, weekNo) {
  const { month: m, year } = monthYearMap[month];
  const firstOfMonth = dayjs(`${year}-${String(m).padStart(2, '0')}-01`);
  const start = firstOfMonth.add((weekNo - 1) * 7, 'day');
  const end = start.add(6, 'day');
  return [start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD')];
}

async function importClassroomPlanner(filePath) {
  const csvText = fs.readFileSync(filePath, 'utf8');
  const rows = parse(csvText);

  const headerRowMonths = rows[2];
  const headerRowWeeks = rows[3];

  const weekMeta = [];
  let curMonth = '';
  for (let col = 2; col < headerRowWeeks.length; ++col) {
    if (headerRowMonths[col]) curMonth = headerRowMonths[col];
    if (headerRowWeeks[col] && headerRowWeeks[col].startsWith('W')) {
      const weekNum = parseInt(headerRowWeeks[col].substring(1));
      weekMeta[col] = { month: curMonth.trim(), weekNum };
    }
  }

  for (let row = 4; row < rows.length; row++) {
    const classroomRaw = rows[row][0];
    if (!classroomRaw) continue;
    const classroom = classroomRaw.split('(')[0].trim();
    const slot = rows[row][1] ? rows[row][1].toLowerCase() : '';
    let currentBlock = null;

    for (let col = 2; col < headerRowWeeks.length; ++col) {
      const cell = rows[row][col] ? rows[row][col].trim() : '';
      if (!cell) {
        if (currentBlock) {
          currentBlock.endCol = col - 1;
          const startMeta = weekMeta[currentBlock.startCol];
          const endMeta = weekMeta[currentBlock.endCol];
          const [startDate] = getWeekDateStartEnd(startMeta.month, startMeta.weekNum);
          const [, endDate] = getWeekDateStartEnd(endMeta.month, endMeta.weekNum);
          await supabase.from('classroom_occupancy').insert({
            classroom_name: classroom,
            slot,
            batch_no: currentBlock.batch,
            occupancy_start: startDate,
            occupancy_end: endDate
          });
          currentBlock = null;
        }
        continue;
      }

      const batch = cell.split(' ')[0];
      if (!currentBlock) {
        currentBlock = { batch, startCol: col };
      } else if (currentBlock.batch !== batch) {
        currentBlock.endCol = col - 1;
        const startMeta = weekMeta[currentBlock.startCol];
        const endMeta = weekMeta[currentBlock.endCol];
        const [startDate] = getWeekDateStartEnd(startMeta.month, startMeta.weekNum);
        const [, endDate] = getWeekDateStartEnd(endMeta.month, endMeta.weekNum);
        await supabase.from('classroom_occupancy').insert({
          classroom_name: classroom,
          slot,
          batch_no: currentBlock.batch,
          occupancy_start: startDate,
          occupancy_end: endDate
        });
        currentBlock = { batch, startCol: col };
      }
    }
    if (currentBlock) {
      currentBlock.endCol = headerRowWeeks.length - 1;
      const startMeta = weekMeta[currentBlock.startCol];
      const endMeta = weekMeta[currentBlock.endCol];
      if (startMeta && endMeta) {
        const [startDate] = getWeekDateStartEnd(startMeta.month, startMeta.weekNum);
        const [, endDate] = getWeekDateStartEnd(endMeta.month, endMeta.weekNum);
        await supabase.from('classroom_occupancy').insert({
          classroom_name: classroom,
          slot,
          batch_no: currentBlock.batch,
          occupancy_start: startDate,
          occupancy_end: endDate
        });
      }
    }
  }
}

importClassroomPlanner('Classroom-Planning-Offline-Batches.csv')
  .then(() => console.log('Import done'))
  .catch(console.error);
