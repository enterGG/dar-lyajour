const STORAGE = "dar-lyajour-v1";
const EXAMPLE_TASKS = [
  "نحدد الصفحات",
  "نكتب الصفحة الأولى",
  "نرتب الشكل",
  "نجرب فالموبايل"
];

const els = {
  stage: document.querySelector("#stage"),
  bubble: document.querySelector("#bubble"),
  emptyLot: document.querySelector("#empty-lot"),
  build: document.querySelector("#build"),
  house: document.querySelector("#house"),
  chimney: document.querySelector("#chimney"),
  dust: document.querySelector("#dust"),
  setup: document.querySelector("#setup-form"),
  play: document.querySelector("#play"),
  taskFields: document.querySelector("#task-fields"),
  newTask: document.querySelector("#new-task"),
  addTask: document.querySelector("#add-task"),
  name: document.querySelector("#project-name"),
  days: document.querySelector("#day-count"),
  start: document.querySelector("#start-date"),
  warn: document.querySelector("#start-warn"),
  topActions: document.querySelector("#top-actions"),
  switcher: document.querySelector("#project-switch"),
  kicker: document.querySelector("#play-kicker"),
  title: document.querySelector("#play-title"),
  stats: document.querySelector("#stats"),
  hint: document.querySelector("#play-hint"),
  checks: document.querySelector("#checks"),
  place: document.querySelector("#place"),
  restart: document.querySelector("#restart"),
  remove: document.querySelector("#remove"),
  another: document.querySelector("#another")
};

const state = load();
let justDate = "";
let showSetup = state.projects.length === 0;

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE) || "");
    if (!data || !Array.isArray(data.projects)) throw new Error("empty");
    return data;
  } catch {
    return { projects: [], activeId: null };
  }
}

function save() {
  localStorage.setItem(STORAGE, JSON.stringify(state));
}

function todayISO() {
  return iso(new Date());
}

function iso(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(isoDate, count) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + count);
  return iso(date);
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function active() {
  return state.projects.find((project) => project.id === state.activeId) || null;
}

function roofSizes(width) {
  const sizes = [];
  for (let size = width - 2; size >= 1; size -= 2) sizes.push(size);
  return sizes;
}

function chooseWidth(dayCount) {
  let best = 3;
  let bestScore = Infinity;
  [3, 5, 7, 9].forEach((width) => {
    if (width > dayCount) return;
    const roof = roofSizes(width).reduce((sum, size) => sum + size, 0);
    let left = dayCount - width;
    let score = 0;
    while (left > roof) {
      const take = Math.min(width, left - roof);
      if (take <= 0) break;
      if (take < width) score += (width - take) * 3;
      left -= take;
    }
    score += Math.abs(left - roof);
    score += Math.max(0, Math.ceil(dayCount / width) - width) * 5;
    score -= width * 0.15;
    if (score < bestScore) {
      bestScore = score;
      best = width;
    }
  });
  return best;
}

function plan(dayCount) {
  const width = chooseWidth(dayCount);
  const roofNeed = roofSizes(width);
  const roofTotal = roofNeed.reduce((sum, size) => sum + size, 0);
  const rows = [];
  let left = dayCount;
  let day = 1;

  function push(type, count) {
    const cells = [];
    for (let index = 0; index < count; index += 1) {
      cells.push({
        day,
        type,
        pillar: type === "foundation" && (index === 0 || index === count - 1)
      });
      day += 1;
    }
    rows.push({ type, cells });
  }

  const foundation = Math.min(width, left);
  push("foundation", foundation);
  left -= foundation;

  while (left - width >= roofTotal) {
    push("wall", width);
    left -= width;
  }

  let size = left <= roofTotal ? Math.min(width - 2, left) : Math.min(width, left);
  if (size < 1) size = 1;
  while (left > 0) {
    const take = Math.min(size, left);
    push(take === width ? "wall" : "roof", take);
    left -= take;
    size = Math.max(1, size - 2);
  }

  return rows;
}

