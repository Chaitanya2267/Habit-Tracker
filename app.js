/* =========================================================
   LEDGER — PRODUCTIVITY DASHBOARD
   Single script file, organized into clearly marked sections:
     1. Storage / state
     2. Date helpers
     3. Monthly tracker (existing functionality, unchanged)
     4. Today donut + monthly trend + ranking (existing)
     5. Analytics: streaks, completion %, productivity score
     6. Heatmap (year view)
     7. Dashboard summary cards
     8. Wiring / init
   ========================================================= */

(function () {

    /* =========================================================
       1. STORAGE / STATE
       ========================================================= */
    const STORAGE_KEY = 'ledger-habit-tracker-v1'; // unchanged — preserves existing user data

    let state = loadState();

    let viewYear = state.currentYear ?? new Date().getFullYear();
    let viewMonth = state.currentMonth ?? new Date().getMonth(); // 0-indexed
    let heatmapYear = viewYear; // separate nav state for the yearly heatmap

    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) { }
        return {
            habits: [
                { id: cryptoId(), name: 'Wake up early', emoji: '⏰' },
                { id: cryptoId(), name: 'Read / Learn', emoji: '📖' },
                { id: cryptoId(), name: 'Exercise', emoji: '💪' }
            ],
            // checks[habitId]["YYYY-M-D"] = true
            checks: {}
        };
    }

    function saveState() {
        state.currentYear = viewYear;
        state.currentMonth = viewMonth;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function cryptoId() {
        return 'h_' + Math.random().toString(36).slice(2, 10);
    }

    /* =========================================================
       2. DATE HELPERS
       ========================================================= */
    const DAY_LETTERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    function daysInMonth(y, m) {
        return new Date(y, m + 1, 0).getDate(); // handles leap years & varying month lengths automatically
    }

    function isLeapYear(y) {
        return (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
    }

    function dateKey(y, m, d) {
        return `${y}-${m}-${d}`;
    }

    function isToday(y, m, d) {
        const t = new Date();
        return t.getFullYear() === y && t.getMonth() === m && t.getDate() === d;
    }

    // Completion % for a given y/m/d, based on all habits that exist now.
    // Habits with zero checks ever are still counted as part of the denominator,
    // since "not done" is meaningful information for a day.
    function completionForDate(y, m, d) {
        const total = state.habits.length;
        if (total === 0) return null; // no habits = no data, not 0%
        const key = dateKey(y, m, d);
        let done = 0;
        state.habits.forEach(h => {
            if (state.checks[h.id] && state.checks[h.id][key]) done++;
        });
        return { done, total, pct: done / total };
    }

    /* =========================================================
       3. MONTHLY TRACKER (existing functionality, unchanged)
       ========================================================= */
    const monthLabel = document.getElementById('monthLabel');
    const headRow = document.getElementById('headRow');
    const bodyRows = document.getElementById('bodyRows');
    const pctRow = document.getElementById('pctRow');
    const emptyState = document.getElementById('emptyState');
    const habitTable = document.getElementById('habitTable');

    function render() {
        const numDays = daysInMonth(viewYear, viewMonth);
        const monthName = new Date(viewYear, viewMonth, 1).toLocaleString('default', { month: 'long' });
        monthLabel.textContent = `${monthName} ${viewYear}`;

        // ---- header row ----
        headRow.innerHTML = '<th class="habit-col">My Habits</th>';
        for (let d = 1; d <= numDays; d++) {
            const dow = new Date(viewYear, viewMonth, d).getDay();
            const isWeekend = dow === 0 || dow === 6;
            const th = document.createElement('th');
            th.className = isWeekend ? 'weekend' : '';
            th.innerHTML = `${DAY_LETTERS[dow]}<br>${d}`;
            headRow.appendChild(th);
        }

        // ---- body rows ----
        bodyRows.innerHTML = '';
        if (state.habits.length === 0) {
            emptyState.style.display = 'block';
            habitTable.style.display = 'none';
        } else {
            emptyState.style.display = 'none';
            habitTable.style.display = 'table';
        }

        state.habits.forEach(habit => {
            const tr = document.createElement('tr');

            const nameTd = document.createElement('td');
            nameTd.className = 'habit-name-cell';
            nameTd.innerHTML = `<span class="emoji">${habit.emoji}</span>${escapeHtml(habit.name)}<button class="del" title="Delete habit" data-id="${habit.id}">✕</button>`;
            tr.appendChild(nameTd);

            for (let d = 1; d <= numDays; d++) {
                const td = document.createElement('td');
                const key = dateKey(viewYear, viewMonth, d);
                const checked = !!(state.checks[habit.id] && state.checks[habit.id][key]);
                const today = isToday(viewYear, viewMonth, d);
                const box = document.createElement('div');
                box.className = 'chk' + (checked ? ' done' : '') + (today ? ' today-marker' : '');
                box.dataset.habitId = habit.id;
                box.dataset.day = d;
                td.appendChild(box);
                tr.appendChild(td);
            }
            bodyRows.appendChild(tr);
        });

        // ---- footer progress row ----
        pctRow.innerHTML = '<td class="label-cell">Progress</td>';
        for (let d = 1; d <= numDays; d++) {
            const c = completionForDate(viewYear, viewMonth, d);
            const td = document.createElement('td');
            td.textContent = c ? Math.round(c.pct * 100) + '%' : '—';
            pctRow.appendChild(td);
        }

        attachCheckboxHandlers();
        attachDeleteHandlers();
        renderTodayDonut();
        renderTrend();
        renderRanking();
        renderDashboardCards();
        renderHeatmap();
        saveState();
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function attachCheckboxHandlers() {
        document.querySelectorAll('.chk').forEach(box => {
            box.addEventListener('click', () => {
                const habitId = box.dataset.habitId;
                const day = parseInt(box.dataset.day, 10);
                const key = dateKey(viewYear, viewMonth, day);
                if (!state.checks[habitId]) state.checks[habitId] = {};
                state.checks[habitId][key] = !state.checks[habitId][key];
                render();
            });
        });
    }

    function attachDeleteHandlers() {
        document.querySelectorAll('.del').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const habit = state.habits.find(h => h.id === id);
                if (habit && confirm(`Delete habit "${habit.name}"? This removes all its recorded check marks.`)) {
                    state.habits = state.habits.filter(h => h.id !== id);
                    delete state.checks[id];
                    render();
                }
            });
        });
    }

    /* =========================================================
       4. TODAY DONUT + MONTHLY TREND + RANKING (existing)
       ========================================================= */
    function renderTodayDonut() {
        const svg = document.getElementById('donutSvg');
        svg.innerHTML = '';
        const today = new Date();
        let day = null;
        if (today.getFullYear() === viewYear && today.getMonth() === viewMonth) {
            day = today.getDate();
        } else {
            day = daysInMonth(viewYear, viewMonth); // fallback: last day of viewed month
        }
        const c = completionForDate(viewYear, viewMonth, day);
        const total = state.habits.length;
        const pct = c ? c.pct : 0;

        document.getElementById('todayPct').textContent = c ? Math.round(pct * 100) + '%' : '—';
        document.getElementById('todayDone').textContent = c ? c.done : 0;
        document.getElementById('todayLeft').textContent = c ? c.total - c.done : 0;

        const cx = 60, cy = 60, r = 46, stroke = 16;
        const circumference = 2 * Math.PI * r;

        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        bg.setAttribute('cx', cx); bg.setAttribute('cy', cy); bg.setAttribute('r', r);
        bg.setAttribute('fill', 'none');
        bg.setAttribute('stroke', 'var(--paper-line)');
        bg.setAttribute('stroke-width', stroke);
        svg.appendChild(bg);

        const fg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        fg.setAttribute('cx', cx); fg.setAttribute('cy', cy); fg.setAttribute('r', r);
        fg.setAttribute('fill', 'none');
        fg.setAttribute('stroke', 'var(--moss)');
        fg.setAttribute('stroke-width', stroke);
        fg.setAttribute('stroke-dasharray', `${circumference * pct} ${circumference}`);
        fg.setAttribute('stroke-dashoffset', circumference * 0.25);
        fg.setAttribute('transform', `rotate(-90 ${cx} ${cy})`);
        fg.setAttribute('stroke-linecap', 'round');
        svg.appendChild(fg);

        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', cx); label.setAttribute('y', cy + 5);
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('font-size', '18');
        label.setAttribute('font-family', 'Georgia, serif');
        label.setAttribute('font-weight', '700');
        label.setAttribute('fill', 'var(--ink)');
        label.textContent = total ? Math.round(pct * 100) + '%' : '—';
        svg.appendChild(label);
    }

    function renderTrend() {
        const svg = document.getElementById('trendSvg');
        svg.innerHTML = '';
        const numDays = daysInMonth(viewYear, viewMonth);
        const total = state.habits.length;
        const W = 600, H = 120, padX = 10, padY = 16;

        const points = [];
        let sum = 0;
        for (let d = 1; d <= numDays; d++) {
            const c = completionForDate(viewYear, viewMonth, d);
            const pct = c ? c.pct : 0;
            sum += pct;
            const x = padX + ((d - 1) / Math.max(numDays - 1, 1)) * (W - padX * 2);
            const y = (H - padY) - pct * (H - padY * 2);
            points.push([x, y]);
        }

        document.getElementById('trendStart').textContent = '1';
        document.getElementById('trendEnd').textContent = numDays;
        document.getElementById('trendAvg').textContent = `avg ${total ? Math.round((sum / numDays) * 100) : 0}%`;

        const grid = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        grid.setAttribute('x1', padX); grid.setAttribute('x2', W - padX);
        grid.setAttribute('y1', H / 2); grid.setAttribute('y2', H / 2);
        grid.setAttribute('stroke', 'var(--paper-line)');
        grid.setAttribute('stroke-dasharray', '3,3');
        svg.appendChild(grid);

        let areaPath = `M ${points[0][0]} ${H - padY} `;
        points.forEach(p => areaPath += `L ${p[0]} ${p[1]} `);
        areaPath += `L ${points[points.length - 1][0]} ${H - padY} Z`;
        const area = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        area.setAttribute('d', areaPath);
        area.setAttribute('fill', 'var(--moss-light)');
        area.setAttribute('opacity', '0.35');
        svg.appendChild(area);

        let linePath = `M ${points[0][0]} ${points[0][1]} `;
        points.forEach(p => linePath += `L ${p[0]} ${p[1]} `);
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        line.setAttribute('d', linePath);
        line.setAttribute('fill', 'none');
        line.setAttribute('stroke', 'var(--moss)');
        line.setAttribute('stroke-width', '2.5');
        svg.appendChild(line);

        const today = new Date();
        if (today.getFullYear() === viewYear && today.getMonth() === viewMonth) {
            const idx = today.getDate() - 1;
            const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            dot.setAttribute('cx', points[idx][0]);
            dot.setAttribute('cy', points[idx][1]);
            dot.setAttribute('r', 4);
            dot.setAttribute('fill', 'var(--rust)');
            svg.appendChild(dot);
        }
    }

    function renderRanking() {
        const list = document.getElementById('rankList');
        list.innerHTML = '';
        const numDays = daysInMonth(viewYear, viewMonth);
        if (state.habits.length === 0) {
            list.innerHTML = '<li style="border-bottom:none;color:var(--ink-soft);">No habits yet</li>';
            return;
        }
        const ranked = state.habits.map(h => {
            let done = 0;
            for (let d = 1; d <= numDays; d++) {
                const key = dateKey(viewYear, viewMonth, d);
                if (state.checks[h.id] && state.checks[h.id][key]) done++;
            }
            return { h, pct: Math.round((done / numDays) * 100) };
        }).sort((a, b) => b.pct - a.pct);

        ranked.forEach(r => {
            const li = document.createElement('li');
            li.innerHTML = `
        <span class="rank-name">${r.h.emoji} ${escapeHtml(r.h.name)}</span>
        <span class="bar-bg"><span class="bar-fill" style="width:${r.pct}%"></span></span>
        <span class="rank-pct">${r.pct}%</span>
      `;
            list.appendChild(li);
        });
    }

    /* =========================================================
       5. ANALYTICS: streaks, completion %, productivity score
       ========================================================= */

    // A day "counts" toward a streak if completion that day is 100%
    // (all habits done) — the strictest, least ambiguous definition.
    // Days before the user's first-ever check, or with zero habits, are skipped
    // rather than treated as failures, so streaks aren't punished by account age.
    function getEarliestCheckedDate() {
        let earliest = null;
        Object.values(state.checks).forEach(habitChecks => {
            Object.keys(habitChecks).forEach(key => {
                if (!habitChecks[key]) return;
                const [y, m, d] = key.split('-').map(Number);
                const dt = new Date(y, m, d);
                if (!earliest || dt < earliest) earliest = dt;
            });
        });
        return earliest;
    }

    function dayFullyDone(d) {
        const c = completionForDate(d.getFullYear(), d.getMonth(), d.getDate());
        return !!(c && c.done === c.total && c.total > 0);
    }

    function computeStreaks() {
        const total = state.habits.length;
        if (total === 0) return { current: 0, longest: 0 };

        const earliest = getEarliestCheckedDate();
        if (!earliest) return { current: 0, longest: 0 };

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let cursor = new Date(earliest);
        cursor.setHours(0, 0, 0, 0);

        let longest = 0, running = 0;

        while (cursor <= today) {
            if (dayFullyDone(cursor)) {
                running++;
                if (running > longest) longest = running;
            } else {
                running = 0;
            }
            cursor.setDate(cursor.getDate() + 1);
        }

        // current streak = run ending today (or yesterday, so a not-yet-checked
        // "today" doesn't zero out an otherwise live streak)
        let current = 0;
        let probe = new Date(today);
        if (!dayFullyDone(probe)) {
            probe.setDate(probe.getDate() - 1);
        }
        while (probe >= earliest && dayFullyDone(probe)) {
            current++;
            probe.setDate(probe.getDate() - 1);
        }

        return { current, longest };
    }

    function completionForRange(startDate, endDate) {
        const total = state.habits.length;
        if (total === 0) return null;
        let sum = 0, count = 0;
        let cursor = new Date(startDate);
        while (cursor <= endDate) {
            const c = completionForDate(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
            if (c) { sum += c.pct; count++; }
            cursor.setDate(cursor.getDate() + 1);
        }
        return count ? sum / count : null;
    }

    function currentMonthCompletion() {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return completionForRange(start, end);
    }

    function currentYearCompletion() {
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return completionForRange(start, end);
    }

    // Productivity score (0-100), combining:
    //  - habit completion this month   (40%)
    //  - consistency: % of tracked days with full completion this month (30%)
    //  - streak strength: current streak relative to a 14-day reference (30%)
    function computeProductivityScore() {
        if (state.habits.length === 0) return null;

        const monthPct = currentMonthCompletion() || 0;

        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        let fullDays = 0, trackedDays = 0;
        let cursor = new Date(start);
        while (cursor <= now) {
            const c = completionForDate(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
            if (c) {
                trackedDays++;
                if (c.done === c.total) fullDays++;
            }
            cursor.setDate(cursor.getDate() + 1);
        }
        const consistency = trackedDays ? fullDays / trackedDays : 0;

        const { current } = computeStreaks();
        const streakStrength = Math.min(current / 14, 1); // caps out at a 2-week streak

        const score = (monthPct * 0.4 + consistency * 0.3 + streakStrength * 0.3) * 100;
        return Math.round(score);
    }

    function scoreLabel(score) {
        if (score === null) return '';
        if (score >= 85) return 'Excellent momentum';
        if (score >= 65) return 'Solid progress';
        if (score >= 40) return 'Building consistency';
        return 'Just getting started';
    }

    /* =========================================================
       6. HEATMAP (year view)
       ========================================================= */
    const heatmapInner = document.getElementById('heatmapInner');
    const heatmapYearLabel = document.getElementById('heatmapYearLabel');
    const heatmapStatsEl = document.getElementById('heatmapStats');
    const heatmapTooltip = document.getElementById('heatmapTooltip');

    function levelForPct(pct) {
        if (pct === null) return 0;
        if (pct <= 0) return 0;
        if (pct <= 0.25) return 1;
        if (pct <= 0.50) return 2;
        if (pct <= 0.75) return 3;
        return 4;
    }

    function renderHeatmap() {
        heatmapYearLabel.textContent = heatmapYear;
        heatmapInner.innerHTML = '';

        const jan1 = new Date(heatmapYear, 0, 1);
        const startDow = jan1.getDay(); // 0=Sun

        // Build a flat list of cells: leading blanks to align Jan 1 into its weekday row,
        // then every real day of the year — handles leap years automatically since
        // totalDays comes from isLeapYear, and Date() rolls over month boundaries correctly.
        const cells = [];
        for (let i = 0; i < startDow; i++) {
            cells.push({ blank: true });
        }
        const totalDays = isLeapYear(heatmapYear) ? 366 : 365;
        for (let i = 0; i < totalDays; i++) {
            const d = new Date(heatmapYear, 0, 1 + i);
            cells.push({ date: d });
        }

        const numCols = Math.ceil(cells.length / 7);

        // ---- month label row ----
        const monthsRow = document.createElement('div');
        monthsRow.className = 'heatmap-months-row';
        monthsRow.style.gridTemplateColumns = `repeat(${numCols}, 16px)`;
        let lastMonthShown = -1;
        for (let col = 0; col < numCols; col++) {
            const cellIdx = col * 7;
            const cell = cells[cellIdx];
            const span = document.createElement('span');
            if (cell && cell.date && cell.date.getMonth() !== lastMonthShown && cell.date.getDate() <= 7) {
                span.textContent = MONTH_NAMES[cell.date.getMonth()];
                lastMonthShown = cell.date.getMonth();
            }
            monthsRow.appendChild(span);
        }
        heatmapInner.appendChild(monthsRow);

        // ---- body: day labels + grid ----
        const body = document.createElement('div');
        body.className = 'heatmap-body';

        const dayLabels = document.createElement('div');
        dayLabels.className = 'heatmap-daylabels';
        ['Sun', '', 'Tue', '', 'Thu', '', 'Sat'].forEach(lbl => {
            const s = document.createElement('span');
            s.textContent = lbl;
            dayLabels.appendChild(s);
        });
        body.appendChild(dayLabels);

        const grid = document.createElement('div');
        grid.className = 'heatmap-grid';
        grid.style.gridTemplateColumns = `repeat(${numCols}, 13px)`;

        const today = new Date(); today.setHours(0, 0, 0, 0);

        cells.forEach(cell => {
            const div = document.createElement('div');
            if (cell.blank) {
                div.className = 'heat-cell is-future';
                grid.appendChild(div);
                return;
            }
            const d = cell.date;
            const isFuture = d > today;
            const c = isFuture ? null : completionForDate(d.getFullYear(), d.getMonth(), d.getDate());
            const level = isFuture ? 0 : levelForPct(c ? c.pct : null);

            div.className = 'heat-cell' + (isFuture ? ' is-future' : ` level-${level}`);
            if (!isFuture && d.getTime() === today.getTime()) div.classList.add('is-today');

            if (!isFuture) {
                div.dataset.date = d.toDateString();
                div.dataset.pct = c ? Math.round(c.pct * 100) : 0;
                div.dataset.done = c ? c.done : 0;
                div.dataset.missed = c ? (c.total - c.done) : 0;
                div.dataset.hasData = c ? '1' : '0';

                div.addEventListener('mouseenter', showHeatmapTooltip);
                div.addEventListener('mousemove', moveHeatmapTooltip);
                div.addEventListener('mouseleave', hideHeatmapTooltip);
            }
            grid.appendChild(div);
        });

        body.appendChild(grid);
        heatmapInner.appendChild(body);

        renderHeatmapStats();
    }

    function showHeatmapTooltip(e) {
        const el = e.currentTarget;
        const hasData = el.dataset.hasData === '1';
        heatmapTooltip.innerHTML = hasData
            ? `<strong>${el.dataset.date}</strong><br>Completion: ${el.dataset.pct}%<br>Completed: ${el.dataset.done} \u00b7 Missed: ${el.dataset.missed}`
            : `<strong>${el.dataset.date}</strong><br>No habits tracked`;
        heatmapTooltip.style.display = 'block';
        moveHeatmapTooltip(e);
    }
    function moveHeatmapTooltip(e) {
        heatmapTooltip.style.left = (e.clientX + 14) + 'px';
        heatmapTooltip.style.top = (e.clientY + 14) + 'px';
    }
    function hideHeatmapTooltip() {
        heatmapTooltip.style.display = 'none';
    }

    function renderHeatmapStats() {
        const { current, longest } = computeStreaks();

        const now = new Date();
        const isCurrentYear = heatmapYear === now.getFullYear();

        const monthPct = isCurrentYear ? currentMonthCompletion() : null;
        const yearPct = isCurrentYear
            ? currentYearCompletion()
            : completionForRange(new Date(heatmapYear, 0, 1), new Date(heatmapYear, 11, 31));

        // most/least productive day-of-week, and best month, across the displayed year
        const dowSums = [0, 0, 0, 0, 0, 0, 0];
        const dowCounts = [0, 0, 0, 0, 0, 0, 0];
        const monthSums = new Array(12).fill(0);
        const monthCounts = new Array(12).fill(0);

        const rangeEnd = isCurrentYear ? now : new Date(heatmapYear, 11, 31);
        let cursor = new Date(heatmapYear, 0, 1);
        while (cursor <= rangeEnd) {
            const c = completionForDate(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
            if (c) {
                const dow = cursor.getDay();
                dowSums[dow] += c.pct; dowCounts[dow]++;
                monthSums[cursor.getMonth()] += c.pct; monthCounts[cursor.getMonth()]++;
            }
            cursor.setDate(cursor.getDate() + 1);
        }

        const dowAvg = dowSums.map((s, i) => dowCounts[i] ? s / dowCounts[i] : null);
        let bestDowIdx = -1, worstDowIdx = -1;
        dowAvg.forEach((v, i) => {
            if (v === null) return;
            if (bestDowIdx === -1 || v > dowAvg[bestDowIdx]) bestDowIdx = i;
            if (worstDowIdx === -1 || v < dowAvg[worstDowIdx]) worstDowIdx = i;
        });
        const dowNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        const monthAvg = monthSums.map((s, i) => monthCounts[i] ? s / monthCounts[i] : null);
        let bestMonthIdx = -1;
        monthAvg.forEach((v, i) => {
            if (v === null) return;
            if (bestMonthIdx === -1 || v > monthAvg[bestMonthIdx]) bestMonthIdx = i;
        });

        const stats = [
            { k: 'Current streak', v: `${current}d` },
            { k: 'Longest streak', v: `${longest}d` },
            { k: 'Month completion', v: monthPct !== null ? Math.round(monthPct * 100) + '%' : '—' },
            { k: 'Year completion', v: yearPct !== null ? Math.round(yearPct * 100) + '%' : '—' },
            { k: 'Best day', v: bestDowIdx >= 0 ? dowNames[bestDowIdx] : '—' },
            { k: 'Toughest day', v: worstDowIdx >= 0 ? dowNames[worstDowIdx] : '—' },
            { k: 'Best month', v: bestMonthIdx >= 0 ? new Date(heatmapYear, bestMonthIdx, 1).toLocaleString('default', { month: 'long' }) : '—' },
        ];

        heatmapStatsEl.innerHTML = stats.map(s => `
      <div class="stat"><span class="k">${s.k}</span><span class="v">${s.v}</span></div>
    `).join('');
    }

    /* =========================================================
       7. DASHBOARD SUMMARY CARDS
       ========================================================= */
    function renderDashboardCards() {
        const { current, longest } = computeStreaks();
        const now = new Date();
        const today = completionForDate(now.getFullYear(), now.getMonth(), now.getDate());
        const monthPct = currentMonthCompletion();
        const yearPct = currentYearCompletion();
        const score = computeProductivityScore();

        document.getElementById('scoreValue').textContent = score !== null ? `${score} / 100` : '—';
        document.getElementById('scoreSub').textContent = scoreLabel(score);
        document.getElementById('cardToday').textContent = today ? Math.round(today.pct * 100) + '%' : '—';
        document.getElementById('cardStreak').innerHTML = `${current}<span class="unit">d</span>`;
        document.getElementById('cardLongest').innerHTML = `${longest}<span class="unit">d</span>`;
        document.getElementById('cardMonth').textContent = monthPct !== null ? Math.round(monthPct * 100) + '%' : '—';
        document.getElementById('cardYear').textContent = yearPct !== null ? Math.round(yearPct * 100) + '%' : '—';
    }

    /* =========================================================
       8. WIRING / INIT
       ========================================================= */
    document.getElementById('addHabitBtn').addEventListener('click', addHabit);
    document.getElementById('newHabitInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addHabit();
    });

    function addHabit() {
        const input = document.getElementById('newHabitInput');
        const name = input.value.trim();
        if (!name) return;
        const emoji = document.getElementById('emojiPick').value;
        state.habits.push({ id: cryptoId(), name, emoji });
        input.value = '';
        render();
    }

    document.getElementById('prevMonth').addEventListener('click', () => {
        viewMonth--;
        if (viewMonth < 0) { viewMonth = 11; viewYear--; }
        render();
    });
    document.getElementById('nextMonth').addEventListener('click', () => {
        viewMonth++;
        if (viewMonth > 11) { viewMonth = 0; viewYear++; }
        render();
    });

    document.getElementById('prevYear').addEventListener('click', () => {
        heatmapYear--;
        renderHeatmap();
    });
    document.getElementById('nextYear').addEventListener('click', () => {
        heatmapYear++;
        renderHeatmap();
    });

    render();
})();