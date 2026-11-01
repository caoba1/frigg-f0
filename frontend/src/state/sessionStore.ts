// frigg
// Copyright (C) 2026 Carlos de Obaldia Pastor
// SPDX-License-Identifier: AGPL-3.0-or-later

// Simple session state store
import { useState } from 'react';

export function useSession() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [settings, setSettings] = useState<any>(null);
  return { sessionId, setSessionId, settings, setSettings };
}