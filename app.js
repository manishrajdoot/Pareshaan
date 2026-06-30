/**
 * PARESHAAN - Main Application Script
 * Made by Manish Rajdoot
 * Version 1.0.0
 */

'use strict';

// =============================================
// APP STATE & STORAGE
// =============================================

const APP_KEY = 'pareshaan_data';

const defaultState = {
  tasks: [],
  alarms: [],
  reminders: [],
  settings: {
    theme: 'dark',
    dailyReminder: false,
    dailyReminderTime: '08:00',
    notificationsEnabled: false
  }
};

let state = loadState();
let editingTaskId = null;
let editingAlarmId = null;
let editingReminderId = null;
let activeAlarmAudio = null;
let activeAlarmInterval = null;
let alarmCheckInterval = null;
let confirmCallback = null;
let deferredInstallPrompt = null;
let selectedDays = [];

// =============================================
// UTILITY FUNCTIONS
// =============================================

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function loadState() {
  try {
    const saved = localStorage.getItem(APP_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...defaultState, ...parsed, settings: { ...defaultState.settings, ...parsed.settings } };
    }
  } catch (e) { console.warn('State load error:', e); }
  return JSON.parse(JSON.stringify(defaultState));
}

function saveState() {
  try {
    localStorage.setItem(APP_KEY, JSON.stringify(state));
  } catch (e) { console.warn('State save error:', e); }
}

function formatTime12(time24) {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isOverdue(dateStr, timeStr) {
  if (!dateStr) return false;
  const now = new Date();
  const due = new Date(dateStr + (timeStr ? `T${timeStr}` : 'T23:59:59'));
  return due < now;
}

function getDayName(dayIndex) {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayIndex];
}

function getTodayDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// =============================================
// AUDIO ENGINE
// =============================================

const AudioEngine = {
  ctx: null,

  getCtx() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch(e) { return null; }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },

  playBell(repeat = false) {
    const ctx = this.getCtx();
    if (!ctx) return;
    const play = () => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.8);
    };
    play();
    if (repeat) {
      return setInterval(play, 1200);
    }
  },

  playBeep(repeat = false) {
    const ctx = this.getCtx();
    if (!ctx) return;
    const play = () => {
      [0, 0.3, 0.6].forEach(offset => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'square';
        osc.frequency.setValueAtTime(1000, ctx.currentTime + offset);
        gain.gain.setValueAtTime(0.3, ctx.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.2);
        osc.start(ctx.currentTime + offset);
        osc.stop(ctx.currentTime + offset + 0.2);
      });
    };
    play();
    if (repeat) return setInterval(play, 1500);
  },

  playChime(repeat = false) {
    const ctx = this.getCtx();
    if (!ctx) return;
    const notes = [523, 659, 784, 1047];
    const play = () => {
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15);
        gain.gain.setValueAtTime(0.4, ctx.currentTime + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.6);
        osc.start(ctx.currentTime + i * 0.15);
        osc.stop(ctx.currentTime + i * 0.15 + 0.6);
      });
    };
    play();
    if (repeat) return setInterval(play, 2000);
  },

  playDigital(repeat = false) {
    const ctx = this.getCtx();
    if (!ctx) return;
    const play = () => {
      for (let i = 0; i < 6; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(i % 2 === 0 ? 800 : 600, ctx.currentTime + i * 0.1);
        gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.08);
        osc.start(ctx.currentTime + i * 0.1);
        osc.stop(ctx.currentTime + i * 0.1 + 0.08);
      }
    };
    play();
    if (repeat) return setInterval(play, 1800);
  },

  playSound(type, repeat = false) {
    switch(type) {
      case 'bell': return this.playBell(repeat);
      case 'beep': return this.playBeep(repeat);
      case 'chime': return this.playChime(repeat);
      case 'digital': return this.playDigital(repeat);
      default: return this.playBell(repeat);
    }
  },

  playNotificationSound() {
    this.playChime(false);
  },

  stopInterval(intervalId) {
    if (intervalId) clearInterval(intervalId);
  }
};

// =============================================
// VIBRATION ENGINE
// =============================================

const VibrationEngine = {
  vibrate(pattern) {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  },
  alarmVibrate() {
    this.vibrate([500, 200, 500, 200, 500, 200, 1000]);
  },
  notificationVibrate() {
    this.vibrate([200, 100, 200]);
  },
  successVibrate() {
    this.vibrate([100, 50, 100]);
  },
  stopVibrate() {
    if ('vibrate' in navigator) navigator.vibrate(0);
  }
};

// =============================================
// NOTIFICATIONS
// =============================================

