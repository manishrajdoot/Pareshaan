/**
 * PARESHAAN - Main Application Script
 * Made by Manish Rajdoot
 * Version 3.0.0
 */

'use strict';

// =============================================
// APP STATE & STORAGE
// =============================================

const APP_KEY = 'pareshaan_data';
const APP_VERSION = '3.0.0';

const defaultState = {
  tasks: [],
  alarms: [],
  reminders: [],
  settings: {
    theme: 'dark',
    accentColor: 'purple',
    language: 'en',
    dailyReminder: false,
    dailyReminderTime: '08:00',
    notificationsEnabled: false,
    snoozeMinutes: 5,
    pinEnabled: false,
    pinCode: '',
    lastBackupPrompt: 0
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
let taskSearchQuery = '';
let taskSortMode = 'default';
let lastDeleted = null;
let undoTimeout = null;
let newServiceWorker = null;
let modalSubtasks = [];
let pendingCustomSound = null;
let bulkMode = false;
let selectedTaskIds = new Set();
let calendarViewDate = new Date();
let calendarSelectedDate = null;
let calendarMode = 'month';
let locationWatchId = null;
let sessionUnlocked = false;
let draggedTaskId = null;

// =============================================
// TRANSLATIONS (EN / HI)
// =============================================

const TRANSLATIONS = {
  en: {
    tagline: 'Stay on track. Stay focused.',
    tab_tasks: 'Tasks', tab_alarms: 'Alarms', tab_reminders: 'Reminders',
    tab_calendar: 'Calendar', tab_insights: 'Insights', tab_settings: 'Settings', tab_about: 'About',
    my_tasks: '📋 My Tasks', add_task: '+ Add Task',
    my_alarms: '⏰ Alarms', add_alarm: '+ Add Alarm',
    daily_reminders: '🔔 Daily Reminders', add_reminder: '+ Add Reminder',
    calendar_title: '📅 Calendar', insights_title: '📊 Insights', settings_title: '⚙️ Settings',
    search_placeholder: 'Search tasks or tags...',
    select_btn: '☑ Select', cancel_btn: 'Cancel', done_btn: 'Done',
    complete_btn: '✅ Complete', delete_btn: '🗑️ Delete',
    empty_tasks_title: 'No tasks yet!', empty_tasks_desc: 'Add your first task and get started.',
    empty_search_title: 'No matching tasks!', empty_search_desc: 'Try a different search term.',
    empty_alarms_title: 'No alarms yet!', empty_alarms_desc: 'Set your first alarm.',
    empty_reminders_title: 'No reminders yet!', empty_reminders_desc: 'Add your first reminder.',
    daily_morning: 'Daily Morning Reminder', daily_morning_desc: 'Get reminded every morning',
    week_progress: 'Overall Progress'
  },
  hi: {
    tagline: 'काम पर ध्यान दो, फोकस में रहो।',
    tab_tasks: 'कार्य', tab_alarms: 'अलार्म', tab_reminders: 'रिमाइंडर',
    tab_calendar: 'कैलेंडर', tab_insights: 'जानकारी', tab_settings: 'सेटिंग्स', tab_about: 'ऐप के बारे में',
    my_tasks: '📋 मेरे कार्य', add_task: '+ कार्य जोड़ें',
    my_alarms: '⏰ अलार्म', add_alarm: '+ अलार्म जोड़ें',
    daily_reminders: '🔔 रोज़ के रिमाइंडर', add_reminder: '+ रिमाइंडर जोड़ें',
    calendar_title: '📅 कैलेंडर', insights_title: '📊 जानकारी', settings_title: '⚙️ सेटिंग्स',
    search_placeholder: 'कार्य या टैग खोजें...',
    select_btn: '☑ चुनें', cancel_btn: 'रद्द करें', done_btn: 'हो गया',
    complete_btn: '✅ पूरा करें', delete_btn: '🗑️ हटाएं',
    empty_tasks_title: 'अभी कोई कार्य नहीं!', empty_tasks_desc: 'अपना पहला कार्य जोड़ें और शुरू करें।',
    empty_search_title: 'कोई मेल खाता कार्य नहीं!', empty_search_desc: 'कोई और शब्द खोजें।',
    empty_alarms_title: 'अभी कोई अलार्म नहीं!', empty_alarms_desc: 'अपना पहला अलार्म सेट करें।',
    empty_reminders_title: 'अभी कोई रिमाइंडर नहीं!', empty_reminders_desc: 'अपना पहला रिमाइंडर जोड़ें।',
    daily_morning: 'सुबह का रिमाइंडर', daily_morning_desc: 'हर सुबह याद दिलाया जाएगा',
    week_progress: 'कुल प्रगति'
  }
};

function t(key) {
  const lang = state.settings.language || 'en';
  return (TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) || TRANSLATIONS.en[key] || key;
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.documentElement.lang = state.settings.language === 'hi' ? 'hi' : 'en';
}

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
      const merged = { ...defaultState, ...parsed, settings: { ...defaultState.settings, ...parsed.settings } };
      merged.tasks = (merged.tasks || []).map((task, i) => ({
        subtasks: [], tags: [], link: '', recurrence: 'none', order: i,
        ...task
      }));
      merged.alarms = (merged.alarms || []).map(alarm => ({
        group: '', customSound: null, customSoundName: '',
        ...alarm
      }));
      merged.reminders = (merged.reminders || []).map(reminder => ({
        locationEnabled: false, locationLat: null, locationLng: null, locationRadius: 300, locationLabel: '',
        ...reminder
      }));
      return merged;
    }
  } catch (e) { console.warn('State load error:', e); }
  return JSON.parse(JSON.stringify(defaultState));
}

