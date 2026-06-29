export type PasswordPolicyInput = {
  password: string;
  email?: string;
  name?: string;
};

export type PasswordPolicyIssue = {
  code:
    | 'PASSWORD_MIN_LENGTH'
    | 'PASSWORD_MAX_LENGTH'
    | 'PASSWORD_LOWERCASE'
    | 'PASSWORD_UPPERCASE'
    | 'PASSWORD_NUMBER'
    | 'PASSWORD_SYMBOL'
    | 'PASSWORD_TRIM'
    | 'PASSWORD_CONTAINS_EMAIL'
    | 'PASSWORD_CONTAINS_NAME';
  message: string;
};

const MIN_PASSWORD_LENGTH = 10;
const MAX_PASSWORD_LENGTH = 100;

function normalize(value: string) {
  return value.toLowerCase().trim();
}

function getEmailLocalPart(email?: string) {
  return email?.split('@')[0]?.toLowerCase().trim() ?? '';
}

function getNameTokens(name?: string) {
  return (
    name
      ?.toLowerCase()
      .trim()
      .split(/\s+/)
      .filter((token) => token.length >= 3) ?? []
  );
}

export function validatePasswordPolicy(input: PasswordPolicyInput): PasswordPolicyIssue[] {
  const issues: PasswordPolicyIssue[] = [];
  const password = input.password;
  const normalizedPassword = normalize(password);
  const emailLocalPart = getEmailLocalPart(input.email);
  const nameTokens = getNameTokens(input.name);

  if (password.length < MIN_PASSWORD_LENGTH) {
    issues.push({
      code: 'PASSWORD_MIN_LENGTH',
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`
    });
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    issues.push({
      code: 'PASSWORD_MAX_LENGTH',
      message: `Password must be at most ${MAX_PASSWORD_LENGTH} characters long.`
    });
  }

  if (!/[a-z]/.test(password)) {
    issues.push({
      code: 'PASSWORD_LOWERCASE',
      message: 'Password must include at least one lowercase letter.'
    });
  }

  if (!/[A-Z]/.test(password)) {
    issues.push({
      code: 'PASSWORD_UPPERCASE',
      message: 'Password must include at least one uppercase letter.'
    });
  }

  if (!/\d/.test(password)) {
    issues.push({
      code: 'PASSWORD_NUMBER',
      message: 'Password must include at least one number.'
    });
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    issues.push({
      code: 'PASSWORD_SYMBOL',
      message: 'Password must include at least one symbol.'
    });
  }

  if (password.trim() !== password) {
    issues.push({
      code: 'PASSWORD_TRIM',
      message: 'Password cannot start or end with spaces.'
    });
  }

  if (emailLocalPart.length >= 3 && normalizedPassword.includes(emailLocalPart)) {
    issues.push({
      code: 'PASSWORD_CONTAINS_EMAIL',
      message: 'Password cannot contain the email username.'
    });
  }

  if (nameTokens.some((token) => normalizedPassword.includes(token))) {
    issues.push({
      code: 'PASSWORD_CONTAINS_NAME',
      message: 'Password cannot contain your name.'
    });
  }

  return issues;
}