const NotificationManager = {
  async requestPermission() {
    if (!('Notification' in window)) {
      showToast('❌', 'Notifications supported nahi hai is browser mein');
      return false;
    }
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') {
      showToast('❌', 'Notifications blocked hai. Browser settings mein allow karo.');
      return false;
    }
    const result = await Notification.requestPermission();
    if (result === 'granted') {
      state.settings.notificationsEnabled = true;
      saveState();
      showToast('✅', 'Notifications enabled!');
      VibrationEngine.successVibrate();
      return true;
    }
    return false;
  },

  show(title, body, options = {}) {
    if (Notification.permission !== 'granted') return;
    const notif = new Notification(title, {
      body,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-72.png',
      vibrate: [200, 100, 200],
      tag: options.tag || 'pareshaan',
      requireInteraction: options.requireInteraction || false,
      ...options
    });
    notif.onclick = () => { window.focus(); notif.close(); };
    return notif;
  },

  showViaServiceWorker(title, body, tag) {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_NOTIFICATION',
        title, body, tag
      });
    } else {
      this.show(title, body, { tag });
    }
  }
};

// =============================================
// ALARM SYSTEM
// =============================================

const AlarmSystem = {
  start() {
    if (alarmCheckInterval) clearInterval(alarmCheckInterval);
    alarmCheckInterval = setInterval(() => this.check(), 10000); // check every 10s
    this.check();
  },

  check() {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const currentDay = now.getDay();

    // Check alarms
    state.alarms.forEach(alarm => {
      if (!alarm.active) return;
      if (alarm.time !== currentTime) return;
      const lastFired = alarm.lastFired;
      const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
      if (lastFired === todayKey) return;
      if (alarm.days.length > 0 && !alarm.days.includes(currentDay)) return;

      alarm.lastFired = todayKey;
      saveState();
      this.ring(alarm);
    });

    // Check reminders
    state.reminders.forEach(reminder => {
      if (!reminder.active) return;
      if (!reminder.time) return;
      if (reminder.time !== currentTime) return;

      const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
      if (reminder.lastFired === todayKey) return;

      if (reminder.date && reminder.date !== getTodayDateString()) {
        if (reminder.repeat === 'once') return;
      }

      if (reminder.repeat === 'weekdays' && (currentDay === 0 || currentDay === 6)) return;
      if (reminder.repeat === 'weekly') {
        const reminderDay = reminder.date ? new Date(reminder.date + 'T00:00:00').getDay() : -1;
        if (reminderDay !== currentDay) return;
      }

      reminder.lastFired = todayKey;
      if (reminder.repeat === 'once') reminder.active = false;
      saveState();
      this.fireReminder(reminder);
    });

    // Check task reminders
    state.tasks.forEach(task => {
      if (task.done || !task.reminder || !task.time || !task.date) return;
      if (task.date !== getTodayDateString()) return;
      if (task.time !== currentTime) return;
      const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
      if (task.reminderFired === todayKey) return;

      task.reminderFired = todayKey;
      saveState();
      this.fireTaskReminder(task);
    });
  },

  ring(alarm) {
    // Show ring modal
    const modal = document.getElementById('alarm-ring-modal');
    const labelEl = document.getElementById('ring-label');
    const timeEl = document.getElementById('ring-time');
    if (modal && labelEl && timeEl) {
      labelEl.textContent = alarm.label || '⏰ Alarm!';
      timeEl.textContent = formatTime12(alarm.time);
      modal.classList.remove('hidden');
    }

    // Play sound
    if (activeAlarmInterval) clearInterval(activeAlarmInterval);
    activeAlarmInterval = AudioEngine.playSound(alarm.sound || 'bell', true);

    // Vibrate
    if (alarm.vibrate !== false) {
      VibrationEngine.alarmVibrate();
      activeAlarmInterval && setTimeout(() => VibrationEngine.alarmVibrate(), 2000);
    }

    // Notification
    NotificationManager.showViaServiceWorker(
      `⏰ ${alarm.label || 'Alarm'}`,
      `Time: ${formatTime12(alarm.time)} — Uthho!`,
      'alarm-ring'
    );
  },

  fireReminder(reminder) {
    AudioEngine.playNotificationSound();
    VibrationEngine.notificationVibrate();
    NotificationManager.showViaServiceWorker(
      `🔔 ${reminder.title}`,
      reminder.message || 'Aapka reminder time ho gaya!',
      'reminder-' + reminder.id
    );
    showToast('🔔', reminder.title);
  },

  fireTaskReminder(task) {
    AudioEngine.playNotificationSound();
    VibrationEngine.notificationVibrate();
    NotificationManager.showViaServiceWorker(
      `📋 Task Reminder: ${task.title}`,
      task.desc || 'Ye task complete karna hai!',
      'task-' + task.id
    );
    showToast('📋', `Task: ${task.title}`);
  },

  stopRinging() {
    if (activeAlarmInterval) {
      clearInterval(activeAlarmInterval);
      activeAlarmInterval = null;
    }
    VibrationEngine.stopVibrate();
    document.getElementById('alarm-ring-modal')?.classList.add('hidden');
  },

  snooze() {
    this.stopRinging();
    const snoozeTime = new Date(Date.now() + 5 * 60 * 1000);
    const h = String(snoozeTime.getHours()).padStart(2,'0');
    const m = String(snoozeTime.getMinutes()).padStart(2,'0');
    showToast('😴', `Snoozed! ${h}:${m} pe bajega`);
  }
};

