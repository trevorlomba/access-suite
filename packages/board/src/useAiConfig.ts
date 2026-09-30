import { useSettings } from '@access-suite/access-ui';
import { isConfigured, type ProviderConfig } from '@access-suite/ai';

/** The user's AI provider config, or null when AI is off or incomplete. */
export function useAiConfig(): ProviderConfig | null {
  const { settings } = useSettings();
  if (settings.aiProvider === 'none') return null;
  const cfg = { provider: settings.aiProvider, apiKey: settings.aiKey, model: settings.aiModel };
  return isConfigured(cfg) ? cfg : null;
}
