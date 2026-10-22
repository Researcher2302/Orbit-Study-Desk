/* ============================================================
   ORBIT — IAT 2027 RESEARCH DESK
   JavaScript — Rose Nebula edition

   Designed for CodePen's separate HTML, CSS and JS panels.
   Uses existing ORBIT storage keys and familiar HTML IDs.
   ============================================================ */

(() => {
  "use strict";

  /* ==========================================================
     1. CONFIGURATION
     ========================================================== */

  const STORE = {
    data: "orbit-study-data-v2",
    exam: "orbit-exam-date-v2",
    favourites: "orbit-favourites-v2"
  };

  const DEFAULT_EXAM = "2027-05-25";
  const SUBJECTS = [
    "Physics",
    "Chemistry",
    "Mathematics",
    "Biology",
    "General"
  ];

  const PAGES = {
    overview: "Overview",
    today: "Today's Tasks",
    week: "This Week",
    tracker: "Master Tracker",
    calendar: "Study Calendar",
    revision: "Revision Queue",
    overdue: "Overdue Tasks",
    carry: "Carry Forward",
    analytics: "Mock Analytics",
    settings: "Settings"
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [
    ...root.querySelectorAll(selector)
  ];

  const pad = (n) => String(n).padStart(2, "0");

  function todayString() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function dateAfter(days, from = new Date()) {
    const d = new Date(from);
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function id() {
    return `${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 9)}`;
  }

  function num(value, min = 0, max = 1000000) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : min;
  }

  function esc(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      (ch) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;"
        }[ch])
    );
  }

  function dateLabel(value, options) {
    if (!value) return "No date";
    const d = new Date(`${value}T12:00:00`);
    if (Number.isNaN(d.getTime())) return "No date";
    return d.toLocaleDateString(
      "en-IN",
      options || {
        day: "numeric",
        month: "short",
        year: "numeric"
      }
    );
  }

  function duration(minutes) {
    const m = Math.max(0, Math.round(Number(minutes) || 0));
    const h = Math.floor(m / 60);
    const r = m % 60;
    if (h && r) return `${h}h ${r}m`;
    if (h) return `${h}h`;
    return `${r}m`;
  }

  function freshData() {
    return {
      version: 2,
      tasks: [],
      sessions: [],
      mocks: [],
      settings: { studyGoal: 6, examDate: DEFAULT_EXAM },
      timer: {
        running: false,
        startedAt: null,
        accumulatedSeconds: 0,
        taskId: ""
      }
    };
  }

  /* ==========================================================
     2. LOAD AND SAVE DATA
     ========================================================== */

  function loadData() {
    const result = freshData();

    try {
      const raw = localStorage.getItem(STORE.data);
      if (!raw) return result;

      const saved = JSON.parse(raw);
      if (!saved || typeof saved !== "object") return result;

      result.tasks = (Array.isArray(saved.tasks) ? saved.tasks : []).map(
        (t) => ({
          id: String(t.id || id()),
          title: String(t.title || t.name || "Untitled task"),
          subject: SUBJECTS.includes(t.subject) ? t.subject : "General",
          chapter: String(t.chapter || ""),
          topic: String(t.topic || ""),
          date: String(t.date || t.dueDate || todayString()),
          priority: ["High", "Medium", "Low"].includes(t.priority)
            ? t.priority
            : "Medium",
          estimate: num(
            t.estimate ?? t.estimatedMinutes ?? Number(t.estimateHours) * 60
          ),
          progress: num(t.progress ?? t.progressPercent, 0, 100),
          completed: Boolean(t.completed || t.status === "Completed"),
          completedAt: t.completedAt || null,
          revisionDate: String(t.revisionDate || ""),
          notes: String(t.notes || ""),
          createdAt: t.createdAt || new Date().toISOString(),
          studyMinutes: num(
            t.studyMinutes ?? t.actualMinutes ?? Number(t.actualHours) * 60
          )
        })
      );

      result.sessions = (
        Array.isArray(saved.sessions) ? saved.sessions : []
      ).map((s) => ({
        id: String(s.id || id()),
        taskId: String(s.taskId || ""),
        date: String(s.date || todayString()),
        minutes: num(s.minutes),
        note: String(s.note || ""),
        createdAt: s.createdAt || new Date().toISOString()
      }));

      result.mocks = (Array.isArray(saved.mocks) ? saved.mocks : []).map(
        (m) => ({
          id: String(m.id || id()),
          name: String(m.name || "Mock test"),
          date: String(m.date || todayString()),
          exam: String(m.exam || "IAT"),
          score: num(m.score),
          total: num(m.total, 1),
          notes: String(m.notes || "")
        })
      );

      result.settings = {
        ...result.settings,
        ...(saved.settings || {})
      };
      result.settings.studyGoal = num(result.settings.studyGoal, 1, 24);
      result.settings.examDate =
        localStorage.getItem(STORE.exam) ||
        result.settings.examDate ||
        DEFAULT_EXAM;

      // Do not resume a timer unexpectedly after a page reload.
      result.timer = {
        running: false,
        startedAt: null,
        accumulatedSeconds: num(saved.timer?.accumulatedSeconds, 0, 86400),
        taskId: String(saved.timer?.taskId || "")
      };

      return result;
    } catch (error) {
      console.error("ORBIT: saved data could not be loaded.", error);
      return result;
    }
  }

  let data = loadData();
  let page = "overview";
  let calendarDate = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  );
  let filter = { subject: "All", search: "" };
  let timerInterval = null;

  function saveData() {
    try {
      localStorage.setItem(STORE.data, JSON.stringify(data));
      localStorage.setItem(STORE.exam, data.settings.examDate || DEFAULT_EXAM);
      return true;
    } catch (error) {
      console.error("ORBIT: could not save data.", error);
      notify("Could not save data. Check your browser storage.", "error");
      return false;
    }
  }

  /* ==========================================================
     3. SAFE DOM HELPERS
     These helpers prevent null.addEventListener errors.
     ========================================================== */

  function on(selector, eventName, handler) {
    const element = $(selector);
    if (element) element.addEventListener(eventName, handler);
    return element;
  }

  function notify(message, type = "success") {
    let region = $("#toastRegion");

    if (!region) {
      region = document.createElement("div");
      region.id = "toastRegion";
      region.className = "toast-region";
      region.setAttribute("aria-live", "polite");
      document.body.appendChild(region);
    }

    const item = document.createElement("div");
    item.className = `toast ${type}`;
    item.textContent = message;
    region.appendChild(item);

    window.setTimeout(() => item.remove(), 3200);
  }

  function closeModal(selector) {
    const modal = $(selector);
    if (modal) modal.hidden = true;

    const taskModal = $("#taskModal");
    const timeModal = $("#timeModal");

    if ((!taskModal || taskModal.hidden) && (!timeModal || timeModal.hidden)) {
      document.body.style.overflow = "";
    }
  }

  function openModal(selector) {
    const modal = $(selector);
    if (!modal) {
      notify(
        `The ${selector.replace("#", "")} element is missing from the HTML.`,
        "error"
      );
      return false;
    }

    modal.hidden = false;
    document.body.style.overflow = "hidden";
    return true;
  }

  function heading(eyebrow, title, description, action = "") {
    return `
      <div class="page-heading">
        <div>
          <span class="eyebrow">${esc(eyebrow)}</span>
          <h1>${esc(title)}</h1>
          <p>${esc(description)}</p>
        </div>
        ${action ? `<div class="heading-actions">${action}</div>` : ""}
      </div>`;
  }

  function empty(title, description, action = "") {
    return `<div class="empty-state">
      <div class="empty-icon">✳</div>
      <h3>${esc(title)}</h3>
      <p>${esc(description)}</p>
      ${
        action
          ? `<button class="button button-primary" data-action="${esc(
              action
            )}">＋ Create task</button>`
          : ""
      }
    </div>`;
  }

  function stat(label, value, foot, symbol = "✳") {
    return `<article class="card stat-card">
      <div class="stat-label">${esc(
        label
      )} <span class="stat-icon">${symbol}</span></div>
      <strong class="stat-value">${esc(value)}</strong>
      <div class="stat-foot">${esc(foot)}</div>
    </article>`;
  }

  /* ==========================================================
     4. TASK AND STUDY HELPERS
     ========================================================== */

  function taskById(taskId) {
    return data.tasks.find((t) => t.id === taskId);
  }

  function todayTasks() {
    return data.tasks.filter((t) => t.date === todayString());
  }

  function overdue(task) {
    return !task.completed && task.date < todayString();
  }

  function actualMinutes(task) {
    const sessionMinutes = data.sessions
      .filter((s) => s.taskId === task.id)
      .reduce((sum, s) => sum + s.minutes, 0);

    return Math.max(task.studyMinutes || 0, sessionMinutes);
  }

  function minutesOn(date) {
    return data.sessions
      .filter((s) => s.date === date)
      .reduce((sum, s) => sum + s.minutes, 0);
  }

  function progressOf(tasks = data.tasks) {
    if (!tasks.length) return 0;
    return Math.round(
      tasks.reduce((sum, t) => sum + (t.completed ? 100 : t.progress), 0) /
        tasks.length
    );
  }

  function daysLeft() {
    const target = new Date(
      `${data.settings.examDate || DEFAULT_EXAM}T00:00:00`
    );
    const today = new Date(`${todayString()}T00:00:00`);
    return Number.isNaN(target.getTime())
      ? null
      : Math.ceil((target - today) / 86400000);
  }

  function filtered(tasks) {
    return tasks.filter((t) => {
      const subjectMatch =
        filter.subject === "All" || t.subject === filter.subject;
      const query = filter.search.trim().toLowerCase();
      const searchMatch =
        !query ||
        [t.title, t.chapter, t.topic, t.subject, t.notes]
          .join(" ")
          .toLowerCase()
          .includes(query);
      return subjectMatch && searchMatch;
    });
  }

  function badges(task) {
    return `<div class="task-meta">
      <span class="pill">${esc(task.subject)}</span>
      <span class="pill ${task.priority.toLowerCase()}">${esc(
      task.priority
    )} priority</span>
      ${task.chapter ? `<span class="pill">${esc(task.chapter)}</span>` : ""}
      ${overdue(task) ? '<span class="pill high">Overdue</span>' : ""}
      ${task.completed ? '<span class="pill low">Completed</span>' : ""}
    </div>`;
  }

  function taskRow(task) {
    const percent = task.completed ? 100 : task.progress;

    return `<article class="task-row ${task.completed ? "is-complete" : ""}">
      <input type="checkbox" class="task-check"
        data-action="toggle-task" data-id="${esc(task.id)}"
        aria-label="Complete ${esc(task.title)}"
        ${task.completed ? "checked" : ""}>
      <div class="task-content">
        <p class="task-title">${esc(task.title)}</p>
        <p class="task-subtitle">
          ${esc(task.topic || "No checkpoint added")} · Due ${esc(
      dateLabel(task.date, { day: "numeric", month: "short" })
    )}
        </p>
        ${badges(task)}
        <div class="task-progress">
          <div class="progress-track">
            <div class="progress-fill" style="width:${percent}%"></div>
          </div>
          <div class="progress-meta">
            <span>${percent}% complete</span>
            <span>${duration(actualMinutes(task))} logged${
      task.estimate ? ` / ${duration(task.estimate)} estimated` : ""
    }</span>
          </div>
        </div>
        <label class="progress-editor">
          <span>Update progress</span>
          <input type="range" min="0" max="100" step="5"
            value="${percent}" data-action="progress" data-id="${esc(task.id)}">
        </label>
      </div>
      <div class="task-actions">
        <button type="button" data-action="edit-task" data-id="${esc(
          task.id
        )}" aria-label="Edit task" title="Edit">✎</button>
        <button type="button" data-action="log-time" data-id="${esc(
          task.id
        )}" aria-label="Log study time" title="Log time">◷</button>
        <button type="button" data-action="delete-task" data-id="${esc(
          task.id
        )}" aria-label="Delete task" title="Delete">×</button>
      </div>
    </article>`;
  }

  function taskList(
    tasks,
    emptyTitle = "Nothing here yet",
    emptyDescription = "Create a task to begin.",
    allowCreate = true
  ) {
    if (!tasks.length) {
      return empty(emptyTitle, emptyDescription, allowCreate ? "new-task" : "");
    }
    return `<div class="task-list">${tasks.map(taskRow).join("")}</div>`;
  }

  function filterMarkup() {
    return `<div class="filter-bar">
      <div>
        <label for="taskSearch">Search tasks</label>
        <input id="taskSearch" type="search"
          value="${esc(
            filter.search
          )}" placeholder="Search tasks, topics, chapters…">
      </div>
      <div>
        <label for="subjectFilter">Subject</label>
        <select id="subjectFilter">
          ${["All", ...SUBJECTS]
            .map(
              (s) =>
                `<option value="${esc(s)}" ${
                  filter.subject === s ? "selected" : ""
                }>${esc(s)}</option>`
            )
            .join("")}
        </select>
      </div>
      <button type="button" class="button button-secondary" data-action="clear-filters">Clear</button>
    </div>`;
  }

  function taskPage(title, eyebrow, description, tasks) {
    return `${heading(
      eyebrow,
      title,
      description,
      '<button type="button" class="button button-primary" data-action="new-task">＋ New task</button>'
    )}
      ${filterMarkup()}
      <div id="taskResults">${taskList(filtered(tasks))}</div>`;
  }

  function chapterGroups() {
    const groups = new Map();

    data.tasks.forEach((task) => {
      if (!task.chapter.trim()) return;
      const key = `${task.subject}::${task.chapter.trim().toLowerCase()}`;

      if (!groups.has(key)) {
        groups.set(key, {
          subject: task.subject,
          chapter: task.chapter.trim(),
          tasks: []
        });
      }

      groups.get(key).tasks.push(task);
    });

    return [...groups.values()];
  }

  /* ==========================================================
     5. PAGE RENDERERS
     ========================================================== */

  function renderOverview() {
    const today = todayTasks();
    const days = daysLeft();
    const totalMinutes = minutesOn(todayString());
    const quotes = [
      "A clear understanding is worth more than a rushed page of notes.",
      "You do not need a perfect day. You need a day you can return to.",
      "Every difficult question can teach you something.",
      "Consistency is built by beginning again.",
      "Learn to explain it simply, then solve it independently.",
      "Your goal is to become capable, one checkpoint at a time."
    ];
    const quote = quotes[new Date().getDate() % quotes.length];

    return `<section class="hero">
      <div class="hero-copy">
        <span class="eyebrow">YOUR RESEARCH DESK · TODAY</span>
        <h1>Make today count, one concept at a time.</h1>
        <p>Build understanding, solve meaningful problems, and keep moving toward IAT 2027.</p>
        <div class="heading-actions">
          <button class="button button-primary" data-action="new-task">＋ Plan a task</button>
          <button class="button button-secondary" data-action="go-today">Today's tasks →</button>
        </div>
        <p class="quote-line">“${esc(quote)}”</p>
      </div>
      <div class="hero-date">
        <strong>${days === null ? "—" : Math.max(0, days)}</strong>
        <span>${
          days !== null && days < 0 ? "EXAM DATE PASSED" : "DAYS TO IAT"
        }</span>
      </div>
    </section>

    <div class="grid grid-4">
      ${stat(
        "Today's study time",
        duration(totalMinutes),
        `Daily target: ${data.settings.studyGoal}h`,
        "◷"
      )}
      ${stat(
        "Today's tasks",
        `${today.filter((t) => t.completed).length}/${today.length}`,
        `${today.filter((t) => !t.completed).length} remaining`,
        "☷"
      )}
      ${stat(
        "Overall progress",
        `${progressOf()}%`,
        `${data.tasks.filter((t) => t.completed).length} of ${
          data.tasks.length
        } completed`,
        "◎"
      )}
      ${stat(
        "Overdue tasks",
        String(data.tasks.filter(overdue).length),
        "Past due and unfinished",
        "↻"
      )}
    </div>

    <div class="grid grid-2 section-gap">
      <section class="card">
        <div class="card-heading">
          <div><h2>Today's mission</h2><p>Your checkpoints for today</p></div>
          <button class="text-button" data-action="go-today">View all →</button>
        </div>
        ${taskList(
          today.slice(0, 4),
          "A fresh page",
          "Plan a specific checkpoint for today."
        )}
      </section>
      <section class="card">
        <div class="card-heading"><div><h2>Subject progress</h2><p>Based on your task progress</p></div></div>
        ${SUBJECTS.filter((s) => s !== "General")
          .map((subject) => {
            const tasks = data.tasks.filter((t) => t.subject === subject);
            const progress = progressOf(tasks);
            return `<div class="subject-row">
            <span class="subject-name">${esc(subject)}</span>
            <div class="subject-track"><span style="width:${progress}%"></span></div>
            <span class="subject-pct">${progress}%</span>
          </div>`;
          })
          .join("")}
      </section>
    </div>

    <div class="grid grid-2 section-gap">
      <section class="card">
        <div class="card-heading"><div><h2>Coming up</h2><p>Upcoming unfinished tasks</p></div></div>
        ${taskList(
          data.tasks
            .filter((t) => !t.completed && t.date >= todayString())
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(0, 4),
          "Nothing scheduled",
          "Create a task with a due date."
        )}
      </section>
      <section class="card">
        <div class="card-heading"><div><h2>Recent study activity</h2><p>Logged session time</p></div></div>
        ${Array.from({ length: 5 }, (_, i) => dateAfter(i - 4))
          .map(
            (date) =>
              `<div class="settings-row">
            <div><strong>${esc(
              dateLabel(date, {
                weekday: "short",
                day: "numeric",
                month: "short"
              })
            )}</strong></div>
            <strong>${esc(duration(minutesOn(date)))}</strong>
          </div>`
          )
          .join("")}
      </section>
    </div>`;
  }

  function renderToday() {
    return `${taskPage(
      "Today's Tasks",
      "DAILY EXECUTION",
      "Turn your plan into measurable checkpoints.",
      todayTasks()
    )}
      ${timerMarkup()}`;
  }

  function renderWeek() {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    });
    const tasks = data.tasks
      .filter((t) => days.includes(t.date))
      .sort((a, b) => a.date.localeCompare(b.date));

    return `${heading(
      "WEEKLY PLANNING",
      "This Week",
      "Review your workload and rebalance your tasks.",
      '<button class="button button-primary" data-action="new-task">＋ New task</button>'
    )}
      <section class="card"><div class="week-strip">
        ${days
          .map(
            (date) => `<button class="week-day ${
              date === todayString() ? "today" : ""
            }"
          data-action="choose-date" data-date="${date}">
          <div class="day-name">${esc(
            dateLabel(date, { weekday: "short" })
          )}</div>
          <div class="day-num">${Number(date.slice(-2))}</div>
          <div class="day-load">${
            tasks.filter((t) => t.date === date).length
          } tasks</div>
        </button>`
          )
          .join("")}
      </div></section>
      <section class="card section-gap">
        <div class="card-heading"><div><h2>Tasks this week</h2>
        <p>${esc(dateLabel(days[0]))} – ${esc(
      dateLabel(days[6])
    )}</p></div></div>
        ${taskList(
          filtered(tasks),
          "A clear week ahead",
          "Schedule your first checkpoint."
        )}
      </section>`;
  }

  function renderTracker() {
    const groups = chapterGroups();

    return `${heading(
      "SYLLABUS CONTROL",
      "Master Tracker",
      "Chapters are grouped from the chapter names on your tasks.",
      '<button class="button button-primary" data-action="new-task">＋ Add chapter task</button>'
    )}
      <div class="grid grid-3">
        ${stat(
          "Chapters tracked",
          String(groups.length),
          "Unique subject and chapter pairs",
          "◎"
        )}
        ${stat(
          "Tasks completed",
          `${data.tasks.filter((t) => t.completed).length}/${
            data.tasks.length
          }`,
          "All subjects",
          "✓"
        )}
        ${stat(
          "Overall progress",
          `${progressOf()}%`,
          "Average task progress",
          "↗"
        )}
      </div>
      <section class="card section-gap">
        <div class="card-heading"><div><h2>Chapter overview</h2>
        <p>Tasks need a chapter name to appear here.</p></div></div>
        ${
          groups.length
            ? `<div class="table-wrap"><table class="data-table">
          <thead><tr><th>CHAPTER</th><th>TASKS</th><th>DONE</th><th>PROGRESS</th><th>TIME</th><th></th></tr></thead>
          <tbody>${groups
            .map((g) => {
              const done = g.tasks.filter((t) => t.completed).length;
              const pct = progressOf(g.tasks);
              const mins = g.tasks.reduce((s, t) => s + actualMinutes(t), 0);
              return `<tr>
              <td><strong>${esc(g.chapter)}</strong><div class="muted">${esc(
                g.subject
              )}</div></td>
              <td>${g.tasks.length}</td><td>${done}</td>
              <td><div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>${pct}%</td>
              <td>${esc(duration(mins))}</td>
              <td><button class="text-button" data-action="chapter-filter"
                data-subject="${esc(g.subject)}" data-chapter="${esc(
                g.chapter
              )}">View</button></td>
            </tr>`;
            })
            .join("")}</tbody>
        </table></div>`
            : empty(
                "Your tracker is waiting",
                "Create a task and add its subject and chapter.",
                "new-task"
              )
        }
      </section>`;
  }

  function renderRevision() {
    const due = data.tasks
      .filter(
        (t) => !t.completed && t.revisionDate && t.revisionDate <= todayString()
      )
      .sort((a, b) => a.revisionDate.localeCompare(b.revisionDate));
    const upcoming = data.tasks
      .filter((t) => !t.completed && t.revisionDate > todayString())
      .sort((a, b) => a.revisionDate.localeCompare(b.revisionDate));

    return `${heading(
      "REVISIT AND RETAIN",
      "Revision Queue",
      "Schedule revision dates inside a task to build your queue.",
      '<button class="button button-primary" data-action="new-task">＋ Schedule revision</button>'
    )}
      <section class="card"><div class="card-heading"><div><h2>Due for revision</h2><p>${
        due.length
      } tasks due</p></div></div>
        ${taskList(
          due,
          "No revisions due",
          "Add revision dates to your tasks."
        )}</section>
      <section class="card section-gap"><div class="card-heading"><div><h2>Coming up</h2><p>Future revision dates</p></div></div>
        ${taskList(
          upcoming,
          "No future revisions",
          "Future revisions will appear here.",
          false
        )}</section>`;
  }

  function renderOverdue() {
    return taskPage(
      "Overdue Tasks",
      "RESET WITHOUT GUILT",
      "Review unfinished work and choose a realistic next step.",
      data.tasks.filter(overdue).sort((a, b) => a.date.localeCompare(b.date))
    );
  }

  function renderCarry() {
    const tasks = data.tasks
      .filter(overdue)
      .sort((a, b) => a.date.localeCompare(b.date));

    return `${heading(
      "PICK UP WHERE YOU LEFT OFF",
      "Carry Forward",
      "Move unfinished tasks to today when they're still important."
    )}
      <section class="card"><div class="card-heading"><div><h2>Unfinished past tasks</h2>
        <p>Move a task to today or edit its date.</p></div></div>
        ${
          tasks.length
            ? `<div class="task-list">${tasks
                .map(
                  (t) => `
          <article class="task-row">
            <div class="task-check">↗</div>
            <div><p class="task-title">${esc(t.title)}</p>
              <p class="task-subtitle">Originally due ${esc(
                dateLabel(t.date)
              )}</p>${badges(t)}</div>
            <div class="task-actions">
              <button data-action="carry-task" data-id="${esc(
                t.id
              )}" title="Move to today">↗</button>
              <button data-action="edit-task" data-id="${esc(
                t.id
              )}" title="Edit">✎</button>
            </div>
          </article>`
                )
                .join("")}</div>`
            : empty(
                "Nothing to carry forward",
                "Past-due unfinished tasks will appear here.",
                "new-task"
              )
        }
      </section>`;
  }

  function renderCalendar() {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const offset = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = Math.ceil((offset + daysInMonth) / 7) * 7;
    let markup = "";

    for (let i = 0; i < cells; i++) {
      const n = i - offset + 1;
      const d = new Date(year, month, n, 12);
      const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
        d.getDate()
      )}`;
      const outside = n < 1 || n > daysInMonth;
      const mins = minutesOn(date);
      const heat =
        mins === 0 ? 0 : mins < 30 ? 1 : mins < 60 ? 2 : mins < 120 ? 3 : 4;
      const hasTasks = data.tasks.some((t) => t.date === date);

      markup += `<button class="calendar-cell ${outside ? "outside" : ""} ${
        date === todayString() ? "today" : ""
      } heat-${heat}"
        data-action="choose-date" data-date="${date}"
        title="${esc(dateLabel(date))} · ${esc(duration(mins))} logged">
        <span class="calendar-day-number">${d.getDate()}</span>
        ${
          mins
            ? `<span class="calendar-minutes">${esc(duration(mins))}</span>`
            : ""
        }
        ${hasTasks ? '<span class="calendar-dots"><span></span></span>' : ""}
      </button>`;
    }

    return `${heading(
      "YOUR STUDY RHYTHM",
      "Study Calendar",
      "Activity shading represents logged study time. Select a day to plan a task."
    )}
      <section class="card">
        <div class="calendar-toolbar">
          <button class="icon-button" data-action="calendar-prev">←</button>
          <h2 class="calendar-month">${esc(
            calendarDate.toLocaleDateString("en-IN", {
              month: "long",
              year: "numeric"
            })
          )}</h2>
          <button class="icon-button" data-action="calendar-next">→</button>
          <button class="button button-secondary button-small" data-action="calendar-today">Today</button>
        </div>
        <div class="calendar-grid">
          ${["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
            .map((d) => `<div class="calendar-weekday">${d}</div>`)
            .join("")}
          ${markup}
        </div>
        <div class="calendar-legend"><span>Less</span>
          ${[0, 1, 2, 3, 4]
            .map((n) => `<span class="legend-box heat-${n}"></span>`)
            .join("")}
          <span>More study time</span></div>
      </section>
      <section class="card section-gap">
        <h2>Log study time</h2><p class="muted">Add time spent studying away from the timer.</p>
        <button class="button button-primary" data-action="log-time">＋ Add study time</button>
      </section>`;
  }

  function renderAnalytics() {
    const total = data.sessions.reduce((s, x) => s + x.minutes, 0);
    const last7 = Array.from({ length: 7 }, (_, i) => dateAfter(i - 6));
    const weekMinutes = last7.reduce((s, d) => s + minutesOn(d), 0);
    const avg = data.mocks.length
      ? data.mocks.reduce((s, m) => s + (m.score / m.total) * 100, 0) /
        data.mocks.length
      : null;

    return `${heading(
      "MEASURE, LEARN, ADJUST",
      "Mock & Analytics",
      "Record your mock results and use them to identify what to revise."
    )}
      <div class="grid grid-3">
        ${stat(
          "Total logged study",
          duration(total),
          "Timer and manual entries",
          "◷"
        )}
        ${stat("Last 7 days", duration(weekMinutes), "Study time logged", "▦")}
        ${stat(
          "Average mock score",
          avg === null ? "—" : `${avg.toFixed(1)}%`,
          `${data.mocks.length} tests recorded`,
          "◎"
        )}
      </div>
      <section class="card section-gap">
        <div class="card-heading"><div><h2>Record a mock</h2><p>Score must not exceed maximum marks.</p></div></div>
        <form id="mockForm" class="mock-form">
          <div><label for="mockName">Test name</label><input id="mockName" required maxlength="100" placeholder="IAT Mock 01"></div>
          <div><label for="mockExam">Exam</label><select id="mockExam"><option>IAT</option><option>NEST</option><option>JEE Main</option><option>Other</option></select></div>
          <div><label for="mockDate">Date</label><input id="mockDate" type="date" value="${todayString()}" required></div>
          <div><label for="mockScore">Score</label><input id="mockScore" type="number" min="0" step="any" required></div>
          <div><label for="mockTotal">Maximum marks</label><input id="mockTotal" type="number" min="1" step="any" value="180" required></div>
          <div><label for="mockNotes">Weak areas / notes</label><input id="mockNotes" maxlength="300" placeholder="Topics to revise"></div>
          <button class="button button-primary" type="submit">＋ Save mock result</button>
        </form>
      </section>
      <section class="card section-gap">
        <div class="card-heading"><div><h2>Mock history</h2><p>Newest first</p></div></div>
        ${
          data.mocks.length
            ? `<div class="table-wrap"><table class="data-table">
          <thead><tr><th>TEST</th><th>DATE</th><th>SCORE</th><th>PERCENT</th><th>NOTES</th><th></th></tr></thead>
          <tbody>${[...data.mocks]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map(
              (m) => `
            <tr><td><strong>${esc(m.name)}</strong><div class="muted">${esc(
                m.exam
              )}</div></td>
            <td>${esc(dateLabel(m.date))}</td><td>${m.score} / ${m.total}</td>
            <td>${((m.score / m.total) * 100).toFixed(1)}%</td><td>${esc(
                m.notes || "—"
              )}</td>
            <td><button class="text-button" data-action="delete-mock" data-id="${esc(
              m.id
            )}">Delete</button></td></tr>
          `
            )
            .join("")}</tbody>
        </table></div>`
            : empty(
                "No mock results yet",
                "Record your first mock to start tracking results."
              )
        }
      </section>`;
  }

  function renderSettings() {
    return `${heading(
      "MAKE THE DESK YOURS",
      "Settings & Data",
      "Manage your exam date, daily goal, and local backup."
    )}
      <section class="card settings-group">
        <div class="card-heading"><div><h2>Study preferences</h2><p>Update your planning settings.</p></div></div>
        <div class="settings-row"><div><strong>IAT exam date</strong><p>Default: 25 May 2027</p></div>
          <input id="settingsExamDate" type="date" value="${esc(
            data.settings.examDate
          )}"></div>
        <div class="settings-row"><div><strong>Daily study goal</strong><p>Hours per day</p></div>
          <input id="settingsStudyGoal" type="number" min="1" max="24" step="0.5" value="${
            data.settings.studyGoal
          }"></div>
        <div class="settings-actions"><button class="button button-primary" data-action="save-settings">Save preferences</button></div>
      </section>
      <section class="card settings-group">
        <div class="card-heading"><div><h2>Backup and restore</h2><p>Your data stays in this browser unless you export it.</p></div></div>
        <p class="notice">Export a backup before clearing browser data or changing devices. Importing replaces the current data.</p>
        <div class="settings-actions">
          <button class="button button-primary" data-action="export-data">↓ Export JSON backup</button>
          <button class="button button-secondary" data-action="import-data">↑ Import backup</button>
          <button class="button button-danger" data-action="reset-data">Reset ORBIT</button>
        </div>
        <input id="importFile" type="file" accept=".json,application/json" hidden>
      </section>
      <section class="card">
        <div class="grid grid-3">
          ${stat(
            "Tasks",
            String(data.tasks.length),
            `${data.tasks.filter((t) => t.completed).length} completed`,
            "☷"
          )}
          ${stat(
            "Study sessions",
            String(data.sessions.length),
            "Logged sessions",
            "◷"
          )}
          ${stat("Mock tests", String(data.mocks.length), "Saved results", "◎")}
        </div>
      </section>`;
  }

  /* ==========================================================
     6. TIMER
     ========================================================== */

  function timerMarkup() {
    const options = data.tasks
      .filter((t) => !t.completed)
      .map(
        (t) =>
          `<option value="${esc(t.id)}" ${
            data.timer.taskId === t.id ? "selected" : ""
          }>${esc(t.title)}</option>`
      )
      .join("");

    return `<section class="card section-gap">
      <div class="card-heading"><div><h2>Study session</h2><p>Time a session and attach it to a task.</p></div></div>
      <div class="timer-panel">
        <span class="eyebrow">FOCUS SESSION</span>
        <label for="timerTask">Task</label>
        <select id="timerTask"><option value="">General study session</option>${options}</select>
        <div class="timer-display" id="timerDisplay">00:00:00</div>
        <div class="timer-controls">
          <button class="button button-primary" data-action="timer-start">${
            data.timer.running ? "Running…" : "▶ Start / Resume"
          }</button>
          <button class="button button-secondary" data-action="timer-pause" ${
            data.timer.running ? "" : "disabled"
          }>Ⅱ Pause</button>
          <button class="button button-secondary" data-action="timer-stop" ${
            data.timer.running || data.timer.accumulatedSeconds
              ? ""
              : "disabled"
          }>✓ Finish & save</button>
        </div>
        <p id="timerStatus" class="timer-status">${
          data.timer.running
            ? "Session running. Keep this tab open."
            : "Choose a task, then start when you're ready."
        }</p>
      </div>
    </section>`;
  }

  function timerSeconds() {
    return (
      data.timer.accumulatedSeconds +
      (data.timer.running && data.timer.startedAt
        ? Math.max(0, Math.floor((Date.now() - data.timer.startedAt) / 1000))
        : 0)
    );
  }

  function updateTimer() {
    const display = $("#timerDisplay");
    if (!display) return;

    const s = timerSeconds();
    display.textContent = `${pad(Math.floor(s / 3600))}:${pad(
      Math.floor((s % 3600) / 60)
    )}:${pad(s % 60)}`;
  }

  function startTimer() {
    if (data.timer.running) return;

    const select = $("#timerTask");
    if (select) data.timer.taskId = select.value;

    data.timer.running = true;
    data.timer.startedAt = Date.now();
    saveData();

    if (timerInterval) clearInterval(timerInterval);
    timerInterval = window.setInterval(updateTimer, 1000);

    renderPage();
    notify("Study session started.");
  }

  function pauseTimer() {
    if (!data.timer.running) return;

    data.timer.accumulatedSeconds = timerSeconds();
    data.timer.running = false;
    data.timer.startedAt = null;

    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;

    saveData();
    renderPage();
    notify("Timer paused.");
  }

  function saveSession(taskId, minutes, date = todayString(), note = "") {
    if (minutes <= 0) return;

    data.sessions.push({
      id: id(),
      taskId: taskId || "",
      minutes,
      date,
      note,
      createdAt: new Date().toISOString()
    });

    const task = taskById(taskId);
    if (task) task.studyMinutes = actualMinutes(task);
  }

  function stopTimer() {
    if (data.timer.running) {
      data.timer.accumulatedSeconds = timerSeconds();
      data.timer.running = false;
      data.timer.startedAt = null;
    }

    const minutes = Math.floor(data.timer.accumulatedSeconds / 60);
    const taskId = data.timer.taskId;

    if (minutes > 0) {
      saveSession(taskId, minutes, todayString(), "Timer session");
      notify(`${duration(minutes)} saved.`);
    } else {
      notify("Session was under one minute; no time was logged.", "error");
    }

    data.timer = {
      running: false,
      startedAt: null,
      accumulatedSeconds: 0,
      taskId: ""
    };

    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;

    saveData();
    renderPage();
  }

  /* ==========================================================
     7. TASK MODAL
     ========================================================== */

  function setField(selector, value) {
    const element = $(selector);
    if (element) element.value = value ?? "";
  }

  function openTaskModal(task = null, date = null) {
    if (!openModal("#taskModal")) {
      notify(
        "Your HTML is missing #taskModal. Please check the HTML panel.",
        "error"
      );
      return;
    }

    const form = $("#taskForm");
    if (form) form.reset();

    setField("#taskId", task?.id || "");
    setField("#taskTitle", task?.title || "");
    setField("#taskSubject", task?.subject || "Physics");
    setField("#taskPriority", task?.priority || "Medium");
    setField("#taskDate", task?.date || date || todayString());
    setField("#taskEstimate", task?.estimate ?? 60);
    setField("#taskChapter", task?.chapter || "");
    setField("#taskTopic", task?.topic || "");
    setField("#taskProgress", task?.progress ?? 0);
    setField("#taskRevisionDate", task?.revisionDate || "");
    setField("#taskNotes", task?.notes || "");

    const title = $("#taskModalTitle");
    if (title) title.textContent = task ? "Edit task" : "Create a task";

    const save = $("#saveTaskButton");
    if (save) save.textContent = task ? "Save changes" : "Save task";

    const taskTitle = $("#taskTitle");
    if (taskTitle) window.setTimeout(() => taskTitle.focus(), 50);
  }

  function saveTask(event) {
    event.preventDefault();

    const titleElement = $("#taskTitle");
    if (!titleElement || !titleElement.value.trim()) {
      notify("Please enter a task name.", "error");
      return;
    }

    const existing = taskById($("#taskId")?.value || "");
    const progress = num($("#taskProgress")?.value, 0, 100);

    const task = {
      id: existing?.id || id(),
      title: titleElement.value.trim(),
      subject: SUBJECTS.includes($("#taskSubject")?.value)
        ? $("#taskSubject").value
        : "General",
      chapter: $("#taskChapter")?.value.trim() || "",
      topic: $("#taskTopic")?.value.trim() || "",
      date: $("#taskDate")?.value || todayString(),
      priority: ["High", "Medium", "Low"].includes($("#taskPriority")?.value)
        ? $("#taskPriority").value
        : "Medium",
      estimate: num($("#taskEstimate")?.value),
      progress,
      completed:
        progress >= 100 || Boolean(existing?.completed && progress === 100),
      completedAt:
        progress >= 100
          ? existing?.completedAt || new Date().toISOString()
          : null,
      revisionDate: $("#taskRevisionDate")?.value || "",
      notes: $("#taskNotes")?.value.trim() || "",
      createdAt: existing?.createdAt || new Date().toISOString(),
      studyMinutes: existing?.studyMinutes || 0
    };

    if (existing) {
      Object.assign(existing, task);
    } else {
      data.tasks.push(task);
    }

    saveData();
    closeModal("#taskModal");
    renderPage();
    notify(existing ? "Task updated." : "Task created.");
  }

  function toggleTask(taskId, checked) {
    const task = taskById(taskId);
    if (!task) return;

    task.completed = checked;
    task.progress = checked ? 100 : Math.min(task.progress, 95);
    task.completedAt = checked ? new Date().toISOString() : null;

    saveData();
    renderPage();
    notify(checked ? "Task completed." : "Task reopened.");
  }

  function deleteTask(taskId) {
    const task = taskById(taskId);
    if (!task) return;

    if (
      !window.confirm(`Delete "${task.title}" and its linked study sessions?`)
    )
      return;

    data.tasks = data.tasks.filter((t) => t.id !== taskId);
    data.sessions = data.sessions.filter((s) => s.taskId !== taskId);

    if (data.timer.taskId === taskId) {
      data.timer.taskId = "";
    }

    saveData();
    renderPage();
    notify("Task deleted.");
  }

  /* ==========================================================
     8. MANUAL TIME ENTRY
     ========================================================== */

  function openTimeModal(taskId = "") {
    if (!openModal("#timeModal")) {
      notify(
        "Your HTML is missing #timeModal. Please check the HTML panel.",
        "error"
      );
      return;
    }

    const select = $("#timeTask");
    if (select) {
      select.innerHTML =
        `<option value="">General study session</option>` +
        data.tasks
          .map((t) => `<option value="${esc(t.id)}">${esc(t.title)}</option>`)
          .join("");
      select.value = taskId || "";
    }

    setField("#timeMinutes", "");
    setField("#timeDate", todayString());
    setField("#timeNote", "");
  }

  function saveTime(event) {
    event.preventDefault();

    const minutes = num($("#timeMinutes")?.value, 0, 1440);
    if (!minutes) {
      notify("Enter study time greater than zero.", "error");
      return;
    }

    saveSession(
      $("#timeTask")?.value || "",
      minutes,
      $("#timeDate")?.value || todayString(),
      $("#timeNote")?.value.trim() || "Manual entry"
    );

    saveData();
    closeModal("#timeModal");
    renderPage();
    notify(`${duration(minutes)} logged.`);
  }

  /* ==========================================================
     9. SETTINGS AND BACKUPS
     ========================================================== */

  function saveSettings() {
    data.settings.examDate = $("#settingsExamDate")?.value || DEFAULT_EXAM;
    data.settings.studyGoal = num($("#settingsStudyGoal")?.value, 1, 24);
    saveData();
    renderPage();
    notify("Settings saved.");
  }

  function exportBackup() {
    const backup = {
      app: "ORBIT",
      version: 2,
      exportedAt: new Date().toISOString(),
      data
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ORBIT-backup-${todayString()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    notify("Backup export started.");
  }

  function importBackup(file) {
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const imported = parsed?.data || parsed;

        if (!imported || !Array.isArray(imported.tasks)) {
          throw new Error("Invalid ORBIT backup.");
        }

        if (
          !window.confirm(
            "Import this backup? Current ORBIT data will be replaced."
          )
        )
          return;

        localStorage.setItem(STORE.data, JSON.stringify(imported));
        if (imported.settings?.examDate) {
          localStorage.setItem(STORE.exam, imported.settings.examDate);
        }

        data = loadData();
        renderPage();
        notify("Backup imported.");
      } catch (error) {
        console.error(error);
        notify("That file is not a valid ORBIT backup.", "error");
      } finally {
        const input = $("#importFile");
        if (input) input.value = "";
      }
    };

    reader.onerror = () => notify("Could not read that file.", "error");
    reader.readAsText(file);
  }

  function resetAll() {
    const answer = window.prompt(
      "Type RESET to clear all ORBIT tasks, sessions and mock results."
    );
    if (answer !== "RESET") {
      notify("Reset cancelled.");
      return;
    }

    data = freshData();
    localStorage.removeItem(STORE.favourites);
    localStorage.setItem(STORE.exam, DEFAULT_EXAM);

    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;

    saveData();
    navigate("overview");
    notify("ORBIT has been reset.");
  }

  /* ==========================================================
     10. MOCK TESTS
     ========================================================== */

  function saveMock(event) {
    event.preventDefault();

    const score = Number($("#mockScore")?.value);
    const total = Number($("#mockTotal")?.value);

    if (
      !Number.isFinite(score) ||
      !Number.isFinite(total) ||
      total <= 0 ||
      score < 0 ||
      score > total
    ) {
      notify("Check the score and maximum marks.", "error");
      return;
    }

    data.mocks.push({
      id: id(),
      name: $("#mockName")?.value.trim() || "Mock test",
      exam: $("#mockExam")?.value || "IAT",
      date: $("#mockDate")?.value || todayString(),
      score,
      total,
      notes: $("#mockNotes")?.value.trim() || ""
    });

    saveData();
    renderPage();
    notify("Mock result saved.");
  }

  /* ==========================================================
     11. NAVIGATION AND PAGE RENDERING
     ========================================================== */

  function updateHeader() {
    const dateElement = $("#headerDate");
    if (dateElement) {
      dateElement.textContent = new Date().toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short"
      });
    }

    const breadcrumb = $("#breadcrumbPage");
    if (breadcrumb) breadcrumb.textContent = PAGES[page] || "Overview";

    const count = $("#todayNavCount");
    if (count)
      count.textContent = todayTasks().filter((t) => !t.completed).length;
  }

  function navigate(pageName) {
    page = Object.prototype.hasOwnProperty.call(PAGES, pageName)
      ? pageName
      : "overview";

    $$(".nav-item[data-page], .orbit-nav-item[data-page]").forEach((button) => {
      const active = button.dataset.page === page;
      button.classList.toggle("active", active);

      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });

    const sidebar = $("#orbitSidebar") || $(".orbit-sidebar");
    if (sidebar) sidebar.classList.remove("open");

    renderPage();

    if (typeof window.scrollTo === "function") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function renderPage() {
    const root = $("#orbitDynamicContent");

    if (!root) {
      console.error(
        "ORBIT: #orbitDynamicContent was not found. Check that the HTML panel contains this ID."
      );
      return;
    }

    const renderers = {
      overview: renderOverview,
      today: renderToday,
      week: renderWeek,
      tracker: renderTracker,
      calendar: renderCalendar,
      revision: renderRevision,
      overdue: renderOverdue,
      carry: renderCarry,
      analytics: renderAnalytics,
      settings: renderSettings
    };

    root.innerHTML = (renderers[page] || renderOverview)();
    updateHeader();
    updateTimer();
  }

  /* ==========================================================
     12. DELEGATED EVENTS
     These continue to work when pages are rendered dynamically.
     ========================================================== */

  document.addEventListener("click", (event) => {
    const nav = event.target.closest(
      ".nav-item[data-page], .orbit-nav-item[data-page]"
    );

    if (nav) {
      event.preventDefault();
      navigate(nav.dataset.page);
      return;
    }

    const actionElement = event.target.closest("[data-action]");
    if (!actionElement) return;

    const action = actionElement.dataset.action;
    const taskId = actionElement.dataset.id;

    switch (action) {
      case "new-task":
        openTaskModal();
        break;

      case "edit-task":
        openTaskModal(taskById(taskId));
        break;

      case "delete-task":
        deleteTask(taskId);
        break;

      case "toggle-task":
        // Checkbox changes are handled in the change event below.
        break;

      case "progress": {
        const task = taskById(taskId);
        if (task) {
          task.progress = num(actionElement.value, 0, 100);
          if (task.progress >= 100) {
            task.completed = true;
            task.completedAt = new Date().toISOString();
          } else {
            task.completed = false;
            task.completedAt = null;
          }
          saveData();
          const row = actionElement.closest(".task-row");
          const percent = row?.querySelector(".progress-meta span");
          if (percent) percent.textContent = `${task.progress}% complete`;
          const fill = row?.querySelector(".progress-fill");
          if (fill) fill.style.width = `${task.progress}%`;
        }
        break;
      }

      case "log-time":
        openTimeModal(taskId || "");
        break;

      case "go-today":
        navigate("today");
        break;

      case "go-week":
        navigate("week");
        break;

      case "go-calendar":
        navigate("calendar");
        break;

      case "clear-filters":
        filter = { subject: "All", search: "" };
        renderPage();
        break;

      case "choose-date":
        openTaskModal(null, actionElement.dataset.date || todayString());
        break;

      case "carry-task": {
        const task = taskById(taskId);
        if (task) {
          task.date = todayString();
          saveData();
          renderPage();
          notify("Task moved to today.");
        }
        break;
      }

      case "calendar-prev":
        calendarDate = new Date(
          calendarDate.getFullYear(),
          calendarDate.getMonth() - 1,
          1
        );
        renderPage();
        break;

      case "calendar-next":
        calendarDate = new Date(
          calendarDate.getFullYear(),
          calendarDate.getMonth() + 1,
          1
        );
        renderPage();
        break;

      case "calendar-today":
        calendarDate = new Date(
          new Date().getFullYear(),
          new Date().getMonth(),
          1
        );
        renderPage();
        break;

      case "timer-start":
        startTimer();
        break;

      case "timer-pause":
        pauseTimer();
        break;

      case "timer-stop":
        stopTimer();
        break;

      case "save-settings":
        saveSettings();
        break;

      case "export-data":
        exportBackup();
        break;

      case "import-data":
        $("#importFile")?.click();
        break;

      case "reset-data":
        resetAll();
        break;

      case "delete-mock":
        if (window.confirm("Delete this mock result?")) {
          data.mocks = data.mocks.filter((m) => m.id !== taskId);
          saveData();
          renderPage();
          notify("Mock result deleted.");
        }
        break;

      case "chapter-filter":
        filter.subject = actionElement.dataset.subject || "All";
        filter.search = actionElement.dataset.chapter || "";
        navigate("tracker");
        break;
    }
  });

  document.addEventListener("change", (event) => {
    const target = event.target;

    if (target.matches('[data-action="toggle-task"]')) {
      toggleTask(target.dataset.id, target.checked);
      return;
    }

    if (target.id === "subjectFilter") {
      filter.subject = target.value;
      renderPage();
      return;
    }

    if (target.id === "timerTask") {
      data.timer.taskId = target.value;
      saveData();
      return;
    }

    if (target.id === "importFile") {
      importBackup(target.files?.[0]);
    }
  });

  document.addEventListener("input", (event) => {
    const target = event.target;

    if (target.id === "taskSearch") {
      filter.search = target.value;

      const tasks =
        page === "today"
          ? todayTasks()
          : page === "overdue" || page === "carry"
          ? data.tasks.filter(overdue)
          : page === "revision"
          ? data.tasks.filter(
              (t) =>
                !t.completed &&
                t.revisionDate &&
                t.revisionDate <= todayString()
            )
          : page === "week"
          ? data.tasks.filter((t) => {
              const now = new Date();
              const monday = new Date(now);
              monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
              const sunday = new Date(monday);
              sunday.setDate(monday.getDate() + 6);
              const toISO = (d) =>
                `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
                  d.getDate()
                )}`;
              return t.date >= toISO(monday) && t.date <= toISO(sunday);
            })
          : data.tasks;

      const results = $("#taskResults");
      if (results) {
        results.innerHTML = taskList(
          filtered(tasks),
          "No matching tasks",
          "Try another search.",
          false
        );
      }
      return;
    }

    if (target.matches('[data-action="progress"]')) {
      const task = taskById(target.dataset.id);
      if (!task) return;

      task.progress = num(target.value, 0, 100);
      task.completed = task.progress >= 100;
      task.completedAt = task.completed
        ? task.completedAt || new Date().toISOString()
        : null;
      saveData();

      const row = target.closest(".task-row");
      const label = row?.querySelector(".progress-meta span");
      const fill = row?.querySelector(".progress-fill");
      if (label) label.textContent = `${task.progress}% complete`;
      if (fill) fill.style.width = `${task.progress}%`;
    }
  });

  /* ==========================================================
     13. FORMS AND OPTIONAL HTML CONTROLS
     Every binding is guarded: no missing-ID crash.
     ========================================================== */

  on("#taskForm", "submit", saveTask);
  on("#timeForm", "submit", saveTime);

  // Analytics is rendered dynamically, so listen at document level.
  document.addEventListener("submit", (event) => {
    if (event.target?.id === "mockForm") saveMock(event);
  });

  on("#closeTaskModal", "click", () => closeModal("#taskModal"));
  on("#cancelTask", "click", () => closeModal("#taskModal"));
  on("#closeTimeModal", "click", () => closeModal("#timeModal"));
  on("#cancelTime", "click", () => closeModal("#timeModal"));

  on("#taskModal", "click", (event) => {
    if (event.target === $("#taskModal")) closeModal("#taskModal");
  });

  on("#timeModal", "click", (event) => {
    if (event.target === $("#timeModal")) closeModal("#timeModal");
  });

  on("#headerAddTask", "click", () => openTaskModal());

  on("#menuToggle", "click", () => {
    const sidebar = $("#orbitSidebar") || $(".orbit-sidebar");
    if (sidebar) sidebar.classList.toggle("open");
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal("#taskModal");
      closeModal("#timeModal");

      const sidebar = $("#orbitSidebar") || $(".orbit-sidebar");
      if (sidebar) sidebar.classList.remove("open");
    }
  });

  /* ==========================================================
     14. INITIALISE
     ========================================================== */

  function init() {
    // Initialise safely even if optional header controls are absent.
    updateHeader();

    if (!localStorage.getItem(STORE.exam)) {
      localStorage.setItem(STORE.exam, data.settings.examDate || DEFAULT_EXAM);
    }

    if (data.timer.running) {
      data.timer.running = false;
      data.timer.startedAt = null;
    }

    saveData();

    // If the HTML already contains data-page navigation, it will work.
    // Start on Overview.
    navigate("overview");

    // Keep a resumed, paused timer display available when opening Today.
    if (data.timer.accumulatedSeconds > 0 && !timerInterval) {
      updateTimer();
    }

    console.info("ORBIT initialised successfully.");
  }

  init();
})();