// =============================================
// DAILY REMINDER SCHEDULER
// =============================================

function scheduleDailyReminder() {
  if (!state.settings.dailyReminder) return;
  const time = state.settings.dailyReminderTime || '08:00';
  const [h, m] = time.split(':').map(Number);
  const now = new Date();
  let next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  const delay = next - now;
  setTimeout(() => {
    AudioEngine.playNotificationSound();
    VibrationEngine.notificationVibrate();
    NotificationManager.showViaServiceWorker(
      '🌅 Pareshaan — Good Morning!',
      `Aaj ${state.tasks.filter(t => !t.done).length} tasks pending hain. Shuru ho jao!`,
      'daily-reminder'
    );
    showToast('🌅', 'Daily reminder fired!');
    scheduleDailyReminder(); // reschedule for next day
  }, delay);
}

// =============================================
// TOAST NOTIFICATION
// =============================================

let toastTimeout = null;

function showToast(icon, msg, duration = 3000) {
  const toast = document.getElementById('toast');
  const toastIcon = document.getElementById('toast-icon');
  const toastMsg = document.getElementById('toast-msg');
  if (!toast) return;
  toastIcon.textContent = icon;
  toastMsg.textContent = msg;
  toast.classList.remove('hidden');
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.add('hidden'), duration);
}

// =============================================
// CONFIRM DIALOG
// =============================================

function showConfirm(msg, callback) {
  const modal = document.getElementById('confirm-modal');
  const msgEl = document.getElementById('confirm-msg');
  if (!modal || !msgEl) return;
  msgEl.textContent = msg;
  confirmCallback = callback;
  modal.classList.remove('hidden');
}

// =============================================
// THEME MANAGEMENT
// =============================================

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const icon = document.getElementById('theme-icon');
  if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.content = theme === 'dark' ? '#0f0f1a' : '#f0f4ff';
}

function toggleTheme() {
  state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark';
  applyTheme(state.settings.theme);
  saveState();
  showToast(state.settings.theme === 'dark' ? '🌙' : '☀️', `${state.settings.theme === 'dark' ? 'Dark' : 'Light'} mode on!`);
}

// =============================================
// LIVE CLOCK
// =============================================

function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  const clockEl = document.getElementById('live-clock');
  if (clockEl) clockEl.textContent = `${h}:${m}:${s}`;

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayEl = document.getElementById('live-day');
  if (dayEl) dayEl.textContent = days[now.getDay()];

  const dateEl = document.getElementById('current-date');
  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  }
}

// =============================================
// STATS UPDATE
// =============================================

function updateStats() {
  const total = state.tasks.length;
  const done = state.tasks.filter(t => t.done).length;
  const pending = total - done;
  const alarms = state.alarms.filter(a => a.active).length;

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-done').textContent = done;
  document.getElementById('stat-pending').textContent = pending;
  document.getElementById('stat-alarms').textContent = alarms;
}

// =============================================
// TASKS
// =============================================