function saveState() {
  try {
    localStorage.setItem(APP_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('State save error:', e);
    showToast('⚠️', 'Storage is full — try removing a custom alarm sound.');
  }
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

function dateStringFromDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function addDaysToDateString(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return dateStringFromDate(d);
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = deg => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// =============================================
// AUDIO ENGINE
// =============================================

const AudioEngine = {
  ctx: null,
  customAudioEl: null,

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
    if (repeat) return setInterval(play, 1200);
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

  playCustom(dataUrl, repeat = false) {
    if (!this.customAudioEl) {
      this.customAudioEl = document.getElementById('custom-alarm-audio');
    }
    const el = this.customAudioEl;
    if (!el) return null;
    el.src = dataUrl;
    el.loop = !!repeat;
    el.currentTime = 0;
    el.play().catch(() => {});
    return 'custom';
  },

  stopCustom() {
    if (this.customAudioEl) {
      this.customAudioEl.pause();
      this.customAudioEl.currentTime = 0;
    }
  },

  playSound(type, repeat = false, customDataUrl = null) {
    if (customDataUrl) return this.playCustom(customDataUrl, repeat);
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
    if (intervalId && intervalId !== 'custom') clearInterval(intervalId);
    if (intervalId === 'custom') this.stopCustom();
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
      showToast('❌', 'Notifications are not supported in this browser');
      return false;
    }
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') {
      showToast('❌', 'Notifications are blocked. Allow them in your browser settings.');
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
// PIN LOCK
// =============================================

const PinLock = {
  isLockedNow() {
    return state.settings.pinEnabled && !!state.settings.pinCode && !sessionUnlocked;
  },

  showLockScreen() {
    const overlay = document.getElementById('pin-lock-overlay');
    if (overlay) overlay.classList.remove('hidden');
    document.getElementById('app')?.classList.add('hidden');
    document.getElementById('splash-screen')?.classList.add('hidden');
    setTimeout(() => document.getElementById('pin-input')?.focus(), 200);
  },

  hideLockScreen() {
    document.getElementById('pin-lock-overlay')?.classList.add('hidden');
  },

  verify(code) {
    if (code === state.settings.pinCode) {
      sessionUnlocked = true;
      this.hideLockScreen();
      const errEl = document.getElementById('pin-error');
      if (errEl) errEl.classList.add('hidden');
      const input = document.getElementById('pin-input');
      if (input) input.value = '';
      startAppAfterUnlock();
      return true;
    }
    const errEl = document.getElementById('pin-error');
    if (errEl) errEl.classList.remove('hidden');
    VibrationEngine.vibrate([100, 50, 100, 50, 100]);
    const input = document.getElementById('pin-input');
    if (input) { input.value = ''; input.focus(); }
    return false;
  }
};

// =============================================
// ALARM SYSTEM
// =============================================

const AlarmSystem = {
  start() {
    if (alarmCheckInterval) clearInterval(alarmCheckInterval);
    alarmCheckInterval = setInterval(() => this.check(), 10000);
    this.check();
  },

  check() {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const currentDay = now.getDay();

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
    const modal = document.getElementById('alarm-ring-modal');
    const labelEl = document.getElementById('ring-label');
    const timeEl = document.getElementById('ring-time');
    if (modal && labelEl && timeEl) {
      labelEl.textContent = alarm.label || '⏰ Alarm!';
      timeEl.textContent = formatTime12(alarm.time);
      modal.classList.remove('hidden');
    }

    if (activeAlarmInterval) AudioEngine.stopInterval(activeAlarmInterval);
    activeAlarmInterval = AudioEngine.playSound(alarm.sound || 'bell', true, alarm.customSound || null);

    if (alarm.vibrate !== false) {
      VibrationEngine.alarmVibrate();
      activeAlarmInterval && setTimeout(() => VibrationEngine.alarmVibrate(), 2000);
    }

    NotificationManager.showViaServiceWorker(
      `⏰ ${alarm.label || 'Alarm'}`,
      `Time: ${formatTime12(alarm.time)} — Wake up!`,
      'alarm-ring'
    );
  },

  fireReminder(reminder) {
    AudioEngine.playNotificationSound();
    VibrationEngine.notificationVibrate();
    NotificationManager.showViaServiceWorker(
      `🔔 ${reminder.title}`,
      reminder.message || 'It\'s time for your reminder!',
      'reminder-' + reminder.id
    );
    showToast('🔔', reminder.title);
  },

  fireTaskReminder(task) {
    AudioEngine.playNotificationSound();
    VibrationEngine.notificationVibrate();
    NotificationManager.showViaServiceWorker(
      `📋 Task Reminder: ${task.title}`,
      task.desc || 'This task is due now!',
      'task-' + task.id
    );
    showToast('📋', `Task: ${task.title}`);
  },

  stopRinging() {
    if (activeAlarmInterval) {
      AudioEngine.stopInterval(activeAlarmInterval);
      activeAlarmInterval = null;
    }
    VibrationEngine.stopVibrate();
    document.getElementById('alarm-ring-modal')?.classList.add('hidden');
  },

  snooze() {
    this.stopRinging();
    const mins = state.settings.snoozeMinutes || 5;
    const snoozeTime = new Date(Date.now() + mins * 60 * 1000);
    const h = String(snoozeTime.getHours()).padStart(2,'0');
    const m = String(snoozeTime.getMinutes()).padStart(2,'0');
    showToast('😴', `Snoozed! Will ring again at ${h}:${m}`);
  }
};

// =============================================
// LOCATION-BASED REMINDERS (foreground only)
// =============================================

const LocationReminders = {
  start() {
    if (!('geolocation' in navigator)) return;
    const hasLocationReminders = state.reminders.some(r => r.active && r.locationEnabled && r.locationLat != null);
    if (!hasLocationReminders) { this.stop(); return; }
    if (locationWatchId != null) return;

    locationWatchId = navigator.geolocation.watchPosition(
      (pos) => this.check(pos.coords.latitude, pos.coords.longitude),
      () => { /* permission denied or unavailable, silently ignore */ },
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 20000 }
    );
  },

  stop() {
    if (locationWatchId != null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(locationWatchId);
      locationWatchId = null;
    }
  },

  check(lat, lng) {
    const todayKey = getTodayDateString();
    state.reminders.forEach(reminder => {
      if (!reminder.active || !reminder.locationEnabled || reminder.locationLat == null) return;
      if (reminder.locationLastFired === todayKey) return;
      const dist = haversineDistance(lat, lng, reminder.locationLat, reminder.locationLng);
      if (dist <= (reminder.locationRadius || 300)) {
        reminder.locationLastFired = todayKey;
        saveState();
        AudioEngine.playNotificationSound();
        VibrationEngine.notificationVibrate();
        NotificationManager.showViaServiceWorker(
          `📍 ${reminder.title}`,
          reminder.message || `You're near ${reminder.locationLabel || 'your reminder location'}!`,
          'location-' + reminder.id
        );
        showToast('📍', reminder.title);
      }
    });
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
      `You have ${state.tasks.filter(t => !t.done).length} tasks pending today. Let's get started!`,
      'daily-reminder'
    );
    showToast('🌅', 'Daily reminder fired!');
    scheduleDailyReminder();
  }, delay);
}

// =============================================
// TOAST NOTIFICATION
// =============================================

let toastTimeout = null;

function showToast(icon, msg, duration = 3000, showUndo = false) {
  const toast = document.getElementById('toast');
  const toastIcon = document.getElementById('toast-icon');
  const toastMsg = document.getElementById('toast-msg');
  const undoBtn = document.getElementById('toast-undo');
  if (!toast) return;
  toastIcon.textContent = icon;
  toastMsg.textContent = msg;
  toast.classList.remove('hidden');
  if (undoBtn) undoBtn.classList.toggle('hidden', !showUndo);
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.add('hidden');
    if (showUndo) lastDeleted = null;
  }, duration);
}

function undoLastDelete() {
  if (!lastDeleted) return;
  const { type, item, index } = lastDeleted;
  const arr = state[type];
  const insertAt = Math.min(index, arr.length);
  arr.splice(insertAt, 0, item);
  saveState();
  lastDeleted = null;
  if (toastTimeout) clearTimeout(toastTimeout);
  document.getElementById('toast')?.classList.add('hidden');

  if (type === 'tasks') { renderTasks(getCurrentFilter()); updateStats(); }
  if (type === 'alarms') { renderAlarms(); updateStats(); }
  if (type === 'reminders') { renderReminders(); }
  showToast('↩️', 'Restored!');
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
// THEME & ACCENT COLOR
// =============================================

const ACCENT_COLORS = {
  purple: { primary: '#7c3aed', light: '#9d5cf5', dark: '#5b21b6', accent: '#ec4899' },
  blue:   { primary: '#2563eb', light: '#60a5fa', dark: '#1e3a8a', accent: '#06b6d4' },
  green:  { primary: '#059669', light: '#34d399', dark: '#065f46', accent: '#84cc16' },
  pink:   { primary: '#db2777', light: '#f472b6', dark: '#9d174d', accent: '#f59e0b' },
  orange: { primary: '#ea580c', light: '#fb923c', dark: '#9a3412', accent: '#eab308' }
};

function applyAccentColor(name) {
  const colors = ACCENT_COLORS[name] || ACCENT_COLORS.purple;
  const root = document.documentElement.style;
  root.setProperty('--primary', colors.primary);
  root.setProperty('--primary-light', colors.light);
  root.setProperty('--primary-dark', colors.dark);
  root.setProperty('--accent', colors.accent);
}

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
// STATS & STREAK
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

  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const fill = document.getElementById('progress-fill');
  const percentLabel = document.getElementById('progress-percent');
  if (fill) fill.style.width = `${percent}%`;
  if (percentLabel) percentLabel.textContent = `${percent}%`;
}

function getCompletionDatesSet() {
  const set = new Set();
  state.tasks.forEach(t => {
    if (t.done && t.completedAt) {
      set.add(dateStringFromDate(new Date(t.completedAt)));
    }
  });
  return set;
}