function cellsOf(project) {
  const rows = plan(project.days);
  rows.forEach((row) => {
    row.cells.forEach((cell) => {
      cell.date = addDays(project.start, cell.day - 1);
    });
  });
  return rows;
}

function flatCells(rows) {
  return rows.flatMap((row) => row.cells);
}

function statusOf(cell, project, today) {
  if (project.done[cell.date]) return "done";
  if (cell.date < today) return "hole";
  if (cell.date === today) return "today";
  return "future";
}

function isRuined(cells, project, today) {
  return cells.some((cell) => cell.pillar && cell.date < today && !project.done[cell.date]);
}

function allChecked(project, today) {
  const marks = project.checks[today] || {};
  return project.tasks.length > 0 && project.tasks.every((_, index) => marks[index]);
}

function addTaskField(value) {
  const line = document.createElement("div");
  line.className = "task-line";
  const input = document.createElement("input");
  input.maxLength = 60;
  input.value = value || "";
  input.required = true;
  input.setAttribute("aria-label", "مهمة");
  const remove = document.createElement("button");
  remove.type = "button";
  remove.textContent = "حيد";
  remove.addEventListener("click", () => {
    if (els.taskFields.children.length === 1) {
      input.value = "";
      input.focus();
      return;
    }
    line.remove();
    updateWarning();
  });
  line.append(input, remove);
  els.taskFields.append(line);
}

function taskValues() {
  return [...els.taskFields.querySelectorAll("input")]
    .map((input) => input.value.trim())
    .filter(Boolean);
}

function updateWarning() {
  const days = Number(els.days.value);
  const start = els.start.value;
  if (!start || days < 3) {
    els.warn.hidden = true;
    return;
  }
  const draft = { days, start, done: {} };
  const pillars = flatCells(cellsOf(draft)).filter((cell) => cell.pillar);
  const missed = pillars.filter((cell) => cell.date < todayISO());
  if (missed.length) {
    const list = missed.map((cell) => `النهار ${cell.day}`).join(" و");
    els.warn.hidden = false;
    els.warn.textContent = `${list} ركيزة، وهاد الأيام فاتو. الدار غتخرب من الأول إلا ما عاودتيش البداية لليوم.`;
  } else {
    els.warn.hidden = true;
  }
}

function render() {
  const project = showSetup ? null : active();
  els.topActions.hidden = state.projects.length === 0;
  fillSwitcher();
  if (!project) {
    renderEmpty();
    return;
  }
  renderHouse(project);
  renderPlay(project);
}

function fillSwitcher() {
  els.switcher.replaceChildren();
  state.projects.forEach((project) => {
    const option = document.createElement("option");
    option.value = project.id;
    option.textContent = project.name;
    option.selected = project.id === state.activeId;
    els.switcher.append(option);
  });
}

function renderEmpty() {
  els.emptyLot.hidden = false;
  els.build.hidden = true;
  els.setup.hidden = false;
  els.play.hidden = true;
  els.stage.classList.remove("ruined");
  els.bubble.textContent = "سمّي المشروع وجيب الياجور. أنا ما كنبنيش بالنية.";
}

function renderHouse(project) {
  const today = todayISO();
  const rows = cellsOf(project);
  const cells = flatCells(rows);
  const ruined = isRuined(cells, project, today);
  const complete = cells.every((cell) => project.done[cell.date]);
  els.emptyLot.hidden = true;
  els.build.hidden = false;
  els.stage.classList.toggle("ruined", ruined);
  els.dust.hidden = !ruined;
  els.chimney.hidden = !complete;
  els.house.replaceChildren();
  const cols = Math.max(...rows.map((row) => row.cells.length));
  els.house.style.setProperty("--cols", String(cols));

  [...rows].reverse().forEach((row) => {
    const line = document.createElement("div");
    line.className = `row ${row.type}`;
    line.style.setProperty("--count", String(row.cells.length));
    row.cells.forEach((cell, index) => {
      const button = document.createElement("button");
      const status = statusOf(cell, project, today);
      button.type = "button";
      button.className = `cell ${status}${cell.pillar ? " pillar" : ""}${justDate === cell.date ? " just" : ""}`;
      button.style.setProperty("--d", `${(cell.day + index) * 28}ms`);
      button.textContent = String(cell.day);
      button.title = `${cell.date}${cell.pillar ? " · ركيزة" : ""}`;
      button.setAttribute("aria-label", labelFor(cell, status));
      button.addEventListener("click", () => {
        els.bubble.textContent = speechFor(cell, status, ruined);
      });
      line.append(button);
    });
    els.house.append(line);
  });

  els.bubble.textContent = summary(project, cells, today, ruined, complete);
}

