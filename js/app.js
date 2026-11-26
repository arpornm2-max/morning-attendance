(function (global) {
  'use strict';

  const { Storage, ThaiDate, ImageExport } = global.AttendanceApp;
  const { STATUSES, STATUS_MAP } = Storage;

  let state = Storage.loadState();
  let currentDate = ThaiDate.getTodayISO();
  let currentFilter = 'all'; // 'all' | 'unchecked' | statusKey
  let searchQuery = '';
  let openNoteStudentId = null;

  // Image preview state
  let currentImageMode = 'summary';
  let currentImageBlob = null;
  let currentImageObjectUrl = null;

  // Visual toast timer
  let statusBannerTimer = null;
  let lastAnnouncement = '';

  // DOM Elements
  const els = {
    headerSchoolName: document.getElementById('header-school-name'),
    roomSelector: document.getElementById('room-selector'),
    thaiDateLabel: document.getElementById('thai-date-label'),
    attendanceDate: document.getElementById('attendance-date'),
    teacherNamePill: document.getElementById('teacher-name-pill'),
    prevDateBtn: document.getElementById('prev-date-btn'),
    nextDateBtn: document.getElementById('next-date-btn'),
    todayDateBtn: document.getElementById('today-date-btn'),
    markAllPresentBtn: document.getElementById('mark-all-present-btn'),
    clearDayBtn: document.getElementById('clear-day-btn'),
    checkedProgressText: document.getElementById('checked-progress-text'),
    genderSummaryBadge: document.getElementById('gender-summary-badge'),
    attendanceRateBadge: document.getElementById('attendance-rate-badge'),
    stackedProgressBar: document.getElementById('stacked-progress-bar'),
    statCardsGrid: document.getElementById('stat-cards-grid'),
    studentSearch: document.getElementById('student-search'),
    filterChips: document.getElementById('filter-chips'),
    uncheckedChipCount: document.getElementById('unchecked-chip-count'),
    studentList: document.getElementById('student-list'),
    lineSummaryText: document.getElementById('line-summary-text'),
    toggleIncludePresent: document.getElementById('toggle-include-present'),
    openImagePreviewBtn: document.getElementById('open-image-preview-btn'),
    mobileImageBtn: document.getElementById('mobile-image-btn'),
    shareLineAppBtn: document.getElementById('share-line-app-btn'),
    openManageBtn: document.getElementById('open-manage-btn'),
    openHistoryBtn: document.getElementById('open-history-btn'),
    srAnnouncements: document.getElementById('sr-announcements'),
    visualStatusBanner: document.getElementById('visual-status-banner'),

    // Image dialog
    imageDialog: document.getElementById('image-dialog'),
    modeSummaryBtn: document.getElementById('mode-summary-btn'),
    modeFullBtn: document.getElementById('mode-full-btn'),
    imagePreviewLoading: document.getElementById('image-preview-loading'),
    imagePreviewImg: document.getElementById('image-preview-img'),
    downloadImageBtn: document.getElementById('download-image-btn'),
    shareImageBtn: document.getElementById('share-image-btn'),
    closeImageBtn: document.getElementById('close-image-btn'),

    // Manage dialog
    manageDialog: document.getElementById('manage-dialog'),
    addStudentForm: document.getElementById('add-student-form'),
    newStudentNo: document.getElementById('new-student-no'),
    newStudentName: document.getElementById('new-student-name'),
    newStudentGender: document.getElementById('new-student-gender'),
    manageStudentList: document.getElementById('manage-student-list'),
    bulkStudentInput: document.getElementById('bulk-student-input'),
    bulkAppendBtn: document.getElementById('bulk-append-btn'),
    bulkReplaceBtn: document.getElementById('bulk-replace-btn'),
    schoolSettingsForm: document.getElementById('school-settings-form'),
    settingSchoolName: document.getElementById('setting-school-name'),
    settingRoomName: document.getElementById('setting-room-name'),
    settingRoomTeacher: document.getElementById('setting-room-teacher'),
    settingShowGender: document.getElementById('setting-show-gender'),
    roomsList: document.getElementById('rooms-list'),
    addRoomForm: document.getElementById('add-room-form'),
    newRoomName: document.getElementById('new-room-name'),
    newRoomTeacher: document.getElementById('new-room-teacher'),
    exportJsonBtn: document.getElementById('export-json-btn'),
    importJsonInput: document.getElementById('import-json-input'),

    // History dialog
    historyDialog: document.getElementById('history-dialog'),
    historyRoomSubtitle: document.getElementById('history-room-subtitle'),
    historyList: document.getElementById('history-list'),

    // Confirm clear dialog
    confirmClearDialog: document.getElementById('confirm-clear-dialog'),
    confirmClearDesc: document.getElementById('confirm-clear-desc')
  };

  /* ---------- Accessibility & Feedback Helpers ---------- */
  function announce(message, showVisual = true) {
    if (!message) return;
    let srMsg = message;
    if (srMsg === lastAnnouncement) srMsg += '\u00A0';
    lastAnnouncement = srMsg;

    if (typeof document.ariaNotify === 'function') {
      document.ariaNotify(srMsg);
    } else if (els.srAnnouncements) {
      els.srAnnouncements.textContent = '';
      requestAnimationFrame(() => {
        els.srAnnouncements.textContent = srMsg;
      });
    }

    if (showVisual && els.visualStatusBanner) {
      // Do not show background visual toast while a modal dialog is open
      if (document.querySelector('dialog[open]')) return;
      clearTimeout(statusBannerTimer);
      els.visualStatusBanner.textContent = message;
      els.visualStatusBanner.classList.add('visible');
      statusBannerTimer = setTimeout(() => {
        els.visualStatusBanner.classList.remove('visible');
      }, 2400);
    }
  }

  /* ---------- Copy Button (Invoker Commands + Fallback) ---------- */
  const copyTimers = new WeakMap();
  let lastCopyTip = '';

  function legacyCopy(text) {
    const previousFocus = document.activeElement;
    const field = Object.assign(document.createElement('textarea'), { value: text });
    field.setAttribute('readonly', '');
    field.style.cssText = 'position:fixed;inset-block-start:0;opacity:0';
    document.body.append(field);
    field.select();
    try {
      return document.execCommand('copy');
    } finally {
      field.remove();
      if (previousFocus && typeof previousFocus.focus === 'function') {
        previousFocus.focus({ preventScroll: true });
      }
    }
  }

  function reportCopy(button, ok) {
    const tip = button.nextElementSibling;
    clearTimeout(copyTimers.get(button));
    button.removeAttribute('data-copied');
    button.removeAttribute('data-failed');

    let message = ok ? 'คัดลอกแล้ว พร้อมวางใน LINE!' : 'คัดลอกไม่สำเร็จ';
    if (message === lastCopyTip) message += '\u00A0';
    lastCopyTip = message;

    if (tip) tip.textContent = '';
    void button.offsetWidth;
    button.setAttribute(ok ? 'data-copied' : 'data-failed', '');
    if (tip) {
      requestAnimationFrame(() => {
        tip.textContent = message;
      });
    }

    copyTimers.set(
      button,
      setTimeout(() => {
        button.removeAttribute('data-copied');
        button.removeAttribute('data-failed');
        if (tip) tip.textContent = '';
      }, 2200)
    );
  }

  async function executeCopy(button, target) {
    if (!target) return;
    const text = target.matches('input, textarea')
      ? target.value
      : target.innerText.trim();
    if (!text) return;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        if (!legacyCopy(text)) throw new Error('Legacy copy failed');
      }
      reportCopy(button, true);
    } catch {
      try {
        if (!legacyCopy(text)) throw new Error('Copy failed');
        reportCopy(button, true);
      } catch {
        reportCopy(button, false);
      }
    }
  }

  function initCopyCommandHandlers() {
    document.addEventListener(
      'command',
      (event) => {
        if (event.command && event.command.startsWith('--copy')) {
          executeCopy(event.source, event.target);
        }
      },
      true
    );

    if (!('CommandEvent' in window)) {
      document.addEventListener('click', (event) => {
        if (event.defaultPrevented) return;
        const button = event.target.closest('button[command^="--copy"]');
        if (!button) return;
        const targetId = button.getAttribute('commandfor');
        const target = targetId ? document.getElementById(targetId) : null;
        if (target) executeCopy(button, target);
      });
    }
  }

  /* ---------- Dialog Light-Dismiss Fallback ---------- */
  function initDialogFallbacks() {
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      const outside = (e, dialog) => {
        const r = dialog.getBoundingClientRect();
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      };
      for (const dialog of document.querySelectorAll('dialog[closedby="any"]')) {
        let pressedOutside = false;
        dialog.addEventListener('pointerdown', (e) => {
          pressedOutside = outside(e, dialog);
        });
        dialog.addEventListener('pointerup', (e) => {
          if (pressedOutside && outside(e, dialog)) {
            dialog.close();
          }
        });
      }
    }
  }

  /* ---------- LINE Summary Text Generator ---------- */
  function formatPctText(count, total) {
    if (!total) return '0%';
    const val = Math.round((count / total) * 1000) / 10;
    return `${Number.isInteger(val) ? val : val.toFixed(1)}%`;
  }

  function buildLineSummaryText(room, isoDate, summary, record) {
    const lines = [];
    lines.push('☀️ สรุปการเช็คชื่อเข้าแถวตอนเช้า');
    if (state.settings.schoolName) {
      lines.push(`🏫 ${state.settings.schoolName}`);
    }
    const teacherPart = room.teacher ? ` (${room.teacher})` : '';
    lines.push(`📌 ห้อง ${room.name}${teacherPart}`);
    lines.push(`📅 ${ThaiDate.formatThaiDateFull(isoDate)}`);
    lines.push('');

    let totalLine = `👥 นักเรียนทั้งหมด ${summary.total} คน`;
    if (state.settings.showGenderSummary && summary.gender.hasGenderData) {
      totalLine += ` (ชาย ${summary.gender.maleTotal} / หญิง ${summary.gender.femaleTotal})`;
    }
    lines.push(totalLine);

    for (const st of STATUSES) {
      const count = summary.counts[st.key];
      const pctSuffix = st.key === 'present' ? ` (${formatPctText(count, summary.total)})` : '';
      lines.push(`${st.emoji} ${st.label}: ${count} คน${pctSuffix}`);
    }

    if (summary.counts.unchecked > 0) {
      lines.push(`⬜ ยังไม่เช็คชื่อ: ${summary.counts.unchecked} คน`);
    }

    const detailStatuses = ['late', 'absent', 'personal', 'sick', 'activity'];
    const nonPresentSections = [];

    for (const key of detailStatuses) {
      const items = summary.byStatus[key];
      if (items.length > 0) {
        const st = STATUS_MAP[key];
        nonPresentSections.push({
          header: `${st.emoji} ${st.label} (${items.length} คน)`,
          items
        });
      }
    }

    if (state.settings.includePresentInLine && summary.byStatus.present.length > 0) {
      const st = STATUS_MAP.present;
      nonPresentSections.unshift({
        header: `${st.emoji} ${st.label} (${summary.byStatus.present.length} คน)`,
        items: summary.byStatus.present
      });
    }

    lines.push('');
    if (nonPresentSections.length === 0 && summary.total > 0 && summary.counts.unchecked === 0) {
      lines.push('🎉 นักเรียนมาเรียนครบทุกคน (100%)');
    } else if (nonPresentSections.length > 0) {
      lines.push('📋 รายชื่อเพิ่มเติม');
      for (const sec of nonPresentSections) {
        lines.push(sec.header);
        for (const item of sec.items) {
          const noteStr = item.note ? ` [${item.note}]` : '';
          lines.push(`  • เลขที่ ${item.student.no} ${item.student.name}${noteStr}`);
        }
      }
    }

    lines.push('');
    lines.push(
      `📊 เข้าเรียน/ร่วมกิจกรรม: ${summary.onCampusCount}/${summary.total} คน (${formatPctText(summary.onCampusCount, summary.total)})`
    );
    const updatedTime =
      record && record.updatedAt
        ? ThaiDate.formatTimeNow(new Date(record.updatedAt))
        : ThaiDate.formatTimeNow();
    lines.push(`🕒 บันทึกเวลา ${updatedTime}`);

    return lines.join('\n');
  }

  /* ---------- UI Rendering ---------- */
  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderHeaderAndDate() {
    const room = Storage.getActiveRoom(state);
    els.headerSchoolName.textContent = state.settings.schoolName || 'ระบบเช็คชื่อเข้าแถวตอนเช้า';

    // Room selector options
    els.roomSelector.innerHTML = state.rooms
      .map(
        (r) =>
          `<option value="${escapeHtml(r.id)}" ${r.id === room.id ? 'selected' : ''}>ห้อง ${escapeHtml(r.name)} (${r.students.length} คน)</option>`
      )
      .join('');

    els.thaiDateLabel.textContent = ThaiDate.formatThaiDateFull(currentDate);
    els.attendanceDate.value = currentDate;
    els.teacherNamePill.textContent = room.teacher ? `ครูที่ปรึกษา: ${room.teacher}` : '';
    els.todayDateBtn.hidden = currentDate === ThaiDate.getTodayISO();
    els.toggleIncludePresent.checked = Boolean(state.settings.includePresentInLine);
  }

  function renderSummary(room, summary, record) {
    els.checkedProgressText.textContent = `เช็คชื่อแล้ว ${summary.checked} / ${summary.total} คน`;

    if (state.settings.showGenderSummary && summary.gender.hasGenderData) {
      els.genderSummaryBadge.hidden = false;
      els.genderSummaryBadge.textContent = `ชาย ${summary.gender.maleTotal} • หญิง ${summary.gender.femaleTotal}`;
    } else {
      els.genderSummaryBadge.hidden = true;
    }

    els.attendanceRateBadge.textContent = `มาโรงเรียน ${formatPctText(summary.onCampusCount, summary.total)}`;

    // Stacked progress bar
    if (summary.total === 0) {
      els.stackedProgressBar.innerHTML = '';
    } else {
      els.stackedProgressBar.innerHTML = STATUSES.map((st) => {
        const count = summary.counts[st.key];
        if (!count) return '';
        const widthPct = (count / summary.total) * 100;
        return `<div class="stacked-bar-seg" style="inline-size:${widthPct}%;background:${st.color}" title="${st.label}: ${count} คน"></div>`;
      }).join('');
    }

    // 6 Clickable Stat Filter Cards
    els.statCardsGrid.innerHTML = STATUSES.map((st) => {
      const count = summary.counts[st.key];
      const pct = formatPctText(count, summary.total);
      const isActive = currentFilter === st.key;
      return `
        <button
          type="button"
          class="stat-card"
          data-filter-status="${st.key}"
          aria-pressed="${isActive ? 'true' : 'false'}"
          style="--st-color:${st.color};--st-bg:${st.softBg};--st-text:${st.darkText}"
        >
          <span class="stat-card-top">
            <span class="stat-name">${st.label}</span>
            <span class="stat-dot" aria-hidden="true"></span>
          </span>
          <span class="stat-count-row">
            <span class="stat-count">${count}</span>
            <span class="stat-pct">${pct}</span>
          </span>
        </button>
      `;
    }).join('');

    // Filter chips state
    els.uncheckedChipCount.textContent = String(summary.counts.unchecked);
    for (const chip of els.filterChips.querySelectorAll('.chip')) {
      const filterVal = chip.getAttribute('data-filter');
      chip.classList.toggle('active', currentFilter === filterVal);
    }

    // Update LINE Summary Textarea
    els.lineSummaryText.value = buildLineSummaryText(room, currentDate, summary, record);
  }

  function renderStudentList(room, summary, record) {
    const entries = (record && record.entries) || {};
    const q = searchQuery.trim().toLowerCase();

    const filtered = summary.sortedStudents.filter((stu) => {
      const entry = entries[stu.id] || { status: '', note: '' };
      const st = STATUS_MAP[entry.status] ? entry.status : 'unchecked';

      if (currentFilter !== 'all' && st !== currentFilter) {
        return false;
      }

      if (q) {
        const matchName = stu.name.toLowerCase().includes(q);
        const matchNo = String(stu.no) === q || String(stu.no).includes(q);
        const matchNote = (entry.note || '').toLowerCase().includes(q);
        if (!matchName && !matchNo && !matchNote) return false;
      }

      return true;
    });

    if (summary.sortedStudents.length === 0) {
      els.studentList.innerHTML = `
        <div class="empty-state">
          <p>ยังไม่มีรายชื่อนักเรียนในห้องนี้</p>
          <button type="button" class="btn btn-primary" id="empty-add-students-btn">เพิ่มรายชื่อนักเรียน</button>
        </div>
      `;
      const addBtn = document.getElementById('empty-add-students-btn');
      if (addBtn) addBtn.addEventListener('click', () => openManageDialog('bulk'));
      return;
    }

    if (filtered.length === 0) {
      els.studentList.innerHTML = `
        <div class="empty-state">
          <p>ไม่พบนักเรียนที่ตรงกับตัวกรองหรือคำค้นหา</p>
          <button type="button" class="btn btn-secondary" id="reset-filter-btn">แสดงรายชื่อทั้งหมด</button>
        </div>
      `;
      const resetBtn = document.getElementById('reset-filter-btn');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          currentFilter = 'all';
          searchQuery = '';
          els.studentSearch.value = '';
          renderAll();
        });
      }
      return;
    }

    els.studentList.innerHTML = filtered
      .map((stu) => {
        const entry = entries[stu.id] || { status: '', note: '' };
        const stKey = STATUS_MAP[entry.status] ? entry.status : '';
        const isNoteOpen = openNoteStudentId === stu.id;
        const notePreview = entry.note
          ? `<span class="student-note-preview">${escapeHtml(entry.note)}</span>`
          : '';

        const buttonsHtml = STATUSES.map((st) => {
          const pressed = stKey === st.key;
          return `
            <button
              type="button"
              class="status-btn"
              data-student-id="${escapeHtml(stu.id)}"
              data-status-key="${st.key}"
              aria-pressed="${pressed ? 'true' : 'false'}"
              style="--st-color:${st.color};--st-bg:${st.softBg};--st-text:${st.darkText}"
            >${st.label}</button>
          `;
        }).join('');

        return `
          <article class="student-row" data-student-row="${escapeHtml(stu.id)}" data-status="${stKey}">
            <div class="student-row-top">
              <div class="student-identity">
                <span class="student-no">${stu.no}</span>
                <div class="student-name-wrap">
                  <span class="student-name">${escapeHtml(stu.name)}</span>
                  ${notePreview}
                </div>
              </div>
              <button
                type="button"
                class="note-toggle-btn ${entry.note ? 'has-note' : ''}"
                data-note-toggle="${escapeHtml(stu.id)}"
                aria-expanded="${isNoteOpen ? 'true' : 'false'}"
              >${entry.note ? 'แก้หมายเหตุ' : '+ หมายเหตุ'}</button>
            </div>
            <div class="status-buttons" role="group" aria-label="สถานะของ ${escapeHtml(stu.name)}">
              ${buttonsHtml}
            </div>
            <div class="student-note-editor" ${isNoteOpen ? '' : 'hidden'}>
              <input
                type="text"
                class="student-note-input"
                data-note-input="${escapeHtml(stu.id)}"
                value="${escapeHtml(entry.note)}"
                placeholder="เพิ่มหมายเหตุ เช่น กิจกรรมวงโยฯ, เป็นไข้, รถติด..."
                aria-label="หมายเหตุของ ${escapeHtml(stu.name)}"
              >
              <button type="button" class="btn btn-secondary" data-note-save="${escapeHtml(stu.id)}">บันทึก</button>
            </div>
          </article>
        `;
      })
      .join('');
  }

  function renderAll() {
    const room = Storage.getActiveRoom(state);
    const record = Storage.getDayRecord(state, room.id, currentDate);
    const summary = Storage.computeSummary(room, record);

    renderHeaderAndDate();
    renderSummary(room, summary, record);
    renderStudentList(room, summary, record);
  }

  /* ---------- Image Export Preview Modal ---------- */
  function revokePreviewUrl() {
    if (currentImageObjectUrl) {
      URL.revokeObjectURL(currentImageObjectUrl);
      currentImageObjectUrl = null;
    }
  }

  function getImageFilename(room, isoDate) {
    const safeRoom = (room.name || 'room').replace(/[\/\\\s:*?"<>|]+/g, '-');
    const suffix = currentImageMode === 'full' ? '-รายชื่อทั้งหมด' : '';
    return `เช็คชื่อ-${safeRoom}-${isoDate}${suffix}.png`;
  }

  async function refreshImagePreview() {
    const room = Storage.getActiveRoom(state);
    const record = Storage.getDayRecord(state, room.id, currentDate);
    const summary = Storage.computeSummary(room, record);

    els.modeSummaryBtn.classList.toggle('active', currentImageMode === 'summary');
    els.modeFullBtn.classList.toggle('active', currentImageMode === 'full');

    els.imagePreviewLoading.hidden = false;
    els.imagePreviewImg.hidden = true;
    els.downloadImageBtn.disabled = true;

    try {
      const canvas = await ImageExport.renderSummaryCanvas({
        schoolName: state.settings.schoolName,
        room,
        isoDate: currentDate,
        summary,
        record,
        mode: currentImageMode,
        showGenderSummary: state.settings.showGenderSummary
      });

      const blob = await ImageExport.canvasToBlob(canvas);
      currentImageBlob = blob;

      revokePreviewUrl();
      currentImageObjectUrl = URL.createObjectURL(blob);
      els.imagePreviewImg.src = currentImageObjectUrl;
      els.imagePreviewImg.hidden = false;
      els.imagePreviewLoading.hidden = true;
      els.downloadImageBtn.disabled = false;

      // Check Web Share API with files support (especially handy on mobile LINE!)
      const testFile = new File([blob], getImageFilename(room, currentDate), { type: 'image/png' });
      const canShareFiles =
        typeof navigator.canShare === 'function' && navigator.canShare({ files: [testFile] });
      els.shareImageBtn.hidden = !canShareFiles;
    } catch {
      els.imagePreviewLoading.textContent = 'ไม่สามารถสร้างรูปภาพได้ กรุณาลองใหม่อีกครั้ง';
      els.downloadImageBtn.disabled = false;
    }
  }

  function openImageDialog() {
    els.imageDialog.showModal();
    refreshImagePreview();
  }

  function downloadCurrentImage() {
    if (!currentImageBlob) return;
    const room = Storage.getActiveRoom(state);
    const filename = getImageFilename(room, currentDate);
    const url = currentImageObjectUrl || URL.createObjectURL(currentImageBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    announce(`บันทึกรูปภาพ ${filename} เรียบร้อย`, false);
  }

  async function shareCurrentImage() {
    if (!currentImageBlob || !navigator.share) return;
    const room = Storage.getActiveRoom(state);
    const filename = getImageFilename(room, currentDate);
    const file = new File([currentImageBlob], filename, { type: 'image/png' });
    try {
      await navigator.share({
        title: `สรุปเช็คชื่อเข้าแถว ห้อง ${room.name}`,
        text: `สรุปการเช็คชื่อเข้าแถวตอนเช้า ห้อง ${room.name} (${ThaiDate.formatThaiDateShort(currentDate)})`,
        files: [file]
      });
    } catch {
      // User cancelled share sheet
    }
  }

  /* ---------- Manage Students / Rooms Modal ---------- */
  function switchManageTab(tabName) {
    for (const btn of els.manageDialog.querySelectorAll('.tab-btn')) {
      const active = btn.getAttribute('data-tab') === tabName;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    }
    for (const panel of els.manageDialog.querySelectorAll('.tab-panel')) {
      panel.classList.toggle('active', panel.getAttribute('data-panel') === tabName);
    }
  }

  function renderManageModalContent() {
    const room = Storage.getActiveRoom(state);
    const sorted = [...room.students].sort((a, b) => a.no - b.no);

    // Next suggested student number
    const maxNo = sorted.reduce((m, s) => Math.max(m, s.no), 0);
    els.newStudentNo.value = String(maxNo + 1);

    // Render students edit rows
    if (sorted.length === 0) {
      els.manageStudentList.innerHTML =
        '<p class="helper-text">ยังไม่มีรายชื่อนักเรียน เพิ่มทีละคนด้านบน หรือใช้แท็บ "วางรายชื่อหลายคน"</p>';
    } else {
      els.manageStudentList.innerHTML = sorted
        .map(
          (stu) => `
            <div class="manage-student-item" data-edit-student-id="${escapeHtml(stu.id)}">
              <input type="number" class="edit-stu-no" min="1" max="999" value="${stu.no}" aria-label="เลขที่">
              <input type="text" class="edit-stu-name" value="${escapeHtml(stu.name)}" aria-label="ชื่อ-นามสกุล">
              <select class="edit-stu-gender" aria-label="เพศ">
                <option value="" ${stu.gender === '' ? 'selected' : ''}>ไม่ระบุ</option>
                <option value="M" ${stu.gender === 'M' ? 'selected' : ''}>ชาย</option>
                <option value="F" ${stu.gender === 'F' ? 'selected' : ''}>หญิง</option>
              </select>
              <button type="button" class="icon-btn delete-stu-btn" data-delete-stu="${escapeHtml(stu.id)}" aria-label="ลบ ${escapeHtml(stu.name)}">🗑</button>
            </div>
          `
        )
        .join('');
    }

    // Settings inputs
    els.settingSchoolName.value = state.settings.schoolName || '';
    els.settingRoomName.value = room.name || '';
    els.settingRoomTeacher.value = room.teacher || '';
    els.settingShowGender.checked = Boolean(state.settings.showGenderSummary);

    // Rooms list
    els.roomsList.innerHTML = state.rooms
      .map((r) => {
        const isCurrent = r.id === room.id;
        return `
          <div class="room-item-row ${isCurrent ? 'active-room' : ''}">
            <div class="room-item-meta">
              <span class="room-item-name">ห้อง ${escapeHtml(r.name)} ${isCurrent ? '(กำลังใช้งาน)' : ''}</span>
              <span class="room-item-sub">${r.students.length} คน ${r.teacher ? `• ${escapeHtml(r.teacher)}` : ''}</span>
            </div>
            <div class="room-item-actions">
              ${
                !isCurrent
                  ? `<button type="button" class="btn btn-secondary" data-switch-room="${escapeHtml(r.id)}">เลือก</button>`
                  : ''
              }
              ${
                state.rooms.length > 1
                  ? `<button type="button" class="btn btn-outline-danger" data-delete-room="${escapeHtml(r.id)}">ลบ</button>`
                  : ''
              }
            </div>
          </div>
        `;
      })
      .join('');
  }

  function openManageDialog(initialTab = 'students') {
    switchManageTab(initialTab);
    renderManageModalContent();
    els.manageDialog.showModal();
  }

  /* ---------- Attendance History Modal ---------- */
  function openHistoryDialog() {
    const room = Storage.getActiveRoom(state);
    const dates = Storage.getCheckedDatesForRoom(state, room.id);

    els.historyRoomSubtitle.textContent = `ประวัติการเช็คชื่อของห้อง ${room.name} (ทั้งหมด ${dates.length} วัน)`;

    if (dates.length === 0) {
      els.historyList.innerHTML =
        '<p class="helper-text">ยังไม่มีประวัติการเช็คชื่อที่บันทึกไว้สำหรับห้องนี้</p>';
    } else {
      els.historyList.innerHTML = dates
        .map((dateStr) => {
          const rec = Storage.getDayRecord(state, room.id, dateStr);
          const sum = Storage.computeSummary(room, rec);
          return `
            <button type="button" class="history-row" data-jump-date="${dateStr}">
              <span class="history-date">${ThaiDate.formatThaiDateFull(dateStr)}</span>
              <span class="history-badges">
                <span class="history-badge">มา ${sum.counts.present}</span>
                <span class="history-badge">สาย ${sum.counts.late}</span>
                <span class="history-badge">ขาด ${sum.counts.absent}</span>
                <span class="history-badge">ลา ${sum.counts.personal + sum.counts.sick}</span>
                <span class="history-badge">กิจกรรม ${sum.counts.activity}</span>
              </span>
            </button>
          `;
        })
        .join('');
    }

    els.historyDialog.showModal();
  }

  /* ---------- Event Wiring ---------- */
  function bindEvents() {
    // Room switch
    els.roomSelector.addEventListener('change', (e) => {
      state.activeRoomId = e.target.value;
      Storage.saveState(state);
      currentFilter = 'all';
      openNoteStudentId = null;
      renderAll();
    });

    // Date navigation
    els.prevDateBtn.addEventListener('click', () => {
      currentDate = ThaiDate.shiftDateISO(currentDate, -1);
      openNoteStudentId = null;
      renderAll();
    });

    els.nextDateBtn.addEventListener('click', () => {
      currentDate = ThaiDate.shiftDateISO(currentDate, 1);
      openNoteStudentId = null;
      renderAll();
    });

    els.attendanceDate.addEventListener('change', (e) => {
      if (e.target.value) {
        currentDate = e.target.value;
        openNoteStudentId = null;
        renderAll();
      }
    });

    els.todayDateBtn.addEventListener('click', () => {
      currentDate = ThaiDate.getTodayISO();
      openNoteStudentId = null;
      renderAll();
    });

    // Quick mark all present
    els.markAllPresentBtn.addEventListener('click', () => {
      const room = Storage.getActiveRoom(state);
      Storage.markAllStatus(state, room.id, currentDate, 'present');
      renderAll();
      announce(`เช็ค "มาเรียน" ทั้งหมด ${room.students.length} คนแล้ว`);
    });

    // Clear today (native confirm dialog)
    els.clearDayBtn.addEventListener('click', () => {
      const room = Storage.getActiveRoom(state);
      els.confirmClearDesc.textContent = `ต้องการล้างสถานะการเช็คชื่อและหมายเหตุทั้งหมดของห้อง ${room.name} วันที่ ${ThaiDate.formatThaiDateShort(currentDate)} ใช่หรือไม่?`;
      els.confirmClearDialog.showModal();
    });

    els.confirmClearDialog.addEventListener('close', () => {
      const choice = els.confirmClearDialog.returnValue;
      els.confirmClearDialog.returnValue = '';
      if (choice === 'confirm') {
        const room = Storage.getActiveRoom(state);
        Storage.clearDayRecord(state, room.id, currentDate);
        openNoteStudentId = null;
        renderAll();
        announce('ล้างข้อมูลการเช็คชื่อวันนี้เรียบร้อยแล้ว');
      }
    });

    // Stat cards filter toggle
    els.statCardsGrid.addEventListener('click', (e) => {
      const card = e.target.closest('[data-filter-status]');
      if (!card) return;
      const stKey = card.getAttribute('data-filter-status');
      currentFilter = currentFilter === stKey ? 'all' : stKey;
      renderAll();
    });

    // Filter chips
    els.filterChips.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-filter]');
      if (!chip) return;
      currentFilter = chip.getAttribute('data-filter');
      renderAll();
    });

    // Student search
    els.studentSearch.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderAll();
    });

    // Student list delegated interactions (status toggle + note editor)
    els.studentList.addEventListener('click', (e) => {
      const statusBtn = e.target.closest('.status-btn');
      if (statusBtn) {
        const room = Storage.getActiveRoom(state);
        const studentId = statusBtn.getAttribute('data-student-id');
        const statusKey = statusBtn.getAttribute('data-status-key');
        const isPressed = statusBtn.getAttribute('aria-pressed') === 'true';
        Storage.setStudentStatus(state, room.id, currentDate, studentId, isPressed ? '' : statusKey);
        renderAll();
        return;
      }

      const noteToggle = e.target.closest('[data-note-toggle]');
      if (noteToggle) {
        const studentId = noteToggle.getAttribute('data-note-toggle');
        openNoteStudentId = openNoteStudentId === studentId ? null : studentId;
        renderAll();
        if (openNoteStudentId) {
          const input = els.studentList.querySelector(`[data-note-input="${CSS.escape(openNoteStudentId)}"]`);
          if (input) input.focus();
        }
        return;
      }

      const noteSave = e.target.closest('[data-note-save]');
      if (noteSave) {
        const studentId = noteSave.getAttribute('data-note-save');
        const input = els.studentList.querySelector(`[data-note-input="${CSS.escape(studentId)}"]`);
        const room = Storage.getActiveRoom(state);
        Storage.setStudentNote(state, room.id, currentDate, studentId, input ? input.value : '');
        openNoteStudentId = null;
        renderAll();
        announce('บันทึกหมายเหตุเรียบร้อย');
      }
    });

    els.studentList.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.matches('[data-note-input]')) {
        e.preventDefault();
        const studentId = e.target.getAttribute('data-note-input');
        const room = Storage.getActiveRoom(state);
        Storage.setStudentNote(state, room.id, currentDate, studentId, e.target.value);
        openNoteStudentId = null;
        renderAll();
        announce('บันทึกหมายเหตุเรียบร้อย');
      }
    });

    // LINE options & direct share
    els.toggleIncludePresent.addEventListener('change', (e) => {
      state.settings.includePresentInLine = e.target.checked;
      Storage.saveState(state);
      renderAll();
    });

    els.shareLineAppBtn.addEventListener('click', () => {
      const text = els.lineSummaryText.value;
      if (!text) return;
      const lineShareUrl = `https://line.me/R/share?text=${encodeURIComponent(text)}`;
      window.open(lineShareUrl, '_blank', 'noopener,noreferrer');
    });

    // Image Preview Modal triggers
    els.openImagePreviewBtn.addEventListener('click', openImageDialog);
    els.mobileImageBtn.addEventListener('click', openImageDialog);
    els.closeImageBtn.addEventListener('click', () => els.imageDialog.close());

    els.modeSummaryBtn.addEventListener('click', () => {
      if (currentImageMode !== 'summary') {
        currentImageMode = 'summary';
        refreshImagePreview();
      }
    });

    els.modeFullBtn.addEventListener('click', () => {
      if (currentImageMode !== 'full') {
        currentImageMode = 'full';
        refreshImagePreview();
      }
    });

    els.downloadImageBtn.addEventListener('click', downloadCurrentImage);
    els.shareImageBtn.addEventListener('click', shareCurrentImage);

    els.imageDialog.addEventListener('close', () => {
      els.imageDialog.returnValue = '';
    });

    // Manage Modal triggers & tabs
    els.openManageBtn.addEventListener('click', () => openManageDialog('students'));

    els.manageDialog.addEventListener('click', (e) => {
      const tabBtn = e.target.closest('.tab-btn');
      if (tabBtn) {
        switchManageTab(tabBtn.getAttribute('data-tab'));
        return;
      }

      const delStu = e.target.closest('[data-delete-stu]');
      if (delStu) {
        const stuId = delStu.getAttribute('data-delete-stu');
        const room = Storage.getActiveRoom(state);
        room.students = room.students.filter((s) => s.id !== stuId);
        Storage.saveState(state);
        renderManageModalContent();
        renderAll();
        return;
      }

      const switchRoomBtn = e.target.closest('[data-switch-room]');
      if (switchRoomBtn) {
        state.activeRoomId = switchRoomBtn.getAttribute('data-switch-room');
        Storage.saveState(state);
        currentFilter = 'all';
        renderManageModalContent();
        renderAll();
        return;
      }

      const delRoomBtn = e.target.closest('[data-delete-room]');
      if (delRoomBtn && state.rooms.length > 1) {
        const roomId = delRoomBtn.getAttribute('data-delete-room');
        state.rooms = state.rooms.filter((r) => r.id !== roomId);
        delete state.records[roomId];
        if (state.activeRoomId === roomId) {
          state.activeRoomId = state.rooms[0].id;
        }
        Storage.saveState(state);
        renderManageModalContent();
        renderAll();
      }
    });

    // Inline student edits inside manage modal
    els.manageStudentList.addEventListener('change', (e) => {
      const row = e.target.closest('[data-edit-student-id]');
      if (!row) return;
      const stuId = row.getAttribute('data-edit-student-id');
      const room = Storage.getActiveRoom(state);
      const stu = room.students.find((s) => s.id === stuId);
      if (!stu) return;

      const noInput = row.querySelector('.edit-stu-no');
      const nameInput = row.querySelector('.edit-stu-name');
      const genderSel = row.querySelector('.edit-stu-gender');

      const parsedNo = parseInt(noInput.value, 10);
      if (!Number.isNaN(parsedNo) && parsedNo > 0) stu.no = parsedNo;
      if (nameInput.value.trim()) stu.name = nameInput.value.trim();
      stu.gender = genderSel.value;

      Storage.saveState(state);
      renderAll();
    });

    // Add single student
    els.addStudentForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const room = Storage.getActiveRoom(state);
      const no = parseInt(els.newStudentNo.value, 10) || room.students.length + 1;
      const name = els.newStudentName.value.trim();
      if (!name) return;

      const genderChoice = els.newStudentGender.value;
      const gender = genderChoice === 'auto' ? Storage.detectGender(name) : genderChoice;

      room.students.push({
        id: Storage.generateId('stu'),
        no,
        name,
        gender
      });
      Storage.saveState(state);
      els.newStudentName.value = '';
      renderManageModalContent();
      renderAll();
      els.newStudentName.focus();
    });

    // Bulk paste append / replace
    els.bulkAppendBtn.addEventListener('click', () => {
      const parsed = Storage.parseBulkStudentText(els.bulkStudentInput.value);
      if (parsed.length === 0) return;
      const room = Storage.getActiveRoom(state);
      const maxNo = room.students.reduce((m, s) => Math.max(m, s.no), 0);
      parsed.forEach((stu, idx) => {
        stu.no = maxNo + idx + 1;
        room.students.push(stu);
      });
      Storage.saveState(state);
      els.bulkStudentInput.value = '';
      renderManageModalContent();
      renderAll();
      switchManageTab('students');
    });

    els.bulkReplaceBtn.addEventListener('click', () => {
      const parsed = Storage.parseBulkStudentText(els.bulkStudentInput.value);
      if (parsed.length === 0) return;
      const room = Storage.getActiveRoom(state);
      room.students = parsed;
      Storage.saveState(state);
      els.bulkStudentInput.value = '';
      renderManageModalContent();
      renderAll();
      switchManageTab('students');
    });

    // School & active room settings form
    els.schoolSettingsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const room = Storage.getActiveRoom(state);
      state.settings.schoolName = els.settingSchoolName.value.trim();
      state.settings.showGenderSummary = els.settingShowGender.checked;
      if (els.settingRoomName.value.trim()) {
        room.name = els.settingRoomName.value.trim();
      }
      room.teacher = els.settingRoomTeacher.value.trim();
      Storage.saveState(state);
      renderManageModalContent();
      renderAll();
    });

    // Add new classroom
    els.addRoomForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = els.newRoomName.value.trim();
      if (!name) return;
      const newRoom = {
        id: Storage.generateId('room'),
        name,
        teacher: els.newRoomTeacher.value.trim(),
        students: []
      };
      state.rooms.push(newRoom);
      state.activeRoomId = newRoom.id;
      Storage.saveState(state);
      els.newRoomName.value = '';
      els.newRoomTeacher.value = '';
      currentFilter = 'all';
      renderManageModalContent();
      renderAll();
    });

    // Export / Import JSON backup
    els.exportJsonBtn.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance-backup-${ThaiDate.getTodayISO()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });

    els.importJsonInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const imported = JSON.parse(text);
        if (!imported || !Array.isArray(imported.rooms) || imported.rooms.length === 0) {
          throw new Error('รูปแบบไฟล์ไม่ถูกต้อง');
        }
        state = imported;
        if (!state.rooms.some((r) => r.id === state.activeRoomId)) {
          state.activeRoomId = state.rooms[0].id;
        }
        state.records = state.records || {};
        state.settings = Object.assign(
          { schoolName: '', includePresentInLine: false, showGenderSummary: true },
          state.settings || {}
        );
        Storage.saveState(state);
        renderManageModalContent();
        renderAll();
        els.manageDialog.close();
        announce('นำเข้าข้อมูลสำรองเรียบร้อยแล้ว');
      } catch {
        els.manageDialog.close();
        announce('ไฟล์สำรองไม่ถูกต้อง ไม่สามารถนำเข้าได้');
      } finally {
        e.target.value = '';
      }
    });

    els.manageDialog.addEventListener('close', () => {
      els.manageDialog.returnValue = '';
    });

    // History Modal
    els.openHistoryBtn.addEventListener('click', openHistoryDialog);

    els.historyList.addEventListener('click', (e) => {
      const row = e.target.closest('[data-jump-date]');
      if (!row) return;
      currentDate = row.getAttribute('data-jump-date');
      els.historyDialog.close();
      renderAll();
      announce(`เปิดดูข้อมูลวันที่ ${ThaiDate.formatThaiDateShort(currentDate)}`);
    });

    els.historyDialog.addEventListener('close', () => {
      els.historyDialog.returnValue = '';
    });
  }

  /* ---------- Bootstrap ---------- */
  initCopyCommandHandlers();
  initDialogFallbacks();
  bindEvents();
  renderAll();
})(window);
