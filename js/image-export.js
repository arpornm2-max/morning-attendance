(function (global) {
  'use strict';

  const FONT_HEADING = "'Prompt', 'Sarabun', -apple-system, BlinkMacSystemFont, sans-serif";
  const FONT_BODY = "'Sarabun', 'Prompt', -apple-system, BlinkMacSystemFont, sans-serif";

  function drawRoundedRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function truncateText(ctx, text, maxWidth) {
    if (!text) return '';
    if (ctx.measureText(text).width <= maxWidth) return text;
    let out = text;
    while (out.length > 1 && ctx.measureText(out + '…').width > maxWidth) {
      out = out.slice(0, -1);
    }
    return out + '…';
  }

  function wrapLines(ctx, text, maxWidth) {
    if (!text) return [''];
    const words = text.split(' ');
    const lines = [];
    let current = '';

    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width <= maxWidth) {
        current = test;
      } else {
        if (current) lines.push(current);
        if (ctx.measureText(word).width > maxWidth) {
          // Break long Thai string without spaces by characters
          let chunk = '';
          for (const ch of word) {
            if (ctx.measureText(chunk + ch).width > maxWidth && chunk) {
              lines.push(chunk);
              chunk = ch;
            } else {
              chunk += ch;
            }
          }
          current = chunk;
        } else {
          current = word;
        }
      }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [''];
  }

  function formatPercent(count, total) {
    if (!total) return '0%';
    const val = Math.round((count / total) * 1000) / 10;
    return `${Number.isInteger(val) ? val : val.toFixed(1)}%`;
  }

  async function renderSummaryCanvas(options) {
    const {
      schoolName,
      room,
      isoDate,
      summary,
      record,
      mode = 'summary', // 'summary' | 'full'
      showGenderSummary = true
    } = options;

    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch {
        // Ignore font readiness errors and fall back cleanly
      }
    }

    const { STATUSES, STATUS_MAP } = global.AttendanceApp.Storage;
    const { formatThaiDateFull, formatTimeNow } = global.AttendanceApp.ThaiDate;

    const W = 900;
    const PAD = 44;
    const CONTENT_W = W - PAD * 2;
    const SCALE = 2;

    // Pre-calculate dynamic content height using an offscreen measurement context
    const measureCanvas = document.createElement('canvas');
    const mctx = measureCanvas.getContext('2d');

    const HEADER_H = 236;
    const OVERVIEW_H = 148;
    const GRID_GAP = 16;
    const CARD_H = 112;
    const STATS_SECTION_H = CARD_H * 2 + GRID_GAP + 36;

    // Build detail sections
    const detailKeys = ['late', 'absent', 'personal', 'sick', 'activity'];
    const detailGroups = [];

    if (mode === 'summary') {
      for (const key of detailKeys) {
        const items = summary.byStatus[key];
        if (items && items.length > 0) {
          detailGroups.push({
            status: STATUS_MAP[key],
            items
          });
        }
      }
      if (summary.counts.unchecked > 0) {
        detailGroups.push({
          status: {
            key: 'unchecked',
            label: 'ยังไม่เช็คชื่อ',
            color: '#64748b',
            softBg: '#f1f5f9',
            border: '#cbd5e1',
            darkText: '#334155'
          },
          items: summary.byStatus.unchecked
        });
      }
    }

    let detailHeight = 0;
    const preparedGroups = [];
    const ROW_LINE_H = 30;

    if (mode === 'summary') {
      if (detailGroups.length === 0) {
        detailHeight = 130;
      } else {
        mctx.font = `500 20px ${FONT_BODY}`;
        for (const group of detailGroups) {
          const itemLayouts = group.items.map((item) => {
            const label = `เลขที่ ${item.student.no}  ${item.student.name}${item.note ? ` (${item.note})` : ''}`;
            const lines = wrapLines(mctx, label, CONTENT_W - 76);
            return { lines, height: lines.length * ROW_LINE_H + 8 };
          });
          const boxH = 58 + itemLayouts.reduce((acc, it) => acc + it.height, 0) + 18;
          preparedGroups.push({ group, itemLayouts, boxH });
          detailHeight += boxH + 16;
        }
        detailHeight += 36; // section title
      }
    } else {
      // Full student table mode
      const rows = summary.sortedStudents.length;
      const ROW_H = 44;
      detailHeight = 52 + 44 + Math.max(rows, 1) * ROW_H + 24;
    }

    const FOOTER_H = 74;
    const TOTAL_H = HEADER_H + OVERVIEW_H - 22 + 24 + STATS_SECTION_H + 16 + detailHeight + FOOTER_H;

    const canvas = document.createElement('canvas');
    canvas.width = W * SCALE;
    canvas.height = TOTAL_H * SCALE;
    const ctx = canvas.getContext('2d');
    ctx.scale(SCALE, SCALE);

    // 1. Page Background
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, W, TOTAL_H);

    // 2. Header Banner
    const headerGrad = ctx.createLinearGradient(0, 0, W, HEADER_H);
    headerGrad.addColorStop(0, '#0f172a');
    headerGrad.addColorStop(0.55, '#1e3a8a');
    headerGrad.addColorStop(1, '#2563eb');
    ctx.fillStyle = headerGrad;
    ctx.fillRect(0, 0, W, HEADER_H);

    // Subtle decorative sunrise orbs in header
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, HEADER_H);
    ctx.clip();

    const sunGrad = ctx.createRadialGradient(W - 90, 56, 10, W - 90, 56, 150);
    sunGrad.addColorStop(0, 'rgba(251, 191, 36, 0.34)');
    sunGrad.addColorStop(0.55, 'rgba(251, 191, 36, 0.10)');
    sunGrad.addColorStop(1, 'rgba(251, 191, 36, 0)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(W - 90, 56, 150, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.beginPath();
    ctx.arc(W - 40, 200, 110, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    function drawTextCentered(text, centerX, y) {
      ctx.textAlign = 'left';
      const w = ctx.measureText(text).width;
      ctx.fillText(text, centerX - w / 2, y);
    }

    function drawTextRight(text, rightX, y) {
      ctx.textAlign = 'left';
      const w = ctx.measureText(text).width;
      ctx.fillText(text, rightX - w, y);
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // Header badge pill
    const headerPillText = 'สรุปการเช็คชื่อเข้าแถวตอนเช้า';
    ctx.font = `600 17px ${FONT_HEADING}`;
    const headerPillW = Math.max(250, ctx.measureText(headerPillText).width + 40);
    drawRoundedRect(ctx, PAD, 28, headerPillW, 36, 18);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#fef08a';
    drawTextCentered(headerPillText, PAD + headerPillW / 2, 46);

    // Room Pill on Top Right
    const roomBadgeText = `ชั้น ${room.name}`;
    ctx.font = `700 22px ${FONT_HEADING}`;
    const roomBadgeW = Math.max(132, ctx.measureText(roomBadgeText).width + 48);
    const roomBadgeX = W - PAD - roomBadgeW;
    drawRoundedRect(ctx, roomBadgeX, 28, roomBadgeW, 44, 14);
    ctx.fillStyle = '#fbbf24';
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    drawTextCentered(roomBadgeText, roomBadgeX + roomBadgeW / 2, 50);

    // School Name or Class Title
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 32px ${FONT_HEADING}`;
    const headerMainTitle = schoolName ? schoolName : `นักเรียนชั้น ${room.name}`;
    ctx.fillText(
      truncateText(ctx, headerMainTitle, CONTENT_W - roomBadgeW - 24),
      PAD,
      102
    );

    // Date line
    ctx.fillStyle = '#dbeafe';
    ctx.font = `500 22px ${FONT_BODY}`;
    ctx.fillText(formatThaiDateFull(isoDate), PAD, 144);

    // Teacher line
    if (room.teacher) {
      ctx.fillStyle = '#bfdbfe';
      ctx.font = `500 18px ${FONT_BODY}`;
      ctx.fillText(`ครูประจำชั้น: ${truncateText(ctx, room.teacher, CONTENT_W - 110)}`, PAD, 178);
    }

    // 3. Overview Card (overlapping header)
    let cursorY = HEADER_H - 26;
    ctx.save();
    ctx.shadowColor = 'rgba(15, 23, 42, 0.10)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 8;
    drawRoundedRect(ctx, PAD, cursorY, CONTENT_W, OVERVIEW_H, 20);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, PAD, cursorY, CONTENT_W, OVERVIEW_H, 20);
    ctx.stroke();

    // Left stats in overview card
    const ovPadX = PAD + 28;
    ctx.fillStyle = '#64748b';
    ctx.font = `500 16px ${FONT_BODY}`;
    ctx.fillText('นักเรียนทั้งหมดในห้อง', ovPadX, cursorY + 34);

    ctx.fillStyle = '#0f172a';
    ctx.font = `700 34px ${FONT_HEADING}`;
    ctx.fillText(`${summary.total} คน`, ovPadX, cursorY + 72);

    const subStats = [];
    if (showGenderSummary && summary.gender.hasGenderData) {
      subStats.push(`ชาย ${summary.gender.maleTotal}  •  หญิง ${summary.gender.femaleTotal}`);
    }
    subStats.push(`เช็คชื่อแล้ว ${summary.checked}/${summary.total} คน`);
    ctx.fillStyle = '#475569';
    ctx.font = `500 16px ${FONT_BODY}`;
    ctx.fillText(subStats.join('   |   '), ovPadX, cursorY + 104);

    // Multi-segment stacked bar at bottom of left overview area
    const barX = ovPadX;
    const barY = cursorY + 122;
    const barW = CONTENT_W - 220;
    const barH = 12;
    drawRoundedRect(ctx, barX, barY, barW, barH, 6);
    ctx.fillStyle = '#e2e8f0';
    ctx.fill();

    if (summary.total > 0) {
      ctx.save();
      drawRoundedRect(ctx, barX, barY, barW, barH, 6);
      ctx.clip();
      let segX = barX;
      for (const st of STATUSES) {
        const count = summary.counts[st.key];
        if (!count) continue;
        const segW = (count / summary.total) * barW;
        ctx.fillStyle = st.color;
        ctx.fillRect(segX, barY, segW + 0.5, barH);
        segX += segW;
      }
      ctx.restore();
    }

    // Donut Ring on Right of Overview Card (Present + Late + Activity = On-Campus Attendance)
    const ringCX = W - PAD - 88;
    const ringCY = cursorY + OVERVIEW_H / 2;
    const ringR = 48;
    const pct = summary.total > 0 ? summary.onCampusCount / summary.total : 0;

    ctx.beginPath();
    ctx.arc(ringCX, ringCY, ringR, 0, Math.PI * 2);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 11;
    ctx.stroke();

    if (pct > 0) {
      ctx.beginPath();
      ctx.arc(ringCX, ringCY, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
      ctx.strokeStyle = pct >= 0.9 ? '#10b981' : pct >= 0.75 ? '#3b82f6' : '#f59e0b';
      ctx.lineWidth = 11;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    ctx.fillStyle = '#0f172a';
    ctx.font = `700 21px ${FONT_HEADING}`;
    drawTextCentered(formatPercent(summary.onCampusCount, summary.total), ringCX, ringCY - 5);
    ctx.fillStyle = '#64748b';
    ctx.font = `500 13px ${FONT_BODY}`;
    drawTextCentered('มาโรงเรียน', ringCX, ringCY + 17);

    cursorY += OVERVIEW_H + 28;

    // 4. Status Breakdown 3x2 Grid
    ctx.fillStyle = '#1e293b';
    ctx.font = `700 20px ${FONT_HEADING}`;
    ctx.fillText('สรุปจำนวนตามสถานะ', PAD, cursorY + 10);
    cursorY += 32;

    const CARD_W = (CONTENT_W - GRID_GAP * 2) / 3;

    STATUSES.forEach((st, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const x = PAD + col * (CARD_W + GRID_GAP);
      const y = cursorY + row * (CARD_H + GRID_GAP);
      const count = summary.counts[st.key];

      drawRoundedRect(ctx, x, y, CARD_W, CARD_H, 16);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = count > 0 ? st.border : '#e2e8f0';
      ctx.lineWidth = count > 0 ? 1.5 : 1;
      ctx.stroke();

      // Left color indicator bar
      drawRoundedRect(ctx, x + 12, y + 16, 6, CARD_H - 32, 3);
      ctx.fillStyle = st.color;
      ctx.fill();

      // Status pill label
      ctx.fillStyle = st.darkText;
      ctx.font = `600 18px ${FONT_HEADING}`;
      ctx.fillText(st.label, x + 30, y + 32);

      // Count number
      ctx.fillStyle = count > 0 ? '#0f172a' : '#94a3b8';
      ctx.font = `700 34px ${FONT_HEADING}`;
      ctx.fillText(`${count}`, x + 30, y + 76);

      const numW = ctx.measureText(`${count}`).width;
      ctx.fillStyle = '#64748b';
      ctx.font = `500 16px ${FONT_BODY}`;
      ctx.fillText('คน', x + 30 + numW + 8, y + 81);

      // Percentage badge on right
      const pctStr = formatPercent(count, summary.total);
      ctx.font = `600 15px ${FONT_HEADING}`;
      const badgeW = ctx.measureText(pctStr).width + 20;
      const badgeX = x + CARD_W - badgeW - 14;
      drawRoundedRect(ctx, badgeX, y + 18, badgeW, 28, 14);
      ctx.fillStyle = count > 0 ? st.softBg : '#f8fafc';
      ctx.fill();
      ctx.fillStyle = count > 0 ? st.darkText : '#94a3b8';
      drawTextCentered(pctStr, badgeX + badgeW / 2, y + 32);
    });

    cursorY += CARD_H * 2 + GRID_GAP + 28;

    // 5. Detail Section (Summary of non-present OR Full Table)
    if (mode === 'summary') {
      if (preparedGroups.length === 0) {
        drawRoundedRect(ctx, PAD, cursorY, CONTENT_W, 110, 18);
        ctx.fillStyle = '#ecfdf5';
        ctx.fill();
        ctx.strokeStyle = '#6ee7b7';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#065f46';
        ctx.font = `700 24px ${FONT_HEADING}`;
        drawTextCentered('นักเรียนมาเรียนครบทุกคน (100%)', W / 2, cursorY + 44);
        ctx.fillStyle = '#047857';
        ctx.font = `500 18px ${FONT_BODY}`;
        drawTextCentered('ไม่มีนักเรียนมาสาย ขาดเรียน ลา หรือติดกิจกรรมในวันนี้', W / 2, cursorY + 78);
        cursorY += 130;
      } else {
        ctx.fillStyle = '#1e293b';
        ctx.font = `700 20px ${FONT_HEADING}`;
        ctx.fillText('รายชื่อนักเรียนที่ไม่ได้เข้าแถวตามปกติ / มาสาย / กิจกรรม', PAD, cursorY + 10);
        cursorY += 36;

        for (const pg of preparedGroups) {
          const { group, itemLayouts, boxH } = pg;
          const st = group.status;

          drawRoundedRect(ctx, PAD, cursorY, CONTENT_W, boxH, 16);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.strokeStyle = st.border;
          ctx.lineWidth = 1.25;
          ctx.stroke();

          // Group Header bar
          drawRoundedRect(ctx, PAD + 14, cursorY + 12, CONTENT_W - 28, 36, 10);
          ctx.fillStyle = st.softBg;
          ctx.fill();

          ctx.fillStyle = st.color;
          ctx.beginPath();
          ctx.arc(PAD + 32, cursorY + 30, 6, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = st.darkText;
          ctx.font = `700 18px ${FONT_HEADING}`;
          ctx.fillText(`${st.label} (${group.items.length} คน)`, PAD + 48, cursorY + 31);

          // Student lines
          let lineY = cursorY + 66;
          ctx.fillStyle = '#1e293b';
          ctx.font = `500 20px ${FONT_BODY}`;

          for (const layout of itemLayouts) {
            for (let li = 0; li < layout.lines.length; li++) {
              ctx.fillText(layout.lines[li], PAD + 34, lineY);
              lineY += ROW_LINE_H;
            }
            lineY += 8;
          }

          cursorY += boxH + 16;
        }
      }
    } else {
      // Full Student List Table Mode
      ctx.fillStyle = '#1e293b';
      ctx.font = `700 20px ${FONT_HEADING}`;
      ctx.fillText(`รายชื่อนักเรียนทั้งหมด (${summary.total} คน)`, PAD, cursorY + 10);
      cursorY += 36;

      const ROW_H = 44;
      const tableH = 44 + Math.max(summary.sortedStudents.length, 1) * ROW_H;

      drawRoundedRect(ctx, PAD, cursorY, CONTENT_W, tableH, 16);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Table Header
      ctx.save();
      drawRoundedRect(ctx, PAD, cursorY, CONTENT_W, tableH, 16);
      ctx.clip();

      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(PAD, cursorY, CONTENT_W, 44);
      ctx.strokeStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.moveTo(PAD, cursorY + 44);
      ctx.lineTo(PAD + CONTENT_W, cursorY + 44);
      ctx.stroke();

      ctx.fillStyle = '#475569';
      ctx.font = `600 16px ${FONT_HEADING}`;
      ctx.fillText('เลขที่', PAD + 20, cursorY + 23);
      ctx.fillText('ชื่อ-นามสกุล', PAD + 92, cursorY + 23);
      ctx.fillText('สถานะ', PAD + CONTENT_W - 280, cursorY + 23);
      ctx.fillText('หมายเหตุ', PAD + CONTENT_W - 150, cursorY + 23);

      const entries = (record && record.entries) || {};
      let rowY = cursorY + 44;

      summary.sortedStudents.forEach((stu, idx) => {
        if (idx % 2 === 1) {
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(PAD, rowY, CONTENT_W, ROW_H);
        }

        const entry = entries[stu.id] || { status: '', note: '' };
        const stObj = STATUS_MAP[entry.status];

        ctx.fillStyle = '#475569';
        ctx.font = `600 17px ${FONT_HEADING}`;
        ctx.fillText(String(stu.no), PAD + 28, rowY + ROW_H / 2);

        ctx.fillStyle = '#0f172a';
        ctx.font = `500 18px ${FONT_BODY}`;
        ctx.fillText(truncateText(ctx, stu.name, CONTENT_W - 390), PAD + 92, rowY + ROW_H / 2);

        // Status pill
        const badgeX = PAD + CONTENT_W - 286;
        const badgeW = 112;
        drawRoundedRect(ctx, badgeX, rowY + 8, badgeW, 28, 14);
        ctx.fillStyle = stObj ? stObj.softBg : '#f1f5f9';
        ctx.fill();
        ctx.strokeStyle = stObj ? stObj.border : '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = stObj ? stObj.darkText : '#64748b';
        ctx.font = `600 15px ${FONT_HEADING}`;
        drawTextCentered(stObj ? stObj.label : 'ยังไม่เช็ค', badgeX + badgeW / 2, rowY + 22);

        // Note
        if (entry.note) {
          ctx.fillStyle = '#64748b';
          ctx.font = `400 15px ${FONT_BODY}`;
          ctx.fillText(truncateText(ctx, entry.note, 136), PAD + CONTENT_W - 150, rowY + ROW_H / 2);
        }

        rowY += ROW_H;
      });

      ctx.restore();
      cursorY += tableH + 20;
    }

    // 6. Footer
    const footerY = TOTAL_H - FOOTER_H;
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, footerY + 14);
    ctx.lineTo(W - PAD, footerY + 14);
    ctx.stroke();

    const updatedTime = record && record.updatedAt ? formatTimeNow(new Date(record.updatedAt)) : formatTimeNow();
    ctx.fillStyle = '#64748b';
    ctx.font = `500 15px ${FONT_BODY}`;
    ctx.fillText(`บันทึกข้อมูลเมื่อ ${updatedTime}`, PAD, footerY + 44);

    ctx.fillStyle = '#94a3b8';
    ctx.font = `500 15px ${FONT_HEADING}`;
    drawTextRight('ระบบเช็คชื่อนักเรียนเข้าแถวตอนเช้า', W - PAD, footerY + 44);

    return canvas;
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
      if (canvas.toBlob) {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('สร้างไฟล์รูปภาพไม่สำเร็จ'));
        }, 'image/png');
      } else {
        try {
          const dataUrl = canvas.toDataURL('image/png');
          const bin = atob(dataUrl.split(',')[1]);
          const arr = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
          resolve(new Blob([arr], { type: 'image/png' }));
        } catch (err) {
          reject(err);
        }
      }
    });
  }

  global.AttendanceApp = global.AttendanceApp || {};
  global.AttendanceApp.ImageExport = {
    renderSummaryCanvas,
    canvasToBlob
  };
})(window);
