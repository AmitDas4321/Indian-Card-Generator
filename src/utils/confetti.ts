import confetti from 'canvas-confetti';

/**
 * Triggers a 2-second celebration confetti animation originating directly from the top of the card element.
 * Uses vibrant celebration colors and falls over the card without blocking interaction.
 */
export function triggerSuccessConfetti(targetElement?: HTMLElement | null) {
  const colors = [
    '#FF9933', // Saffron / Orange
    '#FFFFFF', // White
    '#138808', // India Green
    '#000080', // Navy Blue (Ashoka Chakra)
    '#FFD700', // Bright Gold
    '#E11D48', // Celebration Rose
    '#3B82F6', // Sky Blue
    '#10B981', // Vibrant Emerald
  ];

  // Locate the card canvas or container element in the DOM
  const cardEl = targetElement || document.querySelector('canvas') || document.getElementById('card-preview');

  let originX = 0.5;
  let originTopY = 0.2;
  let cardLeftX = 0.3;
  let cardRightX = 0.7;

  if (cardEl) {
    const rect = cardEl.getBoundingClientRect();
    originX = Math.min(Math.max((rect.left + rect.width / 2) / window.innerWidth, 0.1), 0.9);
    // Origin right at the top edge of the card
    originTopY = Math.min(Math.max((rect.top - 10) / window.innerHeight, 0.05), 0.85);
    cardLeftX = Math.min(Math.max(rect.left / window.innerWidth, 0.05), 0.85);
    cardRightX = Math.min(Math.max((rect.left + rect.width) / window.innerWidth, 0.15), 0.95);
  }

  // 1. Initial burst directly from the top center of the card
  confetti({
    particleCount: 85,
    spread: 100,
    startVelocity: 45,
    origin: { x: originX, y: originTopY },
    colors: colors,
    ticks: 220,
    gravity: 0.9,
    scalar: 1.15,
    disableForReducedMotion: true,
  });

  // 2. Cascading bursts from top-left and top-right of the card
  const duration = 2000;
  const animationEnd = Date.now() + duration;

  const timer = setInterval(() => {
    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      clearInterval(timer);
      return;
    }

    const particleCount = Math.floor(20 * (timeLeft / duration));

    // Left top corner of card
    confetti({
      particleCount,
      angle: 60,
      spread: 60,
      origin: { x: cardLeftX, y: originTopY },
      colors: colors,
      ticks: 180,
      gravity: 0.85,
      disableForReducedMotion: true,
    });

    // Right top corner of card
    confetti({
      particleCount,
      angle: 120,
      spread: 60,
      origin: { x: cardRightX, y: originTopY },
      colors: colors,
      ticks: 180,
      gravity: 0.85,
      disableForReducedMotion: true,
    });
  }, 250);
}

