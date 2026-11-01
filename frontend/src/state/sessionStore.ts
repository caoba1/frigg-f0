// Simple session state store
import { useState } from 'react';

export function useSession() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [settings, setSettings] = useState<any>(null);
  return { sessionId, setSessionId, settings, setSettings };
}