function renderTasks(filter = 'all') {
  const list = document.getElementById('task-list');
  const empty = document.getElementById('tasks-empty');
  if (!list) return;

  let tasks = [...state.tasks];
  switch (filter) {
    case 'pending': tasks = tasks.filter(t => !t.done); break;
    case 'done': tasks = tasks.filter(t => t.done); break;
    case 'high': tasks = tasks.filter(t => t.priority === 'high'); break;
    case 'medium': tasks = tasks.filter(t => t.priority === 'medium'); break;
    case 'low': tasks = tasks.filter(t => t.priority === 'low'); break;
  }

  // Sort: pending first, then by priority
  tasks.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const pOrder = { high: 0, medium: 1, low: 2 };
    return (pOrder[a.priority] || 1) - (pOrder[b.priority] || 1);
  });

  // Remove old cards (keep empty state)
  const cards = list.querySelectorAll('.task-card');
  cards.forEach(c => c.remove());

  if (tasks.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  const catEmoji = { personal: '👤', work: '💼', health: '❤️', study: '📚', finance: '💰', other: '📌' };

  tasks.forEach(task => {
    const card = document.createElement('div');
    card.className = `task-card priority-${task.priority} ${task.done ? 'completed' : ''}`;
    card.dataset.id = task.id;

    const overdue = !task.done && isOverdue(task.date, task.time);

    card.innerHTML = `
      <div class="task-checkbox ${task.done ? 'checked' : ''}" data-id="${task.id}" role="button" aria-label="Toggle task"></div>
      <div class="task-body">
        <div class="task-title">${escapeHtml(task.title)}</div>
        ${task.desc ? `<div class="task-desc">${escapeHtml(task.desc)}</div>` : ''}
        <div class="task-meta">
          <span class="task-badge badge-${task.priority}">${task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢'} ${capitalize(task.priority)}</span>
          ${task.category ? `<span class="task-badge badge-category">${catEmoji[task.category] || '📌'} ${capitalize(task.category)}</span>` : ''}
          ${task.date ? `<span class="task-badge ${overdue ? 'badge-overdue' : 'badge-date'}">${overdue ? '⚠️ Overdue' : '📅'} ${formatDate(task.date)}</span>` : ''}
          ${task.time ? `<span class="task-badge badge-date">⏰ ${formatTime12(task.time)}</span>` : ''}
        </div>
      </div>
      <div class="task-actions">
        <button class="task-action-btn edit-task" data-id="${task.id}" title="Edit">✏️</button>
        <button class="task-action-btn delete delete-task" data-id="${task.id}" title="Delete">🗑️</button>
      </div>
    `;
    list.appendChild(card);
  });
}

function openTaskModal(taskId = null) {
  editingTaskId = taskId;
  const modal = document.getElementById('task-modal');
  const title = document.getElementById('task-modal-title');
  const today = getTodayDateString();

  if (taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;
    title.textContent = '✏️ Edit Task';
    document.getElementById('task-title').value = task.title || '';
    document.getElementById('task-desc').value = task.desc || '';
    document.getElementById('task-priority').value = task.priority || 'medium';
    document.getElementById('task-category').value = task.category || 'personal';
    document.getElementById('task-date').value = task.date || '';
    document.getElementById('task-time').value = task.time || '';
    document.getElementById('task-reminder-check').checked = task.reminder || false;
  } else {
    title.textContent = '📋 Add New Task';
    document.getElementById('task-title').value = '';
    document.getElementById('task-desc').value = '';
    document.getElementById('task-priority').value = 'medium';
    document.getElementById('task-category').value = 'personal';
    document.getElementById('task-date').value = today;
    document.getElementById('task-time').value = '';
    document.getElementById('task-reminder-check').checked = false;
  }

  modal.classList.remove('hidden');
  setTimeout(() => document.getElementById('task-title').focus(), 300);
}

function saveTask() {
  const title = document.getElementById('task-title').value.trim();
  if (!title) { showToast('⚠️', 'Task title dalna zaroori hai!'); return; }

  const taskData = {
    title,
    desc: document.getElementById('task-desc').value.trim(),
    priority: document.getElementById('task-priority').value,
    category: document.getElementById('task-category').value,
    date: document.getElementById('task-date').value,
    time: document.getElementById('task-time').value,
    reminder: document.getElementById('task-reminder-check').checked,
    done: false,
    createdAt: Date.now()
  };

  if (editingTaskId) {
    const idx = state.tasks.findIndex(t => t.id === editingTaskId);
    if (idx !== -1) {
      taskData.done = state.tasks[idx].done;
      taskData.createdAt = state.tasks[idx].createdAt;
      state.tasks[idx] = { ...state.tasks[idx], ...taskData };
    }
    showToast('✅', 'Task updated!');
  } else {
    taskData.id = generateId();
    state.tasks.unshift(taskData);
    showToast('✅', 'Task add ho gaya!');
    AudioEngine.playNotificationSound();
    VibrationEngine.successVibrate();
  }

  saveState();
  closeModal('task-modal');
  renderTasks(getCurrentFilter());
  updateStats();
}

function toggleTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  task.done = !task.done;
  task.completedAt = task.done ? Date.now() : null;
  saveState();
  if (task.done) {
    AudioEngine.playChime(false);
    VibrationEngine.successVibrate();
    showToast('🎉', 'Task complete! Shabash!');
  }
  renderTasks(getCurrentFilter());
  updateStats();
}

function deleteTask(id) {
  showConfirm('Is task ko delete karna chahte ho?', () => {
    state.tasks = state.tasks.filter(t => t.id !== id);
    saveState();
    renderTasks(getCurrentFilter());
    updateStats();
    showToast('🗑️', 'Task delete ho gaya!');
  });
}

