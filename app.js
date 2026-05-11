const App = (() => {
  const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  const state = {
    selectedDate: toDateString(new Date()),
    day: null,
    deferredInstallPrompt: null
  };

  const els = {};

  function init() {
    cacheElements();
    bindEvents();
    loadSelectedDay();
    registerServiceWorker();
  }

  function cacheElements() {
    els.dateDisplay = document.getElementById('date-display');
    els.prevDay = document.getElementById('prev-day');
    els.nextDay = document.getElementById('next-day');
    els.today = document.getElementById('today-btn');
    els.install = document.getElementById('install-btn');
    els.print = document.getElementById('print-btn');
    els.miInputs = Array.from(document.querySelectorAll('.mi-input'));
    els.taskForm = document.getElementById('add-task-form');
    els.taskInput = document.getElementById('new-task-input');
    els.taskPriority = document.getElementById('new-task-priority');
    els.taskList = document.getElementById('task-list');
    els.emptyState = document.getElementById('empty-state');
    els.notes = document.getElementById('notes');
  }

  function bindEvents() {
    els.prevDay.addEventListener('click', () => changeDay(-1));
    els.nextDay.addEventListener('click', () => changeDay(1));
    els.today.addEventListener('click', () => selectDay(toDateString(new Date())));
    els.print.addEventListener('click', () => window.print());

    els.miInputs.forEach((input, index) => {
      input.addEventListener('input', () => {
        state.day.mostImportant[index] = input.value;
        persistDay();
      });
    });

    els.notes.addEventListener('input', () => {
      state.day.notes = els.notes.value;
      persistDay();
    });

    els.taskForm.addEventListener('submit', event => {
      event.preventDefault();
      addTask();
    });

    els.taskList.addEventListener('click', handleTaskClick);
    els.taskList.addEventListener('change', handleTaskChange);

    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      state.deferredInstallPrompt = event;
      els.install.hidden = false;
    });

    els.install.addEventListener('click', async () => {
      if (!state.deferredInstallPrompt) return;

      state.deferredInstallPrompt.prompt();
      await state.deferredInstallPrompt.userChoice;
      state.deferredInstallPrompt = null;
      els.install.hidden = true;
    });
  }

  function loadSelectedDay() {
    state.day = Storage.loadDay(state.selectedDate);
    render();
  }

  function selectDay(dateStr) {
    state.selectedDate = dateStr;
    loadSelectedDay();
  }

  function changeDay(offset) {
    const date = parseDateString(state.selectedDate);
    date.setDate(date.getDate() + offset);
    selectDay(toDateString(date));
  }

  function render() {
    renderDate();
    renderMostImportant();
    renderTasks();
    els.notes.value = state.day.notes;
  }

  function renderDate() {
    els.dateDisplay.textContent = DATE_FORMATTER.format(parseDateString(state.selectedDate));
  }

  function renderMostImportant() {
    els.miInputs.forEach((input, index) => {
      input.value = state.day.mostImportant[index] || '';
    });
  }

  function renderTasks() {
    const tasks = [...state.day.tasks].sort(compareTasks);

    els.taskList.innerHTML = '';
    els.emptyState.hidden = tasks.length > 0;

    tasks.forEach(task => {
      els.taskList.appendChild(createTaskElement(task));
    });
  }

  function createTaskElement(task) {
    const row = document.createElement('article');
    row.className = `task-row${task.done ? ' is-done' : ''}`;
    row.setAttribute('role', 'listitem');
    row.dataset.taskId = task.id;

    const checkLabel = document.createElement('label');
    checkLabel.className = 'task-check';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = task.done;
    checkbox.setAttribute('aria-label', `Mark ${task.text} complete`);

    const customCheck = document.createElement('span');
    customCheck.setAttribute('aria-hidden', 'true');

    checkLabel.append(checkbox, customCheck);

    const text = document.createElement('p');
    text.className = 'task-text';
    text.textContent = task.text;

    const priority = document.createElement('span');
    priority.className = `task-priority priority-${task.priority.toLowerCase()}`;
    priority.textContent = task.priority;
    priority.title = `Priority ${task.priority}`;

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'delete-task';
    deleteButton.dataset.action = 'delete-task';
    deleteButton.setAttribute('aria-label', `Delete ${task.text}`);
    deleteButton.textContent = 'Delete';

    row.append(checkLabel, text, priority, deleteButton);
    return row;
  }

  function addTask() {
    const text = els.taskInput.value;
    if (!text.trim()) {
      els.taskInput.focus();
      return;
    }

    state.day.tasks.push(Storage.createTask(text, els.taskPriority.value));
    els.taskInput.value = '';
    els.taskPriority.value = 'B';
    persistDay();
    renderTasks();
    els.taskInput.focus();
  }

  function handleTaskClick(event) {
    const deleteButton = event.target.closest('[data-action="delete-task"]');
    if (!deleteButton) return;

    const row = deleteButton.closest('[data-task-id]');
    state.day.tasks = state.day.tasks.filter(task => task.id !== row.dataset.taskId);
    persistDay();
    renderTasks();
  }

  function handleTaskChange(event) {
    if (event.target.type !== 'checkbox') return;

    const row = event.target.closest('[data-task-id]');
    const task = state.day.tasks.find(item => item.id === row.dataset.taskId);
    if (!task) return;

    task.done = event.target.checked;
    persistDay();
    renderTasks();
  }

  function persistDay() {
    Storage.saveDay(state.selectedDate, state.day);
  }

  function compareTasks(a, b) {
    if (a.done !== b.done) return Number(a.done) - Number(b.done);
    if (a.priority !== b.priority) return a.priority.localeCompare(b.priority);

    return a.createdAt.localeCompare(b.createdAt);
  }

  function toDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function parseDateString(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch(() => {
        // The planner still works without offline caching.
      });
    });
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);
