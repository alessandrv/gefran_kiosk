import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    KioskBoard: any;
  }
}

interface KioskBoardConfig {
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
  keysArrayOfObjects?: any[];
  keysJsonUrl?: string;
}

export function useKioskBoard(config: KioskBoardConfig = {}) {
  const isLibraryLoaded = useRef(false);
  const activeInputs = useRef(new Set<HTMLElement>());

  useEffect(() => {
    // Load KioskBoard if not already loaded
    if (typeof window !== 'undefined' && !window.KioskBoard && !isLibraryLoaded.current) {
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
        isLibraryLoaded.current = true;
      };

      script.onerror = () => {
        console.error('Failed to load KioskBoard library');
      };
    } else if (window.KioskBoard) {
      isLibraryLoaded.current = true;
    }
  }, []);

  const enableKioskBoard = (selector: string) => {
    if (typeof window !== 'undefined' && window.KioskBoard && isLibraryLoaded.current) {
      try {
        const elements = document.querySelectorAll(selector);
        
        elements.forEach((element) => {
          if (!activeInputs.current.has(element as HTMLElement)) {
            // Default keyboard layout for network configuration
            const defaultKeysArray = [
              {
                "0": "Q", "1": "W", "2": "E", "3": "R", "4": "T", 
                "5": "Y", "6": "U", "7": "I", "8": "O", "9": "P"
              },
              {
                "0": "A", "1": "S", "2": "D", "3": "F", "4": "G", 
                "5": "H", "6": "J", "7": "K", "8": "L"
              },
              {
                "0": "Z", "1": "X", "2": "C", "3": "V", "4": "B", 
                "5": "N", "6": "M"
              },
              {
                "0": "1", "1": "2", "2": "3", "3": "4", "4": "5", 
                "5": "6", "6": "7", "7": "8", "8": "9", "9": "0"
              },
              {
                "0": ".", "1": "-", "2": "/", "3": ":", "4": " "
              }
            ];

            window.KioskBoard.run(element, {
              language: 'en',
              theme: 'light',
              allowRealKeyboard: true,
              allowMobileKeyboard: false,
              autoScroll: true,
              cssAnimations: true,
              cssAnimationsDuration: 360,
              cssAnimationsStyle: 'slide',
              keysAllowSpacebar: true,
              keysSpacebarText: 'Space',
              keysFontFamily: 'sans-serif',
              keysFontSize: '18px',
              keysFontWeight: 'normal',
              keysIconSize: '20px',
              keysArrayOfObjects: defaultKeysArray,
              ...config
            });
            
            activeInputs.current.add(element as HTMLElement);
          }
        });
      } catch (error) {
        console.error('Error enabling KioskBoard:', error);
      }
    }
  };

  const disableKioskBoard = () => {
    if (window.KioskBoard) {
      try {
        window.KioskBoard.close();
        activeInputs.current.clear();
      } catch (error) {
        console.error('Error disabling KioskBoard:', error);
      }
    }
  };

  return {
    enableKioskBoard,
    disableKioskBoard,
    isReady: isLibraryLoaded.current && !!window.KioskBoard
  };
} 