function getCurrentStreak() {
  const dates = getCompletionDatesSet();
  let streak = 0;
  let cursor = new Date();
  // if nothing done today yet, streak can still count from yesterday backwards
  if (!dates.has(dateStringFromDate(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (dates.has(dateStringFromDate(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function getLast7DaysCompletionCounts() {
  const counts = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = dateStringFromDate(d);
    const count = state.tasks.filter(t => t.done && t.completedAt && dateStringFromDate(new Date(t.completedAt)) === key).length;
    counts.push({ date: key, label: d.toLocaleDateString('en-IN', { weekday: 'short' }), count });
  }
  return counts;
}

function getCategoryBreakdown() {
  const catEmoji = { personal: '👤', work: '💼', health: '❤️', study: '📚', finance: '💰', other: '📌' };
  const counts = {};
  state.tasks.forEach(t => {
    const cat = t.category || 'other';
    counts[cat] = (counts[cat] || 0) + 1;
  });
  const total = state.tasks.length || 1;
  return Object.keys(counts).map(cat => ({
    cat, emoji: catEmoji[cat] || '📌', count: counts[cat],
    percent: Math.round((counts[cat] / total) * 100)
  })).sort((a, b) => b.count - a.count);
}

// =============================================
// TASKS
// =============================================

function renderTasks(filter = 'all') {
  const list = document.getElementById('task-list');
  const empty = document.getElementById('tasks-empty');
  if (!list) return;

  let tasks = [...state.tasks];
  const today = getTodayDateString();
  switch (filter) {
    case 'pending': tasks = tasks.filter(t => !t.done); break;
    case 'done': tasks = tasks.filter(t => t.done); break;
    case 'today': tasks = tasks.filter(t => t.date === today); break;
    case 'overdue': tasks = tasks.filter(t => !t.done && isOverdue(t.date, t.time)); break;
    case 'high': tasks = tasks.filter(t => t.priority === 'high'); break;
    case 'medium': tasks = tasks.filter(t => t.priority === 'medium'); break;
    case 'low': tasks = tasks.filter(t => t.priority === 'low'); break;
  }

  if (taskSearchQuery.trim()) {
    const q = taskSearchQuery.trim().toLowerCase();
    tasks = tasks.filter(t =>
      (t.title || '').toLowerCase().includes(q) ||
      (t.desc || '').toLowerCase().includes(q) ||
      (t.tags || []).some(tag => tag.toLowerCase().includes(q))
    );
  }

  const pOrder = { high: 0, medium: 1, low: 2 };
  switch (taskSortMode) {
    case 'newest':
      tasks.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      break;
    case 'oldest':
      tasks.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      break;
    case 'priority':
      tasks.sort((a, b) => (pOrder[a.priority] ?? 1) - (pOrder[b.priority] ?? 1));
      break;
    case 'due':
      tasks.sort((a, b) => {
        if (!a.date && !b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return -1;
        return `${a.date}${a.time || ''}`.localeCompare(`${b.date}${b.time || ''}`);
      });
      break;
    case 'az':
      tasks.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      break;
    case 'manual':
      tasks.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      break;
    default:
      tasks.sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        return (pOrder[a.priority] ?? 1) - (pOrder[b.priority] ?? 1);
      });
  }

  const cards = list.querySelectorAll('.task-card');
  cards.forEach(c => c.remove());

  if (tasks.length === 0) {
    empty.style.display = 'block';
    const emptyTitle = empty.querySelector('h3');
    const emptyDesc = empty.querySelector('p');
    if (taskSearchQuery.trim() && emptyTitle && emptyDesc) {
      emptyTitle.textContent = t('empty_search_title');
      emptyDesc.textContent = t('empty_search_desc');
    } else if (emptyTitle && emptyDesc) {
      emptyTitle.textContent = t('empty_tasks_title');
      emptyDesc.textContent = t('empty_tasks_desc');
    }
    return;
  }
  empty.style.display = 'none';

  const catEmoji = { personal: '👤', work: '💼', health: '❤️', study: '📚', finance: '💰', other: '📌' };
  const recurIcon = { none: '', daily: '🔁 Daily', weekly: '🔁 Weekly', weekdays: '🔁 Weekdays' };
  const dragEnabled = taskSortMode === 'manual' || (taskSortMode === 'default' && filter === 'all' && !taskSearchQuery.trim());

  tasks.forEach(task => {
    const card = document.createElement('div');
    const isSelected = selectedTaskIds.has(task.id);
    card.className = `task-card priority-${task.priority} ${task.done ? 'completed' : ''} ${bulkMode ? 'bulk-mode' : ''} ${isSelected ? 'selected' : ''}`;
    card.dataset.id = task.id;
    if (dragEnabled && !bulkMode) card.draggable = true;

    const overdue = !task.done && isOverdue(task.date, task.time);
    const subtasks = task.subtasks || [];
    const subDone = subtasks.filter(s => s.done).length;
    const tags = task.tags || [];

    const subtasksHtml = subtasks.length > 0 ? `
      <div class="task-subtasks">
        <div class="subtask-progress-label">${subDone}/${subtasks.length} subtasks</div>
        <div class="subtask-mini-list">
          ${subtasks.map(s => `
            <div class="subtask-mini-item ${s.done ? 'done' : ''}" data-task-id="${task.id}" data-sub-id="${s.id}">
              <span class="subtask-mini-check">${s.done ? '☑' : '☐'}</span>
              <span class="subtask-mini-text">${escapeHtml(s.text)}</span>
            </div>
          `).join('')}
        </div>
      </div>` : '';

    const tagsHtml = tags.length > 0
      ? `<div class="task-tags">${tags.map(tag => `<span class="tag-chip">#${escapeHtml(tag)}</span>`).join('')}</div>`
      : '';

    card.innerHTML = `
      ${dragEnabled && !bulkMode ? '<span class="drag-handle" title="Drag to reorder">⠿</span>' : ''}
      <div class="task-checkbox ${task.done ? 'checked' : ''} ${isSelected ? 'is-selected' : ''}" data-id="${task.id}" role="button" aria-label="Toggle task"></div>
      <div class="task-body">
        <div class="task-title">${escapeHtml(task.title)}</div>
        ${task.desc ? `<div class="task-desc">${escapeHtml(task.desc)}</div>` : ''}
        <div class="task-meta">
          <span class="task-badge badge-${task.priority}">${task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢'} ${capitalize(task.priority)}</span>
          ${task.category ? `<span class="task-badge badge-category">${catEmoji[task.category] || '📌'} ${capitalize(task.category)}</span>` : ''}
          ${task.date ? `<span class="task-badge ${overdue ? 'badge-overdue' : 'badge-date'}">${overdue ? '⚠️ Overdue' : '📅'} ${formatDate(task.date)}</span>` : ''}
          ${task.time ? `<span class="task-badge badge-date">⏰ ${formatTime12(task.time)}</span>` : ''}
          ${task.recurrence && task.recurrence !== 'none' ? `<span class="task-badge badge-category">${recurIcon[task.recurrence]}</span>` : ''}
          ${task.link ? `<a class="task-badge badge-link" href="${escapeHtml(task.link)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">🔗 Link</a>` : ''}
        </div>
        ${tagsHtml}
        ${subtasksHtml}
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
    document.getElementById('task-tags').value = (task.tags || []).join(', ');
    document.getElementById('task-link').value = task.link || '';
    document.getElementById('task-recurrence').value = task.recurrence || 'none';
    modalSubtasks = (task.subtasks || []).map(s => ({ ...s }));
  } else {
    title.textContent = '📋 Add New Task';
    document.getElementById('task-title').value = '';
    document.getElementById('task-desc').value = '';
    document.getElementById('task-priority').value = 'medium';
    document.getElementById('task-category').value = 'personal';
    document.getElementById('task-date').value = today;
    document.getElementById('task-time').value = '';
    document.getElementById('task-reminder-check').checked = false;
    document.getElementById('task-tags').value = '';
    document.getElementById('task-link').value = '';
    document.getElementById('task-recurrence').value = 'none';
    modalSubtasks = [];
  }

  renderSubtaskEditor();
  modal.classList.remove('hidden');
  setTimeout(() => document.getElementById('task-title').focus(), 300);
}

function renderSubtaskEditor() {
  const container = document.getElementById('subtask-editor-list');
  if (!container) return;
  container.innerHTML = modalSubtasks.map(s => `
    <div class="subtask-edit-row" data-sub-id="${s.id}">
      <span class="subtask-edit-check ${s.done ? 'checked' : ''}" data-sub-id="${s.id}">${s.done ? '☑' : '☐'}</span>
      <input type="text" class="subtask-edit-input" data-sub-id="${s.id}" value="${escapeHtml(s.text)}" maxlength="80" />
      <button class="subtask-edit-remove" data-sub-id="${s.id}" title="Remove">✕</button>
    </div>
  `).join('');
}

function addSubtaskRow() {
  const input = document.getElementById('subtask-new-input');
  const text = input?.value.trim();
  if (!text) return;
  modalSubtasks.push({ id: generateId(), text, done: false });
  input.value = '';
  renderSubtaskEditor();
}

function saveTask() {
  const title = document.getElementById('task-title').value.trim();
  if (!title) { showToast('⚠️', 'Task title is required!'); return; }

  const tagsRaw = document.getElementById('task-tags').value.trim();
  const tags = tagsRaw ? tagsRaw.split(',').map(s => s.trim()).filter(Boolean).slice(0, 10) : [];

  const taskData = {
    title,
    desc: document.getElementById('task-desc').value.trim(),
    priority: document.getElementById('task-priority').value,
    category: document.getElementById('task-category').value,
    date: document.getElementById('task-date').value,
    time: document.getElementById('task-time').value,
    reminder: document.getElementById('task-reminder-check').checked,
    tags,
    link: document.getElementById('task-link').value.trim(),
    recurrence: document.getElementById('task-recurrence').value,
    subtasks: modalSubtasks.map(s => ({ ...s })),
    done: false,
    createdAt: Date.now()
  };

  if (editingTaskId) {
    const idx = state.tasks.findIndex(t => t.id === editingTaskId);
    if (idx !== -1) {
      taskData.done = state.tasks[idx].done;
      taskData.createdAt = state.tasks[idx].createdAt;
      taskData.order = state.tasks[idx].order;
      state.tasks[idx] = { ...state.tasks[idx], ...taskData };
    }
    showToast('✅', 'Task updated!');
  } else {
    taskData.id = generateId();
    taskData.order = state.tasks.length;
    state.tasks.unshift(taskData);
    showToast('✅', 'Task added!');
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

  if (task.done && task.recurrence && task.recurrence !== 'none' && task.date) {
    let nextDate = task.date;
    if (task.recurrence === 'daily') nextDate = addDaysToDateString(task.date, 1);
    else if (task.recurrence === 'weekly') nextDate = addDaysToDateString(task.date, 7);
    else if (task.recurrence === 'weekdays') {
      nextDate = addDaysToDateString(task.date, 1);
      let dow = new Date(nextDate + 'T00:00:00').getDay();
      while (dow === 0 || dow === 6) {
        nextDate = addDaysToDateString(nextDate, 1);
        dow = new Date(nextDate + 'T00:00:00').getDay();
      }
    }
    const clone = {
      ...task,
      id: generateId(),
      date: nextDate,
      done: false,
      completedAt: null,
      reminderFired: null,
      createdAt: Date.now(),
      subtasks: (task.subtasks || []).map(s => ({ ...s, done: false })),
      order: state.tasks.length
    };
    state.tasks.push(clone);
  }

  saveState();
  if (task.done) {
    AudioEngine.playChime(false);
    VibrationEngine.successVibrate();
    showToast('🎉', 'Task complete! Well done!');
  }
  renderTasks(getCurrentFilter());
  updateStats();
  renderInsights();
}

function toggleSubtaskDone(taskId, subId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  const sub = (task.subtasks || []).find(s => s.id === subId);
  if (!sub) return;
  sub.done = !sub.done;
  saveState();
  renderTasks(getCurrentFilter());
}

function deleteTask(id) {
  showConfirm('Delete this task?', () => {
    const idx = state.tasks.findIndex(t => t.id === id);
    if (idx === -1) return;
    const [removed] = state.tasks.splice(idx, 1);
    lastDeleted = { type: 'tasks', item: removed, index: idx };
    saveState();
    renderTasks(getCurrentFilter());
    updateStats();
    showToast('🗑️', 'Task deleted', 5000, true);
  });
}

function getCurrentFilter() {
  const activeChip = document.querySelector('.chip.active');
  return activeChip ? activeChip.dataset.filter : 'all';
}

// =============================================
// BULK ACTIONS
// =============================================

function toggleBulkMode() {
  bulkMode = !bulkMode;
  selectedTaskIds.clear();
  const btn = document.getElementById('bulk-select-btn');
  if (btn) btn.classList.toggle('active', bulkMode);
  document.getElementById('bulk-toolbar')?.classList.toggle('hidden', !bulkMode);
  renderTasks(getCurrentFilter());
  updateBulkToolbar();
}

function toggleTaskSelection(id) {
  if (selectedTaskIds.has(id)) selectedTaskIds.delete(id);
  else selectedTaskIds.add(id);
  renderTasks(getCurrentFilter());
  updateBulkToolbar();
}

function updateBulkToolbar() {
  const countEl = document.getElementById('bulk-count');
  if (countEl) countEl.textContent = `${selectedTaskIds.size} selected`;
}

function bulkCompleteSelected() {
  if (selectedTaskIds.size === 0) return;
  state.tasks.forEach(t => {
    if (selectedTaskIds.has(t.id) && !t.done) {
      t.done = true;
      t.completedAt = Date.now();
    }
  });
  saveState();
  showToast('✅', `${selectedTaskIds.size} task(s) completed!`);
  toggleBulkMode();
  updateStats();
}

function bulkDeleteSelected() {
  if (selectedTaskIds.size === 0) return;
  showConfirm(`Delete ${selectedTaskIds.size} selected task(s)?`, () => {
    state.tasks = state.tasks.filter(t => !selectedTaskIds.has(t.id));
    saveState();
    showToast('🗑️', 'Selected tasks deleted');
    toggleBulkMode();
    updateStats();
  });
}

// =============================================
// DRAG & DROP REORDER
// =============================================

function handleTaskDragStart(e, id) {
  draggedTaskId = id;
  e.dataTransfer.effectAllowed = 'move';
  e.target.closest('.task-card')?.classList.add('dragging');
}

function handleTaskDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const card = e.target.closest('.task-card');
  if (card) card.classList.add('drag-over');
}

function handleTaskDragLeave(e) {
  const card = e.target.closest('.task-card');
  if (card) card.classList.remove('drag-over');
}

function handleTaskDrop(e, targetId) {
  e.preventDefault();
  document.querySelectorAll('.task-card').forEach(c => c.classList.remove('drag-over', 'dragging'));
  if (!draggedTaskId || draggedTaskId === targetId) return;

  const fromIdx = state.tasks.findIndex(t => t.id === draggedTaskId);
  const toIdx = state.tasks.findIndex(t => t.id === targetId);
  if (fromIdx === -1 || toIdx === -1) return;

  const [moved] = state.tasks.splice(fromIdx, 1);
  state.tasks.splice(toIdx, 0, moved);
  state.tasks.forEach((t, i) => { t.order = i; });

  taskSortMode = 'manual';
  const sortSelect = document.getElementById('task-sort');
  if (sortSelect) sortSelect.value = 'manual';

  saveState();
  renderTasks(getCurrentFilter());
  draggedTaskId = null;
}

function handleTaskDragEnd() {
  document.querySelectorAll('.task-card').forEach(c => c.classList.remove('drag-over', 'dragging'));
  draggedTaskId = null;
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

  const sorted = [...state.alarms].sort((a, b) => a.time.localeCompare(b.time));
  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  // Group by alarm.group for section headers
  const groups = {};
  sorted.forEach(a => {
    const g = a.group || 'General';
    if (!groups[g]) groups[g] = [];
    groups[g].push(a);
  });

  Object.keys(groups).forEach(groupName => {
    const groupHeader = document.createElement('div');
    groupHeader.className = 'alarm-group-header';
    const groupAlarms = groups[groupName];
    const allActive = groupAlarms.every(a => a.active);
    groupHeader.innerHTML = `
      <span>${groupName === 'General' ? '⏰ General' : `🏷️ ${escapeHtml(groupName)}`}</span>
      <button class="group-toggle-btn" data-group="${escapeHtml(groupName)}" data-state="${allActive ? 'on' : 'off'}">
        ${allActive ? 'Turn all off' : 'Turn all on'}
      </button>
    `;
    list.appendChild(groupHeader);

    groupAlarms.forEach(alarm => {
      const card = document.createElement('div');
      card.className = `alarm-card ${!alarm.active ? 'inactive' : ''}`;
      card.dataset.id = alarm.id;

      const daysHtml = alarm.days.length === 0
        ? '<span class="alarm-days-label">One time</span>'
        : alarm.days.length === 7
          ? '<span class="alarm-days-label">Every day</span>'
          : `<span class="alarm-days-label">${alarm.days.map(d => dayLabels[d]).join(' ')}</span>`;

      card.innerHTML = `
        <div class="alarm-time-block">
          <div class="alarm-time">${formatTime12(alarm.time)}</div>
          <div class="alarm-label">${escapeHtml(alarm.label || 'Alarm')} ${alarm.customSound ? '🎵' : ''}</div>
          ${daysHtml}
        </div>
        <div class="alarm-controls">
          <label class="toggle-switch">
            <input type="checkbox" class="alarm-toggle" data-id="${alarm.id}" ${alarm.active ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
          <button class="task-action-btn edit-alarm" data-id="${alarm.id}" title="Edit">✏️</button>
          <button class="task-action-btn delete delete-alarm" data-id="${alarm.id}" title="Delete">🗑️</button>
        </div>
      `;
      list.appendChild(card);
    });
  });
}

function openAlarmModal(alarmId = null) {
  editingAlarmId = alarmId;
  const modal = document.getElementById('alarm-modal');
  const title = document.getElementById('alarm-modal-title');
  selectedDays = [];
  pendingCustomSound = null;
  document.getElementById('custom-sound-name').textContent = 'No custom sound';
  document.getElementById('clear-custom-sound-btn')?.classList.add('hidden');

  if (alarmId) {
    const alarm = state.alarms.find(a => a.id === alarmId);
    if (!alarm) return;
    title.textContent = '✏️ Edit Alarm';
    document.getElementById('alarm-label').value = alarm.label || '';
    document.getElementById('alarm-time').value = alarm.time;
    document.getElementById('alarm-sound').value = alarm.sound || 'bell';
    document.getElementById('alarm-vibrate').checked = alarm.vibrate !== false;
    document.getElementById('alarm-group').value = alarm.group || '';
    selectedDays = [...alarm.days];
    if (alarm.customSound) {
      pendingCustomSound = { dataUrl: alarm.customSound, name: alarm.customSoundName || 'Custom sound' };
      document.getElementById('custom-sound-name').textContent = `🎵 ${alarm.customSoundName || 'Custom sound'}`;
      document.getElementById('clear-custom-sound-btn')?.classList.remove('hidden');
    }
  } else {
    title.textContent = '⏰ New Alarm';
    document.getElementById('alarm-label').value = '';
    document.getElementById('alarm-time').value = '';
    document.getElementById('alarm-sound').value = 'bell';
    document.getElementById('alarm-group').value = '';
    document.getElementById('alarm-vibrate').checked = true;
  }

  renderDayPicker();
  modal.classList.remove('hidden');
}

function renderDayPicker() {
  document.querySelectorAll('.day-btn').forEach(btn => {
    const day = parseInt(btn.dataset.day, 10);
    btn.classList.toggle('selected', selectedDays.includes(day));
  });
}

function toggleDaySelection(day) {
  const idx = selectedDays.indexOf(day);
  if (idx === -1) selectedDays.push(day);
  else selectedDays.splice(idx, 1);
  renderDayPicker();
}

function handleCustomSoundUpload(file) {
  if (!file) return;
  if (!file.type.startsWith('audio/')) {
    showToast('❌', 'Please choose an audio file');
    return;
  }
  if (file.size > 400 * 1024) {
    showToast('⚠️', 'Sound file too large — please pick one under 400 KB');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    pendingCustomSound = { dataUrl: reader.result, name: file.name };
    document.getElementById('custom-sound-name').textContent = `🎵 ${file.name}`;
    document.getElementById('clear-custom-sound-btn')?.classList.remove('hidden');
    showToast('✅', 'Custom sound ready!');
  };
  reader.readAsDataURL(file);
}

function clearCustomSound() {
  pendingCustomSound = null;
  document.getElementById('custom-sound-name').textContent = 'No custom sound';
  document.getElementById('clear-custom-sound-btn')?.classList.add('hidden');
  const fileInput = document.getElementById('alarm-sound-upload');
  if (fileInput) fileInput.value = '';
}

function saveAlarm() {
  const time = document.getElementById('alarm-time').value;
  if (!time) { showToast('⚠️', 'Alarm time is required!'); return; }

  const alarmData = {
    label: document.getElementById('alarm-label').value.trim() || 'Alarm',
    time,
    days: [...selectedDays],
    sound: document.getElementById('alarm-sound').value,
    vibrate: document.getElementById('alarm-vibrate').checked,
    group: document.getElementById('alarm-group').value.trim(),
    customSound: pendingCustomSound ? pendingCustomSound.dataUrl : null,
    customSoundName: pendingCustomSound ? pendingCustomSound.name : '',
    active: true
  };

  if (editingAlarmId) {
    const idx = state.alarms.findIndex(a => a.id === editingAlarmId);
    if (idx !== -1) {
      alarmData.active = state.alarms[idx].active;
      state.alarms[idx] = { ...state.alarms[idx], ...alarmData };
    }
    showToast('✅', 'Alarm updated!');
  } else {
    alarmData.id = generateId();
    state.alarms.push(alarmData);
    showToast('⏰', `Alarm set for ${formatTime12(time)}!`);
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

function toggleAlarmGroup(groupName, turnOn) {
  state.alarms.forEach(a => {
    if ((a.group || 'General') === groupName) a.active = turnOn;
  });
  saveState();
  renderAlarms();
  updateStats();
  showToast(turnOn ? '⏰' : '🔕', `${groupName}: all alarms ${turnOn ? 'on' : 'off'}`);
}

function deleteAlarm(id) {
  showConfirm('Delete this alarm?', () => {
    const idx = state.alarms.findIndex(a => a.id === id);
    if (idx === -1) return;
    const [removed] = state.alarms.splice(idx, 1);
    lastDeleted = { type: 'alarms', item: removed, index: idx };
    saveState();
    renderAlarms();
    updateStats();
    showToast('🗑️', 'Alarm deleted', 5000, true);
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

  const repeatLabels = { once: 'Once', daily: 'Daily', weekly: 'Weekly', weekdays: 'Weekdays' };

  state.reminders.forEach(reminder => {
    const card = document.createElement('div');
    card.className = `reminder-card ${!reminder.active ? 'inactive' : ''}`;
    card.dataset.id = reminder.id;

    card.innerHTML = `
      <div class="reminder-icon">🔔</div>
      <div class="reminder-body">
        <div class="reminder-title">${escapeHtml(reminder.title)}</div>
        ${reminder.message ? `<div class="reminder-msg">${escapeHtml(reminder.message)}</div>` : ''}
        <div class="reminder-meta">
          <span class="task-badge badge-date">⏰ ${formatTime12(reminder.time)}</span>
          <span class="task-badge badge-category">🔁 ${repeatLabels[reminder.repeat] || 'Once'}</span>
          ${reminder.locationEnabled ? `<span class="task-badge badge-category">📍 ${escapeHtml(reminder.locationLabel || 'Location')}</span>` : ''}
        </div>
      </div>
      <div class="reminder-controls">
        <label class="toggle-switch">
          <input type="checkbox" class="reminder-toggle" data-id="${reminder.id}" ${reminder.active ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
        <button class="task-action-btn edit-reminder" data-id="${reminder.id}" title="Edit">✏️</button>
        <button class="task-action-btn delete delete-reminder" data-id="${reminder.id}" title="Delete">🗑️</button>
      </div>
    `;
    list.appendChild(card);
  });
}

function openReminderModal(reminderId = null) {
  editingReminderId = reminderId;
  const modal = document.getElementById('reminder-modal');
  const title = document.getElementById('reminder-modal-title');
  document.getElementById('reminder-location-fields')?.classList.add('hidden');

  if (reminderId) {
    const reminder = state.reminders.find(r => r.id === reminderId);
    if (!reminder) return;
    title.textContent = '✏️ Edit Reminder';
    document.getElementById('reminder-title').value = reminder.title || '';
    document.getElementById('reminder-msg').value = reminder.message || '';
    document.getElementById('reminder-time').value = reminder.time || '';
    document.getElementById('reminder-repeat').value = reminder.repeat || 'once';
    document.getElementById('reminder-date').value = reminder.date || '';
    document.getElementById('reminder-location-check').checked = reminder.locationEnabled || false;
    document.getElementById('reminder-location-label').value = reminder.locationLabel || '';
    document.getElementById('reminder-location-radius').value = reminder.locationRadius || 300;
    document.getElementById('reminder-location-fields')?.classList.toggle('hidden', !reminder.locationEnabled);
    modal.dataset.lat = reminder.locationLat != null ? reminder.locationLat : '';
    modal.dataset.lng = reminder.locationLng != null ? reminder.locationLng : '';
    updateLocationStatusLabel();
  } else {
    title.textContent = '🔔 New Reminder';
    document.getElementById('reminder-title').value = '';
    document.getElementById('reminder-msg').value = '';
    document.getElementById('reminder-time').value = '';
    document.getElementById('reminder-repeat').value = 'once';
    document.getElementById('reminder-date').value = getTodayDateString();
    document.getElementById('reminder-location-check').checked = false;
    document.getElementById('reminder-location-label').value = '';
    document.getElementById('reminder-location-radius').value = 300;
    modal.dataset.lat = '';
    modal.dataset.lng = '';
    updateLocationStatusLabel();
  }

  modal.classList.remove('hidden');
  const radiusInputEl = document.getElementById('reminder-location-radius');
  const radiusLabelEl = document.getElementById('radius-value');
  if (radiusInputEl && radiusLabelEl) radiusLabelEl.textContent = `${radiusInputEl.value} m`;
  setTimeout(() => document.getElementById('reminder-title').focus(), 300);
}

function updateLocationStatusLabel() {
  const modal = document.getElementById('reminder-modal');
  const statusEl = document.getElementById('location-status');
  if (!statusEl || !modal) return;
  const lat = modal.dataset.lat, lng = modal.dataset.lng;
  statusEl.textContent = (lat && lng) ? `📍 Location captured (${parseFloat(lat).toFixed(3)}, ${parseFloat(lng).toFixed(3)})` : 'No location set yet';
}

function captureCurrentLocation() {
  if (!('geolocation' in navigator)) {
    showToast('❌', 'Location is not supported on this device');
    return;
  }
  showToast('📍', 'Getting your location...');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const modal = document.getElementById('reminder-modal');
      modal.dataset.lat = pos.coords.latitude;
      modal.dataset.lng = pos.coords.longitude;
      updateLocationStatusLabel();
      showToast('✅', 'Location captured!');
    },
    () => showToast('❌', 'Could not get location — check permissions'),
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function saveReminder() {
  const title = document.getElementById('reminder-title').value.trim();
  const time = document.getElementById('reminder-time').value;
  if (!title) { showToast('⚠️', 'Reminder title is required!'); return; }
  if (!time) { showToast('⚠️', 'Reminder time is required!'); return; }

  const modal = document.getElementById('reminder-modal');
  const locationEnabled = document.getElementById('reminder-location-check').checked;
  const lat = modal.dataset.lat ? parseFloat(modal.dataset.lat) : null;
  const lng = modal.dataset.lng ? parseFloat(modal.dataset.lng) : null;

  if (locationEnabled && (lat == null || lng == null)) {
    showToast('⚠️', 'Please capture a location first');
    return;
  }

  const reminderData = {
    title,
    message: document.getElementById('reminder-msg').value.trim(),
    time,
    repeat: document.getElementById('reminder-repeat').value,
    date: document.getElementById('reminder-date').value || getTodayDateString(),
    locationEnabled,
    locationLat: locationEnabled ? lat : null,
    locationLng: locationEnabled ? lng : null,
    locationRadius: parseInt(document.getElementById('reminder-location-radius').value, 10) || 300,
    locationLabel: document.getElementById('reminder-location-label').value.trim(),
    active: true
  };

  if (editingReminderId) {
    const idx = state.reminders.findIndex(r => r.id === editingReminderId);
    if (idx !== -1) {
      reminderData.active = state.reminders[idx].active;
      state.reminders[idx] = { ...state.reminders[idx], ...reminderData };
    }
    showToast('✅', 'Reminder updated!');
  } else {
    reminderData.id = generateId();
    state.reminders.push(reminderData);
    showToast('🔔', 'Reminder set!');
  }

  saveState();
  closeModal('reminder-modal');
  renderReminders();
  LocationReminders.start();
}

function toggleReminder(id, active) {
  const reminder = state.reminders.find(r => r.id === id);
  if (!reminder) return;
  reminder.active = active;
  saveState();
  renderReminders();
  LocationReminders.start();
}

function deleteReminder(id) {
  showConfirm('Delete this reminder?', () => {
    const idx = state.reminders.findIndex(r => r.id === id);
    if (idx === -1) return;
    const [removed] = state.reminders.splice(idx, 1);
    lastDeleted = { type: 'reminders', item: removed, index: idx };
    saveState();
    renderReminders();
    LocationReminders.start();
    showToast('🗑️', 'Reminder deleted', 5000, true);
  });
}

// =============================================
// CALENDAR
// =============================================

function getItemsForDate(dateStr) {
  const tasks = state.tasks.filter(t => t.date === dateStr);
  const alarms = state.alarms.filter(a => {
    if (!a.active) return false;
    if (a.days.length === 0) return false; // one-time alarms aren't date-bound
    const dow = new Date(dateStr + 'T00:00:00').getDay();
    return a.days.includes(dow);
  });
  const reminders = state.reminders.filter(r => r.active && (r.date === dateStr || r.repeat === 'daily' ||
    (r.repeat === 'weekdays' && ![0,6].includes(new Date(dateStr + 'T00:00:00').getDay()))));
  return { tasks, alarms, reminders };
}

function renderCalendar() {
  if (calendarMode === 'month') renderCalendarMonth();
  else renderCalendarWeek();
  renderAgendaForSelectedDate();
}

function renderCalendarMonth() {
  const grid = document.getElementById('calendar-grid');
  const label = document.getElementById('calendar-month-label');
  if (!grid || !label) return;

  const year = calendarViewDate.getFullYear();
  const month = calendarViewDate.getMonth();
  label.textContent = calendarViewDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = getTodayDateString();

  let html = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => `<div class="cal-weekday">${d}</div>`).join('');

  for (let i = 0; i < startOffset; i++) html += `<div class="cal-day empty"></div>`;

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const { tasks, alarms, reminders } = getItemsForDate(dateStr);
    const hasItems = tasks.length + alarms.length + reminders.length > 0;
    const isToday = dateStr === today;
    const isSelected = dateStr === calendarSelectedDate;

    html += `
      <div class="cal-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" data-date="${dateStr}">
        <span class="cal-day-num">${day}</span>
        ${hasItems ? `<div class="cal-dots">
          ${tasks.length ? '<span class="cal-dot dot-task"></span>' : ''}
          ${alarms.length ? '<span class="cal-dot dot-alarm"></span>' : ''}
          ${reminders.length ? '<span class="cal-dot dot-reminder"></span>' : ''}
        </div>` : ''}
      </div>
    `;
  }

  grid.innerHTML = html;
}

function renderCalendarWeek() {
  const grid = document.getElementById('calendar-grid');
  const label = document.getElementById('calendar-month-label');
  if (!grid || !label) return;

  const base = calendarSelectedDate ? new Date(calendarSelectedDate + 'T00:00:00') : new Date();
  const startOfWeek = new Date(base);
  startOfWeek.setDate(base.getDate() - base.getDay());

  const today = getTodayDateString();
  let html = '';
  const weekDates = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    const dateStr = dateStringFromDate(d);
    weekDates.push(dateStr);
    const { tasks, alarms, reminders } = getItemsForDate(dateStr);
    const hasItems = tasks.length + alarms.length + reminders.length > 0;
    const isToday = dateStr === today;
    const isSelected = dateStr === calendarSelectedDate;

    html += `
      <div class="cal-weekday">${getDayName(d.getDay())}</div>
    `;
  }
  for (let i = 0; i < 7; i++) {
    const dateStr = weekDates[i];
    const { tasks, alarms, reminders } = getItemsForDate(dateStr);
    const hasItems = tasks.length + alarms.length + reminders.length > 0;
    const isToday = dateStr === today;
    const isSelected = dateStr === calendarSelectedDate;
    const d = new Date(dateStr + 'T00:00:00');
    html += `
      <div class="cal-day week-mode ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" data-date="${dateStr}">
        <span class="cal-day-num">${d.getDate()}</span>
        ${hasItems ? `<div class="cal-dots">
          ${tasks.length ? '<span class="cal-dot dot-task"></span>' : ''}
          ${alarms.length ? '<span class="cal-dot dot-alarm"></span>' : ''}
          ${reminders.length ? '<span class="cal-dot dot-reminder"></span>' : ''}
        </div>` : ''}
      </div>
    `;
  }

  label.textContent = `${formatDate(weekDates[0])} – ${formatDate(weekDates[6])}`;
  grid.innerHTML = html;
  grid.classList.toggle('week-grid', true);
}

function renderAgendaForSelectedDate() {
  const dateStr = calendarSelectedDate || getTodayDateString();
  const agendaTitle = document.getElementById('agenda-date-label');
  const agendaList = document.getElementById('agenda-list');
  if (!agendaList) return;

  const isToday = dateStr === getTodayDateString();
  if (agendaTitle) agendaTitle.textContent = isToday ? `Today · ${formatDate(dateStr)}` : formatDate(dateStr);

  const { tasks, alarms, reminders } = getItemsForDate(dateStr);

  const items = [
    ...alarms.map(a => ({ time: a.time, icon: '⏰', label: a.label || 'Alarm', type: 'alarm' })),
    ...reminders.map(r => ({ time: r.time, icon: '🔔', label: r.title, type: 'reminder' })),
    ...tasks.map(t => ({ time: t.time || '00:00', icon: t.done ? '✅' : '📋', label: t.title, type: 'task', done: t.done }))
  ].sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  if (items.length === 0) {
    agendaList.innerHTML = `<div class="agenda-empty">Nothing scheduled for this day. 🎉</div>`;
    return;
  }

  agendaList.innerHTML = items.map(item => `
    <div class="agenda-item ${item.done ? 'done' : ''}">
      <span class="agenda-time">${item.time && item.time !== '00:00' ? formatTime12(item.time) : 'All day'}</span>
      <span class="agenda-icon">${item.icon}</span>
      <span class="agenda-label">${escapeHtml(item.label)}</span>
    </div>
  `).join('');
}

function calendarNavigate(direction) {
  if (calendarMode === 'month') {
    calendarViewDate.setMonth(calendarViewDate.getMonth() + direction);
  } else {
    const base = calendarSelectedDate ? new Date(calendarSelectedDate + 'T00:00:00') : new Date();
    base.setDate(base.getDate() + direction * 7);
    calendarSelectedDate = dateStringFromDate(base);
  }
  renderCalendar();
}

function selectCalendarDate(dateStr) {
  calendarSelectedDate = dateStr;
  renderCalendar();
}

function setCalendarMode(mode) {
  calendarMode = mode;
  document.querySelectorAll('.cal-mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  document.getElementById('calendar-grid')?.classList.toggle('week-grid', mode === 'week');
  renderCalendar();
}

// =============================================
// INSIGHTS
// =============================================

function renderInsights() {
  const streak = getCurrentStreak();
  const streakEl = document.getElementById('insight-streak');
  if (streakEl) streakEl.textContent = `${streak} day${streak === 1 ? '' : 's'}`;

  const totalDone = state.tasks.filter(t => t.done).length;
  const doneEl = document.getElementById('insight-total-done');
  if (doneEl) doneEl.textContent = totalDone;

  const weekData = getLast7DaysCompletionCounts();
  const maxCount = Math.max(1, ...weekData.map(d => d.count));
  const chart = document.getElementById('week-chart');
  if (chart) {
    chart.innerHTML = weekData.map(d => `
      <div class="week-bar-col">
        <div class="week-bar-track">
          <div class="week-bar-fill" style="height:${(d.count / maxCount) * 100}%" title="${d.count} completed"></div>
        </div>
        <span class="week-bar-label">${d.label}</span>
        <span class="week-bar-count">${d.count}</span>
      </div>
    `).join('');
  }

  const categories = getCategoryBreakdown();
  const catList = document.getElementById('category-breakdown');
  if (catList) {
    if (categories.length === 0) {
      catList.innerHTML = `<div class="agenda-empty">Add some tasks to see a breakdown.</div>`;
    } else {
      catList.innerHTML = categories.map(c => `
        <div class="category-row">
          <span class="category-label">${c.emoji} ${capitalize(c.cat)}</span>
          <div class="category-bar-track">
            <div class="category-bar-fill" style="width:${c.percent}%"></div>
          </div>
          <span class="category-percent">${c.percent}%</span>
        </div>
      `).join('');
    }
  }
}

// =============================================
// SETTINGS
// =============================================

function renderSettings() {
  document.getElementById('settings-language').value = state.settings.language || 'en';
  document.getElementById('settings-accent').querySelectorAll('.accent-swatch').forEach(sw => {
    sw.classList.toggle('active', sw.dataset.color === (state.settings.accentColor || 'purple'));
  });
  document.getElementById('settings-snooze').value = state.settings.snoozeMinutes || 5;
  document.getElementById('settings-pin-toggle').checked = state.settings.pinEnabled || false;
  document.getElementById('pin-setup-fields')?.classList.toggle('hidden', !state.settings.pinEnabled);
}

function setLanguage(lang) {
  state.settings.language = lang;
  saveState();
  applyTranslations();
  renderTasks(getCurrentFilter());
  renderAlarms();
  renderReminders();
}

function setAccentColor(color) {
  state.settings.accentColor = color;
  applyAccentColor(color);
  saveState();
  document.querySelectorAll('.accent-swatch').forEach(sw => {
    sw.classList.toggle('active', sw.dataset.color === color);
  });
  showToast('🎨', 'Theme color updated!');
}

function setSnoozeMinutes(mins) {
  state.settings.snoozeMinutes = parseInt(mins, 10) || 5;
  saveState();
}

function enablePinLock(pin) {
  state.settings.pinEnabled = true;
  state.settings.pinCode = pin;
  sessionUnlocked = true;
  saveState();
  showToast('🔒', 'App lock enabled!');
}

function disablePinLock() {
  state.settings.pinEnabled = false;
  state.settings.pinCode = '';
  saveState();
  document.getElementById('settings-pin-toggle').checked = false;
  document.getElementById('pin-setup-fields')?.classList.add('hidden');
  showToast('🔓', 'App lock disabled');
}

// =============================================
// MODAL MANAGEMENT
// =============================================

function closeModal(id) {
  document.getElementById(id)?.classList.add('hidden');
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
}

// =============================================
// TABS
// =============================================

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `tab-${tabName}`);
  });

  if (tabName === 'calendar') renderCalendar();
  if (tabName === 'insights') renderInsights();
  if (tabName === 'settings') renderSettings();
}

// =============================================
// FAB (FLOATING ACTION BUTTON)
// =============================================

function toggleFabMenu() {
  document.getElementById('fab-menu')?.classList.toggle('hidden');
  document.getElementById('fab-overlay')?.classList.toggle('hidden');
  document.getElementById('fab-btn')?.classList.toggle('active');
}

function closeFabMenu() {
  document.getElementById('fab-menu')?.classList.add('hidden');
  document.getElementById('fab-overlay')?.classList.add('hidden');
  document.getElementById('fab-btn')?.classList.remove('active');
}

// =============================================
// HELPER FUNCTIONS
// =============================================

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

// =============================================
// EXPORT / IMPORT (BACKUP & RESTORE)
// =============================================

function exportData() {
  try {
    const dataStr = JSON.stringify(state, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStamp = getTodayDateString();
    a.href = url;
    a.download = `pareshaan-backup-${dateStamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    state.settings.lastBackupPrompt = Date.now();
    saveState();
    showToast('📤', 'Backup exported!');
  } catch (e) {
    console.warn('Export error:', e);
    showToast('❌', 'Could not export backup');
  }
}

function importData(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed || typeof parsed !== 'object') throw new Error('Invalid file');

      showConfirm('Importing will replace your current data. Continue?', () => {
        state = loadStateFromObject(parsed);
        saveState();
        applyTheme(state.settings.theme);
        applyAccentColor(state.settings.accentColor);
        applyTranslations();
        initDailyReminderUI();
        renderTasks();
        renderAlarms();
        renderReminders();
        updateStats();
        renderInsights();
        LocationReminders.start();
        showToast('📥', 'Backup imported!');
      });
    } catch (err) {
      console.warn('Import error:', err);
      showToast('❌', 'Invalid backup file');
    } finally {
      e.target.value = '';
    }
  };
  reader.readAsText(file);
}

function loadStateFromObject(parsed) {
  const merged = { ...defaultState, ...parsed, settings: { ...defaultState.settings, ...(parsed.settings || {}) } };
  merged.tasks = (merged.tasks || []).map((task, i) => ({ subtasks: [], tags: [], link: '', recurrence: 'none', order: i, ...task }));
  merged.alarms = (merged.alarms || []).map(alarm => ({ group: '', customSound: null, customSoundName: '', ...alarm }));
  merged.reminders = (merged.reminders || []).map(reminder => ({ locationEnabled: false, locationLat: null, locationLng: null, locationRadius: 300, locationLabel: '', ...reminder }));
  return merged;
}

// =============================================
// AUTO-BACKUP REMINDER
// =============================================

function checkBackupReminder() {
  const last = state.settings.lastBackupPrompt || 0;
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  if (Date.now() - last > weekMs && (state.tasks.length > 0 || state.alarms.length > 0)) {
    setTimeout(() => {
      showToast('💾', 'It\'s been a while — consider exporting a backup from Settings.', 6000);
      state.settings.lastBackupPrompt = Date.now();
      saveState();
    }, 4000);
  }
}

// =============================================
// SERVICE WORKER
// =============================================

async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      console.log('SW registered:', reg.scope);

      if (reg.waiting) {
        newServiceWorker = reg.waiting;
        showUpdateBanner();
      }

      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            newServiceWorker = installing;
            showUpdateBanner();
          }
        });
      });

      if ('periodicSync' in reg) {
        try {
          await reg.periodicSync.register('daily-reminder', { minInterval: 24 * 60 * 60 * 1000 });
        } catch(e) { /* not supported */ }
      }
    } catch (e) {
      console.warn('SW registration failed:', e);
    }

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }
}