function getCurrentFilter() {
  const activeChip = document.querySelector('.chip.active');
  return activeChip ? activeChip.dataset.filter : 'all';
}

// =============================================
// ALARMS
// =============================================

function renderAlarms() {
  const list = document.getElementById('alarm-list');
  const empty = document.getElementById('alarms-empty');
  if (!list) return;

  const cards = list.querySelectorAll('.alarm-card');
  cards.forEach(c => c.remove());

  if (state.alarms.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  state.alarms.forEach(alarm => {
    const card = document.createElement('div');
    card.className = 'alarm-card';
    card.dataset.id = alarm.id;

    const daysHtml = alarm.days.length > 0
      ? alarm.days.map(d => `<span class="alarm-day-dot">${getDayName(d)}</span>`).join('')
      : '<span class="alarm-day-dot">Once</span>';

    card.innerHTML = `
      <div class="alarm-time-display">${formatTime12(alarm.time)}</div>
      <div class="alarm-info">
        <div class="alarm-label">${escapeHtml(alarm.label || 'Alarm')}</div>
        <div class="alarm-days">${daysHtml}</div>
      </div>
      <div class="alarm-controls">
        <label class="toggle-switch" title="Enable/Disable">
          <input type="checkbox" class="alarm-toggle" data-id="${alarm.id}" ${alarm.active ? 'checked' : ''} />
          <span class="toggle-slider"></span>
        </label>
        <button class="alarm-delete-btn" data-id="${alarm.id}" title="Delete">🗑️</button>
      </div>
    `;
    list.appendChild(card);
  });
}

function openAlarmModal(alarmId = null) {
  editingAlarmId = alarmId;
  selectedDays = [];
  const modal = document.getElementById('alarm-modal');
  const title = document.getElementById('alarm-modal-title');

  // Reset day buttons
  document.querySelectorAll('.day-btn').forEach(btn => btn.classList.remove('selected'));

  if (alarmId) {
    const alarm = state.alarms.find(a => a.id === alarmId);
    if (!alarm) return;
    title.textContent = '✏️ Edit Alarm';
    document.getElementById('alarm-label').value = alarm.label || '';
    document.getElementById('alarm-time').value = alarm.time || '';
    document.getElementById('alarm-sound').value = alarm.sound || 'bell';
    document.getElementById('alarm-vibrate').checked = alarm.vibrate !== false;
    selectedDays = [...(alarm.days || [])];
    selectedDays.forEach(d => {
      const btn = document.querySelector(`.day-btn[data-day="${d}"]`);
      if (btn) btn.classList.add('selected');
    });
  } else {
    title.textContent = '⏰ Add New Alarm';
    document.getElementById('alarm-label').value = '';
    const now = new Date();
    document.getElementById('alarm-time').value = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    document.getElementById('alarm-sound').value = 'bell';
    document.getElementById('alarm-vibrate').checked = true;
  }

  modal.classList.remove('hidden');
}

function saveAlarm() {
  const time = document.getElementById('alarm-time').value;
  if (!time) { showToast('⚠️', 'Alarm time dalna zaroori hai!'); return; }

  const alarmData = {
    label: document.getElementById('alarm-label').value.trim() || 'Alarm',
    time,
    days: [...selectedDays],
    sound: document.getElementById('alarm-sound').value,
    vibrate: document.getElementById('alarm-vibrate').checked,
    active: true,
    createdAt: Date.now()
  };

  if (editingAlarmId) {
    const idx = state.alarms.findIndex(a => a.id === editingAlarmId);
    if (idx !== -1) state.alarms[idx] = { ...state.alarms[idx], ...alarmData };
    showToast('✅', 'Alarm updated!');
  } else {
    alarmData.id = generateId();
    state.alarms.unshift(alarmData);
    showToast('⏰', `Alarm set for ${formatTime12(time)}!`);
    AudioEngine.playBell(false);
    VibrationEngine.successVibrate();
  }

  saveState();
  closeModal('alarm-modal');
  renderAlarms();
  updateStats();
}

function toggleAlarm(id, active) {
  const alarm = state.alarms.find(a => a.id === id);
  if (!alarm) return;
  alarm.active = active;
  saveState();
  updateStats();
  showToast(active ? '⏰' : '🔕', active ? `Alarm on: ${formatTime12(alarm.time)}` : 'Alarm off');
}

function deleteAlarm(id) {
  showConfirm('Is alarm ko delete karna chahte ho?', () => {
    state.alarms = state.alarms.filter(a => a.id !== id);
    saveState();
    renderAlarms();
    updateStats();
    showToast('🗑️', 'Alarm delete ho gaya!');
  });
}

// =============================================
// REMINDERS
// =============================================

function renderReminders() {
  const list = document.getElementById('reminder-list');
  const empty = document.getElementById('reminders-empty');
  if (!list) return;

  const cards = list.querySelectorAll('.reminder-card');
  cards.forEach(c => c.remove());

  if (state.reminders.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  state.reminders.forEach(reminder => {
    const card = document.createElement('div');
    card.className = 'reminder-card';
    card.dataset.id = reminder.id;

    const repeatLabels = { once: 'Once', daily: '🔁 Daily', weekly: '📅 Weekly', weekdays: '💼 Weekdays' };

    card.innerHTML = `
      <div class="reminder-icon-wrap">🔔</div>
      <div class="reminder-body">
        <div class="reminder-title">${escapeHtml(reminder.title)}</div>
        ${reminder.message ? `<div class="reminder-msg">${escapeHtml(reminder.message)}</div>` : ''}
        <div class="reminder-meta">
          ${reminder.time ? `<span class="task-badge badge-date">⏰ ${formatTime12(reminder.time)}</span>` : ''}
          ${reminder.date ? `<span class="task-badge badge-date">📅 ${formatDate(reminder.date)}</span>` : ''}
          <span class="task-badge badge-category">${repeatLabels[reminder.repeat] || 'Once'}</span>
          ${!reminder.active ? '<span class="task-badge" style="background:rgba(239,68,68,0.15);color:#ef4444">Inactive</span>' : ''}
        </div>
      </div>
      <button class="reminder-delete-btn" data-id="${reminder.id}" title="Delete">🗑️</button>
    `;
    list.appendChild(card);
  });
}

function openReminderModal(reminderId = null) {
  editingReminderId = reminderId;
  const modal = document.getElementById('reminder-modal');
  const title = document.getElementById('reminder-modal-title');

  if (reminderId) {
    const reminder = state.reminders.find(r => r.id === reminderId);
    if (!reminder) return;
    title.textContent = '✏️ Edit Reminder';
    document.getElementById('reminder-title').value = reminder.title || '';
    document.getElementById('reminder-msg').value = reminder.message || '';
    document.getElementById('reminder-date').value = reminder.date || '';
    document.getElementById('reminder-time').value = reminder.time || '';
    document.getElementById('reminder-repeat').value = reminder.repeat || 'once';
  } else {
    title.textContent = '🔔 Add Reminder';
    document.getElementById('reminder-title').value = '';
    document.getElementById('reminder-msg').value = '';
    document.getElementById('reminder-date').value = getTodayDateString();
    document.getElementById('reminder-time').value = '';
    document.getElementById('reminder-repeat').value = 'once';
  }

  modal.classList.remove('hidden');
  setTimeout(() => document.getElementById('reminder-title').focus(), 300);
}

function saveReminder() {
  const title = document.getElementById('reminder-title').value.trim();
  const time = document.getElementById('reminder-time').value;
  if (!title) { showToast('⚠️', 'Reminder title dalna zaroori hai!'); return; }
  if (!time) { showToast('⚠️', 'Reminder time dalna zaroori hai!'); return; }

  const reminderData = {
    title,
    message: document.getElementById('reminder-msg').value.trim(),
    date: document.getElementById('reminder-date').value,
    time,
    repeat: document.getElementById('reminder-repeat').value,
    active: true,
    createdAt: Date.now()
  };

  if (editingReminderId) {
    const idx = state.reminders.findIndex(r => r.id === editingReminderId);
    if (idx !== -1) state.reminders[idx] = { ...state.reminders[idx], ...reminderData };
    showToast('✅', 'Reminder updated!');
  } else {
    reminderData.id = generateId();
    state.reminders.unshift(reminderData);
    showToast('🔔', 'Reminder set ho gaya!');
    AudioEngine.playNotificationSound();
    VibrationEngine.successVibrate();
  }

  saveState();
  closeModal('reminder-modal');
  renderReminders();
}

function deleteReminder(id) {
  showConfirm('Is reminder ko delete karna chahte ho?', () => {
    state.reminders = state.reminders.filter(r => r.id !== id);
    saveState();
    renderReminders();
    showToast('🗑️', 'Reminder delete ho gaya!');
  });
}

// =============================================
// MODAL MANAGEMENT
// =============================================

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('hidden');
}

// =============================================
// TAB NAVIGATION
// =============================================

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `tab-${tabName}`);
  });
}

