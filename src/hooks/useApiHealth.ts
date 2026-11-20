import { useEffect, useState } from "react";
import { getApiHealth } from "../services/api";

export function useApiHealth() {
  const [isOnline, setIsOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;

    getApiHealth()
      .then(() => {
        if (active) setIsOnline(true);
      })
      .catch(() => {
        if (active) setIsOnline(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return isOnline;
}
