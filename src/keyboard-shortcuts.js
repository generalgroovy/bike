export function isGameShortcut(event, { allowHelp = false } = {}) {
  if (event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return false;
  if (event.target?.isContentEditable || event.target?.closest?.('input,textarea,select,[contenteditable="true"]')) return false;
  if (event.key === ' ' && event.target?.closest?.('button,a[href],summary')) return false;
  if (document.querySelector('dialog[open]')) return false;
  if (!allowHelp && document.querySelector('#help-panel:not([hidden])')) return false;
  return true;
}