function showUpdateBanner() {
  const banner = document.getElementById('update-banner');
  if (banner) banner.classList.remove('hidden');
}

// =============================================
// DAILY REMINDER UI
// =============================================

function initDailyReminderUI() {
  const toggle = document.getElementById('daily-reminder-toggle');
  const timeInput = document.getElementById('daily-reminder-time');
  if (toggle) toggle.checked = state.settings.dailyReminder;
  if (timeInput) timeInput.value = state.settings.dailyReminderTime || '08:00';
  if (state.settings.dailyReminder) scheduleDailyReminder();
}

// =============================================
// PWA INSTALL
// =============================================

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  document.getElementById('install-banner')?.classList.remove('hidden');
});

window.addEventListener('appinstalled', () => {
  document.getElementById('install-banner')?.classList.add('hidden');
  showToast('🎉', 'Pareshaan installed!');
});

async function installApp() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  document.getElementById('install-banner')?.classList.add('hidden');
}

// =============================================
// EVENT LISTENERS
// =============================================

function setupEventListeners() {

  // Theme toggle
  document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);

  // Notification permission
  document.getElementById('notif-btn')?.addEventListener('click', () => NotificationManager.requestPermission());

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Add buttons
  document.getElementById('add-task-btn')?.addEventListener('click', () => openTaskModal());
  document.getElementById('add-alarm-btn')?.addEventListener('click', () => openAlarmModal());
  document.getElementById('add-reminder-btn')?.addEventListener('click', () => openReminderModal());

  // FAB
  document.getElementById('fab-btn')?.addEventListener('click', toggleFabMenu);
  document.getElementById('fab-overlay')?.addEventListener('click', closeFabMenu);
  document.getElementById('fab-task')?.addEventListener('click', () => { closeFabMenu(); openTaskModal(); });
  document.getElementById('fab-alarm')?.addEventListener('click', () => { closeFabMenu(); openAlarmModal(); });
  document.getElementById('fab-reminder')?.addEventListener('click', () => { closeFabMenu(); openReminderModal(); });

  // Modal close (generic)
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay && overlay.id !== 'alarm-ring-modal' && overlay.id !== 'pin-lock-overlay') {
        overlay.classList.add('hidden');
      }
    });
  });

  // Task modal save
  document.getElementById('save-task-btn')?.addEventListener('click', saveTask);
  document.getElementById('add-subtask-btn')?.addEventListener('click', addSubtaskRow);
  document.getElementById('subtask-new-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addSubtaskRow(); }
  });
  document.getElementById('subtask-editor-list')?.addEventListener('click', (e) => {
    const check = e.target.closest('.subtask-edit-check');
    const remove = e.target.closest('.subtask-edit-remove');
    if (check) {
      const sub = modalSubtasks.find(s => s.id === check.dataset.subId);
      if (sub) { sub.done = !sub.done; renderSubtaskEditor(); }
    }
    if (remove) {
      modalSubtasks = modalSubtasks.filter(s => s.id !== remove.dataset.subId);
      renderSubtaskEditor();
    }
  });
  document.getElementById('subtask-editor-list')?.addEventListener('input', (e) => {
    const input = e.target.closest('.subtask-edit-input');
    if (input) {
      const sub = modalSubtasks.find(s => s.id === input.dataset.subId);
      if (sub) sub.text = input.value;
    }
  });

  // Filter chips
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      renderTasks(chip.dataset.filter);
    });
  });

  // Task search
  const searchInput = document.getElementById('task-search');
  const searchClear = document.getElementById('task-search-clear');
  searchInput?.addEventListener('input', (e) => {
    taskSearchQuery = e.target.value;
    searchClear?.classList.toggle('hidden', !taskSearchQuery);
    renderTasks(getCurrentFilter());
  });
  searchClear?.addEventListener('click', () => {
    taskSearchQuery = '';
    if (searchInput) searchInput.value = '';
    searchClear.classList.add('hidden');
    renderTasks(getCurrentFilter());
  });

  // Task sort
  document.getElementById('task-sort')?.addEventListener('change', (e) => {
    taskSortMode = e.target.value;
    renderTasks(getCurrentFilter());
  });

  // Bulk select
  document.getElementById('bulk-select-btn')?.addEventListener('click', toggleBulkMode);
  document.getElementById('bulk-cancel-btn')?.addEventListener('click', toggleBulkMode);
  document.getElementById('bulk-complete-btn')?.addEventListener('click', bulkCompleteSelected);
  document.getElementById('bulk-delete-btn')?.addEventListener('click', bulkDeleteSelected);

  // Toast undo
  document.getElementById('toast-undo')?.addEventListener('click', undoLastDelete);

  // Task list events (delegated)
  document.getElementById('task-list')?.addEventListener('click', (e) => {
    const checkbox = e.target.closest('.task-checkbox');
    const editBtn = e.target.closest('.edit-task');
    const deleteBtn = e.target.closest('.delete-task');
    const subMini = e.target.closest('.subtask-mini-item');

    if (subMini) {
      toggleSubtaskDone(subMini.dataset.taskId, subMini.dataset.subId);
      return;
    }
    if (checkbox) {
      if (bulkMode) toggleTaskSelection(checkbox.dataset.id);
      else toggleTask(checkbox.dataset.id);
      return;
    }
    if (editBtn) openTaskModal(editBtn.dataset.id);
    if (deleteBtn) deleteTask(deleteBtn.dataset.id);
  });

  // Drag & drop on task list
  const taskList = document.getElementById('task-list');
  taskList?.addEventListener('dragstart', (e) => {
    const card = e.target.closest('.task-card');
    if (card) handleTaskDragStart(e, card.dataset.id);
  });
  taskList?.addEventListener('dragover', handleTaskDragOver);
  taskList?.addEventListener('dragleave', handleTaskDragLeave);
  taskList?.addEventListener('drop', (e) => {
    const card = e.target.closest('.task-card');
    if (card) handleTaskDrop(e, card.dataset.id);
  });
  taskList?.addEventListener('dragend', handleTaskDragEnd);

  // Alarm modal
  document.getElementById('save-alarm-btn')?.addEventListener('click', saveAlarm);
  document.querySelectorAll('.day-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleDaySelection(parseInt(btn.dataset.day, 10)));
  });
  document.getElementById('alarm-sound-upload')?.addEventListener('change', (e) => {
    handleCustomSoundUpload(e.target.files[0]);
  });
  document.getElementById('clear-custom-sound-btn')?.addEventListener('click', clearCustomSound);

  // Alarm list events (delegated)
  document.getElementById('alarm-list')?.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.edit-alarm');
    const deleteBtn = e.target.closest('.delete-alarm');
    const groupToggle = e.target.closest('.group-toggle-btn');
    if (editBtn) openAlarmModal(editBtn.dataset.id);
    if (deleteBtn) deleteAlarm(deleteBtn.dataset.id);
    if (groupToggle) toggleAlarmGroup(groupToggle.dataset.group, groupToggle.dataset.state === 'off');
  });
  document.getElementById('alarm-list')?.addEventListener('change', (e) => {
    const toggle = e.target.closest('.alarm-toggle');
    if (toggle) toggleAlarm(toggle.dataset.id, toggle.checked);
  });

  // Reminder modal
  document.getElementById('save-reminder-btn')?.addEventListener('click', saveReminder);
  document.getElementById('reminder-location-check')?.addEventListener('change', (e) => {
    document.getElementById('reminder-location-fields')?.classList.toggle('hidden', !e.target.checked);
  });
  document.getElementById('capture-location-btn')?.addEventListener('click', captureCurrentLocation);
  const radiusInput = document.getElementById('reminder-location-radius');
  const radiusLabel = document.getElementById('radius-value');
  const updateRadiusLabel = () => { if (radiusInput && radiusLabel) radiusLabel.textContent = `${radiusInput.value} m`; };
  radiusInput?.addEventListener('input', updateRadiusLabel);
  updateRadiusLabel();

  // Reminder list events (delegated)
  document.getElementById('reminder-list')?.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.edit-reminder');
    const deleteBtn = e.target.closest('.delete-reminder');
    if (editBtn) openReminderModal(editBtn.dataset.id);
    if (deleteBtn) deleteReminder(deleteBtn.dataset.id);
  });
  document.getElementById('reminder-list')?.addEventListener('change', (e) => {
    const toggle = e.target.closest('.reminder-toggle');
    if (toggle) toggleReminder(toggle.dataset.id, toggle.checked);
  });

  // Daily reminder toggle
  document.getElementById('daily-reminder-toggle')?.addEventListener('change', (e) => {
    state.settings.dailyReminder = e.target.checked;
    document.getElementById('daily-time-row').style.display = e.target.checked ? 'flex' : 'none';
    saveState();
    if (e.target.checked) {
      NotificationManager.requestPermission();
      scheduleDailyReminder();
      showToast('🌅', 'Daily reminder enabled!');
    } else {
      showToast('🔕', 'Daily reminder disabled');
    }
  });
  document.getElementById('save-daily-time')?.addEventListener('click', () => {
    state.settings.dailyReminderTime = document.getElementById('daily-reminder-time').value;
    saveState();
    scheduleDailyReminder();
    showToast('✅', 'Reminder time saved!');
  });

  // Calendar
  document.getElementById('cal-prev-btn')?.addEventListener('click', () => calendarNavigate(-1));
  document.getElementById('cal-next-btn')?.addEventListener('click', () => calendarNavigate(1));
  document.querySelectorAll('.cal-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => setCalendarMode(btn.dataset.mode));
  });
  document.getElementById('calendar-grid')?.addEventListener('click', (e) => {
    const day = e.target.closest('.cal-day:not(.empty)');
    if (day) selectCalendarDate(day.dataset.date);
  });

  // Settings
  document.getElementById('settings-language')?.addEventListener('change', (e) => setLanguage(e.target.value));
  document.getElementById('settings-accent')?.addEventListener('click', (e) => {
    const swatch = e.target.closest('.accent-swatch');
    if (swatch) setAccentColor(swatch.dataset.color);
  });
  document.getElementById('settings-snooze')?.addEventListener('change', (e) => setSnoozeMinutes(e.target.value));
  document.getElementById('settings-pin-toggle')?.addEventListener('change', (e) => {
    if (e.target.checked) {
      document.getElementById('pin-setup-fields')?.classList.remove('hidden');
    } else {
      disablePinLock();
    }
  });
  document.getElementById('pin-setup-confirm-btn')?.addEventListener('click', () => {
    const pin = document.getElementById('pin-setup-input').value.trim();
    if (!/^\d{4}$/.test(pin)) {
      showToast('⚠️', 'PIN must be exactly 4 digits');
      return;
    }
    enablePinLock(pin);
    document.getElementById('pin-setup-input').value = '';
  });

  // PIN lock screen
  document.getElementById('pin-unlock-btn')?.addEventListener('click', () => {
    const input = document.getElementById('pin-input');
    PinLock.verify(input.value.trim());
  });
  document.getElementById('pin-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') PinLock.verify(e.target.value.trim());
  });

  // Export / Import
  document.getElementById('export-data')?.addEventListener('click', exportData);
  document.getElementById('import-data')?.addEventListener('click', () => {
    document.getElementById('import-file-input')?.click();
  });
  document.getElementById('import-file-input')?.addEventListener('change', importData);

  // Clear all data
  document.getElementById('clear-all-data')?.addEventListener('click', () => {
    showConfirm('All your data will be deleted! Are you sure?', () => {
      state = JSON.parse(JSON.stringify(defaultState));
      saveState();
      renderTasks();
      renderAlarms();
      renderReminders();
      updateStats();
      renderInsights();
      showToast('🗑️', 'All data cleared!');
    });
  });

  // Confirm modal
  document.getElementById('confirm-ok')?.addEventListener('click', () => {
    if (confirmCallback) confirmCallback();
    confirmCallback = null;
    closeModal('confirm-modal');
  });
  document.getElementById('confirm-cancel')?.addEventListener('click', () => {
    confirmCallback = null;
    closeModal('confirm-modal');
  });

  // Alarm ring modal
  document.getElementById('snooze-btn')?.addEventListener('click', () => AlarmSystem.snooze());
  document.getElementById('stop-alarm-btn')?.addEventListener('click', () => AlarmSystem.stopRinging());

  // Install banner
  document.getElementById('install-btn')?.addEventListener('click', installApp);
  document.getElementById('install-close')?.addEventListener('click', () => {
    document.getElementById('install-banner')?.classList.add('hidden');
  });

  // Update banner
  document.getElementById('update-btn')?.addEventListener('click', () => {
    if (newServiceWorker) newServiceWorker.postMessage({ type: 'SKIP_WAITING' });
    else window.location.reload();
    document.getElementById('update-banner')?.classList.add('hidden');
  });
  document.getElementById('update-close')?.addEventListener('click', () => {
    document.getElementById('update-banner')?.classList.add('hidden');
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;

    if (e.key === 'Escape') {
      closeAllModals();
      closeFabMenu();
      return;
    }
    if (typing) return;

    if (e.key === '/') { e.preventDefault(); document.getElementById('task-search')?.focus(); }
    if (e.key.toLowerCase() === 'n') openTaskModal();
    if (e.key.toLowerCase() === 'a') openAlarmModal();
    if (e.key.toLowerCase() === 'r') openReminderModal();
  });
}

