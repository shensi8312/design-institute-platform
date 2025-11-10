export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
export const WS_BASE_URL = API_BASE_URL.replace(/^http/, 'ws') || `ws://${window.location.host}`;
export const VIDEO_BASE_URL = import.meta.env.VITE_VIDEO_BASE_URL ?? '';
export const REVIEW_SERVICE_URL = import.meta.env.VITE_REVIEW_SERVICE_URL ?? '';
export const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL ?? window.location.origin;
