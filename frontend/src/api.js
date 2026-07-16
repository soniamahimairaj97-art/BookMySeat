import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const TOKEN_KEY = "bms_token";
export const SESSION_KEY = "bms_session"; // { role, employee_id, name }

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function setSession(token, session) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(SESSION_KEY);
}

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Normalize FastAPI error payloads ({"detail": "..."} or validation arrays)
// into a plain Error with a readable .message, so callers/toasts stay simple.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const detail = err.response?.data?.detail;
    let message = "Something went wrong. Please try again.";
    if (typeof detail === "string") message = detail;
    else if (Array.isArray(detail) && detail[0]?.msg) message = detail[0].msg;
    const wrapped = new Error(message);
    wrapped.status = err.response?.status;
    throw wrapped;
  }
);

// ---- Auth ----
export const login = (email, password) =>
  api.post("/login", { email, password }).then((r) => r.data);

// ---- Dashboard ----
export const getDashboard = (date) =>
  api.get("/dashboard", { params: { date } }).then((r) => r.data);

// ---- Bookings ----
export const bookStatus = (booking_date, status) =>
  api.post("/bookings", { booking_date, status }).then((r) => r.data);

export const getMyBookings = () => api.get("/bookings/me").then((r) => r.data);

export const getDayStatus = (date) =>
  api.get("/bookings/status", { params: { date } }).then((r) => r.data);

// ---- Approvals ----
export const requestEdit = (booking_date, reason) =>
  api.post("/approvals", { booking_date, reason }).then((r) => r.data);

export const getMyApprovals = () => api.get("/approvals/mine").then((r) => r.data);

export const getPendingApprovals = () => api.get("/approvals/pending").then((r) => r.data);

export const decideApproval = (id, approve) =>
  api.put(`/approvals/${id}`, { approve }).then((r) => r.data);

// ---- Employees / Teams (manager-only where noted) ----
export const getEmployees = () => api.get("/employees").then((r) => r.data);

export const addEmployee = (employee) => api.post("/employees", employee).then((r) => r.data);

export const getTeams = () => api.get("/teams").then((r) => r.data);

// ---- Holidays ----
export const getHolidays = () => api.get("/holidays").then((r) => r.data);

export const addHoliday = (holiday_date, name) =>
  api.post("/holidays", { holiday_date, name }).then((r) => r.data);

export const deleteHoliday = (holiday_date) =>
  api.delete(`/holidays/${holiday_date}`).then((r) => r.data);

// ---- Export ----
export const exportExcel = (start, end) =>
  api.get("/export", { params: { start, end }, responseType: "blob" }).then((r) => {
    const disposition = r.headers["content-disposition"] || "";
    const match = disposition.match(/filename=([^;]+)/);
    const filename = match ? match[1].trim() : "attendance.xlsx";
    return { blob: r.data, filename };
  });

export default api;