// =============================================
// FAB MENU
// =============================================

function toggleFabMenu() {
  const fab = document.getElementById('fab-btn');
  const menu = document.getElementById('fab-menu');
  const overlay = document.getElementById('fab-overlay');
  const isOpen = !menu.classList.contains('hidden');

  if (isOpen) {
    menu.classList.add('hidden');
    overlay.classList.add('hidden');
    fab.classList.remove('open');
  } else {
    menu.classList.remove('hidden');
    overlay.classList.remove('hidden');
    fab.classList.add('open');
  }
}

function closeFabMenu() {
  document.getElementById('fab-menu')?.classList.add('hidden');
  document.getElementById('fab-overlay')?.classList.add('hidden');
  document.getElementById('fab-btn')?.classList.remove('open');
}

// =============================================
// HELPER FUNCTIONS
// =============================================

function escapeHtml(text) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(text || ''));
  return div.innerHTML;
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

// =============================================
// SERVICE WORKER REGISTRATION
// =============================================

async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      console.log('SW registered:', reg.scope);

      // Try periodic background sync
      if ('periodicSync' in reg) {
        try {
          await reg.periodicSync.register('daily-reminder', { minInterval: 24 * 60 * 60 * 1000 });
        } catch(e) { /* not supported */ }
      }
    } catch (e) {
      console.warn('SW registration failed:', e);
    }
  }
}

