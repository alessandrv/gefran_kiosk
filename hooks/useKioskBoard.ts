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
  const scanInterval = useRef<NodeJS.Timeout | null>(null);
  const originalModalPositions = useRef(new Map<Element, string>());
  const keyboardOpenElements = useRef(new Set<Element>());

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
    autoScroll: false, // Disable auto-scroll to prevent modal interference
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

  const findModalContainer = (element: Element): Element | null => {
    return element.closest('[role="dialog"], [data-radix-popper-content-wrapper], [data-state="open"]');
  };

  const adjustModalPosition = (modal: Element, isKeyboardOpen: boolean) => {
    const modalContent = modal.querySelector('[data-radix-popper-content-wrapper], [role="dialog"]') || modal;
    
    if (isKeyboardOpen) {
      // Store original position if not already stored
      if (!originalModalPositions.current.has(modalContent)) {
        const computedStyle = window.getComputedStyle(modalContent as HTMLElement);
        originalModalPositions.current.set(modalContent, computedStyle.transform || 'none');
      }
      
      // Move modal up to accommodate keyboard (approximately 300px keyboard height)
      (modalContent as HTMLElement).style.transform = 'translate(-50%, -75%)';
      (modalContent as HTMLElement).style.transition = 'transform 0.3s ease-in-out';
      
      console.log('Adjusted modal position for keyboard');
    } else {
      // Restore original position
      const originalTransform = originalModalPositions.current.get(modalContent);
      if (originalTransform) {
        (modalContent as HTMLElement).style.transform = originalTransform;
        originalModalPositions.current.delete(modalContent);
        console.log('Restored modal position');
      }
    }
  };

  const addKioskBoardStyles = () => {
    const styleId = 'kioskboard-modal-fix';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* Ensure KioskBoard appears above modals and other overlays */
      #KioskBoard-VirtualKeyboard {
        z-index: 99999 !important;
        position: fixed !important;
        bottom: 0 !important;
        left: 0 !important;
        right: 0 !important;
        width: 100% !important;
      }
      
      /* Prevent modal backdrop from interfering with keyboard */
      .kioskboard-backdrop-fix {
        pointer-events: none !important;
      }
      
      /* Ensure keyboard keys are clickable */
      #KioskBoard-VirtualKeyboard * {
        pointer-events: auto !important;
      }
      
      /* Prevent keyboard clicks from closing modals */
      #KioskBoard-VirtualKeyboard {
        pointer-events: auto !important;
      }
      
      /* Fix for Radix UI Dialog overlays - lower their z-index when keyboard is open */
      [data-radix-popper-content-wrapper] {
        z-index: 50 !important;
      }
      
      /* Ensure keyboard container has proper stacking */
      .kioskboard-wrapper {
        z-index: 99999 !important;
        position: relative !important;
      }
      
      /* Modal positioning adjustments when keyboard is open */
      .modal-keyboard-open [role="dialog"] {
        transform: translate(-50%, -75%) !important;
        transition: transform 0.3s ease-in-out !important;
      }
      
      /* Prevent body scroll when keyboard is open */
      body.kioskboard-open {
        overflow: hidden !important;
      }
      
      /* Ensure modals stay visible above keyboard */
      [data-state="open"][role="dialog"] {
        max-height: calc(100vh - 320px) !important;
        overflow-y: auto !important;
      }
    `;
    document.head.appendChild(style);
    console.log('Added enhanced KioskBoard modal compatibility styles');
  };

  const enableKioskBoardForElement = (element: Element) => {
    if (window.KioskBoard && isInitialized.current && !processedElements.current.has(element)) {
      try {
        console.log('Enabling KioskBoard for element:', element);
        
        // Check if element is inside a modal
        const modal = findModalContainer(element);
        const isInModal = !!modal;
        
        // Create element-specific config for modal handling
        const elementConfig = {
          ...defaultConfig,
          // Always disable auto-scroll to prevent modal interference
          autoScroll: false,
        };
        
        // Add event listeners for this specific element
        const handleFocus = () => {
          console.log('Input focused, keyboard will open');
          keyboardOpenElements.current.add(element);
          
          if (isInModal && modal) {
            adjustModalPosition(modal, true);
            document.body.classList.add('modal-keyboard-open');
          }
          
          document.body.classList.add('kioskboard-open');
          
          // Disable modal outside click behavior
          disableModalOutsideClick();
        };
        
        const handleBlur = () => {
          console.log('Input blurred, keyboard may close');
          keyboardOpenElements.current.delete(element);
          
          // Check if any other inputs still have keyboard open
          if (keyboardOpenElements.current.size === 0) {
            if (isInModal && modal) {
              adjustModalPosition(modal, false);
              document.body.classList.remove('modal-keyboard-open');
            }
            
            document.body.classList.remove('kioskboard-open');
            
            // Re-enable modal outside click behavior
            setTimeout(() => enableModalOutsideClick(), 300);
          }
        };
        
        element.addEventListener('focus', handleFocus);
        element.addEventListener('blur', handleBlur);
        
        window.KioskBoard.run(element, elementConfig);
        processedElements.current.add(element);
        console.log('KioskBoard enabled successfully for element:', element, isInModal ? '(in modal)' : '');
      } catch (error) {
        console.error('Error enabling KioskBoard for element:', element, error);
      }
    }
  };

  const disableModalOutsideClick = () => {
    // Find all modal overlays and temporarily disable their click handlers
    const overlays = document.querySelectorAll('[data-radix-popper-content-wrapper], [role="dialog"]');
    overlays.forEach(overlay => {
      (overlay as HTMLElement).style.pointerEvents = 'none';
      overlay.setAttribute('data-keyboard-open', 'true');
    });
    
    // Also disable backdrop clicks
    const backdrops = document.querySelectorAll('[data-radix-dialog-overlay], [data-radix-alert-dialog-overlay]');
    backdrops.forEach(backdrop => {
      (backdrop as HTMLElement).style.pointerEvents = 'none';
      backdrop.setAttribute('data-keyboard-open', 'true');
    });
    
    console.log('Disabled modal outside click behavior');
  };

  const enableModalOutsideClick = () => {
    // Re-enable modal overlays click handlers
    const overlays = document.querySelectorAll('[data-keyboard-open="true"]');
    overlays.forEach(overlay => {
      (overlay as HTMLElement).style.pointerEvents = '';
      overlay.removeAttribute('data-keyboard-open');
    });
    
    console.log('Re-enabled modal outside click behavior');
  };

  const scanAndEnableInputs = () => {
    if (!window.KioskBoard || !isInitialized.current) return;
    
    console.log('Scanning for input elements...');
    const inputs = document.querySelectorAll('input, textarea');
    console.log('Found input elements:', inputs.length);
    
    let newElementsFound = 0;
    inputs.forEach(input => {
      if (isInputElement(input) && !processedElements.current.has(input)) {
        enableKioskBoardForElement(input);
        newElementsFound++;
      }
    });
    
    if (newElementsFound > 0) {
      console.log(`Enabled KioskBoard on ${newElementsFound} new input elements`);
    }
  };

  const initializeKioskBoard = () => {
    if (window.KioskBoard && isLibraryLoaded.current && !isInitialized.current) {
      try {
        console.log('Initializing KioskBoard globally...');
        window.KioskBoard.init(defaultConfig);
        isInitialized.current = true;
        console.log('KioskBoard initialized successfully');
        
        // Add modal compatibility styles
        addKioskBoardStyles();
        
        // Immediately scan for existing inputs
        scanAndEnableInputs();
        
        // Set up mutation observer to watch for new input elements
        setupMutationObserver();
        
        // Set up periodic scanning to catch any missed elements
        setupPeriodicScanning();
        
        // Add global event listener to handle modal interactions
        setupModalEventHandling();
        
      } catch (error) {
        console.error('Error initializing KioskBoard:', error);
      }
    }
  };

  const setupModalEventHandling = () => {
    // Prevent modal close when clicking on keyboard with higher priority
    document.addEventListener('mousedown', (event) => {
      const target = event.target as Element;
      const keyboardElement = target.closest('#KioskBoard-VirtualKeyboard');
      
      if (keyboardElement) {
        // Stop event from bubbling to modal backdrop
        event.stopPropagation();
        event.stopImmediatePropagation();
        console.log('Prevented modal interference from keyboard mousedown');
      }
    }, true);

    document.addEventListener('click', (event) => {
      const target = event.target as Element;
      const keyboardElement = target.closest('#KioskBoard-VirtualKeyboard');
      
      if (keyboardElement) {
        // Stop event from bubbling to modal backdrop
        event.stopPropagation();
        event.stopImmediatePropagation();
        console.log('Prevented modal interference from keyboard click');
      }
    }, true);

    // Handle escape key to close keyboard instead of modal when keyboard is open
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        const keyboardVisible = document.querySelector('#KioskBoard-VirtualKeyboard');
        if (keyboardVisible && window.KioskBoard && keyboardOpenElements.current.size > 0) {
          event.stopPropagation();
          event.stopImmediatePropagation();
          window.KioskBoard.close();
          
          // Clean up keyboard state
          keyboardOpenElements.current.clear();
          document.body.classList.remove('kioskboard-open', 'modal-keyboard-open');
          
          // Restore modal positions
          originalModalPositions.current.forEach((transform, element) => {
            (element as HTMLElement).style.transform = transform;
          });
          originalModalPositions.current.clear();
          
          // Re-enable modal outside click
          setTimeout(() => enableModalOutsideClick(), 100);
          
          console.log('Closed KioskBoard with Escape key and cleaned up state');
        }
      }
    }, true);

    // Listen for KioskBoard events if available
    document.addEventListener('kioskboard-opened', () => {
      console.log('KioskBoard opened event detected');
      disableModalOutsideClick();
    });

    document.addEventListener('kioskboard-closed', () => {
      console.log('KioskBoard closed event detected');
      keyboardOpenElements.current.clear();
      document.body.classList.remove('kioskboard-open', 'modal-keyboard-open');
      
      // Restore all modal positions
      originalModalPositions.current.forEach((transform, element) => {
        (element as HTMLElement).style.transform = transform;
      });
      originalModalPositions.current.clear();
      
      setTimeout(() => enableModalOutsideClick(), 300);
    });
  };

  const setupMutationObserver = () => {
    if (observer.current) return; // Already set up
    
    console.log('Setting up MutationObserver for new input elements...');
    observer.current = new MutationObserver((mutations) => {
      let shouldScan = false;
      
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
            if (inputs.length > 0) {
              shouldScan = true;
            }
          }
        });
      });
      
      // If we found inputs in added nodes, do a full scan
      if (shouldScan) {
        setTimeout(() => {
          scanAndEnableInputs();
        }, 50);
      }
    });

    observer.current.observe(document.body, {
      childList: true,
      subtree: true
    });
  };

  const setupPeriodicScanning = () => {
    // Scan every 2 seconds to catch any elements that might have been missed
    scanInterval.current = setInterval(() => {
      scanAndEnableInputs();
    }, 2000);
    
    console.log('Set up periodic scanning every 2 seconds');
  };

  const cleanup = () => {
    if (observer.current) {
      observer.current.disconnect();
      observer.current = null;
    }
    
    if (scanInterval.current) {
      clearInterval(scanInterval.current);
      scanInterval.current = null;
    }
    
    // Clean up any remaining state
    keyboardOpenElements.current.clear();
    originalModalPositions.current.clear();
    document.body.classList.remove('kioskboard-open', 'modal-keyboard-open');
    enableModalOutsideClick();
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
        // Multiple initialization attempts to ensure it works
        setTimeout(() => initializeKioskBoard(), 100);
        setTimeout(() => initializeKioskBoard(), 500);
        setTimeout(() => initializeKioskBoard(), 1000);
      };

      script.onerror = () => {
        console.error('Failed to load KioskBoard library');
      };
    } else if (window.KioskBoard) {
      console.log('KioskBoard already available');
      isLibraryLoaded.current = true;
      // Multiple initialization attempts to ensure it works
      setTimeout(() => initializeKioskBoard(), 100);
      setTimeout(() => initializeKioskBoard(), 500);
      setTimeout(() => initializeKioskBoard(), 1000);
    }

    // Cleanup function
    return () => {
      cleanup();
    };
  }, []);

  // Additional effect to scan when component updates
  useEffect(() => {
    if (isInitialized.current) {
      // Scan immediately when this effect runs
      scanAndEnableInputs();
      
      // Also scan after a short delay to catch React updates
      const timeouts = [100, 300, 500, 1000].map(delay => 
        setTimeout(() => {
          scanAndEnableInputs();
        }, delay)
      );
      
      return () => {
        timeouts.forEach(timeout => clearTimeout(timeout));
      };
    }
  });

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
        cleanup();
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