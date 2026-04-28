import { AppRouter } from "@/routes/app-router";
import { NotificationSocketProvider } from "@/providers/NotificationSocketProvider";

export const App = () => {
  return (
    <NotificationSocketProvider>
      <AppRouter />
    </NotificationSocketProvider>
  );
};