function labelFor(cell, status) {
  const role = cell.pillar ? "ركيزة" : "ياجورة";
  if (status === "done") return `${role} النهار ${cell.day} متحطة`;
  if (status === "hole") return `${role} النهار ${cell.day} خاوية`;
  if (status === "today") return `بلاصة اليوم، النهار ${cell.day}`;
  return `النهار ${cell.day} مازال`;
}

function speechFor(cell, status, ruined) {
  if (cell.pillar && status === "hole") return "أنا الركيزة. غبتي، الدار طاحت. مبروك على الكوميديا.";
  if (status === "hole") return "فات النهار وأنا فالكيس. الحفرة هي اللي بقات.";
  if (status === "today" && cell.pillar) return "اليوم ركيزة. كمّل المهام وحطني، وإلا غدا الدار كتطيح.";
  if (status === "today") return "هادي بلاصة اليوم بوحدها. ما تلسقنيش فحفرة خرى.";
  if (status === "done" && ruined) return "أنا متحط، غير الدار طايحة. الركيزة هي اللي خذلاتنا.";
  if (status === "done") return "أنا فبلاصتي. ما تزيحنيش، ثقيلة.";
  return "مازال. الياجورة ما كتعجبهاش الاستعجال.";
}

function summary(project, cells, today, ruined, complete) {
  if (ruined) return "الركيزة تخلات خاوية، الدار تخربات. الياجور قال: أنا درت خدمتي.";
  if (complete) return "الشكل تكمل. دار واقفة، والياجور طلب كاس شاي.";
  const holes = cells.filter((cell) => statusOf(cell, project, today) === "hole").length;
  if (holes) return `كاين ${holes} حفر فالحيط. الدار واقفة، غير الريح داخل.`;
  const todayCell = cells.find((cell) => cell.date === today);
  if (todayCell && !project.done[today] && todayCell.pillar) {
    return "اليوم ركيزة. إلا ما تحطاتش قبل ما يفوت النهار، الدار غتخرب.";
  }
  if (todayCell && project.done[today]) return "ياجورة اليوم فبلاصتها. غدا حفرة جديدة كتستناك.";
  if (todayCell) return "كمّل مهام اليوم كاملين، ومن بعد حط الياجورة فبلاصة اليوم.";
  if (today < project.start) return "المشروع مازال ما بدا. الياجور كيتسنى فالكيس.";
  return "الأيام سالاو. شوف الدار واش واقفة ولا ولات نكتة.";
}

