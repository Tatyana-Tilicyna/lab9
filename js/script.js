const START_HOUR = 9;
const END_HOUR = 18;
const SLOT_MINUTES = 30;

const state = {
  bookings: [],
  selectedDate: todayStr(),
  nextId: 1,
};

function todayStr() {
  const d = new Date();
  return formatDateISO(d);
}

function formatDateISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDisplayDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("ru-RU", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function shiftDate(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return formatDateISO(date);
}

function timeToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function generateTimeOptions() {
  const options = [];
  for (let m = START_HOUR * 60; m <= END_HOUR * 60; m += SLOT_MINUTES) {
    options.push(minutesToTime(m));
  }
  return options;
}

function getBookingsForDate(date) {
  return state.bookings.filter((b) => b.date === date);
}

function hasOverlap(date, start, end, excludeId = null) {
  const newStart = timeToMinutes(start);
  const newEnd = timeToMinutes(end);
  return getBookingsForDate(date).some((b) => {
    if (b.id === excludeId) return false;
    const bStart = timeToMinutes(b.start);
    const bEnd = timeToMinutes(b.end);
    return newStart < bEnd && newEnd > bStart;
  });
}

function getBusyIntervals(date) {
  return getBookingsForDate(date).map((b) => ({
    start: timeToMinutes(b.start),
    end: timeToMinutes(b.end),
    id: b.id,
  }));
}

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const datePicker = $("#datePicker");
const dateDisplay = $("#dateDisplay");
const bookingsCount = $("#bookingsCount");
const slotsGrid = $("#slotsGrid");
const bookingsList = $("#bookingsList");
const emptyState = $("#emptyState");
const statToday = $("#statToday");
const statTotal = $("#statTotal");

const modalOverlay = $("#modalOverlay");
const bookingForm = $("#bookingForm");
const inputName = $("#inputName");
const inputTopic = $("#inputTopic");
const inputStart = $("#inputStart");
const inputEnd = $("#inputEnd");
const formHint = $("#formHint");
const toastContainer = $("#toastContainer");

function init() {
  populateTimeSelects();
  datePicker.value = state.selectedDate;
  render();
  bindEvents();
}

function populateTimeSelects() {
  const options = generateTimeOptions();
  [inputStart, inputEnd].forEach((select) => {
    select.innerHTML = "";
    options.forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t;
      opt.textContent = t;
      select.appendChild(opt);
    });
  });
  inputStart.value = "09:00";
  inputEnd.value = "10:00";
}

function render() {
  renderDateInfo();
  renderSlots();
  renderBookingsList();
  renderStats();
}

function renderDateInfo() {
  dateDisplay.textContent = formatDisplayDate(state.selectedDate);
  const count = getBookingsForDate(state.selectedDate).length;
  bookingsCount.textContent =
    count === 0
      ? "0 записей"
      : count === 1
      ? "1 запись"
      : count < 5
      ? `${count} записи`
      : `${count} записей`;
}

function renderSlots() {
  slotsGrid.innerHTML = "";
  const busy = getBusyIntervals(state.selectedDate);

  for (let m = START_HOUR * 60; m < END_HOUR * 60; m += SLOT_MINUTES) {
    const slotStart = m;
    const slotEnd = m + SLOT_MINUTES;
    const timeLabel = `${minutesToTime(slotStart)}–${minutesToTime(slotEnd)}`;

    const el = document.createElement("div");
    el.className = "slot";
    el.dataset.start = minutesToTime(slotStart);
    el.dataset.end = minutesToTime(slotEnd);

    const busyBooking = busy.find(
      (b) => slotStart >= b.start && slotEnd <= b.end
    );

    if (busyBooking) {
      el.classList.add("slot-busy", "slot-disabled");
      el.innerHTML = `<div>${timeLabel}</div><div class="slot-time">Занято</div>`;
    } else {
      el.innerHTML = `<div>${timeLabel}</div><div class="slot-time">Свободно</div>`;
      el.addEventListener("click", () => onSlotClick(slotStart, slotEnd));
    }

    slotsGrid.appendChild(el);
  }
}

function renderBookingsList() {
  const bookings = getBookingsForDate(state.selectedDate);
  bookingsList.querySelectorAll(".booking-card").forEach((c) => c.remove());

  if (bookings.length === 0) {
    emptyState.style.display = "block";
    return;
  }

  emptyState.style.display = "none";

  bookings
    .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start))
    .forEach((b) => {
      const card = document.createElement("div");
      card.className = "booking-card";
      card.dataset.id = b.id;
      card.innerHTML = `
        <div class="booking-info">
          <div class="booking-topic">${escapeHtml(b.topic)}</div>
          <div class="booking-meta">
            <span>🕐 ${b.start} – ${b.end}</span>
            <span>👤 ${escapeHtml(b.name)}</span>
          </div>
        </div>
        <div class="booking-actions">
          <button class="btn btn-danger btn-cancel" data-id="${b.id}">Отменить</button>
        </div>
      `;
      bookingsList.appendChild(card);
    });
}

