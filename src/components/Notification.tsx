import React from 'react';
import { useAppStore } from '../store/appStore';

export const Notification: React.FC = () => {
  const { notification, clearNotification } = useAppStore();

  if (!notification) return null;

  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const className = {
    success: 'toast-success',
    error: 'toast-error',
    info: 'toast-info',
  }[notification.type];

  return (
    <div
      className={className}
      role="alert"
      aria-live="polite"
    >
      <span className="text-base leading-none">{icons[notification.type]}</span>
      <span className="flex-1">{notification.message}</span>
      <button
        onClick={clearNotification}
        className="opacity-60 hover:opacity-100 transition-opacity ml-2 text-xs"
        aria-label="Dismiss notification"
      >
        ✕
      </button>
    </div>
  );
};