// =============================================
// INIT
// =============================================

function startAppAfterUnlock() {
  applyTheme(state.settings.theme);
  applyAccentColor(state.settings.accentColor);
  applyTranslations();
  initDailyReminderUI();
  renderTasks();
  renderAlarms();
  renderReminders();
  updateStats();
  updateClock();
  setInterval(updateClock, 1000);
  AlarmSystem.start();
  LocationReminders.start();
  checkBackupReminder();

  document.getElementById('splash-screen')?.classList.add('hidden');
  document.getElementById('app')?.classList.remove('hidden');

  const isFirstVisit = !localStorage.getItem('pareshaan_visited');
  if (isFirstVisit) {
    localStorage.setItem('pareshaan_visited', 'true');
    setTimeout(() => {
      showToast('👋', 'Welcome to Pareshaan!', 4000);
    }, 800);
  }
}

function init() {
  console.log('%c⏰ Pareshaan v3.0.0', 'color: #7c3aed; font-size: 18px; font-weight: bold;');

  setupEventListeners();
  registerServiceWorker();

  if (Notification && Notification.permission === 'granted') {
    state.settings.notificationsEnabled = true;
  }

  setTimeout(() => {
    if (PinLock.isLockedNow()) {
      PinLock.showLockScreen();
    } else {
      startAppAfterUnlock();
      const params = new URLSearchParams(window.location.search);
      if (params.get('action') === 'add-task') setTimeout(() => openTaskModal(), 500);
      if (params.get('action') === 'add-alarm') setTimeout(() => { switchTab('alarms'); openAlarmModal(); }, 500);
    }
  }, 1200);
}

document.addEventListener('DOMContentLoaded', init);
