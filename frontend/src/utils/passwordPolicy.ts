export type PasswordPolicyInput = {
  password: string;
  email?: string;
  name?: string;
};

export type PasswordPolicyRuleId =
  | 'length'
  | 'lowercase'
  | 'uppercase'
  | 'number'
  | 'symbol'
  | 'trim'
  | 'email'
  | 'name';

export type PasswordPolicyRuleStatus = {
  id: PasswordPolicyRuleId;
  passed: boolean;
};

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

export function getPasswordPolicyStatus(input: PasswordPolicyInput) {
  const password = input.password;
  const normalizedPassword = normalize(password);
  const emailLocalPart = getEmailLocalPart(input.email);
  const nameTokens = getNameTokens(input.name);

  const rules: PasswordPolicyRuleStatus[] = [
    {
      id: 'length',
      passed: password.length >= 10 && password.length <= 100
    },
    {
      id: 'lowercase',
      passed: /[a-z]/.test(password)
    },
    {
      id: 'uppercase',
      passed: /[A-Z]/.test(password)
    },
    {
      id: 'number',
      passed: /\d/.test(password)
    },
    {
      id: 'symbol',
      passed: /[^A-Za-z0-9]/.test(password)
    },
    {
      id: 'trim',
      passed: password.length > 0 && password.trim() === password
    },
    {
      id: 'email',
      passed: emailLocalPart.length < 3 || !normalizedPassword.includes(emailLocalPart)
    },
    {
      id: 'name',
      passed: !nameTokens.some((token) => normalizedPassword.includes(token))
    }
  ];

  return {
    rules,
    isValid: rules.every((rule) => rule.passed)
  };
}
