import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import type { Socket } from "socket.io-client";
import { useAuth } from "@/hooks/use-auth";
import {
  connectNotificationSocket,
  disconnectNotificationSocket,
  getNotificationSocket,
} from "@/lib/socket";

type NotificationSocketContextValue = {
  isConnected: boolean;
  socket: Socket | null;
};

const NotificationSocketContext = createContext<NotificationSocketContextValue | null>(null);

export const NotificationSocketProvider = ({ children }: PropsWithChildren) => {
  const { accessToken, isAuthenticated, user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(() => getNotificationSocket());
  const [isConnected, setIsConnected] = useState(Boolean(getNotificationSocket()?.connected));

  useEffect(() => {
    if (!isAuthenticated || !user?.id || !accessToken) {
      disconnectNotificationSocket();
      setSocket(null);
      setIsConnected(false);
      return;
    }

    const nextSocket = connectNotificationSocket({ token: accessToken });

    setSocket(nextSocket);
    setIsConnected(nextSocket.connected);

    const handleConnect = () => {
      setIsConnected(true);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    const handleConnectError = () => {
      setIsConnected(false);
    };

    nextSocket.on("connect", handleConnect);
    nextSocket.on("disconnect", handleDisconnect);
    nextSocket.on("connect_error", handleConnectError);

    return () => {
      nextSocket.off("connect", handleConnect);
      nextSocket.off("disconnect", handleDisconnect);
      nextSocket.off("connect_error", handleConnectError);
    };
  }, [accessToken, isAuthenticated, user?.id]);

  useEffect(() => {
    return () => {
      disconnectNotificationSocket();
    };
  }, []);

  const value = useMemo(
    () => ({
      isConnected,
      socket,
    }),
    [isConnected, socket],
  );

  return (
    <NotificationSocketContext.Provider value={value}>
      {children}
    </NotificationSocketContext.Provider>
  );
};

export const useNotificationSocket = () => {
  const context = useContext(NotificationSocketContext);

  if (!context) {
    throw new Error("useNotificationSocket must be used within NotificationSocketProvider");
  }

  return context;
};
