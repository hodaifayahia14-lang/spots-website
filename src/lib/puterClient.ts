let _puterLoadPromise: Promise<void> | null = null;

export async function ensurePuterLoaded(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (window.puter?.ai) return;

  if (!_puterLoadPromise) {
    _puterLoadPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector('script[data-puter="true"]') as HTMLScriptElement | null;

      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(), { once: true });
        existingScript.addEventListener('error', () => reject(new Error('Failed to load Puter.js')), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://js.puter.com/v2/';
      script.async = true;
      script.dataset.puter = 'true';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Puter.js'));
      document.head.appendChild(script);
    });
  }

  await _puterLoadPromise;

  if (!window.puter?.ai) {
    throw new Error('Puter.js loaded but API is unavailable');
  }
}

export function getPuter() {
  if (typeof window === 'undefined' || !window.puter?.ai) {
    throw new Error('Puter.js is not loaded');
  }
  return window.puter;
}
