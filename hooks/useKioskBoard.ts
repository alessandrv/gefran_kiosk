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
  const isInitialized = useRef(false);
  const observer = useRef<MutationObserver | null>(null);
  const processedElements = useRef(new WeakSet<Element>());

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

  const isInputElement = (element: Element): boolean => {
    const tagName = element.tagName.toLowerCase();
    if (tagName === 'textarea') return true;
    if (tagName === 'input') {
      const type = (element as HTMLInputElement).type.toLowerCase();
      return ['text', 'number', 'email', 'password', 'search', 'url', 'tel'].includes(type);
    }
    return false;
  };

  const enableKioskBoardForElement = (element: Element) => {
    if (window.KioskBoard && isInitialized.current && !processedElements.current.has(element)) {
      try {
        console.log('Enabling KioskBoard for element:', element);
        window.KioskBoard.run(element, defaultConfig);
        processedElements.current.add(element);
        console.log('KioskBoard enabled for element:', element);
      } catch (error) {
        console.error('Error enabling KioskBoard for element:', element, error);
      }
    }
  };

  const scanAndEnableInputs = () => {
    if (!window.KioskBoard || !isInitialized.current) return;
    
    console.log('Scanning for input elements...');
    const inputs = document.querySelectorAll('input, textarea');
    console.log('Found input elements:', inputs.length);
    
    inputs.forEach(input => {
      if (isInputElement(input)) {
        enableKioskBoardForElement(input);
      }
    });
  };

  const initializeKioskBoard = () => {
    if (window.KioskBoard && isLibraryLoaded.current && !isInitialized.current) {
      try {
        console.log('Initializing KioskBoard globally...');
        window.KioskBoard.init(defaultConfig);
        isInitialized.current = true;
        console.log('KioskBoard initialized successfully');
        
        // Enable KioskBoard on all existing input elements
        scanAndEnableInputs();
        
        // Set up mutation observer to watch for new input elements
        setupMutationObserver();
      } catch (error) {
        console.error('Error initializing KioskBoard:', error);
      }
    }
  };

  const setupMutationObserver = () => {
    if (observer.current) return; // Already set up
    
    console.log('Setting up MutationObserver for new input elements...');
    observer.current = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            
            // Check if the added node itself is an input
            if (isInputElement(element)) {
              enableKioskBoardForElement(element);
            }
            
            // Check for input elements within the added node
            const inputs = element.querySelectorAll('input, textarea');
            inputs.forEach(input => {
              if (isInputElement(input)) {
                enableKioskBoardForElement(input);
              }
            });
          }
        });
      });
    });

    observer.current.observe(document.body, {
      childList: true,
      subtree: true
    });
  };

  const cleanup = () => {
    if (observer.current) {
      observer.current.disconnect();
      observer.current = null;
    }
  };

  useEffect(() => {
    console.log('KioskBoard hook initializing...');
    
    // Load KioskBoard if not already loaded
    if (typeof window !== 'undefined' && !window.KioskBoard && !isLibraryLoaded.current) {
      console.log('Loading KioskBoard library...');
      
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
        console.log('KioskBoard library loaded successfully');
        isLibraryLoaded.current = true;
        // Small delay to ensure DOM is ready
        setTimeout(() => {
          initializeKioskBoard();
        }, 100);
      };

      script.onerror = () => {
        console.error('Failed to load KioskBoard library');
      };
    } else if (window.KioskBoard) {
      console.log('KioskBoard already available');
      isLibraryLoaded.current = true;
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        initializeKioskBoard();
      }, 100);
    }

    // Cleanup function
    return () => {
      cleanup();
    };
  }, []);

  // Re-scan inputs when the hook config changes or component re-renders
  useEffect(() => {
    if (isInitialized.current) {
      // Small delay to allow React to finish rendering
      setTimeout(() => {
        scanAndEnableInputs();
      }, 200);
    }
  }, [isInitialized.current]);

  const enableKioskBoard = (selector: string) => {
    if (typeof window !== 'undefined' && window.KioskBoard && isInitialized.current) {
      try {
        console.log('Manual enableKioskBoard called with selector:', selector);
        const elements = document.querySelectorAll(selector);
        console.log('Found elements for manual enable:', elements.length);
        elements.forEach(element => {
          if (isInputElement(element)) {
            enableKioskBoardForElement(element);
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
      } catch (error) {
        console.error('Error disabling KioskBoard:', error);
      }
    }
  };

  return {
    enableKioskBoard,
    disableKioskBoard,
    isReady: isLibraryLoaded.current && isInitialized.current && !!window.KioskBoard
  };
} 