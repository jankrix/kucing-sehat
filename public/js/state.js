// Simple reactive state store
const _state = {
  user: null,
  token: null,
  cats: [],
  currentCat: null,
  subscription: { plan: 'free', status: 'active' },
};

const _listeners = new Set();

export const state = {
  get user() { return _state.user; },
  get token() { return _state.token; },
  get cats() { return _state.cats; },
  get currentCat() { return _state.currentCat; },
  get subscription() { return _state.subscription; },

  setUser(user) { _state.user = user; _notify(); },
  setToken(token) { _state.token = token; },
  setCats(cats) { _state.cats = cats; _notify(); },
  setCurrentCat(cat) { _state.currentCat = cat; _notify(); },
  setSubscription(sub) { _state.subscription = sub; _notify(); },

  onChange(fn) {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  },
};

function _notify() {
  for (const fn of _listeners) fn(_state);
}
