/**
 * Elementor Bridge Utility
 * Message bus for communication between Elementor iframe and React app
 */

export type OrbitAIAction = 
  | { action: 'signup'; packageId?: string }
  | { action: 'launch' }
  | { action: 'launch-demo' }
  | { action: 'scroll'; target: string }
  | { action: 'navigate'; path: string };

export interface OrbitAIMessage {
  type: 'orbitai:cta' | 'orbitai:navigate' | 'orbitai:scroll';
  payload: OrbitAIAction;
  timestamp: number;
}

/**
 * Create a message to send to parent window (from Elementor iframe)
 */
export function createOrbitAIMessage(action: OrbitAIAction): OrbitAIMessage {
  const messageType = action.action === 'scroll' 
    ? 'orbitai:scroll' 
    : action.action === 'navigate'
    ? 'orbitai:navigate'
    : 'orbitai:cta';

  return {
    type: messageType,
    payload: action,
    timestamp: Date.now(),
  };
}

/**
 * Send message to parent window (call from Elementor iframe)
 */
export function sendToParent(action: OrbitAIAction): void {
  if (typeof window === 'undefined' || !window.parent) {
    console.warn('[Elementor Bridge] Cannot send message: no parent window');
    return;
  }

  const message = createOrbitAIMessage(action);
  window.parent.postMessage(message, '*'); // Origin will be validated by receiver
}

/**
 * Validate message received from iframe
 */
export function isValidOrbitAIMessage(
  event: MessageEvent,
  allowedOrigins: string[]
): event is MessageEvent<OrbitAIMessage> {
  // Check origin
  if (allowedOrigins.length > 0 && !allowedOrigins.includes(event.origin)) {
    console.warn('[Elementor Bridge] Message from disallowed origin:', event.origin);
    return false;
  }

  // Check message structure
  const data = event.data;
  if (!data || typeof data !== 'object') {
    return false;
  }

  if (data.type !== 'orbitai:cta' && data.type !== 'orbitai:navigate' && data.type !== 'orbitai:scroll') {
    return false;
  }

  if (!data.payload || typeof data.payload !== 'object') {
    return false;
  }

  const validActions = ['signup', 'launch', 'launch-demo', 'scroll', 'navigate'];
  if (!validActions.includes(data.payload.action)) {
    return false;
  }

  return true;
}

/**
 * Handle message from Elementor iframe
 */
export function handleOrbitAIMessage(
  message: OrbitAIMessage,
  callbacks: {
    onSignup?: (packageId?: string) => void;
    onLaunch?: () => void;
    onLaunchDemo?: () => void;
    onScroll?: (target: string) => void;
    onNavigate?: (path: string) => void;
  }
): void {
  const { payload } = message;

  switch (payload.action) {
    case 'signup':
      callbacks.onSignup?.(payload.packageId);
      break;
    case 'launch':
      callbacks.onLaunch?.();
      break;
    case 'launch-demo':
      callbacks.onLaunchDemo?.();
      break;
    case 'scroll':
      callbacks.onScroll?.(payload.target);
      break;
    case 'navigate':
      callbacks.onNavigate?.(payload.path);
      break;
    default:
      console.warn('[Elementor Bridge] Unknown action:', payload);
  }
}




