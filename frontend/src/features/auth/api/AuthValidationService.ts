import {
  EMAIL_PATTERN,
  PASSWORD_STRENGTH_LABELS,
} from "./AuthConstants";
import type {
  EmailLoginInput,
  EmailSignupInput,
  PasswordStrength,
} from "./AuthTypes";

export function validateEmailLoginInput({ email, password }: EmailLoginInput) {
  if (!email.trim()) {
    return "Email address is required.";
  }

  if (!isValidEmail(email.trim())) {
    return "Please enter a valid email address.";
  }

  if (!password.trim()) {
    return "Password is required.";
  }

  return "";
}

export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return {
      score: 0,
      label: "",
    };
  }

  const score = calculatePasswordStrengthScore(password);

  return {
    score,
    label: PASSWORD_STRENGTH_LABELS[score],
  };
}

export function validateEmailSignupInput(input: EmailSignupInput) {
  if (hasMissingSignupFields(input)) {
    return "Please fill in all fields.";
  }

  if (!isValidEmail(input.email)) {
    return "Please enter a valid email address.";
  }

  // Mirror the backend validatePasswordStrength rules exactly so the frontend
  // always rejects what the backend would reject — no surprises for the user.
  if (input.password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (input.password.length > 128) {
    return "Password must be 128 characters or fewer.";
  }
  if (!/[A-Z]/.test(input.password)) {
    return "Password must contain at least one uppercase letter.";
  }
  if (!/[0-9]/.test(input.password)) {
    return "Password must contain at least one number.";
  }
  if (!/[^A-Za-z0-9]/.test(input.password)) {
    return "Password must contain at least one special character (e.g. !@#$%).";
  }

  if (!input.agreeTerms) {
    return "Please accept the Terms of Service and Privacy Policy.";
  }

  return "";
}

function calculatePasswordStrengthScore(password: string) {
  let score = 0;

  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  return score;
}

function hasMissingSignupFields(input: EmailSignupInput) {
  return (
    !input.firstName.trim() ||
    !input.lastName.trim() ||
    !input.email.trim() ||
    !input.password.trim()
  );
}

function isValidEmail(email: string) {
  return EMAIL_PATTERN.test(email);
}
