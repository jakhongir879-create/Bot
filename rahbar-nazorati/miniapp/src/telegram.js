export const tg = window.Telegram?.WebApp;

export function initTelegram() {
  if (!tg) return;
  tg.ready();
  tg.expand();
  try {
    tg.disableVerticalSwipes?.();
  } catch {
    /* eski Telegram versiyalari */
  }
  applyTheme();
  tg.onEvent?.('themeChanged', applyTheme);
}

function applyTheme() {
  const scheme = tg?.colorScheme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = scheme;
  try {
    const bg = scheme === 'dark' ? '#000000' : '#f2f2f7';
    tg.setHeaderColor?.(bg);
    tg.setBackgroundColor?.(bg);
    tg.setBottomBarColor?.(bg);
  } catch {
    /* ixtiyoriy */
  }
}

export function haptic(type = 'light') {
  try {
    if (['success', 'error', 'warning'].includes(type)) tg?.HapticFeedback?.notificationOccurred(type);
    else tg?.HapticFeedback?.impactOccurred(type);
  } catch {
    /* ixtiyoriy */
  }
}

const backStack = [];

function handleBack() {
  const top = backStack[backStack.length - 1];
  if (top) top();
}

export function onBackButton(handler) {
  const back = tg?.BackButton;
  if (!back) return () => {};
  backStack.push(handler);
  if (backStack.length === 1) back.onClick(handleBack);
  back.show();
  return () => {
    const index = backStack.lastIndexOf(handler);
    if (index >= 0) backStack.splice(index, 1);
    if (!backStack.length) {
      back.offClick(handleBack);
      back.hide();
    }
  };
}

export function showAlert(message) {
  if (tg?.showAlert) {
    try {
      tg.showAlert(message);
      return;
    } catch {
      /* brauzerda */
    }
  }
  window.alert(message);
}
