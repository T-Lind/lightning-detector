export class AuthenticationError extends Error {}
export class SupersededRequest extends Error {}
export class ServiceError extends Error {}

export class DashboardClient {
  constructor({ fetchImpl = (...args) => fetch(...args), storage, persistentStorage, timeoutMs = 15000 } = {}) {
    this.fetchImpl = fetchImpl;
    this.storage = storage;
    this.persistentStorage = persistentStorage;
    this.timeoutMs = timeoutMs;
    this.revision = 0;
    this.controllers = new Set();
    const read = (target, key) => { try { return target?.getItem(key) ?? ''; } catch { return ''; } };
    const persistentToken = read(persistentStorage, 'dashboard-token');
    const tabToken = read(storage, 'dashboard-token');
    this.token = persistentToken || tabToken;
    // Upgrade an existing tab login after validation; explicit tab-only choices stay tab-only.
    this.rememberBrowser = !!persistentToken || (!!tabToken && read(storage, 'dashboard-storage') !== 'tab');
    this.saved = !!persistentToken;
    this.persistence = persistentToken ? 'browser' : tabToken ? 'tab' : 'memory';
  }

  clear({ forget = true } = {}) {
    this.revision++;
    for (const controller of this.controllers) controller.abort();
    this.controllers.clear();
    this.token = '';
    this.saved = false; this.rememberBrowser = false; this.persistence = 'memory';
    if (forget) {
      for (const target of [this.storage, this.persistentStorage]) {
        try { target?.removeItem('dashboard-token'); target?.removeItem('dashboard-storage'); } catch { /* Storage may be blocked. */ }
      }
    }
  }

  useToken(token, { rememberBrowser = false } = {}) { this.clear(); this.token = token.trim(); this.rememberBrowser = rememberBrowser; }
  remember() {
    if (this.saved || !this.token) return this.persistence;
    if (this.rememberBrowser && this.persistentStorage) {
      try {
        this.persistentStorage.setItem('dashboard-token', this.token);
        this.persistence = 'browser'; this.saved = true;
        try { this.storage?.removeItem('dashboard-token'); this.storage?.removeItem('dashboard-storage'); } catch { /* Optional cleanup. */ }
        return this.persistence;
      } catch { /* Fall back to tab storage and explain the limitation in the UI. */ }
    }
    try {
      if (this.storage) {
        this.storage.setItem('dashboard-token', this.token);
        this.storage.setItem('dashboard-storage', 'tab');
        this.persistence = 'tab'; this.saved = true;
      }
    } catch { /* Memory-only access still works. */ }
    return this.persistence;
  }

  async request(path) {
    const revision = this.revision;
    const controller = new AbortController();
    this.controllers.add(controller);
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const assertCurrent = () => { if (revision !== this.revision) throw new SupersededRequest(); };
    try {
      const response = await this.fetchImpl(path, { headers: { Authorization: `Bearer ${this.token}` },
        cache: 'no-store', signal: controller.signal });
      assertCurrent();
      if (response.status === 401) throw new AuthenticationError('Your dashboard token was rejected. Check it and try again.');
      if (!response.ok) throw new ServiceError('The dashboard service is unavailable. Try again in a moment.');
      const result = await response.json();
      assertCurrent();
      return result;
    } catch (error) {
      assertCurrent();
      if (error instanceof AuthenticationError || error instanceof ServiceError) throw error;
      throw new ServiceError(controller.signal.aborted
        ? 'The service took too long to respond. Try again.'
        : 'Couldn’t reach the dashboard service. Check your connection and try again.');
    } finally {
      clearTimeout(timeout);
      this.controllers.delete(controller);
    }
  }
}