function renderStats() {
  const today = todayStr();
  statToday.textContent = getBookingsForDate(today).length;
  statTotal.textContent = state.bookings.length;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function bindEvents() {
  $("#btnPrevDay").addEventListener("click", () => changeDate(-1));
  $("#btnNextDay").addEventListener("click", () => changeDate(1));
  $("#btnToday").addEventListener("click", () => {
    state.selectedDate = todayStr();
    datePicker.value = state.selectedDate;
    render();
  });
  datePicker.addEventListener("change", (e) => {
    state.selectedDate = e.target.value;
    render();
  });

  $("#btnOpenForm").addEventListener("click", openModal);
  $("#btnCloseModal").addEventListener("click", closeModal);
  $("#btnCancelForm").addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  inputStart.addEventListener("change", validateFormLive);
  inputEnd.addEventListener("change", validateFormLive);

  bookingForm.addEventListener("submit", handleFormSubmit);

  bookingsList.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-cancel");
    if (btn) {
      const id = Number(btn.dataset.id);
      cancelBooking(id);
    }
  });
}

function changeDate(delta) {
  state.selectedDate = shiftDate(state.selectedDate, delta);
  datePicker.value = state.selectedDate;
  render();
}

function onSlotClick(startMin, endMin) {
  inputStart.value = minutesToTime(startMin);
  inputEnd.value = minutesToTime(endMin);
  openModal();
  validateFormLive();
}

function openModal() {
  resetForm();
  modalOverlay.classList.add("active");
  inputName.focus();
}

function closeModal() {
  modalOverlay.classList.remove("active");
  resetForm();
}

function resetForm() {
  bookingForm.reset();
  inputStart.value = "09:00";
  inputEnd.value = "10:00";
  clearErrors();
  formHint.textContent = "";
  formHint.className = "form-hint";
}

function clearErrors() {
  [inputName, inputTopic, inputStart, inputEnd].forEach((el) =>
    el.classList.remove("error")
  );
  $("#errorName").textContent = "";
  $("#errorTopic").textContent = "";
  $("#errorStart").textContent = "";
  $("#errorEnd").textContent = "";
}

function setError(input, errorEl, msg) {
  input.classList.add("error");
  errorEl.textContent = msg;
}

function validateFormLive() {
  clearErrors();
  const start = inputStart.value;
  const end = inputEnd.value;
  if (!start || !end) return;

  if (timeToMinutes(end) <= timeToMinutes(start)) {
    formHint.textContent = "Время окончания должно быть позже времени начала";
    formHint.className = "form-hint conflict";
    return;
  }

  if (hasOverlap(state.selectedDate, start, end)) {
    formHint.textContent = "⚠ Этот интервал уже занят";
    formHint.className = "form-hint conflict";
  } else {
    formHint.textContent = "✓ Интервал свободен";
    formHint.className = "form-hint ok";
  }
}

function handleFormSubmit(e) {
  e.preventDefault();
  clearErrors();

  const name = inputName.value.trim();
  const topic = inputTopic.value.trim();
  const start = inputStart.value;
  const end = inputEnd.value;

  let valid = true;

  if (!name) {
    setError(inputName, $("#errorName"), "Укажите ответственного");
    valid = false;
  }
  if (!topic) {
    setError(inputTopic, $("#errorTopic"), "Укажите тему встречи");
    valid = false;
  }
  if (!start) {
    setError(inputStart, $("#errorStart"), "Выберите время начала");
    valid = false;
  }
  if (!end) {
    setError(inputEnd, $("#errorEnd"), "Выберите время окончания");
    valid = false;
  }

  if (start && end && timeToMinutes(end) <= timeToMinutes(start)) {
    setError(inputEnd, $("#errorEnd"), "Окончание должно быть позже начала");
    valid = false;
  }

  if (start && end && hasOverlap(state.selectedDate, start, end)) {
    setError(inputEnd, $("#errorEnd"), "Интервал пересекается с существующим бронированием");
    showToast("Конфликт времени: этот слот уже занят", "error");
    valid = false;
  }

  if (!valid) return;

  const booking = {
    id: state.nextId++,
    date: state.selectedDate,
    start,
    end,
    name,
    topic,
  };
  state.bookings.push(booking);

  showToast(`Бронирование «${topic}» создано`, "success");
  closeModal();
  render();
}

function cancelBooking(id) {
  const idx = state.bookings.findIndex((b) => b.id === id);
  if (idx === -1) return;
  const booking = state.bookings[idx];
  state.bookings.splice(idx, 1);
  showToast(`Бронирование «${booking.topic}» отменено`, "info");
  render();
}

function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(40px)";
    toast.style.transition = "0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

document.addEventListener("DOMContentLoaded", init);