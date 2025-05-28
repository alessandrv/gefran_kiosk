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

  const initializeKioskBoard = () => {
    if (window.KioskBoard && isLibraryLoaded.current && !isInitialized.current) {
      try {
        console.log('Initializing KioskBoard globally...');
        window.KioskBoard.init(defaultConfig);
        isInitialized.current = true;
        console.log('KioskBoard initialized successfully');
      } catch (error) {
        console.error('Error initializing KioskBoard:', error);
      }
    }
  };

  const handleClick = (event: Event) => {
    const target = event.target as Element;
    
    if (isInputElement(target) && window.KioskBoard && isInitialized.current) {
      console.log('Click on input element, opening KioskBoard:', target);
      
      // Small delay to ensure the input is focused
      setTimeout(() => {
        try {
          // Use KioskBoard.run for the specific element to open the keyboard
          window.KioskBoard.run(target, defaultConfig);
          console.log('KioskBoard opened for element:', target);
        } catch (error) {
          console.error('Error opening KioskBoard for element:', target, error);
        }
      }, 10);
    }
  };

  const handleFocusIn = (event: Event) => {
    const target = event.target as Element;
    
    if (isInputElement(target) && window.KioskBoard && isInitialized.current) {
      console.log('Focus on input element, preparing KioskBoard:', target);
      
      // Trigger a synthetic click to open the keyboard
      setTimeout(() => {
        try {
          window.KioskBoard.run(target, defaultConfig);
          console.log('KioskBoard opened via focus for element:', target);
        } catch (error) {
          console.error('Error opening KioskBoard via focus:', error);
        }
      }, 100);
    }
  };

  const setupEventListeners = () => {
    console.log('Setting up KioskBoard event listeners...');
    // Use both click and focus events for maximum compatibility
    document.addEventListener('click', handleClick, true);
    document.addEventListener('focusin', handleFocusIn, true);
  };

  const removeEventListeners = () => {
    console.log('Removing KioskBoard event listeners...');
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('focusin', handleFocusIn, true);
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
        initializeKioskBoard();
        setupEventListeners();
      };

      script.onerror = () => {
        console.error('Failed to load KioskBoard library');
      };
    } else if (window.KioskBoard) {
      console.log('KioskBoard already available');
      isLibraryLoaded.current = true;
      initializeKioskBoard();
      setupEventListeners();
    }

    // Cleanup function
    return () => {
      removeEventListeners();
    };
  }, []);

  const enableKioskBoard = (selector: string) => {
    if (typeof window !== 'undefined' && window.KioskBoard && isInitialized.current) {
      try {
        console.log('Manual enableKioskBoard called with selector:', selector);
        const elements = document.querySelectorAll(selector);
        console.log('Found elements for manual enable:', elements.length);
        elements.forEach(element => {
          if (isInputElement(element)) {
            window.KioskBoard.run(element, defaultConfig);
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