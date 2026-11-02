/** Garage account rules shared by the browser forms and the server (no Node imports here). */
export const EMAIL_PATTERN = /^[^\s@<>"']{1,64}@[^\s@<>"']+\.[a-z]{2,}$/i
export const PASSWORD_MIN = 8, PASSWORD_MAX = 128
