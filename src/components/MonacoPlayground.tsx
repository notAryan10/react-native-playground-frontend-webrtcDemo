'use client';

import React, { useRef } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { Settings } from './SettingsPanel';
import type { editor } from 'monaco-editor';

export interface MonacoPlaygroundProps {
  value: string;
  onChange: (value: string) => void;
  settings: Settings;
  language?: string;
  dependencies?: Record<string, string>;
}

export const MonacoPlayground: React.FC<MonacoPlaygroundProps> = ({
  value,
  onChange,
  settings,
  language = 'typescript',
  dependencies = {}
}) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<any>(null);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      noEmit: true,
      esModuleInterop: true,
      jsx: monaco.languages.typescript.JsxEmit.React,
      allowJs: true,
      typeRoots: ['node_modules/@types'],
    });

    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      `
      declare module 'react-native' {
        import { ComponentType, ReactNode } from 'react';
        
        export interface ViewStyle {
          flex?: number;
          flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
          justifyContent?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
          alignItems?: 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
          padding?: number;
          paddingHorizontal?: number;
          paddingVertical?: number;
          margin?: number;
          marginHorizontal?: number;
          marginVertical?: number;
          backgroundColor?: string;
          borderRadius?: number;
          borderWidth?: number;
          borderColor?: string;
          gap?: number;
          [key: string]: any;
        }
        
        export interface TextStyle extends ViewStyle {
          fontSize?: number;
          fontWeight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
          color?: string;
          textAlign?: 'left' | 'center' | 'right' | 'justify';
          lineHeight?: number;
        }
        
        export interface ViewProps {
          style?: ViewStyle | ViewStyle[];
          children?: ReactNode;
          [key: string]: any;
        }
        
        export interface TextProps {
          style?: TextStyle | TextStyle[];
          children?: ReactNode;
          [key: string]: any;
        }
        
        export interface ScrollViewProps extends ViewProps {
          contentContainerStyle?: ViewStyle;
          horizontal?: boolean;
        }
        
        export interface PressableProps extends ViewProps {
          onPress?: () => void;
        }
        
        export const View: ComponentType<ViewProps>;
        export const Text: ComponentType<TextProps>;
        export const ScrollView: ComponentType<ScrollViewProps>;
        export const Pressable: ComponentType<PressableProps>;
        
        export const StyleSheet: {
          create<T>(styles: T): T;
          hairlineWidth: number;
        };
      }
      `,
      'file:///node_modules/@types/react-native/index.d.ts'
    );

    // Stub out pre-bundled native libraries so the editor doesn't show red squiggles.
    // Use wildcard named exports so both `import X from` and `import { X } from` work.
    const nativeLibStubs: Record<string, string> = {
      'expo-haptics': `
        declare module 'expo-haptics' {
          export enum ImpactFeedbackStyle { Light = 'light', Medium = 'medium', Heavy = 'heavy' }
          export enum NotificationFeedbackType { Success = 'success', Warning = 'warning', Error = 'error' }
          export function impactAsync(style?: ImpactFeedbackStyle): Promise<void>;
          export function notificationAsync(type?: NotificationFeedbackType): Promise<void>;
          export function selectionAsync(): Promise<void>;
        }`,
      'expo-linear-gradient': `
        declare module 'expo-linear-gradient' {
          import { ComponentType } from 'react';
          export interface LinearGradientProps { colors: string[]; start?: [number,number]; end?: [number,number]; style?: any; children?: any; }
          export const LinearGradient: ComponentType<LinearGradientProps>;
        }`,
      'expo-blur': `
        declare module 'expo-blur' {
          import { ComponentType } from 'react';
          export interface BlurViewProps { intensity?: number; tint?: 'light'|'dark'|'default'; style?: any; children?: any; }
          export const BlurView: ComponentType<BlurViewProps>;
        }`,
      'expo-camera': `
        declare module 'expo-camera' {
          import { ComponentType } from 'react';
          export const CameraView: ComponentType<any>;
          export function useCameraPermissions(): any;
          export const Camera: ComponentType<any>;
        }`,
      'expo-image-picker': `
        declare module 'expo-image-picker' {
          export function launchImageLibraryAsync(options?: any): Promise<any>;
          export function launchCameraAsync(options?: any): Promise<any>;
          export function requestMediaLibraryPermissionsAsync(): Promise<any>;
          export function requestCameraPermissionsAsync(): Promise<any>;
          export const MediaTypeOptions: any;
        }`,
      'expo-location': `
        declare module 'expo-location' {
          export function getCurrentPositionAsync(options?: any): Promise<any>;
          export function watchPositionAsync(options: any, callback: (loc: any) => void): Promise<any>;
          export function requestForegroundPermissionsAsync(): Promise<any>;
          export const Accuracy: any;
        }`,
      'expo-av': `
        declare module 'expo-av' {
          export const Audio: any;
          export const Video: any;
          export function useVideoPlayer(source: any, setup?: (player: any) => void): any;
        }`,
      'expo-sensors': `
        declare module 'expo-sensors' {
          export const Accelerometer: any;
          export const Gyroscope: any;
          export const Magnetometer: any;
          export const Barometer: any;
          export const DeviceMotion: any;
          export const LightSensor: any;
        }`,
      'expo-file-system': `
        declare module 'expo-file-system' {
          export const documentDirectory: string | null;
          export const cacheDirectory: string | null;
          export function readAsStringAsync(uri: string, options?: any): Promise<string>;
          export function writeAsStringAsync(uri: string, contents: string, options?: any): Promise<void>;
          export function deleteAsync(uri: string, options?: any): Promise<void>;
          export function getInfoAsync(uri: string, options?: any): Promise<any>;
        }`,
      'expo-notifications': `
        declare module 'expo-notifications' {
          export function scheduleNotificationAsync(request: any): Promise<string>;
          export function requestPermissionsAsync(): Promise<any>;
          export function setNotificationHandler(handler: any): void;
          export function addNotificationReceivedListener(listener: (n: any) => void): any;
          export const AndroidImportance: any;
        }`,
      'react-native-reanimated': `
        declare module 'react-native-reanimated' {
          import { ComponentType } from 'react';
          export function useSharedValue<T>(init: T): { value: T };
          export function useAnimatedStyle(fn: () => any): any;
          export function withSpring(toValue: number, config?: any, cb?: any): number;
          export function withTiming(toValue: number, config?: any, cb?: any): number;
          export function withSequence(...animations: any[]): number;
          export function withDelay(delayMs: number, animation: any): number;
          export function withRepeat(animation: any, numberOfReps?: number, reverse?: boolean): number;
          export function interpolate(value: number, inputRange: number[], outputRange: number[], extrapolate?: any): number;
          export function runOnJS<T extends (...args: any[]) => any>(fn: T): T;
          export const Easing: any;
          export const Extrapolation: any;
          const Animated: { View: ComponentType<any>; Text: ComponentType<any>; Image: ComponentType<any>; ScrollView: ComponentType<any>; [key: string]: any };
          export default Animated;
        }`,
      'react-native-gesture-handler': `
        declare module 'react-native-gesture-handler' {
          import { ComponentType } from 'react';
          export const GestureHandlerRootView: ComponentType<any>;
          export const GestureDetector: ComponentType<any>;
          export const Gesture: any;
          export const TapGestureHandler: ComponentType<any>;
          export const PanGestureHandler: ComponentType<any>;
          export const PinchGestureHandler: ComponentType<any>;
          export const TouchableOpacity: ComponentType<any>;
          export const TouchableHighlight: ComponentType<any>;
          export const ScrollView: ComponentType<any>;
          export const FlatList: ComponentType<any>;
          export const Swipeable: ComponentType<any>;
        }`,
    };

    Object.entries(nativeLibStubs).forEach(([lib, declaration]) => {
      monaco.languages.typescript.typescriptDefaults.addExtraLib(
        declaration,
        `file:///node_modules/@types/${lib}/index.d.ts`
      );
    });

    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false,
    });
  };

  React.useEffect(() => {
    const fetchTypes = async () => {
      if (!monacoRef.current) return;

      for (const [name, version] of Object.entries(dependencies)) {
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_ESM_SH || ''}/${name}@${version}`);
          const content = await response.text();
          monacoRef.current.languages.typescript.typescriptDefaults.addExtraLib(
            `declare module '${name}';`,
            `file:///node_modules/@types/${name}/index.d.ts`
          );
          console.log(`Types injected for ${name}`);
        } catch (e) {
          console.error(`Failed to fetch types for ${name}`, e);
        }
      }
    };

    if (Object.keys(dependencies).length > 0) {
      fetchTypes();
    }
  }, [dependencies]);

  return (
    <Editor
      height="100%"
      language={language}
      theme={settings.theme === 'dark' ? 'vs-dark' : 'vs-light'}
      value={value}
      onChange={(val) => onChange(val ?? '')}
      onMount={handleEditorDidMount}
      options={{
        fontSize: settings.fontSize,
        minimap: { enabled: settings.minimap },
        lineNumbers: settings.lineNumbers ? 'on' : 'off',
        automaticLayout: true,
        smoothScrolling: true,
        scrollBeyondLastLine: false,
        renderWhitespace: 'none',
        tabSize: 2,
        insertSpaces: true,
      }}
    />
  );
};

export default MonacoPlayground;