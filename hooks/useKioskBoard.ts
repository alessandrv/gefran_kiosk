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
    if (window.KioskBoard && isLibraryLoaded.current && !processedInputs.current.has(element)) {
      try {
        console.log('Enabling KioskBoard for focused element:', element);
        window.KioskBoard.run(element, defaultConfig);
        processedInputs.current.add(element);
        console.log('KioskBoard enabled successfully for element:', element);
      } catch (error) {
        console.error('Error enabling KioskBoard for element:', element, error);
      }
    }
  };

  const handleFocusIn = (event: Event) => {
    const target = event.target as Element;
    console.log('Focus event on element:', target);
    
    if (isInputElement(target)) {
      console.log('Input element focused, enabling KioskBoard...');
      enableKioskBoardForElement(target);
    }
  };

  const setupFocusListeners = () => {
    console.log('Setting up focus listeners...');
    // Use focusin event which bubbles up, unlike focus
    document.addEventListener('focusin', handleFocusIn, true);
  };

  const removeFocusListeners = () => {
    console.log('Removing focus listeners...');
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
        setupFocusListeners();
      };

      script.onerror = () => {
        console.error('Failed to load KioskBoard library');
      };
    } else if (window.KioskBoard) {
      console.log('KioskBoard already available');
      isLibraryLoaded.current = true;
      setupFocusListeners();
    }

    // Cleanup function
    return () => {
      removeFocusListeners();
    };
  }, []);

  const enableKioskBoard = (selector: string) => {
    if (typeof window !== 'undefined' && window.KioskBoard && isLibraryLoaded.current) {
      try {
        console.log('Manual enableKioskBoard called with selector:', selector);
        const elements = document.querySelectorAll(selector);
        console.log('Found elements for manual enable:', elements.length);
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