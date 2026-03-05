import { useEffect, useRef } from 'react';
import './AnimatedBackground.css';

// Shared animation state - only one animation runs for all instances
let sharedAnimationId: number | null = null;
let sharedParticles: FloatingText[] = [];
let activeCanvases = new Set<HTMLCanvasElement>();
let animationRunning = false;
let lastFrameTime = 0;
const TARGET_FPS = 30; // Reduce to 30 FPS for better performance
const FRAME_INTERVAL = 1000 / TARGET_FPS;

// Academic content - equations, formulas, and code snippets
const academicContent = [
  // Calculus
  '∫ f(x)dx',
  '∂f/∂x',
  '∂²f/∂x²',
  'lim x→∞',
  'lim h→0',
  'Σ(n=1 to ∞)',
  'dy/dx = f\'(x)',
  '∫₀ᵅ e⁻ˣdx',
  '∮ F·dr',
  '∇·F',
  '∇×F',
  '∇²f',
  'd/dx[sin(x)]',
  '∫ 1/x dx',
  
  // Algebra & Geometry
  'a² + b² = c²',
  'x = (-b ± √Δ)/2a',
  '(a+b)² = a²+2ab+b²',
  'log(xy) = log(x)+log(y)',
  'log₂(n)',
  'aⁿ · aᵐ = aⁿ⁺ᵐ',
  '√(x² + y²)',
  'x² - y² = (x+y)(x-y)',
  
  // Trigonometry
  'sin²θ + cos²θ = 1',
  'tan(θ) = sin(θ)/cos(θ)',
  'cos(2θ) = cos²θ - sin²θ',
  'sin(α ± β)',
  'e^(iθ) = cos(θ)+i·sin(θ)',
  
  // Physics
  'E = mc²',
  'F = ma',
  'F = G(m₁m₂)/r²',
  'PV = nRT',
  'λ = h/p',
  'E = hf',
  'ΔE·Δt ≥ ℏ/2',
  'V = IR',
  'P = IV',
  'W = F·d',
  'KE = ½mv²',
  'PE = mgh',
  'ψ(x,t)',
  'Schrödinger: iℏ∂ψ/∂t',
  '∮ E·dl = -dΦ/dt',
  'F = q(E + v×B)',
  
  // Linear Algebra & Vectors
  '|v| = √(x²+y²+z²)',
  'v·w = |v||w|cos(θ)',
  'det(A) ≠ 0',
  'Ax = b',
  'λv = Av',
  
  // Complex Numbers
  'z = a + bi',
  '|z| = √(a²+b²)',
  'e^(iπ) + 1 = 0',
  'z* = a - bi',
  
  // Statistics & Probability
  'μ = Σx/n',
  'σ² = Σ(x-μ)²/n',
  'P(A∪B) = P(A)+P(B)',
  'P(A|B) = P(A∩B)/P(B)',
  
  // Binary & Logic
  '1010₂ + 0101₂',
  'A ∧ B',
  'A ∨ B',
  '¬A',
  'A ⊕ B',
  'A → B',
  '∀x ∈ ℝ',
  '∃x: P(x)',
  
  // Number Theory
  'gcd(a,b)',
  'a ≡ b (mod n)',
  'φ(n)',
  'π(x) ~ x/ln(x)',
  
  // Code (minimal, clean)
  'f(x) = x²',
  'O(n log n)',
  'x => x + 1',
  'f\'(x) = 2x',
  'return x',
  'if x > 0',
  'for i in range',
];

// Floating text particle class
class FloatingText {
  x: number;
  y: number;
  text: string;
  speedX: number;
  speedY: number;
  opacity: number;
  fontSize: number;
  rotation: number;
  rotationSpeed: number;

  constructor() {
    // Use viewport dimensions for seamless wrapping
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.x = Math.random() * width;
    this.y = Math.random() * height;
    this.text = academicContent[Math.floor(Math.random() * academicContent.length)];
    this.speedX = (Math.random() - 0.5) * 1.5; // Slightly slower for smoother animation
    this.speedY = (Math.random() - 0.5) * 1.5;
    this.opacity = Math.random() * 0.15 + 0.08;
    this.fontSize = Math.random() * 8 + 14;
    this.rotation = Math.random() * 0.1 - 0.05;
    this.rotationSpeed = (Math.random() - 0.5) * 0.002;
  }

  update() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    this.x += this.speedX;
    this.y += this.speedY;
    this.rotation += this.rotationSpeed;

