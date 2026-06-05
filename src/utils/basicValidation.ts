export const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const phoneRegex = /^\d{10}$/; // assuming 10-digit phone numbers

export const isValidEmail = (email:any) => emailRegex.test(email);
export const isValidPhone = (phone:any) => phoneRegex.test(phone);