function renderPlay(project) {
  const today = todayISO();
  const cells = flatCells(cellsOf(project));
  const ruined = isRuined(cells, project, today);
  const doneCount = cells.filter((cell) => project.done[cell.date]).length;
  const holes = cells.filter((cell) => statusOf(cell, project, today) === "hole").length;
  const todayCell = cells.find((cell) => cell.date === today);
  els.setup.hidden = true;
  els.play.hidden = false;
  els.kicker.textContent = ruined ? "الدار تخربات" : "الدار كتبنى";
  els.title.textContent = project.name;
  const left = Math.max(0, project.days - doneCount - holes);
  els.stats.replaceChildren();
  [
    doneCount === 1 ? "ياجورة واحدة" : `${doneCount} ياجورات`,
    `${holes} حفر`,
    `${left} باقيين`
  ].forEach((text) => {
    const badge = document.createElement("b");
    badge.textContent = text;
    els.stats.append(badge);
  });
  els.checks.replaceChildren();
  els.place.disabled = true;

  if (!todayCell) {
    els.hint.textContent = today < project.start
      ? `البداية ${project.start}. رجع فداك النهار، ولا عاود من اليوم.`
      : "الأيام كملو. ما بقا وين تحط ياجورة.";
    els.place.hidden = true;
    return;
  }

  els.place.hidden = false;
  if (project.done[today]) {
    els.hint.textContent = "مهام اليوم تسدّات، والياجورة راها فبلاصتها.";
    els.place.textContent = "الياجورة ديال اليوم واقفة";
    return;
  }

  const marks = project.checks[today] || {};
  project.tasks.forEach((task, index) => {
    const item = document.createElement("li");
    const label = document.createElement("label");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = Boolean(marks[index]);
    box.addEventListener("change", () => {
      project.checks[today] = project.checks[today] || {};
      project.checks[today][index] = box.checked;
      save();
      const ready = allChecked(project, today);
      els.place.disabled = !ready;
      els.hint.textContent = ready
        ? "المهام كاملين. الياجورة ثقيلة، حطها غير فبلاصة اليوم."
        : "كمّل المهام كاملين باش الياجورة تتهز. نص خدمة ما كيبنيش حيط.";
    });
    label.append(box, document.createTextNode(task));
    item.append(label);
    els.checks.append(item);
  });

  const ready = allChecked(project, today);
  els.place.disabled = !ready;
  els.place.textContent = "حط الياجورة فبلاصتها";
  els.hint.textContent = ready
    ? "المهام كاملين. الياجورة ثقيلة، حطها غير فبلاصة اليوم."
    : "كمّل المهام كاملين باش الياجورة تتهز. نص خدمة ما كيبنيش حيط.";
}

function createProject(event) {
  event.preventDefault();
  const name = els.name.value.trim();
  const tasks = taskValues();
  const days = Number(els.days.value);
  const start = els.start.value;
  if (!name || tasks.length === 0 || days < 3 || days > 48 || !start) return;
  const project = {
    id: uid(),
    name,
    tasks,
    days,
    start,
    done: {},
    checks: {}
  };
  state.projects.push(project);
  state.activeId = project.id;
  showSetup = false;
  justDate = "";
  save();
  render();
}

function placeBrick() {
  const project = active();
  const today = todayISO();
  if (!project || project.done[today] || !allChecked(project, today)) return;
  const todayCell = flatCells(cellsOf(project)).find((cell) => cell.date === today);
  if (!todayCell) return;
  project.done[today] = true;
  justDate = today;
  save();
  render();
}

function restart() {
  const project = active();
  if (!project) return;
  if (!window.confirm("نعاودو البناء من اليوم؟ الياجورات القديمة غتمشي، والركائز غتبدا معاك دابا.")) return;
  project.start = todayISO();
  project.done = {};
  project.checks = {};
  justDate = "";
  save();
  render();
}

function removeProject() {
  const project = active();
  if (!project) return;
  if (!window.confirm(`نهدمو «${project.name}»؟ الدار والمهام غيمشيو.`)) return;
  state.projects = state.projects.filter((item) => item.id !== project.id);
  state.activeId = state.projects[0]?.id || null;
  showSetup = state.projects.length === 0;
  save();
  render();
}

els.addTask.addEventListener("click", () => {
  const value = els.newTask.value.trim();
  if (!value) {
    els.newTask.focus();
    return;
  }
  addTaskField(value);
  els.newTask.value = "";
  els.newTask.focus();
});

els.newTask.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    els.addTask.click();
  }
});

els.days.addEventListener("input", updateWarning);
els.start.addEventListener("change", updateWarning);
els.setup.addEventListener("submit", createProject);
els.place.addEventListener("click", placeBrick);
els.restart.addEventListener("click", restart);
els.remove.addEventListener("click", removeProject);
els.another.addEventListener("click", () => {
  showSetup = true;
  renderEmpty();
  els.topActions.hidden = state.projects.length === 0;
});
els.switcher.addEventListener("change", () => {
  state.activeId = els.switcher.value;
  showSetup = false;
  justDate = "";
  save();
  render();
});

els.start.value = todayISO();
EXAMPLE_TASKS.forEach(addTaskField);
updateWarning();
render();
