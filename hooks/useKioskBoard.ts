import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    KioskBoard: any;
  }
}

interface KioskBoardConfig {
  keysArrayOfObjects?: any[];
  keysJsonUrl?: string;
  language?: string;
  theme?: string;
  autoScroll?: boolean;
  cssAnimations?: boolean;
  cssAnimationsDuration?: number;
  cssAnimationsStyle?: string;
  keysAllowSpacebar?: boolean;
  keysSpacebarText?: string;
  keysFontFamily?: string;
  keysFontSize?: string;
  keysFontWeight?: string;
  keysIconSize?: string;
  allowRealKeyboard?: boolean;
  allowMobileKeyboard?: boolean;
}

export function useKioskBoard(config: KioskBoardConfig = {}) {
  const isInitialized = useRef(false);

  useEffect(() => {
    // Load KioskBoard if not already loaded
    if (typeof window !== 'undefined' && !window.KioskBoard && !isInitialized.current) {
      // Create script tag to load KioskBoard
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/kioskboard@2.3.0/dist/kioskboard-aio-2.3.0.min.js';
      script.async = true;
      
      // Create link tag for CSS
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/kioskboard@2.3.0/dist/kioskboard-2.3.0.min.css';
      
      // Add to head
      document.head.appendChild(link);
      document.head.appendChild(script);
      
      script.onload = () => {
        if (window.KioskBoard) {
          // Initialize KioskBoard with default config
          window.KioskBoard.init({
            keysArrayOfObjects: null,
            keysJsonUrl: '/kioskboard-keys.json',
            language: 'en',
            theme: 'light',
            autoScroll: true,
            cssAnimations: true,
            cssAnimationsDuration: 360,
            cssAnimationsStyle: 'slide',
            keysAllowSpacebar: true,
            keysSpacebarText: 'Space',
            keysFontFamily: 'sans-serif',
            keysFontSize: '22px',
            keysFontWeight: 'normal',
            keysIconSize: '25px',
            allowRealKeyboard: true,
            allowMobileKeyboard: false,
            ...config
          });
          
          isInitialized.current = true;
        }
      };
    } else if (window.KioskBoard && !isInitialized.current) {
      // KioskBoard already loaded, just initialize
      window.KioskBoard.init({
        keysArrayOfObjects: null,
        keysJsonUrl: '/kioskboard-keys.json',
        language: 'en',
        theme: 'light',
        autoScroll: true,
        cssAnimations: true,
        cssAnimationsDuration: 360,
        cssAnimationsStyle: 'slide',
        keysAllowSpacebar: true,
        keysSpacebarText: 'Space',
        keysFontFamily: 'sans-serif',
        keysFontSize: '22px',
        keysFontWeight: 'normal',
        keysIconSize: '25px',
        allowRealKeyboard: true,
        allowMobileKeyboard: false,
        ...config
      });
      
      isInitialized.current = true;
    }
  }, [config]);

  const enableKioskBoard = (selector: string) => {
    if (window.KioskBoard && isInitialized.current) {
      window.KioskBoard.run(selector);
    }
  };

  const disableKioskBoard = () => {
    if (window.KioskBoard) {
      window.KioskBoard.close();
    }
  };

  return {
    enableKioskBoard,
    disableKioskBoard,
    isReady: isInitialized.current && !!window.KioskBoard
  };
} 