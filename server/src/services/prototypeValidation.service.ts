import { logger } from '../utils/logger.js';

export interface ValidationIssue {
  field: string;
  severity: 'critical' | 'warning' | 'info';
  reason: string;
  suggestion?: string;
}

export interface ArchitectureValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  score: number; // 0-100
  containers: number;
  relationships: number;
  hasTechnologyAnnotations: boolean;
}

export interface WireframeValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  score: number; // 0-100
  hasValidHTML: boolean;
  hasReactCode: boolean;
  hasAssets: boolean;
  accessibilityScore: number;
  performanceScore: number;
  securityScore: number;
}

export interface AssetValidationResult {
  hasImages: boolean;
  hasIcons: boolean;
  hasPlaceholders: boolean;
  imageCount: number;
  iconCount: number;
  placeholderCount: number;
  issues: ValidationIssue[];
  score: number; // 0-100
}

export interface VisualDesignValidationResult {
  hasColorScheme: boolean;
  hasTypography: boolean;
  responsiveDesign: boolean;
  accessibilityCompliant: boolean;
  issues: ValidationIssue[];
  score: number; // 0-100
}

export interface ComprehensiveValidationResult {
  overallScore: number; // 0-100
  architecture: ArchitectureValidationResult;
  wireframe: WireframeValidationResult;
  assets: AssetValidationResult;
  visualDesign: VisualDesignValidationResult;
  allIssues: ValidationIssue[];
  criticalIssues: ValidationIssue[];
  warnings: ValidationIssue[];
  info: ValidationIssue[];
}

/**
 * Comprehensive validation service for prototype generation
 * Validates architecture diagrams, wireframe code, assets, and visual design
 */
