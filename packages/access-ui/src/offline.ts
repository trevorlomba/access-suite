/**
 * Register the site-wide service worker (generated at build time by
 * scripts/assemble-site.mjs) so the tools keep working without a connection.
 * `swUrl` is relative to the page: "./sw.js" from the hub, "../sw.js" from a tool.
 */
export function registerOffline(swUrl: string): void {
  if (!import.meta.env.PROD || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const register = () => navigator.serviceWorker.register(swUrl).catch(() => {});
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
