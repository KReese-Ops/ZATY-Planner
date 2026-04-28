const Storage = (() => {
  const KEY_PREFIX = 'zaty_';
  const DEFAULT_DAY = { mostImportant: ['', '', ''], tasks: [], notes: '' };
  const VALID_PRIORITIES = new Set(['A', 'B', 'C']);
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
 
  function isValidDateStr(dateStr) {
    return typeof dateStr === 'string' && DATE_RE.test(dateStr);
  }
 
  function dayKey(dateStr) {
    if (!isValidDateStr(dateStr)) {
      throw new Error(`Invalid date string: ${dateStr}`);
    }
 
    return KEY_PREFIX + dateStr;
  }
 
  function normalizeMostImportant(value) {
    const items = Array.isArray(value) ? value : [];
 
    return [
      typeof items[0] === 'string' ? items[0] : '',
      typeof items[1] === 'string' ? items[1] : '',
      typeof items[2] === 'string' ? items[2] : ''
    ];
  }
 
  function normalizeTask(task) {
    if (!task || typeof task !== 'object') return null;
 
    const text = typeof task.text === 'string' ? task.text.trim() : '';
    if (!text) return null;
 
    return {
      id: typeof task.id === 'string' && task.id
        ? task.id
        : Date.now().toString(36) + Math.random().toString(36).slice(2),
      text,
      priority: VALID_PRIORITIES.has(task.priority) ? task.priority : 'B',
      done: Boolean(task.done),
      createdAt: typeof task.createdAt === 'string'
        ? task.createdAt
        : new Date().toISOString()
    };
  }
 
  function normalizeDay(data) {
    return {
      mostImportant: normalizeMostImportant(data?.mostImportant),
      tasks: Array.isArray(data?.tasks)
        ? data.tasks.map(normalizeTask).filter(Boolean)
        : [],
      notes: typeof data?.notes === 'string' ? data.notes : ''
    };
  }
 
  function loadDay(dateStr) {
    let raw;
 
    try {
      raw = localStorage.getItem(dayKey(dateStr));
    } catch {
      return { ...DEFAULT_DAY };
    }
 
    if (!raw) {
      return { ...DEFAULT_DAY };
    }
 
    try {
      return normalizeDay(JSON.parse(raw));
    } catch {
      return { ...DEFAULT_DAY };
    }
  }
 
  function saveDay(dateStr, data) {
    try {
      localStorage.setItem(dayKey(dateStr), JSON.stringify(normalizeDay(data)));
      return true;
    } catch {
      return false;
    }
  }
 
  function createTask(text, priority = 'B') {
    if (typeof text !== 'string') {
      throw new Error('Task text must be a string');
    }
 
    const trimmedText = text.trim();
 
    if (!trimmedText) {
      throw new Error('Task text cannot be empty');
    }
 
    return {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      text: trimmedText,
      priority: VALID_PRIORITIES.has(priority) ? priority : 'B',
      done: false,
      createdAt: new Date().toISOString()
    };
  }
 
  function getAllDates() {
    const dates = [];
 
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
 
        if (!key || !key.startsWith(KEY_PREFIX)) continue;
 
        const dateStr = key.slice(KEY_PREFIX.length);
 
        if (isValidDateStr(dateStr)) {
          dates.push(dateStr);
        }
      }
    } catch {
      return [];
    }
 
    return dates.sort();
  }
 
  return {
    loadDay,
    saveDay,
    createTask,
    getAllDates
  };
})();
