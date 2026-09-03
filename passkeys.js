// Face ID / fingerprint login helpers (WebAuthn passkeys)
import { API_BASE_URL } from './api';

const b64uToBuf = (s) =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));

const bufToB64u = (b) =>
  btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const passkeysSupported = () => {
  try {
    return !!(window.PublicKeyCredential && navigator.credentials);
  } catch (e) {
    return false;
  }
};

export const hasRegisteredPasskey = () => {
  try {
    return !!localStorage.getItem('passkey_registered');
  } catch (e) {
    return false;
  }
};

export const passkeyPromptDismissed = () => {
  try {
    return !!localStorage.getItem('passkey_prompt_dismissed');
  } catch (e) {
    return true;
  }
};

export const dismissPasskeyPrompt = () => {
  try { localStorage.setItem('passkey_prompt_dismissed', '1'); } catch (e) { /* ignore */ }
};

async function postJson(path, body) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Something went wrong — please try again');
  }
  return data;
}

// One-time setup on this phone: register a passkey for the logged-in employee
export async function registerPasskey(employeeNumber) {
  const options = await postJson('/api/auth/passkey/register-options', { employee_number: employeeNumber });
  options.challenge = b64uToBuf(options.challenge);
  options.user.id = b64uToBuf(options.user.id);
  if (options.excludeCredentials) {
    options.excludeCredentials = options.excludeCredentials.map((c) => ({ ...c, id: b64uToBuf(c.id) }));
  }
  const cred = await navigator.credentials.create({ publicKey: options });
  await postJson('/api/auth/passkey/register-verify', {
    employee_number: employeeNumber,
    credential: {
      id: cred.id,
      rawId: bufToB64u(cred.rawId),
      type: cred.type,
      response: {
        clientDataJSON: bufToB64u(cred.response.clientDataJSON),
        attestationObject: bufToB64u(cred.response.attestationObject),
      },
    },
  });
  try { localStorage.setItem('passkey_registered', employeeNumber); } catch (e) { /* ignore */ }
  return true;
}

// Sign in with Face ID / fingerprint; returns the employee object
export async function loginWithPasskey() {
  const options = await postJson('/api/auth/passkey/login-options');
  options.challenge = b64uToBuf(options.challenge);
  if (options.allowCredentials) {
    options.allowCredentials = options.allowCredentials.map((c) => ({ ...c, id: b64uToBuf(c.id) }));
  }
  const cred = await navigator.credentials.get({ publicKey: options });
  const data = await postJson('/api/auth/passkey/login-verify', {
    credential: {
      id: cred.id,
      rawId: bufToB64u(cred.rawId),
      type: cred.type,
      response: {
        clientDataJSON: bufToB64u(cred.response.clientDataJSON),
        authenticatorData: bufToB64u(cred.response.authenticatorData),
        signature: bufToB64u(cred.response.signature),
        userHandle: cred.response.userHandle ? bufToB64u(cred.response.userHandle) : null,
      },
    },
  });
  return data.employee;
}
