const Storage = (() => {
  const KEY_PREFIX = 'zaty_';

  function dayKey(date) {
    return KEY_PREFIX + date;
  }

  function loadDay(dateStr) {
    const raw = localStorage.getItem(dayKey(dateStr));
    if (!raw) {
      return { mostImportant: ['', '', ''], tasks: [], notes: '' };
    }
    try {
      const data = JSON.parse(raw);
      // Ensure mostImportant is always a 3-element array
      if (!Array.isArray(data.mostImportant)) data.mostImportant = ['', '', ''];
      while (data.mostImportant.length < 3) data.mostImportant.push('');
      data.mostImportant = data.mostImportant.slice(0, 3);
      if (!Array.isArray(data.tasks)) data.tasks = [];
      if (typeof data.notes !== 'string') data.notes = '';
      return data;
    } catch {
      return { mostImportant: ['', '', ''], tasks: [], notes: '' };
    }
  }

  function saveDay(dateStr, data) {
    localStorage.setItem(dayKey(dateStr), JSON.stringify(data));
  }

  function createTask(text, priority = 'B') {
    return {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      text: text.trim(),
      priority,
      done: false,
      createdAt: new Date().toISOString()
    };
  }

  function getAllDates() {
    const dates = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(KEY_PREFIX)) {
        dates.push(key.slice(KEY_PREFIX.length));
      }
    }
    return dates.sort();
  }

  return { loadDay, saveDay, createTask, getAllDates };
})();
