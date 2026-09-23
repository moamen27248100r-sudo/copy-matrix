type Translator = (key: string) => string;

const KNOWN_ERRORS: [string, string][] = [
  ["Invalid login credentials", "invalidCredentials"],
  ["Email not confirmed", "emailNotConfirmed"],
  ["User already registered", "alreadyRegistered"],
  ["Password should be at least", "passwordTooShort"],
  ["is invalid", "emailInvalid"],
  ["only request this after", "waitBeforeRetry"],
];

export function translateAuthError(message: string, t: Translator): string {
  const match = KNOWN_ERRORS.find(([needle]) => message.includes(needle));
  return t(match ? match[1] : "genericError");
}
