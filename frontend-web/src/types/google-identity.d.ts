/**
 * Kiểu tối thiểu cho Google Identity Services (script accounts.google.com/gsi/client)
 * và vài API trình duyệt cũ, để không phải ép kiểu `window as any`.
 */
interface GoogleCredentialResponse {
  credential: string;
  select_by?: string;
  clientId?: string;
}

interface GoogleAccountsId {
  initialize(config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    [key: string]: unknown;
  }): void;
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
  prompt?(): void;
  disableAutoSelect?(): void;
}

interface Window {
  google?: { accounts: { id: GoogleAccountsId } };
  /** Safari cũ */
  webkitAudioContext?: typeof AudioContext;
}