    // Seamless wrap around viewport edges
    if (this.x > width + 100) this.x = -100;
    if (this.x < -100) this.x = width + 100;
    if (this.y > height + 100) this.y = -100;
    if (this.y < -100) this.y = height + 100;
  }

  draw(ctx: CanvasRenderingContext2D) {
    // Since canvas is fixed, particles are already in viewport coordinates
    // Only draw if particle is visible in viewport
    if (this.x < -100 || this.x > window.innerWidth + 100 || 
        this.y < -100 || this.y > window.innerHeight + 100) {
      return;
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.fillStyle = `rgba(102, 126, 234, ${this.opacity})`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const baseFont = `"STIX Two Math", "Latin Modern Roman", "Computer Modern", "Cambria Math", "Times New Roman", "Times", serif`;
    ctx.font = `${this.fontSize}px ${baseFont}`;
    
    this.renderMathText(ctx, this.text, 0, 0, this.fontSize, baseFont);
    ctx.restore();
  }

  // Cache processed text to avoid re-processing every frame
  private _cachedText: string | null = null;
  private _originalText: string = '';

  renderMathText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, fontSize: number, fontFamily: string) {
    // Cache processed text to avoid re-processing every frame
    if (this._cachedText === null || this._originalText !== text) {
      this._originalText = text;
      
      const superscripts: { [key: string]: string } = {
        '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
        '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
        'a': 'ᵃ', 'b': 'ᵇ', 'c': 'ᶜ', 'd': 'ᵈ', 'e': 'ᵉ', 'f': 'ᶠ', 'g': 'ᵍ', 'h': 'ʰ', 'i': 'ⁱ', 'j': 'ʲ',
        'k': 'ᵏ', 'l': 'ˡ', 'm': 'ᵐ', 'n': 'ⁿ', 'o': 'ᵒ', 'p': 'ᵖ', 'r': 'ʳ', 's': 'ˢ', 't': 'ᵗ', 'u': 'ᵘ',
        'v': 'ᵛ', 'w': 'ʷ', 'x': 'ˣ', 'y': 'ʸ', 'z': 'ᶻ', '∞': 'ᵅ'
      };
      
      const subscripts: { [key: string]: string } = {
        '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
        '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
        'a': 'ₐ', 'e': 'ₑ', 'h': 'ₕ', 'i': 'ᵢ', 'j': 'ⱼ', 'k': 'ₖ', 'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ', 'o': 'ₒ',
        'p': 'ₚ', 'r': 'ᵣ', 's': 'ₛ', 't': 'ₜ', 'u': 'ᵤ', 'v': 'ᵥ', 'x': 'ₓ'
      };

      const fractions: { [key: string]: string } = {
        '1/2': '½', '1/3': '⅓', '2/3': '⅔', '1/4': '¼', '3/4': '¾',
        '1/5': '⅕', '2/5': '⅖', '3/5': '⅗', '4/5': '⅘', '1/6': '⅙',
        '5/6': '⅚', '1/7': '⅐', '1/8': '⅛', '3/8': '⅜', '5/8': '⅝',
        '7/8': '⅞', '1/9': '⅑', '1/10': '⅒'
      };

      let processedText = text;
      
      processedText = processedText.replace(/(\d+)\/(\d+)/g, (match, num, den) => {
        const fraction = `${num}/${den}`;
        return fractions[fraction] || match;
      });
      
      processedText = processedText.replace(/\^(\d+)/g, (_match, num) => {
        return num.split('').map((n: string) => superscripts[n] || n).join('');
      });
      processedText = processedText.replace(/\^([a-z])/g, (_match, letter) => {
        return superscripts[letter.toLowerCase()] || letter;
      });
      processedText = processedText.replace(/\^∞/g, 'ᵅ');
      
      processedText = processedText.replace(/_(\d+)/g, (_match, num) => {
        return num.split('').map((n: string) => subscripts[n] || n).join('');
      });
      processedText = processedText.replace(/_([a-z])/g, (_match, letter) => {
        return subscripts[letter.toLowerCase()] || letter;
      });

      processedText = processedText.replace(/∫₀\^∞/g, '∫₀ᵅ');
      processedText = processedText.replace(/∫₀\^/g, '∫₀');
      processedText = processedText.replace(/∫\^/g, '∫');
      
      this._cachedText = processedText;
    }
    
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.fillText(this._cachedText, x, y);
  }
}

// Shared animation loop
function startSharedAnimation() {
  if (animationRunning) return;
  animationRunning = true;

  // Initialize particles if needed - reduced count for better performance
  if (sharedParticles.length === 0) {
    const textCount = 50; // Reduced from 80 to 50
    for (let i = 0; i < textCount; i++) {
      sharedParticles.push(new FloatingText());
    }
  }

  function animate(currentTime: number) {
    // Throttle to target FPS
    const elapsed = currentTime - lastFrameTime;
    if (elapsed < FRAME_INTERVAL) {
      sharedAnimationId = requestAnimationFrame(animate);
      return;
    }
    lastFrameTime = currentTime - (elapsed % FRAME_INTERVAL);

    // Update all particles
    sharedParticles.forEach(particle => {
      particle.update();
    });

    // Draw on all active canvases
    activeCanvases.forEach(canvas => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Use faster clearing method
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Fill with background color (more efficient than semi-transparent)
      ctx.fillStyle = 'rgba(248, 250, 252, 0.85)'; // Higher opacity for less fade effect = better performance
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw only visible particles (cull off-screen particles)
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      sharedParticles.forEach(particle => {
        // Quick visibility check before drawing
        if (particle.x >= -100 && particle.x <= viewportWidth + 100 &&
            particle.y >= -100 && particle.y <= viewportHeight + 100) {
          particle.draw(ctx);
        }
      });
    });

    sharedAnimationId = requestAnimationFrame(animate);
  }

  animate(performance.now());
}

function stopSharedAnimation() {
  if (sharedAnimationId !== null) {
    cancelAnimationFrame(sharedAnimationId);
    sharedAnimationId = null;
  }
  if (activeCanvases.size === 0) {
    animationRunning = false;
  }
}

export function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match viewport (since it's fixed)
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Add this canvas to active canvases
    activeCanvases.add(canvas);

    // Start shared animation if not running
    startSharedAnimation();

    return () => {
      activeCanvases.delete(canvas);
      window.removeEventListener('resize', resizeCanvas);
      stopSharedAnimation();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="animated-background"
    />
  );
}