// =============================================
// PWA INSTALL
// =============================================

function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    const banner = document.getElementById('install-banner');
    if (banner) {
      setTimeout(() => banner.classList.remove('hidden'), 3000);
    }
  });

  window.addEventListener('appinstalled', () => {
    document.getElementById('install-banner')?.classList.add('hidden');
    showToast('🎉', 'Pareshaan install ho gaya!');
    deferredInstallPrompt = null;
  });
}

// =============================================
// EVENT LISTENERS
// =============================================

function setupEventListeners() {
  // Theme toggle
  document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);

  // Notification button
  document.getElementById('notif-btn')?.addEventListener('click', () => {
    NotificationManager.requestPermission();
  });

  // Tab navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Add buttons
  document.getElementById('add-task-btn')?.addEventListener('click', () => openTaskModal());
  document.getElementById('add-alarm-btn')?.addEventListener('click', () => openAlarmModal());
  document.getElementById('add-reminder-btn')?.addEventListener('click', () => openReminderModal());

  // Save buttons
  document.getElementById('save-task-btn')?.addEventListener('click', saveTask);
  document.getElementById('save-alarm-btn')?.addEventListener('click', saveAlarm);
  document.getElementById('save-reminder-btn')?.addEventListener('click', saveReminder);

  // Modal close buttons
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });

  // Close modal on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.add('hidden');
    });
  });

  // Filter chips
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      renderTasks(chip.dataset.filter);
    });
  });

  // Task list events (delegated)
  document.getElementById('task-list')?.addEventListener('click', (e) => {
    const checkbox = e.target.closest('.task-checkbox');
    const editBtn = e.target.closest('.edit-task');
    const deleteBtn = e.target.closest('.delete-task');

    if (checkbox) toggleTask(checkbox.dataset.id);
    if (editBtn) openTaskModal(editBtn.dataset.id);
    if (deleteBtn) deleteTask(deleteBtn.dataset.id);
  });

  // Alarm list events (delegated)
  document.getElementById('alarm-list')?.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.alarm-delete-btn');
    if (deleteBtn) deleteAlarm(deleteBtn.dataset.id);
  });

  document.getElementById('alarm-list')?.addEventListener('change', (e) => {
    const toggle = e.target.closest('.alarm-toggle');
    if (toggle) toggleAlarm(toggle.dataset.id, toggle.checked);
  });

  // Reminder list events (delegated)
  document.getElementById('reminder-list')?.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.reminder-delete-btn');
    if (deleteBtn) deleteReminder(deleteBtn.dataset.id);
  });

  // Day picker
  document.querySelectorAll('.day-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const day = parseInt(btn.dataset.day);
      if (selectedDays.includes(day)) {
        selectedDays = selectedDays.filter(d => d !== day);
        btn.classList.remove('selected');
      } else {
        selectedDays.push(day);
        btn.classList.add('selected');
      }
    });
  });

  // Alarm ring modal
  document.getElementById('stop-alarm-btn')?.addEventListener('click', () => AlarmSystem.stopRinging());
  document.getElementById('snooze-btn')?.addEventListener('click', () => AlarmSystem.snooze());

  // FAB
  document.getElementById('fab-btn')?.addEventListener('click', toggleFabMenu);
  document.getElementById('fab-overlay')?.addEventListener('click', closeFabMenu);
  document.getElementById('fab-task')?.addEventListener('click', () => { closeFabMenu(); openTaskModal(); });
  document.getElementById('fab-alarm')?.addEventListener('click', () => { closeFabMenu(); openAlarmModal(); });
  document.getElementById('fab-reminder')?.addEventListener('click', () => { closeFabMenu(); openReminderModal(); });

  // Daily reminder toggle
  document.getElementById('daily-reminder-toggle')?.addEventListener('change', (e) => {
    state.settings.dailyReminder = e.target.checked;
    saveState();
    const timeRow = document.getElementById('daily-time-row');
    if (timeRow) timeRow.style.display = e.target.checked ? 'flex' : 'none';
    if (e.target.checked) {
      NotificationManager.requestPermission().then(granted => {
        if (granted) {
          scheduleDailyReminder();
          showToast('🌅', 'Daily reminder on!');
        }
      });
    } else {
      showToast('🔕', 'Daily reminder off');
    }
  });

  document.getElementById('save-daily-time')?.addEventListener('click', () => {
    const time = document.getElementById('daily-reminder-time').value;
    state.settings.dailyReminderTime = time;
    saveState();
    scheduleDailyReminder();
    showToast('✅', `Daily reminder set for ${formatTime12(time)}`);
  });

  // Install banner
  document.getElementById('install-btn')?.addEventListener('click', async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      if (outcome === 'accepted') showToast('🎉', 'Installing Pareshaan...');
      deferredInstallPrompt = null;
      document.getElementById('install-banner')?.classList.add('hidden');
    }
  });

  document.getElementById('install-close')?.addEventListener('click', () => {
    document.getElementById('install-banner')?.classList.add('hidden');
  });

  // Confirm dialog
  document.getElementById('confirm-ok')?.addEventListener('click', () => {
    closeModal('confirm-modal');
    if (confirmCallback) { confirmCallback(); confirmCallback = null; }
  });

  document.getElementById('confirm-cancel')?.addEventListener('click', () => {
    closeModal('confirm-modal');
    confirmCallback = null;
  });

  // Clear all data
  document.getElementById('clear-all-data')?.addEventListener('click', () => {
    showConfirm('Saara data delete ho jayega! Pakka karna chahte ho?', () => {
      localStorage.removeItem(APP_KEY);
      state = JSON.parse(JSON.stringify(defaultState));
      renderTasks();
      renderAlarms();
      renderReminders();
      updateStats();
      showToast('🗑️', 'Saara data clear ho gaya!');
    });
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(m => m.classList.add('hidden'));
      closeFabMenu();
    }
  });

  // Handle URL params for shortcuts
  const params = new URLSearchParams(window.location.search);
  if (params.get('action') === 'add-task') setTimeout(() => openTaskModal(), 500);
  if (params.get('action') === 'add-alarm') setTimeout(() => { switchTab('alarms'); openAlarmModal(); }, 500);
}

