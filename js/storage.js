(function (global) {
  'use strict';

  const STORAGE_KEY = 'morning_attendance_v1';

  const STATUSES = [
    {
      key: 'present',
      label: 'มาเรียน',
      shortLabel: 'มา',
      emoji: '✅',
      color: '#10b981',
      softBg: '#ecfdf5',
      border: '#6ee7b7',
      darkText: '#065f46'
    },
    {
      key: 'late',
      label: 'สาย',
      shortLabel: 'สาย',
      emoji: '⏰',
      color: '#f59e0b',
      softBg: '#fffbeb',
      border: '#fcd34d',
      darkText: '#92400e'
    },
    {
      key: 'absent',
      label: 'ขาด',
      shortLabel: 'ขาด',
      emoji: '❌',
      color: '#ef4444',
      softBg: '#fef2f2',
      border: '#fca5a5',
      darkText: '#991b1b'
    },
    {
      key: 'personal',
      label: 'ลากิจ',
      shortLabel: 'ลากิจ',
      emoji: '📝',
      color: '#3b82f6',
      softBg: '#eff6ff',
      border: '#93c5fd',
      darkText: '#1e40af'
    },
    {
      key: 'sick',
      label: 'ลาป่วย',
      shortLabel: 'ลาป่วย',
      emoji: '🤒',
      color: '#8b5cf6',
      softBg: '#f5f3ff',
      border: '#c4b5fd',
      darkText: '#5b21b6'
    },
    {
      key: 'activity',
      label: 'กิจกรรม',
      shortLabel: 'กิจกรรม',
      emoji: '🎯',
      color: '#06b6d4',
      softBg: '#ecfeff',
      border: '#67e8f9',
      darkText: '#155e75'
    }
  ];

  const STATUS_MAP = Object.fromEntries(STATUSES.map((s) => [s.key, s]));

  function generateId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function detectGender(name) {
    const trimmed = (name || '').trim();
    if (/^(เด็กชาย|ด\.ช\.|ดช\.|นาย)/.test(trimmed)) return 'M';
    if (/^(เด็กหญิง|ด\.ญ\.|ดญ\.|นางสาว|น\.ส\.|นส\.|นาง)/.test(trimmed)) return 'F';
    return '';
  }

  function buildDefaultStudents() {
    const defaultNames = [
      'เด็กชายกันต์ธีร์ แก้วมุกดา',
      'เด็กชายโกมินทร์ สามล',
      'เด็กชายเจตน์สฤษฎิ์ คงประชุม',
      'เด็กชายฉัตรเมธี ภู่ทอง',
      'เด็กชายชนภัทร เจียมอ่อน',
      'เด็กชายณัฐพนธ์ ศรีสร้อย',
      'เด็กชายณัฐวุฒิ พิสุทธิ์',
      'เด็กชายแทนคุณ อินทร์กอง',
      'เด็กชายนภัสกร ชูช่อ',
      'เด็กชายปวรปรัชญ์ คำดี',
      'เด็กชายรัชชานนท์ วงศ์ละคร',
      'เด็กชายรุ่งโรจน์ ปาศรีวงค์',
      'เด็กชายศิวัช สุคนธจร',
      'เด็กชายศุภากร แบนขุนทด',
      'เด็กหญิงกชภัส ชินภักดี',
      'เด็กหญิงกมลชนก กองเพ็ง',
      'เด็กหญิงกมลนิตย์ ศรีบุตร',
      'เด็กหญิงกันต์ฤทัย ขุรีรัง',
      'เด็กหญิงกัลยรัตน์ ปานพลอย',
      'เด็กหญิงกัลยาณี ทิพย์สละ',
      'เด็กหญิงฉัตรลดา จินตะกัน',
      'เด็กหญิงชลดา ปิยังคะบุตร',
      'เด็กหญิงญาดา ตั้งศิริวัฒนวงศ์',
      'เด็กหญิงญาดา เป้าประจำเมือง',
      'เด็กหญิงณัฐณิชา เทศลิ้นจี่',
      'เด็กหญิงนันทิกานต์ รักษาพล',
      'เด็กหญิงประภัทรสรณ์ แก้วฟ้า',
      'เด็กหญิงเปรมฤดี มีเรืองชัย',
      'เด็กหญิงพัชราพร สังข์กรณ์',
      'เด็กหญิงภคพร พันธุวัฒนาเจริญ',
      'เด็กหญิงรมิตา แก้วจินดา',
      'เด็กหญิงวศินี บุญเพ็ง',
      'เด็กหญิงสรัลรัศมิ์ คงกระพันธ์',
      'เด็กหญิงสุภกานต์ ศรีคูณ',
      'เด็กหญิงอภิญญา สังข์ทอง',
      'เด็กหญิงอัญชลีพร ศรีสุริยะมงคล',
      'เด็กหญิงอัญญาภรณ์ ศรีทอง'
    ];

    return defaultNames.map((name, idx) => ({
      id: `stu-${idx + 1}`,
      no: idx + 1,
      name,
      gender: detectGender(name)
    }));
  }

  function createSampleData() {
    const students = buildDefaultStudents();

    return {
      version: 2,
      settings: {
        schoolName: 'โรงเรียนตัวอย่างวิทยาคม',
        includePresentInLine: false,
        showGenderSummary: true
      },
      activeRoomId: 'room-default-1',
      rooms: [
        {
          id: 'room-default-1',
          name: 'ม.3/1',
          teacher: 'ครูที่ปรึกษา ม.3/1',
          students
        }
      ],
      records: {}
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const fresh = createSampleData();
        saveState(fresh);
        return fresh;
      }
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.rooms) || parsed.rooms.length === 0) {
        const fresh = createSampleData();
        saveState(fresh);
        return fresh;
      }

      // Auto-migrate if previously loaded only the initial sample placeholder students
      const defaultRoom = parsed.rooms.find((r) => r.id === 'room-default-1');
      if (
        defaultRoom &&
        Array.isArray(defaultRoom.students) &&
        defaultRoom.students.length > 0 &&
        defaultRoom.students.every((s) => typeof s.id === 'string' && s.id.startsWith('stu-sample-'))
      ) {
        defaultRoom.students = buildDefaultStudents();
        parsed.version = 2;
        if (parsed.records && parsed.records['room-default-1']) {
          delete parsed.records['room-default-1'];
        }
        saveState(parsed);
      }

      parsed.settings = Object.assign(
        {
          schoolName: 'โรงเรียนตัวอย่างวิทยาคม',
          includePresentInLine: false,
          showGenderSummary: true
        },
        parsed.settings || {}
      );
      parsed.records = parsed.records || {};
      if (!parsed.rooms.some((r) => r.id === parsed.activeRoomId)) {
        parsed.activeRoomId = parsed.rooms[0].id;
      }
      return parsed;
    } catch {
      return createSampleData();
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch {
      return false;
    }
  }

  function getActiveRoom(state) {
    return state.rooms.find((r) => r.id === state.activeRoomId) || state.rooms[0];
  }

  function getDayRecord(state, roomId, isoDate) {
    if (!state.records[roomId]) state.records[roomId] = {};
    if (!state.records[roomId][isoDate]) {
      state.records[roomId][isoDate] = {
        entries: {},
        updatedAt: null
      };
    }
    return state.records[roomId][isoDate];
  }

  function setStudentStatus(state, roomId, isoDate, studentId, statusKey) {
    const rec = getDayRecord(state, roomId, isoDate);
    const current = rec.entries[studentId] || { status: '', note: '' };
    if (!statusKey) {
      if (current.note) {
        rec.entries[studentId] = { status: '', note: current.note };
      } else {
        delete rec.entries[studentId];
      }
    } else {
      rec.entries[studentId] = { status: statusKey, note: current.note || '' };
    }
    rec.updatedAt = new Date().toISOString();
    saveState(state);
  }

  function setStudentNote(state, roomId, isoDate, studentId, note) {
    const rec = getDayRecord(state, roomId, isoDate);
    const current = rec.entries[studentId] || { status: '', note: '' };
    const cleanNote = (note || '').trim();
    if (!current.status && !cleanNote) {
      delete rec.entries[studentId];
    } else {
      rec.entries[studentId] = { status: current.status, note: cleanNote };
    }
    rec.updatedAt = new Date().toISOString();
    saveState(state);
  }

  function markAllStatus(state, roomId, isoDate, statusKey) {
    const room = state.rooms.find((r) => r.id === roomId);
    if (!room) return;
    const rec = getDayRecord(state, roomId, isoDate);
    for (const stu of room.students) {
      const existing = rec.entries[stu.id];
      rec.entries[stu.id] = {
        status: statusKey,
        note: existing ? existing.note : ''
      };
    }
    rec.updatedAt = new Date().toISOString();
    saveState(state);
  }

  function clearDayRecord(state, roomId, isoDate) {
    if (state.records[roomId] && state.records[roomId][isoDate]) {
      delete state.records[roomId][isoDate];
      saveState(state);
    }
  }

  function computeSummary(room, record) {
    const entries = (record && record.entries) || {};
    const counts = {
      present: 0,
      late: 0,
      absent: 0,
      personal: 0,
      sick: 0,
      activity: 0,
      unchecked: 0
    };
    const byStatus = {
      present: [],
      late: [],
      absent: [],
      personal: [],
      sick: [],
      activity: [],
      unchecked: []
    };

    let maleTotal = 0;
    let femaleTotal = 0;
    let maleAttending = 0;
    let femaleAttending = 0;

    const sortedStudents = [...room.students].sort((a, b) => a.no - b.no);

    for (const stu of sortedStudents) {
      const entry = entries[stu.id] || { status: '', note: '' };
      const st = STATUS_MAP[entry.status] ? entry.status : 'unchecked';
      counts[st] += 1;
      byStatus[st].push({
        student: stu,
        status: st,
        note: entry.note || ''
      });

      const isAttending = st === 'present' || st === 'late' || st === 'activity';
      if (stu.gender === 'M') {
        maleTotal += 1;
        if (isAttending) maleAttending += 1;
      } else if (stu.gender === 'F') {
        femaleTotal += 1;
        if (isAttending) femaleAttending += 1;
      }
    }

    const total = sortedStudents.length;
    const checked = total - counts.unchecked;
    // Students physically/officially accounted for at school (มาเรียน + สาย + กิจกรรม)
    const onCampusCount = counts.present + counts.late + counts.activity;
    const presentPercent = total > 0 ? Math.round((counts.present / total) * 1000) / 10 : 0;
    const onCampusPercent = total > 0 ? Math.round((onCampusCount / total) * 1000) / 10 : 0;

    return {
      total,
      checked,
      counts,
      byStatus,
      onCampusCount,
      presentPercent,
      onCampusPercent,
      gender: {
        maleTotal,
        femaleTotal,
        maleAttending,
        femaleAttending,
        hasGenderData: maleTotal > 0 || femaleTotal > 0
      },
      sortedStudents
    };
  }

  function parseBulkStudentText(rawText) {
    const lines = (rawText || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const parsed = [];
    let autoNo = 1;

    for (const line of lines) {
      // Support tab-separated (Excel copy: "1\tเด็กชาย...") or numbered ("1. เด็กชาย..." or "1) ...")
      let no = autoNo;
      let name = line;

      const match = line.match(/^(\d{1,3})\s*[\.\)\-:\t]\s*(.+)$/) || line.match(/^(\d{1,3})\s+([^\d].+)$/);
      if (match) {
        const extractedNo = parseInt(match[1], 10);
        if (!Number.isNaN(extractedNo) && extractedNo > 0) {
          no = extractedNo;
        }
        name = match[2].trim();
      }

      // Collapse multiple tabs/spaces
      name = name.replace(/\t+/g, ' ').replace(/\s{2,}/g, ' ').trim();
      if (!name) continue;

      parsed.push({
        id: generateId('stu'),
        no,
        name,
        gender: detectGender(name)
      });
      autoNo = Math.max(autoNo + 1, no + 1);
    }

    return parsed;
  }

  function getCheckedDatesForRoom(state, roomId) {
    const roomRecs = state.records[roomId] || {};
    return Object.keys(roomRecs)
      .filter((dateKey) => {
        const entries = roomRecs[dateKey] && roomRecs[dateKey].entries;
        return entries && Object.values(entries).some((e) => e && e.status);
      })
      .sort((a, b) => (a < b ? 1 : -1));
  }

  global.AttendanceApp = global.AttendanceApp || {};
  global.AttendanceApp.Storage = {
    STATUSES,
    STATUS_MAP,
    generateId,
    detectGender,
    loadState,
    saveState,
    getActiveRoom,
    getDayRecord,
    setStudentStatus,
    setStudentNote,
    markAllStatus,
    clearDayRecord,
    computeSummary,
    parseBulkStudentText,
    getCheckedDatesForRoom
  };
})(window);
