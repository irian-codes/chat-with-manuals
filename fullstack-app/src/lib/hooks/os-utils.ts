import {useEffect, useState} from 'react';

export function useIsMacOs(): boolean {
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(
      window.navigator.platform?.toLowerCase().includes('mac') ||
        window.navigator.userAgent.toLowerCase().includes('mac')
    );
  }, []);

  return isMac;
}

export function useIsTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    if (window.matchMedia != null) {
      setIsTouch(window.matchMedia('(pointer: coarse)').matches);
    } else {
      setIsTouch(false);
    }
  }, []);

  return isTouch;
}
