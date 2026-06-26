import { useEffect } from 'react';
import { socketService } from '../lib/socket';
import useAuthStore from '../store/authStore';
import useNotificationStore from '../store/notificationStore';

const useSocket = () => {
  const { user, accessToken, isAuthenticated } = useAuthStore();
  const addNotification = useNotificationStore((state) => state.addNotification);

  useEffect(() => {
    if (isAuthenticated && accessToken) {
      socketService.connect(accessToken, user?._id);

      // Listen for new notifications
      socketService.on('notification:new', (notification) => {
        addNotification(notification);
        // Play notification sound or show browser notification if desired
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(notification.title, {
            body: notification.message,
          });
        }
      });

      // Listen for session invalidation (login from another device)
      socketService.on('session:invalid', () => {
        const { clearAuth } = useAuthStore.getState();
        clearAuth();
      });

      // Listen for real-time profile updates by admin
      socketService.on('employee:updated', (updatedUser) => {
        const { user: currentUser, updateUser } = useAuthStore.getState();
        if (currentUser && currentUser._id === updatedUser._id) {
          updateUser(updatedUser);
        }
      });

      // Request browser notification permissions if not set
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    } else {
      socketService.disconnect();
    }

    return () => {
      socketService.disconnect();
    };
  }, [isAuthenticated, accessToken, addNotification]);

  return socketService;
};

export default useSocket;
