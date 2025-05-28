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
  const mutationObserver = useRef<MutationObserver | null>(null);
  const processedInputs = useRef(new WeakSet<Element>());

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

  const defaultConfig = {
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
  };

  const enableKioskBoardForElement = (element: Element) => {
    if (window.KioskBoard && isLibraryLoaded.current && !processedInputs.current.has(element)) {
      try {
        window.KioskBoard.run(element, defaultConfig);
        processedInputs.current.add(element);
        console.log('KioskBoard enabled for element:', element);
      } catch (error) {
        console.error('Error enabling KioskBoard for element:', element, error);
      }
    }
  };

  const processInputElements = () => {
    if (!window.KioskBoard || !isLibraryLoaded.current) return;

    // Find all input and textarea elements
    const inputElements = document.querySelectorAll('input[type="text"], input[type="number"], input[type="email"], input[type="password"], textarea');
    
    inputElements.forEach(element => {
      enableKioskBoardForElement(element);
    });
  };

  const setupMutationObserver = () => {
    if (mutationObserver.current) {
      mutationObserver.current.disconnect();
    }

    mutationObserver.current = new MutationObserver((mutations) => {
      let shouldProcess = false;

      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              // Check if the added node is an input or contains inputs
              if (element.matches('input[type="text"], input[type="number"], input[type="email"], input[type="password"], textarea')) {
                shouldProcess = true;
              } else if (element.querySelectorAll('input[type="text"], input[type="number"], input[type="email"], input[type="password"], textarea').length > 0) {
                shouldProcess = true;
              }
            }
          });
        }
      });

      if (shouldProcess) {
        // Small delay to ensure DOM is fully rendered
        setTimeout(processInputElements, 100);
      }
    });

    mutationObserver.current.observe(document.body, {
      childList: true,
      subtree: true
    });
  };

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
        // Process existing inputs and setup observer
        setTimeout(() => {
          processInputElements();
          setupMutationObserver();
        }, 100);
      };

      script.onerror = () => {
        console.error('Failed to load KioskBoard library');
      };
    } else if (window.KioskBoard) {
      isLibraryLoaded.current = true;
      // Process existing inputs and setup observer
      setTimeout(() => {
        processInputElements();
        setupMutationObserver();
      }, 100);
    }

    // Cleanup function
    return () => {
      if (mutationObserver.current) {
        mutationObserver.current.disconnect();
      }
    };
  }, []);

  const enableKioskBoard = (selector: string) => {
    if (typeof window !== 'undefined' && window.KioskBoard && isLibraryLoaded.current) {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => enableKioskBoardForElement(element));
      } catch (error) {
        console.error('Error enabling KioskBoard:', error);
      }
    }
  };

  const disableKioskBoard = () => {
    if (window.KioskBoard) {
      try {
        window.KioskBoard.close();
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