// =============================================
// SPLASH SCREEN
// =============================================

function hideSplash() {
  const splash = document.getElementById('splash-screen');
  const app = document.getElementById('app');
  if (splash && app) {
    setTimeout(() => {
      splash.style.opacity = '0';
      setTimeout(() => {
        splash.style.display = 'none';
        app.classList.remove('hidden');
      }, 500);
    }, 2000);
  }
}

// =============================================
// INIT DAILY REMINDER UI
// =============================================

function initDailyReminderUI() {
  const toggle = document.getElementById('daily-reminder-toggle');
  const timeRow = document.getElementById('daily-time-row');
  const timeInput = document.getElementById('daily-reminder-time');

  if (toggle) toggle.checked = state.settings.dailyReminder;
  if (timeRow) timeRow.style.display = state.settings.dailyReminder ? 'flex' : 'none';
  if (timeInput) timeInput.value = state.settings.dailyReminderTime || '08:00';
}

// =============================================
// MAIN INIT
// =============================================

document.addEventListener('DOMContentLoaded', () => {
  // Apply saved theme
  applyTheme(state.settings.theme);

  // Register service worker
  registerServiceWorker();

  // Setup install prompt
  setupInstallPrompt();

  // Setup event listeners
  setupEventListeners();

  // Init daily reminder UI
  initDailyReminderUI();

  // Render initial data
  renderTasks();
  renderAlarms();
  renderReminders();
  updateStats();

  // Start live clock
  updateClock();
  setInterval(updateClock, 1000);

  // Start alarm system
  AlarmSystem.start();

  // Schedule daily reminder if enabled
  if (state.settings.dailyReminder) scheduleDailyReminder();

  // Hide splash
  hideSplash();

  // Welcome notification (first time)
  const isFirstVisit = !localStorage.getItem('pareshaan_visited');
  if (isFirstVisit) {
    localStorage.setItem('pareshaan_visited', '1');
    setTimeout(() => {
      showToast('👋', 'Pareshaan mein aapka swagat hai!', 4000);
    }, 2500);
  }

  console.log('%c⏰ Pareshaan v1.0.0', 'color: #7c3aed; font-size: 18px; font-weight: bold;');
  console.log('%cMade by Manish Rajdoot', 'color: #ec4899; font-size: 12px;');
});
