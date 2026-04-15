import { describe, it, expect } from 'vitest';
import {
  validateiOSCompliance,
  validateAndroidCompliance,
  validateReactNativeCompliance,
  validateFlutterCompliance,
  generateComplianceReport,
  type ComplianceReport
} from '../mobileCompliance.js';

describe('Mobile Compliance Validation', () => {
  describe('iOS Compliance', () => {
    it('should pass for compliant iOS SwiftUI code', () => {
      const code = `
        import SwiftUI
        import Foundation
        
        @main
        struct MyApp: App {
            var body: some Scene {
                WindowGroup {
                    ContentView()
                }
            }
        }
        
        struct ContentView: View {
            @State private var isLoading = false
            
            var body: some View {
                NavigationStack {
                    List {
                        Text("Hello World")
                            .accessibilityLabel("Hello World")
                    }
                    .navigationTitle("Home")
                }
                .task {
                    do {
                        try await loadData()
                    } catch {
                        print("Error: \\(error)")
                    }
                }
            }
            
            func loadData() async throws {
                // Network call
            }
        }
      `;

      const result = validateiOSCompliance(code);
      expect(result.platform).toBe('ios');
      expect(result.compliant).toBe(true);
      expect(result.issues.filter(i => i.severity === 'error')).toHaveLength(0);
    });

    it('should fail for code with placeholder content', () => {
      const code = `
        struct ContentView: View {
            var body: some View {
                Text("TODO: Add content here")
                Text("Lorem ipsum dolor sit amet")
            }
        }
      `;

      const result = validateiOSCompliance(code);
      expect(result.compliant).toBe(false);
      expect(result.issues.some(i => i.category === 'Content' && i.severity === 'error')).toBe(true);
    });

    it('should warn for missing Info.plist entries', () => {
      const code = `
        struct ContentView: View {
            var body: some View {
                Text("Hello")
            }
        }
      `;

      const result = validateiOSCompliance(code);
      expect(result.issues.some(i => i.category === 'Info.plist')).toBe(true);
    });

    it('should warn for missing error handling', () => {
      const code = `
        struct ContentView: View {
            var body: some View {
                Text("Hello")
            }
        }
      `;

      const result = validateiOSCompliance(code);
      expect(result.issues.some(i => i.category === 'Error Handling')).toBe(true);
    });
  });

  describe('Android Compliance', () => {
    it('should pass for compliant Android Kotlin code', () => {
      const code = `
        package com.example.app
        
        // AndroidManifest.xml: targetSdkVersion 34
        
        import androidx.compose.material3.MaterialTheme
        import androidx.compose.material3.Surface
        import androidx.compose.runtime.Composable
        import androidx.compose.ui.Modifier
        import androidx.compose.ui.semantics.contentDescription
        import androidx.compose.ui.semantics.semantics
        
        @Composable
        fun MainScreen() {
            MaterialTheme {
                Surface {
                    try {
                        Button(
                            onClick = { },
                            modifier = Modifier.semantics { contentDescription = "Submit Button" }
                        ) {
                            Text("Submit")
                        }
                    } catch (e: Exception) {
                        // Error handling
                    }
                }
            }
        }
      `;

      const result = validateAndroidCompliance(code);
      expect(result.platform).toBe('android');
      expect(result.compliant).toBe(true);
    });

    it('should fail for missing target SDK 34', () => {
      const code = `
        // AndroidManifest.xml should have targetSdkVersion 34
        // But this code doesn't mention it
        class MainActivity : ComponentActivity() {
            // ...
        }
      `;

      const result = validateAndroidCompliance(code);
      // Check that there's an SDK Version error issue
      const sdkIssue = result.issues.find(i => i.category === 'SDK Version' && i.severity === 'error');
      expect(sdkIssue).toBeDefined();
      expect(result.compliant).toBe(false);
    });

    it('should warn for missing Material Design 3', () => {
      const code = `
        class MainActivity : ComponentActivity() {
            // No Material 3 components
        }
      `;

      const result = validateAndroidCompliance(code);
      expect(result.issues.some(i => i.category === 'Material Design')).toBe(true);
    });
  });

  describe('React Native Compliance', () => {
    it('should pass for compliant React Native code', () => {
      const code = `
        import React from 'react';
        import { View, Text, Button } from 'react-native';
        import { NavigationContainer } from '@react-navigation/native';
        
        class ErrorBoundary extends React.Component {
            componentDidCatch(error, errorInfo) {
                console.error('Error:', error);
            }
            render() {
                return this.props.children;
            }
        }
        
        const App = () => {
            return (
                <ErrorBoundary>
                    <NavigationContainer>
                        <View>
                            <Text accessible={true} accessibilityLabel="Welcome">
                                Welcome
                            </Text>
                            <Button title="Submit" accessibilityLabel="Submit Button" />
                        </View>
                    </NavigationContainer>
                </ErrorBoundary>
            );
        };
        
        export default App;
      `;

      const result = validateReactNativeCompliance(code);
      expect(result.platform).toBe('react-native');
      expect(result.compliant).toBe(true);
    });

    it('should fail for code with placeholder content', () => {
      const code = `
        const App = () => {
            return (
                <View>
                    <Text>Placeholder text</Text>
                    <Text>Test data</Text>
                </View>
            );
        };
      `;

      const result = validateReactNativeCompliance(code);
      expect(result.compliant).toBe(false);
    });
  });

  describe('Flutter Compliance', () => {
    it('should pass for compliant Flutter code', () => {
      const code = `
        import 'package:flutter/material.dart';
        
        void main() {
          runApp(MyApp());
        }
        
        class MyApp extends StatelessWidget {
          @override
          Widget build(BuildContext context) {
            return MaterialApp(
              title: 'Flutter Demo',
              home: HomePage(),
            );
          }
        }
        
        class HomePage extends StatelessWidget {
          @override
          Widget build(BuildContext context) {
            try {
              return Scaffold(
                body: Semantics(
                  label: 'Welcome',
                  child: Text('Hello World'),
                ),
              );
            } catch (e) {
              // Error handling
              return Text('Error occurred');
            }
          }
        }
      `;

      const result = validateFlutterCompliance(code);
      expect(result.platform).toBe('flutter');
      expect(result.compliant).toBe(true);
    });

    it('should warn for missing error handling', () => {
      const code = `
        class HomePage extends StatelessWidget {
          Widget build(BuildContext context) {
            return Text('Hello');
          }
        }
      `;

      const result = validateFlutterCompliance(code);
      expect(result.issues.some(i => i.category === 'Error Handling')).toBe(true);
    });
  });

  describe('Compliance Report Generation', () => {
    it('should generate report for all mobile code types', () => {
      const mobileCode = {
        iosSwift: `
          struct ContentView: View {
              var body: some View {
                  Text("Hello")
              }
          }
        `,
        androidKotlin: `
          class MainActivity : ComponentActivity() {
              // Code here
          }
        `,
        reactNative: `
          const App = () => <View><Text>Hello</Text></View>;
        `,
        flutter: `
          class HomePage extends StatelessWidget {
              Widget build(BuildContext context) => Text('Hello');
          }
        `
      };

      const report = generateComplianceReport(mobileCode);
      expect(report.reports).toHaveLength(4);
      expect(report.reports.some(r => r.platform === 'ios')).toBe(true);
      expect(report.reports.some(r => r.platform === 'android')).toBe(true);
      expect(report.reports.some(r => r.platform === 'react-native')).toBe(true);
      expect(report.reports.some(r => r.platform === 'flutter')).toBe(true);
    });

    it('should handle empty mobile code', () => {
      const report = generateComplianceReport({});
      expect(report.reports).toHaveLength(0);
      expect(report.overallCompliant).toBe(true);
    });
  });
});
