/**
 * Mobile App Store Compliance Validation
 * Validates generated mobile code meets iOS App Store and Google Play Store 2024 guidelines
 */

import { logger } from './logger.js';

export interface ComplianceIssue {
  severity: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  suggestion?: string;
}

export interface ComplianceReport {
  platform: 'ios' | 'android' | 'react-native' | 'flutter';
  compliant: boolean;
  issues: ComplianceIssue[];
  checklist: {
    infoPlist: boolean;
    privacyManifest: boolean;
    higCompliance: boolean;
    errorHandling: boolean;
    accessibility: boolean;
    noPlaceholders: boolean;
  };
}

/**
 * Validate iOS Swift/SwiftUI code for App Store compliance
 */
export function validateiOSCompliance(code: string): ComplianceReport {
  const issues: ComplianceIssue[] = [];
  const checklist = {
    infoPlist: false,
    privacyManifest: false,
    higCompliance: false,
    errorHandling: false,
    accessibility: false,
    noPlaceholders: false
  };

  // Check for Info.plist entries (in code comments or actual code)
  const infoPlistPatterns = [
    /NSCameraUsageDescription/i,
    /NSPhotoLibraryUsageDescription/i,
    /NSLocationWhenInUseUsageDescription/i,
    /NSMicrophoneUsageDescription/i,
    /NSContactsUsageDescription/i,
    /bundle.*identifier/i,
    /Info\.plist/i
  ];

  const hasInfoPlist = infoPlistPatterns.some(pattern => pattern.test(code));
  if (!hasInfoPlist) {
    issues.push({
      severity: 'warning',
      category: 'Info.plist',
      message: 'Missing Info.plist usage descriptions. Required for App Store submission.',
      suggestion: 'Add NSCameraUsageDescription, NSPhotoLibraryUsageDescription, etc. based on app features.'
    });
  } else {
    checklist.infoPlist = true;
  }

  // Check for privacy manifest (iOS 17+)
  const hasPrivacyManifest = /PrivacyInfo\.xcprivacy|Privacy.*manifest/i.test(code);
  if (!hasPrivacyManifest) {
    issues.push({
      severity: 'info',
      category: 'Privacy Manifest',
      message: 'Privacy manifest not detected. Required for iOS 17+ apps.',
      suggestion: 'Add PrivacyInfo.xcprivacy file for iOS 17+ compliance.'
    });
  } else {
    checklist.privacyManifest = true;
  }

  // Check HIG compliance (NavigationStack, proper UI patterns)
  const higPatterns = [
    /NavigationStack|NavigationView/i,
    /@State|@StateObject|@ObservedObject/i,
    /@Environment\(\.colorScheme\)/i,
    /\.font\(\.system/i,
    /accessibilityLabel/i
  ];

  const higCompliant = higPatterns.filter(pattern => pattern.test(code)).length >= 3;
  if (!higCompliant) {
    issues.push({
      severity: 'warning',
      category: 'HIG Compliance',
      message: 'Code may not fully comply with Human Interface Guidelines.',
      suggestion: 'Use NavigationStack, proper state management, Dynamic Type, and accessibility labels.'
    });
  } else {
    checklist.higCompliance = true;
  }

  // Check error handling
  const hasErrorHandling = /do\s*\{|catch|Error|try\s*\{/i.test(code);
  if (!hasErrorHandling) {
    issues.push({
      severity: 'error',
      category: 'Error Handling',
      message: 'Missing proper error handling. Required for App Store approval.',
      suggestion: 'Add try-catch blocks, error types, and user-friendly error messages.'
    });
  } else {
    checklist.errorHandling = true;
  }

  // Check accessibility
  const hasAccessibility = /accessibilityLabel|accessibilityHint|accessibilityValue/i.test(code);
  if (!hasAccessibility) {
    issues.push({
      severity: 'warning',
      category: 'Accessibility',
      message: 'Missing accessibility labels. Required for VoiceOver support.',
      suggestion: 'Add accessibilityLabel to all interactive elements.'
    });
  } else {
    checklist.accessibility = true;
  }

  // Check for placeholder content
  const placeholderPatterns = [
    /placeholder|test.*data|lorem|ipsum|TODO|FIXME|XXX/i
  ];
  const hasPlaceholders = placeholderPatterns.some(pattern => {
    const matches = code.match(new RegExp(pattern, 'gi'));
    // Allow comments with TODO/FIXME but not actual placeholder content
    return matches && matches.some(m => !m.includes('//') && !m.includes('/*'));
  });

  if (hasPlaceholders) {
    issues.push({
      severity: 'error',
      category: 'Content',
      message: 'Placeholder or test data detected. App Store will reject apps with placeholder content.',
      suggestion: 'Replace all placeholder content with real, production-ready content.'
    });
  } else {
    checklist.noPlaceholders = true;
  }

  // Check minimum iOS version
  const hasMinVersion = /@available.*iOS.*15|@available.*iOS.*16|minimum.*iOS/i.test(code);
  if (!hasMinVersion) {
    issues.push({
      severity: 'info',
      category: 'Version',
      message: 'Minimum iOS version not specified. Recommend iOS 15+ (iOS 16+ for SwiftUI).',
      suggestion: 'Add @available(iOS 15.0, *) or specify minimum deployment target.'
    });
  }

  return {
    platform: 'ios',
    compliant: issues.filter(i => i.severity === 'error').length === 0,
    issues,
    checklist
  };
}

/**
 * Validate Android Kotlin/Jetpack Compose code for Google Play compliance
 */
export function validateAndroidCompliance(code: string): ComplianceReport {
  const issues: ComplianceIssue[] = [];
  const checklist = {
    infoPlist: false, // Not applicable for Android
    privacyManifest: false, // Not applicable for Android
    higCompliance: false,
    errorHandling: false,
    accessibility: false,
    noPlaceholders: false
  };

  // Check for AndroidManifest.xml entries (in code comments)
  const manifestPatterns = [
    /AndroidManifest\.xml/i,
    /targetSdkVersion.*34|targetSdkVersion.*35/i,
    /minSdkVersion/i,
    /uses-permission/i,
    /privacy.*policy/i
  ];

  const hasManifest = manifestPatterns.some(pattern => pattern.test(code));
  if (!hasManifest) {
    issues.push({
      severity: 'warning',
      category: 'AndroidManifest.xml',
      message: 'Missing AndroidManifest.xml configuration. Required for Google Play submission.',
      suggestion: 'Add targetSdkVersion 34 (required), permissions with justifications, and privacy policy URL.'
    });
  }

  // Check target SDK version (must be 34)
  const hasTargetSDK34 = /targetSdkVersion.*34|target.*34/i.test(code);
  if (!hasTargetSDK34) {
    issues.push({
      severity: 'error',
      category: 'SDK Version',
      message: 'Target SDK version must be 34 (Android 14). Required for Google Play submission.',
      suggestion: 'Set targetSdkVersion to 34 in AndroidManifest.xml or build.gradle.'
    });
  }

  // Check Material Design 3 compliance
  const materialPatterns = [
    /Material3|MaterialButton|MaterialCard|Material.*3/i,
    /@Composable/i,
    /ViewModel/i,
    /StateFlow|Flow/i,
    /NavigationComponent|NavHost/i
  ];

  const materialCompliant = materialPatterns.filter(pattern => pattern.test(code)).length >= 3;
  if (!materialCompliant) {
    issues.push({
      severity: 'warning',
      category: 'Material Design',
      message: 'Code may not fully comply with Material Design 3 guidelines.',
      suggestion: 'Use Material 3 components, ViewModel for state, Navigation Component, and proper lifecycle handling.'
    });
  } else {
    checklist.higCompliance = true;
  }

  // Check error handling
  const hasErrorHandling = /try\s*\{|catch|Exception|Error/i.test(code);
  if (!hasErrorHandling) {
    issues.push({
      severity: 'error',
      category: 'Error Handling',
      message: 'Missing proper error handling. Required for Google Play approval.',
      suggestion: 'Add try-catch blocks, proper exception handling, and user-friendly error messages.'
    });
  } else {
    checklist.errorHandling = true;
  }

  // Check accessibility
  const hasAccessibility = /contentDescription|semantics|accessibility/i.test(code);
  if (!hasAccessibility) {
    issues.push({
      severity: 'warning',
      category: 'Accessibility',
      message: 'Missing content descriptions. Required for TalkBack support.',
      suggestion: 'Add contentDescription to all interactive elements.'
    });
  } else {
    checklist.accessibility = true;
  }

  // Check for placeholder content
  const placeholderPatterns = [
    /placeholder|test.*data|lorem|ipsum|TODO.*content|FIXME.*content/i
  ];
  const hasPlaceholders = placeholderPatterns.some(pattern => {
    const matches = code.match(new RegExp(pattern, 'gi'));
    return matches && matches.some(m => !m.includes('//') && !m.includes('/*'));
  });

  if (hasPlaceholders) {
    issues.push({
      severity: 'error',
      category: 'Content',
      message: 'Placeholder or test data detected. Google Play will reject apps with placeholder content.',
      suggestion: 'Replace all placeholder content with real, production-ready content.'
    });
  } else {
    checklist.noPlaceholders = true;
  }

  // Check for coroutine usage (not blocking main thread)
  const hasCoroutines = /suspend|CoroutineScope|viewModelScope|lifecycleScope/i.test(code);
  if (!hasCoroutines && /runBlocking/i.test(code)) {
    issues.push({
      severity: 'error',
      category: 'Threading',
      message: 'runBlocking detected. Never block main thread in Android apps.',
      suggestion: 'Use suspend functions and coroutines instead of runBlocking.'
    });
  }

  return {
    platform: 'android',
    compliant: issues.filter(i => i.severity === 'error').length === 0,
    issues,
    checklist
  };
}

/**
 * Validate React Native code for app store compliance
 */
export function validateReactNativeCompliance(code: string): ComplianceReport {
  const issues: ComplianceIssue[] = [];
  const checklist = {
    infoPlist: false,
    privacyManifest: false,
    higCompliance: false,
    errorHandling: false,
    accessibility: false,
    noPlaceholders: false
  };

  // Check for proper React Native setup
  const rnPatterns = [
    /react-native.*0\.7[2-9]|react-native.*0\.8/i,
    /@react-navigation/i,
    /Platform\.OS/i,
    /ErrorBoundary/i
  ];

  const rnCompliant = rnPatterns.filter(pattern => pattern.test(code)).length >= 2;
  if (!rnCompliant) {
    issues.push({
      severity: 'warning',
      category: 'React Native Setup',
      message: 'Code may not use latest React Native best practices.',
      suggestion: 'Use React Native 0.72+, React Navigation 6+, Platform.OS checks, and Error Boundaries.'
    });
  } else {
    checklist.higCompliance = true;
  }

  // Check error handling
  const hasErrorHandling = /try\s*\{|catch|ErrorBoundary|error/i.test(code);
  if (!hasErrorHandling) {
    issues.push({
      severity: 'error',
      category: 'Error Handling',
      message: 'Missing proper error handling.',
      suggestion: 'Add Error Boundaries and try-catch blocks.'
    });
  } else {
    checklist.errorHandling = true;
  }

  // Check accessibility
  const hasAccessibility = /accessible|accessibilityLabel|accessibilityHint/i.test(code);
  if (!hasAccessibility) {
    issues.push({
      severity: 'warning',
      category: 'Accessibility',
      message: 'Missing accessibility props.',
      suggestion: 'Add accessible and accessibilityLabel props to interactive elements.'
    });
  } else {
    checklist.accessibility = true;
  }

  // Check for placeholder content
  const hasPlaceholders = /placeholder|test.*data|lorem|ipsum/i.test(code) && 
                         !/\/\/.*placeholder|\/\*.*placeholder/i.test(code);
  if (hasPlaceholders) {
    issues.push({
      severity: 'error',
      category: 'Content',
      message: 'Placeholder content detected.',
      suggestion: 'Replace with real content.'
    });
  } else {
    checklist.noPlaceholders = true;
  }

  return {
    platform: 'react-native',
    compliant: issues.filter(i => i.severity === 'error').length === 0,
    issues,
    checklist
  };
}

/**
 * Validate Flutter code for app store compliance
 */
export function validateFlutterCompliance(code: string): ComplianceReport {
  const issues: ComplianceIssue[] = [];
  const checklist = {
    infoPlist: false,
    privacyManifest: false,
    higCompliance: false,
    errorHandling: false,
    accessibility: false,
    noPlaceholders: false
  };

  // Check for proper Flutter setup
  const flutterPatterns = [
    /flutter.*3\.1[6-9]|flutter.*3\.2/i,
    /MaterialApp|CupertinoApp/i,
    /Navigator|go_router/i,
    /Provider|Riverpod|Bloc/i
  ];

  const flutterCompliant = flutterPatterns.filter(pattern => pattern.test(code)).length >= 2;
  if (!flutterCompliant) {
    issues.push({
      severity: 'warning',
      category: 'Flutter Setup',
      message: 'Code may not use latest Flutter best practices.',
      suggestion: 'Use Flutter 3.16+, proper navigation, and state management.'
    });
  } else {
    checklist.higCompliance = true;
  }

  // Check error handling
  const hasErrorHandling = /try\s*\{|catch|onError/i.test(code);
  if (!hasErrorHandling) {
    issues.push({
      severity: 'error',
      category: 'Error Handling',
      message: 'Missing proper error handling.',
      suggestion: 'Add try-catch blocks and error handling.'
    });
  } else {
    checklist.errorHandling = true;
  }

  // Check accessibility
  const hasAccessibility = /Semantics|semanticsLabel|tooltip/i.test(code);
  if (!hasAccessibility) {
    issues.push({
      severity: 'warning',
      category: 'Accessibility',
      message: 'Missing Semantics widgets.',
      suggestion: 'Add Semantics widgets for accessibility support.'
    });
  } else {
    checklist.accessibility = true;
  }

  // Check for placeholder content
  const hasPlaceholders = /placeholder|test.*data|lorem|ipsum/i.test(code) && 
                         !/\/\/.*placeholder|\/\*.*placeholder/i.test(code);
  if (hasPlaceholders) {
    issues.push({
      severity: 'error',
      category: 'Content',
      message: 'Placeholder content detected.',
      suggestion: 'Replace with real content.'
    });
  } else {
    checklist.noPlaceholders = true;
  }

  return {
    platform: 'flutter',
    compliant: issues.filter(i => i.severity === 'error').length === 0,
    issues,
    checklist
  };
}

/**
 * Validate mobile code based on platform
 */
export function validateMobileCompliance(
  code: string,
  platform: 'ios' | 'android' | 'react-native' | 'flutter'
): ComplianceReport {
  switch (platform) {
    case 'ios':
      return validateiOSCompliance(code);
    case 'android':
      return validateAndroidCompliance(code);
    case 'react-native':
      return validateReactNativeCompliance(code);
    case 'flutter':
      return validateFlutterCompliance(code);
    default:
      return {
        platform: platform as any,
        compliant: false,
        issues: [{
          severity: 'error',
          category: 'Platform',
          message: `Unknown platform: ${platform}`
        }],
        checklist: {
          infoPlist: false,
          privacyManifest: false,
          higCompliance: false,
          errorHandling: false,
          accessibility: false,
          noPlaceholders: false
        }
      };
  }
}

/**
 * Generate compliance report for all mobile code artifacts
 */
export function generateComplianceReport(mobileCode: {
  reactNative?: string;
  flutter?: string;
  iosSwift?: string;
  androidKotlin?: string;
}): {
  reports: ComplianceReport[];
  overallCompliant: boolean;
  summary: string;
} {
  const reports: ComplianceReport[] = [];

  if (mobileCode.iosSwift) {
    reports.push(validateMobileCompliance(mobileCode.iosSwift, 'ios'));
  }
  if (mobileCode.androidKotlin) {
    reports.push(validateMobileCompliance(mobileCode.androidKotlin, 'android'));
  }
  if (mobileCode.reactNative) {
    reports.push(validateMobileCompliance(mobileCode.reactNative, 'react-native'));
  }
  if (mobileCode.flutter) {
    reports.push(validateMobileCompliance(mobileCode.flutter, 'flutter'));
  }

  const overallCompliant = reports.every(r => r.compliant);
  const errorCount = reports.reduce((sum, r) => sum + r.issues.filter(i => i.severity === 'error').length, 0);
  const warningCount = reports.reduce((sum, r) => sum + r.issues.filter(i => i.severity === 'warning').length, 0);

  const summary = overallCompliant
    ? `✅ All mobile code is compliant with app store guidelines.`
    : `⚠️ Found ${errorCount} error(s) and ${warningCount} warning(s) that need to be addressed before app store submission.`;

  return {
    reports,
    overallCompliant,
    summary
  };
}