export class PrototypeValidationService {
  /**
   * Validate architecture diagram
   */
  validateArchitectureDiagram(diagram: string): ArchitectureValidationResult {
    const issues: ValidationIssue[] = [];
    let score = 100;

    if (!diagram || diagram.trim().length < 50) {
      issues.push({
        field: 'architectureDiagram',
        severity: 'critical',
        reason: 'Architecture diagram is too short or missing',
        suggestion: 'Generate a complete C4 Container diagram with at least 2 containers and relationships'
      });
      return {
        isValid: false,
        issues,
        score: 0,
        containers: 0,
        relationships: 0,
        hasTechnologyAnnotations: false
      };
    }

    // Clean diagram
    let cleanDiagram = diagram.replace(/```mermaid\n?/g, '').replace(/```\n?/g, '').trim();

    // Check for C4Container directive
    const hasC4Directive = /^C4Container/i.test(cleanDiagram);
    if (!hasC4Directive) {
      issues.push({
        field: 'architectureDiagram',
        severity: 'critical',
        reason: 'Missing C4Container directive',
        suggestion: 'Start diagram with "C4Container" directive'
      });
      score -= 30;
    }

    // Count containers
    const containerMatches = cleanDiagram.match(/(Container|System|ContainerDb|Container_Ext|System_Ext)\(/gi);
    const containerCount = containerMatches ? containerMatches.length : 0;

    if (containerCount < 2) {
      issues.push({
        field: 'architectureDiagram',
        severity: 'critical',
        reason: `Only ${containerCount} container(s) found, need at least 2`,
        suggestion: 'Add more containers (frontend, backend, database, etc.)'
      });
      score -= 25;
    }

    // Count relationships
    const relMatches = cleanDiagram.match(/Rel\(/gi);
    const relationshipCount = relMatches ? relMatches.length : 0;

    if (relationshipCount < 1) {
      issues.push({
        field: 'architectureDiagram',
        severity: 'critical',
        reason: 'No relationships found between containers',
        suggestion: 'Add Rel() calls to show how containers interact'
      });
      score -= 25;
    }

    // Check for technology annotations
    const hasTechAnnotations = /Container\([^,]+,[^,]+,[^,]+,"[^"]+"\)/i.test(cleanDiagram) ||
                                cleanDiagram.includes('Technology') ||
                                cleanDiagram.match(/"[A-Za-z0-9\s]+"/g)?.length > 0;

    if (!hasTechAnnotations) {
      issues.push({
        field: 'architectureDiagram',
        severity: 'warning',
        reason: 'Missing technology annotations',
        suggestion: 'Add technology annotations to containers (4th parameter)'
      });
      score -= 10;
    }

    // Validate Mermaid syntax basics
    const lines = cleanDiagram.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length <= 1) {
      issues.push({
        field: 'architectureDiagram',
        severity: 'critical',
        reason: 'Diagram appears incomplete (only 1 line)',
        suggestion: 'Generate a complete diagram with multiple containers and relationships'
      });
      score -= 20;
    }

    // Check for proper function calls
    const hasValidFunctions = lines.some(line =>
      /^(Container|System|Person|System_Ext|Container_Ext|Rel|SystemBoundary|ContainerBoundary|Person_Ext|UpdateElementStyle|UpdateRelStyle|UpdateLayoutConfig)\(/i.test(line)
    );

    if (!hasValidFunctions && hasC4Directive) {
      issues.push({
        field: 'architectureDiagram',
        severity: 'critical',
        reason: 'C4Container directive present but no valid function calls found',
        suggestion: 'Add Container(), System(), or Rel() function calls after the directive'
      });
      score -= 30;
    }

    return {
      isValid: score >= 70 && issues.filter(i => i.severity === 'critical').length === 0,
      issues,
      score: Math.max(0, score),
      containers: containerCount,
      relationships: relationshipCount,
      hasTechnologyAnnotations: hasTechAnnotations
    };
  }

  /**
   * Validate wireframe code
   */
  validateWireframeCode(code: string): WireframeValidationResult {
    const issues: ValidationIssue[] = [];
    let score = 100;

    if (!code || code.trim().length < 500) {
      issues.push({
        field: 'wireframeCode',
        severity: 'critical',
        reason: 'Wireframe code is too short or missing',
        suggestion: 'Generate at least 500 characters of production-ready code'
      });
      return {
        isValid: false,
        issues,
        score: 0,
        hasValidHTML: false,
        hasReactCode: false,
        hasAssets: false,
        accessibilityScore: 0,
        performanceScore: 0,
        securityScore: 0
      };
    }

    // HTML structure validation
    const hasDoctype = code.includes('<!DOCTYPE') || code.includes('<!doctype');
    const hasHtmlTag = code.includes('<html') || code.includes('<HTML');
    const hasBodyTag = code.includes('<body') || code.includes('<BODY');
    const hasHeadTag = code.includes('<head') || code.includes('<HEAD');

    if (!hasDoctype && !hasHtmlTag) {
      issues.push({
        field: 'wireframeCode',
        severity: 'critical',
        reason: 'Missing HTML structure (DOCTYPE or html tag)',
        suggestion: 'Include proper HTML5 structure with <!DOCTYPE html> and <html> tags'
      });
      score -= 15;
    }

    // React code validation
    const hasReact = code.includes('React') || code.includes('react') ||
                     code.includes('useState') || code.includes('useEffect') ||
                     code.includes('createElement') || code.includes('React.createElement');
    const hasReactCDN = code.includes('unpkg.com/react') || code.includes('cdnjs.cloudflare.com/react');

    if (!hasReact && !hasReactCDN) {
      issues.push({
        field: 'wireframeCode',
        severity: 'warning',
        reason: 'React code patterns not detected',
        suggestion: 'Use React 18+ with hooks (useState, useEffect, etc.)'
      });
      score -= 10;
    }

    // Asset validation
    const hasImages = /<img[^>]+src=/i.test(code) ||
                     code.includes('unsplash.com') ||
                     code.includes('pexels.com') ||
                     code.includes('data:image') ||
                     code.includes('base64');
    const hasIcons = code.includes('<svg') ||
                     code.includes('icon') ||
                     code.includes('lucide') ||
                     code.includes('heroicons');
    const hasAssets = hasImages || hasIcons;

    if (!hasAssets) {
      issues.push({
        field: 'wireframeCode',
        severity: 'warning',
        reason: 'No visual assets detected (images, icons)',
        suggestion: 'Include actual images/icons, not placeholder text'
      });
      score -= 10;
    }

    // Placeholder detection
    const placeholderPatterns = [
      /image\s+here/gi,
      /placeholder/gi,
      /lorem\s+ipsum/gi,
      /add\s+image/gi,
      /insert\s+image/gi,
      /\[image\]/gi,
      /\[icon\]/gi
    ];

    const hasPlaceholders = placeholderPatterns.some(pattern => pattern.test(code));
    if (hasPlaceholders) {
      issues.push({
        field: 'wireframeCode',
        severity: 'critical',
        reason: 'Placeholder text detected in code',
        suggestion: 'Replace all placeholders with actual assets (images, icons, content)'
      });
      score -= 20;
    }

    // Accessibility validation
    let accessibilityScore = 100;
    const hasAriaLabels = code.includes('aria-label') || code.includes('ariaLabel');
    const hasSemanticHTML = /<(header|nav|main|article|section|footer|button|form|input)/i.test(code);
    const hasAltText = /<img[^>]+alt=/i.test(code);
    const hasViewport = code.includes('viewport') || code.includes('meta name="viewport"');

    if (!hasAriaLabels && !hasSemanticHTML) {
      issues.push({
        field: 'wireframeCode',
        severity: 'warning',
        reason: 'Missing accessibility features (ARIA labels, semantic HTML)',
        suggestion: 'Add ARIA labels and use semantic HTML5 elements'
      });
      accessibilityScore -= 20;
    }

    if (!hasAltText && hasImages) {
      issues.push({
        field: 'wireframeCode',
        severity: 'warning',
        reason: 'Images missing alt text',
        suggestion: 'Add alt attributes to all images for accessibility'
      });
      accessibilityScore -= 15;
    }

    if (!hasViewport) {
      issues.push({
        field: 'wireframeCode',
        severity: 'warning',
        reason: 'Missing viewport meta tag for responsive design',
        suggestion: 'Add <meta name="viewport" content="width=device-width, initial-scale=1.0">'
      });
      accessibilityScore -= 10;
    }

    // Performance validation
    let performanceScore = 100;
    const hasLazyLoading = code.includes('loading="lazy"') || code.includes('loading="lazy"');
    const hasAsyncScripts = code.includes('async') || code.includes('defer');
    const hasOptimizedImages = code.includes('width=') && code.includes('height=');

    if (!hasLazyLoading && hasImages) {
      issues.push({
        field: 'wireframeCode',
        severity: 'info',
        reason: 'Images not using lazy loading',
        suggestion: 'Add loading="lazy" to images for better performance'
      });
      performanceScore -= 10;
    }

    // Security validation
    let securityScore = 100;
    const hasInnerHTML = code.includes('.innerHTML') && !code.includes('sanitize');
    const hasEval = code.includes('eval(') || code.includes('Function(');
    const hasDangerousPatterns = /onclick=["']javascript:/i.test(code) ||
                                  /href=["']javascript:/i.test(code);

    if (hasInnerHTML) {
      issues.push({
        field: 'wireframeCode',
        severity: 'warning',
        reason: 'Using innerHTML without sanitization (XSS risk)',
        suggestion: 'Avoid innerHTML or use proper sanitization'
      });
      securityScore -= 15;
    }

    if (hasEval || hasDangerousPatterns) {
      issues.push({
        field: 'wireframeCode',
        severity: 'critical',
        reason: 'Dangerous code patterns detected (eval, javascript: URLs)',
        suggestion: 'Remove eval() and javascript: URL patterns for security'
      });
      securityScore -= 25;
    }

    // Responsive design validation
    const hasResponsiveCSS = code.includes('@media') ||
                             code.includes('responsive') ||
                             code.includes('sm:') || code.includes('md:') || code.includes('lg:') ||
                             code.includes('tailwindcss');

    if (!hasResponsiveCSS && !code.includes('tailwindcss')) {
      issues.push({
        field: 'wireframeCode',
        severity: 'warning',
        reason: 'No responsive design patterns detected',
        suggestion: 'Add responsive CSS (media queries or Tailwind responsive classes)'
      });
      score -= 10;
    }

    // Functionality validation
    const hasInteractiveElements = /<button|onClick|onSubmit|onChange|addEventListener/i.test(code);
    const hasStateManagement = code.includes('useState') || code.includes('useReducer') || code.includes('state');

    if (!hasInteractiveElements) {
      issues.push({
        field: 'wireframeCode',
        severity: 'warning',
        reason: 'No interactive elements detected',
        suggestion: 'Add buttons, forms, or other interactive elements'
      });
      score -= 10;
    }

    return {
      isValid: score >= 70 && issues.filter(i => i.severity === 'critical').length === 0,
      issues,
      score: Math.max(0, score),
      hasValidHTML: hasDoctype || hasHtmlTag,
      hasReactCode: hasReact || hasReactCDN,
      hasAssets: hasAssets,
      accessibilityScore: Math.max(0, accessibilityScore),
      performanceScore: Math.max(0, performanceScore),
      securityScore: Math.max(0, securityScore)
    };
  }

  /**
   * Validate assets in wireframe code
   */
  validateAssets(code: string): AssetValidationResult {
    const issues: ValidationIssue[] = [];
    let score = 100;

    // Count images
    const imageMatches = code.match(/<img[^>]+>/gi) || [];
    const imageCount = imageMatches.length;

    // Count icons (SVG or icon references)
    const svgMatches = code.match(/<svg[^>]*>/gi) || [];
    const iconRefs = (code.match(/icon|Icon/gi) || []).length;
    const iconCount = svgMatches.length + Math.floor(iconRefs / 2); // Approximate

    // Check for placeholders
    const placeholderPatterns = [
      /image\s+here/gi,
      /placeholder/gi,
      /\[image\]/gi,
      /\[icon\]/gi,
      /add\s+image/gi,
      /insert\s+image/gi,
      /TODO.*image/gi
    ];

    const placeholderMatches = placeholderPatterns.map(p => code.match(p) || []).flat();
    const placeholderCount = placeholderMatches.length;

    if (placeholderCount > 0) {
      issues.push({
        field: 'assets',
        severity: 'critical',
        reason: `${placeholderCount} placeholder(s) found instead of actual assets`,
        suggestion: 'Replace all placeholders with actual images, icons, or graphics'
      });
      score -= placeholderCount * 10;
    }

    if (imageCount === 0 && iconCount === 0) {
      issues.push({
        field: 'assets',
        severity: 'warning',
        reason: 'No visual assets detected',
        suggestion: 'Include images, icons, or graphics to enhance visual appeal'
      });
      score -= 20;
    }

    // Check image quality (has src attribute)
    const imagesWithoutSrc = imageMatches.filter(img => !/<img[^>]+src=/i.test(img));
    if (imagesWithoutSrc.length > 0) {
      issues.push({
        field: 'assets',
        severity: 'warning',
        reason: `${imagesWithoutSrc.length} image(s) missing src attribute`,
        suggestion: 'Ensure all images have valid src attributes'
      });
      score -= imagesWithoutSrc.length * 5;
    }

    return {
      hasImages: imageCount > 0,
      hasIcons: iconCount > 0,
      hasPlaceholders: placeholderCount > 0,
      imageCount,
      iconCount,
      placeholderCount,
      issues,
      score: Math.max(0, score)
    };
  }

  /**
   * Validate visual design aspects
   */
  validateVisualDesign(code: string): VisualDesignValidationResult {
    const issues: ValidationIssue[] = [];
    let score = 100;

    // Check for color scheme
    const hasColors = /#[0-9a-fA-F]{3,6}/.test(code) ||
                     /rgb\(|rgba\(|hsl\(|hsla\(/.test(code) ||
                     /bg-|text-|border-/.test(code) || // Tailwind colors
                     code.includes('color:') || code.includes('background');

    if (!hasColors) {
      issues.push({
        field: 'visualDesign',
        severity: 'warning',
        reason: 'No color scheme detected',
        suggestion: 'Add a consistent color palette'
      });
      score -= 15;
    }

    // Check for typography
    const hasTypography = code.includes('font-') ||
                         code.includes('fontFamily') ||
                         code.includes('font-size') ||
                         code.includes('text-') || // Tailwind text utilities
                         /font-family:/i.test(code);

    if (!hasTypography) {
      issues.push({
        field: 'visualDesign',
        severity: 'info',
        reason: 'No typography styling detected',
        suggestion: 'Add font family and typography styles'
      });
      score -= 10;
    }

    // Check for responsive design
    const hasResponsive = code.includes('@media') ||
                         code.includes('viewport') ||
                         code.includes('sm:') || code.includes('md:') || code.includes('lg:') ||
                         code.includes('xl:') || code.includes('responsive');

    if (!hasResponsive) {
      issues.push({
        field: 'visualDesign',
        severity: 'warning',
        reason: 'No responsive design patterns detected',
        suggestion: 'Add responsive breakpoints for mobile, tablet, and desktop'
      });
      score -= 15;
    }

    // Accessibility compliance
    const hasAria = code.includes('aria-') || code.includes('role=');
    const hasSemanticHTML = /<(header|nav|main|article|section|footer|button|form|input|label)/i.test(code);
    const hasAltText = /<img[^>]+alt=/i.test(code);

    const accessibilityCompliant = hasAria || hasSemanticHTML;

    if (!accessibilityCompliant) {
      issues.push({
        field: 'visualDesign',
        severity: 'warning',
        reason: 'Missing accessibility features',
        suggestion: 'Add ARIA labels and use semantic HTML elements'
      });
      score -= 15;
    }

    return {
      hasColorScheme: hasColors,
      hasTypography: hasTypography,
      responsiveDesign: hasResponsive,
      accessibilityCompliant: accessibilityCompliant,
      issues,
      score: Math.max(0, score)
    };
  }

  /**
   * Comprehensive validation of all prototype components
   */
  validateComprehensive(preview: {
    summary?: string;
    techStack?: string[];
    architectureDiagram?: string;
    wireframeCode?: string;
    risks?: string[];
  }): ComprehensiveValidationResult {
    const allIssues: ValidationIssue[] = [];

    // Validate architecture
    const architecture = preview.architectureDiagram
      ? this.validateArchitectureDiagram(preview.architectureDiagram)
      : {
          isValid: false,
          issues: [{
            field: 'architectureDiagram',
            severity: 'critical' as const,
            reason: 'Architecture diagram is missing'
          }],
          score: 0,
          containers: 0,
          relationships: 0,
          hasTechnologyAnnotations: false
        };

    // Validate wireframe
    const wireframe = preview.wireframeCode
      ? this.validateWireframeCode(preview.wireframeCode)
      : {
          isValid: false,
          issues: [{
            field: 'wireframeCode',
            severity: 'critical' as const,
            reason: 'Wireframe code is missing'
          }],
          score: 0,
          hasValidHTML: false,
          hasReactCode: false,
          hasAssets: false,
          accessibilityScore: 0,
          performanceScore: 0,
          securityScore: 0
        };

    // Validate assets
    const assets = preview.wireframeCode
      ? this.validateAssets(preview.wireframeCode)
      : {
          hasImages: false,
          hasIcons: false,
          hasPlaceholders: false,
          imageCount: 0,
          iconCount: 0,
          placeholderCount: 0,
          issues: [{
            field: 'assets',
            severity: 'critical' as const,
            reason: 'Cannot validate assets - wireframe code missing'
          }],
          score: 0
        };

    // Validate visual design
    const visualDesign = preview.wireframeCode
      ? this.validateVisualDesign(preview.wireframeCode)
      : {
          hasColorScheme: false,
          hasTypography: false,
          responsiveDesign: false,
          accessibilityCompliant: false,
          issues: [{
            field: 'visualDesign',
            severity: 'critical' as const,
            reason: 'Cannot validate visual design - wireframe code missing'
          }],
          score: 0
        };

    // Collect all issues
    allIssues.push(...architecture.issues);
    allIssues.push(...wireframe.issues);
    allIssues.push(...assets.issues);
    allIssues.push(...visualDesign.issues);

    // Categorize issues
    const criticalIssues = allIssues.filter(i => i.severity === 'critical');
    const warnings = allIssues.filter(i => i.severity === 'warning');
    const info = allIssues.filter(i => i.severity === 'info');

    // Calculate overall score (weighted average)
    const weights = {
      architecture: 0.25,
      wireframe: 0.35,
      assets: 0.20,
      visualDesign: 0.20
    };

    const overallScore = Math.round(
      architecture.score * weights.architecture +
      wireframe.score * weights.wireframe +
      assets.score * weights.assets +
      visualDesign.score * weights.visualDesign
    );

    return {
      overallScore: Math.max(0, Math.min(100, overallScore)),
      architecture,
      wireframe,
      assets,
      visualDesign,
      allIssues,
      criticalIssues,
      warnings,
      info
    };
  }
}

export const prototypeValidationService = new PrototypeValidationService();
